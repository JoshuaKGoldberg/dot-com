import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import solidJs from "@astrojs/solid-js";
import { konamiEmojiBlast } from "@konami-emoji-blast/astro";
import { defineConfig, fontProviders, sharpImageService } from "astro/config";

import { site } from "./src/constants";

// https://astro.build/config
export default defineConfig({
	fonts: [
		{
			cssVariable: "--fontDisplay",
			fallbacks: ["serif"],
			name: "Redaction",
			provider: fontProviders.google(),
			styles: ["normal"],
			subsets: ["latin"],
			weights: [400],
		},
		{
			cssVariable: "--fontText",
			fallbacks: ["serif"],
			name: "Newsreader",
			provider: fontProviders.google(),
			styles: ["normal", "italic"],
			subsets: ["latin"],
			weights: ["300 600"],
		},
		{
			cssVariable: "--fontLabel",
			fallbacks: ["sans-serif"],
			name: "Hedvig Letters Sans",
			provider: fontProviders.google(),
			styles: ["normal"],
			subsets: ["latin"],
			weights: [400],
		},
		{
			cssVariable: "--fontCode",
			fallbacks: ["monospace"],
			name: "IBM Plex Mono",
			provider: fontProviders.google(),
			styles: ["normal"],
			subsets: ["latin"],
			weights: [400],
		},
	],
	image: {
		service: sharpImageService(),
	},
	integrations: [konamiEmojiBlast(), solidJs(), mdx(), sitemap()],
	markdown: {
		processor: unified(),
		syntaxHighlight: "prism",
	},
	prefetch: true,
	site,
});
