import { createContext } from 'svelte';
import { fetchFeed } from '$lib/api/endpoints';
import { noun } from '$lib/format';
import { LoadRunner, type LoadPhase } from '$lib/ingest/loader.svelte';
import {
	applyTmdbOverrides,
	collectionsFor,
	enrichLibrary,
	loadExport,
	loadFeed,
	refreshFromFeed,
	resolveTmdbOverride,
	type Progress
} from '$lib/ingest/pipeline';
import { FEED_FILM_LIMIT } from '$lib/ingest/rss';
import {
	loadOverrides,
	removeOverride,
	sameSubject,
	saveOverride,
	type OverrideMap,
	type OverrideSubject
} from '$lib/overrides';
import { excludedIds } from '$lib/recommend/recommend';
import { clearSnapshot, loadSnapshot, saveSnapshot, type LibrarySource } from '$lib/store';
import type {
	CollectionParts,
	CustomList,
	EnrichedFilm,
	LetterboxdData,
	OmdbRatings,
	Profile,
	TmdbMovie,
	TmdbRef,
	WatchlistFilm
} from '$lib/types';

const FEED_ONLY_NOTE = `Only your ${FEED_FILM_LIMIT} latest diary entries.`;

/** Share of unmatched films above which the TMDB lookup counts as failed. */
export const LOOKUP_FAILURE_SHARE = 0.5;

/**
 * The library this visit works on: how it was loaded, the analysed films and watchlist, and
 * whether it is remembered on this device. A load or a feed top-up sets the films through
 * `#setFilms`, which refreshes franchise parts and then saves.
 */
export class Library {
	#loader = new LoadRunner();
	films = $state.raw<EnrichedFilm[]>([]);
	watchlist = $state.raw<WatchlistFilm[]>([]);
	lists = $state.raw<CustomList[]>([]);
	collections = $state.raw<CollectionParts[]>([]);
	profile = $state.raw<Profile | null>(null);
	source = $state<LibrarySource>('export');
	remember = $state(false);
	saveError = $state<string | null>(null);
	feedNote = $state<string | null>(null);
	/** The feed starts after the last known viewing, so only a fresh export fills the gap. */
	feedGap = $state(false);
	includeWatchlist = $state(false);
	overrides = $state.raw<OverrideMap>(loadOverrides());
	/** Incremented whenever a different library is loaded or restored, so views reset transient state. */
	loadId = $state(0);
	#saveSeq = 0;

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

	readonly lookupFailed = $derived(
		this.films.length > 0 &&
			this.films.filter((f) => !f.tmdb).length / this.films.length > LOOKUP_FAILURE_SHARE
	);
	readonly canResume = $derived(this.films.length > 0);
	readonly recommendExclude = $derived(excludedIds(this, this.includeWatchlist));
	/** A feed-only library, or one with a gap the feed cannot fill, is completed by an export. */
	readonly offersExport = $derived(this.source === 'feed' || this.feedGap);
	readonly displayName = $derived(this.profile?.givenName || this.profile?.username || null);

	loadFile(file: File): Promise<void> {
		return this.#analyse('export', async () =>
			loadExport(new Uint8Array(await file.arrayBuffer()))
		);
	}

	loadUsername(username: string): Promise<void> {
		this.usernameDraft = username;
		return this.#analyse('feed', () => loadFeed(username));
	}

	/** Restores a remembered library, upgrades any legacy collections, then tops up from the feed. */
	async restore(): Promise<void> {
		const snapshot = await loadSnapshot();
		if (!snapshot || this.#loader.phase !== 'idle') return;
		this.films = snapshot.films;
		this.watchlist = snapshot.watchlist;
		this.lists = snapshot.lists ?? [];
		this.collections = snapshot.collections;
		this.profile = snapshot.profile;
		this.source = snapshot.source;
		this.remember = true;
		this.loadId += 1;
		this.#loader.phase = 'ready';
		void this.#postRestore();
	}

	async #postRestore(): Promise<void> {
		await this.#refreshMissingCollectionParts();
		await this.#syncFeed();
	}

	/**
	 * Upgrades restored collections saved before franchise `parts` stubs were stored. The result
	 * is dropped if the films changed meanwhile (a new load, an override, a feed top-up).
	 */
	async #refreshMissingCollectionParts(): Promise<void> {
		const base = this.films;
		try {
			const { collections, updated } = await collectionsFor(base, this.collections);
			if (!updated || this.films !== base) return;
			this.collections = collections;
			if (this.remember) await this.#persist();
		} catch {
			return;
		}
	}

	startOver(): void {
		this.#loader.phase = 'idle';
	}

	/** Tops up from the feed; skipped if the films changed while the feed was fetched. */
	async #syncFeed(): Promise<void> {
		const username = this.profile?.username;
		if (!username) return;
		const base = this.films;
		try {
			const refresh = await refreshFromFeed(base, await fetchFeed(username), this.overrides);
			if (this.films !== base) return;
			this.feedGap = refresh.gap;
			this.feedNote = refresh.gap
				? 'Some diary entries are missing.'
				: this.source === 'feed'
					? FEED_ONLY_NOTE
					: null;
			if (refresh.addedEntries === 0) return;
			await this.#setFilms(refresh.films, this.collections);
			if (!refresh.gap) this.feedNote = this.#entriesNote(refresh.addedEntries);
		} catch {
			if (this.films === base) this.feedNote = 'Could not check for new diary entries.';
		}
	}

	setRemember(on: boolean): void {
		this.remember = on;
		if (on) void this.#persist();
		else {
			this.#saveSeq += 1;
			void clearSnapshot();
			this.saveError = null;
		}
	}

	#entriesNote(count: number): string {
		const added = `${count} new diary ${noun(count, 'entry', 'entries')}.`;
		return this.source === 'feed' ? `${added} ${FEED_ONLY_NOTE}` : added;
	}

	cancel(): void {
		this.#loader.cancel();
	}

	resume(): void {
		if (this.films.length > 0) this.#loader.phase = 'ready';
	}

	async retryLookup(): Promise<void> {
		const missing = this.films.filter((f) => !f.tmdb);
		const missingWatch = this.watchlist.filter((f) => !f.tmdb);
		const controller = this.#loader.begin('ready');
		await this.#mergeLookup(controller, missing, missingWatch).catch(() => {});
		this.#loader.finish(controller, 'ready');
	}

	async #mergeLookup(
		controller: AbortController,
		missing: EnrichedFilm[],
		missingWatch: WatchlistFilm[]
	): Promise<void> {
		const found = await enrichLibrary(
			missing,
			missingWatch,
			this.#loader.reporter(controller),
			controller.signal
		);
		if (!this.#loader.isCurrent(controller)) return;
		const resolved = await applyTmdbOverrides(
			found.films,
			found.watchlist,
			this.overrides,
			controller.signal
		);
		if (!this.#loader.isCurrent(controller)) return;
		const filmMap = new Map(missing.map((f, i) => [f, resolved.films[i]]));
		const watchMap = new Map(missingWatch.map((f, i) => [f, resolved.watchlist[i]]));
		this.watchlist = this.watchlist.map((f) => watchMap.get(f) ?? f);
		await this.#setFilms(
			this.films.map((f) => filmMap.get(f) ?? f),
			this.collections
		);
	}

	/** Persists a local TMDB override only after TMDB confirms the record exists. */
	async setTmdbOverride(
		subject: OverrideSubject,
		target: TmdbRef
	): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
		const result = await resolveTmdbOverride(target);
		if (!result.ok) return result;
		this.overrides = saveOverride(this.overrides, subject, target);
		await this.#applyLocalOverride(subject, result.record, result.omdb);
		return { ok: true, title: result.record.title };
	}

	/** Removes a saved local TMDB override, returning the film to unmatched until retried. */
	async clearTmdbOverride(subject: OverrideSubject): Promise<void> {
		this.overrides = removeOverride(this.overrides, subject);
		await this.#applyLocalOverride(subject, null, null);
	}

	async #applyLocalOverride(
		subject: OverrideSubject,
		tmdb: TmdbMovie | null,
		omdb: OmdbRatings | null
	): Promise<void> {
		this.watchlist = this.watchlist.map((item) =>
			sameSubject(item, subject) ? { ...item, tmdb } : item
		);
		await this.#setFilms(
			this.films.map((film) => (sameSubject(film, subject) ? { ...film, tmdb, omdb } : film)),
			this.collections
		);
	}

	async #analyse(source: LibrarySource, load: () => Promise<LetterboxdData>): Promise<void> {
		const controller = this.#loader.begin('idle', source);
		this.feedNote = null;
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
			const resolved = await applyTmdbOverrides(
				library.films,
				library.watchlist,
				this.overrides,
				controller.signal
			);
			if (!this.#loader.isCurrent(controller)) return;
			this.source = source;
			this.profile = parsed.profile;
			this.lists = parsed.lists;
			this.watchlist = resolved.watchlist;
			this.loadId += 1;
			await this.#setFilms(resolved.films);
			if (!this.#loader.isCurrent(controller)) return;
			if (source === 'feed') this.feedNote = FEED_ONLY_NOTE;
			this.#loader.finish(controller, 'ready');
		} catch (cause) {
			this.#loader.fail(controller, cause);
		}
	}

	async #setFilms(films: EnrichedFilm[], knownCollections: CollectionParts[] = []): Promise<void> {
		this.films = films;
		const { collections } = await collectionsFor(films, knownCollections);
		if (this.films !== films) return;
		this.collections = collections;
		if (this.remember) await this.#persist();
	}

	/** Saves the snapshot; if "remember" was switched off mid-save, clears it again afterwards. */
	async #persist(): Promise<void> {
		const seq = ++this.#saveSeq;
		const { films, watchlist, lists, profile, collections, source } = this;
		const saved = await saveSnapshot({ films, watchlist, lists, profile, collections, source });
		if (!this.remember) {
			if (saved) await clearSnapshot();
			return;
		}
		if (seq !== this.#saveSeq) return;
		if (saved) {
			this.saveError = null;
		} else {
			await clearSnapshot();
			this.remember = false;
			this.saveError = 'Could not save to browser storage. Data stays for this visit only.';
		}
	}
}

export const [getLibrary, setLibrary] = createContext<Library>();
