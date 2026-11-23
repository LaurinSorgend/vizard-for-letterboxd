import type { RegionOffers, WatchlistFilm } from '$lib/types';
import { serviceCounts, streamingOn, type OffersOf } from './filter';

const MS_PER_DAY = 86_400_000;

/** The oldest dated entry on the watchlist. */
export interface OldestEntry {
	name: string;
	added: string;
	daysAgo: number;
}

/** Streaming coverage on the viewer's selected services. */
export interface SelectedServiceCoverage {
	count: number;
	pct: number | null;
}

/** The single service streaming the most watchlist films. */
export interface TopService {
	name: string;
	films: number;
	pct: number;
}

/** Backlog and streaming-coverage metrics for the watchlist. */
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
	loading: boolean;
}

const pctOf = (part: number, whole: number): number | null =>
	whole > 0 ? Math.round((part / whole) * 100) : null;

const hasRentOrBuy = (offers: RegionOffers | null): boolean =>
	offers !== null && (offers.rent.length > 0 || offers.buy.length > 0);

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
	const daysAgo = Math.max(0, Math.floor((now.getTime() - best.time) / MS_PER_DAY));
	return { name: best.name, added: best.added, daysAgo };
}

function offerMetrics(films: WatchlistFilm[], offersOf: OffersOf, services: number[]) {
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

	const counts = serviceCounts(films, offersOf);
	const lead = counts[0];
	const topService: TopService | null = lead
		? { name: lead.provider.name, films: lead.films, pct: pctOf(lead.films, checked) ?? 0 }
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

/** Summarises watchlist backlog size, watch time, age, and regional streaming coverage. */
export function watchlistSummary(
	films: WatchlistFilm[],
	offersOf: OffersOf,
	services: number[],
	loading: boolean,
	now: Date = new Date()
): WatchlistSummary {
	const unmatched = films.reduce((n, f) => n + (f.tmdb ? 0 : 1), 0);
	return {
		total: films.length,
		...runtimeMetrics(films),
		oldest: oldestEntry(films, now),
		...offerMetrics(films, offersOf, services),
		unmatched,
		loading
	};
}
