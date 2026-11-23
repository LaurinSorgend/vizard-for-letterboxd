import { filmKey } from '$lib/ingest/film';
import type { CustomList, CustomListItem, EnrichedFilm } from '$lib/types';

/** Ordering for the custom lists breakdown. */
export type ListSort = 'size' | 'watched' | 'completion' | 'rating';

/** Watched progress, rating summary, and remaining items for one custom list. */
export interface ListStats {
	list: CustomList;
	total: number;
	watched: number;
	pct: number;
	avgRating: number | null;
	liked: number;
	totalMinutes: number;
	missing: CustomListItem[];
}

/** Aggregate overview across a collection of custom lists. */
export interface ListSummary {
	listCount: number;
	totalItems: number;
	uniqueFilms: number;
	completedLists: number;
}

interface RankedListStats {
	stats: ListStats;
	ratedCount: number;
}

function ratingTier(item: RankedListStats): number {
	if (item.ratedCount >= 2) return 2;
	if (item.ratedCount === 1) return 1;
	return 0;
}

function byName(a: ListStats, b: ListStats): number {
	return a.list.name.localeCompare(b.list.name) || a.list.id.localeCompare(b.list.id);
}

const COMPARATORS: Record<ListSort, (a: RankedListStats, b: RankedListStats) => number> = {
	size: (a, b) =>
		b.stats.total - a.stats.total || b.stats.watched - a.stats.watched || byName(a.stats, b.stats),
	watched: (a, b) =>
		b.stats.watched - a.stats.watched || b.stats.total - a.stats.total || byName(a.stats, b.stats),
	completion: (a, b) =>
		(b.stats.total > 0 ? b.stats.pct : -1) - (a.stats.total > 0 ? a.stats.pct : -1) ||
		b.stats.watched - a.stats.watched ||
		byName(a.stats, b.stats),
	rating: (a, b) =>
		ratingTier(b) - ratingTier(a) ||
		(b.stats.avgRating ?? -1) - (a.stats.avgRating ?? -1) ||
		b.stats.watched - a.stats.watched ||
		byName(a.stats, b.stats)
};

function evaluateList(
	list: CustomList,
	byUri: Map<string, EnrichedFilm>,
	byKey: Map<string, EnrichedFilm>
): RankedListStats {
	const matched = new Set<EnrichedFilm>();
	const seenMissing = new Set<string>();
	const missing: CustomListItem[] = [];

	for (const item of list.items) {
		const hit =
			(item.uri ? byUri.get(item.uri) : undefined) ?? byKey.get(filmKey(item.name, item.year));
		if (hit) {
			matched.add(hit);
			continue;
		}
		const missingKey = item.uri || filmKey(item.name, item.year);
		if (seenMissing.has(missingKey)) continue;
		seenMissing.add(missingKey);
		missing.push(item);
	}

	const watchedFilms = [...matched];
	const watched = watchedFilms.length;
	const total = watched + missing.length;
	const pct = total > 0 ? Math.round((watched / total) * 100) : 0;

	let ratingSum = 0;
	let ratedCount = 0;
	let liked = 0;
	let totalMinutes = 0;
	for (const film of watchedFilms) {
		if (film.rating !== null) {
			ratingSum += film.rating;
			ratedCount += 1;
		}
		if (film.liked) liked += 1;
		totalMinutes += film.tmdb?.runtime ?? 0;
	}

	return {
		ratedCount,
		stats: {
			list,
			total,
			watched,
			pct,
			avgRating: ratedCount > 0 ? ratingSum / ratedCount : null,
			liked,
			totalMinutes,
			missing
		}
	};
}

/**
 * Matches each custom list's items against `films` (by URI or `filmKey`), deduplicating repeated
 * entries within a list, and sorts the resulting stats according to `sort`.
 */
export function buildListStats(
	lists: CustomList[],
	films: EnrichedFilm[],
	sort: ListSort = 'size'
): ListStats[] {
	const byUri = new Map<string, EnrichedFilm>();
	const byKey = new Map<string, EnrichedFilm>();
	for (const film of films) {
		if (film.uri) byUri.set(film.uri, film);
		byKey.set(filmKey(film.name, film.year), film);
	}

	return lists
		.map((list) => evaluateList(list, byUri, byKey))
		.sort(COMPARATORS[sort])
		.map((ranked) => ranked.stats);
}

/** Computes headline counts across the supplied list statistics. */
export function listSummary(stats: ListStats[]): ListSummary {
	const uniqueKeys = new Set<string>();
	let totalItems = 0;
	let completedLists = 0;

	for (const entry of stats) {
		totalItems += entry.total;
		if (entry.total > 0 && entry.watched === entry.total) completedLists += 1;
		for (const item of entry.list.items) {
			uniqueKeys.add(item.uri || filmKey(item.name, item.year));
		}
	}

	return {
		listCount: stats.length,
		totalItems,
		uniqueFilms: uniqueKeys.size,
		completedLists
	};
}
