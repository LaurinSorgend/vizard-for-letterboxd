import { DAY_MS } from '$lib/math';
import type { WatchlistFilm } from '$lib/types';
import {
	hasRentOrBuy,
	serviceCounts,
	streamingOn,
	type OffersOf,
	type ServiceCount
} from './filter';

interface OldestEntry {
	name: string;
	added: string;
	daysAgo: number;
}

interface SelectedServiceCoverage {
	count: number;
	pct: number | null;
}

interface TopService {
	name: string;
	films: number;
	pct: number;
}

export interface WatchlistSummary {
	total: number;
	totalHours: number;
	timedCount: number;
	avgRuntime: number | null;
	oldest: OldestEntry | null;
	checked: number;
	streamingAny: number;
	streamingPct: number | null;
	rentOnly: number;
	unavailable: number;
	onSelectedServices: SelectedServiceCoverage | null;
	topService: TopService | null;
	unmatched: number;
}

const pctOf = (part: number, whole: number): number | null =>
	whole > 0 ? Math.round((part / whole) * 100) : null;

function runtimeMetrics(films: WatchlistFilm[]): {
	totalHours: number;
	timedCount: number;
	avgRuntime: number | null;
} {
	let totalMinutes = 0;
	let timedCount = 0;
	for (const film of films) {
		const runtime = film.tmdb?.runtime;
		if (typeof runtime === 'number' && runtime > 0) {
			totalMinutes += runtime;
			timedCount += 1;
		}
	}
	return {
		totalHours: Math.round(totalMinutes / 60),
		timedCount,
		avgRuntime: timedCount > 0 ? Math.round(totalMinutes / timedCount) : null
	};
}

function oldestEntry(films: WatchlistFilm[], now: Date): OldestEntry | null {
	let best: { name: string; added: string; time: number } | null = null;
	for (const film of films) {
		if (!film.added) continue;
		const time = Date.parse(film.added);
		if (!Number.isFinite(time)) continue;
		if (
			best === null ||
			time < best.time ||
			(time === best.time && film.name.localeCompare(best.name) < 0)
		) {
			best = { name: film.name, added: film.added, time };
		}
	}
	if (!best) return null;
	const daysAgo = Math.max(0, Math.floor((now.getTime() - best.time) / DAY_MS));
	return { name: best.name, added: best.added, daysAgo };
}

function offerMetrics(
	films: WatchlistFilm[],
	offersOf: OffersOf,
	services: number[],
	counts: ServiceCount[]
) {
	let checked = 0;
	let streamingAny = 0;
	let rentOnly = 0;
	let unavailable = 0;
	let selectedCount = 0;

	for (const film of films) {
		const offers = offersOf(film);
		if (offers === undefined) continue;
		checked += 1;
		const streamers = streamingOn(offers);
		if (streamers.length > 0) {
			streamingAny += 1;
			if (services.length > 0 && streamers.some((p) => services.includes(p.id))) {
				selectedCount += 1;
			}
		} else if (hasRentOrBuy(offers)) {
			rentOnly += 1;
		} else {
			unavailable += 1;
		}
	}

	const lead = counts[0];
	const topService: TopService | null =
		lead && checked > 0
			? {
					name: lead.provider.name,
					films: lead.films,
					pct: Math.round((lead.films / checked) * 100)
				}
			: null;

	return {
		checked,
		streamingAny,
		streamingPct: pctOf(streamingAny, checked),
		rentOnly,
		unavailable,
		onSelectedServices:
			services.length > 0 ? { count: selectedCount, pct: pctOf(selectedCount, checked) } : null,
		topService
	};
}

export function watchlistSummary(
	films: WatchlistFilm[],
	offersOf: OffersOf,
	services: number[],
	options: { counts?: ServiceCount[]; now?: Date } = {}
): WatchlistSummary {
	const counts = options.counts ?? serviceCounts(films, offersOf);
	const unmatched = films.reduce((n, f) => n + (f.tmdb ? 0 : 1), 0);
	return {
		total: films.length,
		...runtimeMetrics(films),
		oldest: oldestEntry(films, options.now ?? new Date()),
		...offerMetrics(films, offersOf, services, counts),
		unmatched
	};
}
