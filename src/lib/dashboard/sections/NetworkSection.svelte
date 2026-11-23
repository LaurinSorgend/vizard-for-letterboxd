<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import Network from '$lib/viz/Network.svelte';

	const dashboard = getDashboard();
</script>

<Section id="network" title="How your films connect" nav="Film network">
	<Network films={dashboard.films} />
</Section>
