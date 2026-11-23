import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import type { CustomList, EnrichedFilm } from '$lib/types';
import {
	activeFilterChips,
	availableTags,
	availableWatchYears,
	clearFilterChip,
	filterDashboardFilms,
	hasActiveDashboardFilters,
	NO_DASHBOARD_FILTERS,
	type DashboardFilters
} from './filters';

const names = (films: EnrichedFilm[]) => films.map((f) => f.name);

function withFilters(over: Partial<DashboardFilters>): DashboardFilters {
	return { ...NO_DASHBOARD_FILTERS, ...over };
}

function makeList(over: Partial<CustomList> = {}): CustomList {
	return {
		id: 'favorites',
		name: 'Favorites',
		date: '2024-01-01',
		url: 'https://letterboxd.com/user/list/favorites/',
		description: '',
		tags: [],
		items: [],
		...over
	};
}

describe('hasActiveDashboardFilters', () => {
	it('returns false when all filters are cleared or whitespace', () => {
		expect(hasActiveDashboardFilters(NO_DASHBOARD_FILTERS)).toBe(false);
		expect(
			hasActiveDashboardFilters(withFilters({ fromDate: '  ', toDate: '', tag: ' ', listId: '  ' }))
		).toBe(false);
	});

	it('returns true when any single filter is active', () => {
		expect(hasActiveDashboardFilters(withFilters({ fromDate: '2024-01-01' }))).toBe(true);
		expect(hasActiveDashboardFilters(withFilters({ toDate: '2024-12-31' }))).toBe(true);
		expect(hasActiveDashboardFilters(withFilters({ mediaType: 'movie' }))).toBe(true);
		expect(hasActiveDashboardFilters(withFilters({ mediaType: 'tv' }))).toBe(true);
		expect(hasActiveDashboardFilters(withFilters({ diaryOnly: true }))).toBe(true);
		expect(hasActiveDashboardFilters(withFilters({ tag: 'cinema' }))).toBe(true);
		expect(hasActiveDashboardFilters(withFilters({ heartedOnly: true }))).toBe(true);
		expect(hasActiveDashboardFilters(withFilters({ listId: 'favorites' }))).toBe(true);
	});
});

describe('availableWatchYears', () => {
	it('returns unique diary years in descending order and skips invalid entries', () => {
		const films = [
			film(watched(['2022-03-10', '2024-11-05'])),
			film(watched(['2024-01-01', '2021-07-20'])),
			film({ watchedDates: ['', 'not-a-date', ' 2023-06-15 '] }),
			film()
		];
		expect(availableWatchYears(films)).toEqual([2024, 2023, 2022, 2021]);
	});

	it('returns empty array when no films have diary dates', () => {
		expect(availableWatchYears([film(), film()])).toEqual([]);
	});
});

describe('availableTags', () => {
	it('trims tags, deduplicates per film, and sorts by count desc then alphabetical', () => {
		const films = [
			film({ tags: [' cinema ', 'noir', 'cinema', ''] }),
			film({ tags: ['noir', '  ', 'festival'] }),
			film({ tags: ['archive', 'festival'] })
		];
		expect(availableTags(films)).toEqual([
			{ tag: 'festival', count: 2 },
			{ tag: 'noir', count: 2 },
			{ tag: 'archive', count: 1 },
			{ tag: 'cinema', count: 1 }
		]);
	});
});

describe('filterDashboardFilms', () => {
	const movie = film({
		name: 'Stalker',
		year: 1979,
		uri: 'https://boxd.it/stalker',
		liked: true,
		tags: [' cinema ', 'sci-fi'],
		tmdb: tmdb({ mediaType: 'movie' }),
		...watched(['2023-04-12', '2024-09-20'], 5),
		rewatch: true
	});
	const series = film({
		name: 'Twin Peaks',
		year: 1990,
		uri: 'https://boxd.it/twin-peaks/',
		liked: false,
		tags: ['tv-night'],
		tmdb: tmdb({ mediaType: 'tv' }),
		...watched(['2024-02-14'], 4.5)
	});
	const unmatched = film({
		name: 'Obscure Short',
		year: 2018,
		uri: 'https://boxd.it/obscure',
		liked: true,
		tags: ['festival'],
		tmdb: null
	});
	const library = [movie, series, unmatched];

	it('returns the original array reference when no filters are active', () => {
		const result = filterDashboardFilms(library, NO_DASHBOARD_FILTERS);
		expect(result).toBe(library);
	});

	it('filters by mediaType and treats unmatched films as movies', () => {
		expect(names(filterDashboardFilms(library, withFilters({ mediaType: 'movie' })))).toEqual([
			'Stalker',
			'Obscure Short'
		]);
		expect(names(filterDashboardFilms(library, withFilters({ mediaType: 'tv' })))).toEqual([
			'Twin Peaks'
		]);
	});

	it('filters by diaryOnly and heartedOnly', () => {
		expect(names(filterDashboardFilms(library, withFilters({ diaryOnly: true })))).toEqual([
			'Stalker',
			'Twin Peaks'
		]);
		expect(names(filterDashboardFilms(library, withFilters({ heartedOnly: true })))).toEqual([
			'Stalker',
			'Obscure Short'
		]);
	});

	it('filters by exact trimmed diary tag', () => {
		expect(names(filterDashboardFilms(library, withFilters({ tag: 'cinema' })))).toEqual([
			'Stalker'
		]);
		expect(names(filterDashboardFilms(library, withFilters({ tag: 'Cinema' })))).toEqual([]);
	});

	it('filters by custom list matching either name+year or normalized URI', () => {
		const lists = [
			makeList({
				id: 'canon',
				name: 'Canon',
				items: [
					{
						position: 1,
						name: 'Stalker',
						year: 1979,
						uri: 'https://boxd.it/different-uri',
						description: ''
					},
					{
						position: 2,
						name: 'Renamed Series',
						year: 1991,
						uri: 'HTTPS://BOXD.IT/twin-peaks',
						description: ''
					}
				]
			}),
			makeList({ id: 'empty', name: 'Empty', items: [] })
		];

		expect(names(filterDashboardFilms(library, withFilters({ listId: 'canon' }), lists))).toEqual([
			'Stalker',
			'Twin Peaks'
		]);
		expect(names(filterDashboardFilms(library, withFilters({ listId: 'empty' }), lists))).toEqual(
			[]
		);
		expect(
			names(filterDashboardFilms(library, withFilters({ listId: 'missing-id' }), lists))
		).toEqual(['Stalker', 'Twin Peaks', 'Obscure Short']);
	});

	it('filters by date range and clips watchedDates, entries, and rewatch without mutating source', () => {
		const in2023 = filterDashboardFilms(
			library,
			withFilters({ fromDate: '2023-01-01', toDate: '2023-12-31' })
		);
		expect(names(in2023)).toEqual(['Stalker']);
		expect(in2023[0]).not.toBe(movie);
		expect(in2023[0].watchedDates).toEqual(['2023-04-12']);
		expect(in2023[0].entries).toEqual([{ date: '2023-04-12', rating: 5, rewatch: false }]);
		expect(in2023[0].rewatch).toBe(false);

		const in2024 = filterDashboardFilms(
			library,
			withFilters({ fromDate: '2024-01-01', toDate: '2024-12-31' })
		);
		expect(names(in2024)).toEqual(['Stalker', 'Twin Peaks']);
		expect(in2024[0].watchedDates).toEqual(['2024-09-20']);
		expect(in2024[0].entries).toEqual([{ date: '2024-09-20', rating: 5, rewatch: true }]);
		expect(in2024[0].rewatch).toBe(true);

		expect(movie.watchedDates).toEqual(['2023-04-12', '2024-09-20']);
		expect(movie.entries).toHaveLength(2);
		expect(movie.rewatch).toBe(true);
	});

	it('supports open-ended fromDate or toDate bounds and preserves rewatch when entries are absent', () => {
		const dateOnlyFilm = film({
			name: 'Legacy Log',
			watchedDates: ['2022-05-01', '2024-05-01'],
			entries: [],
			rewatch: true
		});

		const fromOnly = filterDashboardFilms([dateOnlyFilm], withFilters({ fromDate: '2024-05-01' }));
		expect(fromOnly).toHaveLength(1);
		expect(fromOnly[0].watchedDates).toEqual(['2024-05-01']);
		expect(fromOnly[0].rewatch).toBe(true);

		const toOnly = filterDashboardFilms(library, withFilters({ toDate: '2024-02-14' }));
		expect(names(toOnly)).toEqual(['Stalker', 'Twin Peaks']);
		expect(toOnly[0].watchedDates).toEqual(['2023-04-12']);
		expect(toOnly[1].watchedDates).toEqual(['2024-02-14']);
	});

	it('combines multiple filters together', () => {
		const lists = [
			makeList({
				id: 'top',
				items: [{ position: 1, name: 'Stalker', year: 1979, uri: '', description: '' }]
			})
		];
		const combined = filterDashboardFilms(
			library,
			withFilters({
				fromDate: '2024-01-01',
				toDate: '2024-12-31',
				mediaType: 'movie',
				diaryOnly: true,
				heartedOnly: true,
				tag: 'cinema',
				listId: 'top'
			}),
			lists
		);
		expect(names(combined)).toEqual(['Stalker']);
		expect(combined[0].watchedDates).toEqual(['2024-09-20']);
		expect(combined[0].rewatch).toBe(true);
	});
});

describe('activeFilterChips & clearFilterChip', () => {
	it('builds self-descriptive chips for single year, custom ranges, and flags', () => {
		const sciFiList = makeList({ id: 'sci-fi', name: 'Sci-Fi Essentials' });
		expect(activeFilterChips(NO_DASHBOARD_FILTERS)).toEqual([]);

		expect(
			activeFilterChips(
				withFilters({
					fromDate: '2024-01-01',
					toDate: '2024-12-31',
					mediaType: 'tv',
					tag: 'cinema',
					listId: 'sci-fi',
					diaryOnly: true,
					heartedOnly: true
				}),
				[sciFiList]
			)
		).toEqual([
			{ key: 'dates', label: 'Watched: 2024' },
			{ key: 'mediaType', label: 'Series only' },
			{ key: 'tag', label: 'Tag: cinema' },
			{ key: 'listId', label: 'List: Sci-Fi Essentials' },
			{ key: 'diaryOnly', label: 'Diary-logged' },
			{ key: 'heartedOnly', label: 'Hearted' }
		]);

		expect(
			activeFilterChips(withFilters({ fromDate: '2024-03-01', toDate: '2024-06-15' }))
		).toEqual([{ key: 'dates', label: 'Watched: Mar 1, 2024 – Jun 15, 2024' }]);

		expect(activeFilterChips(withFilters({ fromDate: '2024-03-01' }))).toEqual([
			{ key: 'dates', label: 'Watched from Mar 1, 2024' }
		]);

		expect(activeFilterChips(withFilters({ toDate: '2024-06-15' }))).toEqual([
			{ key: 'dates', label: 'Watched until Jun 15, 2024' }
		]);
	});

	it('clears only the requested filter dimension', () => {
		const active = withFilters({
			fromDate: '2024-01-01',
			toDate: '2024-12-31',
			heartedOnly: true,
			tag: 'cinema'
		});
		expect(clearFilterChip(active, 'dates')).toEqual({
			...active,
			fromDate: '',
			toDate: ''
		});
		expect(clearFilterChip(active, 'heartedOnly')).toEqual({
			...active,
			heartedOnly: false
		});
		expect(clearFilterChip(active, 'tag')).toEqual({
			...active,
			tag: ''
		});
	});
});
