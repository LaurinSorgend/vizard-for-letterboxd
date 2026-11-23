import {
	enrichFilms,
	enrichOmdb,
	fetchCollections,
	fetchFeed,
	fetchTypedRecords
} from '$lib/api/endpoints';
import { parseExport } from '$lib/ingest/parse';
import { feedHasGap, mergeFeed } from '$lib/ingest/rss';
import { getOverride, type OverrideMap } from '$lib/overrides';
import {
	tmdbRefKey,
	type CollectionParts,
	type EnrichedFilm,
	type FeedEntry,
	type Film,
	type LetterboxdData,
	type OmdbRatings,
	type TmdbMovie,
	type TmdbRef,
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
	films: { tmdb: TmdbMovie | null }[],
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
		enrichFilms(watchlist, (n) => ((done.watchlist = n), tick()), signal)
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

/** Fetches one user-supplied TMDB record and its OMDb ratings (OMDb errors degrade to null). */
export async function resolveTmdbOverride(
	target: TmdbRef
): Promise<
	{ ok: true; record: TmdbMovie; omdb: OmdbRatings | null } | { ok: false; error: string }
> {
	let record: TmdbMovie | null = null;
	try {
		const fetched = await fetchTypedRecords([target]);
		record = fetched.get(tmdbRefKey(target)) ?? null;
	} catch (cause) {
		return {
			ok: false,
			error: cause instanceof Error ? cause.message : 'Could not reach TMDB.'
		};
	}
	if (!record) {
		const kind = target.mediaType === 'tv' ? 'series' : 'movie';
		return { ok: false, error: `No TMDB ${kind} found for ID ${target.tmdbId}.` };
	}
	const omdbMap = record.imdbId
		? await enrichOmdb([record.imdbId]).catch(() => new Map<string, OmdbRatings | null>())
		: new Map<string, OmdbRatings | null>();
	return {
		ok: true,
		record,
		omdb: record.imdbId ? (omdbMap.get(record.imdbId) ?? null) : null
	};
}

/** Applies saved local TMDB overrides to matching watched films and watchlist entries. */
export async function applyTmdbOverrides(
	films: EnrichedFilm[],
	watchlist: WatchlistFilm[],
	overrides: OverrideMap,
	signal?: AbortSignal
): Promise<{ films: EnrichedFilm[]; watchlist: WatchlistFilm[] }> {
	const filmTargets = films.flatMap((film, index) => {
		const target = getOverride(overrides, film.uri);
		return target ? [{ index, target }] : [];
	});
	const watchTargets = watchlist.flatMap((item, index) => {
		const target = getOverride(overrides, item.uri);
		return target ? [{ index, target }] : [];
	});
	const allTargets = [...filmTargets, ...watchTargets];
	if (allTargets.length === 0) return { films, watchlist };

	const uniqueTargets = [
		...new Map(allTargets.map((e) => [tmdbRefKey(e.target), e.target])).values()
	];
	const fetched = await fetchTypedRecords(uniqueTargets, undefined, signal).catch(
		() => new Map<string, TmdbMovie | null>()
	);
	const imdbIds = [
		...new Set(
			filmTargets
				.map(({ target }) => fetched.get(tmdbRefKey(target))?.imdbId)
				.filter((id): id is string => !!id)
		)
	];
	const omdb =
		imdbIds.length > 0
			? await enrichOmdb(imdbIds, undefined, signal).catch(
					() => new Map<string, OmdbRatings | null>()
				)
			: new Map<string, OmdbRatings | null>();

	const nextFilms = [...films];
	for (const { index, target } of filmTargets) {
		const record = fetched.get(tmdbRefKey(target));
		if (!record) continue;
		nextFilms[index] = {
			...nextFilms[index],
			tmdb: record,
			omdb: record.imdbId ? (omdb.get(record.imdbId) ?? null) : null
		};
	}

	const nextWatchlist = [...watchlist];
	for (const { index, target } of watchTargets) {
		const record = fetched.get(tmdbRefKey(target));
		if (!record) continue;
		nextWatchlist[index] = { ...nextWatchlist[index], tmdb: record };
	}

	return { films: nextFilms, watchlist: nextWatchlist };
}

/** Franchise sizes and film stubs for every collection in the library not already carrying `parts`. */
export async function collectionsFor(
	films: EnrichedFilm[],
	known: CollectionParts[] = []
): Promise<{ collections: CollectionParts[]; updated: boolean }> {
	const byId = new Map<number, CollectionParts>();
	for (const collection of known) byId.set(collection.id, collection);

	const ids = [
		...new Set(
			films
				.map((film) => film.tmdb?.collection?.id)
				.filter((id): id is number => id != null && !Array.isArray(byId.get(id)?.parts))
		)
	];
	if (ids.length === 0) return { collections: [...byId.values()], updated: false };
	for (const collection of await fetchCollections(ids)) {
		byId.set(collection.id, collection);
	}
	return { collections: [...byId.values()], updated: true };
}

/** Merges a feed into an analysed library, looking up only the films the feed introduced. */
export async function refreshFromFeed(
	library: EnrichedFilm[],
	feed: FeedEntry[],
	overrides: OverrideMap = {}
): Promise<{ films: EnrichedFilm[]; addedEntries: number; gap: boolean }> {
	const gap = feedHasGap(library, feed);
	const merged = mergeFeed(library, feed);
	const { films: added } = await enrichLibrary(merged.newFilms, [], () => {});
	const { films: resolved } = await applyTmdbOverrides(added, [], overrides);
	return { films: [...merged.library, ...resolved], addedEntries: merged.addedEntries, gap };
}
