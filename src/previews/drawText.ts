import type { Font, PathCommand } from "opentype.js";

import { textFont } from "./fonts";

export interface TextBlock {
	color: string;
	font: Font;
	lineHeight: number;
	maximumHeight: number;

	/** From largest to smallest. */
	sizes: number[];

	text: string;
	width: number;
}

export interface TextLayout {
	height: number;
	toSvg: (x: number, y: number) => string;
}

export interface TextLine {
	color: string;
	font: Font;
	size: number;
	text: string;
	x: number;
	y: number;
}

/** As shapes, so that no fonts need to be installed. */
export function drawLine({ color, font, size, text, x, y }: TextLine) {
	let left = x;

	const data = splitByFont(font, text).map((run) => {
		const { commands } = run.font.getPath(run.text, left, y, size);

		left += run.font.getAdvanceWidth(run.text, size);

		return commands.map(toPathData).join("");
	});

	return `<path d="${data.join("")}" fill="${color}"/>`;
}

export function getWidth(font: Font, text: string, size: number) {
	return splitByFont(font, text).reduce(
		(width, run) => width + run.font.getAdvanceWidth(run.text, size),
		0,
	);
}

export function layOutText({
	color,
	font,
	lineHeight,
	maximumHeight,
	sizes,
	text,
	width,
}: TextBlock): TextLayout {
	const size =
		sizes.find((candidate) => {
			const lines = wrap(font, text, candidate, width);

			return (
				lines.length * candidate * lineHeight <= maximumHeight &&
				lines.every((line) => getWidth(font, line, candidate) <= width)
			);
		}) ?? sizes[sizes.length - 1];
	const lines = balance(font, text, size, width);

	return {
		height: lines.length * size * lineHeight,
		toSvg: (x, y) =>
			lines
				.map((line, index) =>
					drawLine({
						color,
						font,
						size,
						text: line,
						x,
						y: y + (index + 0.78) * size * lineHeight,
					}),
				)
				.join(""),
	};
}

/** Wraps to the narrowest width that doesn't need any more lines. */
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

/** Characters that neither font has, such as emoji, are left out. */
function splitByFont(preferred: Font, text: string) {
	const runs: { font: Font; text: string }[] = [];

	for (const character of text) {
		const font = [preferred, textFont].find(
			(candidate) => candidate.charToGlyphIndex(character) > 0,
		);
		const last = runs.at(-1);

		if (font && font === last?.font) {
			last.text += character;
		} else if (font) {
			runs.push({ font, text: character });
		}
	}

	return runs;
}

/** Path.toPathData() rounds numbers that are nearly 0 to NaN. */
function toPathData(command: PathCommand) {
	return Object.values<number | string>(command)
		.map((value) => (typeof value === "number" ? value.toFixed(2) : value))
		.join(" ");
}

function wrap(font: Font, text: string, size: number, width: number) {
	const lines: string[] = [];

	for (const word of text.split(" ")) {
		const last = lines.at(-1);
		const longer = last === undefined ? word : `${last} ${word}`;

		if (last !== undefined && getWidth(font, longer, size) <= width) {
			lines[lines.length - 1] = longer;
		} else {
			lines.push(word);
		}
	}

	return lines;
}
