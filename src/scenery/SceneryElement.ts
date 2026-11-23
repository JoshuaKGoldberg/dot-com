/**
 * Custom element that ignores being moved around the document.
 *
 * Astro moves persisted elements into each new page's body, which would
 * otherwise disconnect and reconnect them on every client-side navigation.
 */
export abstract class SceneryElement extends HTMLElement {
	#disconnect: (() => void) | undefined;

	connectedCallback() {
		this.#disconnect ??= this.connect();
	}

	/** Present so that browsers with `moveBefore` don't disconnect on moves. */
	connectedMoveCallback() {
		// (intentionally empty)
	}

	disconnectedCallback() {
		queueMicrotask(() => {
			if (!this.isConnected) {
				this.#disconnect?.();
				this.#disconnect = undefined;
			}
		});
	}

	/**
	 * Sets up the element.
	 * @returns A function to tear the element down.
	 */
	protected abstract connect(): () => void;
}
