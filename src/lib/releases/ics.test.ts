import { describe, expect, it } from 'vitest';
import { tmdb } from '$lib/testing/fixtures';
import type { CalendarEntry, CalendarFilm } from './calendar';
import { buildIcs } from './ics';

const FIXED_NOW = new Date('2026-11-23T19:00:03Z');
const utf8 = new TextEncoder();

function film(over: Partial<CalendarFilm> = {}): CalendarFilm {
	const record = tmdb({ title: over.name ?? 'Sample Film' });
	return {
		key: String(record.tmdbId),
		name: record.title,
		year: record.year,
		href: `https://boxd.it/${record.tmdbId}`,
		tmdb: record,
		allowFallback: true,
		...over
	};
}

function entry(over: Partial<CalendarEntry> = {}): CalendarEntry {
	return {
		film: film(),
		kind: 'theatrical',
		date: '2026-12-18',
		fallbackRegion: null,
		...over
	};
}

const unfold = (ics: string): string[] => ics.replace(/\r\n /g, '').trimEnd().split('\r\n');

describe('buildIcs', () => {
	it('produces a valid VCALENDAR with CRLF endings, exclusive DTEND, and deterministic VEVENT fields', () => {
		const item = entry({
			film: film({ key: '101', name: 'Dune: Messiah', href: 'https://boxd.it/dune3' }),
			kind: 'theatrical',
			date: '2026-12-31'
		});
		const ics = buildIcs([item], { region: 'DE', now: FIXED_NOW });

		expect(ics.endsWith('\r\n')).toBe(true);
		expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);

		expect(unfold(ics)).toEqual([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//Vizard for Letterboxd//Release Calendar//EN',
			'CALSCALE:GREGORIAN',
			'X-WR-CALNAME:Vizard Releases (DE)',
			'BEGIN:VEVENT',
			'UID:101-theatrical-2026-12-31@vizard.sorgend.org',
			'DTSTAMP:20261123T190003Z',
			'DTSTART;VALUE=DATE:20261231',
			'DTEND;VALUE=DATE:20270101',
			'SUMMARY:Dune: Messiah (Theatrical)',
			'DESCRIPTION:Theatrical release (DE)\\nhttps://boxd.it/dune3',
			'URL:https://boxd.it/dune3',
			'END:VEVENT',
			'END:VCALENDAR'
		]);
	});

	it('handles empty entry lists, default calendar name without region, and UID sanitization', () => {
		expect(unfold(buildIcs([], { now: FIXED_NOW }))).toEqual([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//Vizard for Letterboxd//Release Calendar//EN',
			'CALSCALE:GREGORIAN',
			'X-WR-CALNAME:Vizard Releases',
			'END:VCALENDAR'
		]);

		const messy = entry({
			film: film({ key: 'https://boxd.it/a b;c' }),
			kind: 'digital',
			date: '2026-07-04'
		});
		const lines = unfold(buildIcs([messy], { now: FIXED_NOW }));
		expect(lines).toContain('UID:https-boxd.it-a-b-c-digital-2026-07-04@vizard.sorgend.org');
	});

	it('escapes RFC 5545 special characters and line breaks in SUMMARY and DESCRIPTION', () => {
		const item = entry({
			film: film({
				name: 'One, Two; Three\\Four',
				href: null,
				recommended: {
					score: 3,
					reason: 'Director: A, B; C\r\nCast: D\\E\rTag: F',
					kinds: ['physical']
				}
			}),
			kind: 'physical'
		});
		const lines = unfold(buildIcs([item], { now: FIXED_NOW }));
		expect(lines).toContain('SUMMARY:One\\, Two\\; Three\\\\Four (Physical)');
		expect(lines).toContain(
			'DESCRIPTION:Physical release\\nRecommended: Director: A\\, B\\; C\\nCast: D\\\\E\\nTag: F'
		);
	});

	it('folds long ASCII and multi-byte UTF-8 lines to <= 75 octets without splitting code points', () => {
		const items = [
			entry({
				film: film({
					name: `${'a'.repeat(66)}é${'b'.repeat(20)}`,
					href: 'https://www.themoviedb.org/movie/1234567890-a-very-long-slug-for-testing-folding'
				})
			}),
			entry({
				film: film({
					name: `${'日本語の映画タイトル—'.repeat(6)} 🎬📽️🎞️`
				})
			})
		];
		const ics = buildIcs(items, { region: 'US', now: FIXED_NOW });
		const physicalLines = ics.slice(0, -2).split('\r\n');
		expect(physicalLines.some((line) => line.startsWith(' '))).toBe(true);
		for (const line of physicalLines) {
			expect(utf8.encode(line).length).toBeLessThanOrEqual(75);
			expect(line.isWellFormed()).toBe(true);
		}
		const unfolded = unfold(ics);
		expect(unfolded.some((line) => line.includes('ébbbb'))).toBe(true);
		expect(unfolded.some((line) => line.includes('🎬📽️🎞️'))).toBe(true);
	});

	it('includes fallback region, recommendation reasons, and omits URL when href is null', () => {
		const fallback = entry({
			film: film({ name: 'Fallback Film', href: 'https://boxd.it/fallback' }),
			kind: 'physical',
			fallbackRegion: 'US'
		});
		const recommended = entry({
			film: film({
				name: 'Recommended Film',
				href: 'https://www.themoviedb.org/movie/42',
				allowFallback: false,
				recommended: { score: 5, reason: 'Director: Park Chan-wook', kinds: ['digital'] }
			}),
			kind: 'digital'
		});
		const unlinked = entry({
			film: film({ name: 'Unlinked Film', href: null }),
			kind: 'theatrical'
		});

		const fallbackLines = unfold(buildIcs([fallback], { region: 'DE', now: FIXED_NOW }));
		expect(fallbackLines).toContain(
			'DESCRIPTION:Physical release (US fallback date)\\nhttps://boxd.it/fallback'
		);
		expect(fallbackLines).toContain('URL:https://boxd.it/fallback');

		const recLines = unfold(buildIcs([recommended], { region: 'GB', now: FIXED_NOW }));
		expect(recLines).toContain(
			'DESCRIPTION:Digital release (GB)\\nRecommended: Director: Park Chan-wook\\nhttps://www.themoviedb.org/movie/42'
		);
		expect(recLines).toContain('URL:https://www.themoviedb.org/movie/42');

		const unlinkedLines = unfold(buildIcs([unlinked], { region: 'US', now: FIXED_NOW }));
		expect(unlinkedLines).toContain('DESCRIPTION:Theatrical release (US)');
		expect(unlinkedLines.some((line) => line.startsWith('URL:'))).toBe(false);
	});
});
