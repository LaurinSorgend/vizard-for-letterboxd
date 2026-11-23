import { filmKey } from '$lib/ingest/film';
import { getOrCreate } from '$lib/maps';
import { isTmdbId, type EnrichedFilm, type TmdbMovie, type WatchlistFilm } from '$lib/types';

export interface LibraryInput {
	name: string;
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
	filmA: EnrichedFilm;
	filmB: EnrichedFilm;
	title: string;
	year: number | null;
	uri: string;
	posterPath: string | null;
	ratingA: number;
	ratingB: number;
	diff: number;
	absDiff: number;
}

export interface MutualFavourite {
	filmA: EnrichedFilm;
	filmB: EnrichedFilm;
	title: string;
	year: number | null;
	uri: string;
	posterPath: string | null;
	ratingA: number | null;
	ratingB: number | null;
	likedA: boolean;
	likedB: boolean;
}

export interface SharedDirector {
	name: string;
	tmdbId: number | null;
	countA: number;
	countB: number;
	avgA: number | null;
	avgB: number | null;
	combined: number;
}

export interface SharedGenre {
	name: string;
	countA: number;
	countB: number;
	shareA: number;
	shareB: number;
	avgA: number | null;
	avgB: number | null;
	combined: number;
}

export interface WatchTogetherItem {
	key: string;
	name: string;
	year: number | null;
	uri: string;
	posterPath: string | null;
	filmA: WatchlistFilm;
	filmB: WatchlistFilm;
}

export interface WatchRecommendation {
	key: string;
	name: string;
	year: number | null;
	uri: string;
	posterPath: string | null;
	watchlistFilm: WatchlistFilm;
	recommenderFilm: EnrichedFilm;
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

interface FilmIdentity {
	name: string;
	year: number | null;
	tmdb: TmdbMovie | null;
}

interface TallyBucket {
	name: string;
	tmdbId: number | null;
	count: number;
	ratingSum: number;
	ratedCount: number;
}

/**
 * Canonical cross-library identity for a watched or watchlist film.
 * Uses TMDB mediaType + id when matched to TMDB, falling back to normalized name + year.
 */
export function canonicalFilmKey(film: FilmIdentity): string {
	if (film.tmdb && isTmdbId(film.tmdb.tmdbId)) {
		return `${film.tmdb.mediaType}:${film.tmdb.tmdbId}`;
	}
	return filmKey(film.name.trim().toLowerCase(), film.year);
}

function indexByKey<T extends FilmIdentity>(items: T[]): Map<string, T> {
	const map = new Map<string, T>();
	for (const item of items) {
		const key = canonicalFilmKey(item);
		if (!map.has(key)) map.set(key, item);
	}
	return map;
}

function isLoved(film: EnrichedFilm): boolean {
	return (film.rating !== null && film.rating >= 4) || film.liked;
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
	const n = xs.length;
	if (n < 3) return null;
	const meanX = xs.reduce((sum, v) => sum + v, 0) / n;
	const meanY = ys.reduce((sum, v) => sum + v, 0) / n;
	let num = 0;
	let denX = 0;
	let denY = 0;
	for (let i = 0; i < n; i++) {
		const dx = xs[i] - meanX;
		const dy = ys[i] - meanY;
		num += dx * dy;
		denX += dx * dx;
		denY += dy * dy;
	}
	if (denX === 0 || denY === 0) return null;
	const r = num / Math.sqrt(denX * denY);
	return Math.max(-1, Math.min(1, r));
}

function computeOverlap(
	yourCount: number,
	friendCount: number,
	shared: [EnrichedFilm, EnrichedFilm][],
	mutualFavouritesCount: number
): OverlapStats {
	const sharedCount = shared.length;
	const unionCount = yourCount + friendCount - sharedCount;
	const jaccardPct = unionCount === 0 ? 0 : (sharedCount / unionCount) * 100;
	const rated = shared.filter(
		(pair): pair is [EnrichedFilm & { rating: number }, EnrichedFilm & { rating: number }] =>
			pair[0].rating !== null && pair[1].rating !== null
	);
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
	for (const [a, b] of rated) {
		const diff = a.rating - b.rating;
		const abs = Math.abs(diff);
		absSum += abs;
		signedSum += diff;
		if (abs <= 0.5) closeCount += 1;
		xs.push(a.rating);
		ys.push(b.rating);
	}
	const meanAbsDiff = absSum / bothRatedCount;
	const signedBias = signedSum / bothRatedCount;
	const closeAgreementPct = (closeCount / bothRatedCount) * 100;
	const pearson = pearsonCorrelation(xs, ys);
	const compatibilityPct = Math.round(Math.max(0, 1 - meanAbsDiff / 2.5) * 100);
	return {
		yourCount,
		friendCount,
		sharedCount,
		unionCount,
		jaccardPct,
		bothRatedCount,
		meanAbsDiff,
		signedBias,
		closeAgreementPct,
		pearson,
		compatibilityPct,
		mutualFavouritesCount
	};
}

function buildDisagreements(shared: [EnrichedFilm, EnrichedFilm][]): RatingDisagreement[] {
	const rows: RatingDisagreement[] = [];
	for (const [filmA, filmB] of shared) {
		if (filmA.rating === null || filmB.rating === null) continue;
		const diff = filmA.rating - filmB.rating;
		const absDiff = Math.abs(diff);
		if (absDiff < 1) continue;
		rows.push({
			filmA,
			filmB,
			title: filmA.name,
			year: filmA.year ?? filmB.year,
			uri: filmA.uri || filmB.uri,
			posterPath: filmA.tmdb?.posterPath ?? filmB.tmdb?.posterPath ?? null,
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

function buildMutualFavourites(shared: [EnrichedFilm, EnrichedFilm][]): MutualFavourite[] {
	const rows: MutualFavourite[] = [];
	for (const [filmA, filmB] of shared) {
		if (!isLoved(filmA) || !isLoved(filmB)) continue;
		rows.push({
			filmA,
			filmB,
			title: filmA.name,
			year: filmA.year ?? filmB.year,
			uri: filmA.uri || filmB.uri,
			posterPath: filmA.tmdb?.posterPath ?? filmB.tmdb?.posterPath ?? null,
			ratingA: filmA.rating,
			ratingB: filmB.rating,
			likedA: filmA.liked,
			likedB: filmB.liked
		});
	}
	return rows.sort((a, b) => {
		const scoreDiff = (b.ratingA ?? 4) + (b.ratingB ?? 4) - ((a.ratingA ?? 4) + (a.ratingB ?? 4));
		if (scoreDiff !== 0) return scoreDiff;
		const heartDiff = Number(b.likedA && b.likedB) - Number(a.likedA && a.likedB);
		if (heartDiff !== 0) return heartDiff;
		return a.title.localeCompare(b.title);
	});
}

function tallyDirectors(films: Iterable<EnrichedFilm>): Map<string, TallyBucket> {
	const map = new Map<string, TallyBucket>();
	for (const film of films) {
		const seen = new Set<string>();
		for (const person of film.tmdb?.directors ?? []) {
			const key =
				person.tmdbId !== null ? `id:${person.tmdbId}` : `name:${person.name.trim().toLowerCase()}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const bucket = getOrCreate(map, key, () => ({
				name: person.name,
				tmdbId: person.tmdbId,
				count: 0,
				ratingSum: 0,
				ratedCount: 0
			}));
			bucket.count += 1;
			if (film.rating !== null) {
				bucket.ratingSum += film.rating;
				bucket.ratedCount += 1;
			}
		}
	}
	return map;
}

function averageOf(bucket: TallyBucket): number | null {
	return bucket.ratedCount > 0 ? bucket.ratingSum / bucket.ratedCount : null;
}

function buildSharedDirectors(
	filmsA: Iterable<EnrichedFilm>,
	filmsB: Iterable<EnrichedFilm>
): SharedDirector[] {
	const mapA = tallyDirectors(filmsA);
	const mapB = tallyDirectors(filmsB);
	const shared: SharedDirector[] = [];
	for (const [key, a] of mapA) {
		const b = mapB.get(key);
		if (!b) continue;
		shared.push({
			name: a.name,
			tmdbId: a.tmdbId ?? b.tmdbId,
			countA: a.count,
			countB: b.count,
			avgA: averageOf(a),
			avgB: averageOf(b),
			combined: a.count + b.count
		});
	}
	return shared.sort(
		(a, b) =>
			Math.min(b.countA, b.countB) - Math.min(a.countA, a.countB) ||
			b.combined - a.combined ||
			a.name.localeCompare(b.name)
	);
}

function tallyGenres(films: Iterable<EnrichedFilm>): Map<string, TallyBucket> {
	const map = new Map<string, TallyBucket>();
	for (const film of films) {
		const seen = new Set<string>();
		for (const genre of film.tmdb?.genres ?? []) {
			if (seen.has(genre)) continue;
			seen.add(genre);
			const bucket = getOrCreate(map, genre, () => ({
				name: genre,
				tmdbId: null,
				count: 0,
				ratingSum: 0,
				ratedCount: 0
			}));
			bucket.count += 1;
			if (film.rating !== null) {
				bucket.ratingSum += film.rating;
				bucket.ratedCount += 1;
			}
		}
	}
	return map;
}

function buildSharedGenres(
	filmsA: Map<string, EnrichedFilm>,
	filmsB: Map<string, EnrichedFilm>
): SharedGenre[] {
	const mapA = tallyGenres(filmsA.values());
	const mapB = tallyGenres(filmsB.values());
	const shared: SharedGenre[] = [];
	for (const [name, a] of mapA) {
		const b = mapB.get(name);
		if (!b) continue;
		shared.push({
			name,
			countA: a.count,
			countB: b.count,
			shareA: filmsA.size > 0 ? a.count / filmsA.size : 0,
			shareB: filmsB.size > 0 ? b.count / filmsB.size : 0,
			avgA: averageOf(a),
			avgB: averageOf(b),
			combined: a.count + b.count
		});
	}
	return shared.sort((a, b) => b.combined - a.combined || a.name.localeCompare(b.name));
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
		if (!recommenderFilm || !isLoved(recommenderFilm)) continue;
		rows.push({
			key,
			name: watchlistFilm.name,
			year: watchlistFilm.year ?? recommenderFilm.year,
			uri: watchlistFilm.uri || recommenderFilm.uri || key,
			posterPath: watchlistFilm.tmdb?.posterPath ?? recommenderFilm.tmdb?.posterPath ?? null,
			watchlistFilm,
			recommenderFilm,
			rating: recommenderFilm.rating,
			liked: recommenderFilm.liked
		});
	}
	return rows.sort((a, b) => {
		const scoreDiff = (b.rating ?? 4) - (a.rating ?? 4);
		if (scoreDiff !== 0) return scoreDiff;
		const heartDiff = Number(b.liked) - Number(a.liked);
		if (heartDiff !== 0) return heartDiff;
		return a.name.localeCompare(b.name);
	});
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
		mutualWatchlist.push({
			key,
			name: filmA.name,
			year: filmA.year ?? filmB.year,
			uri: filmA.uri || filmB.uri || key,
			posterPath: filmA.tmdb?.posterPath ?? filmB.tmdb?.posterPath ?? null,
			filmA,
			filmB
		});
	}
	mutualWatchlist.sort((a, b) => a.name.localeCompare(b.name));
	return {
		mutualWatchlist,
		friendRecommends: buildRecommendations(wlA, watchedA, watchedB),
		youRecommend: buildRecommendations(wlB, watchedB, watchedA)
	};
}

/** Compares two enriched Letterboxd libraries across overlap, ratings, taste, and watchlists. */
export function compareLibraries(you: LibraryInput, friend: LibraryInput): ComparisonResult {
	const watchedA = indexByKey(you.films);
	const watchedB = indexByKey(friend.films);
	const shared: [EnrichedFilm, EnrichedFilm][] = [];
	for (const [key, filmA] of watchedA) {
		const filmB = watchedB.get(key);
		if (filmB) shared.push([filmA, filmB]);
	}
	const mutualFavourites = buildMutualFavourites(shared);
	return {
		overlap: computeOverlap(watchedA.size, watchedB.size, shared, mutualFavourites.length),
		disagreements: buildDisagreements(shared),
		mutualFavourites,
		sharedDirectors: buildSharedDirectors(watchedA.values(), watchedB.values()),
		sharedGenres: buildSharedGenres(watchedA, watchedB),
		watchTogether: buildWatchTogether(watchedA, watchedB, you.watchlist, friend.watchlist)
	};
}
