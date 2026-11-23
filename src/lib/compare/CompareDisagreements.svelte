<script lang="ts">
	import { fixed, starCaption } from '$lib/format';
	import { clamp } from '$lib/random';
	import { FAVOURITE_RATING } from '$lib/recommend/taste';
	import FilmLink from '$lib/viz/chart/FilmLink.svelte';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import ShowMore from '$lib/viz/ShowMore.svelte';
	import { pager } from '$lib/viz/pager.svelte';
	import { MIN_DISAGREEMENT_DIFF, type MutualFavourite, type RatingDisagreement } from './compare';

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

	const disagreementPager = pager(
		() => disagreements.length,
		() => PAGE_SIZE
	);
	const favouritePager = pager(
		() => mutualFavourites.length,
		() => PAGE_SIZE
	);

	const visibleDisagreements = $derived(disagreements.slice(0, disagreementPager.shown));
	const visibleFavourites = $derived(mutualFavourites.slice(0, favouritePager.shown));

	const pct = (rating: number): number => clamp((rating / 5) * 100, 0, 100);

	function signedGap(diff: number): string {
		return `${diff > 0 ? '+' : ''}${fixed(diff, 1)}`;
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
			<p class="empty">
				No rating gaps of {MIN_DISAGREEMENT_DIFF} star or more across shared rated films.
			</p>
		{:else}
			<div class="legend" aria-hidden="true">
				<span class="legend-item"><span class="swatch you"></span>{yourName}</span>
				<span class="legend-item"><span class="swatch friend"></span>{friendName}</span>
				<span class="legend-note">Signed gap = {yourName} minus {friendName}</span>
			</div>

			<ol class="rows">
				{#each visibleDisagreements as row (row.key)}
					{@const left = pct(Math.min(row.ratingA, row.ratingB))}
					{@const width = pct(Math.max(row.ratingA, row.ratingB)) - left}
					<li class="row">
						<div class="film-cell">
							<FilmLink film={{ name: row.title, uri: row.uri }} />
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

			<ShowMore pager={disagreementPager} />
		{/if}
	{:else if mutualFavourites.length === 0}
		<p class="empty">
			No mutual favourites yet (films both rated {FAVOURITE_RATING}★+ or hearted).
		</p>
	{:else}
		<div class="table-wrap">
			<table class="compare-table">
				<thead>
					<tr>
						<th scope="col">Film</th>
						<th scope="col" class="num">{yourName}</th>
						<th scope="col" class="num">{friendName}</th>
					</tr>
				</thead>
				<tbody>
					{#each visibleFavourites as row (row.key)}
						<tr>
							<td class="title-col">
								<FilmLink film={{ name: row.title, uri: row.uri }} />
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

		<ShowMore pager={favouritePager} />
	{/if}
</section>

<style>
	.legend-note {
		color: var(--fg-muted);
	}
	.mini-swatch {
		display: inline-block;
		flex-shrink: 0;
		width: 8px;
		height: 8px;
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
	.film-cell :global(a),
	.title-col :global(a) {
		color: var(--fg);
		text-decoration: none;
	}
	.film-cell :global(a:hover),
	.title-col :global(a:hover) {
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
	.title-col .year {
		margin-left: 6px;
	}
	.heart {
		margin-left: 4px;
		color: var(--liked);
	}
</style>
