export type Listener = () => void;

export class Emitter {
	readonly #listeners = new Set<Listener>();

	emit() {
		for (const listener of this.#listeners) {
			try {
				listener();
			} catch (error) {
				// One listener failing shouldn't keep the rest from being told
				reportError(error);
			}
		}
	}

	listen(listener: Listener, signal?: AbortSignal) {
		this.#listeners.add(listener);
		signal?.addEventListener("abort", () => {
			this.#listeners.delete(listener);
		});
	}
}
