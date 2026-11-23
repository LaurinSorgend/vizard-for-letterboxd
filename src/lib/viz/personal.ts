import { latestWatch } from '$lib/film/diary';
import { avgRating, grouped, type BarDatum } from '$lib/film/tally';
import { DAY_MS } from '$lib/math';
import type { EnrichedFilm } from '$lib/types';

export interface RewatchShift {
	film: EnrichedFilm;
	firstDate: string;
	firstRating: number;
	latestDate: string;
	latestRating: number;
	delta: number;
	spanDays: number;
}

export interface RewatchShiftSummary {
	improved: number;
	dropped: number;
	unchanged: number;
}

export interface ReviewEntry {
	film: EnrichedFilm;
	text: string;
	words: number;
	date: string | null;
}

export interface ReviewSummary {
	entries: ReviewEntry[];
	count: number;
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

function normalizeTags(tags: string[]): string[] {
	return tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
}

/** Films grouped by trimmed, non-empty diary tag, count-desc then label. */
export function byTag(films: EnrichedFilm[]): BarDatum[] {
	return grouped(films, (film) => normalizeTags(film.tags));
}

/** Number of films carrying at least one non-empty diary tag. */
export function taggedFilmCount(films: EnrichedFilm[]): number {
	return films.filter((film) => normalizeTags(film.tags).length > 0).length;
}

function datedRatedEntries(film: EnrichedFilm): RatedEntry[] {
	return film.entries
		.flatMap((entry) => {
			const date = entry.date.trim();
			if (!date || entry.rating === null) return [];
			const time = Date.parse(date);
			return Number.isFinite(time) ? [{ date, rating: entry.rating, time }] : [];
		})
		.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Films whose rating changed between their earliest and latest dated rated diary entries,
 * ordered by magnitude of change desc, latest watch date desc, then film name.
 */
export function rewatchShifts(films: EnrichedFilm[]): RewatchShift[] {
	const shifts: RewatchShift[] = [];
	for (const film of films) {
		const rated = datedRatedEntries(film);
		if (rated.length < 2) continue;
		const first = rated[0];
		const latest = rated[rated.length - 1];
		const delta = latest.rating - first.rating;
		if (delta === 0) continue;
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
	return shifts.sort(
		(a, b) =>
			Math.abs(b.delta) - Math.abs(a.delta) ||
			b.latestDate.localeCompare(a.latestDate) ||
			a.film.name.localeCompare(b.film.name)
	);
}

/** Counts how many multi-rated rewatches rose, fell, or kept the same rating. */
export function rewatchShiftSummary(films: EnrichedFilm[]): RewatchShiftSummary {
	let improved = 0;
	let dropped = 0;
	let unchanged = 0;
	for (const film of films) {
		const rated = datedRatedEntries(film);
		if (rated.length < 2) continue;
		const delta = rated[rated.length - 1].rating - rated[0].rating;
		if (delta > 0) improved += 1;
		else if (delta < 0) dropped += 1;
		else unchanged += 1;
	}
	return { improved, dropped, unchanged };
}

/** Word count matching `year/facts/library-facts.ts`. */
export function wordCount(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Extracts non-empty written reviews with word counts and reviewed vs. unreviewed averages. */
export function reviewSummary(films: EnrichedFilm[]): ReviewSummary {
	const entries: ReviewEntry[] = [];
	const reviewed: EnrichedFilm[] = [];
	const unreviewed: EnrichedFilm[] = [];

	for (const film of films) {
		const text = film.review?.trim() ?? '';
		if (text.length === 0) {
			unreviewed.push(film);
			continue;
		}
		reviewed.push(film);
		entries.push({
			film,
			text,
			words: wordCount(text),
			date: latestWatch(film)
		});
	}

	const totalWords = entries.reduce((sum, entry) => sum + entry.words, 0);
	return {
		entries,
		count: entries.length,
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

/** Filters reviews by title or review text substring and sorts by the chosen order. */
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
						entry.text.toLowerCase().includes(needle)
				);

	return matched.sort((a, b) => {
		if (sort === 'longest') {
			return (
				b.words - a.words ||
				compareDatesDesc(a.date, b.date) ||
				a.film.name.localeCompare(b.film.name)
			);
		}
		if (sort === 'rating') {
			return (
				(b.film.rating ?? -1) - (a.film.rating ?? -1) ||
				compareDatesDesc(a.date, b.date) ||
				a.film.name.localeCompare(b.film.name)
			);
		}
		return compareDatesDesc(a.date, b.date) || a.film.name.localeCompare(b.film.name);
	});
}
