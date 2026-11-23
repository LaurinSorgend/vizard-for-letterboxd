<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import { count, formatDays, formatShort } from '$lib/format';
	import Section from '../Section.svelte';
	import FilmLink from '$lib/viz/chart/FilmLink.svelte';
	import { pager } from '$lib/viz/pager.svelte';
	import { rewatchShifts, rewatchShiftSummary } from '$lib/viz/personal';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import ShowMore from '$lib/viz/ShowMore.svelte';
	import { mostRewatched } from '$lib/viz/stats';

	const SHIFT_LIMIT = 10;

	const library = getLibrary();

	const rewatched = $derived(mostRewatched(library.filteredFilms));
	const shifts = $derived(rewatchShifts(library.filteredFilms));
	const shiftSummary = $derived(rewatchShiftSummary(library.filteredFilms));
	const shiftPaging = pager(
		() => shifts.length,
		() => SHIFT_LIMIT
	);
	const visibleShifts = $derived(shifts.slice(0, shiftPaging.shown));

	function formatDelta(delta: number): string {
		const sign = delta > 0 ? '+' : '-';
		return `${sign}${Math.abs(delta).toFixed(1)}`;
	}

	function formatSpan(days: number): string {
		if (days === 0) return 'same day';
		if (days === 1) return '1 day';
		return formatDays(days);
	}
</script>

{#if rewatched.length > 0 || shifts.length > 0}
	<Section id="rewatches" title="Films you return to">
		{#if rewatched.length > 0}
			<RankedBars data={rewatched} description="Diary entries per rewatched film" />
		{/if}

		{#if shifts.length > 0}
			<h3 class="spaced">How your mind changed on rewatch</h3>
			<p class="chart-note">
				{count(shiftSummary.improved)} rose and {count(shiftSummary.dropped)} fell{#if shiftSummary.unchanged > 0},
					while {count(shiftSummary.unchanged)} stayed the same{/if} across multi-rated rewatches.
			</p>
			<ul class="shifts">
				{#each visibleShifts as shift (shift.film.uri)}
					<li>
						<div class="title-row">
							<FilmLink film={shift.film} class="name" />
							{#if shift.film.year !== null}
								<span class="year" data-numeric>{shift.film.year}</span>
							{/if}
						</div>
						<div class="change-row">
							<span class="ratings" data-numeric>
								★ {shift.firstRating.toFixed(1)} → ★ {shift.latestRating.toFixed(1)}
							</span>
							<span
								class="delta"
								class:up={shift.delta > 0}
								class:down={shift.delta < 0}
								data-numeric
							>
								<span aria-hidden="true">{shift.delta > 0 ? '↑' : '↓'}</span>
								{formatDelta(shift.delta)}
							</span>
						</div>
						<div class="dates" data-numeric>
							{formatShort(shift.firstDate)} → {formatShort(shift.latestDate)}
							<span class="span">({formatSpan(shift.spanDays)})</span>
						</div>
					</li>
				{/each}
			</ul>
			<ShowMore pager={shiftPaging} />
		{/if}
	</Section>
{/if}

<style>
	.shifts {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--border);
	}
	.shifts li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 16px;
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
	}
	.title-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
		flex: 1 1 200px;
	}
	.title-row :global(.name) {
		font-size: var(--text-base);
		font-weight: 500;
		color: var(--fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.title-row :global(a.name) {
		color: var(--accent);
		text-decoration: none;
	}
	.title-row :global(a.name:hover) {
		text-decoration: underline;
	}
	.year {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		flex-shrink: 0;
	}
	.change-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-shrink: 0;
	}
	.ratings {
		font-size: var(--text-sm);
		color: var(--fg);
	}
	.delta {
		display: inline-flex;
		align-items: baseline;
		gap: 4px;
		padding: 2px 6px;
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--fg);
		border: 1px solid var(--border);
	}
	.delta.up {
		background: color-mix(in srgb, var(--accent) 14%, var(--bg));
	}
	.delta.down {
		background: color-mix(in srgb, var(--error) 14%, var(--bg));
	}
	.dates {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		flex-basis: 100%;
	}
	.span {
		color: var(--fg-muted);
	}
</style>
