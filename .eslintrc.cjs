module.exports = {
	env: {
		node: true,
	},
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:astro/recommended",
		"plugin:jsx-a11y/recommended",
		"plugin:perfectionist/recommended-natural",
		"plugin:regexp/recommended",
		"plugin:typescript-sort-keys/recommended",
	],
	overrides: [
		{
			// It would be lovely to enable typed linting in these files...
			// https://github.com/ota-meshi/eslint-plugin-astro/issues/240
			extends: [
				"plugin:@typescript-eslint/strict",
				"plugin:@typescript-eslint/stylistic",
			],
			files: ["*.astro"],
			parser: "astro-eslint-parser",
			parserOptions: {
				extraFileExtensions: [".astro"],
				parser: "@typescript-eslint/parser",
			},
		},
		{
			extends: [
				"plugin:@typescript-eslint/strict-type-checked",
				"plugin:@typescript-eslint/stylistic-type-checked",
			],
			files: ["*.ts", "*.tsx"],
			rules: {
				"deprecation/deprecation": "error",
			},
		},
		{
			excludedFiles: ["package.json"],
			extends: ["plugin:jsonc/recommended-with-json"],
			files: ["*.json", "*.jsonc"],
			parser: "jsonc-eslint-parser",
			rules: {
				"jsonc/sort-keys": "error",
			},
		},
		{
			extends: ["plugin:markdown/recommended"],
			files: ["**/*.md"],
			processor: "markdown/markdown",
		},
		{
			extends: ["plugin:solid/typescript"],
			files: ["*.tsx"],
		},
		{
			extends: ["plugin:yml/standard", "plugin:yml/prettier"],
			files: ["**/*.{yml,yaml}"],
			parser: "yaml-eslint-parser",
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
	],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		project: true,
		tsconfigRootDir: __dirname,
	},
	plugins: [
		"@typescript-eslint",
		"astro",
		"deprecation",
		"jsx-a11y",
		"perfectionist",
		"regexp",
		"solid",
		"typescript-sort-keys",
	],
	root: true,
	rules: {
		"@typescript-eslint/padding-line-between-statements": [
			"error",
			{ blankLine: "always", next: "*", prev: "block-like" },
		],

		// Seems to be conflicting with Prettier
		"no-mixed-spaces-and-tabs": "off",
		// Stylistic concerns that don't interfere with Prettier
		"padding-line-between-statements": "off",
	},
};
