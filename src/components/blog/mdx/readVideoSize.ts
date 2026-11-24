import { readFile } from "node:fs/promises";
import path from "node:path";

export interface VideoSize {
	height: number;
	width: number;
}

const videos = import.meta.glob<string>("/src/assets/blog/*.webm", {
	eager: true,
	import: "default",
	query: "?url",
});

/**
 * A WebM video track's PixelWidth, then PixelHeight.
 * Each is an ID, its length (0x81 is one byte, 0x82 is two), and then its value.
 */
const sizePattern =
	/\xb0[\x81\x82](?<width>(?<=\x81).|(?<=\x82)..)\xba[\x81\x82](?<height>(?<=\x81).|(?<=\x82)..)/s;

export async function readVideoSize(src: string): Promise<VideoSize> {
	const file = Object.entries(videos).find(([, url]) => url === src)?.[0];
	if (!file) {
		throw new Error(`Not a WebM in src/assets/blog: ${src}`);
	}

	const contents = await readFile(path.join(process.cwd(), file));
	const { height, width } =
		sizePattern.exec(contents.toString("latin1"))?.groups ?? {};

	if (!height || !width) {
		throw new Error(`Could not read the video's size, is it a WebM? ${file}`);
	}

	return { height: readBigEndian(height), width: readBigEndian(width) };
}

function readBigEndian(bytes: string) {
	return Buffer.from(bytes, "latin1").readUIntBE(0, bytes.length);
}
