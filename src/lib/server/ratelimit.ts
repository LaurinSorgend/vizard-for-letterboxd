import { dev } from '$app/environment';
import { error, type RequestEvent } from '@sveltejs/kit';

type Limiter = Exclude<keyof App.Platform['env'], 'DB'>;

/**
 * The Cloudflare rate limiter (binding in wrangler.jsonc) each API route counts against. The
 * binding names are historical: routes that spend upstream calls alike share one.
 */
export const LIMITER_OF: Record<string, Limiter> = {
	'/api/enrich': 'ENRICH_LIMITER',
	'/api/collections': 'ENRICH_LIMITER',
	'/api/feed/[username]': 'ENRICH_LIMITER',
	'/api/omdb-enrich': 'OMDB_LIMITER',
	'/api/providers': 'PROVIDERS_LIMITER',
	'/api/records': 'PROVIDERS_LIMITER',
	'/api/releases': 'PROVIDERS_LIMITER',
	'/api/recommend': 'RECOMMEND_LIMITER',
	'/api/upcoming': 'RECOMMEND_LIMITER'
};

/** Throttles an API route by client IP; a no-op where no limiter is bound (self-host). */
export async function checkRateLimit(event: RequestEvent, routeId: string): Promise<void> {
	const limiter = event.platform?.env?.[LIMITER_OF[routeId]];
	if (!limiter) return;
	let key: string;
	try {
		key = event.getClientAddress();
	} catch (cause) {
		if (dev) return;
		throw cause;
	}
	const { success } = await limiter.limit({ key });
	if (!success) error(429, 'Too many requests, slow down and try again shortly.');
}
