import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECORD_SCHEMA } from '$lib/types';

vi.mock('$app/environment', () => ({ browser: true }));

import { clearSnapshot, loadSnapshot, saveSnapshot, type Snapshot } from './store';

const KEY = `vizard:snapshot:${RECORD_SCHEMA}`;

function sampleSnapshot(): Snapshot {
	return {
		films: [],
		watchlist: [],
		lists: [],
		profile: { username: 'laurin', givenName: 'Laurin', dateJoined: '', location: '' },
		collections: [],
		source: 'export'
	};
}

/** Minimal in-memory IndexedDB stub that requires `onupgradeneeded` to create stores. */
function installFakeIdb(
	options: { initial?: Record<string, unknown>; failPut?: boolean; failOpen?: boolean } = {}
) {
	const stores = new Map<string, Map<string, unknown>>();
	const hasInitial = options.initial && Object.keys(options.initial).length > 0;
	if (hasInitial) {
		stores.set('snapshots', new Map(Object.entries(options.initial!)));
	}

	function makeRequest<T>(run: () => T): IDBRequest<T> {
		const req = {
			result: undefined as unknown as T,
			error: null as DOMException | null,
			onsuccess: null as ((this: IDBRequest<T>, ev: Event) => unknown) | null,
			onerror: null as ((this: IDBRequest<T>, ev: Event) => unknown) | null
		} as IDBRequest<T>;
		queueMicrotask(() => {
			try {
				(req as { result: T }).result = run();
				req.onsuccess?.call(req, new Event('success'));
			} catch (err) {
				(req as { error: DOMException }).error = err as DOMException;
				req.onerror?.call(req, new Event('error'));
			}
		});
		return req;
	}

	const db = {
		objectStoreNames: {
			contains: (name: string) => stores.has(name)
		},
		createObjectStore: (name: string) => {
			if (!stores.has(name)) stores.set(name, new Map());
		},
		close: vi.fn(),
		transaction: (name: string) => {
			const map = stores.get(name);
			if (!map) throw new DOMException(`Missing store ${name}`, 'NotFoundError');
			let failed: DOMException | null = null;
			const tx = {
				error: null as DOMException | null,
				oncomplete: null as (() => void) | null,
				onerror: null as (() => void) | null,
				onabort: null as (() => void) | null,
				objectStore: () => ({
					get: (key: string) => makeRequest(() => map.get(key)),
					getAllKeys: () => makeRequest(() => [...map.keys()]),
					put: (value: unknown, key: string) =>
						makeRequest(() => {
							if (options.failPut) {
								failed = new DOMException('Quota exceeded', 'QuotaExceededError');
								throw failed;
							}
							map.set(key, structuredClone(value));
							return key;
						}),
					delete: (key: string) =>
						makeRequest(() => {
							map.delete(key);
							return undefined;
						})
				})
			} as unknown as IDBTransaction;
			setTimeout(() => {
				if (failed) {
					(tx as { error: DOMException }).error = failed;
					tx.onerror?.(new Event('error'));
				} else {
					tx.oncomplete?.(new Event('complete'));
				}
			}, 0);
			return tx;
		}
	} as unknown as IDBDatabase;

	const factory = {
		open: () => {
			const req = {
				result: db,
				error: null as DOMException | null,
				onupgradeneeded: null as (() => void) | null,
				onsuccess: null as (() => void) | null,
				onerror: null as (() => void) | null
			};
			queueMicrotask(() => {
				if (options.failOpen) {
					req.error = new DOMException('IDB unavailable', 'SecurityError');
					req.onerror?.();
					return;
				}
				if (!hasInitial) req.onupgradeneeded?.();
				req.onsuccess?.();
			});
			return req;
		}
	} as unknown as IDBFactory;

	vi.stubGlobal('indexedDB', factory);
	return {
		keys: () => [...(stores.get('snapshots')?.keys() ?? [])]
	};
}

function installFakeLocalStorage(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	const storage = new Proxy(
		{
			getItem: (k: string) => data.get(k) ?? null,
			setItem: (k: string, v: string) => void data.set(k, v),
			removeItem: (k: string) => void data.delete(k)
		},
		{
			ownKeys: () => [...data.keys()],
			getOwnPropertyDescriptor: (_, prop) =>
				typeof prop === 'string' && data.has(prop)
					? { enumerable: true, configurable: true, value: data.get(prop) }
					: undefined
		}
	);
	vi.stubGlobal('localStorage', storage);
	return data;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('snapshot store (IndexedDB)', () => {
	it('creates the object store on upgrade and saves, loads, and clears snapshots', async () => {
		installFakeIdb();
		installFakeLocalStorage();
		const snap = sampleSnapshot();

		expect(await saveSnapshot(snap)).toBe(true);
		expect(await loadSnapshot()).toEqual(snap);

		await clearSnapshot();
		expect(await loadSnapshot()).toBeNull();
	});

	it('sweeps old schema generations from both IndexedDB and legacy localStorage on load', async () => {
		const idb = installFakeIdb({
			initial: {
				'vizard:snapshot:v1': { stale: true },
				[KEY]: sampleSnapshot()
			}
		});
		const ls = installFakeLocalStorage({
			'vizard:snapshot:v1': '{}',
			'vizard:unrelated': 'keep'
		});

		const loaded = await loadSnapshot();
		expect(loaded).toEqual(sampleSnapshot());
		expect(idb.keys()).toEqual([KEY]);
		expect(ls.has('vizard:snapshot:v1')).toBe(false);
		expect(ls.get('vizard:unrelated')).toBe('keep');
	});

	it('migrates a legacy localStorage snapshot into IndexedDB and clears localStorage', async () => {
		installFakeIdb();
		const snap = sampleSnapshot();
		const ls = installFakeLocalStorage({
			[KEY]: JSON.stringify(snap),
			'vizard:snapshot:v2': '{}'
		});

		expect(await loadSnapshot()).toEqual(snap);
		expect(ls.size).toBe(0);
		expect(await loadSnapshot()).toEqual(snap);
	});

	it('falls back to legacy localStorage when IndexedDB refuses to open and returns false on write failure', async () => {
		const snap = sampleSnapshot();
		installFakeIdb({ failOpen: true });
		installFakeLocalStorage({ [KEY]: JSON.stringify(snap) });
		expect(await loadSnapshot()).toEqual(snap);

		installFakeIdb({ failPut: true });
		installFakeLocalStorage();
		expect(await saveSnapshot(snap)).toBe(false);
	});
});
