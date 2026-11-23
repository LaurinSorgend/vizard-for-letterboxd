import type { LibrarySource } from '$lib/store';
import type { Progress } from '$lib/ingest/pipeline';

export type LoadPhase = 'idle' | 'working' | 'ready';

/** Cancellable load/enrichment state machine shared by the main library and friend comparison. */
export class LoadRunner {
	phase = $state<LoadPhase>('idle');
	progress = $state<Progress>({ stage: 'films', done: 0, total: 0 });
	error = $state<string | null>(null);
	loadingSource = $state<LibrarySource>('export');
	usernameDraft = $state('');
	#controller: AbortController | null = null;
	#cancelTo: LoadPhase = 'idle';

	begin(cancelTo: LoadPhase, source?: LibrarySource): AbortController {
		this.#controller?.abort();
		const controller = new AbortController();
		this.#controller = controller;
		this.#cancelTo = cancelTo;
		if (source) this.loadingSource = source;
		this.error = null;
		this.phase = 'working';
		this.progress = { stage: 'films', done: 0, total: 0 };
		return controller;
	}

	isCurrent(controller: AbortController): boolean {
		return controller === this.#controller;
	}

	reporter(controller: AbortController): (next: Progress) => void {
		return (next) => {
			if (controller === this.#controller) this.progress = next;
		};
	}

	finish(controller: AbortController, phase: LoadPhase = 'ready'): void {
		if (controller !== this.#controller) return;
		this.phase = phase;
		this.#controller = null;
	}

	fail(controller: AbortController, cause: unknown): void {
		if (controller !== this.#controller) return;
		this.error = cause instanceof Error ? cause.message : String(cause);
		this.phase = this.#cancelTo;
		this.#controller = null;
	}

	cancel(): void {
		this.#controller?.abort();
		this.#controller = null;
		this.phase = this.#cancelTo;
		this.progress = { stage: 'films', done: 0, total: 0 };
	}

	/** Abandons any run and returns to an empty idle state. */
	reset(): void {
		this.#controller?.abort();
		this.#controller = null;
		this.phase = 'idle';
		this.progress = { stage: 'films', done: 0, total: 0 };
		this.error = null;
	}
}
