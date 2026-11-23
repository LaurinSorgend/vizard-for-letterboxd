import { describe, expect, it } from 'vitest';
import { film } from '$lib/testing/fixtures';
import type { CustomList, CustomListItem } from '$lib/types';
import { buildListStats, listSummary, sortListStats } from './lists';

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
	it('matches items by normalized URI or filmKey and computes totals, ratio, completed, avgRating, and missing', () => {
		const stalker = film({
			uri: 'https://boxd.it/stalker',
			name: 'Stalker',
			year: 1979,
			rating: 5
		});
		const solaris = film({
			uri: 'https://boxd.it/solaris',
			name: 'Solaris',
			year: 1972,
			rating: 4
		});
		const mirror = film({
			uri: 'https://boxd.it/mirror-feed',
			name: 'Mirror',
			year: 1975,
			rating: null
		});

		const list = customList({
			id: 'tarkovsky',
			name: 'Tarkovsky',
			items: [
				item({
					position: 1,
					name: 'Stalker (Renamed)',
					year: 1979,
					uri: 'HTTPS://Boxd.it/stalker/'
				}),
				item({ position: 2, name: 'Solaris', year: 1972, uri: 'https://boxd.it/solaris' }),
				item({ position: 3, name: 'Mirror', year: 1975, uri: 'https://boxd.it/different-uri' }),
				item({ position: 4, name: 'Nostalghia', year: 1983, uri: 'https://boxd.it/nostalghia' })
			]
		});

		const [stats] = buildListStats([list], [stalker, solaris, mirror]);
		expect(stats).toMatchObject({
			total: 4,
			watched: 3,
			ratio: 0.75,
			pct: 75,
			completed: false,
			avgRating: 4.5,
			ratedCount: 2
		});
		expect(stats.missing).toEqual([
			item({ position: 4, name: 'Nostalghia', year: 1983, uri: 'https://boxd.it/nostalghia' })
		]);
	});

	it('deduplicates repeated watched and unwatched films within a single list', () => {
		const dune = film({
			uri: 'https://boxd.it/dune',
			name: 'Dune',
			year: 2021,
			rating: 4.5
		});

		const list = customList({
			id: 'dupes',
			name: 'Duplicates',
			items: [
				item({ position: 1, name: 'Dune', year: 2021, uri: 'https://boxd.it/dune' }),
				item({ position: 2, name: 'Dune', year: 2021, uri: '' }),
				item({ position: 3, name: 'Arrival', year: 2016, uri: 'https://boxd.it/arrival' }),
				item({ position: 4, name: 'Arrival', year: 2016, uri: 'HTTPS://BOXD.IT/arrival/' })
			]
		});

		const [stats] = buildListStats([list], [dune]);
		expect(stats).toMatchObject({
			total: 2,
			watched: 1,
			ratio: 0.5,
			pct: 50,
			completed: false,
			avgRating: 4.5,
			ratedCount: 1
		});
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
			ratio: 1,
			pct: 100,
			completed: true,
			avgRating: null,
			ratedCount: 0,
			missing: []
		});
		expect(results[1]).toMatchObject({
			total: 0,
			watched: 0,
			ratio: null,
			pct: 0,
			completed: false,
			avgRating: null,
			ratedCount: 0,
			missing: []
		});
	});

	it('sorts distinctly by size, watched, completion, and rating with tie-breaking rules', () => {
		const f1 = film({ uri: 'u1', name: 'F1', year: 2001, rating: 5 });
		const f2 = film({ uri: 'u2', name: 'F2', year: 2002, rating: 4 });
		const f3 = film({ uri: 'u3', name: 'F3', year: 2003, rating: 3 });
		const f4 = film({ uri: 'u4', name: 'F4', year: 2004, rating: null });
		const films = [f1, f2, f3, f4];

		const bigUnwatched = customList({
			id: 'big-unwatched',
			name: 'Big Unwatched',
			items: [
				item({ name: 'F3', year: 2003, uri: 'u3' }),
				item({ name: 'M1', year: 2010, uri: 'm1' }),
				item({ name: 'M2', year: 2011, uri: 'm2' }),
				item({ name: 'M3', year: 2012, uri: 'm3' }),
				item({ name: 'M4', year: 2013, uri: 'm4' })
			]
		});
		const mostlySeen = customList({
			id: 'mostly-seen',
			name: 'Mostly Seen',
			items: [
				item({ name: 'F1', year: 2001, uri: 'u1' }),
				item({ name: 'F2', year: 2002, uri: 'u2' }),
				item({ name: 'F3', year: 2003, uri: 'u3' }),
				item({ name: 'M5', year: 2014, uri: 'm5' })
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
		const empty = customList({ id: 'empty', name: 'A Empty', items: [] });

		const stats = buildListStats(
			[empty, unratedFull, singleFive, twoHigh, mostlySeen, bigUnwatched],
			films,
			'size'
		);

		expect(stats.map((r) => r.list.id)).toEqual([
			'big-unwatched',
			'mostly-seen',
			'two-high',
			'single-five',
			'unrated-full',
			'empty'
		]);

		expect(sortListStats(stats, 'watched').map((r) => r.list.id)).toEqual([
			'mostly-seen',
			'two-high',
			'big-unwatched',
			'single-five',
			'unrated-full',
			'empty'
		]);

		expect(sortListStats(stats, 'completion').map((r) => r.list.id)).toEqual([
			'two-high',
			'single-five',
			'unrated-full',
			'mostly-seen',
			'big-unwatched',
			'empty'
		]);

		expect(sortListStats(stats, 'rating').map((r) => r.list.id)).toEqual([
			'two-high',
			'mostly-seen',
			'single-five',
			'big-unwatched',
			'unrated-full',
			'empty'
		]);
	});
});

describe('listSummary', () => {
	it('aggregates list count, deduplicated unique films across normalized URIs, and completed lists', () => {
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
					item({ name: 'Stalker', year: 1979, uri: 'HTTPS://Boxd.it/1/' }),
					item({ name: 'Mirror', year: 1975, uri: 'https://boxd.it/3' })
				]
			}),
			customList({ id: 'empty', name: 'Empty', items: [] })
		];

		const stats = buildListStats(lists, [f1, f2]);
		expect(listSummary(stats)).toEqual({
			listCount: 3,
			uniqueFilms: 3,
			completedLists: 1
		});
		expect(listSummary([])).toEqual({
			listCount: 0,
			uniqueFilms: 0,
			completedLists: 0
		});
	});
});
