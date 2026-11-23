/** Pointers that haven't moved in this long are treated as though they left. */
const parkedAfterMs = 30_000;

let inside = false;
let movedAt = 0;

/** The last known mouse or pen position, in viewport pixels. */
export const pointer = {
	/** Whether the pointer has ever been seen on this page. */
	get isKnown() {
		return movedAt > 0;
	},

	/** Whether the pointer is over the page, and has moved recently. */
	get isPresent() {
		return inside && performance.now() - movedAt < parkedAfterMs;
	},

	x: 0,
	y: 0,
};

const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) {
		listener();
	}
}

/** Calls back each time the pointer moves, or leaves the page. */
export function watchPointer(listener: () => void) {
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
}

addEventListener(
	"pointermove",
	(event) => {
		// Fingers don't hover
		if (event.pointerType === "touch") {
			return;
		}

		inside = true;
		movedAt = performance.now();
		pointer.x = event.clientX;
		pointer.y = event.clientY;
		notify();
	},
	{ passive: true },
);

document.documentElement.addEventListener("pointerleave", () => {
	inside = false;
	notify();
});
