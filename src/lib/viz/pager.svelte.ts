export const PAGE_STEP = 20;

/**
 * Show-more paging for a list: opens with `initial()` rows and grows by `PAGE_STEP` per click.
 * Pass `resetOn` to collapse back to the first page whenever a filter or sort key changes.
 */
export function pager(total: () => number, initial: () => number, resetOn?: () => unknown) {
	let pages = $state(0);
	if (resetOn) {
		$effect(() => {
			resetOn();
			pages = 0;
		});
	}
	const limit = () => initial() + pages * PAGE_STEP;
	return {
		get shown(): number {
			return Math.min(limit(), total());
		},
		get remaining(): number {
			return Math.max(0, total() - limit());
		},
		get pageable(): boolean {
			return total() > initial();
		},
		more: () => {
			pages += 1;
		},
		reset: () => {
			pages = 0;
		}
	};
}

export type Pager = ReturnType<typeof pager>;
