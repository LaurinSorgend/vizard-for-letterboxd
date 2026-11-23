import { count } from '$lib/format';
import { averageRating, countries, hours, topRated } from '$lib/year/facts/totals';
import { streak } from '$lib/year/facts/timing';
import { imageUrl } from '$lib/film/links';
import { alsoTrueLine } from '$lib/year/verdict';
import {
	ensureFonts,
	fitFont,
	font,
	grain,
	loadImage,
	posterBox,
	rgba,
	wrap,
	type Block,
	type Palette
} from './canvas';
import { CARD_POSTERS, drawGate, isDense } from './look';
import { LABELS, TOP_FILMS } from './labels';
import type { DeckInput, Scene, Stat } from './scenes/shared';

/* A mounted transparency: dark mount all round, a deeper strip at the foot for the
 * stamp, and the lit field between them. `margin` is mount plus the field's own inset,
 * so every block below still measures from the card edge. */
const STORY = { width: 1080, height: 1920, mount: 56, strip: 148, margin: 128 };
const POSTER = { width: 1080, height: 1350, mount: 56, strip: 136, margin: 124 };

/** Printed on the mount of the card people actually hand around. */
const SITE = 'vizard.sorgend.org';

/** Filename for a saved summary poster or single-scene story card. */
export function cardFilename(year: number, sceneId?: string): string {
	return `${year}-in-cinema${sceneId ? `-${sceneId}` : ''}.png`;
}

function surface(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('This browser will not give us a canvas to draw on.');
	ctx.textBaseline = 'top';
	return [canvas, ctx];
}

type Mount = { width: number; height: number; mount: number; strip: number };

function fieldOf(size: Mount) {
	return {
		x: size.mount,
		y: size.mount,
		width: size.width - size.mount * 2,
		height: size.height - size.mount - size.strip
	};
}

function ground(ctx: CanvasRenderingContext2D, size: Mount, palette: Palette): void {
	ctx.fillStyle = palette.room;
	ctx.fillRect(0, 0, size.width, size.height);
	const field = fieldOf(size);
	ctx.fillStyle = palette.screen;
	ctx.fillRect(field.x, field.y, field.width, field.height);
	ctx.fillStyle = palette.cast;
	ctx.fillRect(field.x, field.y, field.width, field.height);
}

/** Everything the projector adds after the picture: lens falloff, dust, emulsion, stamp. */
function finish(
	ctx: CanvasRenderingContext2D,
	size: Mount & { margin: number },
	palette: Palette,
	right: string,
	url?: string
): void {
	const field = fieldOf(size);
	drawGate(ctx, field);
	ctx.save();
	ctx.beginPath();
	ctx.rect(field.x, field.y, field.width, field.height);
	ctx.clip();
	grain(ctx, size.width, size.height);
	ctx.restore();
	stamp(ctx, size, palette, right, url);
}

/** The stamp on the mount, the way a slide carries its date and its place in the tray. */
function stamp(
	ctx: CanvasRenderingContext2D,
	size: Mount & { margin: number },
	palette: Palette,
	right: string,
	url?: string
): void {
	const field = fieldOf(size);
	const centre = field.y + field.height + size.strip / 2;
	ctx.font = font(palette.faces, 'mono', 26);
	ctx.fillStyle = palette.stamp;
	ctx.fillText('VIZARD FOR LETTERBOXD', size.mount, url ? centre - 30 : centre - 13);
	if (url) {
		ctx.fillStyle = palette.screen;
		ctx.fillText(url, size.mount, centre + 4);
	}
	ctx.textAlign = 'right';
	ctx.fillStyle = palette.stamp;
	ctx.fillText(right, size.width - size.mount, centre - 13);
	ctx.textAlign = 'left';
}

function valueBlock(ctx: CanvasRenderingContext2D, scene: Scene, palette: Palette): Block {
	const measure = STORY.width - STORY.margin * 2;
	const size = fitFont(
		ctx,
		palette.faces,
		scene.value,
		measure,
		scene.valueKind === 'number' ? 240 : 128,
		56
	);
	return {
		height: size * 1.02,
		draw: (y) => {
			ctx.font = font(palette.faces, 'value', size);
			ctx.fillStyle = palette.accent;
			ctx.fillText(scene.value, STORY.margin, y);
		}
	};
}

function labelBlock(ctx: CanvasRenderingContext2D, scene: Scene, palette: Palette): Block {
	return {
		height: 96,
		draw: (y) => {
			const width = Math.min(520, STORY.width - STORY.margin * 2);
			ctx.fillStyle = palette.accent;
			ctx.fillRect(STORY.margin, y, width, 6);
			ctx.font = font(palette.faces, 'label', 54);
			ctx.fillStyle = palette.ink;
			ctx.fillText(scene.label, STORY.margin, y + 24);
		}
	};
}

function noteBlock(ctx: CanvasRenderingContext2D, scene: Scene, palette: Palette): Block {
	ctx.font = font(palette.faces, 'body', 36);
	const lines = wrap(ctx, scene.note, STORY.width - STORY.margin * 2, 4);
	const footnote = scene.footnote ?? '';
	return {
		height: lines.length * 50 + 16 + (footnote ? 44 : 0),
		draw: (y) => {
			ctx.font = font(palette.faces, 'body', 36);
			ctx.fillStyle = palette.muted;
			lines.forEach((line, i) => ctx.fillText(line, STORY.margin, y + i * 50));
			if (!footnote) return;
			ctx.font = font(palette.faces, 'mono', 26);
			ctx.fillStyle = palette.muted;
			ctx.fillText(footnote, STORY.margin, y + lines.length * 50 + 12);
		}
	};
}

function posterBlock(
	ctx: CanvasRenderingContext2D,
	names: string[],
	metas: string[],
	images: (HTMLImageElement | null)[],
	palette: Palette
): Block {
	const measure = STORY.width - STORY.margin * 2;
	const gap = 16;
	const columns = Math.min(images.length, CARD_POSTERS);
	const width = columns === 1 ? 320 : (measure - gap * (columns - 1)) / columns;
	const height = width * 1.5;
	return {
		height: height + 52,
		draw: (y) => {
			images.slice(0, columns).forEach((image, i) => {
				const x = STORY.margin + i * (width + gap);
				posterBox(ctx, image, names[i], { x, y, width, height }, palette);
				if (!metas[i]) return;
				ctx.font = font(palette.faces, 'mono', 26);
				ctx.fillStyle = palette.accent;
				ctx.fillText(metas[i], x, y + height + 14);
			});
		}
	};
}

const BAR_LABEL_SIZE = 32;
const BAR_VALUE_SIZE = 28;
const BAR_ROW_HEIGHT = 56;
const BAR_TRACK_HEIGHT = 24;
const BAR_LABEL_GAP = 20;
const BAR_VALUE_GAP = 16;
const BAR_MIN_LABEL_WIDTH = 160;
const BAR_MAX_LABEL_WIDTH = 300;
const BAR_MIN_VALUE_WIDTH = 64;
const BAR_MAX_VALUE_WIDTH = 140;
const DENSE_LABEL_SIZES = [24, 22, 20, 18, 16, 14] as const;

/** Trims `text` with an ellipsis until `measure` fits inside `maxWidth` pixels. */
export function truncateText(
	text: string,
	maxWidth: number,
	measure: (value: string) => number
): string {
	if (maxWidth <= 0) return '';
	if (measure(text) <= maxWidth) return text;
	let trimmed = text.trimEnd();
	while (trimmed.length > 1 && measure(`${trimmed}…`) > maxWidth) {
		trimmed = trimmed.slice(0, -1).trimEnd();
	}
	return `${trimmed}…`;
}

export interface HorizontalBarRow {
	label: string;
	value: string;
	share: number;
}

export interface HorizontalBarLayout {
	labelWidth: number;
	trackX: number;
	trackWidth: number;
	valueWidth: number;
	rowHeight: number;
	trackHeight: number;
	rows: HorizontalBarRow[];
}

/**
 * Computes non-overlapping column geometry for horizontal bar rows, clamping long labels and
 * values with an ellipsis so neither ever prints over the bar track.
 */
export function horizontalBarLayout(
	bars: { label: string; value: string; share: number }[],
	measureTotal: number,
	measureLabel: (text: string) => number,
	measureValue: (text: string) => number
): HorizontalBarLayout {
	const widestValue = bars.reduce((max, bar) => Math.max(max, measureValue(bar.value)), 0);
	const valueWidth = Math.min(
		BAR_MAX_VALUE_WIDTH,
		Math.max(BAR_MIN_VALUE_WIDTH, Math.ceil(widestValue))
	);
	const widestLabel = bars.reduce((max, bar) => Math.max(max, measureLabel(bar.label)), 0);
	const maxAllowedLabel = Math.min(
		BAR_MAX_LABEL_WIDTH,
		Math.max(BAR_MIN_LABEL_WIDTH, measureTotal - valueWidth - BAR_LABEL_GAP - BAR_VALUE_GAP - 200)
	);
	const labelWidth = Math.min(
		maxAllowedLabel,
		Math.max(BAR_MIN_LABEL_WIDTH, Math.ceil(widestLabel))
	);
	const trackX = STORY.margin + labelWidth + BAR_LABEL_GAP;
	const trackWidth = Math.max(
		80,
		measureTotal - labelWidth - BAR_LABEL_GAP - BAR_VALUE_GAP - valueWidth
	);
	return {
		labelWidth,
		trackX,
		trackWidth,
		valueWidth,
		rowHeight: BAR_ROW_HEIGHT,
		trackHeight: BAR_TRACK_HEIGHT,
		rows: bars.map((bar) => ({
			label: truncateText(bar.label, labelWidth, measureLabel),
			value: truncateText(bar.value, valueWidth, measureValue),
			share: bar.share
		}))
	};
}

/** Picks a readable font size and label stride so dense vertical-bar axis labels never collide. */
export function denseBarLabelSpec(
	labels: string[],
	slotWidth: number,
	measureAt: (text: string, size: number) => number
): { fontSize: number; step: number } {
	const available = Math.max(12, slotWidth - 4);
	for (const size of DENSE_LABEL_SIZES) {
		const widest = labels.reduce((max, label) => Math.max(max, measureAt(label, size)), 0);
		if (widest <= available) return { fontSize: size, step: 1 };
	}
	const smallest = DENSE_LABEL_SIZES[DENSE_LABEL_SIZES.length - 1];
	const widest = labels.reduce((max, label) => Math.max(max, measureAt(label, smallest)), 0);
	const step = Math.max(1, Math.ceil((widest + 6) / Math.max(1, slotWidth)));
	return { fontSize: smallest, step };
}

function denseBarBlock(
	ctx: CanvasRenderingContext2D,
	bars: { label: string; value: string; share: number }[],
	measure: number,
	palette: Palette
): Block {
	const gap = 8;
	const width = (measure - gap * (bars.length - 1)) / bars.length;
	const tall = 190;
	const { fontSize, step } = denseBarLabelSpec(
		bars.map((bar) => bar.label),
		width + gap,
		(text, size) => {
			ctx.font = font(palette.faces, 'mono', size);
			return ctx.measureText(text).width;
		}
	);
	return {
		height: tall + 24 + fontSize,
		draw: (y) => {
			ctx.save();
			ctx.textBaseline = 'top';
			bars.forEach((bar, i) => {
				const x = STORY.margin + i * (width + gap);
				const filled = Math.max(4, bar.share * tall);
				ctx.fillStyle = palette.accent;
				ctx.fillRect(x, y + tall - filled, width, filled);
				ctx.fillStyle = palette.line;
				ctx.fillRect(x, y + tall, width, 2);
				if (i % step !== 0 && i !== bars.length - 1) return;
				ctx.font = font(palette.faces, 'mono', fontSize);
				ctx.fillStyle = palette.muted;
				ctx.textAlign = 'center';
				ctx.fillText(bar.label, x + width / 2, y + tall + 14);
			});
			ctx.restore();
		}
	};
}

function barBlock(
	ctx: CanvasRenderingContext2D,
	bars: { label: string; value: string; share: number }[],
	palette: Palette
): Block {
	const measure = STORY.width - STORY.margin * 2;
	if (isDense(bars)) return denseBarBlock(ctx, bars, measure, palette);

	const measureBody = (text: string) => {
		ctx.font = font(palette.faces, 'body', BAR_LABEL_SIZE);
		return ctx.measureText(text).width;
	};
	const measureMono = (text: string) => {
		ctx.font = font(palette.faces, 'mono', BAR_VALUE_SIZE);
		return ctx.measureText(text).width;
	};
	const layout = horizontalBarLayout(bars, measure, measureBody, measureMono);

	return {
		height: layout.rows.length * layout.rowHeight,
		draw: (y) => {
			ctx.save();
			ctx.textBaseline = 'middle';
			layout.rows.forEach((bar, i) => {
				const midY = y + i * layout.rowHeight + layout.rowHeight / 2;
				const trackTop = midY - layout.trackHeight / 2;

				ctx.font = font(palette.faces, 'body', BAR_LABEL_SIZE);
				ctx.fillStyle = palette.ink;
				ctx.textAlign = 'left';
				ctx.fillText(bar.label, STORY.margin, midY);

				ctx.fillStyle = rgba(palette.ink, 0.12);
				ctx.fillRect(layout.trackX, trackTop, layout.trackWidth, layout.trackHeight);
				const filled = Math.max(4, layout.trackWidth * bar.share);
				ctx.fillStyle = palette.accent;
				ctx.fillRect(layout.trackX, trackTop, filled, layout.trackHeight);

				ctx.font = font(palette.faces, 'mono', BAR_VALUE_SIZE);
				ctx.fillStyle = palette.muted;
				ctx.textAlign = 'right';
				ctx.fillText(bar.value, STORY.width - STORY.margin, midY);
			});
			ctx.restore();
		}
	};
}

const STAT_LABEL = 24;
const STAT_VALUE = 40;

export interface StatColumn {
	x: number;
	label: string;
	value: string;
}

/**
 * Where the first three stats sit, left to right: each column is as wide as its own label or
 * value, whichever is wider, so a long label never prints over the next column.
 */
export function statColumns(
	stats: Stat[],
	measure: (text: string, size: number) => number
): StatColumn[] {
	let x = STORY.margin;
	return stats.slice(0, 3).map((stat) => {
		const value = stat.value.length > 18 ? `${stat.value.slice(0, 17)}…` : stat.value;
		const column = { x, label: stat.label, value };
		x += Math.max(measure(value, STAT_VALUE), measure(stat.label, STAT_LABEL), 200) + 48;
		return column;
	});
}

function statBlock(ctx: CanvasRenderingContext2D, scene: Scene, palette: Palette): Block {
	const measure = (text: string, size: number) => {
		ctx.font = font(palette.faces, 'mono', size);
		return ctx.measureText(text).width;
	};
	return {
		height: 118,
		draw: (y) => {
			ctx.fillStyle = palette.line;
			ctx.fillRect(STORY.margin, y, STORY.width - STORY.margin * 2, 2);
			for (const column of statColumns(scene.stats, measure)) {
				ctx.font = font(palette.faces, 'mono', STAT_LABEL);
				ctx.fillStyle = palette.muted;
				ctx.fillText(column.label, column.x, y + 24);
				ctx.font = font(palette.faces, 'mono', STAT_VALUE);
				ctx.fillStyle = palette.ink;
				ctx.fillText(column.value, column.x, y + 58);
			}
		}
	};
}

async function bodyBlock(
	ctx: CanvasRenderingContext2D,
	scene: Scene,
	palette: Palette
): Promise<Block | null> {
	if (scene.body.kind === 'bars') return barBlock(ctx, scene.body.bars, palette);
	if (scene.body.kind !== 'posters') return null;
	const posters = scene.body.posters.slice(0, CARD_POSTERS);
	const images = await Promise.all(
		posters.map((item) => loadImage(imageUrl(item.path, posters.length === 1 ? 'w500' : 'w342')))
	);
	return posterBlock(
		ctx,
		posters.map((item) => item.name),
		posters.map((item) => item.meta),
		images,
		palette
	);
}

/** One frame of the deck as a story card. */
export async function storyCard(
	scene: Scene,
	{ library, viewer }: DeckInput,
	palette: Palette
): Promise<HTMLCanvasElement> {
	await ensureFonts(palette.faces);
	const [canvas, ctx] = surface(STORY.width, STORY.height);
	ground(ctx, STORY, palette);

	const blocks: Block[] = [
		valueBlock(ctx, scene, palette),
		labelBlock(ctx, scene, palette),
		noteBlock(ctx, scene, palette)
	];
	const body = await bodyBlock(ctx, scene, palette);
	if (body) blocks.push(body);
	if (scene.stats.length > 0) blocks.push(statBlock(ctx, scene, palette));

	const field = fieldOf(STORY);
	const gap = 40;
	const total = blocks.reduce((sum, block) => sum + block.height, 0) + gap * (blocks.length - 1);
	let y = Math.max(field.y + 72, field.y + (field.height - total) / 2);
	for (const block of blocks) {
		block.draw(y);
		y += block.height + gap;
	}

	finish(ctx, STORY, palette, `${viewer ? `${viewer} · ` : ''}${library.year}`);
	return canvas;
}

function summaryStats({ library }: DeckInput): { label: string; value: string }[] {
	const avg = averageRating(library);
	const run = streak(library);
	return [
		{ label: 'FILMS', value: count(library.slice.length) },
		{ label: 'HOURS', value: count(hours(library)) },
		{ label: 'COUNTRIES', value: String(countries(library).length) },
		{ label: 'AVERAGE', value: avg !== null ? `${avg.toFixed(1)}` : '—' },
		{ label: 'GENRE', value: library.genres()[0]?.label ?? '—' },
		{ label: 'DIRECTOR', value: library.directors()[0]?.label ?? '—' },
		{ label: 'ON SCREEN', value: library.cast()[0]?.label ?? '—' },
		{ label: 'STREAK', value: run ? `${run.days} days` : '—' }
	];
}

function drawSummaryGrid(
	ctx: CanvasRenderingContext2D,
	stats: { label: string; value: string }[],
	top: number,
	row: number,
	palette: Palette
): void {
	const column = (POSTER.width - POSTER.margin * 2) / 2;
	stats.forEach((stat, i) => {
		const x = POSTER.margin + (i % 2) * column;
		const y = top + Math.floor(i / 2) * row;
		ctx.font = font(palette.faces, 'mono', 22);
		ctx.fillStyle = palette.muted;
		ctx.fillText(stat.label, x, y);
		ctx.font = font(palette.faces, 'mono', 38);
		ctx.fillStyle = palette.ink;
		const value = truncateText(stat.value, column - 24, (text) => ctx.measureText(text).width);
		ctx.fillText(value, x, y + 30);
	});
}

/** The closing word, measured so it can be hung off the bottom rail rather than flowed into it. */
function verdictBlock(
	ctx: CanvasRenderingContext2D,
	{ personality }: DeckInput,
	palette: Palette
): Block {
	const measure = POSTER.width - POSTER.margin * 2;
	const title = fitFont(ctx, palette.faces, personality.title, measure, 84, 44);
	ctx.font = font(palette.faces, 'body', 30);
	const lines = wrap(ctx, personality.detail, measure, 2);
	const runnerUp = alsoTrueLine(personality);
	return {
		height: 34 + title * 1.1 + lines.length * 40 + (runnerUp ? 34 : 0),
		draw: (y) => {
			ctx.font = font(palette.faces, 'mono', 22);
			ctx.fillStyle = palette.muted;
			ctx.fillText(LABELS.verdict.toUpperCase(), POSTER.margin, y);
			ctx.font = font(palette.faces, 'value', title);
			ctx.fillStyle = palette.accent;
			ctx.fillText(personality.title, POSTER.margin, y + 34);
			ctx.font = font(palette.faces, 'body', 30);
			ctx.fillStyle = palette.muted;
			const body = y + 34 + title * 1.1;
			lines.forEach((line, i) => ctx.fillText(line, POSTER.margin, body + i * 40));
			if (!runnerUp) return;
			ctx.font = font(palette.faces, 'mono', 22);
			ctx.fillStyle = palette.muted;
			ctx.fillText(runnerUp, POSTER.margin, body + lines.length * 40);
		}
	};
}

/** The whole year on one poster. */
export async function summaryCard(input: DeckInput, palette: Palette): Promise<HTMLCanvasElement> {
	const { library, viewer } = input;
	await ensureFonts(palette.faces);
	const [canvas, ctx] = surface(POSTER.width, POSTER.height);
	ground(ctx, POSTER, palette);
	const measure = POSTER.width - POSTER.margin * 2;

	let y = POSTER.mount + 56;
	ctx.font = font(palette.faces, 'mono', 26);
	ctx.fillStyle = palette.muted;
	ctx.fillText(viewer ? `${viewer} · A year in cinema` : 'A year in cinema', POSTER.margin, y);

	y += 44;
	const size = fitFont(ctx, palette.faces, String(library.year), measure, 176, 96);
	ctx.fillStyle = palette.accent;
	ctx.fillText(String(library.year), POSTER.margin, y);
	y += size * 1.05;

	ctx.fillStyle = palette.accent;
	ctx.fillRect(POSTER.margin, y, measure, 6);
	y += 40;

	const top = topRated(library).slice(0, TOP_FILMS);
	if (top.length > 0) {
		const images = await Promise.all(
			top.map((film) => loadImage(imageUrl(film.tmdb?.posterPath ?? null, 'w342')))
		);
		const gap = 16;
		const width = (measure - gap * (top.length - 1)) / top.length;
		const height = width * 1.5;
		images.forEach((image, i) => {
			posterBox(
				ctx,
				image,
				top[i].name,
				{ x: POSTER.margin + i * (width + gap), y, width, height },
				palette
			);
		});
		y += height + 32;
	}

	const stats = summaryStats(input);
	const verdict = verdictBlock(ctx, input, palette);
	const verdictTop = POSTER.height - POSTER.strip - 48 - verdict.height;
	const rows = Math.ceil(stats.length / 2);
	const row = Math.min(96, Math.max(72, (verdictTop - 20 - y) / rows));
	drawSummaryGrid(ctx, stats, y, row, palette);
	verdict.draw(verdictTop);

	finish(ctx, POSTER, palette, String(library.year), SITE);
	return canvas;
}
