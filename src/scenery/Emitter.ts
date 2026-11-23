export type Listener = () => void;

/** Tells listeners when something's happened, until any signals they have are aborted. */
export class Emitter {
	readonly #listeners = new Set<Listener>();

	emit() {
		for (const listener of this.#listeners) {
			listener();
		}
	}

	listen(listener: Listener, signal?: AbortSignal) {
		this.#listeners.add(listener);
		signal?.addEventListener("abort", () => {
			this.#listeners.delete(listener);
		});
	}
}
