/** As long as --transitionMedium. */
const duration = 280;

/** Removes an element once it's faded away from however visible it was. */
export function fadeAway(element: Element) {
	const remove = () => {
		element.remove();
	};

	element
		.animate([{ offset: 1, opacity: 0 }], { duration, fill: "forwards" })
		.finished.then(remove, remove);
}

/** Fades away what's on a canvas, as it's about to be painted with something else. */
export function fadeAwayPainting(canvas: HTMLCanvasElement) {
	const painting = document.createElement("canvas");

	painting.height = canvas.height;
	painting.width = canvas.width;
	painting.style.inset = "0";
	painting.style.position = "absolute";

	// Canvases that don't have a size yet can't be drawn, and have nothing on them
	if (canvas.height && canvas.width) {
		painting.getContext("2d")?.drawImage(canvas, 0, 0);
		canvas.after(painting);
		fadeAway(painting);
	}
}
