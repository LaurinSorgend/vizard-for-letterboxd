import { normalizeUri } from '$lib/film/identity';
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

export function getOverride(overrides: OverrideMap, uri: string): TmdbRef | undefined {
	return overrides[normalizeUri(uri)];
}

export function loadOverrides(): OverrideMap {
	const raw = readPref(STORAGE_KEY);
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (!parsed || typeof parsed !== 'object') return {};
		const clean: OverrideMap = {};
		for (const [uri, target] of Object.entries(parsed)) {
			if (isTmdbRef(target)) clean[normalizeUri(uri)] = target;
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

export function saveOverride(current: OverrideMap, uri: string, target: TmdbRef): OverrideMap {
	const next = { ...current, [normalizeUri(uri)]: target };
	persistOverrides(next);
	return next;
}

export function removeOverride(current: OverrideMap, uri: string): OverrideMap {
	const key = normalizeUri(uri);
	if (!(key in current)) return current;
	const next = { ...current };
	delete next[key];
	persistOverrides(next);
	return next;
}
