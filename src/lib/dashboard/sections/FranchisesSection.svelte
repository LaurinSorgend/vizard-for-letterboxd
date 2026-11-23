<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import Section from '../Section.svelte';
	import FranchiseBars from '$lib/viz/FranchiseBars.svelte';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import {
		completedFranchiseCount,
		franchiseProgress,
		type FranchiseSort
	} from '$lib/viz/franchises';
	import { collectionShare } from '$lib/film/tally';

	const library = getLibrary();

	let sort: FranchiseSort = $state('count');

	const franchises = $derived(franchiseProgress(library.films, library.collections, sort));
	const share = $derived(collectionShare(library.films));
	const completed = $derived(completedFranchiseCount(franchises));
	const hasTotals = $derived(franchises.some((f) => f.total !== null));
</script>

{#if franchises.length > 0}
	<Section id="franchises" title="Franchises you follow" nav="Franchises">
		<p class="chart-note">
			{share.inCollection} of your {share.total} films are part of a franchise{#if completed > 0};
				{completed} completed{/if}.
		</p>
		{#if hasTotals}
			<MetricToggle
				name="franchise-sort"
				label="Sort franchises by"
				options={[
					{ value: 'count', label: 'Most watched' },
					{ value: 'completion', label: 'Most complete' }
				]}
				bind:value={sort}
			/>
		{/if}
		<FranchiseBars
			data={franchises}
			description="Franchise completion, watched count and average rating"
		/>
	</Section>
{/if}
