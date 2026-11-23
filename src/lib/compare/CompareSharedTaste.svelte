<script lang="ts">
	import { letterboxdPersonUrl } from '$lib/film/links';
	import { count, percent, stars } from '$lib/format';
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

	let showAllDirectors = $state(false);
	let showAllGenres = $state(false);

	const visibleDirectors = $derived(
		showAllDirectors ? sharedDirectors : sharedDirectors.slice(0, PAGE_SIZE)
	);
	const visibleGenres = $derived(showAllGenres ? sharedGenres : sharedGenres.slice(0, PAGE_SIZE));

	const maxDirectorCount = $derived(
		Math.max(1, ...sharedDirectors.map((d) => Math.max(d.countA, d.countB)))
	);
	const maxGenreShare = $derived(
		Math.max(0.01, ...sharedGenres.map((g) => Math.max(g.shareA, g.shareB)))
	);
</script>

<section class="compare-block" aria-labelledby="compare-taste-heading">
	<h3 id="compare-taste-heading">Shared taste</h3>

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
					<table>
						<thead>
							<tr>
								<th scope="col">Director</th>
								<th scope="col" class="num">{yourName}</th>
								<th scope="col" class="num">{friendName}</th>
							</tr>
						</thead>
						<tbody>
							{#each visibleDirectors as dir (`${dir.tmdbId ?? dir.name}`)}
								<tr>
									<td class="label-col">
										<a
											href={letterboxdPersonUrl('director', dir.name)}
											target="_blank"
											rel="noopener"
										>
											{dir.name}
										</a>
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

				{#if sharedDirectors.length > PAGE_SIZE}
					<button
						type="button"
						class="more-btn"
						onclick={() => (showAllDirectors = !showAllDirectors)}
					>
						{showAllDirectors ? `Show top ${PAGE_SIZE}` : `Show all (${sharedDirectors.length})`}
					</button>
				{/if}
			{/if}
		</div>

		<div>
			<h4>Shared genres (<span data-numeric>{count(sharedGenres.length)}</span>)</h4>
			{#if sharedGenres.length === 0}
				<p class="empty">No genres in common across matched films.</p>
			{:else}
				<div class="table-wrap">
					<table>
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

				{#if sharedGenres.length > PAGE_SIZE}
					<button type="button" class="more-btn" onclick={() => (showAllGenres = !showAllGenres)}>
						{showAllGenres ? `Show top ${PAGE_SIZE}` : `Show all (${sharedGenres.length})`}
					</button>
				{/if}
			{/if}
		</div>
	</div>
</section>

<style>
	.compare-block {
		margin: 0 0 32px;
		padding-top: 24px;
		border-top: 1px solid var(--border);
	}
	h3 {
		margin: 0 0 8px;
		color: var(--fg);
	}
	h4 {
		margin: 0 0 8px;
		color: var(--fg);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		margin-bottom: 16px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
	}
	.you {
		background: var(--accent);
	}
	.friend {
		background: var(--bar);
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
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-sans);
	}
	th,
	td {
		padding: 8px 8px 8px 0;
		border-bottom: 1px solid var(--border);
		text-align: left;
		font-size: var(--text-sm);
		vertical-align: top;
	}
	th {
		color: var(--fg-secondary);
		font-weight: 500;
		border-bottom: 1px solid var(--border-strong);
	}
	.num {
		text-align: right;
		white-space: nowrap;
		padding-right: 0;
		padding-left: 12px;
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
	.more-btn {
		margin-top: 12px;
		font: inherit;
		font-size: var(--text-sm);
		padding: 4px 12px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-strong);
		cursor: pointer;
	}
	.more-btn:hover {
		background: var(--surface);
	}
	.empty {
		margin: 0;
		color: var(--fg-secondary);
	}
</style>
