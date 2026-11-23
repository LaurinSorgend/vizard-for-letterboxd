import { isValidIsoDay } from '$lib/dates';
import { latestWatch } from '$lib/film/diary';
import { avgRating } from '$lib/film/tally';
import { DAY_MS } from '$lib/math';
import { wordCount } from '$lib/text';
import type { EnrichedFilm } from '$lib/types';
import { plainReviewText } from './reviewMarkup';

export interface RewatchShift {
	film: EnrichedFilm;
	firstDate: string;
	firstRating: number;
	latestDate: string;
	latestRating: number;
	delta: number;
	spanDays: number;
}

export interface RewatchAnalysis {
	shifts: RewatchShift[];
	improved: number;
	dropped: number;
	unchanged: number;
}

export interface ReviewEntry {
	film: EnrichedFilm;
	text: string;
	plain: string;
	words: number;
	date: string | null;
}

export interface ReviewSummary {
	entries: ReviewEntry[];
	totalWords: number;
	avgWords: number | null;
	reviewedAvgRating: number | null;
	unreviewedAvgRating: number | null;
}

export type ReviewSort = 'recent' | 'longest' | 'rating';

interface RatedEntry {
	date: string;
	rating: number;
	time: number;
}

function datedRatedEntries(film: EnrichedFilm): RatedEntry[] {
	return film.entries
		.flatMap((entry) => {
			const date = entry.date.trim();
			if (entry.rating === null || !isValidIsoDay(date)) return [];
			return [{ date, rating: entry.rating, time: Date.parse(`${date}T00:00:00Z`) }];
		})
		.sort((a, b) => a.date.localeCompare(b.date));
}

/** Compares earliest and latest rated diary entries for each multi-rated film in one pass. */
export function rewatchAnalysis(films: EnrichedFilm[]): RewatchAnalysis {
	const shifts: RewatchShift[] = [];
	let improved = 0;
	let dropped = 0;
	let unchanged = 0;

	for (const film of films) {
		const rated = datedRatedEntries(film);
		if (rated.length < 2) continue;
		const first = rated[0];
		const latest = rated[rated.length - 1];
		const delta = latest.rating - first.rating;
		if (delta === 0) {
			unchanged += 1;
			continue;
		}
		if (delta > 0) improved += 1;
		else dropped += 1;
		shifts.push({
			film,
			firstDate: first.date,
			firstRating: first.rating,
			latestDate: latest.date,
			latestRating: latest.rating,
			delta,
			spanDays: Math.max(0, Math.round((latest.time - first.time) / DAY_MS))
		});
	}

	shifts.sort(
		(a, b) =>
			Math.abs(b.delta) - Math.abs(a.delta) ||
			b.latestDate.localeCompare(a.latestDate) ||
			a.film.name.localeCompare(b.film.name)
	);
	return { shifts, improved, dropped, unchanged };
}

export function reviewSummary(films: EnrichedFilm[]): ReviewSummary {
	const entries: ReviewEntry[] = [];
	const reviewed: EnrichedFilm[] = [];
	const unreviewed: EnrichedFilm[] = [];

	for (const film of films) {
		const text = film.review?.trim() ?? '';
		const plain = text.length > 0 ? plainReviewText(text) : '';
		if (plain.length === 0) {
			unreviewed.push(film);
			continue;
		}
		reviewed.push(film);
		entries.push({
			film,
			text,
			plain,
			words: wordCount(plain),
			date: latestWatch(film)
		});
	}

	const totalWords = entries.reduce((sum, entry) => sum + entry.words, 0);
	return {
		entries,
		totalWords,
		avgWords: entries.length > 0 ? totalWords / entries.length : null,
		reviewedAvgRating: avgRating(reviewed),
		unreviewedAvgRating: avgRating(unreviewed)
	};
}

function compareDatesDesc(a: string | null, b: string | null): number {
	if (a === b) return 0;
	if (a === null) return 1;
	if (b === null) return -1;
	return b.localeCompare(a);
}

const REVIEW_COMPARATORS: Record<ReviewSort, (a: ReviewEntry, b: ReviewEntry) => number> = {
	recent: (a, b) => compareDatesDesc(a.date, b.date) || a.film.name.localeCompare(b.film.name),
	longest: (a, b) =>
		b.words - a.words || compareDatesDesc(a.date, b.date) || a.film.name.localeCompare(b.film.name),
	rating: (a, b) =>
		(b.film.rating ?? -1) - (a.film.rating ?? -1) ||
		compareDatesDesc(a.date, b.date) ||
		a.film.name.localeCompare(b.film.name)
};

export function filterReviews(
	entries: ReviewEntry[],
	query: string,
	sort: ReviewSort
): ReviewEntry[] {
	const needle = query.trim().toLowerCase();
	const matched =
		needle.length === 0
			? [...entries]
			: entries.filter(
					(entry) =>
						entry.film.name.toLowerCase().includes(needle) ||
						entry.plain.toLowerCase().includes(needle)
				);
	return matched.sort(REVIEW_COMPARATORS[sort]);
}
