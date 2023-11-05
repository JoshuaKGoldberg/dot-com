import mdx from "@astrojs/mdx";
import prefetch from "@astrojs/prefetch";
import sitemap from "@astrojs/sitemap";
import solidJs from "@astrojs/solid-js";
import { defineConfig, sharpImageService } from "astro/config";
import konamimojisplosion from "astro-konamimojisplosion";

import { site } from "./src/constants";

// https://astro.build/config
export default defineConfig({
	image: {
		service: sharpImageService(),
	},
	integrations: [konamimojisplosion(), solidJs(), prefetch(), mdx(), sitemap()],
	markdown: {
		syntaxHighlight: "prism",
	},
	site,
});
