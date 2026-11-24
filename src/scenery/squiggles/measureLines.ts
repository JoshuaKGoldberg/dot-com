import type { Rectangle } from "../geometry";

/**
 * Finds each line of a link's text, in viewport coordinates.
 *
 * Inline links already have a box for each of their lines. Others only have the one box
 * around all of them, so their lines have to be found from the text inside of it.
 */
export function measureLines(link: HTMLElement): Rectangle[] {
	const boxes = Array.from(link.getClientRects());

	// Articles' links always rest on an underline that's the size of their box
	if (boxes.length !== 1 || !link.dataset.squiggle) {
		return boxes;
	}

	const lines = measureTextLines(link);
	const last = lines.at(-1);

	if (lines.length < 2 || !last) {
		return boxes;
	}

	// Text can be shorter or taller than the lines it's on, which are what boxes fit
	const [box] = boxes;
	const below = box.bottom - last.bottom;

	return lines.map((line) => ({ ...line, bottom: line.bottom + below }));
}

function measureTextLines(link: HTMLElement) {
	const lines: Rectangle[] = [];
	const range = document.createRange();

	range.selectNodeContents(link);

	for (const { bottom, left, right, top, width } of range.getClientRects()) {
		const line = lines.at(-1);

		if (!width) {
			continue;
		}

		// Lines that are close together overlap, but not as far as each other's middles
		if (!line || (top + bottom) / 2 > line.bottom) {
			lines.push({ bottom, left, right, top });
			continue;
		}

		line.bottom = Math.max(line.bottom, bottom);
		line.left = Math.min(line.left, left);
		line.right = Math.max(line.right, right);
		line.top = Math.min(line.top, top);
	}

	return lines;
}
