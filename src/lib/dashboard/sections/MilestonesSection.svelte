<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import Milestones from '$lib/viz/Milestones.svelte';
	import { buildMilestones } from '$lib/viz/milestones';

	const dashboard = getDashboard();

	const milestones = $derived(buildMilestones(dashboard.films));
</script>

{#if milestones.length > 0}
	<Section id="milestones" title="Milestones">
		<Milestones {milestones} />
	</Section>
{/if}
