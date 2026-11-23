import { describe, expect, it } from 'vitest';
import { offers, tmdb, watchlistFilm } from '$lib/testing/fixtures';
import type { Provider, RegionOffers, TmdbMovie, WatchlistFilm } from '$lib/types';
import type { OffersOf } from './filter';
import { watchlistSummary } from './summary';

const netflix: Provider = { id: 8, name: 'Netflix', logoPath: null };
const mubi: Provider = { id: 11, name: 'MUBI', logoPath: null };
const apple: Provider = { id: 2, name: 'Apple TV', logoPath: null };

function entry(
	name: string,
	record: Partial<TmdbMovie> | null = {},
	added: string | null = '2024-01-01'
): WatchlistFilm {
	return watchlistFilm({
		uri: `https://boxd.it/${name}`,
		name,
		year: record?.year ?? 2020,
		added,
		tmdb: record === null ? null : tmdb(record)
	});
}

describe('watchlistSummary', () => {
	const now = new Date('2025-01-01T00:00:00Z');

	it('handles an empty watchlist', () => {
		const s = watchlistSummary([], () => undefined, [], { now });
		expect(s).toEqual({
			total: 0,
			totalHours: 0,
			timedCount: 0,
			avgRuntime: null,
			oldest: null,
			checked: 0,
			streamingAny: 0,
			streamingPct: null,
			rentOnly: 0,
			unavailable: 0,
			onSelectedServices: null,
			topService: null,
			unmatched: 0
		});
	});

	it('computes backlog runtime, oldest date, unmatched count, and streaming coverage', () => {
		const films = [
			entry('Stalker', { runtime: 161 }, '2022-01-01'),
			entry('Heat', { runtime: 170 }, '2024-06-01'),
			entry('Paddington', { runtime: 95 }, '2023-03-15'),
			entry('BuyOnly', { runtime: 0 }, '2024-02-01'),
			entry('Mystery', null, '2024-01-01')
		];
		const map: Record<string, RegionOffers | null> = {
			Stalker: offers({ flatrate: [mubi] }),
			Heat: offers({ flatrate: [netflix, mubi], rent: [apple] }),
			Paddington: offers({ rent: [apple] }),
			BuyOnly: offers({ buy: [apple] }),
			Mystery: null
		};
		const offersOf: OffersOf = (film) => map[film.name];

		const s = watchlistSummary(films, offersOf, [], { now });
		expect(s.total).toBe(5);
		expect(s.timedCount).toBe(3);
		expect(s.totalHours).toBe(7);
		expect(s.avgRuntime).toBe(142);
		expect(s.unmatched).toBe(1);
		expect(s.oldest).toEqual({
			name: 'Stalker',
			added: '2022-01-01',
			daysAgo: 1096
		});
		expect(s.checked).toBe(5);
		expect(s.streamingAny).toBe(2);
		expect(s.streamingPct).toBe(40);
		expect(s.rentOnly).toBe(2);
		expect(s.unavailable).toBe(1);
		expect(s.onSelectedServices).toBeNull();
		expect(s.topService).toEqual({ name: 'MUBI', films: 2, pct: 40 });
	});

	it('computes selected-service coverage when services are chosen', () => {
		const films = [entry('Stalker'), entry('Heat'), entry('Paddington')];
		const map: Record<string, RegionOffers | null> = {
			Stalker: offers({ flatrate: [mubi] }),
			Heat: offers({ flatrate: [netflix] }),
			Paddington: null
		};
		const s = watchlistSummary(films, (f) => map[f.name], [netflix.id], { now });
		expect(s.onSelectedServices).toEqual({ count: 1, pct: 33 });
	});

	it('excludes unresolved offers, breaks oldest-date ties by title, and clamps future added dates to 0 days', () => {
		const films = [
			entry('Zeta', { runtime: 100 }, '2025-02-01'),
			entry('Alpha', { runtime: 80 }, '2025-02-01')
		];
		const offersOf: OffersOf = (film) =>
			film.name === 'Alpha' ? offers({ free: [mubi] }) : undefined;

		const s = watchlistSummary(films, offersOf, [mubi.id], { now });
		expect(s.checked).toBe(1);
		expect(s.streamingAny).toBe(1);
		expect(s.streamingPct).toBe(100);
		expect(s.onSelectedServices).toEqual({ count: 1, pct: 100 });
		expect(s.oldest).toEqual({ name: 'Alpha', added: '2025-02-01', daysAgo: 0 });
	});
});
