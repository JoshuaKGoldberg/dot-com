import { cacheLayout } from "../cacheLayout";
import { createFrameTask } from "../frameLoop";
import { clamp } from "../math";
import { pointer, watchPointer } from "../pointer";
import { rootState, watchRootState } from "../rootState";
import { SceneryElement } from "../SceneryElement";
import { Squiggle } from "./Squiggle";

/** Distance from the pointer, in pixels, within which squiggles react to it. */
const reach = 96;

/** Links whose squiggles are part of the design, rather than reacting to anything. */
const links =
	"[data-squiggle]:not([data-squiggle=nav]), article a:not(:has(img))";

/** Draws the squiggles of links that are near the pointer. */
export class SquiggleOverlayElement extends SceneryElement {
	readonly #getLinks = cacheLayout(measureLinks);
	#needsScan = false;
	readonly #squiggles = new Map<HTMLElement, Squiggle>();
	readonly #task = createFrameTask((seconds) => this.#step(seconds));

	protected connect() {
		const listeners = new AbortController();
		const { signal } = listeners;
		const wake = () => {
			if (rootState.isPlaying) {
				this.#needsScan = true;
				this.#task.wake();
			}
		};

		const unwatch = [
			watchPointer(wake),
			watchRootState(() => {
				if (!rootState.isPlaying) {
					this.#clear();
				}
			}),
		];

		document.addEventListener(
			"scroll",
			() => {
				if (this.#squiggles.size) {
					wake();
				}
			},
			{ capture: true, passive: true, signal },
		);

		return () => {
			listeners.abort();
			this.#clear();

			for (const stop of unwatch) {
				stop();
			}
		};
	}

	#clear() {
		for (const squiggle of this.#squiggles.values()) {
			squiggle.destroy();
		}

		this.#squiggles.clear();
		this.#task.sleep();
	}

	#scan() {
		const { isPresent } = pointer;

		for (const { bounds, link } of this.#getLinks()) {
			const nearness = isPresent ? clamp(1 - getDistance(bounds) / reach) : 0;
			let squiggle = this.#squiggles.get(link);

			if (!squiggle && nearness) {
				squiggle = new Squiggle(link, this);
				this.#squiggles.set(link, squiggle);
			}

			if (squiggle) {
				squiggle.target = nearness;
			}
		}
	}

	#step(seconds: number) {
		if (this.#needsScan || !pointer.isPresent) {
			this.#needsScan = false;
			this.#scan();
		}

		const measured = this.#getLinks();

		for (const [link, squiggle] of this.#squiggles) {
			const bounds = measured.find((other) => other.link === link)?.bounds;

			if (!link.isConnected) {
				squiggle.target = 0;
			}

			squiggle.step(seconds);

			// Links that leave the page fade out, but ones scrolled away are just gone
			if (squiggle.isSettled || (link.isConnected && !bounds)) {
				squiggle.destroy();
				this.#squiggles.delete(link);
			} else {
				squiggle.paint(pointer.x, bounds);
			}
		}

		return this.#squiggles.size > 0;
	}
}

function getDistance(bounds: DOMRect[]) {
	return Math.min(
		...bounds.map(({ bottom, left, right, top }) =>
			Math.hypot(
				Math.max(left - pointer.x, 0, pointer.x - right),
				Math.max(top - pointer.y, 0, pointer.y - bottom),
			),
		),
	);
}

/** Finds the bounds of each line of each link that's on screen, or almost. */
function measureLinks() {
	return Array.from(document.querySelectorAll<HTMLElement>(links), (link) => ({
		bounds: [...link.getClientRects()].filter(
			({ bottom, top, width }) =>
				width > 1 && bottom > -reach && top < innerHeight + reach,
		),
		link,
	})).filter(({ bounds }) => bounds.length);
}
