<script lang="ts">
	import { count, noun } from '$lib/format';
	import type { CustomList, EnrichedFilm } from '$lib/types';
	import {
		activeFilterChips,
		availableTags,
		availableWatchYears,
		clearFilterChip,
		hasActiveDashboardFilters,
		NO_DASHBOARD_FILTERS,
		type DashboardFilters,
		type FilterChip
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

	let open = $state(false);
	let customDatesOpen = $state(false);
	let toggleButton: HTMLButtonElement | undefined = $state();

	const watchYears = $derived(availableWatchYears(films));
	const tags = $derived(availableTags(films));
	const hasSeries = $derived(films.some((f) => f.tmdb?.mediaType === 'tv'));
	const hasControls = $derived(
		watchYears.length > 0 || hasSeries || tags.length > 0 || lists.length > 0
	);
	const active = $derived(hasActiveDashboardFilters(filters));
	const chips = $derived(activeFilterChips(filters, lists));

	const watchMode = $derived.by(() => {
		const from = filters.fromDate.trim();
		const to = filters.toDate.trim();
		if (customDatesOpen) return 'custom';
		if (!from && !to) return '';
		const match = /^(\d{4})-01-01$/.exec(from);
		if (match && to === `${match[1]}-12-31` && watchYears.includes(Number(match[1]))) {
			return match[1];
		}
		return 'custom';
	});

	const invertedDates = $derived(
		filters.fromDate.trim().length > 0 &&
			filters.toDate.trim().length > 0 &&
			filters.fromDate > filters.toDate
	);

	function onWatchModeChange(event: Event & { currentTarget: HTMLSelectElement }) {
		const value = event.currentTarget.value;
		if (value === '') {
			customDatesOpen = false;
			filters.fromDate = '';
			filters.toDate = '';
		} else if (value === 'custom') {
			customDatesOpen = true;
		} else {
			customDatesOpen = false;
			filters.fromDate = `${value}-01-01`;
			filters.toDate = `${value}-12-31`;
		}
	}

	function swapDates() {
		const from = filters.fromDate;
		filters.fromDate = filters.toDate;
		filters.toDate = from;
	}

	function removeChip(key: FilterChip['key']) {
		if (key === 'dates') customDatesOpen = false;
		filters = clearFilterChip(filters, key);
	}

	function reset() {
		customDatesOpen = false;
		filters = { ...NO_DASHBOARD_FILTERS };
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			open = false;
			toggleButton?.focus();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="filter-wrap form-controls" aria-label="Filter dashboard" onkeydown={onKeydown}>
	<div class="toolbar">
		<button
			bind:this={toggleButton}
			type="button"
			class="toggle-button"
			class:expanded={open}
			class:has-active={active}
			aria-expanded={open}
			aria-controls="dashboard-filter-panel"
			onclick={() => (open = !open)}
		>
			<svg
				class="filter-icon"
				viewBox="0 0 16 16"
				width="14"
				height="14"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="square"
				stroke-linejoin="miter"
				aria-hidden="true"
			>
				<path d="M1.5 2.5 H14.5 L9.5 8.5 V13.5 L6.5 12 V8.5 Z" />
			</svg>
			Filter{#if chips.length > 0}
				<span class="badge" data-numeric>{chips.length}</span>
			{/if}
			<span class="chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
		</button>

		{#if chips.length > 0}
			<ul class="chips" aria-label="Active filters">
				{#each chips as chip (chip.key)}
					<li>
						<button
							type="button"
							class="chip"
							aria-label={`Remove filter: ${chip.label}`}
							onclick={() => removeChip(chip.key)}
						>
							<span>{chip.label}</span>
							<span class="dismiss" aria-hidden="true">×</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if active}
			<div class="status">
				<p class="status-count" role="status">
					<span data-numeric>{count(filteredCount)}</span> of
					<span data-numeric>{count(films.length)}</span>
					{noun(films.length, 'film')}
				</p>
				<button type="button" class="reset-button" onclick={reset}>Reset</button>
			</div>
		{/if}
	</div>

	{#if open}
		<div id="dashboard-filter-panel" class="panel">
			{#if hasControls}
				<div class="controls">
					{#if watchYears.length > 0}
						<label>
							Watched
							<select value={watchMode} onchange={onWatchModeChange}>
								<option value="">All time</option>
								{#each watchYears as year (year)}
									<option value={String(year)}>{year}</option>
								{/each}
								<option value="custom">Custom dates…</option>
							</select>
						</label>
						{#if watchMode === 'custom'}
							<label>
								Watched from
								<input
									type="date"
									max={filters.toDate || undefined}
									bind:value={filters.fromDate}
								/>
							</label>
							<label>
								Watched to
								<input
									type="date"
									min={filters.fromDate || undefined}
									bind:value={filters.toDate}
								/>
							</label>
						{/if}
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

			{#if invertedDates}
				<div class="date-warning" role="alert">
					<span>Start date is after end date.</span>
					<button type="button" onclick={swapDates}>Swap dates</button>
				</div>
			{/if}

			<div class="panel-footer">
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
				{#if active}
					<button type="button" class="reset-button" onclick={reset}>Reset all</button>
				{/if}
			</div>
		</div>
	{/if}
</section>

<style>
	.filter-wrap {
		margin: 12px 0 20px;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
	}
	.toggle-button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 2.125rem;
		padding: 0.3125rem 0.625rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-strong);
		color: var(--fg);
	}
	.toggle-button.has-active {
		border-color: var(--accent);
	}
	.filter-icon {
		flex-shrink: 0;
		color: var(--fg-secondary);
	}
	.toggle-button.has-active .filter-icon,
	.toggle-button.expanded .filter-icon {
		color: var(--fg);
	}
	.chevron {
		font-size: var(--text-xs);
		color: var(--fg-secondary);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		padding: 0 0.25rem;
		font-size: var(--text-xs);
		line-height: 1.3;
		background: var(--accent);
		color: var(--on-accent);
	}
	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 2.125rem;
		padding: 0.25rem 0.5rem;
		font-size: var(--text-sm);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		color: var(--fg);
	}
	.chip:hover {
		background: var(--surface);
		border-color: var(--border-strong);
	}
	.dismiss {
		color: var(--fg-secondary);
		font-size: var(--text-base);
		line-height: 1;
	}
	.status {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin-left: auto;
	}
	.status-count {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.reset-button {
		min-height: 2.125rem;
		padding: 0.3125rem 0.625rem;
		border-color: var(--border-strong);
	}
	.panel {
		margin-top: 8px;
		padding: 12px 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-strong);
	}
	.panel :is(select, input:not([type='checkbox']), button:not(.link)) {
		background: var(--bg);
		border-color: var(--border-strong);
		min-height: 2.25rem;
		line-height: 1.4;
		padding: 0.3125rem 0.5rem;
	}
	.panel :is(button:not(.link):hover:not(:disabled)) {
		background: var(--surface);
	}
	.controls {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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
	/* Match select box height across Chromium/WebKit/Firefox without locking text zoom. */
	.panel input[type='date'] {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		padding-block: 0.25rem;
	}
	.panel input[type='date']::-webkit-datetime-edit {
		padding: 0;
		line-height: 1.4;
	}
	.panel input[type='date']::-webkit-calendar-picker-indicator {
		margin: 0;
		padding: 0;
		cursor: pointer;
	}
	.date-warning {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin-top: 10px;
		padding: 6px 10px;
		font-size: var(--text-sm);
		color: var(--error);
		background: color-mix(in srgb, var(--error) 12%, transparent);
		border: 1px solid var(--error);
	}
	.panel-footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
	}
	.controls + .panel-footer,
	.date-warning + .panel-footer {
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid var(--border);
	}
	.toggles {
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
</style>
