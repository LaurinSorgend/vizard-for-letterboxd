import {
	enrichFilms,
	enrichOmdb,
	fetchCollections,
	fetchFeed,
	fetchTypedRecords
} from '$lib/api/endpoints';
import { parseExport } from '$lib/ingest/parse';
import { feedHasGap, mergeFeed } from '$lib/ingest/rss';
import { normalizeOverrideUri, type TmdbOverride } from '$lib/overrides';
import {
	offersKey,
	type CollectionParts,
	type EnrichedFilm,
	type FeedEntry,
	type Film,
	type LetterboxdData,
	type OmdbRatings,
	type WatchlistEntry,
	type WatchlistFilm
} from '$lib/types';
import { blankProfile } from './film';

export interface Progress {
	stage: 'films' | 'ratings';
	done: number;
	total: number;
}

/**
 * Reads an export zip and adds the feed entries logged after the export was made. The export
 * alone still loads if the feed fails.
 */
export async function loadExport(bytes: Uint8Array): Promise<LetterboxdData> {
	let parsed: LetterboxdData;
	try {
		parsed = parseExport(bytes);
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : String(cause);
		throw new Error(
			`${message}. Make sure you drop the unmodified zip downloaded from Letterboxd.`
		);
	}
	const username = parsed.profile?.username;
	const feed = username ? await fetchFeed(username).catch(() => []) : [];
	const { library, newFilms } = mergeFeed(parsed.films, feed);
	return { ...parsed, films: [...library, ...newFilms] };
}

/** A library from a member's public feed alone: their latest diary entries and no watchlist. */
export async function loadFeed(username: string): Promise<LetterboxdData> {
	const feed = await fetchFeed(username);
	if (feed.length === 0) throw new Error(`${username} has no diary entries in their RSS feed.`);
	return {
		films: mergeFeed([], feed).newFilms,
		watchlist: [],
		lists: [],
		profile: blankProfile(username)
	};
}

async function ratingsFor(
	films: { tmdb: EnrichedFilm['tmdb'] }[],
	report: (progress: Progress) => void,
	signal?: AbortSignal
): Promise<Map<string, OmdbRatings | null>> {
	const imdbIds = [...new Set(films.map((f) => f.tmdb?.imdbId).filter((id): id is string => !!id))];
	report({ stage: 'ratings', done: 0, total: imdbIds.length });
	if (imdbIds.length === 0) return new Map();
	return enrichOmdb(imdbIds, (done, total) => report({ stage: 'ratings', done, total }), signal);
}

/** Joins films (and the watchlist) with TMDB records, then OMDb ratings for every IMDb match. */
export async function enrichLibrary(
	films: Film[],
	watchlist: WatchlistEntry[],
	report: (progress: Progress) => void,
	signal?: AbortSignal
): Promise<{ films: EnrichedFilm[]; watchlist: WatchlistFilm[] }> {
	const total = films.length + watchlist.length;
	const done = { films: 0, watchlist: 0 };
	const tick = () => report({ stage: 'films', done: done.films + done.watchlist, total });
	tick();
	const [watched, enrichedWatchlist] = await Promise.all([
		enrichFilms(films, (n) => ((done.films = n), tick()), signal),
		enrichWatchlist(watchlist, (n) => ((done.watchlist = n), tick()), signal)
	]);
	const omdb = await ratingsFor(watched, report, signal);
	return {
		films: watched.map((f) => ({
			...f,
			omdb: f.tmdb?.imdbId ? (omdb.get(f.tmdb.imdbId) ?? null) : null
		})),
		watchlist: enrichedWatchlist
	};
}

/** TMDB records for the watchlist, keeping full cast and keywords now that snapshots live in IndexedDB. */
function enrichWatchlist(
	watchlist: WatchlistEntry[],
	onProgress: (done: number) => void,
	signal?: AbortSignal
): Promise<WatchlistFilm[]> {
	return enrichFilms(watchlist, onProgress, signal);
}

/** Applies user-saved local TMDB ID overrides to matching films, fetching records and OMDb ratings. */
export async function applyTmdbOverrides(
	films: EnrichedFilm[],
	overrides: Record<string, TmdbOverride>,
	signal?: AbortSignal
): Promise<EnrichedFilm[]> {
	const entries = films
		.map((film, index) => ({
			index,
			target: overrides[normalizeOverrideUri(film.uri)]
		}))
		.filter((entry): entry is { index: number; target: TmdbOverride } => Boolean(entry.target));
	if (entries.length === 0) return films;

	const uniqueTargets = [...new Map(entries.map((e) => [offersKey(e.target), e.target])).values()];
	const fetched = await fetchTypedRecords(uniqueTargets, undefined, signal).catch(
		() => new Map<string, EnrichedFilm['tmdb']>()
	);
	const imdbIds = [
		...new Set(
			[...fetched.values()].map((record) => record?.imdbId).filter((id): id is string => !!id)
		)
	];
	const omdb =
		imdbIds.length > 0
			? await enrichOmdb(imdbIds, undefined, signal).catch(
					() => new Map<string, OmdbRatings | null>()
				)
			: new Map<string, OmdbRatings | null>();

	const next = [...films];
	for (const { index, target } of entries) {
		const record = fetched.get(offersKey(target));
		if (!record) continue;
		const film = next[index];
		next[index] = {
			...film,
			tmdb: record,
			omdb: record.imdbId ? (omdb.get(record.imdbId) ?? film.omdb) : null
		};
	}
	return next;
}

/** Franchise sizes and film stubs for every collection in the library that `known` does not already cover with `parts`. */
export async function collectionsFor(
	films: EnrichedFilm[],
	known: CollectionParts[] = []
): Promise<CollectionParts[]> {
	const byId = new Map<number, CollectionParts>();
	for (const collection of known) byId.set(collection.id, collection);

	const ids = [
		...new Set(
			films
				.map((film) => film.tmdb?.collection?.id)
				.filter((id): id is number => id != null && !Array.isArray(byId.get(id)?.parts))
		)
	];
	if (ids.length > 0) {
		for (const collection of await fetchCollections(ids)) {
			byId.set(collection.id, collection);
		}
	}
	return [...byId.values()];
}

/** Merges a feed into an analysed library, looking up only the films the feed introduced. */
export async function refreshFromFeed(
	library: EnrichedFilm[],
	feed: FeedEntry[]
): Promise<{ films: EnrichedFilm[]; addedEntries: number; gap: boolean }> {
	const gap = feedHasGap(library, feed);
	const merged = mergeFeed(library, feed);
	const { films: added } = await enrichLibrary(merged.newFilms, [], () => {});
	return { films: [...merged.library, ...added], addedEntries: merged.addedEntries, gap };
}
