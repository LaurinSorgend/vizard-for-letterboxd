import { describe, expect, it } from 'vitest';
import { fitFont, truncateText, wrap, type Faces } from './canvas';

const measure = (text: string) => text.length * 10;

function fakeCtx(charWidth = 10): CanvasRenderingContext2D {
	let currentSize = 10;
	return {
		get font() {
			return `${currentSize}px sans-serif`;
		},
		set font(value: string) {
			const match = /(\d+(?:\.\d+)?)px/.exec(value);
			if (match) currentSize = Number(match[1]);
		},
		measureText: (text: string) => ({ width: text.length * (charWidth * (currentSize / 10)) })
	} as unknown as CanvasRenderingContext2D;
}

describe('truncateText', () => {
	it('leaves text untouched when it fits inside maxWidth', () => {
		expect(truncateText('Drama', 50, measure)).toBe('Drama');
	});

	it('clamps text with an ellipsis, trims trailing spaces before it, and stays within maxWidth', () => {
		const out = truncateText('United States of America', 70, measure);
		expect(out).toBe('United…');
		expect(measure(out)).toBeLessThanOrEqual(70);
	});

	it('returns an empty string when maxWidth cannot fit even an ellipsis', () => {
		expect(truncateText('Drama', 0, measure)).toBe('');
		expect(truncateText('Drama', -5, measure)).toBe('');
		expect(truncateText('Drama', 5, measure)).toBe('');
	});
});

describe('wrap', () => {
	it('wraps words to maxWidth and truncates the final line when maxLines is reached', () => {
		const lines = wrap(fakeCtx(10), 'one two three four five six seven', 100, 2);
		expect(lines).toHaveLength(2);
		for (const line of lines) {
			expect(line.length * 10).toBeLessThanOrEqual(100);
		}
	});
});

describe('fitFont', () => {
	const faces: Faces = { sans: 'sans-serif', mono: 'monospace', accent: 'serif' };

	it('shrinks font size until the text fits or hits floor', () => {
		const ctx = fakeCtx(10);
		const fit = fitFont(ctx, faces, '1234567890', 200, 40, 12);
		expect(fit).toBe(20);
		expect(fitFont(ctx, faces, 'a very long title that never fits', 40, 40, 12)).toBe(12);
	});
});
