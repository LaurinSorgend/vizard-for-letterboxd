<script lang="ts">
	import { tmdbUrl } from '$lib/film/links';
	import { noun } from '$lib/format';
	import { getLibrary } from '$lib/library.svelte';
	import { formatTmdbOverride, getOverride, parseTmdbOverride } from '$lib/overrides';
	import FilmLink from '$lib/viz/chart/FilmLink.svelte';

	const library = getLibrary();
	const unmatched = $derived(library.films.filter((f) => !f.tmdb));
	const unmatchedWatchlistCount = $derived(library.watchlist.filter((f) => !f.tmdb).length);
	const overriddenFilms = $derived.by(() =>
		library.films
			.map((film) => {
				const override = getOverride(library.overrides, film.uri);
				return override ? { film, override } : null;
			})
			.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
	);

	let editingUri = $state<string | null>(null);
	let draft = $state('');
	let submittingUri = $state<string | null>(null);
	let rowError = $state<string | null>(null);
	let statusMessage = $state<string | null>(null);
	let submitSeq = 0;

	function toggleEditor(uri: string) {
		if (editingUri === uri) {
			closeEditor();
			return;
		}
		editingUri = uri;
		draft = '';
		rowError = null;
		statusMessage = null;
	}

	function closeEditor() {
		editingUri = null;
		draft = '';
		rowError = null;
	}

	async function submitOverride(uri: string, event: SubmitEvent) {
		event.preventDefault();
		const target = parseTmdbOverride(draft);
		if (!target) {
			rowError = 'Enter a TMDB ID (e.g. 550) or URL (themoviedb.org/movie/… or /tv/…).';
			return;
		}
		const seq = ++submitSeq;
		submittingUri = uri;
		rowError = null;
		statusMessage = null;
		try {
			const result = await library.setTmdbOverride(uri, target);
			if (seq !== submitSeq) return;
			if (!result.ok) {
				if (editingUri === uri) rowError = result.error;
				return;
			}
			if (editingUri === uri) closeEditor();
			statusMessage = `Matched to "${result.title}" (${formatTmdbOverride(target)}).`;
		} catch (cause) {
			if (seq === submitSeq && editingUri === uri) {
				rowError = cause instanceof Error ? cause.message : 'Could not save override.';
			}
		} finally {
			if (seq === submitSeq) submittingUri = null;
		}
	}

	async function removeSavedOverride(uri: string, name: string) {
		statusMessage = null;
		try {
			await library.clearTmdbOverride(uri);
			statusMessage = `Removed local TMDB override for "${name}".`;
		} catch (cause) {
			statusMessage = cause instanceof Error ? cause.message : 'Could not remove override.';
		}
	}
</script>

{#if unmatched.length > 0 || overriddenFilms.length > 0}
	<details class="unmatched">
		<summary>
			{#if unmatched.length > 0}
				<span data-numeric>{unmatched.length}</span>
				{noun(unmatched.length, 'film')} could not be matched on TMDB{#if overriddenFilms.length > 0}{' '}·
					<span data-numeric>{overriddenFilms.length}</span> manual
					{noun(overriddenFilms.length, 'match', 'matches')}{/if}
			{:else}
				<span data-numeric>{overriddenFilms.length}</span> manual TMDB
				{noun(overriddenFilms.length, 'match', 'matches')}
			{/if}
		</summary>

		<div class="body">
			{#if statusMessage}
				<p class="status" role="status">{statusMessage}</p>
			{/if}

			{#if unmatched.length > 0}
				<div class="toolbar">
					<p class="hint">
						Open a title on Letterboxd to check its TMDB link, retry lookup, or set a TMDB ID
						locally.
					</p>
					<button type="button" class="action" onclick={() => library.retryLookup()}>
						Retry unmatched{#if unmatchedWatchlistCount > 0}{' '}(+{unmatchedWatchlistCount} watchlist){/if}
					</button>
				</div>

				<ul class="film-rows">
					{#each unmatched as film (film.uri)}
						{@const isEditing = editingUri === film.uri}
						{@const isBusy = submittingUri === film.uri}
						<li class="film-row">
							<div class="row-main">
								<span class="title-wrap">
									<FilmLink {film} />
									<span class="year" data-numeric>({film.year ?? 'unknown year'})</span>
								</span>
								<button
									type="button"
									class="row-btn"
									aria-expanded={isEditing}
									onclick={() => toggleEditor(film.uri)}
								>
									{isEditing ? 'Close' : 'Set TMDB ID'}
								</button>
							</div>

							{#if isEditing}
								<form class="override-form" onsubmit={(e) => submitOverride(film.uri, e)}>
									<label class="sr-only" for="tmdb-override-input">TMDB ID or URL</label>
									<input
										id="tmdb-override-input"
										type="text"
										bind:value={draft}
										placeholder="TMDB ID or URL (e.g. 550 or tv/1399)"
										disabled={isBusy}
										autocomplete="off"
									/>
									<button type="submit" class="action" disabled={isBusy}>
										{isBusy ? 'Matching…' : 'Match'}
									</button>
									<button type="button" class="row-btn" onclick={closeEditor} disabled={isBusy}>
										Cancel
									</button>
								</form>
								{#if rowError}
									<p class="error" role="alert">{rowError}</p>
								{/if}
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			{#if overriddenFilms.length > 0}
				<div class="overrides">
					<h3>Manual TMDB matches (saved on this device)</h3>
					<ul class="override-rows">
						{#each overriddenFilms as { film, override } (film.uri)}
							<li>
								<span class="title-wrap">
									<FilmLink {film} />
									<span class="arrow" aria-hidden="true">→</span>
									<a
										href={tmdbUrl(override)}
										target="_blank"
										rel="noopener"
										class="tmdb-ref"
										data-numeric
									>
										{formatTmdbOverride(override)}
									</a>
									{#if film.tmdb && film.tmdb.title !== film.name}
										<span class="matched-title">({film.tmdb.title})</span>
									{/if}
								</span>
								<button
									type="button"
									class="row-btn"
									onclick={() => removeSavedOverride(film.uri, film.name)}
								>
									Remove
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</details>
{/if}

<style>
	.unmatched {
		margin-top: 24px;
		border-top: 1px solid var(--border);
		padding-top: 12px;
	}
	summary {
		cursor: pointer;
		color: var(--fg-secondary);
		font-size: var(--text-sm);
		min-height: 24px;
	}
	summary:hover {
		color: var(--fg);
	}
	.body {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
	}
	.hint {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.status {
		margin: 0;
		padding: 6px 10px;
		font-size: var(--text-sm);
		color: var(--fg);
		background: var(--bg-secondary);
		border-left: 2px solid var(--accent);
	}
	.action,
	.row-btn {
		font: inherit;
		font-size: var(--text-xs);
		min-height: 28px;
		padding: 4px 10px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-strong);
		cursor: pointer;
		white-space: nowrap;
	}
	.row-btn {
		background: transparent;
		border-color: var(--border);
		color: var(--fg-secondary);
	}
	.action:hover:not(:disabled),
	.row-btn:hover:not(:disabled) {
		background: var(--surface);
		color: var(--fg);
	}
	.action:disabled,
	.row-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.action:focus-visible,
	.row-btn:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.film-rows,
	.override-rows {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--border);
	}
	.film-row,
	.override-rows li {
		padding: 6px 0;
		border-bottom: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.row-main,
	.override-rows li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 6px 12px;
	}
	.title-wrap {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 6px;
		min-width: 0;
	}
	.title-wrap :global(a) {
		color: var(--accent);
		text-decoration: none;
	}
	.title-wrap :global(a:hover) {
		text-decoration: underline;
	}
	.year,
	.arrow,
	.matched-title {
		color: var(--fg-muted);
	}
	.tmdb-ref {
		font-size: var(--text-xs);
	}
	.override-form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}
	.override-form input {
		flex: 1 1 240px;
		min-height: 28px;
		padding: 4px 8px;
		font: inherit;
		font-size: var(--text-sm);
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--border-strong);
	}
	.error {
		margin: 6px 0 0;
		font-size: var(--text-xs);
		color: var(--error);
	}
	.overrides h3 {
		margin: 8px 0 6px;
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--fg-secondary);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
