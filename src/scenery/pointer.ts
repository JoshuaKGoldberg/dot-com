import { Emitter, type Listener } from "./Emitter";

/** Pointers that haven't moved in this long are treated as though they left. */
const parkedAfterMs = 30_000;

/** Fingers can't stay without being in the way, so taps count for a while after them. */
const touchParkedAfterMs = 12_000;

const changes = new Emitter();

let isInside = false;
let parkedAt = 0;

/** The last known mouse, pen, or finger position, in viewport pixels. */
export const pointer = {
	/** Whether the pointer is over the page, and has moved recently. */
	get isPresent() {
		return isInside && performance.now() < parkedAt;
	},

	x: 0,
	y: 0,
};

/** Calls back each time the pointer moves, or leaves the page. */
export function onPointer(listener: Listener, signal: AbortSignal) {
	changes.listen(listener, signal);
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
			movePointer(event, parkedAfterMs);
		}
	},
	{ passive: true },
);

for (const type of ["touchstart", "touchmove"] as const) {
	addEventListener(
		type,
		({ touches: [touch] }) => {
			movePointer(touch, touchParkedAfterMs);
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
