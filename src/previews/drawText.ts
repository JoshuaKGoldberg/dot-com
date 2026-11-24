import type { Font, PathCommand } from "opentype.js";

export interface TextBlock {
	color: string;
	font: Font;
	lineHeight: number;
	maximumHeight: number;
	sizes: number[];
	text: string;
	width: number;
}

export interface TextLayout {
	height: number;
	toSvg: (x: number, y: number) => string;
}

/** Lays out text at the largest size that fits, as shapes, so no fonts need to be installed. */
export function layOutText({
	color,
	font,
	lineHeight,
	maximumHeight,
	sizes,
	text,
	width,
}: TextBlock): TextLayout {
	const getHeight = (size: number) =>
		wrap(font, text, size, width).length * size * lineHeight;
	const size =
		sizes.find((size) => getHeight(size) <= maximumHeight) ??
		sizes[sizes.length - 1];
	const lines = balance(font, text, size, width);

	return {
		height: lines.length * size * lineHeight,
		toSvg: (x, y) =>
			lines
				.map((line, index) =>
					drawLine(
						font,
						line,
						x,
						y + (index + 0.78) * size * lineHeight,
						size,
						color,
					),
				)
				.join(""),
	};
}

/** Wraps to the narrowest width that doesn't need any more lines. */
export function drawLine(
	font: Font,
	text: string,
	x: number,
	y: number,
	size: number,
	color: string,
) {
	const data = font.getPath(text, x, y, size).commands.map(toPathData).join("");

	return `<path d="${data}" fill="${color}"/>`;
}

function balance(font: Font, text: string, size: number, width: number) {
	const { length } = wrap(font, text, size, width);
	let narrowest = width;

	while (
		narrowest > 100 &&
		wrap(font, text, size, narrowest - 10).length === length
	) {
		narrowest -= 10;
	}

	return wrap(font, text, size, narrowest);
}

function wrap(font: Font, text: string, size: number, width: number) {
	const lines: string[] = [];

	for (const word of text.split(" ")) {
		const last = lines.at(-1);
		const longer = last === undefined ? word : `${last} ${word}`;

		if (last !== undefined && font.getAdvanceWidth(longer, size) <= width) {
			lines[lines.length - 1] = longer;
		} else {
			lines.push(word);
		}
	}

	return lines;
}

/** Path.toSVG() rounds numbers that are nearly 0 to NaN. */
function toPathData(command: PathCommand) {
	const points =
		command.type === "Z"
			? []
			: command.type === "C"
				? [command.x1, command.y1, command.x2, command.y2, command.x, command.y]
				: command.type === "Q"
					? [command.x1, command.y1, command.x, command.y]
					: [command.x, command.y];

	return command.type + points.map((point) => point.toFixed(2)).join(" ");
}
