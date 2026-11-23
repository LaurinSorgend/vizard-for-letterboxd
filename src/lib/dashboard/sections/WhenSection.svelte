<script lang="ts">
	import Section from '../Section.svelte';
	import { getDashboard } from '../state.svelte';
	import Heatmap from '$lib/viz/Heatmap.svelte';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import {
		bucketsByDay,
		buildDailyHeatmap,
		buildSeasonalHeatmap,
		buildWeeklyHeatmap,
		diaryYears,
		type HeatMetric,
		type SeasonScale
	} from '$lib/viz/heatmap';

	const dashboard = getDashboard();

	let heatMetric: HeatMetric = $state('rating');
	let seasonScale: SeasonScale = $state('genre');
	let chosenYear: number | null = $state(null);

	const dayBuckets = $derived(bucketsByDay(dashboard.films));
	const years = $derived(diaryYears(dayBuckets));
	const dailyYear = $derived(
		chosenYear !== null && years.includes(chosenYear)
			? chosenYear
			: (years[0] ?? new Date().getFullYear())
	);
	$effect(() => {
		if (chosenYear !== null && !years.includes(chosenYear)) chosenYear = null;
	});
	const dailyHeatmap = $derived(buildDailyHeatmap(dayBuckets, dailyYear));
	const weeklyHeatmap = $derived(buildWeeklyHeatmap(dayBuckets));
	const seasonalHeatmap = $derived(buildSeasonalHeatmap(dashboard.films, seasonScale));
</script>

<Section id="when" title="When you watch">
	<MetricToggle
		name="heat-metric"
		label="Heatmap metric"
		options={[
			{ value: 'watchtime', label: 'Watchtime' },
			{ value: 'rating', label: 'Average rating' }
		]}
		bind:value={heatMetric}
	/>
	{#if years.length > 1}
		<div class="daily-heading">
			<h3>Day by day</h3>
			<label class="year-picker">
				Year
				<select
					data-numeric
					value={dailyYear}
					onchange={(event) => (chosenYear = Number(event.currentTarget.value))}
				>
					{#each years as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</label>
		</div>
	{:else}
		<h3><span data-numeric>{dailyYear}</span>, day by day</h3>
	{/if}
	<Heatmap grid={dailyHeatmap} metric={heatMetric} />
	<h3 class="spaced">Every week, year over year</h3>
	<Heatmap grid={weeklyHeatmap} metric={heatMetric} />
	<h3 class="spaced">Genres by month, every year pooled</h3>
	{#if heatMetric === 'watchtime'}
		<MetricToggle
			name="season-scale"
			label="Genre heatmap scale"
			options={[
				{ value: 'genre', label: 'Each genre on its own scale' },
				{ value: 'global', label: 'One scale for all genres' }
			]}
			bind:value={seasonScale}
		/>
	{/if}
	<Heatmap grid={seasonalHeatmap} metric={heatMetric} cellSize={26} fitWidth />
</Section>

<style>
	.daily-heading {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		margin: 1.25rem 0 0.75rem;
	}
	.daily-heading h3 {
		margin: 0;
	}
	.year-picker {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.year-picker select {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: var(--leading-normal);
		padding: 4px 8px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
	}
</style>
