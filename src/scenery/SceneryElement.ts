/**
 * Custom element that's only set up once it's on the page to stay.
 *
 * Navigating between pages briefly inserts each new page's own copies of persisted
 * elements, then replaces them with the originals moved over from the old page.
 * Waiting for that to be done means originals keep going and copies never start.
 */
export abstract class SceneryElement extends HTMLElement {
	#disconnect: (() => void) | undefined;

	connectedCallback() {
		this.#settle();
	}

	/** Present so that browsers with `moveBefore` don't disconnect on moves. */
	connectedMoveCallback() {
		// (intentionally empty)
	}

	disconnectedCallback() {
		this.#settle();
	}

	/**
	 * Sets up the element.
	 * @returns A function to tear the element down.
	 */
	protected abstract connect(): () => void;

	#settle() {
		queueMicrotask(() => {
			if (this.isConnected) {
				this.#disconnect ??= this.connect();
			} else {
				this.#disconnect?.();
				this.#disconnect = undefined;
			}
		});
	}
}
