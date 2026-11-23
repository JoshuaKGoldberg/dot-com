import { cacheLayout } from "../cacheLayout";
import { px } from "../css";
import { createFrameTask } from "../frameLoop";
import { clamp, damp, interpolate, moveToward, smoothstep } from "../math";
import { pointer, watchPointer } from "../pointer";
import { rootState, watchRootState } from "../rootState";
import { SceneryElement } from "../SceneryElement";
import { ConstellationCanvas } from "./ConstellationCanvas";
import { HeroEyes } from "./HeroEyes";

/** Radii, as ratios of the portrait's, at which the pointer enters and leaves it. */
const enterRadius = 1.04;
const leaveRadius = 1.14;

const secondsBeforeEyes = 3.5;
const secondsBeforeLight = 1;
const secondsOfLight = 10;
const secondsToFullTilt = 8;

/** Light too faint to be visible. */
const darkness = 0.002;

/**
 * A portrait that tilts toward the pointer, and slowly lights up as it's hovered.
 *
 * It's already complete without this. Nothing about it is replaced: this only
 * ever changes the opacity and transform of elements that were always there.
 */
export class HeroPortraitElement extends SceneryElement {
	readonly #awake = query(this, ".awake");
	#constellation: ConstellationCanvas | undefined;
	#eyes: HeroEyes | undefined;
	#hoveredSeconds = 0;
	#isHovered = false;

	/** Smoothed amounts of hover and position, so that tilting is never abrupt. */
	readonly #figure = query(this, ".figure");
	readonly #getBounds = cacheLayout(() => this.getBoundingClientRect());
	readonly #halo = query(this, ".halo");
	#hover = 0;
	#lean = { x: 0, y: 0 };

	/** How lit up the portrait is, and how far it's willing to tilt, from 0 to 1. */
	#light = 0;
	#seconds = 0;

	readonly #sky = query(this, ".constellation");
	readonly #task = createFrameTask((seconds) => this.#step(seconds));
	#willingness = 0;

	protected connect() {
		const eyes = this.querySelector<SVGSVGElement>(".eyes");
		const unwatchPointer = watchPointer(() => {
			this.#updateHovered();
		});
		const unwatchRootState = watchRootState(() => {
			if (!rootState.isPlaying) {
				this.#rest();
			}
		});

		this.#eyes = eyes ? new HeroEyes(this, eyes) : undefined;

		return () => {
			this.#eyes?.destroy();
			this.#rest();
			unwatchPointer();
			unwatchRootState();
		};
	}

	/** Pointer's position, in a portrait 256 units wide with its own center at 0. */
	#getPointer() {
		const { height, left, top, width } = this.#getBounds();
		const scale = 256 / width;

		return {
			x: (pointer.x - left - width / 2) * scale,
			y: (pointer.y - top - height / 2) * scale,
		};
	}

	#paintLight(at: { x: number; y: number }) {
		const level = smoothstep(0, 1, this.#light);

		this.#awake.style.opacity = level.toFixed(4);
		this.#halo.style.opacity = interpolate(0.06, 0.85, level).toFixed(4);
		this.toggleAttribute("data-awake", this.#light > darkness);

		if (this.#light <= darkness) {
			this.#constellation?.destroy();
			this.#constellation = undefined;

			return;
		}

		this.#constellation ??= new ConstellationCanvas(this.#sky);
		this.#constellation.paint(at, level, this.#seconds);
	}

	#rest() {
		this.#task.sleep();
		this.#hover = 0;
		this.#hoveredSeconds = 0;
		this.#isHovered = false;
		this.#light = 0;
		this.#willingness = 0;
		this.#paintLight(this.#lean);
		this.#tilt();
	}

	#step(seconds: number) {
		this.#updateHovered();

		const at = this.#getPointer();

		this.#seconds += seconds;
		this.#hoveredSeconds = this.#isHovered ? this.#hoveredSeconds + seconds : 0;
		this.#hover = damp(
			this.#hover,
			Number(this.#isHovered),
			this.#isHovered ? 5 : 1.6,
			seconds,
		);
		this.#willingness = moveToward(
			this.#willingness,
			Number(this.#isHovered),
			seconds / secondsToFullTilt,
		);

		if (!this.#isHovered || this.#hoveredSeconds > secondsBeforeLight) {
			this.#light = moveToward(
				this.#light,
				Number(this.#isHovered),
				seconds / secondsOfLight,
			);
		}

		if (this.#isHovered) {
			this.#lean.x = damp(this.#lean.x, at.x, 7, seconds);
			this.#lean.y = damp(this.#lean.y, at.y, 7, seconds);
		}

		if (this.#hoveredSeconds > secondsBeforeEyes) {
			this.#eyes?.follow();
		}

		this.#tilt();
		this.#paintLight(this.#lean);

		if (
			!this.#isHovered &&
			this.#hover < 0.001 &&
			this.#light === 0 &&
			this.#willingness === 0
		) {
			this.#rest();

			return false;
		}

		return true;
	}

	#tilt() {
		if (!this.#hover) {
			this.#figure.style.transform = "";

			return;
		}

		const strength =
			1.14 * interpolate(0.5, 1, smoothstep(0, 1, this.#willingness));
		const unit = this.#getBounds().width / 256;
		const x = clamp(this.#lean.x / 128, -1.3, 1.3) * this.#hover;
		const y = clamp(this.#lean.y / 128, -1.3, 1.3) * this.#hover;

		this.#figure.style.transform = [
			`translate(${px(x * 4.8 * strength * unit)}, ${px((y * 3.2 - this.#hover * 4) * strength * unit)})`,
			`rotate(${(x * 0.025 * strength).toFixed(5)}rad)`,
			`scale(${(1 + 0.05 * this.#hover * strength).toFixed(5)})`,
		].join(" ");
	}

	/** Leaving takes going slightly farther than entering, so edges don't flicker. */
	#updateHovered() {
		const { x, y } = this.#getPointer();

		this.#isHovered =
			pointer.isPresent &&
			rootState.isPlaying &&
			Math.hypot(x, y) / 128 < (this.#isHovered ? leaveRadius : enterRadius);

		if (this.#isHovered) {
			this.#task.wake();
		}
	}
}

function query(parent: HTMLElement, selector: string) {
	const element = parent.querySelector<HTMLElement>(selector);

	if (!element) {
		throw new Error(`Missing ${selector} in <${parent.localName}>.`);
	}

	return element;
}
