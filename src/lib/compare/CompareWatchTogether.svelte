<script lang="ts">
	import { imageUrl, webHref } from '$lib/film/links';
	import { starCaption } from '$lib/format';
	import PosterGrid from '$lib/posters/PosterGrid.svelte';
	import { FAVOURITE_RATING } from '$lib/recommend/taste';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import type { WatchRecommendation, WatchTogether, WatchTogetherItem } from './compare';

	const PAGE = 48;

	let {
		watchTogether,
		yourName,
		friendName,
		friendFromFeed = false,
		yourWatchlistCount = 0
	}: {
		watchTogether: WatchTogether;
		yourName: string;
		friendName: string;
		friendFromFeed?: boolean;
		yourWatchlistCount?: number;
	} = $props();

	type Tab = 'mutual' | 'friend' | 'you';

	let chosenTab = $state<Tab | null>(null);
	let pickedKey = $state<string | null>(null);

	const tab = $derived<Tab>(
		chosenTab ??
			(friendFromFeed &&
			watchTogether.mutualWatchlist.length === 0 &&
			watchTogether.friendRecommends.length > 0
				? 'friend'
				: 'mutual')
	);

	const picked = $derived(
		watchTogether.mutualWatchlist.find((item) => item.key === pickedKey) ?? null
	);

	function pickRandom(): void {
		const list = watchTogether.mutualWatchlist;
		if (list.length === 0) return;
		const pool = list.length > 1 ? list.filter((item) => item.key !== pickedKey) : list;
		pickedKey = pool[Math.floor(Math.random() * pool.length)]?.key ?? null;
	}

	const posterSrc = (item: { posterPath: string | null }): string | null =>
		imageUrl(item.posterPath, 'w185');

	function mutualLabel(item: WatchTogetherItem): string {
		return `${item.name}${item.year ? ` (${item.year})` : ''}`;
	}

	function recLabel(item: WatchRecommendation, who: string): string {
		const year = item.year ? ` (${item.year})` : '';
		const rating = item.rating !== null ? `, ${who} rated ${item.rating} stars` : '';
		const liked = item.liked ? `, ${who} liked` : '';
		return `${item.name}${year}${rating}${liked}`;
	}
</script>

{#snippet recommendationTab(
	items: WatchRecommendation[],
	targetName: string,
	recommenderName: string,
	emptyMessage: string
)}
	<p class="desc">
		Films on {targetName}'s watchlist that {recommenderName} already watched and loved ({FAVOURITE_RATING}★+
		or hearted).
	</p>
	{#if items.length === 0}
		<p class="empty">{emptyMessage}</p>
	{:else}
		<PosterGrid
			films={items}
			page={PAGE}
			key={(item) => item.key}
			poster={posterSrc}
			label={(item) => recLabel(item, recommenderName)}
		>
			{#snippet overlay(item)}
				<span class="badge" data-numeric aria-hidden="true">
					{#if item.rating !== null}{starCaption(item.rating)}{/if}
					{#if item.liked}<span class="heart">♥</span>{/if}
				</span>
			{/snippet}
		</PosterGrid>
	{/if}
{/snippet}

<section class="compare-block" aria-labelledby="compare-watch-heading">
	<div class="block-head">
		<h3 id="compare-watch-heading">Watch together</h3>
		<MetricToggle
			name="compare-watch-tab"
			label="Watch together lists"
			options={[
				{ value: 'mutual', label: `On both watchlists (${watchTogether.mutualWatchlist.length})` },
				{
					value: 'friend',
					label: `${friendName} recommends (${watchTogether.friendRecommends.length})`
				},
				{ value: 'you', label: `${yourName} recommends (${watchTogether.youRecommend.length})` }
			]}
			bind:value={() => tab, (next) => (chosenTab = next)}
		/>
	</div>

	{#if tab === 'mutual'}
		<p class="desc">Films on both watchlists that neither of you has watched yet.</p>

		{#if watchTogether.mutualWatchlist.length === 0}
			<p class="empty">
				{#if friendFromFeed}
					{friendName} was loaded from an RSS feed, which does not include their watchlist. Load their
					Letterboxd .zip export to find shared watchlist picks.
				{:else if yourWatchlistCount === 0}
					Your loaded library has no watchlist. Upload your Letterboxd .zip export to intersect
					watchlists.
				{:else}
					No unwatched films appear on both watchlists.
				{/if}
			</p>
		{:else}
			<div class="pick-bar">
				<button type="button" class="action-btn" onclick={pickRandom}>
					{picked ? 'Pick another at random' : 'Pick one at random'}
				</button>
			</div>

			{#if picked}
				{@const poster = posterSrc(picked)}
				{@const href = webHref(picked.uri)}
				<div class="pick-card" aria-live="polite">
					{#if poster}
						<img src={poster} alt="" width="92" height="138" />
					{/if}
					<div>
						<p class="pick-title">{picked.name}</p>
						{#if picked.details}
							<p class="pick-meta">{picked.details}</p>
						{/if}
						{#if href}
							<p class="pick-link">
								<a {href} target="_blank" rel="noopener">Open on Letterboxd</a>
							</p>
						{/if}
					</div>
				</div>
			{/if}

			<PosterGrid
				films={watchTogether.mutualWatchlist}
				page={PAGE}
				key={(item) => item.key}
				poster={posterSrc}
				label={mutualLabel}
			/>
		{/if}
	{:else if tab === 'friend'}
		{@render recommendationTab(
			watchTogether.friendRecommends,
			yourName,
			friendName,
			yourWatchlistCount === 0
				? `Your loaded library has no watchlist to match against ${friendName}'s favourites.`
				: `None of ${friendName}'s favourites sit on your watchlist yet.`
		)}
	{:else}
		{@render recommendationTab(
			watchTogether.youRecommend,
			friendName,
			yourName,
			friendFromFeed
				? `${friendName} was loaded from an RSS feed, which does not include their watchlist.`
				: `None of your favourites sit on ${friendName}'s watchlist yet.`
		)}
	{/if}
</section>

<style>
	.desc {
		margin: 0 0 16px;
		color: var(--fg-secondary);
		max-width: var(--measure);
	}
	.pick-bar {
		margin-bottom: 16px;
	}
	.action-btn {
		font: inherit;
		font-size: var(--text-sm);
		padding: 6px 12px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-strong);
		cursor: pointer;
	}
	.action-btn:hover {
		background: var(--surface);
	}
	.pick-card {
		display: flex;
		gap: 16px;
		margin-bottom: 16px;
		padding: 12px;
		border: 1px solid var(--border-strong);
		background: var(--bg-secondary);
	}
	.pick-card img {
		display: block;
		flex-shrink: 0;
		object-fit: cover;
	}
	.pick-title {
		margin: 0 0 4px;
		font-size: var(--text-lg);
		color: var(--fg);
	}
	.pick-meta {
		margin: 0 0 8px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.pick-link {
		margin: 0;
		font-size: var(--text-sm);
	}
	.badge {
		position: absolute;
		left: 4px;
		bottom: 4px;
		padding: 1px 5px;
		font-size: var(--text-2xs);
		line-height: 1.4;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--border-strong);
	}
	.heart {
		margin-left: 3px;
		color: var(--liked);
	}
</style>
