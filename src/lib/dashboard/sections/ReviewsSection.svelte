<script lang="ts">
	import { formatShort, plural, starCaption, stars } from '$lib/format';
	import Section from '../Section.svelte';
	import { getDashboard } from '../state.svelte';
	import FilmLink from '$lib/viz/chart/FilmLink.svelte';
	import { pager } from '$lib/viz/pager.svelte';
	import { filterReviews, reviewSummary, type ReviewSort } from '$lib/viz/personal';
	import ReviewBody from '$lib/viz/ReviewBody.svelte';
	import ShowMore from '$lib/viz/ShowMore.svelte';

	const REVIEW_LIMIT = 8;
	const PREVIEW_CHARS = 320;
	const PREVIEW_LINES = 4;

	const dashboard = getDashboard();

	let query = $state('');
	let sort = $state<ReviewSort>('recent');

	const summary = $derived(reviewSummary(dashboard.films));
	const filtered = $derived(filterReviews(summary.entries, query, sort));
	const paging = pager(
		() => filtered.length,
		() => REVIEW_LIMIT,
		() => `${query}\0${sort}`
	);
	const visible = $derived(filtered.slice(0, paging.shown));

	function isLongReview(text: string): boolean {
		return text.length > PREVIEW_CHARS || text.split('\n').length > PREVIEW_LINES;
	}

	function previewText(text: string): string {
		const flattened = text.replace(/\s+/g, ' ').trim();
		if (flattened.length <= PREVIEW_CHARS) return flattened;
		const cut = flattened.slice(0, PREVIEW_CHARS);
		const lastSpace = cut.lastIndexOf(' ');
		return `${(lastSpace > PREVIEW_CHARS / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
	}
</script>

{#if summary.entries.length > 0}
	<Section id="reviews" title="Your reviews" nav="Reviews">
		<p class="chart-note">
			{plural(summary.entries.length, 'review')}, {plural(summary.totalWords, 'word')} total (avg {plural(
				Math.round(summary.avgWords ?? 0),
				'word'
			)} each).{#if summary.reviewedAvgRating !== null && summary.unreviewedAvgRating !== null}{' '}Reviewed
				films average {stars(summary.reviewedAvgRating)} vs. {stars(summary.unreviewedAvgRating)} for
				unreviewed.{/if}
		</p>

		<div class="form-controls">
			<div class="controls">
				<label class="search">
					Search reviews
					<input type="search" placeholder="Filter by title or review text" bind:value={query} />
				</label>
				<label>
					Order
					<select bind:value={sort}>
						<option value="recent">Most recent</option>
						<option value="longest">Longest</option>
						<option value="rating">Highest rated</option>
					</select>
				</label>
			</div>
			{#if query.trim().length > 0}
				<p class="summary" role="status">
					Showing <span data-numeric>{filtered.length}</span> of
					<span data-numeric>{summary.entries.length}</span> reviews
				</p>
			{/if}
		</div>

		{#if visible.length === 0}
			<p class="empty">No reviews match "{query.trim()}".</p>
		{:else}
			<ul class="reviews">
				{#each visible as entry (entry.film.uri)}
					<li>
						<div class="meta-row">
							<div class="film-head">
								<FilmLink film={entry.film} class="name" />
								{#if entry.film.year !== null}
									<span class="meta" data-numeric>{entry.film.year}</span>
								{/if}
							</div>
							<div class="facts">
								{#if entry.film.rating !== null}
									<span class="rating" data-numeric>{starCaption(entry.film.rating)}</span>
								{/if}
								{#if entry.date !== null}
									<span class="meta" data-numeric>{formatShort(entry.date)}</span>
								{/if}
								<span class="meta" data-numeric>{plural(entry.words, 'word')}</span>
							</div>
						</div>

						{#if isLongReview(entry.plain)}
							<details class="expandable">
								<summary>
									<span class="preview">{previewText(entry.plain)}</span>
									<span class="toggle more-label">Read full review</span>
									<span class="toggle less-label">Show less</span>
								</summary>
								<div class="full">
									<ReviewBody text={entry.text} />
								</div>
							</details>
						{:else}
							<ReviewBody text={entry.text} />
						{/if}
					</li>
				{/each}
			</ul>
			<ShowMore pager={paging} />
		{/if}
	</Section>
{/if}

<style>
	.controls {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(160px, 1fr);
		gap: 12px;
		align-items: end;
		margin-bottom: 12px;
	}
	@media (max-width: 540px) {
		.controls {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		min-width: 0;
	}
	.reviews {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--border);
	}
	.reviews li {
		padding: 12px 0;
		border-bottom: 1px solid var(--border);
	}
	.meta-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 16px;
		margin-bottom: 6px;
	}
	.film-head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}
	.film-head :global(.name) {
		font-size: var(--text-base);
		font-weight: 500;
		color: var(--fg);
	}
	.film-head :global(a.name) {
		color: var(--accent);
		text-decoration: none;
	}
	.film-head :global(a.name:hover) {
		text-decoration: underline;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 12px;
	}
	.rating {
		font-size: var(--text-sm);
		color: var(--fg);
	}
	.meta {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
	}
	.expandable summary {
		cursor: pointer;
		list-style: none;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		min-height: 24px;
	}
	.expandable summary::-webkit-details-marker {
		display: none;
	}
	.preview {
		font-size: var(--text-base);
		line-height: var(--leading-normal);
		max-width: var(--measure);
		color: var(--fg);
	}
	.toggle {
		font-size: var(--text-sm);
		color: var(--accent);
		text-decoration: underline;
	}
	.expandable[open] .preview,
	.expandable[open] .more-label,
	.expandable:not([open]) .less-label {
		display: none;
	}
	.expandable[open] .full {
		margin-top: 6px;
	}
	.empty {
		margin: 12px 0 0;
		font-size: var(--text-base);
		color: var(--fg-secondary);
	}
</style>
