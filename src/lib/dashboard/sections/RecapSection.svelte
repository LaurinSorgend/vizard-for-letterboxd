<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import YearRecap from '$lib/wrapped/YearRecap.svelte';
	import { LABELS } from '$lib/wrapped/labels';
	import { recapYears } from '$lib/year';
	import Section from '../Section.svelte';
	import { getDashboard } from '../state.svelte';

	const library = getLibrary();
	const dashboard = getDashboard();
	const years = $derived(recapYears(dashboard.films, new Date()));
</script>

{#if years.length > 0}
	<Section id="recap" title={LABELS.title}>
		<YearRecap
			films={dashboard.films}
			{years}
			watchlist={library.watchlist}
			collections={library.collections}
			viewer={library.displayName}
		/>
	</Section>
{/if}
