import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import eslint from "@eslint/js";
import markdown from "@eslint/markdown";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import jsonc from "eslint-plugin-jsonc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import markdownLinks from "eslint-plugin-markdown-links";
import n from "eslint-plugin-n";
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
			n.configs["flat/recommended"],
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
			// Stylistic concerns that don't interfere with Prettier
			"logical-assignment-operators": [
				"error",
				"always",
				{ enforceForIfStatements: true },
			],
			"no-useless-rename": "error",
			"object-shorthand": "error",
			"operator-assignment": "error",

			// TypeScript already checks imports, including Astro's virtual modules
			"n/no-missing-import": "off",

			// TODO: Enable these :)
			"solid/jsx-no-undef": "off",
			"solid/no-unknown-namespaces": "off",
			"solid/prefer-for": "off",
			"solid/self-closing-comp": "off",
			"solid/style-prop": "off",
		},
		settings: { perfectionist: { partitionByComment: true, type: "natural" } },
	},
	astro.configs.recommended,
	{
		extends: [jsonc.configs["flat/recommended-with-json"]],
		files: ["**/*.json"],
	},
	{
		extends: [markdown.configs.recommended, markdownLinks.configs.recommended],
		files: ["**/*.md"],
		rules: {
			// https://github.com/eslint/markdown/issues/294
			"markdown/no-missing-label-refs": "off",
		},
	},
	{
		extends: [tseslint.configs.disableTypeChecked],
		files: ["**/*.md/*.ts"],
		rules: { "n/no-missing-import": "off" },
	},
	{
		files: ["**/*.test.*", "eslint.config.*"],
		rules: { "n/no-unsupported-features/node-builtins": "off" },
	},
	{
		extends: [yml.configs["flat/standard"], yml.configs["flat/prettier"]],
		files: ["**/*.{yml,yaml}"],
		rules: {
			"yml/file-extension": "error",
			"yml/sort-keys": [
				"error",
				{ order: { type: "asc" }, pathPattern: "^.*$" },
			],
			"yml/sort-sequence-values": [
				"error",
				{ order: { type: "asc" }, pathPattern: "^.*$" },
			],
		},
	},
	{
		extends: [packageJson.configs.recommended, packageJson.configs.stylistic],
		files: ["package.json"],
	},
);
