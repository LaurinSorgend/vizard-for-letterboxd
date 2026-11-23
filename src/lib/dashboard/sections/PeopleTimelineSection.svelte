<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import PeopleTimeline from '$lib/viz/PeopleTimeline.svelte';

	const dashboard = getDashboard();
</script>

<Section id="people-timeline" title="Watching them over time" nav="People over time">
	<PeopleTimeline films={dashboard.films} />
</Section>
