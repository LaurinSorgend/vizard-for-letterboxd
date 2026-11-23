import { json } from '@sveltejs/kit';
import { isInteger, requestContext, resolveBatch, validateBatch } from '$lib/server/batch';
import { freshMovieRecords, freshTypedRecords } from '$lib/server/records';
import { isTmdbRef } from '$lib/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (body && 'items' in body) {
		const items = validateBatch(
			body,
			'items',
			isTmdbRef,
			'{ items: { tmdbId: number, mediaType: "movie" | "tv" }[] }'
		);
		return json(await resolveBatch(items, freshTypedRecords, await requestContext(platform)));
	}
	const ids = validateBatch(body, 'ids', isInteger, '{ ids: number[] }');
	return json(await resolveBatch(ids, freshMovieRecords, await requestContext(platform)));
};
