<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import { byGenre, byLanguage } from '$lib/film/tally';

	const dashboard = getDashboard();
</script>

<Section id="genres" title="Genres & languages">
	<div class="pair">
		<div>
			<h3>Genres</h3>
			<RankedBars
				data={byGenre(dashboard.films)}
				description="Films and average rating per genre"
			/>
		</div>
		<div>
			<h3>Original language</h3>
			<RankedBars
				data={byLanguage(dashboard.films)}
				description="Films and average rating per language"
			/>
		</div>
	</div>
</Section>
