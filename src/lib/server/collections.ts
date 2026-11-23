import { DAY_MS } from '$lib/math';
import type { CollectionPart, CollectionParts } from '$lib/types';
import type { BatchLookup } from './batch';
import type { FetchBudget } from './budget';
import { jsonCache, type Cache } from './cache';
import { tmdbGet, tmdbYear } from './tmdb';

interface RawPart {
	id?: unknown;
	title?: unknown;
	release_date?: string;
	poster_path?: string | null;
}

function toPart(raw: RawPart): CollectionPart | null {
	if (typeof raw?.id !== 'number' || typeof raw.title !== 'string') return null;
	return {
		tmdbId: raw.id,
		title: raw.title,
		year: tmdbYear(raw),
		posterPath: typeof raw.poster_path === 'string' ? raw.poster_path : null
	};
}

function compareParts(a: CollectionPart, b: CollectionPart): number {
	return (a.year ?? Infinity) - (b.year ?? Infinity) || a.title.localeCompare(b.title);
}

/**
 * A franchise's full size and film stubs under TMDB's own name ("Alien Collection"), or null when
 * TMDB answers without one. One subrequest, and the answer changes about once a decade.
 */
export async function fetchCollection(
	budget: FetchBudget,
	id: number
): Promise<CollectionParts | null> {
	const data = (await tmdbGet(budget, `/collection/${id}`, {})) as {
		id?: number;
		name?: string;
		parts?: RawPart[];
	} | null;
	if (!data?.id || !Array.isArray(data.parts)) return null;
	const parts = data.parts
		.map(toPart)
		.filter((part): part is CollectionPart => part !== null)
		.sort(compareParts);
	return { id: data.id, name: data.name ?? '', total: data.parts.length, parts };
}

const rawCache = jsonCache<number, CollectionParts | null>({
	table: 'collections',
	key: 'collection_id',
	ttlMs: 90 * DAY_MS
});

/** Drops older cached rows that lack `parts` so they refetch and upgrade transparently. */
function withPartsUpgrade(
	base: Cache<number, CollectionParts | null>
): Cache<number, CollectionParts | null> {
	return {
		async getMany(db, keys) {
			const stored = await base.getMany(db, keys);
			const upgraded = new Map<number, CollectionParts | null>();
			for (const [id, value] of stored) {
				if (value && Array.isArray(value.parts)) upgraded.set(id, value);
			}
			return upgraded;
		},
		putMany: (db, entries) => base.putMany(db, entries)
	};
}

/** Franchise sizes and parts by collection id. A null answer is not cached; the id came from a record that names it. */
export const collections: BatchLookup<number, number, CollectionParts | null> = {
	keyOf: (id) => id,
	cache: withPartsUpgrade(rawCache),
	fetchOne: fetchCollection,
	label: 'tmdb collection'
};
