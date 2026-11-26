import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import solidJs from "@astrojs/solid-js";
import { konamiEmojiBlast } from "@konami-emoji-blast/astro";
import { defineConfig, fontProviders, sharpImageService } from "astro/config";

import { cssModuleTypes } from "./packages/astro-css-module-types";
import { bookTitle, site } from "./src/constants";

// https://astro.build/config
export default defineConfig({
	fonts: [
		{
			cssVariable: "--fontDisplay",
			fallbacks: ["Redaction Noto", "serif"],
			name: "Redaction",
			provider: fontProviders.google(),
			styles: ["normal"],
			subsets: ["latin"],
			weights: [400],
		},
		{
			cssVariable: "--fontText",
			fallbacks: ["Newsreader Times", "Newsreader Noto", "serif"],
			name: "Newsreader",
			optimizedFallbacks: false,
			provider: fontProviders.google(),
			styles: ["normal", "italic"],
			subsets: ["latin", "latin-ext"],
			weights: ["300 600"],
		},
		{
			// Only these letters, as the whole italic font loads late enough to shift text after it
			cssVariable: "--fontBookTitle",
			fallbacks: ["Book Title Times", "Book Title Noto", "serif"],
			name: "Newsreader",
			optimizedFallbacks: false,
			options: { experimental: { glyphs: [bookTitle] } },
			provider: fontProviders.google(),
			styles: ["italic"],
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
		// Photos' originals are hosted there, then resized here at build time
		remotePatterns: [
			{
				hostname: "raw.githubusercontent.com",
				pathname: "/JoshuaKGoldberg/files/main/photos/**",
				protocol: "https",
			},
		],
		service: sharpImageService(),
	},
	integrations: [
		cssModuleTypes(),
		konamiEmojiBlast(),
		solidJs(),
		mdx(),
		sitemap(),
	],
	markdown: {
		processor: unified(),
		syntaxHighlight: "prism",
	},
	prefetch: false,
	site,
});
