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

	it('allows http and https links and drops unsafe link protocols', () => {
		const safe = parseReviewMarkup('See <a href="https://letterboxd.com/film/heat/">Heat</a>');
		expect(safe).toEqual([
			{ type: 'text', text: 'See ' },
			{
				type: 'a',
				href: 'https://letterboxd.com/film/heat/',
				children: [{ type: 'text', text: 'Heat' }]
			}
		]);

		const unsafe = parseReviewMarkup(
			'Click <a href="javascript:alert(1)">here</a> or <a href="data:text/html,hi">there</a>'
		);
		expect(unsafe).toEqual([{ type: 'text', text: 'Click here or there' }]);
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
