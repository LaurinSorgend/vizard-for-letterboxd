import { enrichLibrary, loadExport, loadFeed, type Progress } from '$lib/ingest/pipeline';
import type { EnrichedFilm, LetterboxdData, Profile, WatchlistFilm } from '$lib/types';

type Phase = 'idle' | 'working' | 'ready';

export type FriendSource = 'export' | 'feed';

/**
 * Ephemeral reactive state for a friend's Letterboxd library loaded strictly for in-memory
 * comparison. Never reads from or writes to localStorage.
 */
export class FriendLibrary {
	phase = $state<Phase>('idle');
	progress = $state<Progress>({ stage: 'films', done: 0, total: 0 });
	error = $state<string | null>(null);
	source = $state<FriendSource>('export');
	loadingSource = $state<FriendSource>('export');
	usernameDraft = $state('');
	films = $state.raw<EnrichedFilm[]>([]);
	watchlist = $state.raw<WatchlistFilm[]>([]);
	profile = $state.raw<Profile | null>(null);
	#controller: AbortController | null = null;

	readonly displayName = $derived(this.profile?.givenName || this.profile?.username || 'Friend');

	loadFile(file: File): Promise<void> {
		return this.#load('export', async () => loadExport(new Uint8Array(await file.arrayBuffer())));
	}

	loadUsername(username: string): Promise<void> {
		this.usernameDraft = username;
		return this.#load('feed', () => loadFeed(username));
	}

	/** Aborts an in-flight load and returns to the idle picker. */
	cancel(): void {
		this.#controller?.abort();
		this.#controller = null;
		this.phase = 'idle';
		this.progress = { stage: 'films', done: 0, total: 0 };
	}

	/** Clears the loaded friend library so another friend can be compared. */
	reset(): void {
		this.#controller?.abort();
		this.#controller = null;
		this.phase = 'idle';
		this.progress = { stage: 'films', done: 0, total: 0 };
		this.error = null;
		this.films = [];
		this.watchlist = [];
		this.profile = null;
	}

	#reporter(controller: AbortController): (next: Progress) => void {
		return (next) => {
			if (controller === this.#controller) this.progress = next;
		};
	}

	async #load(source: FriendSource, load: () => Promise<LetterboxdData>): Promise<void> {
		this.#controller?.abort();
		const controller = new AbortController();
		this.#controller = controller;
		this.loadingSource = source;
		this.error = null;
		this.phase = 'working';
		this.progress = { stage: 'films', done: 0, total: 0 };
		try {
			const parsed = await load();
			if (controller !== this.#controller) return;
			const library = await enrichLibrary(
				parsed.films,
				parsed.watchlist,
				this.#reporter(controller),
				controller.signal
			);
			if (controller !== this.#controller) return;
			this.source = source;
			this.profile = parsed.profile;
			this.films = library.films;
			this.watchlist = library.watchlist;
			this.phase = 'ready';
			this.#controller = null;
		} catch (cause) {
			if (controller !== this.#controller) return;
			this.error = cause instanceof Error ? cause.message : String(cause);
			this.phase = 'idle';
			this.#controller = null;
		}
	}
}
