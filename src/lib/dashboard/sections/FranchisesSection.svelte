<script lang="ts">
	import { collectionShare } from '$lib/film/tally';
	import { getLibrary } from '$lib/library.svelte';
	import FranchiseBars from '$lib/viz/FranchiseBars.svelte';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import { franchiseProgress, sortFranchises, type FranchiseSort } from '$lib/viz/franchises';
	import Section from '../Section.svelte';
	import { getDashboard } from '../state.svelte';

	const library = getLibrary();
	const dashboard = getDashboard();

	let sort: FranchiseSort = $state('count');

	const base = $derived(franchiseProgress(dashboard.films, library.collections));
	const hasTotals = $derived(base.some((f) => f.total !== null));
	const hasRatings = $derived(base.some((f) => f.avg !== null));
	const sortOptions = $derived([
		{ value: 'count' as const, label: 'Most watched' },
		...(hasRatings ? [{ value: 'rating' as const, label: 'Most liked' }] : []),
		...(hasTotals ? [{ value: 'completion' as const, label: 'Most complete' }] : [])
	]);
	const activeSort = $derived<FranchiseSort>(
		sortOptions.some((option) => option.value === sort) ? sort : 'count'
	);
	const franchises = $derived(activeSort === 'count' ? base : sortFranchises(base, activeSort));
	const share = $derived(collectionShare(dashboard.films));
	const completed = $derived(base.filter((f) => f.completed).length);
</script>

{#if franchises.length > 0}
	<Section id="franchises" title="Franchises you follow" nav="Franchises">
		<p class="chart-note">
			{share.inCollection} of your {share.total} films are part of a franchise{#if completed > 0};
				{completed} completed{/if}.
		</p>
		{#if sortOptions.length > 1}
			<MetricToggle
				name="franchise-sort"
				label="Sort franchises by"
				options={sortOptions}
				bind:value={sort}
			/>
		{/if}
		<FranchiseBars
			data={franchises}
			description="Franchise completion, watched count and average rating"
		/>
	</Section>
{/if}
