import { describe, expect, it } from 'vitest';
import { film, tmdb } from '$lib/testing/fixtures';
import type { WatchlistFilm } from '$lib/types';
import { canonicalFilmKey, compareLibraries, type LibraryInput } from './compare';

function watchlistItem(over: Partial<WatchlistFilm> = {}): WatchlistFilm {
	return {
		uri: 'https://boxd.it/wl-default',
		name: 'Watchlist Film',
		year: 2022,
		added: '2025-01-01',
		tmdb: null,
		...over
	};
}

function lib(
	name: string,
	films = [] as LibraryInput['films'],
	watchlist = [] as WatchlistFilm[]
): LibraryInput {
	return { name, films, watchlist };
}

describe('canonicalFilmKey', () => {
	it('uses mediaType:tmdbId when a positive TMDB id is present', () => {
		const movie = film({
			name: 'Dune',
			year: 2021,
			tmdb: tmdb({ tmdbId: 438631, mediaType: 'movie' })
		});
		const series = film({
			name: 'Twin Peaks',
			year: 1990,
			tmdb: tmdb({ tmdbId: 1920, mediaType: 'tv' })
		});
		expect(canonicalFilmKey(movie)).toBe('movie:438631');
		expect(canonicalFilmKey(series)).toBe('tv:1920');
	});

	it('falls back to normalized name + year when TMDB is missing or negative (TheTVDB)', () => {
		const unmatched = film({ name: '  Stalker  ', year: 1979, tmdb: null });
		const tvdb = film({
			name: 'STALKER',
			year: 1979,
			tmdb: tmdb({ tmdbId: -42, mediaType: 'tv' })
		});
		expect(canonicalFilmKey(unmatched)).toBe('stalker::1979');
		expect(canonicalFilmKey(tvdb)).toBe('stalker::1979');
	});

	it('produces the same key for watched and watchlist entries of the same title', () => {
		const record = tmdb({ tmdbId: 550, mediaType: 'movie' });
		const watched = film({ name: 'Fight Club', year: 1999, tmdb: record });
		const listed = watchlistItem({ name: 'Fight Club (Alt)', year: 1999, tmdb: record });
		expect(canonicalFilmKey(watched)).toBe(canonicalFilmKey(listed));
	});
});

describe('compareLibraries overlap and rating metrics', () => {
	it('matches across TMDB id even when titles differ and across normalized name+year fallback', () => {
		const sharedTmdb = tmdb({ tmdbId: 100, mediaType: 'movie' });
		const you = lib('Alex', [
			film({ name: 'Le Fabuleux Destin', year: 2001, rating: 4.5, tmdb: sharedTmdb }),
			film({ name: 'Local Indie ', year: 2015, rating: 3, tmdb: null }),
			film({ name: 'Only Yours', year: 2020, rating: 4, tmdb: tmdb({ tmdbId: 201 }) })
		]);
		const friend = lib('Sam', [
			film({ name: 'Amelie', year: 2001, rating: 4, tmdb: sharedTmdb }),
			film({ name: 'local indie', year: 2015, rating: 4, tmdb: null }),
			film({ name: 'Only Theirs', year: 2019, rating: 5, tmdb: tmdb({ tmdbId: 202 }) })
		]);

		const { overlap } = compareLibraries(you, friend);
		expect(overlap.yourCount).toBe(3);
		expect(overlap.friendCount).toBe(3);
		expect(overlap.sharedCount).toBe(2);
		expect(overlap.unionCount).toBe(4);
		expect(overlap.jaccardPct).toBeCloseTo(50);
		expect(overlap.bothRatedCount).toBe(2);
		expect(overlap.meanAbsDiff).toBeCloseTo(0.75);
		expect(overlap.signedBias).toBeCloseTo(-0.25);
		expect(overlap.closeAgreementPct).toBeCloseTo(50);
		expect(overlap.pearson).toBeNull();
		expect(overlap.compatibilityPct).toBe(70);
	});

	it('computes Pearson correlation, signed bias, and zero-variance null safely', () => {
		const ids = [1, 2, 3, 4].map((tmdbId) => tmdb({ tmdbId }));
		const you = lib('Alex', [
			film({ rating: 5, tmdb: ids[0] }),
			film({ rating: 4, tmdb: ids[1] }),
			film({ rating: 3, tmdb: ids[2] }),
			film({ rating: 2, tmdb: ids[3] })
		]);
		const aligned = lib('Sam', [
			film({ rating: 4.5, tmdb: ids[0] }),
			film({ rating: 3.5, tmdb: ids[1] }),
			film({ rating: 2.5, tmdb: ids[2] }),
			film({ rating: 1.5, tmdb: ids[3] })
		]);

		const alignedResult = compareLibraries(you, aligned);
		expect(alignedResult.overlap.pearson).toBeCloseTo(1, 5);
		expect(alignedResult.overlap.signedBias).toBeCloseTo(0.5);
		expect(alignedResult.overlap.meanAbsDiff).toBeCloseTo(0.5);
		expect(alignedResult.overlap.closeAgreementPct).toBeCloseTo(100);
		expect(alignedResult.overlap.compatibilityPct).toBe(80);

		const flat = lib(
			'Flat',
			ids.map((rec) => film({ rating: 3, tmdb: rec }))
		);
		expect(compareLibraries(you, flat).overlap.pearson).toBeNull();
	});

	it('handles zero shared rated films cleanly', () => {
		const sharedTmdb = tmdb({ tmdbId: 900 });
		const you = lib('Alex', [film({ rating: 4, tmdb: sharedTmdb })]);
		const friend = lib('Sam', [film({ rating: null, tmdb: sharedTmdb })]);
		const { overlap } = compareLibraries(you, friend);
		expect(overlap.sharedCount).toBe(1);
		expect(overlap.bothRatedCount).toBe(0);
		expect(overlap.meanAbsDiff).toBeNull();
		expect(overlap.signedBias).toBeNull();
		expect(overlap.closeAgreementPct).toBeNull();
		expect(overlap.pearson).toBeNull();
		expect(overlap.compatibilityPct).toBeNull();
	});
});

describe('disagreements and mutual favourites', () => {
	it('orders disagreements by absDiff desc, then max rating desc, then title, excluding < 1', () => {
		const m1 = tmdb({ tmdbId: 11 });
		const m2 = tmdb({ tmdbId: 12 });
		const m3 = tmdb({ tmdbId: 13 });
		const m4 = tmdb({ tmdbId: 14 });
		const you = lib('Alex', [
			film({ name: 'Beta', rating: 3, tmdb: m1 }),
			film({ name: 'Alpha', rating: 5, tmdb: m2 }),
			film({ name: 'Gamma', rating: 5, tmdb: m3 }),
			film({ name: 'Close', rating: 4, tmdb: m4 })
		]);
		const friend = lib('Sam', [
			film({ name: 'Beta', rating: 1, tmdb: m1 }),
			film({ name: 'Alpha', rating: 3, tmdb: m2 }),
			film({ name: 'Gamma', rating: 1, tmdb: m3 }),
			film({ name: 'Close', rating: 3.5, tmdb: m4 })
		]);

		const { disagreements } = compareLibraries(you, friend);
		expect(disagreements.map((d) => [d.title, d.diff, d.absDiff])).toEqual([
			['Gamma', 4, 4],
			['Alpha', 2, 2],
			['Beta', 2, 2]
		]);
	});

	it('finds mutual favourites (>= 4 or liked by both) and sorts by combined score then hearts', () => {
		const m1 = tmdb({ tmdbId: 21 });
		const m2 = tmdb({ tmdbId: 22 });
		const m3 = tmdb({ tmdbId: 23 });
		const m4 = tmdb({ tmdbId: 24 });
		const you = lib('Alex', [
			film({ name: 'Both Five', rating: 5, liked: false, tmdb: m1 }),
			film({ name: 'Heart Tie A', rating: 4, liked: true, tmdb: m2 }),
			film({ name: 'No Heart Tie', rating: 4, liked: false, tmdb: m3 }),
			film({ name: 'Only Liked', rating: null, liked: true, tmdb: m4 })
		]);
		const friend = lib('Sam', [
			film({ name: 'Both Five', rating: 4.5, liked: true, tmdb: m1 }),
			film({ name: 'Heart Tie A', rating: 4, liked: true, tmdb: m2 }),
			film({ name: 'No Heart Tie', rating: 4, liked: false, tmdb: m3 }),
			film({ name: 'Only Liked', rating: 3, liked: true, tmdb: m4 })
		]);

		const { mutualFavourites, overlap } = compareLibraries(you, friend);
		expect(overlap.mutualFavouritesCount).toBe(4);
		expect(mutualFavourites.map((f) => f.title)).toEqual([
			'Both Five',
			'Heart Tie A',
			'No Heart Tie',
			'Only Liked'
		]);
	});
});

describe('shared directors and genres', () => {
	it('aggregates directors and genres appearing in both libraries with averages and shares', () => {
		const nolan = { name: 'Christopher Nolan', tmdbId: 525, profilePath: null };
		const villeneuve = { name: 'Denis Villeneuve', tmdbId: 137427, profilePath: null };
		const onlyYouDir = { name: 'Only You Dir', tmdbId: 999, profilePath: null };

		const you = lib('Alex', [
			film({
				rating: 5,
				tmdb: tmdb({ tmdbId: 301, directors: [nolan], genres: ['Sci-Fi', 'Drama'] })
			}),
			film({ rating: 4, tmdb: tmdb({ tmdbId: 302, directors: [nolan], genres: ['Sci-Fi'] }) }),
			film({ rating: 3, tmdb: tmdb({ tmdbId: 303, directors: [villeneuve], genres: ['Drama'] }) }),
			film({ rating: 4, tmdb: tmdb({ tmdbId: 304, directors: [onlyYouDir], genres: ['Horror'] }) })
		]);
		const friend = lib('Sam', [
			film({ rating: 4, tmdb: tmdb({ tmdbId: 401, directors: [nolan], genres: ['Sci-Fi'] }) }),
			film({
				rating: 5,
				tmdb: tmdb({ tmdbId: 402, directors: [villeneuve], genres: ['Drama', 'Sci-Fi'] })
			}),
			film({ rating: 4, tmdb: tmdb({ tmdbId: 403, directors: [villeneuve], genres: ['Drama'] }) }),
			film({ rating: 3, tmdb: tmdb({ tmdbId: 404, directors: [nolan], genres: ['Comedy'] }) })
		]);

		const { sharedDirectors, sharedGenres } = compareLibraries(you, friend);
		expect(sharedDirectors.map((d) => d.name)).toEqual(['Christopher Nolan', 'Denis Villeneuve']);
		expect(sharedDirectors[0]).toMatchObject({
			countA: 2,
			countB: 2,
			avgA: 4.5,
			avgB: 3.5,
			combined: 4
		});
		expect(sharedDirectors[1]).toMatchObject({
			countA: 1,
			countB: 2,
			avgA: 3,
			avgB: 4.5,
			combined: 3
		});

		expect(sharedGenres.map((g) => g.name)).toEqual(['Drama', 'Sci-Fi']);
		expect(sharedGenres[0]).toMatchObject({
			countA: 2,
			countB: 2,
			shareA: 0.5,
			shareB: 0.5,
			avgA: 4,
			avgB: 4.5,
			combined: 4
		});
	});
});

describe('watchTogether', () => {
	it('builds mutual watchlist excluding already-watched films and directional recommendations', () => {
		const mBothUnwatched = tmdb({ tmdbId: 501, posterPath: '/both.jpg' });
		const mWatchedByYou = tmdb({ tmdbId: 502 });
		const mWatchedByFriend = tmdb({ tmdbId: 503 });
		const mFriendLoved = tmdb({ tmdbId: 504, posterPath: '/frec.jpg' });
		const mFriendDisliked = tmdb({ tmdbId: 505 });
		const mYouLoved = tmdb({ tmdbId: 506, posterPath: '/yrec.jpg' });

		const you = lib(
			'Alex',
			[
				film({ name: 'Already Seen By You', rating: 3, tmdb: mWatchedByYou }),
				film({ name: 'You Loved This', rating: 4.5, liked: true, tmdb: mYouLoved })
			],
			[
				watchlistItem({ name: 'Mutual Pick', uri: 'https://boxd.it/501', tmdb: mBothUnwatched }),
				watchlistItem({
					name: 'Already Seen By You',
					uri: 'https://boxd.it/502',
					tmdb: mWatchedByYou
				}),
				watchlistItem({
					name: 'Already Seen By Friend',
					uri: 'https://boxd.it/503',
					tmdb: mWatchedByFriend
				}),
				watchlistItem({
					name: 'Friend Loved This',
					uri: 'https://boxd.it/504',
					tmdb: mFriendLoved
				}),
				watchlistItem({
					name: 'Friend Disliked This',
					uri: 'https://boxd.it/505',
					tmdb: mFriendDisliked
				})
			]
		);

		const friend = lib(
			'Sam',
			[
				film({ name: 'Already Seen By Friend', rating: 3, tmdb: mWatchedByFriend }),
				film({ name: 'Friend Loved This', rating: 5, liked: true, tmdb: mFriendLoved }),
				film({ name: 'Friend Disliked This', rating: 2, liked: false, tmdb: mFriendDisliked })
			],
			[
				watchlistItem({ name: 'Mutual Pick', uri: 'https://boxd.it/501', tmdb: mBothUnwatched }),
				watchlistItem({
					name: 'Already Seen By You',
					uri: 'https://boxd.it/502',
					tmdb: mWatchedByYou
				}),
				watchlistItem({
					name: 'Already Seen By Friend',
					uri: 'https://boxd.it/503',
					tmdb: mWatchedByFriend
				}),
				watchlistItem({ name: 'You Loved This', uri: 'https://boxd.it/506', tmdb: mYouLoved })
			]
		);

		const { watchTogether } = compareLibraries(you, friend);
		expect(watchTogether.mutualWatchlist.map((f) => f.name)).toEqual(['Mutual Pick']);
		expect(watchTogether.friendRecommends).toHaveLength(1);
		expect(watchTogether.friendRecommends[0]).toMatchObject({
			name: 'Friend Loved This',
			rating: 5,
			liked: true,
			posterPath: '/frec.jpg'
		});
		expect(watchTogether.youRecommend).toHaveLength(1);
		expect(watchTogether.youRecommend[0]).toMatchObject({
			name: 'You Loved This',
			rating: 4.5,
			liked: true,
			posterPath: '/yrec.jpg'
		});
	});
});
