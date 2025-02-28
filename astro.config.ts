import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import solidJs from "@astrojs/solid-js";
import { konamiEmojiBlast } from "@konami-emoji-blast/astro";
import { defineConfig, sharpImageService } from "astro/config";

import { site } from "./src/constants";

// https://astro.build/config
export default defineConfig({
	image: {
		service: sharpImageService(),
	},
	integrations: [konamiEmojiBlast(), solidJs(), mdx(), sitemap()],
	markdown: {
		syntaxHighlight: "prism",
	},
	prefetch: true,
	site,
});
