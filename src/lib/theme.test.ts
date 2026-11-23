import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCENT_KEY, ACCENTS, DEFAULT_ACCENT, FLAVOR_KEY, FLAVORS } from './theme';

const read = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('app.html');
const css = read('app.css');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
const values = (options: readonly { value: string }[]) => options.map((option) => option.value);

describe('the inline theme script in app.html', () => {
	it('accepts exactly the flavours of theme.ts', () => {
		const list = script.match(/\[([^\]]*)\]\.includes\(flavor\)/)?.[1] ?? '';
		expect([...list.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual(values(FLAVORS));
	});

	it('reads the storage keys of theme.ts', () => {
		expect(script).toContain(`localStorage.getItem('${FLAVOR_KEY}')`);
		expect(script).toContain(`localStorage.getItem('${ACCENT_KEY}')`);
	});

	it('leaves the default accent unset', () => {
		expect(script).toContain(`accent !== '${DEFAULT_ACCENT}'`);
	});
});

describe('app.css', () => {
	it('styles every accent of theme.ts and no other', () => {
		const styled = [...css.matchAll(/\[data-accent='([^']+)'\]/g)].map((m) => m[1]);
		expect(new Set(styled)).toEqual(new Set(values(ACCENTS)));
	});

	it('styles only flavours theme.ts offers', () => {
		const styled = [...css.matchAll(/\[data-flavor='([^']+)'\]/g)].map((m) => m[1]);
		expect(styled.length).toBeGreaterThan(0);
		for (const flavor of styled) expect(values(FLAVORS)).toContain(flavor);
	});

	it('keeps --bar distinct from --accent and --liked for every accent', () => {
		const token = (block: string, prop: string) =>
			block.match(new RegExp(`${prop}:\\s*var\\((--ctp-[a-z0-9]+)\\)`))?.[1];
		const defaultBar = token(css, '--bar');
		const liked = token(css, '--liked');
		expect(defaultBar).toBeDefined();
		expect(defaultBar).not.toBe(liked);

		for (const { value } of ACCENTS) {
			const block =
				css.match(new RegExp(`:root\\[data-accent='${value}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';
			const accent = token(block, '--accent');
			const bar = token(block, '--bar') ?? defaultBar;
			expect(bar).not.toBe(accent);
			expect(bar).not.toBe(liked);
		}
	});
});
