import sharp from "sharp";

import { colorsBackground, feedSite } from "~/constants";
import { angleToHue, depthColor } from "~/scenery/color";
import {
	createGoldbergSnark,
	snarkBlocks,
} from "~/scenery/graphs/createGoldbergSnark";
import { interpolate } from "~/scenery/math";
import { pick, type Random, seededRandom } from "~/scenery/random";
import { drawWave } from "~/scenery/squiggles/drawWave";

import { diameter, type Picture } from "./drawPicture";
import { drawLine, getWidth, layOutText } from "./drawText";
import { displayFont, textFont } from "./fonts";
import { previewSize } from "./previewSize";

export interface PreviewContents {
	/** Its bottom is its circle's bottom. */
	picture: Picture;

	subtitle: string;
	title: string;
}

const { height, width } = previewSize;

/** The dark theme's, except for brighter squiggles. */
const colors = {
	disc: "#141a26",
	foreground: "#dae7f3",
	foregroundExtra: "#f1f6fb",
	muted: "#93a5bf",
	ring: ["#4fc3ff", "#b98aff", "#ff7fb0", "#4dffb0"],
	squiggle: ["#8a9bde", "#8fded0", "#b99be0"],
};

const left = 80;
const textWidth = 540;

const circle = { radius: diameter / 2, x: 905, y: 315 };
const snarkRadius = 285;

const auroras = [
	{ color: "#38ff99", opacity: 0.2, rx: 340, ry: 130, x: 130, y: -20 },
	{ color: "#33bfff", opacity: 0.2, rx: 380, ry: 140, x: 520, y: -50 },
	{ color: "#ad73ff", opacity: 0.22, rx: 360, ry: 150, x: 920, y: 660 },
	{ color: "#ff669e", opacity: 0.16, rx: 260, ry: 130, x: 1190, y: 640 },
];

const signature = {
	color: colors.muted,
	font: textFont,
	size: 28,
	text: new URL(feedSite).hostname,
	x: left,
	y: height - 76,
};

// Only drawn once, as blurring is slow
const backdrop = await sharp(
	createSvg(`
		<filter id="blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="70"/></filter>
		<rect width="100%" height="100%" fill="${colorsBackground.dark}"/>
		<g filter="url(#blur)">${auroras.map(({ color, opacity, rx, ry, x, y }) => `<ellipse cx="${x.toString()}" cy="${y.toString()}" rx="${rx.toString()}" ry="${ry.toString()}" fill="${color}" opacity="${opacity.toString()}"/>`).join("")}</g>
	`),
)
	.png()
	.toBuffer();

export async function drawPreview({
	picture,
	subtitle,
	title,
}: PreviewContents) {
	const random = seededRandom(getSeed(title));
	const titleText = layOutText({
		color: colors.foregroundExtra,
		font: displayFont,
		lineHeight: 1.06,
		maximumHeight: 240,
		sizes: [100, 92, 84, 76, 68, 60, 54, 48],
		text: title,
		width: textWidth,
	});
	const subtitleText = layOutText({
		color: colors.foreground,
		font: textFont,
		lineHeight: 1.3,
		maximumHeight: 150,
		sizes: [34, 31, 28, 25],
		text: subtitle,
		width: textWidth,
	});
	const gap = 22;
	const top = (height - 70 - titleText.height - gap - subtitleText.height) / 2;
	const wave = drawWave({
		amplitude: 2.6,
		phase: 0,
		wavelength: 24,
		width: getWidth(signature.font, signature.text, signature.size),
		y: 6,
	});

	return sharp(backdrop)
		.composite([
			{
				input: createSvg(`
					${createGradient("squiggle", "", colors.squiggle)}
					${drawStars(random)}
					${drawSnark(pick(random, snarkBlocks))}
					<circle cx="${circle.x.toString()}" cy="${circle.y.toString()}" r="${circle.radius.toString()}" fill="${colors.disc}"/>
					${drawRing(0)}
					${titleText.toSvg(left, top)}
					${subtitleText.toSvg(left, top + titleText.height + gap)}
					${drawLine(signature)}
					<path transform="translate(${left.toString()} ${(signature.y + 10).toString()})" d="${wave}" fill="none" stroke="url(#squiggle)" stroke-width="3" stroke-linecap="round"/>
				`),
			},
			{
				input: picture.file,
				left: circle.x - circle.radius,
				top: circle.y - circle.radius - picture.above,
			},
			{ input: createSvg(drawRing(picture.isPerson ? circle.y : 0)) },
		])
		.jpeg({ mozjpeg: true, quality: 88 })
		.toBuffer();
}

function createGradient(id: string, attributes: string, stops: string[]) {
	const last = stops.length - 1;

	return `<linearGradient id="${id}" ${attributes}>${stops.map((color, index) => `<stop offset="${(index / last).toString()}" stop-color="${color}"/>`).join("")}</linearGradient>`;
}

function createSvg(contents: string) {
	return Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width.toString()}" height="${height.toString()}">${contents}</svg>`,
	);
}

function drawRing(top: number) {
	return `
		${createGradient("ring", `x2="1" y2="1"`, colors.ring)}
		<clipPath id="below"><rect y="${top.toString()}" width="100%" height="100%"/></clipPath>
		<circle cx="${circle.x.toString()}" cy="${circle.y.toString()}" r="${(circle.radius + 1).toString()}" fill="none" stroke="url(#ring)" stroke-width="3" opacity="0.8" clip-path="url(#below)"/>
	`;
}

function drawSnark(blocks: number) {
	const { edges, vertices } = createGoldbergSnark(blocks);
	const points = vertices.map(({ depth, x, y }) => ({
		color: depthColor(angleToHue(x, y), depth, 1),
		depth,
		x: circle.x + x * snarkRadius,
		y: circle.y + y * snarkRadius,
	}));
	const lines = edges.map(([from, to]) => {
		const depth = (points[from].depth + points[to].depth) / 2;

		return `<line x1="${points[from].x.toFixed(1)}" y1="${points[from].y.toFixed(1)}" x2="${points[to].x.toFixed(1)}" y2="${points[to].y.toFixed(1)}" stroke="${points[from].color}" stroke-width="${(1 + depth * 2).toFixed(1)}" opacity="${interpolate(0.3, 0.8, depth).toFixed(2)}"/>`;
	});
	const dots = points.map(
		({ color, depth, x, y }) =>
			`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2 + depth * 3).toFixed(1)}" fill="${color}" opacity="${interpolate(0.5, 0.95, depth).toFixed(2)}"/>`,
	);

	return [...lines, ...dots].join("");
}

function drawStars(random: Random) {
	return Array.from({ length: 130 }, () => {
		const x = random() * width;
		const y = random() * height;
		const opacity = interpolate(0.08, 0.4, random());
		const radius = interpolate(0.6, 1.9, random() ** 2);

		return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${colors.foreground}" opacity="${opacity.toFixed(2)}"/>`;
	}).join("");
}

function getSeed(text: string) {
	return Array.from(text).reduce(
		(seed, character) => (seed * 31 + (character.codePointAt(0) ?? 0)) | 0,
		7,
	);
}
