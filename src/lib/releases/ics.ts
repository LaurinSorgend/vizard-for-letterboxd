import { shiftDays } from '$lib/dates';
import { downloadBlob } from '$lib/download';
import { SITE_HOST } from '$lib/film/links';
import type { CalendarEntry } from './calendar';
import { KINDS } from './kinds';

const PRODID = '-//Vizard for Letterboxd//Release Calendar//EN';
/** RFC 5545 Section 3.1 caps content lines at 75 UTF-8 octets. */
const MAX_LINE_OCTETS = 75;
const utf8 = new TextEncoder();

export interface IcsOptions {
	region?: string;
	now?: Date;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

const compactDate = (iso: string): string => iso.replace(/-/g, '');

function formatUtcTimestamp(date: Date): string {
	const year = String(date.getUTCFullYear()).padStart(4, '0');
	const month = pad2(date.getUTCMonth() + 1);
	const day = pad2(date.getUTCDate());
	const hours = pad2(date.getUTCHours());
	const minutes = pad2(date.getUTCMinutes());
	const seconds = pad2(date.getUTCSeconds());
	return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function sanitizeUidPart(value: string): string {
	return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'entry';
}

function eventUid(entry: CalendarEntry): string {
	return `${sanitizeUidPart(entry.film.key)}-${entry.kind}-${entry.date}@${SITE_HOST}`;
}

/** Escapes text values per RFC 5545 Section 3.3.11. */
function escapeIcsText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/\r\n|\r|\n/g, '\\n')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,');
}

/** Folds a content line per RFC 5545 Section 3.1 so no physical line exceeds 75 UTF-8 octets. */
function foldIcsLine(line: string): string {
	if (utf8.encode(line).length <= MAX_LINE_OCTETS) return line;
	const chunks: string[] = [];
	let current = '';
	let bytes = 0;
	for (const char of line) {
		const charBytes = utf8.encode(char).length;
		if (bytes + charBytes > MAX_LINE_OCTETS && current.length > 0) {
			chunks.push(current);
			current = ` ${char}`;
			bytes = 1 + charBytes;
		} else {
			current += char;
			bytes += charBytes;
		}
	}
	if (current.length > 0) chunks.push(current);
	return chunks.join('\r\n');
}

function eventDescription(entry: CalendarEntry, region?: string): string {
	const kindLabel = KINDS[entry.kind].label;
	const regionNote = entry.fallbackRegion
		? ` (${entry.fallbackRegion} fallback date)`
		: region
			? ` (${region})`
			: '';
	const parts = [`${kindLabel} release${regionNote}`];
	if (entry.film.recommended) {
		parts.push(`Recommended: ${entry.film.recommended.reason}`);
	}
	if (entry.film.href) {
		parts.push(entry.film.href);
	}
	return parts.join('\n');
}

function eventLines(entry: CalendarEntry, dtstamp: string, region?: string): string[] {
	const kindLabel = KINDS[entry.kind].label;
	const start = compactDate(entry.date);
	const end = compactDate(shiftDays(entry.date, 1));
	const lines = [
		'BEGIN:VEVENT',
		`UID:${eventUid(entry)}`,
		`DTSTAMP:${dtstamp}`,
		`DTSTART;VALUE=DATE:${start}`,
		`DTEND;VALUE=DATE:${end}`,
		`SUMMARY:${escapeIcsText(`${entry.film.name} (${kindLabel})`)}`,
		`DESCRIPTION:${escapeIcsText(eventDescription(entry, region))}`
	];
	if (entry.film.href) {
		lines.push(`URL:${entry.film.href.replace(/[\r\n]+/g, '')}`);
	}
	lines.push('END:VEVENT');
	return lines;
}

/** Builds an RFC 5545 iCalendar string with one all-day VEVENT per calendar entry. */
export function buildIcs(entries: CalendarEntry[], options: IcsOptions = {}): string {
	const dtstamp = formatUtcTimestamp(options.now ?? new Date());
	const calendarName = options.region ? `Vizard Releases (${options.region})` : 'Vizard Releases';
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		`PRODID:${PRODID}`,
		'CALSCALE:GREGORIAN',
		`X-WR-CALNAME:${escapeIcsText(calendarName)}`,
		...entries.flatMap((entry) => eventLines(entry, dtstamp, options.region)),
		'END:VCALENDAR'
	];
	return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

export function downloadIcs(content: string, filename: string): void {
	downloadBlob(new Blob([content], { type: 'text/calendar;charset=utf-8' }), filename);
}
