<script lang="ts">
	import FileDrop from '$lib/FileDrop.svelte';
	import LoadProgress from '$lib/LoadProgress.svelte';
	import UsernameForm from '$lib/UsernameForm.svelte';
	import { plural } from '$lib/format';
	import CompareDisagreements from './CompareDisagreements.svelte';
	import CompareOverlap from './CompareOverlap.svelte';
	import CompareSharedTaste from './CompareSharedTaste.svelte';
	import CompareWatchTogether from './CompareWatchTogether.svelte';
	import { compareLibraries, type LibraryInput } from './compare';
	import type { FriendLibrary } from './friend.svelte';
	import './compare.css';

	let {
		you,
		yourName,
		friend
	}: {
		you: LibraryInput;
		yourName: string;
		friend: FriendLibrary;
	} = $props();

	const comparison = $derived(
		friend.phase === 'ready'
			? compareLibraries(you, {
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
		<LoadProgress
			progress={friend.progress}
			source={friend.loadingSource}
			subject="friend's"
			labelPrefix="Friend"
			oncancel={() => friend.cancel()}
		/>
	{:else if comparison}
		<div class="matchup">
			<div>
				<h3 class="vs">{yourName} vs {friend.displayName}</h3>
				<p class="counts">
					<span data-numeric>{plural(comparison.overlap.yourCount, 'film')}</span> vs
					<span data-numeric>{plural(comparison.overlap.friendCount, 'film')}</span>
				</p>
			</div>
			<button type="button" class="small-button" onclick={() => friend.reset()}>
				Compare with someone else
			</button>
		</div>

		{#if friend.feedNote}
			<p class="feed-note" role="status">{friend.feedNote}</p>
		{/if}

		<CompareOverlap overlap={comparison.overlap} {yourName} friendName={friend.displayName} />

		<CompareDisagreements
			disagreements={comparison.disagreements}
			mutualFavourites={comparison.mutualFavourites}
			{yourName}
			friendName={friend.displayName}
		/>

		<CompareSharedTaste
			sharedDirectors={comparison.sharedDirectors}
			sharedGenres={comparison.sharedGenres}
			{yourName}
			friendName={friend.displayName}
		/>

		<CompareWatchTogether
			watchTogether={comparison.watchTogether}
			{yourName}
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
