<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import { formatDays } from '$lib/format';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import { medianWatchLag, watchLag } from '$lib/viz/stats';

	const dashboard = getDashboard();

	const medianLag = $derived(medianWatchLag(dashboard.films));
</script>

<Section id="lag" title="From release to watch" nav="Release to watch">
	{#if medianLag !== null}
		<p class="chart-note">
			Median gap: {formatDays(medianLag)} from release to first watch.
		</p>
	{/if}
	<RankedBars
		data={watchLag(dashboard.films)}
		description="Films and average rating per gap between release and first watch"
	/>
</Section>
