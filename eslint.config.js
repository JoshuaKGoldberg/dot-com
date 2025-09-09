import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import eslint from "@eslint/js";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import jsonc from "eslint-plugin-jsonc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import markdown from "eslint-plugin-markdown";
import packageJson from "eslint-plugin-package-json";
import perfectionist from "eslint-plugin-perfectionist";
import * as regexp from "eslint-plugin-regexp";
import solid from "eslint-plugin-solid/configs/recommended";
import yml from "eslint-plugin-yml";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
	{
		ignores: [
			".astro",
			"coverage",
			"dist",
			"node_modules",
			"pnpm-lock.yaml",
			"src/*.d.ts",
		],
	},
	{
		linterOptions: {
			reportUnusedDisableDirectives: "error",
		},
		settings: {
			tsconfigPath: "tsconfig.json",
		},
	},
	astro.configs.recommended,
	comments.recommended,
	eslint.configs.recommended,
	jsdoc.configs["flat/contents-typescript-error"],
	jsdoc.configs["flat/logical-typescript-error"],
	jsdoc.configs["flat/stylistic-typescript-error"],
	jsonc.configs["flat/recommended-with-json"],
	jsxA11y.flatConfigs.recommended,
	markdown.configs.recommended,
	packageJson.configs.recommended,
	perfectionist.configs["recommended-natural"],
	regexp.configs["flat/recommended"],
	solid,
	{
		// TODO: Enable these :)
		rules: {
			"solid/jsx-no-undef": "off",
			"solid/no-unknown-namespaces": "off",
			"solid/prefer-for": "off",
			"solid/self-closing-comp": "off",
		},
	},
	{
		extends: [
			...tseslint.configs.strictTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
		],
		files: ["**/*.js", "**/*.ts"],
		languageOptions: {
			parserOptions: {
				projectService: true,
			},
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
