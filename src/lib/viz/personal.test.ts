import { describe, expect, it } from 'vitest';
import { film, watched } from '$lib/testing/fixtures';
import { filterReviews, reviewSummary, rewatchAnalysis } from './personal';

describe('rewatchAnalysis', () => {
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

		const analysis = rewatchAnalysis([climber]);
		expect(analysis).toEqual({
			shifts: [
				{
					film: climber,
					firstDate: '2020-01-01',
					firstRating: 3.5,
					latestDate: '2025-01-11',
					latestRating: 5,
					delta: 1.5,
					spanDays: 1837
				}
			],
			improved: 1,
			dropped: 0,
			unchanged: 0
		});
	});

	it('ignores unrated entries, single-entry rewatches, and malformed dates', () => {
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
		const badDate = film({
			name: 'Bad Date',
			watchedDates: ['2024-02-30', '2024-05-01'],
			entries: [
				{ date: '2024-02-30', rating: 2, rewatch: false },
				{ date: '2024-05-01', rating: 4, rewatch: true }
			]
		});

		expect(rewatchAnalysis([oneRated, singleEntryRewatch, badDate])).toEqual({
			shifts: [],
			improved: 0,
			dropped: 0,
			unchanged: 0
		});
	});

	it('sorts by absolute delta desc, then latestDate desc, then name, and summarizes unchanged', () => {
		const bigDrop = film({
			name: 'Zebra',
			watchedDates: ['2020-01-01', '2023-01-01'],
			entries: [
				{ date: '2020-01-01', rating: 4.5, rewatch: false },
				{ date: '2023-01-01', rating: 2.5, rewatch: true }
			]
		});
		const newerRise = film({
			name: 'Bravo',
			watchedDates: ['2021-01-01', '2025-06-01'],
			entries: [
				{ date: '2021-01-01', rating: 3, rewatch: false },
				{ date: '2025-06-01', rating: 4, rewatch: true }
			]
		});
		const sameDateAlpha = film({
			name: 'Alpha',
			watchedDates: ['2022-01-01', '2025-06-01'],
			entries: [
				{ date: '2022-01-01', rating: 3, rewatch: false },
				{ date: '2025-06-01', rating: 4, rewatch: true }
			]
		});
		const olderRise = film({
			name: 'Charlie',
			watchedDates: ['2019-01-01', '2024-01-01'],
			entries: [
				{ date: '2019-01-01', rating: 2, rewatch: false },
				{ date: '2024-01-01', rating: 3, rewatch: true }
			]
		});
		const steady = film({
			name: 'Steady',
			watchedDates: ['2020-01-01', '2024-01-01'],
			entries: [
				{ date: '2020-01-01', rating: 4, rewatch: false },
				{ date: '2024-01-01', rating: 4, rewatch: true }
			]
		});

		const analysis = rewatchAnalysis([steady, olderRise, newerRise, sameDateAlpha, bigDrop]);
		expect(analysis.shifts.map((s) => s.film.name)).toEqual(['Zebra', 'Alpha', 'Bravo', 'Charlie']);
		expect({
			improved: analysis.improved,
			dropped: analysis.dropped,
			unchanged: analysis.unchanged
		}).toEqual({ improved: 3, dropped: 1, unchanged: 1 });
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
		expect(summary.entries).toHaveLength(2);
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
		expect(empty).toEqual({
			entries: [],
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

	it('sorts by recent, longest, and rating with date and title tie-breakers', () => {
		const undatedLong = film({
			name: 'Undated Epic',
			rating: null,
			review: 'one two three four five six'
		});
		const olderFive = film({
			name: 'Old Favorite',
			rating: 5,
			review: 'short note',
			...watched(['2023-05-01'])
		});
		const newerFive = film({
			name: 'New Favorite',
			rating: 5,
			review: 'two words',
			...watched(['2025-11-20'])
		});
		const sameDayAlpha = film({
			name: 'Alpha Watch',
			rating: 3.5,
			review: 'a medium length review here',
			...watched(['2025-11-20'])
		});
		const { entries } = reviewSummary([undatedLong, olderFive, newerFive, sameDayAlpha]);

		expect(filterReviews(entries, '', 'recent').map((e) => e.film.name)).toEqual([
			'Alpha Watch',
			'New Favorite',
			'Old Favorite',
			'Undated Epic'
		]);
		expect(filterReviews(entries, '', 'longest').map((e) => e.film.name)).toEqual([
			'Undated Epic',
			'Alpha Watch',
			'New Favorite',
			'Old Favorite'
		]);
		expect(filterReviews(entries, '', 'rating').map((e) => e.film.name)).toEqual([
			'New Favorite',
			'Old Favorite',
			'Alpha Watch',
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
