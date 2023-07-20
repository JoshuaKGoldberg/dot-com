---
date: 2023-05-01
description: "How I recommend getting your formatter, linter, and type checker to play together nicely."
image:
  alt: Josh smiling on stage and giving a presentation showing the "Type Checking React (v2)" from the linked slides.
  src: react-miami-me-speaking.jpg
tags: ["formatting", "eslint", "linting", "prettier", "react", "style"]
title: "Configuring ESLint, Prettier, and TypeScript Together"
---

_Static analysis_ is tooling that scrutinizes code without running it.
This is in contrast with _dynamic analysis_: tooling such as testing that executes your code and scrutinizes the result.
Static analysis tools tend to exist on a spectrum from speed to power:

1. **Formatters** _(e.g. [Prettier](https://prettier.io))_: which only format your code quickly, without worrying about logic
2. **Linters** _(e.g. [ESLint](https://eslint.org))_: which run a set of discrete rules meant to check the raw logic of your code, one file at a time
3. **Type checkers** _(e.g. [TypeScript](https://typescriptlang.org))_: which generate an understanding of all your files at once and validate that code behavior matches intent

I recently [gave a talk at React Miami 2023](https://www.reactmiami.com/speakers/joshuagoldberg) about setting up ESLint and TypeScript for React that includes my recommendations.
This blog post covers all the info in that talk: describing how to get started with each form of static analysis in JavaScript/TypeScript and some quick tips for using them effectively.

<iframe
	width="560"
	height="315"
	src="https://www.youtube-nocookie.com/embed/mPPZ-NUnR-4?start=25744"
	title="YouTube video player"
	frameborder="0"
	allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
	allowfullscreen
></iframe>

<em style="display:block;margin-bottom:2rem;text-align:center;">
	<a href="https://www.youtube.com/live/mPPZ-NUnR-4?feature=share&t=25743">
		You can watch my talk along with all the other React Miami talks here on
		YouTube
	</a>
	<br />
	<small>
		Photo credit <a href="https://twitter.com/Beccalytics">Rebecca Bakels</a>.{" "}
		<a href="https://1drv.ms/p/s!AvUc1cvPrJnWvt0cjx-_PLIwDIzclw">
			See the PowerPoint slides here
		</a>
		.
	</small>
</em>

## Resources

Everything in this blog post is available online for free:

- [My talk's recording](https://www.youtube.com/live/mPPZ-NUnR-4?feature=share&t=25743) and [accompanying talk slides](https://1drv.ms/p/s!AvUc1cvPrJnWvt0cjx-_PLIwDIzclw)
- [template-typescript-node-package](https://github.com/JoshuaKGoldberg/template-typescript-node-package): Template repo I maintain that sets up these three tools (and more!) in a general Node package
- [Linting TypeScript in 2023](https://github.com/JoshuaKGoldberg/linting-typescript-in-2023): Demo repo showing using three type-checked typescript-eslint rules to catch three bugs in a React app

I've also posted a separate [FAQs article](../configuring-eslint-prettier-and-typescript-together-faqs) for assorted questions.

### Abstract Syntax Trees (ASTs)

Before we dig into the tools, I want to briefly mention _Abstract Syntax Trees (ASTs)_.

An AST is an object description of your source code's contents.
Static analysis tools generally read your source files into an AST to be able to understand your code.

For example, code like `friend = friend || "me"` could be represented with something like:

```json
{
	"expression": {
		"left": "friend",
		"operator": "=",
		"right": {
			"left": "friend",
			"operator": "||",
			"right": "\"me\"",
			"type": "LogicalExpression"
		}
	},
	"type": "AssignmentExpression"
}
```

> If you're curious how TypeScript ASTs work, you can read about them on [ASTs and typescript-eslint](https://typescript-eslint.io/blog/asts-and-typescript-eslint) and play around with them on [typescript-eslint.io/play](https://typescript-eslint.io/play).

The concept of ASTs sometimes shows up in tool documentation - and while **you don't need to understand ASTs to use static analysis tools**, they're a useful concept in general.
Just know that when someone says AST, they're talking about how tools represent your code.

Enough theory!
Let's dig into the types of tools.

## Formatting

<p style="text-align:center">
	<img
		alt="Cute otter cleaning itself in a body of water."
		src="./otter-cleaning.gif"
	/>
	<em style="display:block;text-align:center;">
		<small>
			Formatters clean your code. That's all they do. [
			<a href="https://giphy.com/gifs/montereybayaquarium-face-otter-sea-1xlGfZ07Dq62jqKT9t">
				image source
			</a>
			]
		</small>
	</em>
</p>

A formatter is a tool that reads in your source code, ignores your formatting, and suggests how to write it.
For example, given this oddly formatted code block:

<!-- prettier-ignore -->
```ts
friend =  friend
    || "me"
```

...a formatter might suggest rewriting it like so:

```ts
friend = friend || "me";
```

Note that the formatter didn't change the logic of the code.
It just cleaned it up visually to be easier to read.
Which is wonderful - using formatters, we don't have to manually format files ourselves!

[Prettier](https://prettier.io) is the most common formatter in web apps today.
You can get started using it by installing it as a dependency, then running it with `--write` on `.` (the current directory) to auto-format all your files:

```shell
npm install prettier --save-dev
npx prettier . --write
```

I'd encourage you to read the [Prettier docs](https://prettier.io) and [Prettier installation guide](https://prettier.io/docs/en/install.html) in particular for more details.

### Editor Formatting Settings

I'd also encourage you to enable the [Prettier extension for VS Code](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) in your [`.vscode/extensions.json` workspace recommendations](https://code.visualstudio.com/docs/editor/extension-marketplace#_workspace-recommended-extensions):

```json
// .vscode/extensions.json​
{​
  "recommendations": ["esbenp.prettier-vscode"]​
}
```

...then set it as your default formatter and enable formatting on save in your [`.vscode/settings.json` workspace settings](https://code.visualstudio.com/docs/getstarted/settings#_workspace-settings):

```json
// .vscode/settings.json​
{​
  "editor.defaultFormatter": "esbenp.prettier-vscode",​
  "editor.formatOnSave": true​
}
```

That way, every time you save a file or run the [VS Code _Format Document_ command](https://code.visualstudio.com/docs/editor/codebasics#_formatting), Prettier will completely format your document for you.
That means you don't have to fix up spaces, newlines, etc. manually!

[Prettier also has configuration options](https://prettier.io/docs/en/configuration.html).
But, I generally avoid most of them and go with the default recommendations.
As long as my formatting is consistent, I don't sweat the details.
The only option I generally set in my configs is [changing `useTabs` to true](https://github.com/prettier/prettier/issues/7475):

```json
// .prettierrc.json
{
	"useTabs": true
}
```

> If you want much more control over your formatting, you might prefer [dprint](https://dprint.dev) for formatting.
> It's much more configurable than Prettier, though less widely used.

## Linting

<p style="text-align:center">
	<img
		alt="Will Ferrel in SNL banging a cowbell behind the band in the 'needs more cowbell' sketch. Caption: 'NEEDS MORE LINT RULES'"
		src="/images/blog/needs-more-lint-rules.gif"
	/>
	<em style="display:block;text-align:center;">
		<small>me irl</small>
	</em>
</p>

A linter is a tool that runs a set of checks on your source code.
Modern linters such as [ESLint](https://eslint.org), the standard linter for JavaScript, generally set those up to be discrete rules (they run independently and don't have any visibility into which other rules are enabled).
Each rule may report on code it doesn't like, and each complaint may contain an optional autofix.

For example, if you enabled the [ESLint `logical-assignment-operators` rule](https://eslint.org/docs/latest/rules/logical-assignment-operators) on the snippet from _Formatting_, you'd receive a message and suggested fix like:

```diff
- friend = friend || "me";
+ friend ||= "me";
Assignment (=) can be replaced with operator assignment (||=).
```

> You can see the [ESLint playground showing the logical assignment complaint](https://eslint.org/play/#eyJ0ZXh0IjoiLyogZXNsaW50IGxvZ2ljYWwtYXNzaWdubWVudC1vcGVyYXRvcnM6IGVycm9yICovXG5mcmllbmQgPSBmcmllbmQgfHwgXCJtZVwiOyIsIm9wdGlvbnMiOnsicGFyc2VyT3B0aW9ucyI6eyJlY21hVmVyc2lvbiI6ImxhdGVzdCIsInNvdXJjZVR5cGUiOiJzY3JpcHQiLCJlY21hRmVhdHVyZXMiOnt9fSwicnVsZXMiOnsicmVxdWlyZS11bmljb2RlLXJlZ2V4cCI6WyJlcnJvciJdfSwiZW52Ijp7ImVzNiI6dHJ1ZX19fQ==).

To get started locally with ESLint, you can install it as a dependency, run its initializer to create a starter config, and run ESLint on your current directory (`.`):

```shell
npm install eslint --save-dev
npm init @eslint/config

npx eslint .
```

### ESLint Configurations

Your ESLint configuration file is a description of all the ESLint plugins (npm packages that add additional rules or other linting behavior) and configuration options for rules you want to enable or disable.
Each rule can be set to one of three severities:

- `"off"`: it shouldn't be run at all
- `"warn"`: its complaints should show up as warnings (yellow squigglies), and shouldn't cause ESLint to exit with a non-zero status code (i.e. not failing the build)
- `"error"`: its complaints should show up as errors (red squigglies), and should cause ESLint to exit with a non-zero status code (i.e. failing the build)

Manually configuring each and every rule you'd want to enable would be a lot of work - a lot of projects enable hundreds of rules!
Instead, ESLint allows configurations to extend from preset configs that do the work of choosing & configuring rules for you.
I strongly recommend _at the very least_ extending from [ESLint's `eslint:recommended` config](https://eslint.org/docs/latest/use/configure/configuration-files#using-eslintrecommended), which contains rules the ESLint team has found to be desirable for the vast majority of JavaScript projects:

```js
// .eslintrc.js
module.exports = {
	extends: "eslint:recommended",
};
```

### Granular Rule Configuration

You can always disable ESLint rules that aren't useful for you, or have too many errors.
That's right - it's ok to disable a lint rule!
The linter is a tool like any other, and it should be configured to match your needs.

My general recommendation for configuring ESLint is to:

1. Install all plugins relevant to your project
1. Extend from each of the plugins' recommended configs
1. In your ESLint config:
   1. Disable any lint rules that you know you don't want, and explain why
   1. Also disable any lint rules that you do want but don't have time to enable yet, with a tracking issue/ticket filed to enable eventually

```js
// .eslintrc.js
module.exports = {
	extends: "eslint:recommended",
	rules: {
		// These rules are enabled by default, but we don't want
		"some-annoying-rule": "off", // (conflicts with XYZ preference)

		// Todo: these rules might be useful; we should investigate each
		"powerful-rule": "off", // (#123)
	},
};
```

#### Configuring ESLint for React (Or Similar)

> You can ignore this section if you don't work in a frontend framework that uses JSX or other nonstandard JavaScript dialects.

Since the linked talk was given at a React conference, it also showed configuring ESLint for React.
Any project that uses JSX with vanilla JavaScript needs to set `parserOptions.ecmaFeatures.jsx` to `true` so that ESLint's parser knows to allow JSX.
There are two commonly used plugins for React:

- [`eslint-plugin-react`](https://www.npmjs.com/package/eslint-plugin-react) for all of React
- [`eslint-plugin-react-hooks`](https://www.npmjs.com/package/eslint-plugin-react-hooks) for hooks specifically

`eslint-plugin-react` additionally asks to configure `settings.react.version` so it knows which React-version-specific behavior to run with.

```js
// .eslintrc.js
module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["react", "react-hooks"],
  settings: {
    react: {
      version: "detect",
    },
  },
};​
```

Other frameworks/libraries have their own plugins, including [`eslint-plugin-astro`](https://www.npmjs.com/package/eslint-plugin-astro), [`eslint-plugin-solid`](https://www.npmjs.com/package/eslint-plugin-solid), etc.

### More Linting Flags

I generally recommend enabling two more flags in ESLint runs.

#### Reporting Unused Disable Directives

_"Disable directives"_ are comments in code that disable some or all ESLint rule(s) for a particular area of code.
For example, this block disables [`no-console`](https://eslint.org/docs/latest/rules/no-console) for a single log:

```js
// eslint-disable-next-line no-console
console.log("Hello, world!");
```

ESLint by default won't warn you if you leave those comments in places that don't need them:

```js
// eslint-disable-next-line no-console
myFancyLogger("Hello, world!");
```

[`--report-unused-disable-directives`](https://eslint.org/docs/latest/use/command-line-interface#--report-unused-disable-directives) causes ESLint to treat unnecessary disable directives the same as a complaint from an actual lint rule.

```json
// package.json
{
	"scripts": {
		"lint": "eslint . --report-unused-disable-directives"
	}
}
```

> Fun fact: I authored the [PR that enabled `--report-unused-disable-directives` violations to be fixed by `--fix`](https://github.com/eslint/eslint/pull/14617).
> Hooray, open source!

#### Warnings Maximum

Rules with severity set to `"warn"` don't cause ESLint to fail the build.
In my experience, leaving rules as warnings instead of errors allows them to build up over time, which trains users to ignore them.
I recommend only using `"warn"` temporarily for newly enabled rules, and generally configuring all rules as `"error"` when possible.

> [See this interesting ESLint discussion on what a warning vs. an error means](https://github.com/eslint/eslint/discussions/16512).

[`--max-warnings`](https://www.eslint.com.cn/docs/2.0.0/user-guide/command-line-interface#--max-warnings) allows you to specify a maximum number of warnings that are permitted.
If ESLint receives more warning-level rule complaints than that number, it'll switch to existing with an error code.

I recommend keeping that number as low as possible, preferably `0`:

```json
// package.json
{
	"scripts": {
		"lint": "eslint . --max-warnings 0"
	}
}
```

### Editor Linting Settings

I'd also encourage you to enable the [ESLint extension for VS Code](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) in your [`.vscode/extensions.json` workspace recommendations](https://code.visualstudio.com/docs/editor/extension-marketplace#_workspace-recommended-extensions):

```json
// .vscode/extensions.json​
{​
  "recommendations": ["dbaeumer.vscode-eslint"]​
}
```

...then set it as your default formatter and enable linting on save in your [`.vscode/settings.json` workspace settings](https://code.visualstudio.com/docs/getstarted/settings#_workspace-settings):

```json
// .vscode/settings.json​
{​
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

That way, every time you save a file or run the VS Code _ESLint: Fix All Auto-Fixable Problems_ command, ESLint will `--fix` any fixable problems for you.
Which is particularly useful if you use plugins like [`eslint-plugin-simple-import-sort`](https://www.npmjs.com/package/eslint-plugin-simple-import-sort) _(which I highly recommend!)_.

## STOP USING ESLINT FOR FORMATTING

A formatter is not a linter!
A linter is not a formatter!
The two types of tools work differently on the inside.
They're not the same!

- A formatter reformats all in one pass, which means it'll be faster than a linter but won't look for logical issues.
- A linter runs a set of discrete rules, which means it's slower than a formatter but can find & sometimes fix logical issues.

Although a linter can have rules tailored to formatting (e.g. [`indent`](https://eslint.org/docs/latest/rules/indent), [`max-len`](https://eslint.org/docs/latest/rules/max-len), [`semi`](https://eslint.org/docs/latest/rules/semi)), those rules get to be ridiculously complex and difficult to maintain because of all the edge cases they need to handle.
[In typescript-eslint land we've given up on the `indent` rule altogether](https://github.com/typescript-eslint/typescript-eslint/issues/1824).
Formatting rules are evil, a waste of time to maintain, and not the right way to format your code.
Use a dedicated formatter, please!

<p style="text-align:center">
	<img
		alt="April Ludgate in Parks and Recreation putting her fingers to her forehead and looking exasperated and overwhelmed'"
		src="./april.gif"
	/>
	<em style="display:block;text-align:center;">
		<small>
			me and all other linter maintainers irl having to deal with formatting
			rules [
			<a href="https://giphy.com/gifs/parksandrec-episode-5-parks-and-recreation-rec-76Nahzjx4Y6WXP2APE">
				image source
			</a>
			]
		</small>
	</em>
</p>

## Type Checking

Today, [TypeScript](https://typescriptlang.org) is the standard type checker for JavaScript.
People like to describe TypeScript as a _"superset of JavaScript"_ (a.k.a. _"JavaScript with types"_).
But the word _"TypeScript"_ really refers to four things provided by the TypeScript team:

- **Programming language:** A description of a language whose syntax includes everything in JavaScript _and_ some new types-specific stuff
- **Type Checker:** A program that reads in your files and reports on mismatches between the code's intent and how it will execute
- **Compiler:** A program that runs the type checker, as well as transpiling TypeScript source code into the equivalent JavaScript
- **Language Service:** A program that runs the compiler and/or type checker inside an editor/IDE such as VS Code

TypeScript is useful because there's no standard built-in way in JavaScript to describe the _intent_ behind code.
For example, this JavaScript snippet declares a variable but never explains what type of values it's allowed to contain:

```js
let myValue; // what is this?!
```

TypeScript type annotation syntax would allow describing its intent (what type of value it's allowed to store):

```ts
let myValue: number;
```

...and the TypeScript type checker can warn us if we assign something to that variable that doesn't match our stated intent:

```ts
myValue = "not a number";
// Error: Type 'string' is not assignable to type 'number'.
```

To get started locally with TypeScript, you can install it as a dependency, run its init command to create a starter config, and run it:

```shell
npm install typescript --save-dev
npx tsc --init

npx tsc
```

### TypeScript Configuration

`tsc --init` will give you a good starting config.
The following compiler options are the minimum I recommend for most projects using React or another framework that uses JSX:

- [`"jsx"`](https://www.typescriptlang.org/tsconfig#jsx): Indicates that TypeScript should allow JSX syntax
- [`"module"`](https://www.typescriptlang.org/tsconfig#module): Which module system TypeScript should assume code is running in
- [`"strict"`](https://www.typescriptlang.org/tsconfig#strict): Enables a suite of useful opt-in type checking rules that make TypeScript more strict (so it'll catch more issues)
- [`"target"`](https://www.typescriptlang.org/tsconfig#target): Indicates which global APIs & environment syntax features TypeScript should assume are available

A few more compiler options can also useful in many projects:

- [`"esModuleInterop"`](https://www.typescriptlang.org/tsconfig#esModuleInterop): Tells TypeScript to be less nitpicky about importing between CommonJS vs. ESM modules (as it's quite pedantic by default)
- [`"forceConsistentCasingInFileNames"`](https://www.typescriptlang.org/tsconfig#forceConsistentCasingInFileNames): Enables TypeScript letting you know if you typo an import by using the wrong casing
- [`"skipLibCheck"`](https://www.typescriptlang.org/tsconfig#skipLibCheck): Prevents TypeScript from spending time type checking `node_modules`

> [aka.ms/tsconfig](https://aka.ms/tsconfig) explains each of the available compiler options.
> I also explain many of them more deeply in [_Learning TypeScript_ > Chapter 13: Configuration Options](https://www.learningtypescript.com/configuration-options).

Note that compiler options are generally set for you by framework starters such as [`create-next-app`](https://nextjs.org/docs/api-reference/create-next-app).
As long as they set `strict: true`, you should be fine.

#### TypeScript Editor Configuration

I generally recommend the following settings in your [`.vscode/extensions.json` workspace recommendations](https://code.visualstudio.com/docs/editor/extension-marketplace#_workspace-recommended-extensions):

```json
// .vscode/settings.json
{
	"eslint.rules.customizations": [{ "rule": "*", "severity": "warn" }],
	"typescript.tsdk": "node_modules/typescript/lib"
}
```

`"eslint.rules.customizations"` tells VS Code to visualize all ESLint rule complaints as yellow (warning) squigglies instead of the matching squiggly color for their configured severity.
I've found this to be useful because TypeScript complaints are generally surfaced as red (error) squigglies.
It can be confusing having two tools surface complaints with the same color.
Showing TypeScript complaints in red and ESLint complaints in yellow helps folks understand which is which.

`"typescript.tsdk"` tells VS Code that it should use the project's installed TypeScript package for IDE tooling, rather rather than your computer's global VS Code / TypeScript install.
This is good because the project might have a different version of TypeScript installed than your VS Code.
You wouldn't want to have potentially different TypeScript results from running `tsc` on the terminal vs. from VS Code's language services.

> Fun fact: I authored the [PR that added `"eslint.rules.customizations"` to the VS Code ESLint extension](https://github.com/microsoft/vscode-eslint/pull/1164).
> Hooray, open source!

### TypeScript Is Not A Linter

Don't confuse _linting_ with _type checking_.
The two are not the same!

- A traditional linter runs a set of discretely configurable rules that only see one file at a time, which means it's faster and more configurable than a type checker.
- A type checker builds a full understanding of all files, which means it's slower than a traditional linter but more powerful in what it can deduce.

You can think of the difference as being that:

- Type checkers let you know when the code blatantly doesn't make sense (e.g. providing a numeric value in a place that should only receive strings)
- Linters let you know when the code makes sense, but is probably wrong (e.g. calling a function marked as `@deprecated`)

> I say _traditional_ linter because later we'll see how to enable powerful lint rules that make use of TypeScript's APIs.

## Linting TypeScript Code

ESLint by default only understands JavaScript syntax, not the new syntax included in TypeScript.
Its core rules don't lint for TypeScript-specific logic or best practices.
That's why [typescript-eslint](https://typescript-eslint.io) provides two packages for ESLint users:

- [`@typescript-eslint/eslint-plugin`](https://www.npmjs.com/package/@typescript-eslint/eslint-plugin): provides lint rules and preset configurations tailored to TypeScript code
- [`@typescript-eslint/parser`](https://www.npmjs.com/package/@typescript-eslint/parser): tells ESLint how to read TypeScript syntax

> Prettier also uses typescript-eslint internally, which is how it supports TypeScript syntax out-of-the-box.

[typescript-eslint.io](https://typescript-eslint.io) includes a _Getting Started_ guide for linting TypeScript code.
The most straightforward linter config I can suggest using utilizes those two packages to extend from both ESLint's recommended rules as well as [`plugin:@typescript-eslint/recommended`](https://typescript-eslint.io/linting/configs#recommended), the equivalent starter config for TypeScript:

```js
// eslintrc.js
module.exports = {
	extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
	parser: "@typescript-eslint/parser",
	plugins: ["@typescript-eslint"],
};
```

For example, the [`@typescript-eslint/prefer-as-const` rule](https://typescript-eslint.io/rules/prefer-as-const) can inform developers of using `as const` instead of retyping literal values in type assertions:

```diff
- let me = { name: "ReactMiami" as "ReactMiami" };
+ let me = { name: "ReactMiami" };
```

### Type Aware Rules

Traditional lint rules only see one file at a time.
typescript-eslint provides APIs that allow rules to tap into TypeScript's type checker - thereby making a classification of much more powerful lint rules.
These "type aware" lint rules are not enabled in `plugin:@typescript-eslint/recommended` because they're much slower than traditional lint rules, as they run at the speed of type checking (which needs to run on your entire project).

[typescript-eslint's _Linting with Type Information_ guide](https://typescript-eslint.io/linting/typed-linting) shows what you need to do to enable these rules.
Minimally:

```diff
module.exports = {
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
+        "plugin:@typescript-eslint/recommended-requiring-type-checking",
    ],
    plugins: ["@typescript-eslint"],
    parser: "@typescript-eslint/parser",
+    parserOptions: {
+        project: true,
+    },
};
```

- [`plugin:@typescript-eslint/recommended-requiring-type-checking`](https://typescript-eslint.io/linting/configs/#recommended-requiring-type-checking) is our recommended config that additionally enables type-aware rules
- `parserOptions.project` is required for typescript-eslint to know which TSConfig contains the compiler options to generate type information with; `true` indicates to use the closest one to each source file

For example, [`@typescript-eslint/await-thenable`](https://typescript-eslint.io/rules/await-thenable) reports on any `await` used on a statement that isn't a [Thenable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise#thenables) such as a `Promise`.

```diff
- await console.log("wat");
+ console.log("wat");
// Unexpected await of a non-Promise (non-"Thenable") value.
```

Type-aware lint rules with typescript-eslint are, to my knowledge, the most powerful lint rules you can get for JavaScript/TypeScript projects today.
I'd highly recommend using them!

## Putting it All Together

Let's recap how the tools all interact:

- **Formatters** such as [Prettier](https://prettier.io) format your code quickly, without worrying about code logic
- **Linters** such as [ESLint](https://eslint.org) run a set of discrete rules on your code logic
- **Type Checkers** such as [TypeScript](https://typescriptlang.org) build an understanding of your project and error when stated intentions are violated
- **[typescript-eslint](https://typescript-eslint.io)** allows ESLint to parse TypeScript code and exposes TypeScript type checking APIs to ESLint rules

[Linting TypeScript in 2023](https://github.com/JoshuaKGoldberg/linting-typescript-in-2023): is a demo repo showing configurations for all those tools, as well as an example of using three type-checked typescript-eslint rules to catch three bugs in a React app.

See also the separate [FAQs article](../configuring-eslint-prettier-and-typescript-together-faqs) for assorted questions on static analysis. This includes any questions you might have about plugins like eslint-config-prettier, eslint-plugin-prettier, tslint, tslint-config-prettier, and tslint-plugin-prettier.

### Supporting Open Source Projects

ESLint, Prettier, and typescript-eslint are all independent open source projects.
That means their development is supported by community donations rather than any single company or company team.
All three projects, like most open source projects, are underfunded and would absolutely appreciate your support:

- https://eslint.org/donate
- https://opencollective.com/prettier
- https://opencollective.com/typescript-eslint

Remember: sponsorships are how open source projects are able to keep development going! ❤️
