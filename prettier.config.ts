import type { Config } from "prettier";

export default {
	overrides: [
		{ files: "*.astro", options: { parser: "astro" } },
		{ files: ".nvmrc", options: { parser: "yaml" } },
	],
	plugins: [
		"./node_modules/prettier-plugin-astro/dist/index.js",
		"prettier-plugin-curly",
		"prettier-plugin-packagejson",
		"prettier-plugin-padding-lines",
		"prettier-plugin-sentences-per-line",
		"prettier-plugin-sh",
	],
	useTabs: true,
} satisfies Config;
