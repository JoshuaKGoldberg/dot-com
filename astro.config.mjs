import mdx from "@astrojs/mdx";
import prefetch from "@astrojs/prefetch";
import solidJs from "@astrojs/solid-js";
import { defineConfig } from "astro/config";
import konamimojisplosion from "astro-konamimojisplosion";

// https://astro.build/config
export default defineConfig({
	integrations: [konamimojisplosion(), solidJs(), prefetch(), mdx()],
	markdown: {
		syntaxHighlight: "prism",
	},
	site: "https://joshuakgoldberg.com",
});
