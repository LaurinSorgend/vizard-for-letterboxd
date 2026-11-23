<script lang="ts">
	import { count, formatDays, formatShort, noun, plural, runtimeLabel } from '$lib/format';
	import StatTiles, { type StatTile } from '$lib/viz/StatTiles.svelte';
	import type { WatchlistSummary } from './summary';

	let {
		summary,
		region,
		loading = false
	}: { summary: WatchlistSummary; region: string; loading?: boolean } = $props();

	const ageLabel = (daysAgo: number): string => (daysAgo === 0 ? 'Today' : formatDays(daysAgo));

	const tiles = $derived.by((): StatTile[] => {
		const backlogDetail =
			summary.unmatched > 0
				? `${noun(summary.total, 'film')} · ${count(summary.unmatched)} unmatched`
				: noun(summary.total, 'film');

		const list: StatTile[] = [
			{
				label: 'Backlog',
				value: count(summary.total),
				detail: backlogDetail
			},
			{
				label: 'Watch time',
				value: summary.timedCount > 0 ? `${count(summary.totalHours)} hrs` : '—',
				detail:
					summary.avgRuntime !== null ? `avg ${runtimeLabel(summary.avgRuntime)}` : 'no runtimes'
			},
			{
				label: `Streaming in ${region}`,
				value: loading ? '…' : summary.streamingPct !== null ? `${summary.streamingPct}%` : '—',
				detail: loading
					? 'checking offers'
					: summary.checked > 0
						? `${count(summary.streamingAny)} of ${count(summary.checked)}`
						: 'no offers checked'
			}
		];

		if (summary.onSelectedServices !== null) {
			list.push({
				label: 'On your services',
				value: loading
					? '…'
					: summary.onSelectedServices.pct !== null
						? `${summary.onSelectedServices.pct}%`
						: '—',
				detail: loading ? 'checking offers' : plural(summary.onSelectedServices.count, 'film')
			});
		} else {
			list.push({
				label: 'Top service',
				value: loading ? '…' : (summary.topService?.name ?? '—'),
				detail: loading
					? 'checking offers'
					: summary.topService
						? `${plural(summary.topService.films, 'film')} · ${summary.topService.pct}%`
						: 'none streaming',
				numeric: loading || summary.topService === null
			});
		}

		if (summary.oldest) {
			const detail = `${summary.oldest.name} · added ${formatShort(summary.oldest.added)}`;
			list.push({
				label: 'Oldest on list',
				value: ageLabel(summary.oldest.daysAgo),
				detail,
				title: detail,
				numeric: summary.oldest.daysAgo > 0
			});
		}

		return list;
	});

	const segments = $derived.by(() => {
		if (loading || summary.checked === 0) return [];
		const share = (n: number) => (n / summary.checked) * 100;
		const pct = (n: number) => Math.round(share(n));
		return [
			{
				key: 'stream',
				label: 'Streaming',
				films: summary.streamingAny,
				pct: summary.streamingPct ?? 0,
				width: share(summary.streamingAny)
			},
			{
				key: 'rent',
				label: 'Rent or buy',
				films: summary.rentOnly,
				pct: pct(summary.rentOnly),
				width: share(summary.rentOnly)
			},
			{
				key: 'none',
				label: 'Not streaming',
				films: summary.unavailable,
				pct: pct(summary.unavailable),
				width: share(summary.unavailable)
			}
		];
	});
</script>

<div class="watchlist-summary">
	<StatTiles {tiles} compact />

	{#if segments.length > 0}
		<div class="coverage">
			<div class="bar" aria-hidden="true">
				{#each segments as seg (seg.key)}
					{#if seg.films > 0}
						<span class="seg {seg.key}" style:width="{seg.width}%"></span>
					{/if}
				{/each}
			</div>
			<ul class="legend">
				{#each segments as seg (seg.key)}
					<li>
						<span class="swatch {seg.key}" aria-hidden="true"></span>
						<span>{seg.label}</span>
						<span data-numeric>{seg.pct}% ({count(seg.films)})</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.watchlist-summary {
		margin-bottom: 20px;
	}
	.coverage {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bar {
		display: flex;
		height: 8px;
		background: var(--surface);
		border: 1px solid var(--border);
	}
	.seg {
		display: block;
		height: 100%;
	}
	.seg + .seg {
		border-left: 1px solid var(--bg);
	}
	.seg.stream,
	.swatch.stream {
		background: var(--bar);
	}
	.seg.rent,
	.swatch.rent {
		background: var(--accent);
	}
	.seg.none,
	.swatch.none {
		background: var(--surface);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.legend li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.swatch {
		width: 10px;
		height: 10px;
		display: inline-block;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}
</style>
