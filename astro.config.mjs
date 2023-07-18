import prefetch from "@astrojs/prefetch";
import solidJs from "@astrojs/solid-js";
import { defineConfig } from "astro/config";
import konamimojisplosion from "astro-konamimojisplosion";

export default defineConfig({
	integrations: [konamimojisplosion(), solidJs(), prefetch()],
	markdown: {
		syntaxHighlight: "prism",
	},
	site: "https://joshuakgoldberg.com",
});
