import {
	isTmdbId,
	tmdbRefKey,
	type CustomList,
	type CustomListItem,
	type EnrichedFilm,
	type TmdbMovie
} from '$lib/types';

export interface FilmIdentity {
	name: string;
	year: number | null;
	tmdb: TmdbMovie | null;
}

/**
 * Library-local film key used when merging Letterboxd CSVs and RSS entries, because diary and
 * review rows carry per-entry URIs rather than a shared canonical film URI.
 */
export const filmKey = (name: string, year: number | null): string => `${name}::${year}`;

/** Letterboxd exports mix trailing slashes and casing across CSVs and custom lists. */
export function normalizeUri(uri: string): string {
	return uri.trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * Cross-library identity for matching films across two users' exports/feeds. Uses TMDB
 * mediaType+id when available (ignoring negative TheTVDB ids) and falls back to normalized
 * name + year.
 */
export function canonicalFilmKey(film: FilmIdentity): string {
	if (film.tmdb && isTmdbId(film.tmdb.tmdbId)) return tmdbRefKey(film.tmdb);
	return filmKey(film.name.trim().toLowerCase(), film.year);
}

/** Deduplication key for an unmatched custom-list item. */
export function listItemKey(item: Pick<CustomListItem, 'uri' | 'name' | 'year'>): string {
	return normalizeUri(item.uri) || filmKey(item.name.trim(), item.year);
}

export interface FilmIndex {
	match: (item: Pick<CustomListItem, 'uri' | 'name' | 'year'>) => EnrichedFilm | undefined;
}

/** Indexes a library so custom-list items match by normalized URI first, then trimmed name + year. */
export function indexFilmsForList(films: EnrichedFilm[]): FilmIndex {
	const byUri = new Map<string, EnrichedFilm>();
	const byKey = new Map<string, EnrichedFilm>();
	for (const film of films) {
		const uri = normalizeUri(film.uri);
		if (uri && !byUri.has(uri)) byUri.set(uri, film);
		const key = filmKey(film.name.trim(), film.year);
		if (!byKey.has(key)) byKey.set(key, film);
	}
	return {
		match(item) {
			const uri = normalizeUri(item.uri);
			return (uri ? byUri.get(uri) : undefined) ?? byKey.get(filmKey(item.name.trim(), item.year));
		}
	};
}

/** Predicate matching library films that belong to `list`, using the same URI/name+year rules as `indexFilmsForList`. */
export function buildListFilmMatcher(list: CustomList): (film: EnrichedFilm) => boolean {
	const uris = new Set<string>();
	const keys = new Set<string>();
	for (const item of list.items) {
		const uri = normalizeUri(item.uri);
		if (uri) uris.add(uri);
		keys.add(filmKey(item.name.trim(), item.year));
	}
	return (film) => {
		const uri = normalizeUri(film.uri);
		return (uri.length > 0 && uris.has(uri)) || keys.has(filmKey(film.name.trim(), film.year));
	};
}
