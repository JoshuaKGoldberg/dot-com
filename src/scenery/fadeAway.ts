import { readMilliseconds } from "./css";

export function fadeAway(element: Element) {
	const remove = () => {
		element.remove();
	};

	element
		.animate([{ offset: 1, opacity: 0 }], {
			duration: readMilliseconds("--transitionMedium"),
			fill: "forwards",
		})
		.finished.then(remove, remove);
}

/** Fades what's on a canvas into what's about to be painted on it instead. */
export function crossfadePainting(canvas: HTMLCanvasElement) {
	fadeAwayPainting(canvas);
	canvas.animate([{ offset: 0, opacity: 0 }], {
		duration: readMilliseconds("--transitionMedium"),
	});
}

/** Fades away what's on a canvas, as it's about to be painted with something else. */
export function fadeAwayPainting(canvas: HTMLCanvasElement) {
	// Canvases without a size throw when they're drawn
	if (!canvas.height || !canvas.width) {
		return;
	}

	const painting = document.createElement("canvas");

	painting.height = canvas.height;
	painting.width = canvas.width;
	painting.style.inset = "0";
	painting.style.position = "absolute";
	painting.getContext("2d")?.drawImage(canvas, 0, 0);
	canvas.after(painting);
	fadeAway(painting);
}
