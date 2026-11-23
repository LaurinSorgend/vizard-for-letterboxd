<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import Scatter from '$lib/viz/Scatter.svelte';

	const dashboard = getDashboard();
</script>

<Section id="length" title="Does length buy quality?" nav="Length vs. rating">
	<Scatter films={dashboard.films} />
</Section>
