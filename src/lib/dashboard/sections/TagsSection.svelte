<script lang="ts">
	import { getLibrary } from '$lib/library.svelte';
	import { plural } from '$lib/format';
	import Section from '../Section.svelte';
	import { byTag, taggedFilmCount } from '$lib/viz/personal';
	import RankedBars from '$lib/viz/RankedBars.svelte';

	const library = getLibrary();

	const tags = $derived(byTag(library.films));
	const tagged = $derived(taggedFilmCount(library.films));
</script>

{#if tags.length > 0}
	<Section id="tags" title="Your tags" nav="Tags">
		<p class="chart-note">
			{plural(tags.length, 'distinct tag')} across {plural(tagged, 'tagged film')}.
		</p>
		<RankedBars data={tags} limit={15} description="Films and average rating per diary tag" />
	</Section>
{/if}
