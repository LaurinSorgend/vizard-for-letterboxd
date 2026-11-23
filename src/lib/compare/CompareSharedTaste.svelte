<script lang="ts">
	import { count, percent, stars } from '$lib/format';
	import ShowMore from '$lib/viz/ShowMore.svelte';
	import { pager } from '$lib/viz/pager.svelte';
	import type { SharedDirector, SharedGenre } from './compare';

	const PAGE_SIZE = 12;

	let {
		sharedDirectors,
		sharedGenres,
		yourName,
		friendName
	}: {
		sharedDirectors: SharedDirector[];
		sharedGenres: SharedGenre[];
		yourName: string;
		friendName: string;
	} = $props();

	const directorPager = pager(
		() => sharedDirectors.length,
		() => PAGE_SIZE
	);
	const genrePager = pager(
		() => sharedGenres.length,
		() => PAGE_SIZE
	);

	const visibleDirectors = $derived(sharedDirectors.slice(0, directorPager.shown));
	const visibleGenres = $derived(sharedGenres.slice(0, genrePager.shown));

	const maxDirectorCount = $derived(
		Math.max(1, ...sharedDirectors.map((d) => Math.max(d.countA, d.countB)))
	);
	const maxGenreShare = $derived(
		Math.max(0.01, ...sharedGenres.map((g) => Math.max(g.shareA, g.shareB)))
	);
</script>

<section class="compare-block" aria-labelledby="compare-taste-heading">
	<h3 id="compare-taste-heading" class="heading">Shared taste</h3>

	<div class="legend" aria-hidden="true">
		<span class="legend-item"><span class="swatch you"></span>{yourName}</span>
		<span class="legend-item"><span class="swatch friend"></span>{friendName}</span>
	</div>

	<div class="pair">
		<div>
			<h4>Shared directors (<span data-numeric>{count(sharedDirectors.length)}</span>)</h4>
			{#if sharedDirectors.length === 0}
				<p class="empty">No directors in common across matched films.</p>
			{:else}
				<div class="table-wrap">
					<table class="compare-table">
						<thead>
							<tr>
								<th scope="col">Director</th>
								<th scope="col" class="num">{yourName}</th>
								<th scope="col" class="num">{friendName}</th>
							</tr>
						</thead>
						<tbody>
							{#each visibleDirectors as dir (dir.key)}
								<tr>
									<td class="label-col">
										{#if dir.href}
											<a href={dir.href} target="_blank" rel="noopener">{dir.name}</a>
										{:else}
											<span>{dir.name}</span>
										{/if}
										<div class="bars" aria-hidden="true">
											<span class="bar you" style="width: {(dir.countA / maxDirectorCount) * 100}%;"
											></span>
											<span
												class="bar friend"
												style="width: {(dir.countB / maxDirectorCount) * 100}%;"
											></span>
										</div>
									</td>
									<td class="num" data-numeric>
										<div>{count(dir.countA)}</div>
										<div class="sub">{stars(dir.avgA)}</div>
									</td>
									<td class="num" data-numeric>
										<div>{count(dir.countB)}</div>
										<div class="sub">{stars(dir.avgB)}</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<ShowMore pager={directorPager} />
			{/if}
		</div>

		<div>
			<h4>Shared genres (<span data-numeric>{count(sharedGenres.length)}</span>)</h4>
			{#if sharedGenres.length === 0}
				<p class="empty">No genres in common across matched films.</p>
			{:else}
				<div class="table-wrap">
					<table class="compare-table">
						<thead>
							<tr>
								<th scope="col">Genre</th>
								<th scope="col" class="num">{yourName}</th>
								<th scope="col" class="num">{friendName}</th>
							</tr>
						</thead>
						<tbody>
							{#each visibleGenres as genre (genre.name)}
								<tr>
									<td class="label-col">
										<span>{genre.name}</span>
										<div class="bars" aria-hidden="true">
											<span class="bar you" style="width: {(genre.shareA / maxGenreShare) * 100}%;"
											></span>
											<span
												class="bar friend"
												style="width: {(genre.shareB / maxGenreShare) * 100}%;"
											></span>
										</div>
									</td>
									<td class="num" data-numeric>
										<div>{count(genre.countA)} ({percent(genre.shareA)})</div>
										<div class="sub">{stars(genre.avgA)}</div>
									</td>
									<td class="num" data-numeric>
										<div>{count(genre.countB)} ({percent(genre.shareB)})</div>
										<div class="sub">{stars(genre.avgB)}</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<ShowMore pager={genrePager} />
			{/if}
		</div>
	</div>
</section>

<style>
	.heading {
		margin-bottom: 8px;
	}
	h4 {
		margin: 0 0 8px;
		color: var(--fg);
	}
	.pair {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 32px;
		align-items: start;
	}
	@media (max-width: 900px) {
		.pair {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.sub {
		font-size: var(--text-xs);
		color: var(--fg-secondary);
	}
	.label-col {
		min-width: 130px;
	}
	.label-col a {
		color: var(--fg);
		text-decoration: none;
	}
	.label-col a:hover {
		color: var(--accent);
		text-decoration: underline;
	}
	.bars {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 4px;
	}
	.bar {
		display: block;
		height: 4px;
		min-width: 2px;
	}
</style>
