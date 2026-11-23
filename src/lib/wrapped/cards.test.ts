import { describe, expect, it } from 'vitest';
import {
	cardFilename,
	denseBarLabelSpec,
	horizontalBarLayout,
	statColumns,
	truncateText
} from './cards';

/** Monospace-style widths: sixteen pixels a character, whatever the size. */
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
		expect(mostUsed.x).toBeGreaterThanOrEqual(share.x + 200);
		expect(inYear.x).toBeGreaterThanOrEqual(mostUsed.x + measure('Most-used rating'));
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
		expect(columns[0].value).toBe('A value far too l…');
	});
});

describe('truncateText', () => {
	it('leaves text untouched when it fits inside maxWidth', () => {
		expect(truncateText('Drama', 100, measure)).toBe('Drama');
	});

	it('clamps text with an ellipsis so its measured width stays within maxWidth', () => {
		const out = truncateText('United States of America', 160, measure);
		expect(out.endsWith('…')).toBe(true);
		expect(measure(out)).toBeLessThanOrEqual(160);
	});
});

describe('horizontalBarLayout', () => {
	it('clamps long bar labels so they never extend into the bar track', () => {
		const layout = horizontalBarLayout(
			[
				{ label: 'United States of America', value: '42', share: 1 },
				{ label: 'France', value: '12', share: 0.28 }
			],
			824,
			(text) => text.length * 18,
			(text) => text.length * 16
		);
		expect(layout.labelWidth).toBeLessThanOrEqual(300);
		expect(layout.rows[0].label.endsWith('…')).toBe(true);
		expect(layout.rows[0].label.length * 18).toBeLessThanOrEqual(layout.labelWidth);
		expect(layout.rows[1].label).toBe('France');
		expect(layout.trackX).toBeGreaterThan(128 + layout.labelWidth);
		expect(layout.trackX + layout.trackWidth + layout.valueWidth).toBeLessThan(128 + 824);
	});

	it('gives short labels a narrower label column and wider bar track', () => {
		const narrow = horizontalBarLayout(
			[{ label: 'Drama', value: '10', share: 1 }],
			824,
			(text) => text.length * 16,
			(text) => text.length * 14
		);
		const wide = horizontalBarLayout(
			[{ label: 'United States of America', value: '10', share: 1 }],
			824,
			(text) => text.length * 16,
			(text) => text.length * 14
		);
		expect(narrow.trackWidth).toBeGreaterThan(wide.trackWidth);
	});
});

describe('denseBarLabelSpec', () => {
	it('keeps full font size and step 1 when labels fit their slot', () => {
		const spec = denseBarLabelSpec(
			['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
			68,
			(text, size) => text.length * size * 0.6
		);
		expect(spec).toEqual({ fontSize: 24, step: 1 });
	});

	it('shrinks font size and strides labels when many narrow bars would otherwise overlap', () => {
		const years = Array.from({ length: 30 }, (_, i) => String(i).padStart(2, '0'));
		const spec = denseBarLabelSpec(years, 20, (text, size) => text.length * size * 0.7);
		expect(spec.fontSize).toBe(14);
		expect(spec.step).toBeGreaterThan(1);
	});
});

describe('cardFilename', () => {
	it('names the summary poster for a year', () => {
		expect(cardFilename(2024)).toBe('2024-in-cinema.png');
	});

	it('includes the scene id for a single-frame story card', () => {
		expect(cardFilename(2024, 'streak')).toBe('2024-in-cinema-streak.png');
	});
});
