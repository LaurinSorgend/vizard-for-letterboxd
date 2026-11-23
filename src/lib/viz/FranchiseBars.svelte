<script lang="ts">
	import { letterboxdTmdbUrl } from '$lib/film/links';
	import { noun } from '$lib/format';
	import RankedBars from './RankedBars.svelte';
	import type { FranchiseProgress } from './franchises';

	let { data, description }: { data: FranchiseProgress[]; description: string } = $props();

	const hasCompleted = $derived(data.some((d) => d.completed));
	const countText = (d: FranchiseProgress): string =>
		d.total !== null ? `${d.seen} / ${d.total}` : String(d.seen);
	const countChars = $derived(Math.max(4, ...data.map((d) => countText(d).length)));

	function barWidth(d: FranchiseProgress, maxSeen: number): number {
		return d.ratio !== null ? d.ratio * 100 : (d.seen / maxSeen) * 100;
	}

	function rowSummary(d: FranchiseProgress): string {
		const progress =
			d.total !== null
				? `${d.seen} of ${d.total} ${noun(d.total, 'film')}${d.completed ? ', completed' : ''}`
				: `${d.seen} ${noun(d.seen, 'film')}`;
		const missing = d.missing.length > 0 ? `, ${d.missing.length} unwatched` : '';
		const rating = d.avg !== null ? `, avg ${d.avg.toFixed(1)}` : '';
		return `${d.label}: ${progress}${missing}${rating}; click to list films`;
	}
</script>

<RankedBars {data} {description} imageLabel="poster for" {rowSummary}>
	{#snippet track(d, maxSeen)}
		<span class="meter" class:known={d.total !== null}>
			<span class="bar" class:complete={d.completed} style="width: {barWidth(d, maxSeen)}%"></span>
		</span>
		<span class="val" class:complete={d.completed} data-numeric>
			<span class="ratio" style="width: {countChars}ch">{countText(d)}</span>
			{#if hasCompleted}
				<span class="mark" aria-hidden="true">{d.completed ? '✓' : ''}</span>
			{/if}
		</span>
	{/snippet}

	{#snippet details(selected)}
		{#if selected.missing.length > 0}
			<div class="missing-panel">
				<h4>
					Not yet watched in {selected.label}: {selected.missing.length}
					{noun(selected.missing.length, 'film')}
				</h4>
				<ul class="missing-list">
					{#each selected.missing as part (part.tmdbId)}
						<li>
							<a href={letterboxdTmdbUrl(part.tmdbId)} target="_blank" rel="noopener">
								{part.title}
							</a>
							{#if part.year !== null}
								<span class="missing-year" data-numeric>{part.year}</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/snippet}
</RankedBars>

<style>
	.meter {
		flex: 1;
		height: 18px;
		display: flex;
		align-items: stretch;
	}
	.meter.known {
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.bar {
		height: 100%;
		min-width: 2px;
		background: var(--bar);
	}
	.bar.complete {
		background: var(--accent);
	}
	:global(button.track[aria-pressed='true']) .meter.known,
	:global(button.track[aria-pressed='true']) .meter:not(.known) .bar {
		box-shadow: 0 0 0 1.5px var(--fg);
	}
	.val {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5ch;
		font-size: var(--text-sm);
		color: var(--fg-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.ratio {
		text-align: right;
	}
	.mark {
		width: 1.2ch;
		text-align: center;
	}
	.val.complete {
		color: var(--fg);
	}
	.missing-panel {
		margin-top: 8px;
		padding: 12px;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border);
	}
	.missing-panel h4 {
		margin: 0 0 8px;
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--fg-secondary);
	}
	.missing-list {
		margin: 0;
		padding: 0;
		list-style: none;
		columns: 2;
		column-gap: 24px;
	}
	.missing-list li {
		display: flex;
		gap: 8px;
		padding: 2px 0;
		break-inside: avoid;
		font-size: var(--text-sm);
	}
	.missing-list a {
		color: var(--accent);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.missing-list a:hover {
		text-decoration: underline;
	}
	.missing-year {
		color: var(--fg-muted);
		flex-shrink: 0;
	}
	@media (max-width: 640px) {
		.missing-list {
			columns: 1;
		}
	}
</style>
