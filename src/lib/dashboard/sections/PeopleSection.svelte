<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import { byPerson } from '$lib/film/tally';

	const dashboard = getDashboard();
</script>

<Section id="people" title="People">
	<div class="pair">
		<div>
			<h3>Most-watched directors</h3>
			<RankedBars
				data={byPerson(dashboard.films, 'directors')}
				description="Films and average rating per director"
			/>
		</div>
		<div>
			<h3>Most-watched actors</h3>
			<RankedBars
				data={byPerson(dashboard.films, 'cast')}
				description="Films and average rating per actor"
			/>
		</div>
	</div>
</Section>
