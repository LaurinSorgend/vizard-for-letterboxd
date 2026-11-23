<script lang="ts">
	import { count, noun } from '$lib/format';
	import type { CustomList, EnrichedFilm } from '$lib/types';
	import {
		availableTags,
		availableWatchYears,
		hasActiveDashboardFilters,
		NO_DASHBOARD_FILTERS,
		type DashboardFilters
	} from './filters';

	let {
		films,
		filteredCount,
		lists = [],
		filters = $bindable()
	}: {
		films: EnrichedFilm[];
		filteredCount: number;
		lists?: CustomList[];
		filters: DashboardFilters;
	} = $props();

	const watchYears = $derived(availableWatchYears(films));
	const tags = $derived(availableTags(films));
	const hasSeries = $derived(films.some((f) => f.tmdb?.mediaType === 'tv'));
	const hasControls = $derived(
		watchYears.length > 0 || hasSeries || tags.length > 0 || lists.length > 0
	);
	const active = $derived(hasActiveDashboardFilters(filters));

	const selectedYear = $derived.by(() => {
		const from = filters.fromDate.trim();
		const to = filters.toDate.trim();
		if (!from && !to) return '';
		const match = /^(\d{4})-01-01$/.exec(from);
		if (match && to === `${match[1]}-12-31` && watchYears.includes(Number(match[1]))) {
			return match[1];
		}
		return 'custom';
	});

	function onYearChange(event: Event & { currentTarget: HTMLSelectElement }) {
		const value = event.currentTarget.value;
		if (value === '') {
			filters.fromDate = '';
			filters.toDate = '';
		} else if (value !== 'custom') {
			filters.fromDate = `${value}-01-01`;
			filters.toDate = `${value}-12-31`;
		}
	}

	function reset() {
		filters = { ...NO_DASHBOARD_FILTERS };
	}
</script>

<section class="filter-bar form-controls" class:active aria-label="Filter dashboard">
	{#if hasControls}
		<div class="controls">
			{#if watchYears.length > 0}
				<label>
					Watch year
					<select value={selectedYear} onchange={onYearChange}>
						<option value="">All years</option>
						{#each watchYears as year (year)}
							<option value={String(year)}>{year}</option>
						{/each}
						{#if selectedYear === 'custom'}
							<option value="custom">Custom range</option>
						{/if}
					</select>
				</label>
				<label>
					From
					<input type="date" bind:value={filters.fromDate} />
				</label>
				<label>
					To
					<input type="date" bind:value={filters.toDate} />
				</label>
			{/if}
			{#if hasSeries}
				<label>
					Type
					<select bind:value={filters.mediaType}>
						<option value="all">Films &amp; series</option>
						<option value="movie">Films</option>
						<option value="tv">Series</option>
					</select>
				</label>
			{/if}
			{#if tags.length > 0}
				<label>
					Tag
					<select bind:value={filters.tag}>
						<option value="">Any tag</option>
						{#each tags as item (item.tag)}
							<option value={item.tag}>{item.tag} ({count(item.count)})</option>
						{/each}
					</select>
				</label>
			{/if}
			{#if lists.length > 0}
				<label>
					List
					<select bind:value={filters.listId}>
						<option value="">Any list</option>
						{#each lists as list (list.id)}
							<option value={list.id}>{list.name} ({count(list.items.length)})</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>
	{/if}

	<div class="bar-footer">
		<div class="toggles">
			<label class="inline">
				<input type="checkbox" bind:checked={filters.diaryOnly} />
				Diary-logged only
			</label>
			<label class="inline">
				<input type="checkbox" bind:checked={filters.heartedOnly} />
				Hearted only
			</label>
		</div>
		<div class="status">
			<p class="status-count" role="status">
				Showing <span data-numeric>{count(filteredCount)}</span> of
				<span data-numeric>{count(films.length)}</span>
				{noun(films.length, 'film')}
			</p>
			<button type="button" disabled={!active} onclick={reset}>Reset filters</button>
		</div>
	</div>
</section>

<style>
	.filter-bar {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		padding: 12px 16px;
		margin: 16px 0 24px;
	}
	.filter-bar.active {
		border-color: var(--border-strong);
	}
	.filter-bar :is(select, input:not([type='checkbox']), button:not(.link)) {
		background: var(--bg);
		border-color: var(--border-strong);
	}
	.filter-bar :is(button:not(.link):hover:not(:disabled)) {
		background: var(--surface);
	}
	.controls {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 10px 12px;
		align-items: end;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		min-width: 0;
	}
	input[type='date'] {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.bar-footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
	}
	.controls + .bar-footer {
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid var(--border);
	}
	.toggles,
	.status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
	}
	label.inline {
		flex-direction: row;
		align-items: center;
		gap: 6px;
		min-height: 24px;
		cursor: pointer;
		color: var(--fg);
	}
	label.inline input {
		accent-color: var(--accent);
		margin: 0;
	}
	.status-count {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
</style>
