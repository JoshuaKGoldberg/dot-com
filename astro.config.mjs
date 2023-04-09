import solidJs from "@astrojs/solid-js";
import { defineConfig } from "astro/config";
import konamimojisplosion from "astro-konamimojisplosion";

import { remarkReadingTime } from "./remark-reading-time.mjs";

export default defineConfig({
	integrations: [konamimojisplosion(), solidJs()],
	markdown: {
		remarkPlugins: [remarkReadingTime],
	},
});
