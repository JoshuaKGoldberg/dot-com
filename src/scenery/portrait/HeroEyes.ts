import { px } from "../css";
import { createFrameTask, type FrameTask } from "../frameLoop";
import { clamp } from "../math";
import { onPointer, pointer } from "../pointer";
import { onRootState } from "../rootState";
import { EyeSpring, maximumTravel } from "./EyeSpring";
import { getPortraitPointer } from "./units";

const millisecondsBeforeFollowing = 30_000;

/** Center of the face, in portrait units. */
const face = { x: 13, y: -17 };

/** Distance from the face at which eyes have turned as far as they go. */
const farthest = 90;

/** Distance from the face within which eyes cross slightly to focus. */
const crossing = 70;

/** The eyes' SVG is in its image's pixels, of which there are two per portrait unit. */
const pixelsPerUnit = 2;

/** Once eyes start following the pointer, they don't stop until the next full load. */
let isFollowing = false;

/** Makes a portrait's eyes follow the pointer around the page. */
export class HeroEyes {
	readonly #eyes: { iris: SVGElement; side: number; spring: EyeSpring }[];
	readonly #measure: () => DOMRect;
	#millisecondsLeft = millisecondsBeforeFollowing;
	readonly #task: FrameTask;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#timerStartedAt = 0;

	constructor(
		svg: SVGSVGElement,
		measurePortrait: () => DOMRect,
		signal: AbortSignal,
	) {
		this.#eyes = Array.from(
			svg.querySelectorAll<SVGElement>("[data-iris]"),
			(iris, index) => ({
				iris,
				side: index === 0 ? 1 : -1,
				spring: new EyeSpring(),
			}),
		);
		this.#measure = measurePortrait;
		this.#task = createFrameTask((seconds) => this.#step(seconds), { signal });

		document.addEventListener(
			"visibilitychange",
			() => {
				this.#updateTimer();
			},
			{ signal },
		);
		onPointer(() => {
			this.#wake();
		}, signal);
		onRootState(() => {
			this.#wake();
		}, signal);
		signal.addEventListener("abort", () => {
			this.#stopTimer();
		});

		this.#updateTimer();
		void revealEyes(svg);
	}

	/** Has the eyes follow the pointer from now on. */
	follow() {
		isFollowing = true;
		this.#stopTimer();
		this.#wake();
	}

	#getTarget() {
		const { x: pointerX, y: pointerY } = getPortraitPointer(this.#measure());
		const x = pointerX - face.x;
		const y = pointerY - face.y;
		const distance = Math.hypot(x, y) || 1;
		const travel = clamp(distance / farthest) * maximumTravel;

		return {
			crossed: clamp(1 - distance / crossing) * 0.25 * maximumTravel,
			x: (x / distance) * travel,
			y: (y / distance) * travel * 0.6,
		};
	}

	#step(seconds: number) {
		const target = this.#getTarget();
		let isMoving = false;

		for (const { iris, side, spring } of this.#eyes) {
			const isEyeMoving = spring.step(seconds, {
				x: target.x + target.crossed * side,
				y: target.y,
			});
			const { x, y } = spring.position;

			iris.style.transform = `translate(${px(x * pixelsPerUnit)}, ${px(y * pixelsPerUnit)})`;
			isMoving ||= isEyeMoving;
		}

		return isMoving;
	}

	#stopTimer() {
		clearTimeout(this.#timer);
		this.#timer = undefined;
	}

	/** Only time that the page is visible counts toward following. */
	#updateTimer() {
		if (isFollowing) {
			return;
		}

		if (!document.hidden) {
			this.#timerStartedAt = performance.now();
			this.#timer ??= setTimeout(() => {
				this.follow();
			}, this.#millisecondsLeft);
		} else if (this.#timer !== undefined) {
			this.#millisecondsLeft -= performance.now() - this.#timerStartedAt;
			this.#stopTimer();
		}
	}

	#wake() {
		if (isFollowing && pointer.isKnown) {
			this.#task.wake();
		}
	}
}

/** Shows the movable eyes only once doing so won't visibly change anything. */
async function revealEyes(svg: SVGSVGElement) {
	const sources = Array.from(
		svg.querySelectorAll("image"),
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
