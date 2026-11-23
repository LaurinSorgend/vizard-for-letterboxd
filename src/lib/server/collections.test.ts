import type { D1Database } from '@cloudflare/workers-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CollectionParts } from '$lib/types';
import { FetchBudget, RetryLater } from './budget';
import type { Cache } from './cache';
import { fetchCollection, withPartsUpgrade } from './collections';

// SvelteKit bakes $env/dynamic/private from the environment at config time, so stubbing the
// process env in a test does not reach it.
vi.mock('$env/dynamic/private', () => ({ env: { TMDB_API_KEY: 'test-key' } }));

afterEach(() => {
	vi.unstubAllGlobals();
});

function stub(body: unknown, status = 200) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify(body), { status }))
	);
}

describe('fetchCollection', () => {
	it("returns TMDB's name, total, and chronologically sorted film stubs", async () => {
		stub({
			id: 8091,
			name: 'Alien Collection',
			parts: [
				{ id: 679, title: 'Aliens', release_date: '1986-07-18', poster_path: '/aliens.jpg' },
				{ id: 999, title: 'Untitled Sequel', release_date: '', poster_path: null },
				{ id: 348, title: 'Alien', release_date: '1979-05-25', poster_path: '/alien.jpg' }
			]
		});
		await expect(fetchCollection(new FetchBudget(5), 8091)).resolves.toEqual({
			id: 8091,
			name: 'Alien Collection',
			total: 3,
			parts: [
				{ tmdbId: 348, title: 'Alien', year: 1979, posterPath: '/alien.jpg' },
				{ tmdbId: 679, title: 'Aliens', year: 1986, posterPath: '/aliens.jpg' },
				{ tmdbId: 999, title: 'Untitled Sequel', year: null, posterPath: null }
			]
		});
	});

	it('skips malformed part entries while preserving the reported total', async () => {
		stub({
			id: 8091,
			name: 'Alien Collection',
			parts: [{ id: 348, title: 'Alien', release_date: '1979-05-25' }, {}]
		});
		await expect(fetchCollection(new FetchBudget(5), 8091)).resolves.toEqual({
			id: 8091,
			name: 'Alien Collection',
			total: 2,
			parts: [{ tmdbId: 348, title: 'Alien', year: 1979, posterPath: null }]
		});
	});

	it('fails for good, not for a retry, when TMDB has no such collection', async () => {
		stub({ status_code: 34 }, 404);
		const lookup = fetchCollection(new FetchBudget(5), 1);
		await expect(lookup).rejects.toThrow('404');
		await expect(lookup).rejects.not.toBeInstanceOf(RetryLater);
	});
});

describe('withPartsUpgrade', () => {
	it('treats legacy cached rows without parts as misses while keeping upgraded rows', async () => {
		const base: Cache<number, CollectionParts | null> = {
			getMany: async () =>
				new Map<number, CollectionParts | null>([
					[1, { id: 1, name: 'Legacy Collection', total: 3 }],
					[
						2,
						{
							id: 2,
							name: 'Fresh Collection',
							total: 1,
							parts: [{ tmdbId: 10, title: 'One', year: 2020, posterPath: null }]
						}
					]
				]),
			putMany: vi.fn(async () => {})
		};
		const upgraded = await withPartsUpgrade(base).getMany({} as D1Database, [1, 2]);
		expect(upgraded.has(1)).toBe(false);
		expect(upgraded.get(2)?.parts).toHaveLength(1);
	});
});
