<script lang="ts">
	import { noun, stars } from '$lib/format';
	import FilmList from './FilmList.svelte';
	import { selectByKey } from './selection.svelte';
	import { pager } from './pager.svelte';
	import ShowMore from './ShowMore.svelte';
	import type { FranchiseProgress } from './franchises';

	let {
		data,
		limit = 12,
		description
	}: { data: FranchiseProgress[]; limit?: number; description: string } = $props();

	let pinnedKey: string | null = $state(null);
	const selection = selectByKey(
		() => data,
		(d) => d.key
	);
	const paging = pager(
		() => data.length,
		() => limit
	);
	const rows = $derived(data.slice(0, paging.shown));
	const maxSeen = $derived(Math.max(1, ...rows.map((d) => d.seen)));
	const hasImages = $derived(data.some((d) => d.image !== undefined));

	function togglePin(key: string) {
		pinnedKey = pinnedKey === key ? null : key;
	}

	function barWidth(d: FranchiseProgress): number {
		return d.ratio !== null ? d.ratio * 100 : (d.seen / maxSeen) * 100;
	}

	function rowSummary(d: FranchiseProgress): string {
		const progress =
			d.total !== null
				? `${d.seen} of ${d.total} ${noun(d.total, 'film')}${d.completed ? ', completed' : ''}`
				: `${d.seen} ${noun(d.seen, 'film')}`;
		const rating = d.avg !== null ? `, avg ${d.avg.toFixed(1)}` : '';
		return `${d.label}: ${progress}${rating}; click to list films`;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && pinnedKey !== null) pinnedKey = null;
	}}
/>

<div class="chart" class:with-images={hasImages} role="group" aria-label={description}>
	{#each rows as d (d.key)}
		{#if hasImages}
			{#if d.imageLarge}
				<button
					type="button"
					class="pic"
					class:pinned={pinnedKey === d.key}
					aria-pressed={pinnedKey === d.key}
					aria-label="Show poster for {d.label}"
					onclick={() => togglePin(d.key)}
				>
					{#if d.image}
						<img src={d.image} alt="" loading="lazy" width="40" height="40" />
					{/if}
					<img class="preview" src={d.imageLarge} alt="" loading="lazy" width="150" />
				</button>
			{:else}
				<span class="pic">
					{#if d.image}
						<img src={d.image} alt="" loading="lazy" width="40" height="40" />
					{/if}
				</span>
			{/if}
		{/if}
		<span class="lab" title={d.label}>
			{#if d.href}
				<a href={d.href} target="_blank" rel="noopener">{d.label}</a>
			{:else}
				{d.label}
			{/if}
		</span>
		<button
			type="button"
			class="track"
			aria-pressed={selection.isSelected(d.key)}
			aria-label={rowSummary(d)}
			title={rowSummary(d)}
			onclick={() => selection.toggle(d.key)}
		>
			<span class="meter" class:known={d.total !== null}>
				<span class="bar" class:complete={d.completed} style="width: {barWidth(d)}%"></span>
			</span>
			<span class="val" class:complete={d.completed} data-numeric>
				{#if d.total !== null}
					{d.seen} / {d.total}{#if d.completed}<span aria-hidden="true"> ✓</span>{/if}
				{:else}
					{d.seen}
				{/if}
			</span>
		</button>
		<span class="avg" data-numeric>{stars(d.avg)}</span>
	{/each}
</div>
<ShowMore pager={paging} />
{#if selection.selected}
	{@const selected = selection.selected}
	<FilmList title={selected.label} films={selected.films} />
{/if}

<style>
	.chart {
		display: grid;
		grid-template-columns: minmax(72px, max-content) 1fr auto;
		gap: 4px 12px;
		align-items: center;
		position: relative;
	}
	.chart.with-images {
		grid-template-columns: 40px minmax(72px, max-content) 1fr auto;
		gap: 4px 8px;
	}
	.pic {
		width: 40px;
		height: 40px;
		position: relative;
	}
	button.pic {
		padding: 0;
		margin: 0;
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.pic .preview {
		display: none;
		position: absolute;
		top: 44px;
		left: 0;
		width: 150px;
		height: auto;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		z-index: 10;
	}
	button.pic:hover .preview,
	button.pic:focus-visible .preview,
	button.pic.pinned .preview {
		display: block;
	}
	.pic img {
		width: 40px;
		height: 40px;
		object-fit: cover;
		display: block;
		background: var(--surface);
	}
	.lab {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lab a {
		color: var(--accent);
		text-decoration: none;
	}
	.lab a:hover {
		text-decoration: underline;
	}
	.track {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 24px;
	}
	button.track {
		font: inherit;
		padding: 0;
		margin: 0;
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
	}
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
	.track:hover .bar {
		filter: brightness(1.15);
	}
	button.track[aria-pressed='true'] .meter.known,
	button.track[aria-pressed='true'] .meter:not(.known) .bar {
		box-shadow: 0 0 0 1.5px var(--fg);
	}
	.val {
		font-size: var(--text-sm);
		color: var(--fg-muted);
		min-width: 7ch;
		text-align: right;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.val.complete {
		color: var(--fg);
		font-weight: 600;
	}
	.avg {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		justify-self: end;
	}
</style>
