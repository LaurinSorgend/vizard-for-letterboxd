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

/** Minimal in-memory IndexedDB stub supporting the snapshot store operations. */
function installFakeIdb(initial: Record<string, unknown> = {}, failPut = false) {
	const stores = new Map<string, Map<string, unknown>>([
		['snapshots', new Map(Object.entries(initial))]
	]);

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
			const map = stores.get(name)!;
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
							if (failPut) {
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
				error: null,
				onupgradeneeded: null as (() => void) | null,
				onsuccess: null as (() => void) | null,
				onerror: null as (() => void) | null
			};
			queueMicrotask(() => {
				req.onupgradeneeded?.();
				req.onsuccess?.();
			});
			return req;
		}
	} as unknown as IDBFactory;

	vi.stubGlobal('indexedDB', factory);
	return stores.get('snapshots')!;
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
	it('saves, loads, and clears snapshots in IndexedDB', async () => {
		const idb = installFakeIdb();
		installFakeLocalStorage();
		const snap = sampleSnapshot();

		expect(await saveSnapshot(snap)).toBe(true);
		expect(idb.has(KEY)).toBe(true);
		expect(await loadSnapshot()).toEqual(snap);

		await clearSnapshot();
		expect(idb.has(KEY)).toBe(false);
		expect(await loadSnapshot()).toBeNull();
	});

	it('sweeps old schema generations from IndexedDB on load', async () => {
		const idb = installFakeIdb({
			'vizard:snapshot:v1': { stale: true },
			[KEY]: sampleSnapshot()
		});
		installFakeLocalStorage({ 'vizard:snapshot:v1': '{}' });

		const loaded = await loadSnapshot();
		expect(loaded).toEqual(sampleSnapshot());
		expect(idb.has('vizard:snapshot:v1')).toBe(false);
		expect(idb.has(KEY)).toBe(true);
	});

	it('migrates a legacy localStorage snapshot into IndexedDB and clears localStorage', async () => {
		const idb = installFakeIdb();
		const snap = sampleSnapshot();
		const ls = installFakeLocalStorage({
			[KEY]: JSON.stringify(snap),
			'vizard:snapshot:v2': '{}'
		});

		const loaded = await loadSnapshot();
		expect(loaded).toEqual(snap);
		expect(idb.get(KEY)).toEqual(snap);
		expect(ls.size).toBe(0);
	});

	it('returns false when IndexedDB refuses a write', async () => {
		installFakeIdb({}, true);
		installFakeLocalStorage();
		expect(await saveSnapshot(sampleSnapshot())).toBe(false);
	});
});
