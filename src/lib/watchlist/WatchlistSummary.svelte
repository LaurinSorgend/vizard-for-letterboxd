<script lang="ts">
	import { count, formatDays, noun, plural, runtimeLabel } from '$lib/format';
	import type { WatchlistSummary } from './summary';

	let { summary, region }: { summary: WatchlistSummary; region: string } = $props();

	interface Tile {
		label: string;
		value: string;
		detail: string;
		numeric: boolean;
		title?: string;
	}

	function ageLabel(daysAgo: number): string {
		if (daysAgo === 0) return 'Today';
		if (daysAgo === 1) return '1 day';
		return formatDays(daysAgo);
	}

	const tiles = $derived.by((): Tile[] => {
		const backlogDetail =
			summary.unmatched > 0
				? `${noun(summary.total, 'film')} · ${count(summary.unmatched)} unmatched`
				: noun(summary.total, 'film');

		const list: Tile[] = [
			{
				label: 'Backlog',
				value: count(summary.total),
				detail: backlogDetail,
				numeric: true
			},
			{
				label: 'Watch time',
				value: summary.timedCount > 0 ? `${count(summary.totalHours)} hrs` : '—',
				detail:
					summary.avgRuntime !== null ? `avg ${runtimeLabel(summary.avgRuntime)}` : 'no runtimes',
				numeric: true
			},
			{
				label: `Streaming in ${region}`,
				value: summary.loading
					? '…'
					: summary.streamingPct !== null
						? `${summary.streamingPct}%`
						: '—',
				detail: summary.loading
					? 'checking offers'
					: summary.checked > 0
						? `${count(summary.streamingAny)} of ${count(summary.checked)}`
						: 'no offers checked',
				numeric: true
			}
		];

		if (summary.onSelectedServices !== null) {
			list.push({
				label: 'On your services',
				value: summary.loading
					? '…'
					: summary.onSelectedServices.pct !== null
						? `${summary.onSelectedServices.pct}%`
						: '—',
				detail: summary.loading
					? 'checking offers'
					: plural(summary.onSelectedServices.count, 'film'),
				numeric: true
			});
		} else {
			list.push({
				label: 'Top service',
				value: summary.loading ? '…' : (summary.topService?.name ?? '—'),
				detail: summary.loading
					? 'checking offers'
					: summary.topService
						? `${plural(summary.topService.films, 'film')} · ${summary.topService.pct}%`
						: 'none streaming',
				numeric: summary.loading || summary.topService === null
			});
		}

		if (summary.oldest) {
			const detail = `${summary.oldest.name} (${summary.oldest.added.slice(0, 4)})`;
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
		if (summary.loading || summary.checked === 0) return [];
		const share = (n: number) => (n / summary.checked) * 100;
		const pct = (n: number) => Math.round(share(n));
		return [
			{
				key: 'stream',
				label: 'Streaming',
				films: summary.streamingAny,
				pct: pct(summary.streamingAny),
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
	<dl class="tiles">
		{#each tiles as tile, i (tile.label)}
			<div class="tile" class:lead={i === 0}>
				<dt class="label">{tile.label}</dt>
				<dd class="value" class:metric={tile.numeric} title={tile.value}>{tile.value}</dd>
				<dd class="detail" title={tile.title}>{tile.detail}</dd>
			</div>
		{/each}
	</dl>

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
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 12px 20px;
		margin: 0;
	}
	.tile {
		padding-top: 8px;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.tile.lead {
		border-top: 2px solid var(--accent);
		padding-top: 7px;
	}
	.label {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.value {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: 500;
		line-height: var(--leading-snug);
		color: var(--fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.detail {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--fg-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
