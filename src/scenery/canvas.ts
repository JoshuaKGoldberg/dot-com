/** Scenery's soft enough that any more pixels than this aren't noticeable. */
const maximumPixelRatio = 1.5;

/** Sizes a canvas in CSS pixels, returning whether that cleared it. */
export function resizeCanvas(
	canvas: HTMLCanvasElement,
	width: number,
	height: number,
) {
	const ratio = Math.min(devicePixelRatio, maximumPixelRatio);
	const scaledHeight = Math.round(height * ratio);
	const scaledWidth = Math.round(width * ratio);

	if (canvas.height === scaledHeight && canvas.width === scaledWidth) {
		return false;
	}

	canvas.height = scaledHeight;
	canvas.width = scaledWidth;

	return true;
}
