import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

import {
	forgetOverrides,
	formatTmdbOverride,
	getOverride,
	loadOverrides,
	parseTmdbOverride,
	persistOverrides,
	removeOverride,
	saveOverride
} from './overrides';

function installStorage(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k)
	});
	return data;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('parseTmdbOverride', () => {
	it('parses plain numeric IDs, prefixed movie/tv targets, and TMDB URLs', () => {
		expect(parseTmdbOverride('550')).toEqual({ mediaType: 'movie', tmdbId: 550 });
		expect(parseTmdbOverride('  27205 ')).toEqual({ mediaType: 'movie', tmdbId: 27205 });
		expect(parseTmdbOverride('movie/550')).toEqual({ mediaType: 'movie', tmdbId: 550 });
		expect(parseTmdbOverride('tv/1399')).toEqual({ mediaType: 'tv', tmdbId: 1399 });
		expect(parseTmdbOverride('TV:87108')).toEqual({ mediaType: 'tv', tmdbId: 87108 });
		expect(parseTmdbOverride('movie/550-fight-club')).toEqual({ mediaType: 'movie', tmdbId: 550 });
		expect(parseTmdbOverride('https://www.themoviedb.org/movie/550-fight-club')).toEqual({
			mediaType: 'movie',
			tmdbId: 550
		});
		expect(parseTmdbOverride('https://themoviedb.org/tv/87108-chernobyl?language=en-US')).toEqual({
			mediaType: 'tv',
			tmdbId: 87108
		});
	});

	it('rejects empty, non-positive, non-TMDB, and spoofed-host inputs', () => {
		expect(parseTmdbOverride('')).toBeNull();
		expect(parseTmdbOverride('0')).toBeNull();
		expect(parseTmdbOverride('-550')).toBeNull();
		expect(parseTmdbOverride('https://letterboxd.com/film/fight-club/')).toBeNull();
		expect(parseTmdbOverride('https://evil.com/?q=themoviedb.org/movie/550')).toBeNull();
		expect(parseTmdbOverride('https://notthemoviedb.org/movie/550')).toBeNull();
		expect(parseTmdbOverride('person/287')).toBeNull();
	});
});

describe('override persistence', () => {
	const exportFilm = { uri: 'https://boxd.it/2a9q', name: 'Chernobyl', year: 2019 };
	const feedFilm = {
		uri: 'https://letterboxd.com/film/chernobyl/',
		name: ' chernobyl ',
		year: 2019
	};
	const target = { mediaType: 'tv', tmdbId: 87108 } as const;

	it('matches the same film across export and feed URIs without touching storage', () => {
		const storage = installStorage();
		const saved = saveOverride({}, feedFilm, target);
		expect(getOverride(saved, exportFilm)).toEqual(target);
		expect(formatTmdbOverride(getOverride(saved, exportFilm)!)).toBe('tv/87108');
		expect(getOverride(saved, { ...exportFilm, year: 2020 })).toBeUndefined();
		expect(removeOverride(saved, exportFilm)).toEqual({});
		expect(storage.size).toBe(0);
	});

	it('persists on request, clears storage when empty, and forgets on request', () => {
		const storage = installStorage();
		const saved = saveOverride({}, feedFilm, target);
		persistOverrides(saved);
		expect(loadOverrides()).toEqual(saved);

		persistOverrides({});
		expect(storage.size).toBe(0);

		persistOverrides(saved);
		forgetOverrides();
		expect(storage.size).toBe(0);
	});

	it('still reads overrides saved under the old URI key and replaces them on save', () => {
		installStorage({
			'vizard:tmdb-overrides': JSON.stringify({ 'https://Boxd.it/2A9Q/': target })
		});
		const legacy = loadOverrides();
		expect(getOverride(legacy, exportFilm)).toEqual(target);

		const resaved = saveOverride(legacy, exportFilm, { mediaType: 'tv', tmdbId: 1 });
		expect(Object.keys(resaved)).toEqual(['title:chernobyl::2019']);
		expect(removeOverride(legacy, exportFilm)).toEqual({});
	});

	it('ignores corrupt JSON and invalid entries when loading overrides', () => {
		installStorage({ 'vizard:tmdb-overrides': '{not json' });
		expect(loadOverrides()).toEqual({});

		installStorage({
			'vizard:tmdb-overrides': JSON.stringify({
				'https://Boxd.it/ok/': { mediaType: 'movie', tmdbId: 550 },
				'https://boxd.it/bad': { mediaType: 'person', tmdbId: 1 },
				'https://boxd.it/neg': { mediaType: 'movie', tmdbId: -5 }
			})
		});
		expect(loadOverrides()).toEqual({
			'https://boxd.it/ok': { mediaType: 'movie', tmdbId: 550 }
		});
	});
});
