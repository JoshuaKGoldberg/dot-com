export type ProjectCategory = keyof typeof projects;

export interface Project {
	description: string;
	image?: string;
	role?: string;
	title: string;
}

export const projects = {
	"Biggest Projects": [
		{
			description:
				"The tooling that enables ESLint and Prettier to support TypeScript.",
			image: "typescript-eslint.svg",
			title: "typescript-eslint",
			role: "Maintainer",
		},
		{
			description:
				"Converts JavaScript to TypeScript and TypeScript to better TypeScript.",
			image: "typestat.png",
			title: "TypeStat",
		},
	],
	"Developer Tooling": [
		{
			description:
				"A quickstart-friendly TypeScript template with comprehensive formatting, linting, releases, testing, and other great tooling built-in.",
			title: "template-typescript-node-package",
		},
		{
			description:
				"ESLint plugin with $ExpectType, $ExpectError, and $ExpectTypeSnapshot type assertions.",
			role: "Adoptive Maintainer",
			title: "eslint-plugin-expect-type",
		},
		{
			description:
				"TypeScript transformation that inlines calls to small functions. ⚡️",
			title: "ts-function-inliner",
		},
		{
			description:
				"🎭 Mocks out Redux actions and selectors for clean React Jest tests.",
			title: "mock-react-redux",
		},
		{
			description:
				"Chrome extension for GitHub's Saved Replies that adds replies from a repository's .github/replies.yml.",
			title: "refined-saved-replies",
		},
		{
			description:
				"Gently fails test runs if the console was used during them.",
			title: "console-fail-test",
		},
		{
			description:
				"Utility functions for working with TypeScript's API. Successor to the wonderful ajafff/tsutils.",
			title: "ts-api-utils",
		},
		{
			description: "Contributed markdownlint rule for one sentence per line.",
			title: "sentences-per-line",
		},
		{
			description: "Creates a Markdown table summarizing your GitHub sponsors.",
			title: "github-sponsors-to-markdown",
		},
		{
			description:
				"Checks whether a semantic release should be run for a commit.",
			title: "should-semantic-release",
		},
		{
			description:
				"A version of Sinon's useFakeTimers that you can call multiple times in a test.",
			title: "sinon-timers-repeatable",
		},
	],
	Emojis: [
		{
			description:
				"💥Blasts 😄emoji😊 like 🎆fireworks🎇 all up in your 💻HTML 📄page. 😚😍",
			title: "Emojisplosion",
		},
		{
			description:
				"Connects konami-code-js to emojisplosion for a glorious easter egg. 🎉 ✨ 🎆",
			title: "Konamimojisplosion",
		},
		{
			description:
				"TypeDoc plugin to quickly integrate konamimojisplosion into your docs site. 🎉 ✨ 🎆",
			title: "typedoc-plugin-konamimojisplosion",
		},
	],
	"Just for Fun": [
		{
			description:
				"HTML5 remake of the original SMB with a level editor and random maps. Shut down by Nintendo.",
			image: "fullscreenmario.png",
			title: "FullScreenMario",
		},
		{
			description:
				"HTML5 remake of the original SMB with a level editor and random maps. Shut down by Nintendo.",
			image: "fullscreenpokemon.png",
			title: "FullScreenPokemon",
		},
		{
			description:
				"Bare-=bones, highly modular TypeScript game engine for 2D 8-bit games.",
			title: "EightBittr",
		},
		{
			description: "Choosing a modern JavaScript UI framework, Pokemon-style.",
			title: "ChooseYourFramework",
		},
		{
			description:
				"A unified syntax that compiles into your favorite OOP languages.",
			image: "budgie.png",
			title: "Budgie",
		},
		[
			{
				description: "Converts C# code to Budgie.",
				title: "cs-budgie",
			},
			{
				description: "Converts natural language to Budgie.",
				title: "NBudgie",
			},
			{
				description: "Converts TypeScript code to Budgie.",
				title: "ts-budgie",
			},
		],
	],
} satisfies Record<string, (Project | Project[])[]>;
