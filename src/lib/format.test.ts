import { describe, expect, it } from 'vitest';
import { formatDateRange, formatDayMonth, formatDays, formatIsoDate, formatShort } from './format';

describe('date formatting', () => {
	it('formats ISO dates with month, day, and year in UTC', () => {
		expect(formatShort('2026-03-05')).toBe('Mar 5, 2026');
		expect(formatShort('2024-01-01')).toBe('Jan 1, 2024');
		expect(formatIsoDate('2024-03-01')).toBe('Mar 1, 2024');
		expect(formatIsoDate('not-a-date')).toBe('not-a-date');
	});

	it('formats day and month without year when year context is already shown', () => {
		expect(formatDayMonth('2026-03-05')).toBe('5 Mar');
	});

	it('omits year on date ranges only when both dates fall inside withinYear', () => {
		expect(formatDateRange('2025-03-05', '2025-03-12', 2025)).toBe('5 Mar to 12 Mar');
		expect(formatDateRange('2024-12-28', '2025-01-03', 2025)).toBe('Dec 28, 2024 to Jan 3, 2025');
		expect(formatDateRange('2025-03-05', '2025-03-12')).toBe('Mar 5, 2025 to Mar 12, 2025');
	});

	it('pluralizes day and month spans cleanly', () => {
		expect(formatDays(1)).toBe('1 day');
		expect(formatDays(59)).toBe('59 days');
		expect(formatDays(60)).toBe('2 months');
		expect(formatDays(548)).toBe('1.5 years');
	});
});
