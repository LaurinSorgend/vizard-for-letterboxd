import { describe, expect, it } from 'vitest';
import { film, tmdb } from '$lib/testing/fixtures';
import type { CollectionParts, EnrichedFilm } from '$lib/types';
import { completedFranchiseCount, franchiseProgress } from './franchises';

function franchiseFilms(id: number, name: string, count: number): EnrichedFilm[] {
	const collection = { id, name, posterPath: null };
	return Array.from({ length: count }, () => film({ tmdb: tmdb({ collection }) }));
}

describe('franchiseProgress', () => {
	it('computes seen, total, ratio and completed for known and missing totals', () => {
		const films = [
			...franchiseFilms(1, 'The Matrix Collection', 4),
			...franchiseFilms(2, 'Alien Collection', 3),
			...franchiseFilms(3, 'Dune Collection', 2),
			...franchiseFilms(4, 'Standalone Collection', 1)
		];
		const collections: CollectionParts[] = [
			{ id: 1, name: 'The Matrix Collection', total: 4 },
			{ id: 2, name: 'Alien Collection', total: 6 }
		];

		const items = franchiseProgress(films, collections, 'count');
		expect(items.map((item) => item.label)).toEqual(['The Matrix', 'Alien', 'Dune']);

		expect(items[0]).toMatchObject({ seen: 4, total: 4, ratio: 1, completed: true });
		expect(items[1]).toMatchObject({ seen: 3, total: 6, ratio: 0.5, completed: false });
		expect(items[2]).toMatchObject({ seen: 2, total: null, ratio: null, completed: false });
	});

	it('clamps total up to seen when seen exceeds the reported collection size', () => {
		const films = franchiseFilms(10, 'Stale Collection', 4);
		const collections: CollectionParts[] = [{ id: 10, name: 'Stale Collection', total: 3 }];

		const [item] = franchiseProgress(films, collections, 'count');
		expect(item).toMatchObject({ seen: 4, total: 4, ratio: 1, completed: true });
	});

	it('treats non-positive reported totals as unknown', () => {
		const films = franchiseFilms(11, 'Empty Parts Collection', 2);
		const collections: CollectionParts[] = [{ id: 11, name: 'Empty Parts Collection', total: 0 }];

		const [item] = franchiseProgress(films, collections, 'count');
		expect(item).toMatchObject({ seen: 2, total: null, ratio: null, completed: false });
	});

	it('sorts by count descending, tie-breaking by completion ratio then label', () => {
		const films = [
			...franchiseFilms(1, 'Zulu Collection', 3),
			...franchiseFilms(2, 'Alpha Collection', 3),
			...franchiseFilms(3, 'Bravo Collection', 3),
			...franchiseFilms(4, 'Charlie Collection', 3),
			...franchiseFilms(5, 'Longest Collection', 5)
		];
		const collections: CollectionParts[] = [
			{ id: 1, name: 'Zulu Collection', total: 3 },
			{ id: 2, name: 'Alpha Collection', total: 6 },
			{ id: 3, name: 'Bravo Collection', total: 6 },
			{ id: 5, name: 'Longest Collection', total: 10 }
		];

		const items = franchiseProgress(films, collections, 'count');
		expect(items.map((item) => item.label)).toEqual([
			'Longest',
			'Zulu',
			'Alpha',
			'Bravo',
			'Charlie'
		]);
	});

	it('sorts by completion ratio descending, then seen descending, then label, with unknown totals last', () => {
		const films = [
			...franchiseFilms(1, 'Small Done Collection', 2),
			...franchiseFilms(2, 'Big Done Collection', 4),
			...franchiseFilms(3, 'Half Small Collection', 2),
			...franchiseFilms(4, 'Half Big Collection', 3),
			...franchiseFilms(5, 'Alpha Half Collection', 2),
			...franchiseFilms(6, 'Unknown Many Collection', 5),
			...franchiseFilms(7, 'Unknown Few Collection', 2)
		];
		const collections: CollectionParts[] = [
			{ id: 1, name: 'Small Done Collection', total: 2 },
			{ id: 2, name: 'Big Done Collection', total: 4 },
			{ id: 3, name: 'Half Small Collection', total: 4 },
			{ id: 4, name: 'Half Big Collection', total: 6 },
			{ id: 5, name: 'Alpha Half Collection', total: 4 }
		];

		const items = franchiseProgress(films, collections, 'completion');
		expect(items.map((item) => item.label)).toEqual([
			'Big Done',
			'Small Done',
			'Half Big',
			'Alpha Half',
			'Half Small',
			'Unknown Many',
			'Unknown Few'
		]);
	});
});

describe('completedFranchiseCount', () => {
	it('counts only franchises marked completed', () => {
		const films = [
			...franchiseFilms(1, 'Done One Collection', 3),
			...franchiseFilms(2, 'Done Two Collection', 2),
			...franchiseFilms(3, 'Partial Collection', 2),
			...franchiseFilms(4, 'Unknown Collection', 4)
		];
		const collections: CollectionParts[] = [
			{ id: 1, name: 'Done One Collection', total: 3 },
			{ id: 2, name: 'Done Two Collection', total: 2 },
			{ id: 3, name: 'Partial Collection', total: 5 }
		];

		const items = franchiseProgress(films, collections, 'count');
		expect(completedFranchiseCount(items)).toBe(2);
		expect(completedFranchiseCount([])).toBe(0);
	});
});
