// @ts-check
import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import eslint from "@eslint/js";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import jsonc from "eslint-plugin-jsonc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import markdown from "eslint-plugin-markdown";
import packageJson from "eslint-plugin-package-json/configs/recommended";
import perfectionist from "eslint-plugin-perfectionist";
import * as regexp from "eslint-plugin-regexp";
import solid from "eslint-plugin-solid/configs/recommended";
import yml from "eslint-plugin-yml";
import tseslint from "typescript-eslint";

export default tseslint.config(
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
	eslint.configs.recommended,
	...astro.configs.recommended,
	...jsonc.configs["flat/recommended-with-json"],
	jsxA11y.flatConfigs.recommended,
	// @ts-expect-error -- Incorrect @types definition
	...markdown.configs.recommended,
	solid,
	...yml.configs["flat/recommended"],
	...yml.configs["flat/prettier"],
	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Missing src/types.d.ts in linting
	comments.recommended,
	jsdoc.configs["flat/contents-typescript-error"],
	jsdoc.configs["flat/logical-typescript-error"],
	jsdoc.configs["flat/stylistic-typescript-error"],
	packageJson,
	perfectionist.configs["recommended-natural"],
	regexp.configs["flat/recommended"],
	{
		// TODO: Enable these :)
		rules: {
			"solid/jsx-no-undef": "off",
			"solid/no-unknown-namespaces": "off",
			"solid/prefer-for": "off",
			"solid/self-closing-comp": "off",
		},
	},
	...tseslint.config({
		extends: [
			...tseslint.configs.strictTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
		],
		files: ["**/*.js", "**/*.ts"],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	}),
	{
		files: ["*.jsonc"],
		rules: {
			"jsonc/comma-dangle": "off",
			"jsonc/no-comments": "off",
			"jsonc/sort-keys": "error",
		},
	},
	{
		extends: [tseslint.configs.disableTypeChecked],
		files: ["**/*.md/*.ts"],
		rules: {
			"n/no-missing-import": [
				"error",
				{ allowModules: ["create-typescript-app"] },
			],
		},
	},
	{
		files: ["**/*.{yml,yaml}"],
		rules: {
			"yml/file-extension": ["error", { extension: "yml" }],
			"yml/sort-keys": [
				"error",
				{
					order: { type: "asc" },
					pathPattern: "^.*$",
				},
			],
			"yml/sort-sequence-values": [
				"error",
				{
					order: { type: "asc" },
					pathPattern: "^.*$",
				},
			],
		},
	},
);
