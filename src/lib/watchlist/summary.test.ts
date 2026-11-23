import { describe, expect, it } from 'vitest';
import { tmdb } from '$lib/testing/fixtures';
import type { Provider, RegionOffers, TmdbMovie, WatchlistFilm } from '$lib/types';
import type { OffersOf } from './filter';
import { watchlistSummary } from './summary';

const netflix: Provider = { id: 8, name: 'Netflix', logoPath: null };
const mubi: Provider = { id: 11, name: 'MUBI', logoPath: null };
const apple: Provider = { id: 2, name: 'Apple TV', logoPath: null };

const offers = (over: Partial<RegionOffers> = {}): RegionOffers => ({
	link: null,
	flatrate: [],
	free: [],
	ads: [],
	rent: [],
	buy: [],
	...over
});

function entry(
	name: string,
	record: Partial<TmdbMovie> | null = {},
	added: string | null = '2024-01-01'
): WatchlistFilm {
	return {
		uri: `https://boxd.it/${name}`,
		name,
		year: record?.year ?? 2020,
		added,
		tmdb: record === null ? null : tmdb(record)
	};
}

describe('watchlistSummary', () => {
	const now = new Date('2025-01-01T00:00:00Z');

	it('handles an empty watchlist', () => {
		const s = watchlistSummary([], () => undefined, [], false, now);
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
			unmatched: 0,
			loading: false
		});
	});

	it('computes backlog runtime, oldest date, unmatched count, and streaming coverage', () => {
		const films = [
			entry('Stalker', { runtime: 161 }, '2022-01-01'),
			entry('Heat', { runtime: 170 }, '2024-06-01'),
			entry('Paddington', { runtime: 95 }, '2023-03-15'),
			entry('Mystery', null, '2024-01-01')
		];
		const map: Record<string, RegionOffers | null> = {
			Stalker: offers({ flatrate: [mubi] }),
			Heat: offers({ flatrate: [netflix, mubi], rent: [apple] }),
			Paddington: offers({ rent: [apple] }),
			Mystery: null
		};
		const offersOf: OffersOf = (film) => map[film.name];

		const s = watchlistSummary(films, offersOf, [], false, now);
		expect(s.total).toBe(4);
		expect(s.timedCount).toBe(3);
		expect(s.totalHours).toBe(Math.round((161 + 170 + 95) / 60));
		expect(s.avgRuntime).toBe(Math.round((161 + 170 + 95) / 3));
		expect(s.unmatched).toBe(1);
		expect(s.oldest).toEqual({
			name: 'Stalker',
			added: '2022-01-01',
			daysAgo: 1096
		});
		expect(s.checked).toBe(4);
		expect(s.streamingAny).toBe(2);
		expect(s.streamingPct).toBe(50);
		expect(s.rentOnly).toBe(1);
		expect(s.unavailable).toBe(1);
		expect(s.onSelectedServices).toBeNull();
		expect(s.topService).toEqual({ name: 'MUBI', films: 2, pct: 50 });
	});

	it('computes selected-service coverage when services are chosen', () => {
		const films = [entry('Stalker'), entry('Heat'), entry('Paddington')];
		const map: Record<string, RegionOffers | null> = {
			Stalker: offers({ flatrate: [mubi] }),
			Heat: offers({ flatrate: [netflix] }),
			Paddington: null
		};
		const s = watchlistSummary(films, (f) => map[f.name], [netflix.id], false, now);
		expect(s.onSelectedServices).toEqual({ count: 1, pct: 33 });
	});

	it('excludes unresolved offers while loading and breaks oldest-date ties by title', () => {
		const films = [
			entry('Zeta', { runtime: 100 }, '2023-05-01'),
			entry('Alpha', { runtime: 80 }, '2023-05-01')
		];
		const offersOf: OffersOf = (film) =>
			film.name === 'Alpha' ? offers({ free: [mubi] }) : undefined;

		const s = watchlistSummary(films, offersOf, [mubi.id], true, now);
		expect(s.loading).toBe(true);
		expect(s.checked).toBe(1);
		expect(s.streamingAny).toBe(1);
		expect(s.streamingPct).toBe(100);
		expect(s.onSelectedServices).toEqual({ count: 1, pct: 100 });
		expect(s.oldest?.name).toBe('Alpha');
	});
});
