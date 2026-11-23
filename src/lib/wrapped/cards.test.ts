import { describe, expect, it } from 'vitest';
import { denseBarLabelSpec, horizontalBarLayout, statColumns } from './cards';

const measure = (text: string) => text.length * 16;

describe('statColumns', () => {
	it('spaces stat columns wide enough that a long label never overlaps the next one', () => {
		const [share, mostUsed, inYear] = statColumns(
			[
				{ label: 'Share', value: '10%' },
				{ label: 'Most-used rating', value: '★ 4.5' },
				{ label: 'In 2024', value: '21' }
			],
			measure
		);
		expect(mostUsed.x).toBeGreaterThan(share.x + measure('Share'));
		expect(inYear.x).toBeGreaterThan(mostUsed.x + measure('Most-used rating'));
	});

	it('shows three stats at most and shortens a long value', () => {
		const columns = statColumns(
			[
				{ label: 'A', value: 'A value far too long for its column' },
				{ label: 'B', value: '2' },
				{ label: 'C', value: '3' },
				{ label: 'D', value: '4' }
			],
			measure
		);
		expect(columns).toHaveLength(3);
		expect(columns[0].value.endsWith('…')).toBe(true);
		expect(columns[0].value.length).toBeLessThan('A value far too long for its column'.length);
	});
});

describe('horizontalBarLayout', () => {
	it('fits label, track, and value within measureTotal and truncates overly long labels', () => {
		const measureLabel = (text: string) => text.length * 18;
		const measureValue = (text: string) => text.length * 16;
		const layout = horizontalBarLayout(
			[
				{ label: 'United States of America', value: '42', share: 1 },
				{ label: 'France', value: '12', share: 0.28 }
			],
			824,
			measureLabel,
			measureValue
		);
		expect(layout.rows[0].label.endsWith('…')).toBe(true);
		expect(measureLabel(layout.rows[0].label)).toBeLessThanOrEqual(layout.labelWidth);
		expect(layout.rows[1].label).toBe('France');
		expect(layout.trackOffset).toBeGreaterThan(layout.labelWidth);
		expect(layout.trackOffset + layout.trackWidth + layout.valueWidth).toBeLessThan(824);
	});

	it('stays within measureTotal even on narrow measures and gives short labels a wider track', () => {
		const narrowMeasure = horizontalBarLayout(
			[{ label: 'United States of America', value: '12345', share: 1 }],
			260,
			(text) => text.length * 16,
			(text) => text.length * 14
		);
		expect(
			narrowMeasure.trackOffset + narrowMeasure.trackWidth + narrowMeasure.valueWidth
		).toBeLessThanOrEqual(260);

		const shortLabel = horizontalBarLayout(
			[{ label: 'Drama', value: '10', share: 1 }],
			824,
			(text) => text.length * 16,
			(text) => text.length * 14
		);
		const longLabel = horizontalBarLayout(
			[{ label: 'United States of America', value: '10', share: 1 }],
			824,
			(text) => text.length * 16,
			(text) => text.length * 14
		);
		expect(shortLabel.trackWidth).toBeGreaterThan(longLabel.trackWidth);
	});
});

describe('denseBarLabelSpec', () => {
	it('labels every bar when labels fit their slot', () => {
		const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
		const spec = denseBarLabelSpec(months, 68, (text, size) => text.length * size * 0.6);
		expect(spec.step).toBe(1);
		expect(spec.indices).toEqual(months.map((_, i) => i));
	});

	it('shrinks and strides labels on narrow bars without colliding near the final bar', () => {
		const years = Array.from({ length: 30 }, (_, i) => String(i).padStart(2, '0'));
		const spacious = denseBarLabelSpec(years, 68, (text, size) => text.length * size * 0.7);
		const cramped = denseBarLabelSpec(years, 20, (text, size) => text.length * size * 0.7);

		expect(cramped.fontSize).toBeLessThan(spacious.fontSize);
		expect(cramped.step).toBeGreaterThan(1);
		expect(cramped.indices[0]).toBe(0);
		for (let i = 1; i < cramped.indices.length; i++) {
			expect(cramped.indices[i] - cramped.indices[i - 1]).toBeGreaterThanOrEqual(cramped.step);
		}
	});
});
