<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import Mosaic from '$lib/viz/Mosaic.svelte';

	const dashboard = getDashboard();
</script>

<Section id="mosaic" title="Every film you have watched" nav="All films">
	<Mosaic films={dashboard.films} />
</Section>
