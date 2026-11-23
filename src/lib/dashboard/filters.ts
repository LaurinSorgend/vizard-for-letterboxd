import { buildListFilmMatcher } from '$lib/film/identity';
import { isSeries } from '$lib/film/runtime';
import { cleanTags } from '$lib/film/tally';
import { formatIsoDate } from '$lib/format';
import type { CustomList, EnrichedFilm } from '$lib/types';

export interface DashboardFilters {
	/** ISO date lower bound (YYYY-MM-DD), or '' for none. */
	fromDate: string;
	toDate: string;
	mediaType: 'all' | 'movie' | 'tv';
	diaryOnly: boolean;
	/** Exact diary tag, or '' for any. */
	tag: string;
	heartedOnly: boolean;
	/** CustomList.id, or '' for any. */
	listId: string;
}

export const NO_DASHBOARD_FILTERS: DashboardFilters = {
	fromDate: '',
	toDate: '',
	mediaType: 'all',
	diaryOnly: false,
	tag: '',
	heartedOnly: false,
	listId: ''
};

export interface FilterChip {
	key: 'dates' | 'mediaType' | 'diaryOnly' | 'tag' | 'heartedOnly' | 'listId';
	label: string;
}

/** Returns the year string when `fromDate`..`toDate` spans an exact calendar year, else null. */
export function fullCalendarYear(fromDate: string, toDate: string): string | null {
	const from = fromDate.trim();
	const to = toDate.trim();
	const match = /^(\d{4})-01-01$/.exec(from);
	return match && to === `${match[1]}-12-31` ? match[1] : null;
}

function dateChipLabel(fromDate: string, toDate: string): string {
	const year = fullCalendarYear(fromDate, toDate);
	if (year) return `Watched: ${year}`;
	if (fromDate && toDate) return `Watched: ${formatIsoDate(fromDate)} – ${formatIsoDate(toDate)}`;
	if (fromDate) return `Watched from ${formatIsoDate(fromDate)}`;
	return `Watched until ${formatIsoDate(toDate)}`;
}

export function activeFilterChips(
	filters: DashboardFilters,
	lists: CustomList[] = []
): FilterChip[] {
	const chips: FilterChip[] = [];
	const fromDate = filters.fromDate.trim();
	const toDate = filters.toDate.trim();
	if (fromDate || toDate) chips.push({ key: 'dates', label: dateChipLabel(fromDate, toDate) });
	if (filters.mediaType === 'movie') chips.push({ key: 'mediaType', label: 'Films only' });
	else if (filters.mediaType === 'tv') chips.push({ key: 'mediaType', label: 'Series only' });
	const tag = filters.tag.trim();
	if (tag) chips.push({ key: 'tag', label: `Tag: ${tag}` });
	const listId = filters.listId.trim();
	if (listId) {
		const list = lists.find((entry) => entry.id === listId);
		chips.push({ key: 'listId', label: `List: ${list?.name ?? listId}` });
	}
	if (filters.diaryOnly) chips.push({ key: 'diaryOnly', label: 'Diary-logged' });
	if (filters.heartedOnly) chips.push({ key: 'heartedOnly', label: 'Hearted' });
	return chips;
}

export function clearFilterChip(
	filters: DashboardFilters,
	key: FilterChip['key']
): DashboardFilters {
	switch (key) {
		case 'dates':
			return { ...filters, fromDate: '', toDate: '' };
		case 'mediaType':
			return { ...filters, mediaType: 'all' };
		case 'diaryOnly':
			return { ...filters, diaryOnly: false };
		case 'tag':
			return { ...filters, tag: '' };
		case 'heartedOnly':
			return { ...filters, heartedOnly: false };
		case 'listId':
			return { ...filters, listId: '' };
	}
}

export function hasActiveDashboardFilters(filters: DashboardFilters): boolean {
	return activeFilterChips(filters).length > 0;
}

function inDateWindow(date: string, fromDate: string, toDate: string): boolean {
	const trimmed = date.trim();
	if (trimmed.length === 0) return false;
	return (!fromDate || trimmed >= fromDate) && (!toDate || trimmed <= toDate);
}

function clipToDateWindow(
	film: EnrichedFilm,
	fromDate: string,
	toDate: string
): EnrichedFilm | null {
	const watchedDates = film.watchedDates.filter((date) => inDateWindow(date, fromDate, toDate));
	if (watchedDates.length === 0) return null;

	const entries = film.entries.filter((entry) => inDateWindow(entry.date, fromDate, toDate));
	const rewatch = film.entries.length > 0 ? entries.some((entry) => entry.rewatch) : film.rewatch;
	return { ...film, watchedDates, entries, rewatch };
}

/**
 * Filters dashboard films and, when a date range is active, clips each matching film's
 * `watchedDates`, `entries`, and `rewatch` flag to that window.
 */
export function filterDashboardFilms(
	films: EnrichedFilm[],
	filters: DashboardFilters,
	lists: CustomList[] = []
): EnrichedFilm[] {
	if (!hasActiveDashboardFilters(filters)) return films;

	const fromDate = filters.fromDate.trim();
	const toDate = filters.toDate.trim();
	const hasDateWindow = fromDate.length > 0 || toDate.length > 0;
	const targetTag = filters.tag.trim();
	const targetList = filters.listId.trim()
		? lists.find((entry) => entry.id === filters.listId.trim())
		: undefined;
	const matchesList = targetList ? buildListFilmMatcher(targetList) : null;

	const result: EnrichedFilm[] = [];
	for (const film of films) {
		if (filters.mediaType === 'tv' && !isSeries(film)) continue;
		if (filters.mediaType === 'movie' && isSeries(film)) continue;
		if (filters.heartedOnly && !film.liked) continue;
		if (filters.diaryOnly && film.watchedDates.length === 0) continue;
		if (targetTag && !cleanTags(film.tags).includes(targetTag)) continue;
		if (matchesList && !matchesList(film)) continue;

		if (hasDateWindow) {
			const clipped = clipToDateWindow(film, fromDate, toDate);
			if (clipped) result.push(clipped);
		} else {
			result.push(film);
		}
	}
	return result;
}
