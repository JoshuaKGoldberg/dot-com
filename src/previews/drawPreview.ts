import sharp from "sharp";

import { angleToHue, depthColor } from "~/scenery/color";
import { createGoldbergSnark } from "~/scenery/graphs/createGoldbergSnark";
import { interpolate } from "~/scenery/math";
import { pick, seededRandom } from "~/scenery/random";
import { drawWave } from "~/scenery/squiggles/drawWave";

import { drawLine, layOutText } from "./drawText";
import { displayFont, textFont } from "./fonts";
import { previewSize } from "./previewSize";

export interface Picture {
	file: Buffer;

	/** Whether it may be in front of the top of its circle. */
	isPerson: boolean;
}

export interface PreviewContents {
	/** Centered on its circle, other than whatever's above that. */
	picture: Picture;
	signature: string;
	subtitle: string;
	title: string;
}

const { height, width } = previewSize;

const background = "#0b1220";
const left = 80;
const textWidth = 540;

const circle = { radius: 195, x: 905, y: 315 };
const snarkRadius = 285;

const auroras = [
	{ color: "#38ff99", opacity: 0.2, rx: 340, ry: 130, x: 130, y: -20 },
	{ color: "#33bfff", opacity: 0.2, rx: 380, ry: 140, x: 520, y: -50 },
	{ color: "#ad73ff", opacity: 0.22, rx: 360, ry: 150, x: 920, y: 660 },
	{ color: "#ff669e", opacity: 0.16, rx: 260, ry: 130, x: 1190, y: 640 },
];

export async function drawPreview({
	picture,
	signature,
	subtitle,
	title,
}: PreviewContents) {
	const random = seededRandom(getSeed(title));
	const titleText = layOutText({
		color: "#f1f6fb",
		font: displayFont,
		lineHeight: 1.06,
		maximumHeight: 240,
		sizes: [100, 92, 84, 76, 68, 60, 54, 48],
		text: title,
		width: textWidth,
	});
	const subtitleText = layOutText({
		color: "#b9c8dc",
		font: textFont,
		lineHeight: 1.3,
		maximumHeight: 150,
		sizes: [34, 31, 28, 25],
		text: subtitle,
		width: textWidth,
	});
	const gap = 22;
	const top = (height - 70 - titleText.height - gap - subtitleText.height) / 2;
	const signatureY = height - 76;
	const signatureWidth = textFont.getAdvanceWidth(signature, 28);

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toString()}" height="${height.toString()}">
		<defs>
			<filter id="blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="70"/></filter>
			<linearGradient id="squiggle"><stop offset="0" stop-color="#8a9bde"/><stop offset="0.5" stop-color="#8fded0"/><stop offset="1" stop-color="#b99be0"/></linearGradient>
		</defs>
		<rect width="100%" height="100%" fill="${background}"/>
		<g filter="url(#blur)">${auroras.map(({ color, opacity, rx, ry, x, y }) => `<ellipse cx="${x.toString()}" cy="${y.toString()}" rx="${rx.toString()}" ry="${ry.toString()}" fill="${color}" opacity="${opacity.toString()}"/>`).join("")}</g>
		${drawStars(random)}
		${drawSnark(pick(random, [5, 7, 9, 11, 13, 15]))}
		<circle cx="${circle.x.toString()}" cy="${circle.y.toString()}" r="${circle.radius.toString()}" fill="#141a26"/>
		${drawRing(0)}
		${titleText.toSvg(left, top)}
		${subtitleText.toSvg(left, top + titleText.height + gap)}
		${drawLine(textFont, signature, left, signatureY, 28, "#93a5bf")}
		<path transform="translate(${left.toString()} ${(signatureY + 10).toString()})" d="${drawWave({ amplitude: 2.6, period: 24, phase: 0, width: signatureWidth, y: 6 })}" fill="none" stroke="url(#squiggle)" stroke-width="3" stroke-linecap="round"/>
	</svg>`;
	const pictureHeight = (await sharp(picture.file).metadata()).height;

	return sharp(Buffer.from(svg))
		.composite([
			{
				input: picture.file,
				left: circle.x - circle.radius,
				top: circle.y + circle.radius - pictureHeight,
			},
			{
				input: Buffer.from(
					`<svg xmlns="http://www.w3.org/2000/svg" width="${width.toString()}" height="${height.toString()}">${drawRing(picture.isPerson ? circle.y : 0)}</svg>`,
				),
			},
		])
		.jpeg({ mozjpeg: true, quality: 88 })
		.toBuffer();
}

function drawRing(top: number) {
	return `<defs><linearGradient id="ring" x2="1" y2="1"><stop offset="0" stop-color="#4fc3ff"/><stop offset="0.4" stop-color="#b98aff"/><stop offset="0.7" stop-color="#ff7fb0"/><stop offset="1" stop-color="#4dffb0"/></linearGradient><clipPath id="below"><rect y="${top.toString()}" width="100%" height="100%"/></clipPath></defs><circle cx="${circle.x.toString()}" cy="${circle.y.toString()}" r="${(circle.radius + 1).toString()}" fill="none" stroke="url(#ring)" stroke-width="3" opacity="0.8" clip-path="url(#below)"/>`;
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

function drawStars(random: () => number) {
	return Array.from({ length: 130 }, () => {
		const x = random() * width;
		const y = random() * height;
		const opacity = interpolate(0.08, 0.4, random());
		const radius = interpolate(0.6, 1.9, random() ** 2);

		return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="#dae7f3" opacity="${opacity.toFixed(2)}"/>`;
	}).join("");
}

function getSeed(text: string) {
	return Array.from(text).reduce(
		(seed, character) => (seed * 31 + (character.codePointAt(0) ?? 0)) | 0,
		7,
	);
}
