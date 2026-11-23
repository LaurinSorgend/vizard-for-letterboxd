import type { Film, Profile } from '$lib/types';

/** A film with nothing logged yet, the start of every film the export or the feed introduces. */
export function blankFilm({ uri, name, year }: Pick<Film, 'uri' | 'name' | 'year'>): Film {
	return {
		uri,
		name,
		year,
		rating: null,
		liked: false,
		review: null,
		watchedDates: [],
		entries: [],
		rewatch: false,
		tags: []
	};
}

/** A profile with only what is known; the export's profile.csv fills the rest. */
export function blankProfile(username: string): Profile {
	return { username, givenName: '', dateJoined: '', location: '' };
}
