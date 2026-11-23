<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import Quadrants from '$lib/viz/Quadrants.svelte';

	const dashboard = getDashboard();
</script>

<Section id="quadrants" title="Popularity vs. your rating" nav="Popularity">
	<Quadrants films={dashboard.films} />
</Section>
