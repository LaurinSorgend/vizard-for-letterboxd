import { browser } from '$app/environment';
import {
	RECORD_SCHEMA,
	type CollectionParts,
	type CustomList,
	type EnrichedFilm,
	type Profile,
	type WatchlistFilm
} from '$lib/types';

const PREFIX = 'vizard:snapshot:';
/**
 * Carries RECORD_SCHEMA, so a snapshot of old records is ignored rather than misread. A change to
 * the snapshot's own shape needs a new key too: add a suffix after the schema.
 */
const KEY = `${PREFIX}${RECORD_SCHEMA}`;

const DB_NAME = 'vizard-library';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

export type LibrarySource = 'export' | 'feed';

export interface Snapshot {
	films: EnrichedFilm[];
	watchlist: WatchlistFilm[];
	/** Omitted in older saved snapshots before custom lists were parsed. */
	lists?: CustomList[];
	profile: Profile | null;
	collections: CollectionParts[];
	source: LibrarySource;
}

function openDb(): Promise<IDBDatabase | null> {
	if (typeof indexedDB === 'undefined') return Promise.resolve(null);
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'));
	});
}

function finishTransaction(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
		tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
	});
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
	});
}

/** Drops legacy localStorage snapshots so earlier builds stop occupying the 5 MB web storage cap. */
function clearLegacyStorage(): void {
	try {
		const stale = Object.keys(localStorage).filter((key) => key.startsWith(PREFIX));
		for (const key of stale) localStorage.removeItem(key);
	} catch {
		return;
	}
}

function readLegacySnapshot(): Snapshot | null {
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as Snapshot) : null;
	} catch {
		return null;
	}
}

async function sweepOldIdbGenerations(db: IDBDatabase): Promise<void> {
	const tx = db.transaction(STORE_NAME, 'readwrite');
	const store = tx.objectStore(STORE_NAME);
	const keys = await readRequest(store.getAllKeys());
	for (const key of keys) {
		if (typeof key === 'string' && key.startsWith(PREFIX) && key !== KEY) {
			store.delete(key);
		}
	}
	await finishTransaction(tx);
}

async function writeToIdb(db: IDBDatabase, snapshot: Snapshot): Promise<void> {
	const tx = db.transaction(STORE_NAME, 'readwrite');
	tx.objectStore(STORE_NAME).put(snapshot, KEY);
	await finishTransaction(tx);
}

/** Loads the remembered snapshot from IndexedDB, migrating any legacy localStorage copy once. */
export async function loadSnapshot(): Promise<Snapshot | null> {
	if (!browser) return null;
	let db: IDBDatabase | null = null;
	try {
		db = await openDb();
		if (db) {
			await sweepOldIdbGenerations(db);
			const tx = db.transaction(STORE_NAME, 'readonly');
			const stored = (await readRequest(tx.objectStore(STORE_NAME).get(KEY))) as
				Snapshot | undefined;
			await finishTransaction(tx);
			if (stored) {
				clearLegacyStorage();
				return stored;
			}
		}
		const legacy = readLegacySnapshot();
		if (!legacy) {
			clearLegacyStorage();
			return null;
		}
		if (db) {
			await writeToIdb(db, legacy);
			clearLegacyStorage();
		}
		return legacy;
	} catch {
		return readLegacySnapshot();
	} finally {
		db?.close();
	}
}

export async function saveSnapshot(snapshot: Snapshot): Promise<boolean> {
	if (!browser) return false;
	let db: IDBDatabase | null = null;
	try {
		db = await openDb();
		if (!db) return false;
		await writeToIdb(db, snapshot);
		clearLegacyStorage();
		return true;
	} catch {
		return false;
	} finally {
		db?.close();
	}
}

export async function clearSnapshot(): Promise<void> {
	if (!browser) return;
	clearLegacyStorage();
	let db: IDBDatabase | null = null;
	try {
		db = await openDb();
		if (!db) return;
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).delete(KEY);
		await finishTransaction(tx);
	} catch {
		return;
	} finally {
		db?.close();
	}
}
