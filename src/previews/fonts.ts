import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

export const displayFont = await loadFont(
	import.meta
		.resolve("@fontsource/redaction/files/redaction-latin-400-normal.woff"),
);

export const textFont = await loadFont(
	import.meta
		.resolve("@fontsource/newsreader/files/newsreader-latin-400-normal.woff"),
);

async function loadFont(url: string) {
	const file = await fs.readFile(fileURLToPath(url));

	return opentype.parse(new Uint8Array(file).buffer);
}
