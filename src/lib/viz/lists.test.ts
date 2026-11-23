import { describe, expect, it } from 'vitest';
import { film, tmdb } from '$lib/testing/fixtures';
import type { CustomList, CustomListItem } from '$lib/types';
import { buildListStats, listSummary } from './lists';

function item(over: Partial<CustomListItem> & Pick<CustomListItem, 'name'>): CustomListItem {
	return {
		position: null,
		year: 2020,
		uri: '',
		description: '',
		...over
	};
}

function customList(
	over: Partial<CustomList> & Pick<CustomList, 'id' | 'name' | 'items'>
): CustomList {
	return {
		date: '2024-01-01',
		url: '',
		description: '',
		tags: [],
		...over
	};
}

describe('buildListStats', () => {
	it('matches items by URI or filmKey and computes totals, pct, avgRating, liked, runtime, and missing', () => {
		const stalker = film({
			uri: 'https://boxd.it/stalker',
			name: 'Stalker',
			year: 1979,
			rating: 5,
			liked: true,
			tmdb: tmdb({ runtime: 162 })
		});
		const solaris = film({
			uri: 'https://boxd.it/solaris',
			name: 'Solaris',
			year: 1972,
			rating: 4,
			liked: false,
			tmdb: tmdb({ runtime: 167 })
		});
		const mirror = film({
			uri: 'https://boxd.it/mirror-feed',
			name: 'Mirror',
			year: 1975,
			rating: null,
			liked: true,
			tmdb: tmdb({ runtime: 107 })
		});

		const list = customList({
			id: 'tarkovsky',
			name: 'Tarkovsky',
			items: [
				item({
					position: 1,
					name: 'Stalker (Renamed)',
					year: 1979,
					uri: 'https://boxd.it/stalker'
				}),
				item({ position: 2, name: 'Solaris', year: 1972, uri: 'https://boxd.it/solaris' }),
				item({ position: 3, name: 'Mirror', year: 1975, uri: 'https://boxd.it/different-uri' }),
				item({ position: 4, name: 'Nostalghia', year: 1983, uri: 'https://boxd.it/nostalghia' })
			]
		});

		const [stats] = buildListStats([list], [stalker, solaris, mirror]);
		expect(stats.total).toBe(4);
		expect(stats.watched).toBe(3);
		expect(stats.pct).toBe(75);
		expect(stats.avgRating).toBe(4.5);
		expect(stats.liked).toBe(2);
		expect(stats.totalMinutes).toBe(162 + 167 + 107);
		expect(stats.missing).toEqual([
			item({ position: 4, name: 'Nostalghia', year: 1983, uri: 'https://boxd.it/nostalghia' })
		]);
	});

	it('deduplicates repeated watched and unwatched films within a single list', () => {
		const dune = film({
			uri: 'https://boxd.it/dune',
			name: 'Dune',
			year: 2021,
			rating: 4.5,
			liked: true,
			tmdb: tmdb({ runtime: 155 })
		});

		const list = customList({
			id: 'dupes',
			name: 'Duplicates',
			items: [
				item({ position: 1, name: 'Dune', year: 2021, uri: 'https://boxd.it/dune' }),
				item({ position: 2, name: 'Dune', year: 2021, uri: '' }),
				item({ position: 3, name: 'Arrival', year: 2016, uri: 'https://boxd.it/arrival' }),
				item({ position: 4, name: 'Arrival', year: 2016, uri: 'https://boxd.it/arrival' })
			]
		});

		const [stats] = buildListStats([list], [dune]);
		expect(stats.total).toBe(2);
		expect(stats.watched).toBe(1);
		expect(stats.pct).toBe(50);
		expect(stats.avgRating).toBe(4.5);
		expect(stats.liked).toBe(1);
		expect(stats.totalMinutes).toBe(155);
		expect(stats.missing).toHaveLength(1);
		expect(stats.missing[0].name).toBe('Arrival');
	});

	it('handles empty lists and unrated matched films cleanly', () => {
		const f1 = film({ name: 'Persona', year: 1966, rating: null, tmdb: null });
		const empty = customList({ id: 'empty', name: 'Empty', items: [] });
		const unrated = customList({
			id: 'unrated',
			name: 'Unrated',
			items: [item({ name: 'Persona', year: 1966 })]
		});

		const results = buildListStats([empty, unrated], [f1], 'size');
		expect(results.map((r) => r.list.id)).toEqual(['unrated', 'empty']);
		expect(results[0]).toMatchObject({
			total: 1,
			watched: 1,
			pct: 100,
			avgRating: null,
			totalMinutes: 0,
			missing: []
		});
		expect(results[1]).toMatchObject({
			total: 0,
			watched: 0,
			pct: 0,
			avgRating: null,
			missing: []
		});
	});

	it('sorts by size, watched, completion, and rating with tie-breaking rules', () => {
		const f1 = film({ uri: 'u1', name: 'F1', year: 2001, rating: 5 });
		const f2 = film({ uri: 'u2', name: 'F2', year: 2002, rating: 4 });
		const f3 = film({ uri: 'u3', name: 'F3', year: 2003, rating: 3 });
		const f4 = film({ uri: 'u4', name: 'F4', year: 2004, rating: null });
		const films = [f1, f2, f3, f4];

		const bigPartial = customList({
			id: 'big',
			name: 'Big Partial',
			items: [
				item({ name: 'F1', year: 2001, uri: 'u1' }),
				item({ name: 'F2', year: 2002, uri: 'u2' }),
				item({ name: 'F3', year: 2003, uri: 'u3' }),
				item({ name: 'M1', year: 2010, uri: 'm1' }),
				item({ name: 'M2', year: 2011, uri: 'm2' })
			]
		});
		const singleFive = customList({
			id: 'single-five',
			name: 'Single Five',
			items: [item({ name: 'F1', year: 2001, uri: 'u1' })]
		});
		const twoHigh = customList({
			id: 'two-high',
			name: 'Two High',
			items: [
				item({ name: 'F1', year: 2001, uri: 'u1' }),
				item({ name: 'F2', year: 2002, uri: 'u2' })
			]
		});
		const unratedFull = customList({
			id: 'unrated-full',
			name: 'Unrated Full',
			items: [item({ name: 'F4', year: 2004, uri: 'u4' })]
		});
		const zeroWatched = customList({
			id: 'zero',
			name: 'Zero Watched',
			items: [item({ name: 'M3', year: 2012, uri: 'm3' })]
		});
		const empty = customList({ id: 'empty', name: 'A Empty', items: [] });

		const lists = [empty, zeroWatched, unratedFull, singleFive, twoHigh, bigPartial];

		expect(buildListStats(lists, films, 'size').map((r) => r.list.id)).toEqual([
			'big',
			'two-high',
			'single-five',
			'unrated-full',
			'zero',
			'empty'
		]);

		expect(buildListStats(lists, films, 'watched').map((r) => r.list.id)).toEqual([
			'big',
			'two-high',
			'single-five',
			'unrated-full',
			'zero',
			'empty'
		]);

		expect(buildListStats(lists, films, 'completion').map((r) => r.list.id)).toEqual([
			'two-high',
			'single-five',
			'unrated-full',
			'big',
			'zero',
			'empty'
		]);

		expect(buildListStats(lists, films, 'rating').map((r) => r.list.id)).toEqual([
			'two-high',
			'big',
			'single-five',
			'unrated-full',
			'empty',
			'zero'
		]);
	});
});

describe('listSummary', () => {
	it('aggregates list count, total items, deduplicated unique films, and completed lists', () => {
		const f1 = film({ uri: 'https://boxd.it/1', name: 'Stalker', year: 1979 });
		const f2 = film({ uri: 'https://boxd.it/2', name: 'Solaris', year: 1972 });

		const lists = [
			customList({
				id: 'done',
				name: 'Done',
				items: [
					item({ name: 'Stalker', year: 1979, uri: 'https://boxd.it/1' }),
					item({ name: 'Solaris', year: 1972, uri: 'https://boxd.it/2' })
				]
			}),
			customList({
				id: 'partial',
				name: 'Partial',
				items: [
					item({ name: 'Stalker', year: 1979, uri: 'https://boxd.it/1' }),
					item({ name: 'Mirror', year: 1975, uri: 'https://boxd.it/3' })
				]
			}),
			customList({ id: 'empty', name: 'Empty', items: [] })
		];

		const stats = buildListStats(lists, [f1, f2]);
		expect(listSummary(stats)).toEqual({
			listCount: 3,
			totalItems: 4,
			uniqueFilms: 3,
			completedLists: 1
		});
		expect(listSummary([])).toEqual({
			listCount: 0,
			totalItems: 0,
			uniqueFilms: 0,
			completedLists: 0
		});
	});
});
