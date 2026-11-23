import { error, json } from '@sveltejs/kit';
import { isInteger, readBatch, requestContext, resolveBatch } from '$lib/server/batch';
import { freshMovieRecords, freshTypedRecords } from '$lib/server/records';
import { isTmdbId, MAX_BATCH, type ProviderRequestItem } from '$lib/types';
import type { RequestHandler } from './$types';

const isTypedItem = (item: unknown): item is ProviderRequestItem => {
	const candidate = item as Partial<ProviderRequestItem> | null;
	return (
		isInteger(candidate?.tmdbId) &&
		isTmdbId(candidate.tmdbId) &&
		(candidate?.mediaType === 'movie' || candidate?.mediaType === 'tv')
	);
};

/**
 * Accepts either `{ ids: number[] }` (movies) or `{ items: { tmdbId, mediaType }[] }`
 * (movies and series) and answers each title's full TMDB record.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const clone = request.clone();
	const body = (await clone.json().catch(() => null)) as Record<string, unknown> | null;
	if (body && Array.isArray(body.items)) {
		if (body.items.length > MAX_BATCH) error(400, `At most ${MAX_BATCH} items per request.`);
		if (!body.items.every(isTypedItem)) {
			error(400, 'Expected { items: { tmdbId: number, mediaType: "movie" | "tv" }[] }.');
		}
		return json(await resolveBatch(body.items, freshTypedRecords, await requestContext(platform)));
	}
	const { items: ids } = await readBatch(request, 'ids', isInteger, '{ ids: number[] }');
	return json(await resolveBatch(ids, freshMovieRecords, await requestContext(platform)));
};
