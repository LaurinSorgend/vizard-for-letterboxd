<script lang="ts">
	import FileDrop from '$lib/FileDrop.svelte';
	import UsernameForm from '$lib/UsernameForm.svelte';
	import { count, plural } from '$lib/format';
	import { FEED_FILM_LIMIT } from '$lib/ingest/rss';
	import type { EnrichedFilm, WatchlistFilm } from '$lib/types';
	import CompareDisagreements from './CompareDisagreements.svelte';
	import CompareOverlap from './CompareOverlap.svelte';
	import CompareSharedTaste from './CompareSharedTaste.svelte';
	import CompareWatchTogether from './CompareWatchTogether.svelte';
	import { compareLibraries } from './compare';
	import { FriendLibrary } from './friend.svelte';

	let {
		you,
		friend = new FriendLibrary()
	}: {
		you: { name: string; films: EnrichedFilm[]; watchlist: WatchlistFilm[] };
		friend?: FriendLibrary;
	} = $props();

	const { stage, done, total } = $derived(friend.progress);

	const comparison = $derived(
		friend.phase === 'ready'
			? compareLibraries(you, {
					name: friend.displayName,
					films: friend.films,
					watchlist: friend.watchlist
				})
			: null
	);
</script>

<div class="compare">
	{#if friend.phase === 'idle'}
		<p class="intro">
			Compare your library with a friend. Drop their Letterboxd <code>.zip</code> export to compare full
			watch histories and intersect watchlists, or enter their public username to compare against their
			recent diary feed. Their library stays in memory for this visit only.
		</p>

		{#if friend.error}
			<p class="error" role="alert">{friend.error}</p>
		{/if}

		<FileDrop onfile={(file) => friend.loadFile(file)} />
		<UsernameForm
			bind:value={friend.usernameDraft}
			onsubmit={(username) => friend.loadUsername(username)}
		/>
	{:else if friend.phase === 'working'}
		<div class="progress" role="status">
			{#if total === 0}
				<p>
					{friend.loadingSource === 'feed'
						? "Reading friend's diary feed…"
						: "Reading friend's export…"}
				</p>
			{:else if stage === 'ratings'}
				<p>Looking up ratings… <span data-numeric>{done} / {total}</span></p>
				<progress value={done} max={total} aria-label="Friend ratings lookup progress"></progress>
			{:else}
				<p>Looking up film data… <span data-numeric>{done} / {total}</span></p>
				<progress value={done} max={total} aria-label="Friend film lookup progress"></progress>
			{/if}
			<button type="button" class="small-button cancel" onclick={() => friend.cancel()}>
				Cancel
			</button>
		</div>
	{:else if comparison}
		<div class="matchup">
			<div>
				<h3 class="vs">{you.name} vs {friend.displayName}</h3>
				<p class="counts">
					<span data-numeric>{plural(you.films.length, 'film')}</span> vs
					<span data-numeric>{plural(friend.films.length, 'film')}</span>
				</p>
			</div>
			<button type="button" class="small-button" onclick={() => friend.reset()}>
				Compare with someone else
			</button>
		</div>

		{#if friend.source === 'feed'}
			<p class="feed-note" role="status">
				Loaded {friend.displayName}'s <span data-numeric>{count(FEED_FILM_LIMIT)}</span> latest
				diary entries via RSS. Drop their Letterboxd <code>.zip</code> export for full history and mutual
				watchlist picks.
			</p>
		{/if}

		<CompareOverlap
			overlap={comparison.overlap}
			yourName={you.name}
			friendName={friend.displayName}
		/>

		<CompareDisagreements
			disagreements={comparison.disagreements}
			mutualFavourites={comparison.mutualFavourites}
			yourName={you.name}
			friendName={friend.displayName}
		/>

		<CompareSharedTaste
			sharedDirectors={comparison.sharedDirectors}
			sharedGenres={comparison.sharedGenres}
			yourName={you.name}
			friendName={friend.displayName}
		/>

		<CompareWatchTogether
			watchTogether={comparison.watchTogether}
			yourName={you.name}
			friendName={friend.displayName}
			friendFromFeed={friend.source === 'feed'}
			yourWatchlistCount={you.watchlist.length}
		/>
	{/if}
</div>

<style>
	.compare {
		margin-top: 8px;
	}
	.intro {
		margin: 0 0 20px;
		max-width: var(--measure);
		color: var(--fg-secondary);
	}
	.error {
		padding: 8px 12px;
		margin: 0 0 16px;
		background: color-mix(in srgb, var(--error) 12%, transparent);
		color: var(--error);
	}
	.progress {
		text-align: center;
		padding: 48px 0;
	}
	progress {
		width: min(400px, 100%);
		accent-color: var(--accent);
	}
	.small-button {
		font: inherit;
		font-size: var(--text-sm);
		padding: 4px 10px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-strong);
		cursor: pointer;
	}
	.small-button:hover {
		background: var(--surface);
	}
	.cancel {
		display: block;
		margin: 16px auto 0;
	}
	.matchup {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px 16px;
		padding: 12px 0 16px;
		margin-bottom: 24px;
		border-bottom: 1px solid var(--border-strong);
	}
	.vs {
		margin: 0;
		color: var(--fg);
	}
	.counts {
		margin: 4px 0 0;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.feed-note {
		margin: 0 0 24px;
		padding: 8px 12px;
		border: 1px solid var(--border);
		background: var(--bg-secondary);
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
</style>
