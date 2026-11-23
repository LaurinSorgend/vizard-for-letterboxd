import { fetchRecords, fetchUpcoming } from '$lib/api/endpoints';
import { excludedIds } from '$lib/recommend/recommend';
import {
	buildTasteProfile,
	hasTasteSignals,
	scoreUpcoming,
	topPeople
} from '$lib/recommend/similarity';
import type { EnrichedFilm, ReleaseKind, TmdbMovie, WatchlistFilm } from '$lib/types';
import { recommendedCalendarFilm, type CalendarFilm } from './calendar';

export type RecommendPhase = 'searching' | 'enriching';

/** Upcoming films scored against the viewer's favourites, skipping anything watched or watchlisted. */
export async function recommendUpcoming(
	films: EnrichedFilm[],
	watchlist: WatchlistFilm[],
	region: string,
	kinds: ReleaseKind[],
	onProgress: (phase: RecommendPhase, done: number, total: number) => void,
	signal: AbortSignal
): Promise<CalendarFilm[]> {
	const profile = buildTasteProfile(films);
	if (!hasTasteSignals(profile)) return [];
	const candidates = await fetchUpcoming(region, kinds, topPeople(profile), signal);
	const exclude = new Set(excludedIds({ films, watchlist }, false));
	const ids = candidates.map((c) => c.tmdbId).filter((id) => !exclude.has(id));
	onProgress('enriching', 0, ids.length);
	const records = await fetchRecords(
		ids,
		(done) => onProgress('enriching', done, ids.length),
		signal
	);
	const found = [...records.values()].filter((r): r is TmdbMovie => r !== null);
	return scoreUpcoming(profile, found).map(({ record, score, reason }) =>
		recommendedCalendarFilm(record, { score, reason, kinds })
	);
}
