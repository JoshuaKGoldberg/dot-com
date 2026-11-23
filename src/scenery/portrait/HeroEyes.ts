import { cacheLayout } from "../cacheLayout";
import { px } from "../css";
import { createFrameTask } from "../frameLoop";
import { clamp } from "../math";
import { pointer, watchPointer } from "../pointer";
import { rootState, watchRootState } from "../rootState";
import { EyeSpring, maximumTravel } from "./EyeSpring";

const millisecondsBeforeFollowing = 30_000;

/** Center of the face, in a portrait 256 units wide with its own center at 0. */
const face = { x: 13, y: -17 };

/** Distance from the face at which eyes have turned as far as they go. */
const farthest = 90;

/** Distance from the face within which eyes cross slightly to focus. */
const crossing = 70;

/** Once eyes start following the pointer, they never stop: even on other visits. */
let isFollowing = false;

/** Makes a portrait's eyes follow the pointer around the page. */
export class HeroEyes {
	readonly #abort = new AbortController();
	readonly #getBounds: () => DOMRect;
	readonly #irises: SVGGraphicsElement[];
	#millisecondsLeft = millisecondsBeforeFollowing;
	readonly #spring = new EyeSpring();
	readonly #task = createFrameTask((seconds) => this.#step(seconds));
	#timer: ReturnType<typeof setTimeout> | undefined;
	#timerStartedAt = 0;
	readonly #unwatch: (() => void)[];

	constructor(portrait: HTMLElement, svg: SVGSVGElement) {
		this.#irises = [...svg.querySelectorAll<SVGGraphicsElement>("[data-iris]")];
		this.#getBounds = cacheLayout(() => portrait.getBoundingClientRect());
		this.#unwatch = [
			watchPointer(() => {
				this.#wake();
			}),
			watchRootState(() => {
				this.#wake();
			}),
		];

		document.addEventListener(
			"visibilitychange",
			() => {
				this.#updateTimer();
			},
			{ signal: this.#abort.signal },
		);

		this.#updateTimer();
		void this.#reveal(svg);
	}

	destroy() {
		this.#abort.abort();
		this.#task.sleep();
		clearTimeout(this.#timer);

		for (const unwatch of this.#unwatch) {
			unwatch();
		}
	}

	follow() {
		isFollowing = true;
		clearTimeout(this.#timer);
		this.#wake();
	}

	#getTarget() {
		const { height, left, top, width } = this.#getBounds();
		const scale = 256 / width;
		const x = (pointer.x - left - width / 2) * scale - face.x;
		const y = (pointer.y - top - height / 2) * scale - face.y;
		const distance = Math.hypot(x, y) || 1;
		const travel = clamp(distance / farthest) * maximumTravel;

		return {
			crossed: clamp(1 - distance / crossing) * 0.25 * maximumTravel,
			x: (x / distance) * travel,
			y: (y / distance) * travel * 0.6,
		};
	}

	/** Shows the movable eyes only once doing so won't visibly change anything. */
	async #reveal(svg: SVGSVGElement) {
		const sources = [...svg.querySelectorAll("image")].map(
			({ href }) => href.baseVal,
		);

		try {
			await Promise.all(
				sources.map(async (source) => {
					const image = new Image();
					image.src = source;
					await image.decode();
				}),
			);
			svg.dataset.ready = "";
		} catch {
			// The portrait itself has perfectly good eyes
		}
	}

	#step(seconds: number) {
		const { crossed, ...target } = this.#getTarget();
		const isMoving = this.#spring.step(seconds, target);
		const { x, y } = this.#spring.position;

		for (const [index, iris] of this.#irises.entries()) {
			const inward = index === 0 ? crossed : -crossed;

			// The portrait's image is drawn at twice its units
			iris.style.transform = `translate(${px((x + inward) * 2)}, ${px(y * 2)})`;
		}

		return isMoving && rootState.isPlaying;
	}

	#updateTimer() {
		clearTimeout(this.#timer);

		if (isFollowing) {
			return;
		}

		if (document.hidden) {
			this.#millisecondsLeft -= performance.now() - this.#timerStartedAt;

			return;
		}

		this.#timerStartedAt = performance.now();
		this.#timer = setTimeout(() => {
			this.follow();
		}, this.#millisecondsLeft);
	}

	#wake() {
		if (isFollowing && pointer.isKnown && rootState.isPlaying) {
			this.#task.wake();
		}
	}
}
