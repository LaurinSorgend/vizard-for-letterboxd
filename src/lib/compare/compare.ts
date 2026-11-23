import { canonicalFilmKey, type FilmIdentity } from '$lib/film/identity';
import { releaseYear } from '$lib/film/release';
import { byGenre, byPerson } from '$lib/film/tally';
import { pearson } from '$lib/math';
import { FAVOURITE_RATING, isFavourite } from '$lib/recommend/taste';
import type { EnrichedFilm, TmdbMovie, WatchlistFilm } from '$lib/types';

/** Rating gap threshold for a film to count as close agreement. */
const CLOSE_AGREEMENT_DIFF = 0.5;
/** Minimum rating gap for a film to appear in the disagreements list. */
export const MIN_DISAGREEMENT_DIFF = 1;
/** Mean absolute star gap that maps to 0% rating compatibility. */
const COMPATIBILITY_ZERO_DIFF = 2.5;
/** Minimum shared rated films before computing Pearson correlation. */
const MIN_PEARSON_OVERLAP = 3;

export interface LibraryInput {
	films: EnrichedFilm[];
	watchlist: WatchlistFilm[];
}

export interface OverlapStats {
	yourCount: number;
	friendCount: number;
	sharedCount: number;
	unionCount: number;
	jaccardPct: number;
	bothRatedCount: number;
	meanAbsDiff: number | null;
	signedBias: number | null;
	closeAgreementPct: number | null;
	pearson: number | null;
	compatibilityPct: number | null;
	mutualFavouritesCount: number;
}

export interface RatingDisagreement {
	key: string;
	title: string;
	year: number | null;
	uri: string;
	ratingA: number;
	ratingB: number;
	diff: number;
	absDiff: number;
}

export interface MutualFavourite {
	key: string;
	title: string;
	year: number | null;
	uri: string;
	ratingA: number | null;
	ratingB: number | null;
	likedA: boolean;
	likedB: boolean;
}

export interface SharedDirector {
	key: string;
	name: string;
	href: string | null;
	countA: number;
	countB: number;
	avgA: number | null;
	avgB: number | null;
}

export interface SharedGenre {
	name: string;
	countA: number;
	countB: number;
	shareA: number;
	shareB: number;
	avgA: number | null;
	avgB: number | null;
}

export interface WatchTogetherItem {
	key: string;
	name: string;
	year: number | null;
	uri: string;
	posterPath: string | null;
	details: string;
}

export interface WatchRecommendation {
	key: string;
	name: string;
	year: number | null;
	uri: string;
	posterPath: string | null;
	rating: number | null;
	liked: boolean;
}

export interface WatchTogether {
	mutualWatchlist: WatchTogetherItem[];
	friendRecommends: WatchRecommendation[];
	youRecommend: WatchRecommendation[];
}

export interface ComparisonResult {
	overlap: OverlapStats;
	disagreements: RatingDisagreement[];
	mutualFavourites: MutualFavourite[];
	sharedDirectors: SharedDirector[];
	sharedGenres: SharedGenre[];
	watchTogether: WatchTogether;
}

interface PairedFilm {
	key: string;
	filmA: EnrichedFilm;
	filmB: EnrichedFilm;
}

function indexByKey<T extends FilmIdentity>(items: T[]): Map<string, T> {
	const map = new Map<string, T>();
	for (const item of items) {
		const key = canonicalFilmKey(item);
		if (!map.has(key)) map.set(key, item);
	}
	return map;
}

function pairDetails(year: number | null, tmdb: TmdbMovie | null): string {
	return [year, tmdb?.runtime ? `${tmdb.runtime} min` : null, tmdb?.genres.slice(0, 3).join(', ')]
		.filter(Boolean)
		.join(' · ');
}

function computeOverlap(
	yourCount: number,
	friendCount: number,
	shared: PairedFilm[],
	mutualFavouritesCount: number
): OverlapStats {
	const sharedCount = shared.length;
	const unionCount = yourCount + friendCount - sharedCount;
	const jaccardPct = unionCount === 0 ? 0 : (sharedCount / unionCount) * 100;
	const rated = shared.filter(({ filmA, filmB }) => filmA.rating !== null && filmB.rating !== null);
	const bothRatedCount = rated.length;
	if (bothRatedCount === 0) {
		return {
			yourCount,
			friendCount,
			sharedCount,
			unionCount,
			jaccardPct,
			bothRatedCount: 0,
			meanAbsDiff: null,
			signedBias: null,
			closeAgreementPct: null,
			pearson: null,
			compatibilityPct: null,
			mutualFavouritesCount
		};
	}

	let absSum = 0;
	let signedSum = 0;
	let closeCount = 0;
	const xs: number[] = [];
	const ys: number[] = [];
	for (const { filmA, filmB } of rated) {
		const a = filmA.rating as number;
		const b = filmB.rating as number;
		const diff = a - b;
		const abs = Math.abs(diff);
		absSum += abs;
		signedSum += diff;
		if (abs <= CLOSE_AGREEMENT_DIFF) closeCount += 1;
		xs.push(a);
		ys.push(b);
	}

	const meanAbsDiff = absSum / bothRatedCount;
	return {
		yourCount,
		friendCount,
		sharedCount,
		unionCount,
		jaccardPct,
		bothRatedCount,
		meanAbsDiff,
		signedBias: signedSum / bothRatedCount,
		closeAgreementPct: (closeCount / bothRatedCount) * 100,
		pearson: bothRatedCount >= MIN_PEARSON_OVERLAP ? pearson(xs, ys) : null,
		compatibilityPct: Math.round(Math.max(0, 1 - meanAbsDiff / COMPATIBILITY_ZERO_DIFF) * 100),
		mutualFavouritesCount
	};
}

function buildDisagreements(shared: PairedFilm[]): RatingDisagreement[] {
	const rows: RatingDisagreement[] = [];
	for (const { key, filmA, filmB } of shared) {
		if (filmA.rating === null || filmB.rating === null) continue;
		const diff = filmA.rating - filmB.rating;
		const absDiff = Math.abs(diff);
		if (absDiff < MIN_DISAGREEMENT_DIFF) continue;
		rows.push({
			key,
			title: filmA.name,
			year: filmA.year ?? filmB.year,
			uri: filmA.uri || filmB.uri,
			ratingA: filmA.rating,
			ratingB: filmB.rating,
			diff,
			absDiff
		});
	}
	return rows.sort(
		(a, b) =>
			b.absDiff - a.absDiff ||
			Math.max(b.ratingA, b.ratingB) - Math.max(a.ratingA, a.ratingB) ||
			a.title.localeCompare(b.title)
	);
}

function buildMutualFavourites(shared: PairedFilm[]): MutualFavourite[] {
	const rows: MutualFavourite[] = [];
	for (const { key, filmA, filmB } of shared) {
		if (!isFavourite(filmA) || !isFavourite(filmB)) continue;
		rows.push({
			key,
			title: filmA.name,
			year: filmA.year ?? filmB.year,
			uri: filmA.uri || filmB.uri,
			ratingA: filmA.rating,
			ratingB: filmB.rating,
			likedA: filmA.liked,
			likedB: filmB.liked
		});
	}
	return rows.sort((a, b) => {
		const scoreA = (a.ratingA ?? FAVOURITE_RATING) + (a.ratingB ?? FAVOURITE_RATING);
		const scoreB = (b.ratingA ?? FAVOURITE_RATING) + (b.ratingB ?? FAVOURITE_RATING);
		return (
			scoreB - scoreA ||
			Number(b.likedA && b.likedB) - Number(a.likedA && a.likedB) ||
			a.title.localeCompare(b.title)
		);
	});
}

function buildSharedDirectors(filmsA: EnrichedFilm[], filmsB: EnrichedFilm[]): SharedDirector[] {
	const mapA = new Map(byPerson(filmsA, 'directors').map((d) => [d.key, d]));
	const mapB = new Map(byPerson(filmsB, 'directors').map((d) => [d.key, d]));
	const shared: SharedDirector[] = [];
	for (const [key, a] of mapA) {
		const b = mapB.get(key);
		if (!b) continue;
		shared.push({
			key,
			name: a.label,
			href: a.href ?? b.href ?? null,
			countA: a.count,
			countB: b.count,
			avgA: a.avg,
			avgB: b.avg
		});
	}
	return shared.sort(
		(a, b) =>
			Math.min(b.countA, b.countB) - Math.min(a.countA, a.countB) ||
			b.countA + b.countB - (a.countA + a.countB) ||
			a.name.localeCompare(b.name)
	);
}

function buildSharedGenres(filmsA: EnrichedFilm[], filmsB: EnrichedFilm[]): SharedGenre[] {
	const mapA = new Map(byGenre(filmsA).map((g) => [g.key, g]));
	const mapB = new Map(byGenre(filmsB).map((g) => [g.key, g]));
	const shared: SharedGenre[] = [];
	for (const [name, a] of mapA) {
		const b = mapB.get(name);
		if (!b) continue;
		shared.push({
			name,
			countA: a.count,
			countB: b.count,
			shareA: filmsA.length > 0 ? a.count / filmsA.length : 0,
			shareB: filmsB.length > 0 ? b.count / filmsB.length : 0,
			avgA: a.avg,
			avgB: b.avg
		});
	}
	return shared.sort(
		(a, b) => b.countA + b.countB - (a.countA + a.countB) || a.name.localeCompare(b.name)
	);
}

function buildRecommendations(
	targetWatchlist: Map<string, WatchlistFilm>,
	targetWatched: Map<string, EnrichedFilm>,
	recommenderWatched: Map<string, EnrichedFilm>
): WatchRecommendation[] {
	const rows: WatchRecommendation[] = [];
	for (const [key, watchlistFilm] of targetWatchlist) {
		if (targetWatched.has(key)) continue;
		const recommenderFilm = recommenderWatched.get(key);
		if (!recommenderFilm || !isFavourite(recommenderFilm)) continue;
		rows.push({
			key,
			name: watchlistFilm.name,
			year: watchlistFilm.year ?? recommenderFilm.year,
			uri: watchlistFilm.uri || recommenderFilm.uri,
			posterPath: watchlistFilm.tmdb?.posterPath ?? recommenderFilm.tmdb?.posterPath ?? null,
			rating: recommenderFilm.rating,
			liked: recommenderFilm.liked
		});
	}
	return rows.sort(
		(a, b) =>
			(b.rating ?? FAVOURITE_RATING) - (a.rating ?? FAVOURITE_RATING) ||
			Number(b.liked) - Number(a.liked) ||
			a.name.localeCompare(b.name)
	);
}

function buildWatchTogether(
	watchedA: Map<string, EnrichedFilm>,
	watchedB: Map<string, EnrichedFilm>,
	watchlistA: WatchlistFilm[],
	watchlistB: WatchlistFilm[]
): WatchTogether {
	const wlA = indexByKey(watchlistA);
	const wlB = indexByKey(watchlistB);
	const mutualWatchlist: WatchTogetherItem[] = [];
	for (const [key, filmA] of wlA) {
		const filmB = wlB.get(key);
		if (!filmB || watchedA.has(key) || watchedB.has(key)) continue;
		const tmdb = filmA.tmdb ?? filmB.tmdb;
		const year = releaseYear(filmA) ?? releaseYear(filmB);
		mutualWatchlist.push({
			key,
			name: filmA.name,
			year,
			uri: filmA.uri || filmB.uri,
			posterPath: tmdb?.posterPath ?? null,
			details: pairDetails(year, tmdb)
		});
	}
	mutualWatchlist.sort((a, b) => a.name.localeCompare(b.name));
	return {
		mutualWatchlist,
		friendRecommends: buildRecommendations(wlA, watchedA, watchedB),
		youRecommend: buildRecommendations(wlB, watchedB, watchedA)
	};
}

export function compareLibraries(you: LibraryInput, friend: LibraryInput): ComparisonResult {
	const watchedA = indexByKey(you.films);
	const watchedB = indexByKey(friend.films);
	const shared: PairedFilm[] = [];
	for (const [key, filmA] of watchedA) {
		const filmB = watchedB.get(key);
		if (filmB) shared.push({ key, filmA, filmB });
	}
	const dedupedA = [...watchedA.values()];
	const dedupedB = [...watchedB.values()];
	const mutualFavourites = buildMutualFavourites(shared);
	return {
		overlap: computeOverlap(dedupedA.length, dedupedB.length, shared, mutualFavourites.length),
		disagreements: buildDisagreements(shared),
		mutualFavourites,
		sharedDirectors: buildSharedDirectors(dedupedA, dedupedB),
		sharedGenres: buildSharedGenres(dedupedA, dedupedB),
		watchTogether: buildWatchTogether(watchedA, watchedB, you.watchlist, friend.watchlist)
	};
}
