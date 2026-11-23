import { describe, expect, it } from 'vitest';
import { film, tmdb, watchlistFilm } from '$lib/testing/fixtures';
import type { WatchlistFilm } from '$lib/types';
import { compareLibraries, type LibraryInput } from './compare';

function lib(films = [] as LibraryInput['films'], watchlist = [] as WatchlistFilm[]): LibraryInput {
	return { films, watchlist };
}

describe('compareLibraries overlap and rating metrics', () => {
	it('matches across TMDB id, normalized name+year fallback, and negative TheTVDB ids', () => {
		const sharedTmdb = tmdb({ tmdbId: 100, mediaType: 'movie' });
		const you = lib([
			film({ name: 'Le Fabuleux Destin', year: 2001, rating: 4.5, tmdb: sharedTmdb }),
			film({ name: 'Local Indie ', year: 2015, rating: 3, tmdb: null }),
			film({
				name: '  Stalker  ',
				year: 1979,
				rating: null,
				tmdb: tmdb({ tmdbId: -42, mediaType: 'tv' })
			}),
			film({ name: 'Only Yours', year: 2020, rating: 4, tmdb: tmdb({ tmdbId: 201 }) })
		]);
		const friend = lib([
			film({ name: 'Amelie', year: 2001, rating: 4, tmdb: sharedTmdb }),
			film({ name: 'local indie', year: 2015, rating: 4, tmdb: null }),
			film({ name: 'STALKER', year: 1979, rating: null, tmdb: null }),
			film({ name: 'Only Theirs', year: 2019, rating: 5, tmdb: tmdb({ tmdbId: 202 }) })
		]);

		const { overlap } = compareLibraries(you, friend);
		expect(overlap.yourCount).toBe(4);
		expect(overlap.friendCount).toBe(4);
		expect(overlap.sharedCount).toBe(3);
		expect(overlap.unionCount).toBe(5);
		expect(overlap.jaccardPct).toBeCloseTo(60);
		expect(overlap.bothRatedCount).toBe(2);
		expect(overlap.meanAbsDiff).toBeCloseTo(0.75);
		expect(overlap.signedBias).toBeCloseTo(-0.25);
		expect(overlap.closeAgreementPct).toBeCloseTo(50);
		expect(overlap.pearson).toBeNull();
		expect(overlap.compatibilityPct).toBe(70);
	});

	it('computes positive, negative, and zero-variance Pearson correlation safely', () => {
		const ids = [1, 2, 3, 4].map((tmdbId) => tmdb({ tmdbId }));
		const you = lib([
			film({ rating: 5, tmdb: ids[0] }),
			film({ rating: 4, tmdb: ids[1] }),
			film({ rating: 3, tmdb: ids[2] }),
			film({ rating: 2, tmdb: ids[3] })
		]);
		const aligned = lib([
			film({ rating: 4.5, tmdb: ids[0] }),
			film({ rating: 3.5, tmdb: ids[1] }),
			film({ rating: 2.5, tmdb: ids[2] }),
			film({ rating: 1.5, tmdb: ids[3] })
		]);
		const inverse = lib([
			film({ rating: 1, tmdb: ids[0] }),
			film({ rating: 2.5, tmdb: ids[1] }),
			film({ rating: 3.5, tmdb: ids[2] }),
			film({ rating: 5, tmdb: ids[3] })
		]);
		const flat = lib(ids.map((rec) => film({ rating: 3, tmdb: rec })));

		const alignedResult = compareLibraries(you, aligned);
		expect(alignedResult.overlap.pearson).toBeCloseTo(1, 5);
		expect(alignedResult.overlap.signedBias).toBeCloseTo(0.5);
		expect(alignedResult.overlap.meanAbsDiff).toBeCloseTo(0.5);
		expect(alignedResult.overlap.closeAgreementPct).toBeCloseTo(100);
		expect(alignedResult.overlap.compatibilityPct).toBe(80);

		expect(compareLibraries(you, inverse).overlap.pearson).toBeLessThan(-0.95);
		expect(compareLibraries(you, flat).overlap.pearson).toBeNull();
	});

	it('handles empty libraries and zero shared rated films cleanly', () => {
		const empty = compareLibraries(lib(), lib());
		expect(empty.overlap).toEqual({
			yourCount: 0,
			friendCount: 0,
			sharedCount: 0,
			unionCount: 0,
			jaccardPct: 0,
			bothRatedCount: 0,
			meanAbsDiff: null,
			signedBias: null,
			closeAgreementPct: null,
			pearson: null,
			compatibilityPct: null,
			mutualFavouritesCount: 0
		});

		const sharedTmdb = tmdb({ tmdbId: 900 });
		const { overlap } = compareLibraries(
			lib([film({ rating: 4, tmdb: sharedTmdb })]),
			lib([film({ rating: null, tmdb: sharedTmdb })])
		);
		expect(overlap.sharedCount).toBe(1);
		expect(overlap.bothRatedCount).toBe(0);
		expect(overlap.meanAbsDiff).toBeNull();
		expect(overlap.compatibilityPct).toBeNull();
	});
});

describe('disagreements and mutual favourites', () => {
	it('orders disagreements by absDiff desc, then max rating desc, then title, excluding < 1', () => {
		const ids = [11, 12, 13, 14, 15].map((tmdbId) => tmdb({ tmdbId }));
		const you = lib([
			film({ name: 'Beta', rating: 3, tmdb: ids[0] }),
			film({ name: 'Alpha', rating: 5, tmdb: ids[1] }),
			film({ name: 'Gamma', rating: 1, tmdb: ids[2] }),
			film({ name: 'Aardvark', rating: 3, tmdb: ids[3] }),
			film({ name: 'Close', rating: 4, tmdb: ids[4] })
		]);
		const friend = lib([
			film({ name: 'Beta', rating: 1, tmdb: ids[0] }),
			film({ name: 'Alpha', rating: 3, tmdb: ids[1] }),
			film({ name: 'Gamma', rating: 5, tmdb: ids[2] }),
			film({ name: 'Aardvark', rating: 5, tmdb: ids[3] }),
			film({ name: 'Close', rating: 3.5, tmdb: ids[4] })
		]);

		const { disagreements } = compareLibraries(you, friend);
		expect(disagreements.map((d) => [d.title, d.diff, d.absDiff])).toEqual([
			['Gamma', -4, 4],
			['Aardvark', -2, 2],
			['Alpha', 2, 2],
			['Beta', 2, 2]
		]);
	});

	it('finds mutual favourites (>= 4 or liked by both), excluding non-favourites, sorted by score then hearts', () => {
		const ids = [21, 22, 23, 24, 25, 26].map((tmdbId) => tmdb({ tmdbId }));
		const you = lib([
			film({ name: 'Both Five', rating: 5, liked: false, tmdb: ids[0] }),
			film({ name: 'Heart Tie A', rating: 4, liked: true, tmdb: ids[1] }),
			film({ name: 'No Heart Tie', rating: 4, liked: false, tmdb: ids[2] }),
			film({ name: 'Only Liked', rating: null, liked: true, tmdb: ids[3] }),
			film({ name: 'Only You Loved', rating: 5, liked: true, tmdb: ids[4] }),
			film({ name: 'Mid Film', rating: 3.5, liked: false, tmdb: ids[5] })
		]);
		const friend = lib([
			film({ name: 'Both Five', rating: 4.5, liked: true, tmdb: ids[0] }),
			film({ name: 'Heart Tie A', rating: 4, liked: true, tmdb: ids[1] }),
			film({ name: 'No Heart Tie', rating: 4, liked: false, tmdb: ids[2] }),
			film({ name: 'Only Liked', rating: 3, liked: true, tmdb: ids[3] }),
			film({ name: 'Only You Loved', rating: 3, liked: false, tmdb: ids[4] }),
			film({ name: 'Mid Film', rating: 3.5, liked: false, tmdb: ids[5] })
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

		const you = lib([
			film({
				rating: 5,
				tmdb: tmdb({ tmdbId: 301, directors: [nolan], genres: ['Sci-Fi', 'Drama'] })
			}),
			film({ rating: 4, tmdb: tmdb({ tmdbId: 302, directors: [nolan], genres: ['Sci-Fi'] }) }),
			film({ rating: 3, tmdb: tmdb({ tmdbId: 303, directors: [villeneuve], genres: ['Drama'] }) }),
			film({ rating: 4, tmdb: tmdb({ tmdbId: 304, directors: [onlyYouDir], genres: ['Horror'] }) })
		]);
		const friend = lib([
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
			avgB: 3.5
		});
		expect(sharedDirectors[1]).toMatchObject({
			countA: 1,
			countB: 2,
			avgA: 3,
			avgB: 4.5
		});

		expect(sharedGenres.map((g) => g.name)).toEqual(['Drama', 'Sci-Fi']);
		expect(sharedGenres[0]).toMatchObject({
			countA: 2,
			countB: 2,
			shareA: 0.5,
			shareB: 0.5,
			avgA: 4,
			avgB: 4.5
		});
	});
});

describe('watchTogether', () => {
	it('builds mutual watchlist and directional recommendations, excluding watched films and sorting by rating then hearts', () => {
		const mBothUnwatched = tmdb({ tmdbId: 501, posterPath: '/both.jpg' });
		const mWatchedByYou = tmdb({ tmdbId: 502 });
		const mWatchedByFriend = tmdb({ tmdbId: 503 });
		const mFriendFive = tmdb({ tmdbId: 504, posterPath: '/f5.jpg' });
		const mFriendFourHeart = tmdb({ tmdbId: 507 });
		const mFriendFourPlain = tmdb({ tmdbId: 508 });
		const mFriendDisliked = tmdb({ tmdbId: 505 });
		const mYouLoved = tmdb({ tmdbId: 506, posterPath: '/yrec.jpg' });

		const you = lib(
			[
				film({ name: 'Already Seen By You', rating: 3, tmdb: mWatchedByYou }),
				film({ name: 'You Loved This', rating: 4.5, liked: true, tmdb: mYouLoved })
			],
			[
				watchlistFilm({ name: 'Mutual Pick', uri: 'https://boxd.it/501', tmdb: mBothUnwatched }),
				watchlistFilm({
					name: 'Already Seen By You',
					uri: 'https://boxd.it/502',
					tmdb: mWatchedByYou
				}),
				watchlistFilm({
					name: 'Already Seen By Friend',
					uri: 'https://boxd.it/503',
					tmdb: mWatchedByFriend
				}),
				watchlistFilm({ name: 'Friend Four Plain', tmdb: mFriendFourPlain }),
				watchlistFilm({ name: 'Friend Five', uri: 'https://boxd.it/504', tmdb: mFriendFive }),
				watchlistFilm({ name: 'Friend Four Heart', tmdb: mFriendFourHeart }),
				watchlistFilm({ name: 'Friend Disliked This', tmdb: mFriendDisliked })
			]
		);

		const friend = lib(
			[
				film({ name: 'Already Seen By You', rating: 5, liked: true, tmdb: mWatchedByYou }),
				film({ name: 'Already Seen By Friend', rating: 3, tmdb: mWatchedByFriend }),
				film({ name: 'Friend Five', rating: 5, liked: false, tmdb: mFriendFive }),
				film({ name: 'Friend Four Heart', rating: 4, liked: true, tmdb: mFriendFourHeart }),
				film({ name: 'Friend Four Plain', rating: 4, liked: false, tmdb: mFriendFourPlain }),
				film({ name: 'Friend Disliked This', rating: 2, liked: false, tmdb: mFriendDisliked })
			],
			[
				watchlistFilm({ name: 'Mutual Pick', uri: 'https://boxd.it/501', tmdb: mBothUnwatched }),
				watchlistFilm({ name: 'Already Seen By You', tmdb: mWatchedByYou }),
				watchlistFilm({ name: 'Already Seen By Friend', tmdb: mWatchedByFriend }),
				watchlistFilm({ name: 'You Loved This', uri: 'https://boxd.it/506', tmdb: mYouLoved })
			]
		);

		const { watchTogether } = compareLibraries(you, friend);
		expect(watchTogether.mutualWatchlist.map((f) => f.name)).toEqual(['Mutual Pick']);
		expect(watchTogether.friendRecommends.map((f) => f.name)).toEqual([
			'Friend Five',
			'Friend Four Heart',
			'Friend Four Plain'
		]);
		expect(watchTogether.friendRecommends[0]).toMatchObject({
			rating: 5,
			liked: false,
			posterPath: '/f5.jpg'
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
