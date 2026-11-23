<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import RecentWatches from '$lib/viz/RecentWatches.svelte';
	import { recentWatches } from '$lib/viz/stats';

	const dashboard = getDashboard();

	const recent = $derived(recentWatches(dashboard.films));
</script>

{#if recent.length > 0}
	<Section id="recent" title="Recently watched">
		<RecentWatches watches={recent} />
	</Section>
{/if}
