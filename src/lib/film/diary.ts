import { isValidIsoDay } from '$lib/dates';
import type { Film } from '$lib/types';

/** The newest diary date of a film, or null when it was never logged. Diary order is not date order. */
export function latestWatch(film: Pick<Film, 'watchedDates'>): string | null {
	let latest: string | null = null;
	for (const date of film.watchedDates) if (latest === null || date > latest) latest = date;
	return latest;
}

/** Distinct calendar years present in diary dates, newest first. */
export function watchYears(films: Pick<Film, 'watchedDates'>[]): number[] {
	const years = new Set<number>();
	for (const film of films) {
		for (const raw of film.watchedDates) {
			const day = raw.trim().slice(0, 10);
			if (isValidIsoDay(day)) years.add(Number(day.slice(0, 4)));
		}
	}
	return [...years].sort((a, b) => b - a);
}
