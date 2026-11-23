import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseExport } from './parse';

function zip(files: Record<string, string>): Uint8Array {
	return zipSync(
		Object.fromEntries(Object.entries(files).map(([name, body]) => [name, strToU8(body)]))
	);
}

const WATCHED = 'Date,Name,Year,Letterboxd URI\n2019-03-01,Stalker,1979,https://boxd.it/a\n';

describe('parseExport diary', () => {
	it('keeps the rating recorded on each diary row', () => {
		const diary =
			'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
			'2019-03-02,Stalker,1979,https://boxd.it/d1,3,No,,2019-03-01\n' +
			'2025-04-13,Stalker,1979,https://boxd.it/d2,4.5,Yes,cinema,2025-04-12\n';
		const { films } = parseExport(zip({ 'watched.csv': WATCHED, 'diary.csv': diary }));
		expect(films).toHaveLength(1);
		expect(films[0].entries).toEqual([
			{ date: '2019-03-01', rating: 3, rewatch: false },
			{ date: '2025-04-12', rating: 4.5, rewatch: true }
		]);
		expect(films[0].watchedDates).toEqual(['2019-03-01', '2025-04-12']);
		expect(films[0].rewatch).toBe(true);
		expect(films[0].tags).toEqual(['cinema']);
	});

	it('records a null rating when the diary row has none', () => {
		const diary =
			'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
			'2025-01-05,Stalker,1979,https://boxd.it/d3,,No,,2025-01-04\n';
		const { films } = parseExport(zip({ 'watched.csv': WATCHED, 'diary.csv': diary }));
		expect(films[0].entries).toEqual([{ date: '2025-01-04', rating: null, rewatch: false }]);
	});

	it('leaves entries empty for a film that was never diary-logged', () => {
		const { films } = parseExport(zip({ 'watched.csv': WATCHED }));
		expect(films[0].entries).toEqual([]);
	});
});

describe('parseExport watchlist', () => {
	it('carries the date each film was added', () => {
		const watchlist =
			'Date,Name,Year,Letterboxd URI\n' +
			'2021-06-02,Stalker,1979,https://boxd.it/w1\n' +
			'2025-02-11,Nosferatu,2024,https://boxd.it/w2\n';
		const data = parseExport(zip({ 'watched.csv': WATCHED, 'watchlist.csv': watchlist }));
		expect(data.watchlist).toEqual([
			{ uri: 'https://boxd.it/w1', name: 'Stalker', year: 1979, added: '2021-06-02' },
			{ uri: 'https://boxd.it/w2', name: 'Nosferatu', year: 2024, added: '2025-02-11' }
		]);
	});

	it('records a null date when the export omits the column', () => {
		const watchlist = 'Name,Year,Letterboxd URI\nStalker,1979,https://boxd.it/w1\n';
		const data = parseExport(zip({ 'watched.csv': WATCHED, 'watchlist.csv': watchlist }));
		expect(data.watchlist[0].added).toBeNull();
	});
});

describe('parseExport lists', () => {
	it('parses a standard Letterboxd v7 list with tags and multiline quoted descriptions', () => {
		const sciFi =
			'Letterboxd list export v7\n' +
			'Date,Name,Tags,URL,Description\n' +
			'2021-05-01,My Top Sci-Fi,"sci-fi, favourites, ",https://boxd.it/abc,"Line one, with comma\nLine two"\n' +
			'\n' +
			'Position,Name,Year,URL,Description\n' +
			'1,Stalker,1979,https://boxd.it/298G,"A zone, a wish\nand a dog"\n' +
			'2,Solaris,1972,https://boxd.it/2a0A,\n' +
			',,2000,https://boxd.it/empty,\n';

		const { lists } = parseExport(
			zip({ 'watched.csv': WATCHED, 'lists/my-top-sci-fi.csv': sciFi })
		);

		expect(lists).toEqual([
			{
				id: 'my-top-sci-fi',
				name: 'My Top Sci-Fi',
				date: '2021-05-01',
				url: 'https://boxd.it/abc',
				description: 'Line one, with comma\nLine two',
				tags: ['sci-fi', 'favourites'],
				items: [
					{
						position: 1,
						name: 'Stalker',
						year: 1979,
						uri: 'https://boxd.it/298G',
						description: 'A zone, a wish\nand a dog'
					},
					{
						position: 2,
						name: 'Solaris',
						year: 1972,
						uri: 'https://boxd.it/2a0A',
						description: ''
					}
				]
			}
		]);
	});

	it('tolerates Letterboxd URI column, missing version line, blank name fallback, and sorts multiple lists', () => {
		const listA =
			'Date,Name,Tags,URL,Description\n' +
			'2022-01-10,,classic,https://boxd.it/a,\n' +
			'Position,Name,Year,Letterboxd URI,Description\n' +
			'1,Persona,1966,https://boxd.it/p1,\n';
		const listB =
			'Letterboxd list export v7\n' +
			'Date,Name,Tags,URL,Description\n' +
			'2023-03-04,Longer List,,https://boxd.it/b,\n' +
			'Position,Name,Year,URL,Description\n' +
			'1,Stalker,1979,https://boxd.it/1,\n' +
			'2,Mirror,1975,https://boxd.it/2,\n';

		const { lists } = parseExport(
			zip({
				'watched.csv': WATCHED,
				'lists/my-classic-picks.csv': listA,
				'lists/longer-list.csv': listB
			})
		);

		expect(lists.map((l) => ({ id: l.id, name: l.name, count: l.items.length }))).toEqual([
			{ id: 'longer-list', name: 'Longer List', count: 2 },
			{ id: 'my-classic-picks', name: 'My classic picks', count: 1 }
		]);
		expect(lists[1].items[0].uri).toBe('https://boxd.it/p1');
	});

	it('ignores deleted/lists, nested subdirectories, and malformed or empty list CSVs', () => {
		const valid =
			'Letterboxd list export v7\n' +
			'Date,Name,Tags,URL,Description\n' +
			'2024-02-01,Valid List,,https://boxd.it/v,\n' +
			'Position,Name,Year,URL,Description\n' +
			'1,Stalker,1979,https://boxd.it/1,\n';

		const { lists } = parseExport(
			zip({
				'watched.csv': WATCHED,
				'lists/valid.csv': valid,
				'deleted/lists/removed.csv': valid,
				'lists/nested/sub.csv': valid,
				'lists/empty.csv': '',
				'lists/garbage.csv': 'foo,bar\n1,2\n'
			})
		);

		expect(lists.map((l) => l.id)).toEqual(['valid']);
	});

	it('parses lists inside a root-folder prefixed export zip', () => {
		const listCsv =
			'Letterboxd list export v7\n' +
			'Date,Name,Tags,URL,Description\n' +
			'2025-05-01,Exported List,tag1,https://boxd.it/e,\n' +
			'Position,Name,Year,URL,Description\n' +
			'1,Stalker,1979,https://boxd.it/1,\n';

		const { lists } = parseExport(
			zip({
				'letterboxd-user-2025/watched.csv': WATCHED,
				'letterboxd-user-2025/lists/exported-list.csv': listCsv,
				'letterboxd-user-2025/deleted/lists/old.csv': listCsv
			})
		);

		expect(lists).toHaveLength(1);
		expect(lists[0].id).toBe('exported-list');
		expect(lists[0].name).toBe('Exported List');
		expect(lists[0].items).toHaveLength(1);
	});
});
