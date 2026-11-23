import { describe, expect, it } from 'vitest';
import { film, watched } from '$lib/testing/fixtures';
import { watchYears } from './diary';

describe('watchYears', () => {
	it('returns unique diary years in descending order and skips invalid entries', () => {
		const films = [
			film(watched(['2022-03-10', '2024-11-05'])),
			film(watched(['2024-01-01', '2021-07-20'])),
			film({ watchedDates: ['', 'not-a-date', ' 2023-06-15 '] }),
			film()
		];
		expect(watchYears(films)).toEqual([2024, 2023, 2022, 2021]);
		expect(watchYears([film(), film()])).toEqual([]);
	});
});
