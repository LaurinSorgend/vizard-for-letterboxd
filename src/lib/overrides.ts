import { filmKey, normalizeUri } from '$lib/film/identity';
import { readPref, removePref, writePref } from '$lib/prefs';
import { isTmdbId, isTmdbRef, type TmdbRef } from '$lib/types';

const STORAGE_KEY = 'vizard:tmdb-overrides';

export type OverrideMap = Record<string, TmdbRef>;

function parseTmdbUrl(raw: string): TmdbRef | null {
	let url: URL;
	try {
		url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
	} catch {
		return null;
	}
	if (!/^(?:www\.)?themoviedb\.org$/i.test(url.hostname)) return null;
	const match = /^\/(movie|tv)\/(\d+)(?:-[^/]*)?(?:\/|$)/i.exec(url.pathname);
	if (!match) return null;
	const tmdbId = Number.parseInt(match[2], 10);
	return isTmdbId(tmdbId) ? { mediaType: match[1].toLowerCase() as 'movie' | 'tv', tmdbId } : null;
}

/**
 * Accepts plain numeric IDs (`550`), prefixed targets (`movie/550`, `tv/1399`, `tv:1399`),
 * or TMDB web URLs (`https://www.themoviedb.org/movie/550-fight-club`).
 */
export function parseTmdbOverride(raw: string): TmdbRef | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	const plain = /^(\d+)$/.exec(trimmed);
	if (plain) {
		const tmdbId = Number.parseInt(plain[1], 10);
		return isTmdbId(tmdbId) ? { mediaType: 'movie', tmdbId } : null;
	}

	const prefixed = /^(movie|tv)[/:](\d+)(?:-[^\s/?#]*)?$/i.exec(trimmed);
	if (prefixed) {
		const tmdbId = Number.parseInt(prefixed[2], 10);
		if (!isTmdbId(tmdbId)) return null;
		return { mediaType: prefixed[1].toLowerCase() as 'movie' | 'tv', tmdbId };
	}

	return parseTmdbUrl(trimmed);
}

export function formatTmdbOverride(override: TmdbRef): string {
	return `${override.mediaType}/${override.tmdbId}`;
}

/** The film an override belongs to. Feeds and exports give different URIs for the same film. */
export type OverrideSubject = { uri: string; name: string; year: number | null };

const TITLE_PREFIX = 'title:';

/** Source-independent override key, shared by feed and export copies of a film. */
export function titleKey(subject: Pick<OverrideSubject, 'name' | 'year'>): string {
	return TITLE_PREFIX + filmKey(subject.name.trim().toLowerCase(), subject.year);
}

/** Whether two films are the same override subject, by title + year or by URI. */
export function sameSubject(a: OverrideSubject, b: OverrideSubject): boolean {
	return titleKey(a) === titleKey(b) || normalizeUri(a.uri) === normalizeUri(b.uri);
}

/** Looks up by title + year, falling back to the URI key older overrides were saved under. */
export function getOverride(overrides: OverrideMap, subject: OverrideSubject): TmdbRef | undefined {
	return overrides[titleKey(subject)] ?? overrides[normalizeUri(subject.uri)];
}

function normalizeKey(key: string): string {
	return key.startsWith(TITLE_PREFIX) ? key : normalizeUri(key);
}

export function loadOverrides(): OverrideMap {
	const raw = readPref(STORAGE_KEY);
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (!parsed || typeof parsed !== 'object') return {};
		const clean: OverrideMap = {};
		for (const [key, target] of Object.entries(parsed)) {
			if (isTmdbRef(target)) clean[normalizeKey(key)] = target;
		}
		return clean;
	} catch {
		return {};
	}
}

function persistOverrides(overrides: OverrideMap): void {
	if (Object.keys(overrides).length === 0) removePref(STORAGE_KEY);
	else writePref(STORAGE_KEY, JSON.stringify(overrides));
}

/** Saves under the title + year key and drops any older URI key for the same film. */
export function saveOverride(
	current: OverrideMap,
	subject: OverrideSubject,
	target: TmdbRef
): OverrideMap {
	const next = { ...current, [titleKey(subject)]: target };
	delete next[normalizeUri(subject.uri)];
	persistOverrides(next);
	return next;
}

export function removeOverride(current: OverrideMap, subject: OverrideSubject): OverrideMap {
	const keys = [titleKey(subject), normalizeUri(subject.uri)].filter((key) => key in current);
	if (keys.length === 0) return current;
	const next = { ...current };
	for (const key of keys) delete next[key];
	persistOverrides(next);
	return next;
}
