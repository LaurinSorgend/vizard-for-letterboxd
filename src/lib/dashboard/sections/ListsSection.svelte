<script lang="ts">
	import { webHref } from '$lib/film/links';
	import { count, formatIsoDate, plural, stars } from '$lib/format';
	import { getLibrary } from '$lib/library.svelte';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import ShowMore from '$lib/viz/ShowMore.svelte';
	import { pager } from '$lib/viz/pager.svelte';
	import {
		buildListStats,
		listSummary,
		sortListStats,
		type ListSort,
		type ListStats
	} from '$lib/viz/lists';
	import Section from '../Section.svelte';
	import { getDashboard } from '../state.svelte';

	const library = getLibrary();
	const dashboard = getDashboard();

	let sort: ListSort = $state('size');

	const base = $derived(buildListStats(library.lists, library.films));
	const hasRatings = $derived(base.some((row) => row.avgRating !== null));
	const sortOptions = $derived([
		{ value: 'size' as const, label: 'Most films' },
		{ value: 'watched' as const, label: 'Most watched' },
		{ value: 'completion' as const, label: 'Most complete' },
		...(hasRatings ? [{ value: 'rating' as const, label: 'Highest rated' }] : [])
	]);
	const activeSort = $derived<ListSort>(
		sortOptions.some((option) => option.value === sort) ? sort : 'size'
	);
	const stats = $derived(activeSort === 'size' ? base : sortListStats(base, activeSort));
	const summary = $derived(listSummary(base));

	const paging = pager(
		() => stats.length,
		() => 12,
		() => activeSort
	);
	const rows = $derived(stats.slice(0, paging.shown));
	const hasCompleted = $derived(rows.some((row) => row.completed));
	const ratioText = (row: ListStats): string => `${row.watched} / ${row.total}`;
	const countChars = $derived(Math.max(5, ...rows.map((row) => ratioText(row).length)));
</script>

{#if library.lists.length > 0}
	<Section id="lists" title="Your lists" nav="Lists">
		<p class="chart-note">
			{plural(summary.listCount, 'list')} · {plural(summary.uniqueFilms, 'unique film')} ·
			{count(summary.completedLists)} completed
		</p>

		{#if stats.length > 1}
			<MetricToggle
				name="list-sort"
				label="Sort lists by"
				options={sortOptions}
				bind:value={sort}
			/>
		{/if}

		<div class="list-rows" role="list" aria-label="Custom Letterboxd lists">
			{#each rows as row (row.list.id)}
				{@const listHref = webHref(row.list.url)}
				{@const filtering = dashboard.filters.listId === row.list.id}
				<article class="list-row" class:filtering role="listitem">
					<div class="row-head">
						<div class="title-block">
							<span class="name">
								{#if listHref}
									<a href={listHref} target="_blank" rel="noopener">{row.list.name}</a>
								{:else}
									{row.list.name}
								{/if}
							</span>
							{#if row.list.date || row.list.tags.length > 0}
								<span class="meta">
									{#if row.list.date}
										<time class="date" datetime={row.list.date} data-numeric>
											{formatIsoDate(row.list.date)}
										</time>
									{/if}
									{#each row.list.tags as tag, i (`${tag}-${i}`)}
										<span class="tag">{tag}</span>
									{/each}
								</span>
							{/if}
						</div>

						<button
							type="button"
							class="filter-btn"
							class:active={filtering}
							aria-pressed={filtering}
							onclick={() => dashboard.toggleListFilter(row.list.id)}
						>
							{filtering ? 'Filtering' : 'Filter dashboard'}
						</button>
					</div>

					<div class="progress-line">
						<span class="meter" aria-hidden="true">
							{#if row.watched > 0}
								<span class="bar" class:complete={row.completed} style="width: {row.pct}%"></span>
							{/if}
						</span>
						<span class="val" class:complete={row.completed} data-numeric>
							<span class="ratio" style="width: {countChars}ch">{ratioText(row)}</span>
							<span class="pct">{row.pct}%</span>
							{#if hasCompleted}
								<span class="mark" aria-hidden="true">{row.completed ? '✓' : ''}</span>
							{/if}
						</span>
						<span class="avg" data-numeric>{stars(row.avgRating)}</span>
					</div>

					{#if row.missing.length > 0}
						<details class="unwatched">
							<summary>
								<span data-numeric>{count(row.missing.length)}</span> unwatched
							</summary>
							<ul class="missing-list">
								{#each row.missing as item, idx (`${item.uri || item.name}-${item.year ?? 'none'}-${idx}`)}
									{@const itemHref = webHref(item.uri)}
									<li>
										{#if itemHref}
											<a href={itemHref} target="_blank" rel="noopener">{item.name}</a>
										{:else}
											<span>{item.name}</span>
										{/if}
										{#if item.year !== null}
											<span class="year" data-numeric>({item.year})</span>
										{/if}
									</li>
								{/each}
							</ul>
						</details>
					{/if}
				</article>
			{/each}
		</div>

		<ShowMore pager={paging} />
	</Section>
{/if}

<style>
	.list-rows {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--border);
	}
	.list-row {
		padding: 10px 8px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.list-row.filtering {
		background: var(--bg-secondary);
	}
	.row-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px 12px;
		flex-wrap: wrap;
	}
	.title-block {
		display: flex;
		align-items: baseline;
		gap: 4px 10px;
		flex-wrap: wrap;
		min-width: 0;
	}
	.name {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--fg);
	}
	.name a {
		color: var(--accent);
		text-decoration: none;
	}
	.name a:hover {
		text-decoration: underline;
	}
	.meta {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		flex-wrap: wrap;
	}
	.date {
		font-size: var(--text-xs);
		color: var(--fg-muted);
	}
	.tag {
		font-size: var(--text-xs);
		color: var(--fg-secondary);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		padding: 0 6px;
	}
	.filter-btn {
		font: inherit;
		font-size: var(--text-xs);
		padding: 2px 8px;
		min-height: 24px;
		color: var(--fg);
		background: transparent;
		border: 1px solid var(--border);
		cursor: pointer;
		white-space: nowrap;
	}
	.filter-btn:hover {
		background: var(--surface);
	}
	.filter-btn.active {
		background: var(--accent);
		color: var(--on-accent);
		border-color: var(--accent);
	}
	.progress-line {
		display: grid;
		grid-template-columns: minmax(80px, 1fr) auto 5.5ch;
		align-items: center;
		gap: 8px 12px;
	}
	.meter {
		height: 18px;
		display: flex;
		align-items: stretch;
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
	.val {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75ch;
		font-size: var(--text-sm);
		color: var(--fg-muted);
		white-space: nowrap;
	}
	.val.complete {
		color: var(--fg);
	}
	.ratio {
		text-align: right;
	}
	.pct {
		width: 4ch;
		text-align: right;
	}
	.mark {
		width: 1.2ch;
		text-align: center;
	}
	.avg {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		justify-self: end;
		white-space: nowrap;
	}
	.unwatched {
		font-size: var(--text-xs);
		color: var(--fg-secondary);
	}
	.unwatched summary {
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		min-height: 24px;
		user-select: none;
	}
	.unwatched summary:hover {
		color: var(--fg);
	}
	.missing-list {
		margin: 6px 0 2px;
		padding: 8px 0 0 16px;
		border-top: 1px solid var(--border);
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 4px 16px;
	}
	.missing-list a {
		color: var(--accent);
		text-decoration: none;
	}
	.missing-list a:hover {
		text-decoration: underline;
	}
	.year {
		color: var(--fg-muted);
		margin-left: 4px;
	}
	@media (max-width: 520px) {
		.progress-line {
			grid-template-columns: 1fr auto;
		}
		.meter {
			grid-column: 1 / -1;
		}
	}
</style>
