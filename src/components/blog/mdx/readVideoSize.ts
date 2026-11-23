import { readFile } from "node:fs/promises";
import path from "node:path";

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

/** Reads the dimensions of a WebM asset, so that space can be reserved for it. */
export async function readVideoSize(src: string) {
	const file = Object.entries(videos).find(([, url]) => url === src)?.[0];
	if (!file) {
		return null;
	}

	const contents = await readFile(path.join(process.cwd(), file));
	const { height, width } =
		sizePattern.exec(contents.toString("latin1"))?.groups ?? {};

	return height && width
		? { height: readNumber(height), width: readNumber(width) }
		: null;
}

/** Reads a big-endian number from the characters of its bytes. */
function readNumber(bytes: string) {
	return Buffer.from(bytes, "latin1").readUIntBE(0, bytes.length);
}
