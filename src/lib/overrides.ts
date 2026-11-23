import { browser } from '$app/environment';
import { isTmdbId } from '$lib/types';

const STORAGE_KEY = 'vizard:tmdb-overrides';

/** A user-supplied TMDB target for a Letterboxd film that automatic lookup missed. */
export interface TmdbOverride {
	mediaType: 'movie' | 'tv';
	tmdbId: number;
}

/** Normalises a Letterboxd film URI so lookups match regardless of trailing slash or casing. */
export function normalizeOverrideUri(uri: string): string {
	return uri.trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * Parses a TMDB ID or URL into a typed override target.
 * Accepts plain numeric IDs (`550`), prefixed targets (`movie/550`, `tv/1399`, `tv:1399`),
 * or TMDB web URLs (`https://www.themoviedb.org/movie/550-fight-club`).
 */
export function parseTmdbOverride(raw: string): TmdbOverride | null {
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

	const urlMatch = /(?:https?:\/\/)?(?:www\.)?themoviedb\.org\/(movie|tv)\/(\d+)/i.exec(trimmed);
	if (urlMatch) {
		const tmdbId = Number.parseInt(urlMatch[2], 10);
		if (!isTmdbId(tmdbId)) return null;
		return { mediaType: urlMatch[1].toLowerCase() as 'movie' | 'tv', tmdbId };
	}

	return null;
}

/** Compact display token for a saved override, e.g. `movie/550` or `tv/1399`. */
export function formatTmdbOverride(override: TmdbOverride): string {
	return `${override.mediaType}/${override.tmdbId}`;
}

/** Canonical TMDB web URL for an override target. */
export function tmdbOverrideUrl(override: TmdbOverride): string {
	return `https://www.themoviedb.org/${override.mediaType}/${override.tmdbId}`;
}

function isValidOverride(value: unknown): value is TmdbOverride {
	if (!value || typeof value !== 'object') return false;
	const item = value as Partial<TmdbOverride>;
	return (
		(item.mediaType === 'movie' || item.mediaType === 'tv') &&
		typeof item.tmdbId === 'number' &&
		Number.isInteger(item.tmdbId) &&
		isTmdbId(item.tmdbId)
	);
}

/** Reads all locally saved TMDB overrides keyed by normalised Letterboxd URI. */
export function loadOverrides(): Record<string, TmdbOverride> {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (!parsed || typeof parsed !== 'object') return {};
		const clean: Record<string, TmdbOverride> = {};
		for (const [uri, target] of Object.entries(parsed)) {
			if (isValidOverride(target)) clean[normalizeOverrideUri(uri)] = target;
		}
		return clean;
	} catch {
		return {};
	}
}

function persistOverrides(overrides: Record<string, TmdbOverride>): void {
	if (!browser) return;
	try {
		if (Object.keys(overrides).length === 0) localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
	} catch {
		// Ignore storage refusal so the in-memory override still applies for the session.
	}
}

/** Saves one local TMDB override and returns the updated map. */
export function saveOverride(
	current: Record<string, TmdbOverride>,
	uri: string,
	target: TmdbOverride
): Record<string, TmdbOverride> {
	const next = { ...current, [normalizeOverrideUri(uri)]: target };
	persistOverrides(next);
	return next;
}

/** Removes one local TMDB override and returns the updated map. */
export function removeOverride(
	current: Record<string, TmdbOverride>,
	uri: string
): Record<string, TmdbOverride> {
	const key = normalizeOverrideUri(uri);
	if (!(key in current)) return current;
	const next = { ...current };
	delete next[key];
	persistOverrides(next);
	return next;
}
