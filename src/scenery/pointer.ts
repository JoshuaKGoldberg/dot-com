import { Emitter, type Listener } from "./Emitter";
import { rootState } from "./rootState";

const parkedAfterMilliseconds = 30_000;

/** Fingers can't stay without being in the way, so taps count for a while after them. */
const touchParkedAfterMilliseconds = 12_000;

const changes = new Emitter();

let isInside = false;
let parkedAt = 0;

/** In viewport pixels. */
export const pointer = {
	/** Whether the pointer is over the page, no matter how long it's been still for. */
	get isInside() {
		return isInside;
	},

	/** Whether the pointer is over the page, and has moved recently. */
	get isPresent() {
		return isInside && performance.now() < parkedAt;
	},

	x: 0,
	y: 0,
};

/** Nothing reacts to the pointer while motion is paused. */
export function onPointer(listener: Listener, signal: AbortSignal) {
	changes.listen(() => {
		if (rootState.isPlaying) {
			listener();
		}
	}, signal);
}

function movePointer(
	{ clientX, clientY }: PointerEvent | Touch,
	parkedAfter: number,
) {
	isInside = true;
	parkedAt = performance.now() + parkedAfter;
	pointer.x = clientX;
	pointer.y = clientY;
	changes.emit();
}

addEventListener(
	"pointermove",
	(event) => {
		// Fingers' own events keep on being sent while they scroll the page
		if (event.pointerType !== "touch") {
			movePointer(event, parkedAfterMilliseconds);
		}
	},
	{ passive: true },
);

for (const type of ["touchstart", "touchmove"] as const) {
	addEventListener(
		type,
		({ touches: [touch] }) => {
			movePointer(touch, touchParkedAfterMilliseconds);
		},
		{ passive: true },
	);
}

document.documentElement.addEventListener("pointerleave", (event) => {
	if (event.pointerType !== "touch") {
		isInside = false;
		changes.emit();
	}
});
