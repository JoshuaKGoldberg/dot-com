import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import eslint from "@eslint/js";
import markdown from "@eslint/markdown";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import jsonc from "eslint-plugin-jsonc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import packageJson from "eslint-plugin-package-json";
import perfectionist from "eslint-plugin-perfectionist";
import * as regexp from "eslint-plugin-regexp";
import solid from "eslint-plugin-solid";
import yml from "eslint-plugin-yml";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
	globalIgnores(
		[
			".astro",
			"coverage",
			"dist",
			"node_modules",
			"pnpm-lock.yaml",
			"src/*.d.ts",
		],
		"Global Ignores",
	),
	{
		linterOptions: { reportUnusedDisableDirectives: "error" },
		settings: { tsconfigPath: "tsconfig.json" },
	},
	{
		extends: [
			comments.recommended,
			eslint.configs.recommended,
			jsdoc.configs["flat/contents-typescript-error"],
			jsdoc.configs["flat/logical-typescript-error"],
			jsdoc.configs["flat/stylistic-typescript-error"],
			jsxA11y.flatConfigs.recommended,
			perfectionist.configs["recommended-natural"],
			regexp.configs["flat/recommended"],
			// @ts-expect-error -- Types incompatibility
			solid.configs["flat/recommended"],
			tseslint.configs.strictTypeChecked,
			tseslint.configs.stylisticTypeChecked,
		],
		files: ["**/*.{js,ts,tsx}"],
		languageOptions: {
			parserOptions: {
				projectService: true,
			},
		},
		rules: {
			// TODO: Enable these :)
			"solid/jsx-no-undef": "off",
			"solid/no-unknown-namespaces": "off",
			"solid/prefer-for": "off",
			"solid/self-closing-comp": "off",
			"solid/style-prop": "off",
		},
	},
	astro.configs.recommended,
	{
		extends: [jsonc.configs["flat/recommended-with-json"]],
		files: ["**/*.json"],
	},
	{
		extends: [packageJson.configs.recommended],
		files: ["**/package.json"],
	},
	{
		extends: [markdown.configs.recommended],
		files: ["**/*.md"],
		rules: {
			// https://github.com/eslint/markdown/issues/294
			"markdown/no-missing-label-refs": "off",
		},
	},
	{
		extends: [yml.configs["flat/standard"], yml.configs["flat/prettier"]],
		files: ["**/*.{yml,yaml}"],
		rules: {
			"yml/file-extension": ["error", { extension: "yml" }],
			"yml/sort-sequence-values": [
				"error",
				{ order: { type: "asc" }, pathPattern: "^.*$" },
			],
		},
	},
);
