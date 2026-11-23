export type ReviewNode =
	| { type: 'text'; text: string }
	| { type: 'br' }
	| { type: 'em'; children: ReviewNode[] }
	| { type: 'strong'; children: ReviewNode[] }
	| { type: 's'; children: ReviewNode[] }
	| { type: 'blockquote'; children: ReviewNode[] }
	| { type: 'a'; href: string; children: ReviewNode[] };

type ContainerType = 'em' | 'strong' | 's' | 'blockquote' | 'a';
type ContainerNode = Extract<ReviewNode, { type: ContainerType }>;

const MAX_DEPTH = 16;
const TAG_RE = /<(\/?)(i|em|b|strong|blockquote|s|del|br|a)(?:\s+([^>]*))?(\/?)>/gi;
const HREF_RE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

const TAG_MAP: Record<string, ContainerType> = {
	i: 'em',
	em: 'em',
	b: 'strong',
	strong: 'strong',
	s: 's',
	del: 's',
	blockquote: 'blockquote',
	a: 'a'
};

function safeHref(attrs: string | undefined): string | null {
	if (!attrs) return null;
	const match = attrs.match(HREF_RE);
	const raw = (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
	if (!/^https?:\/\//i.test(raw)) return null;
	try {
		const url = new URL(raw);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
	} catch {
		return null;
	}
}

function pushText(target: ReviewNode[], text: string): void {
	if (!text) return;
	const prev = target[target.length - 1];
	if (prev?.type === 'text') prev.text += text;
	else target.push({ type: 'text', text });
}

function trimEdgeNewlines(nodes: ReviewNode[]): void {
	const first = nodes[0];
	if (first?.type === 'text') {
		first.text = first.text.replace(/^\n+/, '');
		if (!first.text) nodes.shift();
	}
	const last = nodes[nodes.length - 1];
	if (last?.type === 'text') {
		last.text = last.text.replace(/\n+$/, '');
		if (!last.text) nodes.pop();
	}
}

function tidyBlockquotes(nodes: ReviewNode[]): ReviewNode[] {
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		if ('children' in node) tidyBlockquotes(node.children);
		if (node.type !== 'blockquote') continue;

		trimEdgeNewlines(node.children);
		const prev = nodes[i - 1];
		if (prev?.type === 'text') prev.text = prev.text.replace(/\n+$/, '');
		const next = nodes[i + 1];
		if (next?.type === 'text') next.text = next.text.replace(/^\n+/, '');
	}
	return nodes.filter((node) => node.type !== 'text' || node.text.length > 0);
}

/**
 * Parses Letterboxd review markup into a safe AST with no raw HTML output.
 * Only i/em, b/strong, s/del, blockquote, br, and http(s) links become nodes;
 * any other angle-bracket sequence remains literal escaped text.
 */
export function parseReviewMarkup(input: string): ReviewNode[] {
	const normalized = input.replace(/\r\n?/g, '\n');
	const root: ReviewNode[] = [];
	const stack: { tag: ContainerType; children: ReviewNode[] }[] = [];
	const current = () => (stack.length > 0 ? stack[stack.length - 1].children : root);

	let cursor = 0;
	for (const match of normalized.matchAll(TAG_RE)) {
		const index = match.index ?? 0;
		const [full, slash, rawName, attrs, selfClose] = match;
		pushText(current(), normalized.slice(cursor, index));
		cursor = index + full.length;

		const name = rawName.toLowerCase();
		if (name === 'br') {
			if (!slash) current().push({ type: 'br' });
			continue;
		}

		const type = TAG_MAP[name];
		if (slash) {
			const openAt = stack.findLastIndex((frame) => frame.tag === type);
			if (openAt >= 0) stack.length = openAt;
			continue;
		}

		if (selfClose || stack.length >= MAX_DEPTH) continue;
		if (type === 'a') {
			const href = safeHref(attrs);
			if (!href) continue;
			const node: ContainerNode = { type: 'a', href, children: [] };
			current().push(node);
			stack.push({ tag: 'a', children: node.children });
		} else {
			const node: ContainerNode = { type, children: [] };
			current().push(node);
			stack.push({ tag: type, children: node.children });
		}
	}

	pushText(current(), normalized.slice(cursor));
	return tidyBlockquotes(root);
}

function collectPlain(nodes: ReviewNode[], parts: string[]): void {
	for (const node of nodes) {
		if (node.type === 'text') {
			parts.push(node.text);
		} else if (node.type === 'br') {
			parts.push('\n');
		} else if (node.type === 'blockquote') {
			if (parts.length > 0 && !parts[parts.length - 1].endsWith('\n')) parts.push('\n');
			collectPlain(node.children, parts);
			parts.push('\n');
		} else {
			collectPlain(node.children, parts);
		}
	}
}

/** Extracts visible plain text from a review with supported HTML tags removed. */
export function plainReviewText(input: string): string {
	const parts: string[] = [];
	collectPlain(parseReviewMarkup(input), parts);
	return parts.join('').trim();
}
