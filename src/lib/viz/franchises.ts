import { byCollection, type BarDatum } from '$lib/film/tally';
import type { CollectionPart, CollectionParts, EnrichedFilm } from '$lib/types';

/** Ordering for the franchise progress chart. */
export type FranchiseSort = 'count' | 'completion' | 'rating';

/** One followed franchise with watched progress and unwatched parts from its TMDB collection. */
export interface FranchiseProgress extends BarDatum {
	seen: number;
	total: number | null;
	ratio: number | null;
	completed: boolean;
	liked: number;
	/** Collection entries not present in the watched films for this franchise. */
	missing: CollectionPart[];
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
	const byId = new Map<string, CollectionParts>();
	for (const collection of collections) {
		byId.set(String(collection.id), collection);
	}

	const items: FranchiseProgress[] = byCollection(films).map((datum) => {
		const seen = datum.count;
		const collection = byId.get(datum.key);
		const known = collection && collection.total > 0 ? collection.total : undefined;
		const total = known !== undefined ? Math.max(known, seen) : null;
		const ratio = total !== null ? seen / total : null;
		const completed = total !== null && seen >= total;
		const liked = datum.films.filter((film) => film.liked).length;
		const seenIds = new Set(datum.films.flatMap((film) => (film.tmdb ? [film.tmdb.tmdbId] : [])));
		const missing = (collection?.parts ?? []).filter((part) => !seenIds.has(part.tmdbId));
		return { ...datum, seen, total, ratio, completed, liked, missing };
	});

	return items.sort(COMPARATORS[sort]);
}

/** Counts how many franchises in `items` have every known film watched. */
export function completedFranchiseCount(items: FranchiseProgress[]): number {
	return items.filter((item) => item.completed).length;
}
