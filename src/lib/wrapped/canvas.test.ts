import { afterEach, describe, expect, it, vi } from 'vitest';
import { paletteFor, paletteFrom } from './canvas';

function styleOf(tokens: Record<string, string>) {
	return {
		getPropertyValue: (name: string) => tokens[name] ?? ''
	} as unknown as CSSStyleDeclaration;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('paletteFrom', () => {
	it('reads wrapped custom properties and normalises font stacks', () => {
		vi.stubGlobal('getComputedStyle', () =>
			styleOf({
				'--w-room': ' #14110c ',
				'--w-screen': '#f4eee0',
				'--w-ink': '#241f18',
				'--w-muted': '#5f5648',
				'--w-line': '#a89c88',
				'--w-stamp': '#8c8172',
				'--w-accent': '#a8480d',
				'--w-cast': 'rgba(168, 72, 13, 0.1)',
				'--font-sans': '  "Ronzino",   Arial, sans-serif ',
				'--font-mono': '"Fira Code",\nmonospace',
				'--font-accent': '"Mazius Display Extra Italic", Georgia, serif'
			})
		);

		expect(paletteFrom({} as Element)).toEqual({
			room: '#14110c',
			screen: '#f4eee0',
			ink: '#241f18',
			muted: '#5f5648',
			line: '#a89c88',
			stamp: '#8c8172',
			accent: '#a8480d',
			cast: 'rgba(168, 72, 13, 0.1)',
			faces: {
				sans: '"Ronzino", Arial, sans-serif',
				mono: '"Fira Code", monospace',
				accent: '"Mazius Display Extra Italic", Georgia, serif'
			}
		});
	});

	it('falls back to ink, transparent cast, and default faces when tokens are absent', () => {
		vi.stubGlobal('getComputedStyle', () => styleOf({ '--w-ink': '#241f18' }));

		const palette = paletteFrom({} as Element);
		expect(palette.accent).toBe('#241f18');
		expect(palette.cast).toBe('transparent');
		expect(palette.faces.sans).toContain('Ronzino');
		expect(palette.faces.mono).toContain('Fira Code');
		expect(palette.faces.accent).toContain('Mazius Display Extra Italic');
	});
});

describe('paletteFor', () => {
	it('mounts a neutral probe, reads its tokens while attached, and cleans it up', () => {
		const appended: unknown[] = [];
		let removed = false;
		let hueSeen: string | undefined;
		let attachedWhenRead = false;

		const probe = {
			dataset: {} as Record<string, string>,
			style: { cssText: '' },
			setAttribute: vi.fn(),
			remove: vi.fn(() => {
				removed = true;
			})
		};

		vi.stubGlobal('document', {
			createElement: vi.fn(() => probe),
			body: {
				append: vi.fn((node: unknown) => {
					appended.push(node);
				})
			}
		});
		vi.stubGlobal('getComputedStyle', (node: typeof probe) => {
			hueSeen = node.dataset.hue;
			attachedWhenRead = appended.includes(node) && !removed;
			return styleOf({
				'--w-room': '#14110c',
				'--w-screen': '#f4eee0',
				'--w-ink': '#241f18',
				'--w-muted': '#5f5648',
				'--w-line': '#a89c88',
				'--w-stamp': '#8c8172',
				'--w-accent': '#241f18',
				'--w-cast': 'rgba(168, 72, 13, 0.05)'
			});
		});

		const palette = paletteFor();
		expect(hueSeen).toBe('neutral');
		expect(attachedWhenRead).toBe(true);
		expect(removed).toBe(true);
		expect(palette.cast).toBe('rgba(168, 72, 13, 0.05)');
	});

	it('removes the probe even if reading computed styles throws', () => {
		const probe = {
			dataset: {} as Record<string, string>,
			style: { cssText: '' },
			setAttribute: vi.fn(),
			remove: vi.fn()
		};

		vi.stubGlobal('document', {
			createElement: vi.fn(() => probe),
			body: { append: vi.fn() }
		});
		vi.stubGlobal('getComputedStyle', () => {
			throw new Error('style unavailable');
		});

		expect(() => paletteFor('amber')).toThrow('style unavailable');
		expect(probe.dataset.hue).toBe('amber');
		expect(probe.remove).toHaveBeenCalledTimes(1);
	});
});
