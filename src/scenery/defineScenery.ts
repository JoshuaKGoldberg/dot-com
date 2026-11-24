export type SceneryCreator = (host: HTMLElement, signal: AbortSignal) => void;

/**
 * Defines a custom element whose behavior lasts for as long as it's on the page.
 *
 * Navigating between pages briefly inserts each new page's own copies of persisted
 * elements, then replaces them with the originals moved over from the old page.
 * Waiting for that to be done means originals keep going and copies never start.
 */
export function defineScenery(name: string, create: SceneryCreator) {
	customElements.define(
		name,
		class extends HTMLElement {
			#controller: AbortController | undefined;

			connectedCallback() {
				queueMicrotask(() => {
					this.#settle();
				});
			}

			/** Present so that browsers with `moveBefore` don't disconnect on moves. */
			connectedMoveCallback() {
				// (intentionally empty)
			}

			disconnectedCallback() {
				queueMicrotask(() => {
					this.#settle();
				});
			}

			#settle() {
				if (!this.isConnected) {
					this.#controller?.abort();
					this.#controller = undefined;
				} else if (!this.#controller) {
					this.#controller = new AbortController();
					create(this, this.#controller.signal);
				}
			}
		},
	);
}
