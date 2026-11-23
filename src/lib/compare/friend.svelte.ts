import { LoadRunner, type LoadPhase } from '$lib/ingest/loader.svelte';
import { enrichLibrary, loadExport, loadFeed, type Progress } from '$lib/ingest/pipeline';
import { FEED_FILM_LIMIT } from '$lib/ingest/rss';
import type { LibrarySource } from '$lib/store';
import type { EnrichedFilm, LetterboxdData, Profile, WatchlistFilm } from '$lib/types';

/** Ephemeral in-memory friend library for comparison; never persisted to browser storage. */
export class FriendLibrary {
	#loader = new LoadRunner();
	source = $state<LibrarySource>('export');
	films = $state.raw<EnrichedFilm[]>([]);
	watchlist = $state.raw<WatchlistFilm[]>([]);
	profile = $state.raw<Profile | null>(null);

	get phase(): LoadPhase {
		return this.#loader.phase;
	}
	get progress(): Progress {
		return this.#loader.progress;
	}
	get error(): string | null {
		return this.#loader.error;
	}
	get loadingSource(): LibrarySource {
		return this.#loader.loadingSource;
	}
	get usernameDraft(): string {
		return this.#loader.usernameDraft;
	}
	set usernameDraft(value: string) {
		this.#loader.usernameDraft = value;
	}

	readonly displayName = $derived(this.profile?.givenName || this.profile?.username || 'Friend');
	readonly feedNote = $derived(
		this.source === 'feed'
			? `Loaded up to ${FEED_FILM_LIMIT} of ${this.displayName}'s latest diary entries via RSS. Drop their Letterboxd .zip export for full history and mutual watchlist picks.`
			: null
	);

	loadFile(file: File): Promise<void> {
		return this.#load('export', async () => loadExport(new Uint8Array(await file.arrayBuffer())));
	}

	loadUsername(username: string): Promise<void> {
		this.usernameDraft = username;
		return this.#load('feed', () => loadFeed(username));
	}

	cancel(): void {
		this.#loader.cancel();
	}

	reset(): void {
		this.#loader.reset();
		this.films = [];
		this.watchlist = [];
		this.profile = null;
	}

	async #load(source: LibrarySource, load: () => Promise<LetterboxdData>): Promise<void> {
		const controller = this.#loader.begin('idle', source);
		try {
			const parsed = await load();
			if (!this.#loader.isCurrent(controller)) return;
			const library = await enrichLibrary(
				parsed.films,
				parsed.watchlist,
				this.#loader.reporter(controller),
				controller.signal
			);
			if (!this.#loader.isCurrent(controller)) return;
			this.source = source;
			this.profile = parsed.profile;
			this.films = library.films;
			this.watchlist = library.watchlist;
			this.#loader.finish(controller, 'ready');
		} catch (cause) {
			this.#loader.fail(controller, cause);
		}
	}
}
