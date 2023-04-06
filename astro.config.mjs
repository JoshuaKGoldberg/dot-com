import solidJs from "@astrojs/solid-js";
import { defineConfig } from "astro/config";

import { remarkReadingTime } from "./remark-reading-time.mjs";

// https://astro.build/config
export default defineConfig({
  integrations: [solidJs()],
  markdown: {
    remarkPlugins: [remarkReadingTime],
  },
});
