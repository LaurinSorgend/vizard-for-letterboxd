import { describe, expect, it } from 'vitest';
import { parseReviewMarkup, plainReviewText } from './reviewMarkup';

describe('parseReviewMarkup', () => {
	it('parses italic, bold, strikethrough, line breaks, and blockquotes', () => {
		const nodes = parseReviewMarkup(
			'<i>Quiet</i> and <b>sharp</b>, <s>not</s> loud.<br/><blockquote>A line<br>or two</blockquote>'
		);
		expect(nodes).toEqual([
			{ type: 'em', children: [{ type: 'text', text: 'Quiet' }] },
			{ type: 'text', text: ' and ' },
			{ type: 'strong', children: [{ type: 'text', text: 'sharp' }] },
			{ type: 'text', text: ', ' },
			{ type: 's', children: [{ type: 'text', text: 'not' }] },
			{ type: 'text', text: ' loud.' },
			{ type: 'br' },
			{
				type: 'blockquote',
				children: [
					{ type: 'text', text: 'A line' },
					{ type: 'br' },
					{ type: 'text', text: 'or two' }
				]
			}
		]);
	});

	it('supports nested emphasis and strong tags and closes unclosed tags safely', () => {
		const nodes = parseReviewMarkup('<b><i>Bold italic</b> plain <em>unclosed');
		expect(nodes).toEqual([
			{
				type: 'strong',
				children: [{ type: 'em', children: [{ type: 'text', text: 'Bold italic' }] }]
			},
			{ type: 'text', text: ' plain ' },
			{ type: 'em', children: [{ type: 'text', text: 'unclosed' }] }
		]);
	});

	it('trims redundant newlines around blockquotes', () => {
		const nodes = parseReviewMarkup('Before\n\n<blockquote>\nQuoted\n</blockquote>\n\nAfter');
		expect(nodes).toEqual([
			{ type: 'text', text: 'Before' },
			{ type: 'blockquote', children: [{ type: 'text', text: 'Quoted' }] },
			{ type: 'text', text: 'After' }
		]);
	});

	it('allows http and https links and drops unsafe or malformed links', () => {
		const safe = parseReviewMarkup(
			'See <a href="https://letterboxd.com/film/heat/">Heat</a> and <a href="http://example.com/a">A</a>'
		);
		expect(safe).toEqual([
			{ type: 'text', text: 'See ' },
			{
				type: 'a',
				href: 'https://letterboxd.com/film/heat/',
				children: [{ type: 'text', text: 'Heat' }]
			},
			{ type: 'text', text: ' and ' },
			{
				type: 'a',
				href: 'http://example.com/a',
				children: [{ type: 'text', text: 'A' }]
			}
		]);

		const unsafe = parseReviewMarkup(
			'Click <a href="javascript:alert(1)">here</a>, <a href="data:text/html,hi">there</a>, or <a href="http://">nowhere</a>'
		);
		expect(unsafe).toEqual([{ type: 'text', text: 'Click here, there, or nowhere' }]);
	});

	it('normalizes CRLF, maps <del> to strikethrough, ignores stray closes, and caps nesting depth', () => {
		expect(parseReviewMarkup('Line 1\r\n<del>cut</del></i>')).toEqual([
			{ type: 'text', text: 'Line 1\n' },
			{ type: 's', children: [{ type: 'text', text: 'cut' }] }
		]);

		const deep = `${'<i>'.repeat(24)}x${'</i>'.repeat(24)}`;
		let node = parseReviewMarkup(deep)[0];
		let depth = 0;
		while (node && 'children' in node) {
			depth += 1;
			node = node.children[0];
		}
		expect(depth).toBeGreaterThan(0);
		expect(depth).toBeLessThan(24);
		expect(node).toEqual({ type: 'text', text: 'x' });
	});

	it('keeps unknown or malicious tags and angle brackets as literal text', () => {
		const input = '<script>alert(1)</script> <img src=x onerror=alert(1)> I loved it <3';
		expect(parseReviewMarkup(input)).toEqual([{ type: 'text', text: input }]);
	});
});

describe('plainReviewText', () => {
	it('strips supported markup without gluing words across blockquotes or breaks', () => {
		expect(plainReviewText('Intro<blockquote>A <i>quoted</i> line</blockquote>Outro<br>End')).toBe(
			'Intro\nA quoted line\nOutro\nEnd'
		);
	});
});
