import { Emitter, type Listener } from "./Emitter";

/** Pointers that haven't moved in this long are treated as though they left. */
const parkedAfterMs = 30_000;

const changes = new Emitter();

let isInside = false;
let movedAt = 0;

/** The last known mouse or pen position, in viewport pixels. */
export const pointer = {
	/** Whether the pointer is over the page, and has moved recently. */
	get isPresent() {
		return isInside && performance.now() - movedAt < parkedAfterMs;
	},

	x: 0,
	y: 0,
};

/** Calls back each time the pointer moves, or leaves the page. */
export function onPointer(listener: Listener, signal: AbortSignal) {
	changes.listen(listener, signal);
}

addEventListener(
	"pointermove",
	(event) => {
		// Fingers don't hover
		if (event.pointerType === "touch") {
			return;
		}

		isInside = true;
		movedAt = performance.now();
		pointer.x = event.clientX;
		pointer.y = event.clientY;
		changes.emit();
	},
	{ passive: true },
);

document.documentElement.addEventListener("pointerleave", (event) => {
	if (event.pointerType !== "touch") {
		isInside = false;
		changes.emit();
	}
});
