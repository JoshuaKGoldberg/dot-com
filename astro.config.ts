import mdx from "@astrojs/mdx";
import prefetch from "@astrojs/prefetch";
import solidJs from "@astrojs/solid-js";
import { defineConfig, sharpImageService } from "astro/config";
import konamimojisplosion from "astro-konamimojisplosion";

import { site } from "./src/constants";

export default defineConfig({
	experimental: {
		assets: true,
	},
	image: {
		service: sharpImageService(),
	},
	integrations: [konamimojisplosion(), solidJs(), prefetch(), mdx()],
	markdown: {
		syntaxHighlight: "prism",
	},
	site: site,
});
