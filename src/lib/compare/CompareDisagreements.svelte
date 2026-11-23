<script lang="ts">
	import { webHref } from '$lib/film/links';
	import { fixed, starCaption } from '$lib/format';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import type { MutualFavourite, RatingDisagreement } from './compare';

	const PAGE_SIZE = 15;

	let {
		disagreements,
		mutualFavourites,
		yourName,
		friendName
	}: {
		disagreements: RatingDisagreement[];
		mutualFavourites: MutualFavourite[];
		yourName: string;
		friendName: string;
	} = $props();

	let tab = $state<'disagreements' | 'favourites'>('disagreements');
	let showAllDisagreements = $state(false);
	let showAllFavourites = $state(false);

	const visibleDisagreements = $derived(
		showAllDisagreements ? disagreements : disagreements.slice(0, PAGE_SIZE)
	);
	const visibleFavourites = $derived(
		showAllFavourites ? mutualFavourites : mutualFavourites.slice(0, PAGE_SIZE)
	);

	function pct(rating: number): number {
		return Math.max(0, Math.min(100, (rating / 5) * 100));
	}

	function signedGap(diff: number): string {
		const sign = diff > 0 ? '+' : '';
		return `${sign}${fixed(diff, 1)}`;
	}
</script>

<section class="compare-block" aria-labelledby="compare-ratings-heading">
	<div class="block-head">
		<h3 id="compare-ratings-heading">Where you agree &amp; clash</h3>
		<MetricToggle
			name="compare-ratings-tab"
			label="Rating comparison view"
			options={[
				{ value: 'disagreements', label: `Biggest disagreements (${disagreements.length})` },
				{ value: 'favourites', label: `Mutual favourites (${mutualFavourites.length})` }
			]}
			bind:value={tab}
		/>
	</div>

	{#if tab === 'disagreements'}
		{#if disagreements.length === 0}
			<p class="empty">No rating gaps of 1 star or more across shared rated films.</p>
		{:else}
			<div class="legend" aria-hidden="true">
				<span class="legend-item"><span class="swatch you"></span>{yourName}</span>
				<span class="legend-item"><span class="swatch friend"></span>{friendName}</span>
				<span class="legend-note">Signed gap = {yourName} minus {friendName}</span>
			</div>

			<ol class="rows">
				{#each visibleDisagreements as row (`${row.uri}:${row.title}:${row.year}`)}
					{@const href = webHref(row.uri)}
					{@const left = pct(Math.min(row.ratingA, row.ratingB))}
					{@const width = pct(Math.max(row.ratingA, row.ratingB)) - left}
					<li class="row">
						<div class="film-cell">
							{#if href}
								<a {href} target="_blank" rel="noopener">{row.title}</a>
							{:else}
								<span>{row.title}</span>
							{/if}
							{#if row.year}
								<span class="year" data-numeric>{row.year}</span>
							{/if}
						</div>

						<div class="track-cell" aria-hidden="true">
							<div class="track">
								<span class="span" style="left: {left}%; width: {width}%;"></span>
								<span class="marker you" style="left: {pct(row.ratingA)}%;"></span>
								<span class="marker friend" style="left: {pct(row.ratingB)}%;"></span>
							</div>
						</div>

						<div class="scores">
							<span class="score" data-numeric title="{yourName}: {row.ratingA}">
								<span class="mini-swatch you" aria-hidden="true"></span>
								{fixed(row.ratingA, 1)}
							</span>
							<span class="score" data-numeric title="{friendName}: {row.ratingB}">
								<span class="mini-swatch friend" aria-hidden="true"></span>
								{fixed(row.ratingB, 1)}
							</span>
							<span class="gap" data-numeric>{signedGap(row.diff)} ★</span>
						</div>
					</li>
				{/each}
			</ol>

			{#if disagreements.length > PAGE_SIZE}
				<button
					type="button"
					class="more-btn"
					onclick={() => (showAllDisagreements = !showAllDisagreements)}
				>
					{showAllDisagreements ? `Show top ${PAGE_SIZE}` : `Show all (${disagreements.length})`}
				</button>
			{/if}
		{/if}
	{:else if mutualFavourites.length === 0}
		<p class="empty">No mutual favourites yet (films both rated 4★+ or hearted).</p>
	{:else}
		<div class="table-wrap">
			<table class="fav-table">
				<thead>
					<tr>
						<th scope="col">Film</th>
						<th scope="col" class="num">{yourName}</th>
						<th scope="col" class="num">{friendName}</th>
					</tr>
				</thead>
				<tbody>
					{#each visibleFavourites as row (`${row.uri}:${row.title}:${row.year}`)}
						{@const href = webHref(row.uri)}
						<tr>
							<td class="title-col">
								{#if href}
									<a {href} target="_blank" rel="noopener">{row.title}</a>
								{:else}
									<span>{row.title}</span>
								{/if}
								{#if row.year}
									<span class="year" data-numeric>{row.year}</span>
								{/if}
							</td>
							<td class="num" data-numeric>
								{row.ratingA !== null ? starCaption(row.ratingA) : '—'}
								{#if row.likedA}
									<span class="heart" aria-label="liked by {yourName}">♥</span>
								{/if}
							</td>
							<td class="num" data-numeric>
								{row.ratingB !== null ? starCaption(row.ratingB) : '—'}
								{#if row.likedB}
									<span class="heart" aria-label="liked by {friendName}">♥</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if mutualFavourites.length > PAGE_SIZE}
			<button
				type="button"
				class="more-btn"
				onclick={() => (showAllFavourites = !showAllFavourites)}
			>
				{showAllFavourites ? `Show top ${PAGE_SIZE}` : `Show all (${mutualFavourites.length})`}
			</button>
		{/if}
	{/if}
</section>

<style>
	.compare-block {
		margin: 0 0 32px;
		padding-top: 24px;
		border-top: 1px solid var(--border);
	}
	.block-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px 16px;
		margin-bottom: 12px;
	}
	h3 {
		margin: 0;
		color: var(--fg);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		margin-bottom: 12px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.legend-note {
		color: var(--fg-muted);
	}
	.swatch,
	.mini-swatch {
		display: inline-block;
		flex-shrink: 0;
	}
	.swatch {
		width: 10px;
		height: 10px;
	}
	.mini-swatch {
		width: 8px;
		height: 8px;
	}
	.you {
		background: var(--accent);
	}
	.friend {
		background: var(--bar);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--border);
	}
	.row {
		display: grid;
		grid-template-columns: minmax(140px, 1.4fr) minmax(100px, 1fr) auto;
		align-items: center;
		gap: 8px 16px;
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
	}
	@media (max-width: 680px) {
		.row {
			grid-template-columns: minmax(0, 1fr);
			gap: 6px;
		}
	}
	.film-cell {
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px;
	}
	.film-cell a {
		color: var(--fg);
		text-decoration: none;
	}
	.film-cell a:hover {
		color: var(--accent);
		text-decoration: underline;
	}
	.year {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.track-cell {
		padding: 0 6px;
	}
	.track {
		position: relative;
		height: 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
	}
	.span {
		position: absolute;
		top: 2px;
		bottom: 2px;
		background: var(--surface);
	}
	.marker {
		position: absolute;
		top: -1px;
		bottom: -1px;
		width: 6px;
		transform: translateX(-50%);
	}
	.scores {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: var(--text-sm);
		white-space: nowrap;
	}
	.score {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--fg);
	}
	.gap {
		min-width: 5.5ch;
		text-align: right;
		color: var(--fg-secondary);
	}
	.table-wrap {
		overflow-x: auto;
	}
	.fav-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-sans);
	}
	.fav-table th,
	.fav-table td {
		padding: 8px 10px 8px 0;
		border-bottom: 1px solid var(--border);
		text-align: left;
		font-size: var(--text-sm);
	}
	.fav-table th {
		color: var(--fg-secondary);
		font-weight: 500;
		border-bottom: 1px solid var(--border-strong);
	}
	.fav-table .num {
		text-align: right;
		white-space: nowrap;
		padding-right: 0;
		padding-left: 16px;
	}
	.title-col a {
		color: var(--fg);
		text-decoration: none;
	}
	.title-col a:hover {
		color: var(--accent);
		text-decoration: underline;
	}
	.title-col .year {
		margin-left: 6px;
	}
	.heart {
		margin-left: 4px;
		color: var(--liked);
	}
	.more-btn {
		margin-top: 12px;
		font: inherit;
		font-size: var(--text-sm);
		padding: 4px 12px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-strong);
		cursor: pointer;
	}
	.more-btn:hover {
		background: var(--surface);
	}
	.empty {
		margin: 0;
		color: var(--fg-secondary);
	}
</style>
