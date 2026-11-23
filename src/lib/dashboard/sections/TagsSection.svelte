<script lang="ts">
	import { byTag, cleanTags } from '$lib/film/tally';
	import { plural } from '$lib/format';
	import Section from '../Section.svelte';
	import { getDashboard } from '../state.svelte';
	import RankedBars from '$lib/viz/RankedBars.svelte';

	const dashboard = getDashboard();

	const tags = $derived(byTag(dashboard.films));
	const tagged = $derived(dashboard.films.filter((film) => cleanTags(film.tags).length > 0).length);
</script>

{#if tags.length > 0}
	<Section id="tags" title="Your tags" nav="Tags">
		<p class="chart-note">
			{plural(tags.length, 'distinct tag')} across {plural(tagged, 'tagged film')}.
		</p>
		<RankedBars data={tags} limit={15} description="Films and average rating per diary tag" />
	</Section>
{/if}
