import { byCollection, type BarDatum } from '$lib/film/tally';
import type { CollectionParts, EnrichedFilm } from '$lib/types';

/** Ordering for the franchise progress chart. */
export type FranchiseSort = 'count' | 'completion' | 'rating';

/** One followed franchise with watched progress against its full TMDB collection size. */
export interface FranchiseProgress extends BarDatum {
	seen: number;
	total: number | null;
	ratio: number | null;
	completed: boolean;
	liked: number;
}

function compareByCount(a: FranchiseProgress, b: FranchiseProgress): number {
	return b.seen - a.seen || (b.ratio ?? -1) - (a.ratio ?? -1) || a.label.localeCompare(b.label);
}

function compareByCompletion(a: FranchiseProgress, b: FranchiseProgress): number {
	return (b.ratio ?? -1) - (a.ratio ?? -1) || b.seen - a.seen || a.label.localeCompare(b.label);
}

function compareByRating(a: FranchiseProgress, b: FranchiseProgress): number {
	return (
		(b.avg ?? -1) - (a.avg ?? -1) ||
		b.liked - a.liked ||
		b.seen - a.seen ||
		a.label.localeCompare(b.label)
	);
}

const COMPARATORS: Record<FranchiseSort, (a: FranchiseProgress, b: FranchiseProgress) => number> = {
	count: compareByCount,
	completion: compareByCompletion,
	rating: compareByRating
};

/**
 * Joins followed franchises (2+ watched films) from `films` with known full collection sizes and
 * sorts them by watched count, completion ratio, or average rating.
 */
export function franchiseProgress(
	films: EnrichedFilm[],
	collections: CollectionParts[],
	sort: FranchiseSort = 'count'
): FranchiseProgress[] {
	const totals = new Map<string, number>();
	for (const collection of collections) {
		if (collection.total > 0) totals.set(String(collection.id), collection.total);
	}

	const items: FranchiseProgress[] = byCollection(films).map((datum) => {
		const seen = datum.count;
		const known = totals.get(datum.key);
		const total = known !== undefined ? Math.max(known, seen) : null;
		const ratio = total !== null ? seen / total : null;
		const completed = total !== null && seen >= total;
		const liked = datum.films.filter((film) => film.liked).length;
		return { ...datum, seen, total, ratio, completed, liked };
	});

	return items.sort(COMPARATORS[sort]);
}

/** Counts how many franchises in `items` have every known film watched. */
export function completedFranchiseCount(items: FranchiseProgress[]): number {
	return items.filter((item) => item.completed).length;
}
