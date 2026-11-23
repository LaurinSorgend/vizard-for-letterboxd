import { effectiveCountries } from '$lib/film/countries';
import { languageName } from '$lib/film/language';
import { releaseYear } from '$lib/film/release';
import { getOrCreate } from '$lib/maps';
import { compareSpectrum, type Swatch } from '$lib/posters/colors';
import { posterUrl } from '$lib/posters/posters';
import { hashString, seeded } from '$lib/random';
import type { TasteMatch } from '$lib/recommend/similarity';
import type { OfferKind, Provider, RegionOffers, WatchlistFilm } from '$lib/types';

export type Availability = 'any' | 'stream' | 'free' | 'rent' | 'none';

export const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
	{ value: 'any', label: 'Everything' },
	{ value: 'stream', label: 'Streaming (subscription or free)' },
	{ value: 'free', label: 'Free, with or without ads' },
	{ value: 'rent', label: 'To rent or buy' },
	{ value: 'none', label: 'Not streaming' }
];

export const SORT_OPTIONS = [
	{ value: 'added-desc', label: 'Recently added' },
	{ value: 'added-asc', label: 'Added longest ago' },
	{ value: 'taste', label: 'Best match for your taste', requires: 'taste' },
	{ value: 'release-desc', label: 'Newest release' },
	{ value: 'release-asc', label: 'Oldest release' },
	{ value: 'rating', label: 'TMDB rating' },
	{ value: 'popularity', label: 'Most popular' },
	{ value: 'runtime-asc', label: 'Shortest' },
	{ value: 'runtime-desc', label: 'Longest' },
	{ value: 'title', label: 'Title A–Z' },
	{ value: 'shuffle', label: 'Shuffled' },
	{ value: 'colour', label: 'Colour spectrum', requires: 'palette' }
] as const;

export type WatchSort = (typeof SORT_OPTIONS)[number]['value'];

export type SwatchOf = (film: WatchlistFilm) => Swatch | undefined;

export type TasteOf = (film: WatchlistFilm) => TasteMatch | null;

export interface SortContext {
	seed?: number;
	swatchOf?: SwatchOf;
	tasteOf?: TasteOf;
}

/** The poster the wall and the pick show, which is also the image the colour sort reads. */
export const posterOf = (film: WatchlistFilm): string | null => posterUrl(film.tmdb, 'w185');

export interface WatchFilters {
	query: string;
	availability: Availability;
	/** Provider ids; when any are picked, availability only counts these services. */
	services: number[];
	mediaType: 'all' | 'movie' | 'tv';
	genre: string;
	/** A language's display name (`languageName`), so codes sharing a name filter as one. */
	language: string;
	country: string;
	fromYear: number | null;
	toYear: number | null;
	maxRuntime: number | null;
	minRating: number | null;
}

export const NO_FILTERS: WatchFilters = {
	query: '',
	availability: 'any',
	services: [],
	mediaType: 'all',
	genre: '',
	language: '',
	country: '',
	fromYear: null,
	toYear: null,
	maxRuntime: null,
	minRating: null
};

/** Offers for a film: undefined while still loading, null when it has none in the country. */
export type OffersOf = (film: WatchlistFilm) => RegionOffers | null | undefined;

const STREAM_KINDS: OfferKind[] = ['flatrate', 'free', 'ads'];
const RENT_KINDS: OfferKind[] = ['rent', 'buy'];

const KINDS: Record<Exclude<Availability, 'none'>, OfferKind[]> = {
	any: ['flatrate', 'free', 'ads', 'rent', 'buy'],
	stream: STREAM_KINDS,
	free: ['free', 'ads'],
	rent: RENT_KINDS
};

/** The services offering a film by any of `kinds`, deduplicated, in TMDB's display order. */
function providersOf(offers: RegionOffers | null | undefined, kinds: OfferKind[]): Provider[] {
	if (!offers) return [];
	const seen = new Map<number, Provider>();
	for (const kind of kinds) for (const p of offers[kind]) if (!seen.has(p.id)) seen.set(p.id, p);
	return [...seen.values()];
}

export const streamingOn = (offers: RegionOffers | null | undefined): Provider[] =>
	providersOf(offers, STREAM_KINDS);

export const hasRentOrBuy = (offers: RegionOffers | null | undefined): boolean =>
	providersOf(offers, RENT_KINDS).length > 0;

function offeredBy(offers: RegionOffers | null, kinds: OfferKind[], services: number[]): boolean {
	const providers = providersOf(offers, kinds);
	return services.length === 0
		? providers.length > 0
		: providers.some((p) => services.includes(p.id));
}

function matchesAvailability(film: WatchlistFilm, filters: WatchFilters, offersOf: OffersOf) {
	const { availability, services } = filters;
	if (availability === 'any' && services.length === 0) return true;
	const offers = offersOf(film);
	if (offers === undefined) return false;
	if (availability === 'none') return !offeredBy(offers, STREAM_KINDS, services);
	return offeredBy(offers, KINDS[availability], services);
}

function matchesQuery(film: WatchlistFilm, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	const people = [...(film.tmdb?.directors ?? []), ...(film.tmdb?.cast ?? [])];
	return [film.name, film.tmdb?.title ?? '', ...people.map((p) => p.name)].some((text) =>
		text.toLowerCase().includes(needle)
	);
}

function matchesFacets(film: WatchlistFilm, filters: WatchFilters): boolean {
	const tmdb = film.tmdb;
	if (filters.mediaType !== 'all' && (tmdb?.mediaType ?? 'movie') !== filters.mediaType)
		return false;
	if (filters.genre && !tmdb?.genres.includes(filters.genre)) return false;
	if (
		filters.language &&
		(!tmdb?.originalLanguage || languageName(tmdb.originalLanguage) !== filters.language)
	)
		return false;
	if (filters.country && !countriesOf(film).includes(filters.country)) return false;
	const year = releaseYear(film);
	if (filters.fromYear !== null && (year === null || year < filters.fromYear)) return false;
	if (filters.toYear !== null && (year === null || year > filters.toYear)) return false;
	if (filters.maxRuntime !== null && (!tmdb?.runtime || tmdb.runtime > filters.maxRuntime))
		return false;
	return filters.minRating === null || (tmdb?.voteAverage ?? 0) >= filters.minRating;
}

export function countriesOf(film: WatchlistFilm): string[] {
	return film.tmdb ? effectiveCountries(film.tmdb) : [];
}

export function filterWatchlist(
	films: WatchlistFilm[],
	filters: WatchFilters,
	offersOf: OffersOf
): WatchlistFilm[] {
	return films.filter(
		(film) =>
			matchesQuery(film, filters.query) &&
			matchesFacets(film, filters) &&
			matchesAvailability(film, filters, offersOf)
	);
}

/** Missing values sort last whichever way the list runs. */
function byNumber(value: (film: WatchlistFilm) => number | null | undefined, descending: boolean) {
	return (a: WatchlistFilm, b: WatchlistFilm) => {
		const x = value(a) ?? null;
		const y = value(b) ?? null;
		if (x === null || y === null) return (x === null ? 1 : 0) - (y === null ? 1 : 0);
		return descending ? y - x : x - y;
	};
}

function releaseKey(film: WatchlistFilm): number | null {
	const date = film.tmdb?.releaseDate;
	if (date) return Date.parse(date);
	const year = releaseYear(film);
	return year === null ? null : Date.UTC(year, 0, 1);
}

function addedKey(film: WatchlistFilm): number | null {
	return film.added ? Date.parse(film.added) : null;
}

const byVoteDesc = byNumber((f) => f.tmdb?.voteAverage, true);

function compareTaste(a: WatchlistFilm, b: WatchlistFilm, tasteOf: TasteOf): number {
	const scoreA = tasteOf(a)?.score ?? 0;
	const scoreB = tasteOf(b)?.score ?? 0;
	if (scoreA !== scoreB) return scoreB - scoreA;
	return byVoteDesc(a, b);
}

function comparator(sort: WatchSort, { seed = 0, swatchOf, tasteOf }: SortContext) {
	switch (sort) {
		case 'added-desc':
			return byNumber(addedKey, true);
		case 'added-asc':
			return byNumber(addedKey, false);
		case 'taste':
			return (a: WatchlistFilm, b: WatchlistFilm) => compareTaste(a, b, tasteOf ?? (() => null));
		case 'release-desc':
			return byNumber(releaseKey, true);
		case 'release-asc':
			return byNumber(releaseKey, false);
		case 'rating':
			return byVoteDesc;
		case 'popularity':
			return byNumber((f) => f.tmdb?.voteCount, true);
		case 'runtime-asc':
			return byNumber((f) => f.tmdb?.runtime, false);
		case 'runtime-desc':
			return byNumber((f) => f.tmdb?.runtime, true);
		case 'title':
			return () => 0;
		case 'shuffle':
			return byNumber((f) => seeded(hashString(f.uri) + seed), false);
		case 'colour':
			return (a: WatchlistFilm, b: WatchlistFilm) => compareSpectrum(swatchOf?.(a), swatchOf?.(b));
	}
}

/** Sorted copy; ties, and the title sort itself, fall back to the film's name. */
export function sortWatchlist(
	films: WatchlistFilm[],
	sort: WatchSort,
	context: SortContext = {}
): WatchlistFilm[] {
	const compare = comparator(sort, context);
	return [...films].sort((a, b) => compare(a, b) || a.name.localeCompare(b.name));
}

export interface ServiceCount {
	provider: Provider;
	films: number;
}

/** Services streaming at least one watchlist film, most films first. */
export function serviceCounts(films: WatchlistFilm[], offersOf: OffersOf): ServiceCount[] {
	const counts = new Map<number, ServiceCount>();
	for (const film of films) {
		for (const provider of streamingOn(offersOf(film))) {
			getOrCreate(counts, provider.id, () => ({ provider, films: 0 })).films += 1;
		}
	}
	return [...counts.values()].sort(
		(a, b) => b.films - a.films || a.provider.name.localeCompare(b.provider.name)
	);
}
