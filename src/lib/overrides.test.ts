import { describe, expect, it } from 'vitest';
import {
	formatTmdbOverride,
	normalizeOverrideUri,
	parseTmdbOverride,
	tmdbOverrideUrl
} from './overrides';

describe('parseTmdbOverride', () => {
	it('parses plain numeric IDs as movies', () => {
		expect(parseTmdbOverride('550')).toEqual({ mediaType: 'movie', tmdbId: 550 });
		expect(parseTmdbOverride('  27205 ')).toEqual({ mediaType: 'movie', tmdbId: 27205 });
	});

	it('parses prefixed movie and TV targets', () => {
		expect(parseTmdbOverride('movie/550')).toEqual({ mediaType: 'movie', tmdbId: 550 });
		expect(parseTmdbOverride('tv/1399')).toEqual({ mediaType: 'tv', tmdbId: 1399 });
		expect(parseTmdbOverride('TV:87108')).toEqual({ mediaType: 'tv', tmdbId: 87108 });
		expect(parseTmdbOverride('movie/550-fight-club')).toEqual({ mediaType: 'movie', tmdbId: 550 });
	});

	it('parses full TMDB movie and TV URLs', () => {
		expect(parseTmdbOverride('https://www.themoviedb.org/movie/550-fight-club')).toEqual({
			mediaType: 'movie',
			tmdbId: 550
		});
		expect(parseTmdbOverride('https://themoviedb.org/tv/87108-chernobyl?language=en-US')).toEqual({
			mediaType: 'tv',
			tmdbId: 87108
		});
	});

	it('rejects empty, zero, negative, or unrecognised input', () => {
		expect(parseTmdbOverride('')).toBeNull();
		expect(parseTmdbOverride('0')).toBeNull();
		expect(parseTmdbOverride('-550')).toBeNull();
		expect(parseTmdbOverride('https://letterboxd.com/film/fight-club/')).toBeNull();
		expect(parseTmdbOverride('person/287')).toBeNull();
	});
});

describe('override helpers', () => {
	it('normalises URIs and formats display tokens and links', () => {
		expect(normalizeOverrideUri(' https://Boxd.it/2a9q/ ')).toBe('https://boxd.it/2a9q');
		expect(formatTmdbOverride({ mediaType: 'tv', tmdbId: 87108 })).toBe('tv/87108');
		expect(tmdbOverrideUrl({ mediaType: 'movie', tmdbId: 550 })).toBe(
			'https://www.themoviedb.org/movie/550'
		);
	});
});
