import { filmKey } from '$lib/ingest/film';
import type { CustomList, EnrichedFilm } from '$lib/types';

export interface DashboardFilters {
	/** ISO date lower bound (YYYY-MM-DD) for diary watched dates, or '' for none. */
	fromDate: string;
	/** ISO date upper bound (YYYY-MM-DD) for diary watched dates, or '' for none. */
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

function normalizeTags(tags: string[]): string[] {
	return tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
}

function normalizeUri(uri: string): string {
	return uri.trim().replace(/\/+$/, '').toLowerCase();
}

function inDateWindow(date: string, fromDate: string, toDate: string): boolean {
	const trimmed = date.trim();
	if (trimmed.length === 0) return false;
	return (!fromDate || trimmed >= fromDate) && (!toDate || trimmed <= toDate);
}

export interface FilterChip {
	key: 'dates' | 'mediaType' | 'diaryOnly' | 'tag' | 'heartedOnly' | 'listId';
	label: string;
}

/** Formats the active watch-date window into a short self-descriptive label. */
function dateChipLabel(fromDate: string, toDate: string): string {
	const match = /^(\d{4})-01-01$/.exec(fromDate);
	if (match && toDate === `${match[1]}-12-31`) return `Watched: ${match[1]}`;
	if (fromDate && toDate) return `Watched: ${fromDate} – ${toDate}`;
	if (fromDate) return `Watched from ${fromDate}`;
	return `Watched until ${toDate}`;
}

/** Concise labels for each currently active filter, used in collapsed summary chips. */
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
	if (filters.tag.trim()) chips.push({ key: 'tag', label: `Tag: ${filters.tag.trim()}` });
	if (filters.listId.trim()) {
		const list = lists.find((entry) => entry.id === filters.listId.trim());
		chips.push({ key: 'listId', label: `List: ${list?.name ?? filters.listId.trim()}` });
	}
	if (filters.diaryOnly) chips.push({ key: 'diaryOnly', label: 'Diary-logged' });
	if (filters.heartedOnly) chips.push({ key: 'heartedOnly', label: 'Hearted' });
	return chips;
}

/** Returns a copy of `filters` with the given chip's constraint cleared. */
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

/** Whether any dashboard filter narrows the library. */
export function hasActiveDashboardFilters(filters: DashboardFilters): boolean {
	return (
		filters.fromDate.trim().length > 0 ||
		filters.toDate.trim().length > 0 ||
		filters.mediaType !== 'all' ||
		filters.diaryOnly ||
		filters.tag.trim().length > 0 ||
		filters.heartedOnly ||
		filters.listId.trim().length > 0
	);
}

/** Distinct watch years present in diary dates, newest first. */
export function availableWatchYears(films: EnrichedFilm[]): number[] {
	const years = new Set<number>();
	for (const film of films) {
		for (const date of film.watchedDates) {
			const match = /^(\d{4})/.exec(date.trim());
			if (!match) continue;
			const year = Number.parseInt(match[1], 10);
			if (Number.isFinite(year)) years.add(year);
		}
	}
	return [...years].sort((a, b) => b - a);
}

/** Distinct trimmed non-empty diary tags with film counts, busiest first then alphabetical. */
export function availableTags(films: EnrichedFilm[]): { tag: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const film of films) {
		for (const tag of new Set(normalizeTags(film.tags))) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}
	return [...counts]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

function buildListMatcher(
	lists: CustomList[],
	listId: string
): ((film: EnrichedFilm) => boolean) | null {
	if (!listId) return null;
	const list = lists.find((entry) => entry.id === listId);
	if (!list) return null;

	const keys = new Set<string>();
	const uris = new Set<string>();
	for (const item of list.items) {
		keys.add(filmKey(item.name.trim(), item.year));
		const uri = normalizeUri(item.uri);
		if (uri) uris.add(uri);
	}
	return (film) => {
		if (keys.has(filmKey(film.name.trim(), film.year))) return true;
		const uri = normalizeUri(film.uri);
		return uri.length > 0 && uris.has(uri);
	};
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
	const matchesList = buildListMatcher(lists, filters.listId.trim());

	const result: EnrichedFilm[] = [];
	for (const film of films) {
		if (filters.mediaType !== 'all' && (film.tmdb?.mediaType ?? 'movie') !== filters.mediaType)
			continue;
		if (filters.heartedOnly && !film.liked) continue;
		if (filters.diaryOnly && film.watchedDates.length === 0) continue;
		if (targetTag && !normalizeTags(film.tags).includes(targetTag)) continue;
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
