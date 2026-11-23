import { describe, expect, it } from 'vitest';
import { tmdb } from '$lib/testing/fixtures';
import type { CalendarEntry, CalendarFilm } from './calendar';
import { buildIcs, escapeIcsText, foldIcsLine } from './ics';

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

describe('buildIcs structure', () => {
	it('produces a valid VCALENDAR with CRLF endings and deterministic VEVENT fields', () => {
		const item = entry({
			film: film({ key: '101', name: 'Dune: Messiah', href: 'https://boxd.it/dune3' }),
			kind: 'theatrical',
			date: '2026-12-18'
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
			'UID:101-theatrical-2026-12-18@vizard.sorgend.org',
			'DTSTAMP:20261123T190003Z',
			'DTSTART;VALUE=DATE:20261218',
			'DTEND;VALUE=DATE:20261219',
			'SUMMARY:Dune: Messiah (Theatrical)',
			'DESCRIPTION:Theatrical release (DE)\\nhttps://boxd.it/dune3',
			'URL:https://boxd.it/dune3',
			'END:VEVENT',
			'END:VCALENDAR'
		]);
	});

	it('supports empty entry lists, custom calendar names, and UID sanitization', () => {
		const empty = buildIcs([], { calendarName: 'My Films, 2026', now: FIXED_NOW });
		expect(unfold(empty)).toEqual([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//Vizard for Letterboxd//Release Calendar//EN',
			'CALSCALE:GREGORIAN',
			'X-WR-CALNAME:My Films\\, 2026',
			'END:VCALENDAR'
		]);

		const messy = entry({
			film: film({ key: 'https://boxd.it/a b;c' }),
			kind: 'digital',
			date: '2026-07-04'
		});
		const lines = unfold(buildIcs([messy], { now: FIXED_NOW }));
		expect(lines).toContain('X-WR-CALNAME:Vizard Releases');
		expect(lines).toContain('UID:https-boxd.it-a-b-c-digital-2026-07-04@vizard.sorgend.org');
	});
});

describe('all-day DTSTART/DTEND rollovers', () => {
	const cases: [string, string, string][] = [
		['normal day', '2026-06-15', '20260616'],
		['end of 31-day month', '2026-01-31', '20260201'],
		['end of 30-day month', '2026-04-30', '20260501'],
		['year boundary', '2026-12-31', '20270101'],
		['Feb 28 in leap year', '2024-02-28', '20240229'],
		['Feb 29 in leap year', '2024-02-29', '20240301'],
		['Feb 28 in non-leap year', '2025-02-28', '20250301']
	];

	for (const [label, date, expectedEnd] of cases) {
		it(`rolls over ${label} (${date} -> ${expectedEnd})`, () => {
			const lines = unfold(buildIcs([entry({ date })], { now: FIXED_NOW }));
			expect(lines).toContain(`DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`);
			expect(lines).toContain(`DTEND;VALUE=DATE:${expectedEnd}`);
		});
	}
});

describe('RFC 5545 text escaping', () => {
	it('escapes backslashes, semicolons, commas, and line breaks', () => {
		expect(escapeIcsText('a\\b; c, d\ne\r\nf\rg')).toBe('a\\\\b\\; c\\, d\\ne\\nf\\ng');
	});

	it('applies escaping to summary and description inside VEVENT', () => {
		const item = entry({
			film: film({
				name: 'One, Two; Three\\Four',
				href: null,
				recommended: { score: 3, reason: 'Director: A, B; C\nCast: D\\E', kinds: ['physical'] }
			}),
			kind: 'physical'
		});
		const lines = unfold(buildIcs([item], { now: FIXED_NOW }));
		expect(lines).toContain('SUMMARY:One\\, Two\\; Three\\\\Four (Physical)');
		expect(lines).toContain(
			'DESCRIPTION:Physical release\\nRecommended: Director: A\\, B\\; C\\nCast: D\\\\E'
		);
	});
});

describe('RFC 5545 line folding', () => {
	it('keeps lines at or under 75 UTF-8 octets unchanged', () => {
		const exact = 'A'.repeat(75);
		expect(foldIcsLine(exact)).toBe(exact);
	});

	it('folds long ASCII lines across multiple continuations within 75 octets each', () => {
		const long = `SUMMARY:${'X'.repeat(180)}`;
		const folded = foldIcsLine(long);
		const physicalLines = folded.split('\r\n');
		expect(physicalLines.length).toBeGreaterThan(2);
		for (const line of physicalLines) {
			expect(utf8.encode(line).length).toBeLessThanOrEqual(75);
		}
		expect(physicalLines.slice(1).every((line) => line.startsWith(' '))).toBe(true);
		expect(folded.replace(/\r\n /g, '')).toBe(long);
	});

	it('never splits multi-byte UTF-8 characters or surrogate pairs across fold boundaries', () => {
		const samples = [
			`${'a'.repeat(74)}é${'b'.repeat(20)}`,
			`${'a'.repeat(73)}日本語タイトル${'b'.repeat(20)}`,
			`${'a'.repeat(72)}🎬📽️🎞️${'b'.repeat(20)}`,
			`SUMMARY:${'日本語の映画タイトル—'.repeat(8)} (Theatrical)`
		];

		for (const sample of samples) {
			const folded = foldIcsLine(sample);
			const physicalLines = folded.split('\r\n');
			expect(physicalLines.length).toBeGreaterThan(1);
			for (const line of physicalLines) {
				expect(utf8.encode(line).length).toBeLessThanOrEqual(75);
				expect(line).not.toContain('\uFFFD');
				expect(line.isWellFormed()).toBe(true);
			}
			expect(folded.replace(/\r\n /g, '')).toBe(sample);
		}
	});

	it('folds long event properties inside buildIcs output', () => {
		const item = entry({
			film: film({
				name: 'A Very Long Film Title With Multi-Byte Text — 日本語 🎬 Over 75 Octets',
				href: 'https://www.themoviedb.org/movie/1234567890-a-very-long-slug-for-testing-folding'
			})
		});
		const ics = buildIcs([item], { region: 'US', now: FIXED_NOW });
		const physicalLines = ics.slice(0, -2).split('\r\n');
		for (const line of physicalLines) {
			expect(utf8.encode(line).length).toBeLessThanOrEqual(75);
		}
		expect(unfold(ics).find((l) => l.startsWith('SUMMARY:'))).toContain('日本語 🎬');
	});
});

describe('entry metadata in DESCRIPTION and URL', () => {
	it('includes fallback region note when fallbackRegion is set', () => {
		const item = entry({
			film: film({ name: 'Fallback Film', href: 'https://boxd.it/fallback' }),
			kind: 'physical',
			fallbackRegion: 'US'
		});
		const lines = unfold(buildIcs([item], { region: 'DE', now: FIXED_NOW }));
		expect(lines).toContain(
			'DESCRIPTION:Physical release (US fallback date)\\nhttps://boxd.it/fallback'
		);
		expect(lines).toContain('URL:https://boxd.it/fallback');
	});

	it('includes recommendation reason for recommended films', () => {
		const item = entry({
			film: film({
				name: 'Recommended Film',
				href: 'https://www.themoviedb.org/movie/42',
				allowFallback: false,
				recommended: { score: 5, reason: 'Director: Park Chan-wook', kinds: ['digital'] }
			}),
			kind: 'digital'
		});
		const lines = unfold(buildIcs([item], { region: 'GB', now: FIXED_NOW }));
		expect(lines).toContain(
			'DESCRIPTION:Digital release (GB)\\nRecommended: Director: Park Chan-wook\\nhttps://www.themoviedb.org/movie/42'
		);
		expect(lines).toContain('URL:https://www.themoviedb.org/movie/42');
	});

	it('omits URL property and link line when film.href is null', () => {
		const item = entry({
			film: film({ name: 'Unlinked Film', href: null }),
			kind: 'theatrical'
		});
		const lines = unfold(buildIcs([item], { region: 'US', now: FIXED_NOW }));
		expect(lines).toContain('DESCRIPTION:Theatrical release (US)');
		expect(lines.some((line) => line.startsWith('URL:'))).toBe(false);
	});
});
