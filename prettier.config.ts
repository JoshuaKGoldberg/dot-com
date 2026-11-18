import type { Config } from "prettier";

export default {
	overrides: [
		{ files: "*.astro", options: { parser: "astro" } },
		{ files: ".*rc", options: { parser: "json" } },
		{ files: ".nvmrc", options: { parser: "yaml" } },
	],
	plugins: [
		"prettier-plugin-astro",
		"prettier-plugin-curly",
		"prettier-plugin-packagejson",
		"prettier-plugin-padding-lines",
		"prettier-plugin-sentences-per-line",
		"prettier-plugin-sh",
	],
	useTabs: true,
} satisfies Config;
