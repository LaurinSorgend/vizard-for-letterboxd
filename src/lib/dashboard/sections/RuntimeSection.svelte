<script lang="ts">
	import { getDashboard } from '../state.svelte';
	import Section from '../Section.svelte';
	import { isSeries } from '$lib/film/runtime';
	import MetricToggle from '$lib/viz/MetricToggle.svelte';
	import RankedBars from '$lib/viz/RankedBars.svelte';
	import { runtimeBuckets } from '$lib/viz/stats';

	const dashboard = getDashboard();

	let runtimeScope = $state<'films' | 'all'>('films');
	const films = $derived(dashboard.films);
	const hasMovies = $derived(films.some((f) => !isSeries(f) && !!f.tmdb?.runtime));
	const hasSeries = $derived(films.some((f) => isSeries(f) && !!f.tmdb?.runtime));
	const showToggle = $derived(hasMovies && hasSeries);
	const runtimes = $derived(
		runtimeBuckets(
			!showToggle || runtimeScope === 'all' ? films : films.filter((f) => !isSeries(f))
		)
	);
</script>

<Section id="runtime" title="How long you watch">
	{#if showToggle}
		<MetricToggle
			name="runtime-scope"
			label="Runtime scope"
			options={[
				{ value: 'films', label: 'Films only' },
				{ value: 'all', label: 'With series' }
			]}
			bind:value={runtimeScope}
		/>
	{/if}
	<RankedBars data={runtimes} description="Films and average rating per runtime band" />
</Section>
