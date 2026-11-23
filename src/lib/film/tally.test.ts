import { describe, expect, it } from 'vitest';
import { film, tmdb, watched } from '$lib/testing/fixtures';
import { personOptions } from '$lib/viz/peopleTimeline';
import { mostRewatched } from '$lib/viz/stats';
import { byCollection, byPerson, byTag, cleanTags } from './tally';

const person = (tmdbId: number | null, name: string) => ({ name, tmdbId, profilePath: null });
const unique = (keys: string[]) => new Set(keys).size === keys.length;

describe('bar keys', () => {
	// Two different people called John Smith; keyed by name they crashed the keyed lists.
	const films = [
		film({ tmdb: tmdb({ directors: [person(1, 'John Smith')], cast: [person(3, 'Ann Lee')] }) }),
		film({ tmdb: tmdb({ directors: [person(2, 'John Smith')], cast: [person(4, 'Ann Lee')] }) }),
		film({ tmdb: tmdb({ directors: [person(null, 'Jo Doe')] }) })
	];

	it('keeps namesakes apart with unique keys', () => {
		const directors = byPerson(films, 'directors');
		expect(directors.map((d) => d.label)).toEqual(['Jo Doe', 'John Smith', 'John Smith']);
		expect(directors.map((d) => d.key).sort()).toEqual(['id:1', 'id:2', 'name:Jo Doe']);
		expect(unique(byPerson(films, 'cast').map((d) => d.key))).toBe(true);
	});

	it('gives every people-picker option a unique key', () => {
		expect(unique(personOptions(films).map((o) => o.key))).toBe(true);
	});

	it('keys collections by id and rewatched films by uri', () => {
		const collection = (id: number) => ({ id, name: 'Same Collection', posterPath: null });
		const inCollections = [1, 1, 2, 2].map((id) =>
			film({ tmdb: tmdb({ collection: collection(id) }) })
		);
		expect(byCollection(inCollections).map((d) => d.key)).toEqual(['1', '2']);

		const remakes = [1, 2].map(() =>
			film({ name: 'Suspiria', ...watched(['2020-01-01', '2021-01-01']) })
		);
		expect(unique(mostRewatched(remakes).map((d) => d.key))).toBe(true);
	});
});

describe('byTag and cleanTags', () => {
	it('trims tags, deduplicates per film, ignores blanks, and sorts by count desc then label', () => {
		const a = film({ name: 'A', rating: 4, tags: ['cinema', '  35mm  ', 'cinema', '', '   '] });
		const b = film({ name: 'B', rating: 3, tags: ['cinema', 'festival'] });
		const c = film({ name: 'C', rating: 5, tags: ['35mm'] });

		expect(cleanTags([' cinema ', '', '   ', 'noir'])).toEqual(['cinema', 'noir']);
		expect(byTag([a, b, c]).map((d) => ({ label: d.label, count: d.count, avg: d.avg }))).toEqual([
			{ label: '35mm', count: 2, avg: 4.5 },
			{ label: 'cinema', count: 2, avg: 3.5 },
			{ label: 'festival', count: 1, avg: 3 }
		]);
		expect(byTag([film({ tags: ['', '   '] })])).toEqual([]);
	});
});
