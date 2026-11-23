import { describe, expect, it } from 'vitest';
import { film, watched } from '$lib/testing/fixtures';
import {
	byTag,
	filterReviews,
	reviewSummary,
	rewatchShifts,
	rewatchShiftSummary,
	taggedFilmCount
} from './personal';

describe('byTag', () => {
	it('groups films by trimmed non-empty tags, sorted by count desc then label', () => {
		const a = film({ name: 'A', rating: 4, tags: ['cinema', '  35mm  ', '', '   '] });
		const b = film({ name: 'B', rating: 3, tags: ['cinema', 'festival'] });
		const c = film({ name: 'C', rating: 5, tags: ['35mm'] });

		const result = byTag([a, b, c]);
		expect(result.map((d) => ({ label: d.label, count: d.count, avg: d.avg }))).toEqual([
			{ label: '35mm', count: 2, avg: 4.5 },
			{ label: 'cinema', count: 2, avg: 3.5 },
			{ label: 'festival', count: 1, avg: 3 }
		]);
	});

	it('counts each film only once per tag even with duplicates on the same film', () => {
		const repeated = film({ rating: 4, tags: ['cinema', ' cinema ', 'cinema'] });
		const result = byTag([repeated]);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ key: 'cinema', label: 'cinema', count: 1, avg: 4 });
		expect(result[0].films).toEqual([repeated]);
	});

	it('returns empty and zero count when films only have blank tags', () => {
		const films = [film({ tags: ['', '   '] }), film({ tags: [] })];
		expect(byTag(films)).toEqual([]);
		expect(taggedFilmCount(films)).toBe(0);
	});

	it('counts films with at least one non-empty tag', () => {
		const films = [
			film({ tags: ['cinema'] }),
			film({ tags: ['   ', 'festival'] }),
			film({ tags: ['   '] }),
			film({ tags: [] })
		];
		expect(taggedFilmCount(films)).toBe(2);
	});
});

describe('rewatchShifts', () => {
	it('compares earliest and latest dated rated entries regardless of diary order', () => {
		const climber = film({
			name: 'Vertigo',
			watchedDates: ['2025-01-11', '2020-01-01', '2022-06-01'],
			entries: [
				{ date: '2025-01-11', rating: 5, rewatch: true },
				{ date: '2020-01-01', rating: 3.5, rewatch: false },
				{ date: '2022-06-01', rating: 4, rewatch: true }
			]
		});

		const shifts = rewatchShifts([climber]);
		expect(shifts).toEqual([
			{
				film: climber,
				firstDate: '2020-01-01',
				firstRating: 3.5,
				latestDate: '2025-01-11',
				latestRating: 5,
				delta: 1.5,
				spanDays: 1837
			}
		]);
	});

	it('ignores unrated entries, single-entry rewatches, and blank dates', () => {
		const oneRated = film({
			name: 'Half Rated',
			watchedDates: ['2021-01-01', '2024-01-01'],
			entries: [
				{ date: '2021-01-01', rating: 3, rewatch: false },
				{ date: '2024-01-01', rating: null, rewatch: true }
			]
		});
		const singleEntryRewatch = film({
			name: 'Predates Diary',
			rewatch: true,
			watchedDates: ['2024-05-01'],
			entries: [{ date: '2024-05-01', rating: 4.5, rewatch: true }]
		});
		const blankDate = film({
			name: 'Bad Date',
			entries: [
				{ date: '', rating: 2, rewatch: false },
				{ date: '2024-05-01', rating: 4, rewatch: true }
			]
		});

		expect(rewatchShifts([oneRated, singleEntryRewatch, blankDate])).toEqual([]);
		expect(rewatchShiftSummary([oneRated, singleEntryRewatch, blankDate])).toEqual({
			improved: 0,
			dropped: 0,
			unchanged: 0
		});
	});

	it('sorts by absolute delta desc, then latestDate desc, then name, and summarizes unchanged', () => {
		const bigDrop = film({
			name: 'Zebra',
			entries: [
				{ date: '2020-01-01', rating: 4.5, rewatch: false },
				{ date: '2023-01-01', rating: 2.5, rewatch: true }
			]
		});
		const newerRise = film({
			name: 'Bravo',
			entries: [
				{ date: '2021-01-01', rating: 3, rewatch: false },
				{ date: '2025-06-01', rating: 4, rewatch: true }
			]
		});
		const sameDateAlpha = film({
			name: 'Alpha',
			entries: [
				{ date: '2022-01-01', rating: 3, rewatch: false },
				{ date: '2025-06-01', rating: 4, rewatch: true }
			]
		});
		const olderRise = film({
			name: 'Charlie',
			entries: [
				{ date: '2019-01-01', rating: 2, rewatch: false },
				{ date: '2024-01-01', rating: 3, rewatch: true }
			]
		});
		const steady = film({
			name: 'Steady',
			entries: [
				{ date: '2020-01-01', rating: 4, rewatch: false },
				{ date: '2024-01-01', rating: 4, rewatch: true }
			]
		});

		const films = [steady, olderRise, newerRise, sameDateAlpha, bigDrop];
		expect(rewatchShifts(films).map((s) => s.film.name)).toEqual([
			'Zebra',
			'Alpha',
			'Bravo',
			'Charlie'
		]);
		expect(rewatchShiftSummary(films)).toEqual({
			improved: 3,
			dropped: 1,
			unchanged: 1
		});
	});
});

describe('reviewSummary and filterReviews', () => {
	it('excludes null and whitespace-only reviews and computes word and rating stats', () => {
		const long = film({
			name: 'Stalker',
			rating: 5,
			review: '  One two\n\tthree   four five  ',
			...watched(['2025-03-10'])
		});
		const short = film({
			name: 'Heat',
			rating: 4,
			review: 'Sharp.',
			...watched(['2025-01-05'])
		});
		const blank = film({ name: 'Blank', rating: 2, review: '   \n\t  ' });
		const unreviewed = film({ name: 'Silent', rating: 3, review: null });

		const summary = reviewSummary([long, short, blank, unreviewed]);
		expect(summary.count).toBe(2);
		expect(summary.totalWords).toBe(6);
		expect(summary.avgWords).toBe(3);
		expect(summary.reviewedAvgRating).toBe(4.5);
		expect(summary.unreviewedAvgRating).toBe(2.5);
		expect(summary.entries[0]).toMatchObject({
			film: long,
			text: 'One two\n\tthree   four five',
			words: 5,
			date: '2025-03-10'
		});
	});

	it('returns null averages when there are no reviews or no unreviewed rated films', () => {
		const empty = reviewSummary([film({ rating: 4 })]);
		expect(empty).toMatchObject({
			entries: [],
			count: 0,
			totalWords: 0,
			avgWords: null,
			reviewedAvgRating: null,
			unreviewedAvgRating: 4
		});

		const allReviewed = reviewSummary([film({ rating: 3.5, review: 'Good stuff' })]);
		expect(allReviewed.reviewedAvgRating).toBe(3.5);
		expect(allReviewed.unreviewedAvgRating).toBeNull();
	});

	it('filters by title or review text case-insensitively without mutating input', () => {
		const first = film({
			name: 'In the Mood for Love',
			rating: 5,
			review: 'Lush cinematography and restraint.',
			...watched(['2025-02-01'])
		});
		const second = film({
			name: 'Fallen Angels',
			rating: 4,
			review: 'Kinetic neon nights in Hong Kong.',
			...watched(['2025-04-01'])
		});
		const { entries } = reviewSummary([first, second]);
		const snapshot = [...entries];

		expect(filterReviews(entries, '  mood ', 'recent').map((e) => e.film.name)).toEqual([
			'In the Mood for Love'
		]);
		expect(filterReviews(entries, 'NEON', 'recent').map((e) => e.film.name)).toEqual([
			'Fallen Angels'
		]);
		expect(entries).toEqual(snapshot);
	});

	it('sorts by recent (undated last), longest, and rating (unrated last)', () => {
		const undatedLong = film({
			name: 'Undated Epic',
			rating: null,
			review: 'one two three four five six'
		});
		const olderHigh = film({
			name: 'Old Favorite',
			rating: 5,
			review: 'short note',
			...watched(['2023-05-01'])
		});
		const newestMid = film({
			name: 'Fresh Watch',
			rating: 3.5,
			review: 'a medium length review here',
			...watched(['2025-11-20'])
		});
		const { entries } = reviewSummary([undatedLong, olderHigh, newestMid]);

		expect(filterReviews(entries, '', 'recent').map((e) => e.film.name)).toEqual([
			'Fresh Watch',
			'Old Favorite',
			'Undated Epic'
		]);
		expect(filterReviews(entries, '', 'longest').map((e) => e.film.name)).toEqual([
			'Undated Epic',
			'Fresh Watch',
			'Old Favorite'
		]);
		expect(filterReviews(entries, '', 'rating').map((e) => e.film.name)).toEqual([
			'Old Favorite',
			'Fresh Watch',
			'Undated Epic'
		]);
	});

	it('strips Letterboxd HTML tags from plain text, word counts, and search', () => {
		const tagged = film({
			name: 'Persona',
			rating: 5,
			review: '<blockquote><i>Two</i> <b>faces</b></blockquote>',
			...watched(['2025-07-01'])
		});
		const { entries } = reviewSummary([tagged]);
		expect(entries[0]).toMatchObject({
			plain: 'Two faces',
			words: 2
		});
		expect(filterReviews(entries, 'blockquote', 'recent')).toEqual([]);
		expect(filterReviews(entries, 'faces', 'recent')).toHaveLength(1);
	});
});
