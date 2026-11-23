<script lang="ts">
	import { count, fixed, plural } from '$lib/format';
	import StatTiles from '$lib/viz/StatTiles.svelte';
	import type { OverlapStats } from './compare';

	let {
		overlap,
		yourName,
		friendName
	}: {
		overlap: OverlapStats;
		yourName: string;
		friendName: string;
	} = $props();

	const tiles = $derived([
		{
			label: 'Compatibility',
			value: overlap.compatibilityPct === null ? '—' : `${overlap.compatibilityPct}%`
		},
		{
			label: 'Shared films',
			value: count(overlap.sharedCount)
		},
		{
			label: 'Avg rating gap',
			value: overlap.meanAbsDiff === null ? '—' : `${fixed(overlap.meanAbsDiff, 2)} ★`
		},
		{
			label: 'Mutual favourites',
			value: count(overlap.mutualFavouritesCount)
		}
	]);

	function correlationLabel(r: number): string {
		if (r >= 0.6) return 'strong agreement';
		if (r >= 0.3) return 'moderate agreement';
		if (r >= 0.1) return 'mild agreement';
		if (r > -0.1) return 'little linear correlation';
		return 'opposing taste';
	}
</script>

<section class="compare-block" aria-labelledby="compare-overlap-heading">
	<h3 id="compare-overlap-heading">Overlap &amp; compatibility</h3>
	<StatTiles {tiles} />

	<div class="insights">
		{#if overlap.sharedCount === 0}
			<p>No films appear in both libraries yet.</p>
		{:else}
			<p>
				{yourName} and {friendName} share
				<span data-numeric>{plural(overlap.sharedCount, 'film')}</span>
				out of <span data-numeric>{count(overlap.unionCount)}</span> combined titles (<span
					data-numeric
				>
					{Math.round(overlap.jaccardPct)}%
				</span> Jaccard overlap).
			</p>
			{#if overlap.bothRatedCount > 0}
				<p>
					Both rated <span data-numeric>{plural(overlap.bothRatedCount, 'shared film')}</span>,
					landing within half a star on
					<span data-numeric>{Math.round(overlap.closeAgreementPct ?? 0)}%</span> of them.
					{#if overlap.signedBias !== null}
						{#if Math.abs(overlap.signedBias) < 0.05}
							Average ratings on shared films are virtually tied.
						{:else if overlap.signedBias > 0}
							{yourName} rates shared films
							<span data-numeric>{fixed(overlap.signedBias, 2)}</span> stars higher on average.
						{:else}
							{friendName} rates shared films
							<span data-numeric>{fixed(-overlap.signedBias, 2)}</span> stars higher on average.
						{/if}
					{/if}
					{#if overlap.pearson !== null}
						Rating correlation:
						<span data-numeric>r = {fixed(overlap.pearson, 2)}</span>
						({correlationLabel(overlap.pearson)}).
					{/if}
				</p>
			{:else}
				<p>
					Neither library has overlapping star ratings yet, so rating compatibility cannot be
					computed.
				</p>
			{/if}
		{/if}
	</div>
</section>

<style>
	.compare-block {
		margin: 0 0 32px;
	}
	h3 {
		margin: 0 0 12px;
		color: var(--fg);
	}
	.insights {
		margin-top: 16px;
		max-width: var(--measure);
	}
	.insights p {
		margin: 0 0 8px;
		color: var(--fg-secondary);
	}
	.insights p:last-child {
		margin-bottom: 0;
	}
</style>
