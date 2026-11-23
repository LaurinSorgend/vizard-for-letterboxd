import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

import {
	formatTmdbOverride,
	getOverride,
	loadOverrides,
	parseTmdbOverride,
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
	it('normalizes URIs on save, lookup, and removal, and clears storage when empty', () => {
		const storage = installStorage();
		const saved = saveOverride({}, ' https://Boxd.it/2a9q/ ', { mediaType: 'tv', tmdbId: 87108 });
		expect(getOverride(saved, 'https://boxd.it/2a9q')).toEqual({ mediaType: 'tv', tmdbId: 87108 });
		expect(formatTmdbOverride(getOverride(saved, 'https://boxd.it/2a9q')!)).toBe('tv/87108');
		expect(loadOverrides()).toEqual(saved);

		const cleared = removeOverride(saved, 'HTTPS://BOXD.IT/2A9Q');
		expect(cleared).toEqual({});
		expect(storage.size).toBe(0);
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
