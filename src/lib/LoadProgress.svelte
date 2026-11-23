<script lang="ts">
	import type { Progress } from '$lib/ingest/pipeline';
	import type { LibrarySource } from '$lib/store';

	let {
		progress,
		source,
		subject = 'your',
		labelPrefix = '',
		oncancel
	}: {
		progress: Progress;
		source: LibrarySource;
		subject?: string;
		labelPrefix?: string;
		oncancel: () => void;
	} = $props();

	const { stage, done, total } = $derived(progress);
	const prefix = $derived(labelPrefix ? `${labelPrefix} ` : '');
</script>

<div class="progress" role="status">
	{#if total === 0}
		<p>
			{source === 'feed' ? `Reading ${subject} diary feed…` : `Reading ${subject} export…`}
		</p>
	{:else if stage === 'ratings'}
		<p>Looking up ratings… <span data-numeric>{done} / {total}</span></p>
		<progress value={done} max={total} aria-label="{prefix}Ratings lookup progress"></progress>
	{:else}
		<p>Looking up film data… <span data-numeric>{done} / {total}</span></p>
		<progress value={done} max={total} aria-label="{prefix}Film lookup progress"></progress>
	{/if}
	<button type="button" class="cancel" onclick={oncancel}>Cancel</button>
</div>

<style>
	.progress {
		text-align: center;
		padding: 48px 0;
	}
	progress {
		width: min(400px, 100%);
		accent-color: var(--accent);
	}
	.cancel {
		display: block;
		margin: 16px auto 0;
		font: inherit;
		padding: 2px 8px;
		color: var(--fg);
		background: var(--bg-secondary);
		border: 1px solid var(--border-strong);
		cursor: pointer;
	}
	.cancel:hover {
		background: var(--surface);
	}
	.cancel:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
