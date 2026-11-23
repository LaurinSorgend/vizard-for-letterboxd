<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import Columns from '$lib/viz/Columns.svelte';
	import { releaseDecades, watchesPerYear } from '$lib/viz/stats';

	const dashboard = getDashboard();
</script>

<Section id="years" title="Through the years">
	<div class="pair">
		<div>
			<h3>Watches per year (diary)</h3>
			<Columns data={watchesPerYear(dashboard.films)} description="Diary entries per year" />
		</div>
		<div>
			<h3>Films by release decade</h3>
			<Columns data={releaseDecades(dashboard.films)} description="Films per release decade" />
		</div>
	</div>
</Section>
