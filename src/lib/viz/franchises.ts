import { byCollection, likedCount, type BarDatum } from '$lib/film/tally';
import type { CollectionPart, CollectionParts, EnrichedFilm } from '$lib/types';

export type FranchiseSort = 'count' | 'completion' | 'rating';

export interface FranchiseProgress extends BarDatum {
	seen: number;
	total: number | null;
	ratio: number | null;
	completed: boolean;
	liked: number;
	missing: CollectionPart[];
}

const COMPARATORS: Record<FranchiseSort, (a: FranchiseProgress, b: FranchiseProgress) => number> = {
	count: (a, b) =>
		b.seen - a.seen || (b.ratio ?? -1) - (a.ratio ?? -1) || a.label.localeCompare(b.label),
	completion: (a, b) =>
		(b.ratio ?? -1) - (a.ratio ?? -1) || b.seen - a.seen || a.label.localeCompare(b.label),
	rating: (a, b) =>
		(b.avg ?? -1) - (a.avg ?? -1) ||
		b.liked - a.liked ||
		b.seen - a.seen ||
		a.label.localeCompare(b.label)
};

export function sortFranchises(
	items: FranchiseProgress[],
	sort: FranchiseSort
): FranchiseProgress[] {
	return [...items].sort(COMPARATORS[sort]);
}

/** Joins followed franchises (2+ watched films) with full TMDB collection sizes and unwatched parts. */
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
		const liked = likedCount(datum.films);
		const seenIds = new Set(datum.films.flatMap((film) => (film.tmdb ? [film.tmdb.tmdbId] : [])));
		const missing = (collection?.parts ?? []).filter((part) => !seenIds.has(part.tmdbId));
		return { ...datum, seen, total, ratio, completed, liked, missing };
	});

	return items.sort(COMPARATORS[sort]);
}
