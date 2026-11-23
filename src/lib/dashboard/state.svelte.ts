import { createContext } from 'svelte';
import type { Library } from '$lib/library.svelte';
import type { EnrichedFilm } from '$lib/types';
import {
	activeFilterChips,
	clearFilterChip,
	filterDashboardFilms,
	NO_DASHBOARD_FILTERS,
	type DashboardFilters,
	type FilterChip
} from './filters';

/** Reactive dashboard filter state decoupled from the core `Library`. */
export class DashboardState {
	filters = $state<DashboardFilters>({ ...NO_DASHBOARD_FILTERS });
	customDatesOpen = $state(false);
	readonly films: EnrichedFilm[];
	readonly chips: FilterChip[];
	readonly isFiltered: boolean;

	constructor(library: Library) {
		this.films = $derived(filterDashboardFilms(library.films, this.filters, library.lists));
		this.chips = $derived(activeFilterChips(this.filters, library.lists));
		this.isFiltered = $derived(this.chips.length > 0);
	}

	reset(): void {
		this.customDatesOpen = false;
		this.filters = { ...NO_DASHBOARD_FILTERS };
	}

	removeChip(key: FilterChip['key']): void {
		if (key === 'dates') this.customDatesOpen = false;
		this.filters = clearFilterChip(this.filters, key);
	}

	toggleListFilter(listId: string): void {
		this.filters = { ...this.filters, listId: this.filters.listId === listId ? '' : listId };
	}
}

export const [getDashboard, setDashboard] = createContext<DashboardState>();
