<script lang="ts">
	export interface StatTile {
		label: string;
		value: string;
		detail?: string;
		title?: string;
		numeric?: boolean;
	}

	let { tiles, compact = false }: { tiles: StatTile[]; compact?: boolean } = $props();
</script>

<!-- A ledger row rather than a set of equal cards: figures under hairline rules, the first one
     (the count everything else is measured against) under an accent rule. -->
<dl class="tiles" class:compact>
	{#each tiles as tile, i (tile.label)}
		<div class="tile" class:lead={i === 0}>
			<dt class="label">{tile.label}</dt>
			<dd
				class="value"
				class:metric={tile.numeric !== false}
				title={tile.detail ? tile.value : undefined}
			>
				{tile.value}
			</dd>
			{#if tile.detail !== undefined}
				<dd class="detail" title={tile.title}>{tile.detail}</dd>
			{/if}
		</div>
	{/each}
</dl>

<style>
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 16px 24px;
		margin: 0;
	}
	.tiles.compact {
		gap: 12px 20px;
	}
	.tile {
		padding-top: 12px;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.compact .tile {
		padding-top: 8px;
		gap: 2px;
	}
	.tile.lead {
		border-top: 2px solid var(--accent);
		padding-top: 11px;
	}
	.compact .tile.lead {
		padding-top: 7px;
	}
	.label {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.value {
		margin: 0;
		font-size: var(--text-2xl);
		font-weight: 500;
		line-height: var(--leading-snug);
		color: var(--fg);
	}
	.compact .value {
		font-size: var(--text-xl);
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
</style>
