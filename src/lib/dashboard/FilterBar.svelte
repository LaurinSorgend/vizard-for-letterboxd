<script lang="ts">
	import { watchYears as extractWatchYears } from '$lib/film/diary';
	import { isSeries } from '$lib/film/runtime';
	import { byTag } from '$lib/film/tally';
	import { count, noun } from '$lib/format';
	import { getLibrary } from '$lib/library.svelte';
	import { fullCalendarYear } from './filters';
	import { getDashboard } from './state.svelte';

	const library = getLibrary();
	const dashboard = getDashboard();

	let open = $state(false);
	let toggleButton: HTMLButtonElement | undefined = $state();

	const watchYears = $derived(extractWatchYears(library.films));
	const tags = $derived(byTag(library.films));
	const hasSeries = $derived(library.films.some(isSeries));
	const hasControls = $derived(
		watchYears.length > 0 || hasSeries || tags.length > 0 || library.lists.length > 0
	);

	const watchMode = $derived.by(() => {
		const from = dashboard.filters.fromDate.trim();
		const to = dashboard.filters.toDate.trim();
		if (dashboard.customDatesOpen) return 'custom';
		if (!from && !to) return '';
		const year = fullCalendarYear(from, to);
		if (year && watchYears.includes(Number(year))) return year;
		return 'custom';
	});

	const invertedDates = $derived.by(() => {
		const from = dashboard.filters.fromDate.trim();
		const to = dashboard.filters.toDate.trim();
		return from.length > 0 && to.length > 0 && from > to;
	});

	function onWatchModeChange(event: Event & { currentTarget: HTMLSelectElement }) {
		const value = event.currentTarget.value;
		if (value === '') {
			dashboard.customDatesOpen = false;
			dashboard.filters.fromDate = '';
			dashboard.filters.toDate = '';
		} else if (value === 'custom') {
			dashboard.customDatesOpen = true;
		} else {
			dashboard.customDatesOpen = false;
			dashboard.filters.fromDate = `${value}-01-01`;
			dashboard.filters.toDate = `${value}-12-31`;
		}
	}

	function swapDates() {
		const from = dashboard.filters.fromDate;
		dashboard.filters.fromDate = dashboard.filters.toDate;
		dashboard.filters.toDate = from;
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
			class:has-active={dashboard.isFiltered}
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
			Filter{#if dashboard.chips.length > 0}
				<span class="badge" data-numeric>{dashboard.chips.length}</span>
			{/if}
			<span class="chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
		</button>

		{#if dashboard.chips.length > 0}
			<ul class="chips" aria-label="Active filters">
				{#each dashboard.chips as chip (chip.key)}
					<li>
						<button
							type="button"
							class="chip"
							aria-label={`Remove filter: ${chip.label}`}
							onclick={() => dashboard.removeChip(chip.key)}
						>
							<span>{chip.label}</span>
							<span class="dismiss" aria-hidden="true">×</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if dashboard.isFiltered}
			<div class="status">
				<p class="status-count" role="status">
					<span data-numeric>{count(dashboard.films.length)}</span> of
					<span data-numeric>{count(library.films.length)}</span>
					{noun(library.films.length, 'film')}
				</p>
				<button type="button" class="reset-button" onclick={() => dashboard.reset()}>Reset</button>
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
									max={dashboard.filters.toDate || undefined}
									bind:value={dashboard.filters.fromDate}
								/>
							</label>
							<label>
								Watched to
								<input
									type="date"
									min={dashboard.filters.fromDate || undefined}
									bind:value={dashboard.filters.toDate}
								/>
							</label>
						{/if}
					{/if}
					{#if hasSeries}
						<label>
							Type
							<select bind:value={dashboard.filters.mediaType}>
								<option value="all">Films &amp; series</option>
								<option value="movie">Films</option>
								<option value="tv">Series</option>
							</select>
						</label>
					{/if}
					{#if tags.length > 0}
						<label>
							Tag
							<select bind:value={dashboard.filters.tag}>
								<option value="">Any tag</option>
								{#each tags as item (item.key)}
									<option value={item.label}>{item.label} ({count(item.count)})</option>
								{/each}
							</select>
						</label>
					{/if}
					{#if library.lists.length > 0}
						<label>
							List
							<select bind:value={dashboard.filters.listId}>
								<option value="">Any list</option>
								{#each library.lists as list (list.id)}
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
						<input type="checkbox" bind:checked={dashboard.filters.diaryOnly} />
						Diary-logged only
					</label>
					<label class="inline">
						<input type="checkbox" bind:checked={dashboard.filters.heartedOnly} />
						Hearted only
					</label>
				</div>
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
