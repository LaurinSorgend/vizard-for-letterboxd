<script lang="ts">
	import { parseReviewMarkup, type ReviewNode } from './reviewMarkup';

	let { text }: { text: string } = $props();
	const nodes = $derived(parseReviewMarkup(text));
</script>

{#snippet render(items: ReviewNode[])}
	{#each items as node, i (i)}
		{#if node.type === 'text'}
			{node.text}
		{:else if node.type === 'br'}
			<br />
		{:else if node.type === 'em'}
			<em>{@render render(node.children)}</em>
		{:else if node.type === 'strong'}
			<strong>{@render render(node.children)}</strong>
		{:else if node.type === 's'}
			<s>{@render render(node.children)}</s>
		{:else if node.type === 'blockquote'}
			<blockquote>{@render render(node.children)}</blockquote>
		{:else if node.type === 'a'}
			<a href={node.href} target="_blank" rel="noopener noreferrer">
				{@render render(node.children)}
			</a>
		{/if}
	{/each}
{/snippet}

<div class="body">{@render render(nodes)}</div>

<style>
	.body {
		margin: 0;
		font-size: var(--text-base);
		line-height: var(--leading-normal);
		max-width: var(--measure);
		white-space: pre-line;
		color: var(--fg);
	}
	.body em {
		font-style: italic;
	}
	.body strong {
		font-weight: 700;
	}
	.body blockquote {
		margin: 8px 0;
		padding: 4px 0 4px 12px;
		border-left: 2px solid var(--border-strong);
		color: var(--fg-secondary);
	}
	.body blockquote:first-child {
		margin-top: 0;
	}
	.body blockquote:last-child {
		margin-bottom: 0;
	}
	.body a {
		color: var(--accent);
		text-decoration: underline;
	}
</style>
