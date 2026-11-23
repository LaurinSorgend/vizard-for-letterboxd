import { indexFilmsForList, listItemKey } from '$lib/film/identity';
import { avgRating } from '$lib/film/tally';
import type { CustomList, CustomListItem, EnrichedFilm } from '$lib/types';

export type ListSort = 'size' | 'watched' | 'completion' | 'rating';

export interface ListStats {
	list: CustomList;
	total: number;
	watched: number;
	ratio: number | null;
	pct: number;
	completed: boolean;
	avgRating: number | null;
	ratedCount: number;
	missing: CustomListItem[];
}

export interface ListSummary {
	listCount: number;
	uniqueFilms: number;
	completedLists: number;
}

function ratingTier(item: ListStats): number {
	if (item.ratedCount >= 2) return 2;
	if (item.ratedCount === 1) return 1;
	return 0;
}

function byName(a: ListStats, b: ListStats): number {
	return a.list.name.localeCompare(b.list.name) || a.list.id.localeCompare(b.list.id);
}

const COMPARATORS: Record<ListSort, (a: ListStats, b: ListStats) => number> = {
	size: (a, b) => b.total - a.total || b.watched - a.watched || byName(a, b),
	watched: (a, b) => b.watched - a.watched || b.total - a.total || byName(a, b),
	completion: (a, b) => (b.ratio ?? -1) - (a.ratio ?? -1) || b.watched - a.watched || byName(a, b),
	rating: (a, b) =>
		ratingTier(b) - ratingTier(a) ||
		(b.avgRating ?? -1) - (a.avgRating ?? -1) ||
		b.watched - a.watched ||
		byName(a, b)
};

export function sortListStats(stats: ListStats[], sort: ListSort): ListStats[] {
	return [...stats].sort(COMPARATORS[sort]);
}

function evaluateList(list: CustomList, index: ReturnType<typeof indexFilmsForList>): ListStats {
	const matched = new Set<EnrichedFilm>();
	const seenMissing = new Set<string>();
	const missing: CustomListItem[] = [];

	for (const item of list.items) {
		const hit = index.match(item);
		if (hit) {
			matched.add(hit);
			continue;
		}
		const key = listItemKey(item);
		if (seenMissing.has(key)) continue;
		seenMissing.add(key);
		missing.push(item);
	}

	const watchedFilms = [...matched];
	const watched = watchedFilms.length;
	const total = watched + missing.length;
	const ratio = total > 0 ? watched / total : null;
	const ratedCount = watchedFilms.filter((film) => film.rating !== null).length;

	return {
		list,
		total,
		watched,
		ratio,
		pct: ratio !== null ? Math.round(ratio * 100) : 0,
		completed: total > 0 && watched === total,
		avgRating: avgRating(watchedFilms),
		ratedCount,
		missing
	};
}

/** Matches each custom list against `films` (normalized URI or trimmed name+year), deduplicating per list. */
export function buildListStats(
	lists: CustomList[],
	films: EnrichedFilm[],
	sort: ListSort = 'size'
): ListStats[] {
	const index = indexFilmsForList(films);
	return lists.map((list) => evaluateList(list, index)).sort(COMPARATORS[sort]);
}

export function listSummary(stats: ListStats[]): ListSummary {
	const uniqueKeys = new Set<string>();
	let completedLists = 0;

	for (const entry of stats) {
		if (entry.completed) completedLists += 1;
		for (const item of entry.list.items) {
			uniqueKeys.add(listItemKey(item));
		}
	}

	return {
		listCount: stats.length,
		uniqueFilms: uniqueKeys.size,
		completedLists
	};
}
