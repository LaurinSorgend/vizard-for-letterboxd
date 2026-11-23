import { unzipSync } from 'fflate';
import Papa from 'papaparse';
import { filmKey } from '$lib/film/identity';
import { getOrCreate } from '$lib/maps';
import type {
	CustomList,
	CustomListItem,
	Film,
	LetterboxdData,
	Profile,
	WatchlistEntry
} from '$lib/types';
import { blankFilm } from './film';

type Row = Record<string, string>;

function parseCsv(bytes: Uint8Array | undefined): Row[] {
	if (!bytes) return [];
	const text = new TextDecoder().decode(bytes);
	return Papa.parse<Row>(text, { header: true, skipEmptyLines: true }).data;
}

function toInt(value: string | undefined): number | null {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function humanizeSlug(slug: string): string {
	const words = slug.replace(/[-_]+/g, ' ').trim();
	return words ? words[0].toUpperCase() + words.slice(1) : slug;
}

function isMetaHeader(cells: string[]): boolean {
	const cols = new Set(cells.map((c) => c.trim()));
	return (
		cols.has('Name') &&
		(cols.has('Date') || cols.has('Tags')) &&
		!cols.has('Position') &&
		!cols.has('Year')
	);
}

function isItemsHeader(cells: string[]): boolean {
	const cols = new Set(cells.map((c) => c.trim()));
	return (
		cols.has('Name') && (cols.has('Position') || cols.has('Year') || cols.has('Letterboxd URI'))
	);
}

function columnReader(headers: string[]) {
	const index = new Map(headers.map((h, i) => [h.trim(), i]));
	return (row: string[] | undefined, ...names: string[]): string => {
		if (!row) return '';
		for (const name of names) {
			const i = index.get(name);
			if (i !== undefined) {
				const value = (row[i] ?? '').trim();
				if (value) return value;
			}
		}
		return '';
	};
}

/**
 * Parses one Letterboxd custom list CSV (`lists/<slug>.csv`), which packs a metadata table and an
 * item table into a single file. Returns null for empty or unrecognized files.
 */
function parseListCsv(id: string, bytes: Uint8Array): CustomList | null {
	if (bytes.byteLength === 0) return null;
	const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, '');
	const rows = Papa.parse<string[]>(text, { skipEmptyLines: true }).data;
	if (rows.length === 0) return null;

	const metaIdx = rows.findIndex(isMetaHeader);
	const itemStart = metaIdx >= 0 ? metaIdx + 1 : 0;
	const itemRelIdx = rows.slice(itemStart).findIndex(isItemsHeader);
	const itemsIdx = itemRelIdx >= 0 ? itemStart + itemRelIdx : -1;
	if (metaIdx === -1 && itemsIdx === -1) return null;

	const readMeta = metaIdx >= 0 ? columnReader(rows[metaIdx]) : () => '';
	const metaRowIdx = metaIdx + 1;
	const metaRow =
		metaIdx >= 0 && metaRowIdx < rows.length && metaRowIdx !== itemsIdx
			? rows[metaRowIdx]
			: undefined;

	const tags = readMeta(metaRow, 'Tags')
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);

	const items: CustomListItem[] = [];
	if (itemsIdx >= 0) {
		const readItem = columnReader(rows[itemsIdx]);
		for (const row of rows.slice(itemsIdx + 1)) {
			const name = readItem(row, 'Name');
			if (!name) continue;
			items.push({
				position: toInt(readItem(row, 'Position')),
				name,
				year: toInt(readItem(row, 'Year')),
				uri: readItem(row, 'URL', 'Letterboxd URI'),
				description: readItem(row, 'Description')
			});
		}
	}

	return {
		id,
		name: readMeta(metaRow, 'Name') || humanizeSlug(id),
		date: readMeta(metaRow, 'Date') || null,
		url: readMeta(metaRow, 'URL', 'Letterboxd URI'),
		description: readMeta(metaRow, 'Description'),
		tags,
		items
	};
}

function parseLists(entries: Record<string, Uint8Array>, prefix: string): CustomList[] {
	const listPrefix = prefix + 'lists/';
	const lists: CustomList[] = [];
	for (const [path, bytes] of Object.entries(entries)) {
		if (!path.startsWith(listPrefix) || !path.endsWith('.csv')) continue;
		const slug = path.slice(listPrefix.length, -4);
		if (!slug || slug.includes('/')) continue;
		const parsed = parseListCsv(slug, bytes);
		if (parsed) lists.push(parsed);
	}
	return lists.sort(
		(a, b) =>
			b.items.length - a.items.length || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
	);
}

/**
 * Parses a Letterboxd data-export zip into one film list merged across CSVs by name and year.
 * Handles zips with the CSVs at the root as well as inside a single top-level folder.
 */
export function parseExport(zipBytes: Uint8Array): LetterboxdData {
	let entries: ReturnType<typeof unzipSync>;
	try {
		entries = unzipSync(zipBytes);
	} catch {
		throw new Error('This file is not a zip archive');
	}
	const paths = Object.keys(entries);
	const root = paths[0]?.split('/')[0];
	const prefix = root && paths.every((p) => p.startsWith(root + '/')) ? root + '/' : '';
	const csv = (name: string) => parseCsv(entries[prefix + name]);

	if (!entries[prefix + 'watched.csv']) {
		throw new Error('watched.csv not found: is this a Letterboxd data export zip?');
	}

	const films = new Map<string, Film>();
	const get = (row: Row): Film => {
		const year = toInt(row['Year']);
		return getOrCreate(films, filmKey(row['Name'], year), () =>
			blankFilm({ uri: row['Letterboxd URI'], name: row['Name'], year })
		);
	};

	for (const row of csv('watched.csv')) get(row);
	for (const row of csv('ratings.csv')) {
		const rating = Number.parseFloat(row['Rating']);
		if (Number.isFinite(rating)) get(row).rating = rating;
	}
	for (const row of csv('likes/films.csv')) get(row).liked = true;
	for (const row of csv('diary.csv')) {
		const film = get(row);
		const date = row['Watched Date'];
		if (!date) continue;
		const rating = Number.parseFloat(row['Rating']);
		const rewatch = row['Rewatch'] === 'Yes';
		film.watchedDates.push(date);
		film.entries.push({ date, rating: Number.isFinite(rating) ? rating : null, rewatch });
		if (rewatch) film.rewatch = true;
		if (row['Tags'])
			film.tags.push(
				...row['Tags']
					.split(',')
					.map((t) => t.trim())
					.filter(Boolean)
			);
	}
	for (const row of csv('reviews.csv')) {
		if (row['Review']) get(row).review = row['Review'];
	}

	const watchlist: WatchlistEntry[] = csv('watchlist.csv').map((row) => ({
		uri: row['Letterboxd URI'],
		name: row['Name'],
		year: toInt(row['Year']),
		added: row['Date'] || null
	}));

	const profileRow = csv('profile.csv')[0];
	const profile: Profile | null = profileRow
		? {
				username: profileRow['Username'] ?? '',
				givenName: profileRow['Given Name'] ?? '',
				dateJoined: profileRow['Date Joined'] ?? '',
				location: profileRow['Location'] ?? ''
			}
		: null;

	const lists = parseLists(entries, prefix);

	return { films: [...films.values()], watchlist, lists, profile };
}
