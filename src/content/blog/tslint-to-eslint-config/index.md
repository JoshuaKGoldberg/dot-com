---
description: "Now that TSLint is being deprecated, let's look at how tslint-to-eslint-config converts your TSLint configuration to ESLint."
image:
  alt: TODO
  src: TODO
pubDate: 2019-11-19
title: "TSLint to ESLint Part 2: tslint-to-eslint-config"
---

> Howdy!
> This blog post is a technical discussion on migrating how [tslint-to-eslint-config](https://github.com/typescript-eslint/tslint-to-eslint-config) migrates configurations from from TSLint to ESLint with [@typescript-eslint](https://typescript-eslint.io).
> If you're curious about TSLint's history, go back to [TSLint to ESLint Part 1: Historical Context](../tslint-to-eslint-history).

## `tslint-to-eslint-config`

Changing from any tool to another needs a good migration strategy.
I wrote a nifty little utility appropriately named [**tslint-to-eslint-config**](https://github.com/typescript-eslint/tslint-to-eslint-config) that reads in your configuration and spits out an ESLint configuration file.

If you're still using TSLint, you should try this thing out to get yourself onto ESLint!
TSLint is in maintenance mode and, for the most part, is already deprecated.
You want new features in your linter, right??

The rest of this post is a discussion on how that works.
I hope you'll read through, get a great understanding of the tool's operations, and contribute to it on GitHub!
😊

### Similarities

The similarities between ESLint and TSLint are convenient for direct comparisons.
This basic TSLint `tslint.json` configuration file...

```json
// tslint.json
{
	"rules": {
		"align": true,
		"array-type": true,
		"arrow-parens": true // ...
	}
}
```

...is now represented by a structurally similar ESLint `.eslintrc.json` configuration file:

```json
//eslintrc.json
{
	"rules": {
		"@typescript-eslint/array-type": "error",
		"@typescript-eslint/indent": "error",
		"arrow-parens": ["error", "as-needed"] // ...
	}
}
```

Simple!
Internally, tslint-to-eslint-config keeps a mapping of rule `converters`, keyed by TSLint rule name.
These converters take in the rule arguments for the TSLint rule and output the equivalent ESLint rule configuration(s):

```ts
/**
 * Keys TSLint rule names to their ESLint rule converters.
 */
const converters = new Map([
	["align", convertAlign],
	["array-type", convertArrayType],
	["arrow-parens", convertArrowParens], // ...
]);
```

The `no-construct` rule, for example, doesn't care what configuration the TSLint rule takes in.
It always indicates to use the equivalent `no-new-wrappers` ESLint rule:

```ts
const convertNoConstruct = () => {
	return {
		rules: [
			{
				ruleName: "no-new-wrappers",
			},
		],
	};
};
```

If you started with this TSLint `rules` configuration...

```json
// tslint.json
{
	"no-construct": true
}
```

...then tslint-to-eslint-config would see the `"no-construct"` rule, map to the `convertNoConstruct` function, and output this `rules` object:

```json
// .eslintrc.json
{
	"no-new-wrappers": "error"
}
```

### Rule Options

Many lint rules take in some configuration settings, a.k.a. rule options, a.k.a. rule arguments, that modify the behavior of the rules in some known way.
TSLint's [`prefer-readonly`](https://palantir.github.io/tslint/rules/prefer-readonly) rule is a rule that uses a single option:

- When configured as `prefer-readonly: true`, it ensures _all_ `private` class members whose values are never modified after initialization are declared with the `private` modifier
- When configured as `prefer-readonly: [true, "only-inline-lambdas"]`, it will only check members initialized as `() => {}` lambdas in-place

The ESLint equivalent of `prefer-readonly` is `@typescript-eslint/prefer-readonly`.
It _also_ takes in an optional rule argument - but as an object like `{ onlyInlineLambdas: true }`.
The `prefer-readonly` converter in tslint-to-eslint, therefore, needs to read in the original TSLint rule arguments and adjust its output accordingly:

```ts
const convertPreferReadonly = (tslintRule) => {
	return {
		rules: [
			{
				...(tslintRule.ruleArguments.includes("only-inline-lambdas") && {
					ruleArguments: [{ onlyInlineLambdas: true }],
				}),
				ruleName: "@typescript-eslint/prefer-readonly",
			},
		],
	};
};
```

Running `npx tslnit-to-eslint-config` with a `tslint.json` file containing just the one rule will create the equivalent `.eslintrc.json`.

```text
$ npx tslint-to-eslint-config
✨ 1 rule replaced with its ESLint equivalent. ✨
✅ All is well! ✅
```

## Notices

Not all TSLint rules directly map to an ESLint equivalent.
Plenty of ESLint rules that behave differently than their TSLint equivalents.

The TSLint rule [`one-variable-per-declaration`](https://palantir.github.io/tslint/rules/one-variable-per-declaration) maps directly to the ESLint `one-var` in its normal configuration...

```json
// tslint.json
"rules": {
    "one-variable-per-declaration": true
}
```

```json
// .eslintrc.json
"rules": {
    "one-var": ["error", "never"]
}
```

...but its `"ignore-for-loop"` option to skip checking multiple initializer variables in `for` loops has yet to be implemented in ESLint.
Thus, we really can't _completely_ switch from TSLint to ESLint and keep our original linting behavior.

Rule converters in tslint-to-eslint-config are allowed to output a `notices: string[]` detailing any unavoidable behavior changes in the new rules:

```ts
const convertOneVariablePerDeclaration = (tslintRule) => {
	return {
		rules: [
			{
				...(!tslintRule.ruleArguments.includes("ignore-for-loop") && {
					notices: [
						"Variables declared in for loops will no longer be checked.",
					],
				}),
				ruleArguments: ["never"],
				ruleName: "one-var",
			},
		],
	};
};
```

Conversion runs will print any notices to the console:

```text
$ npx tslint-to-eslint-config
✨ 1 rule replaced with its ESLint equivalent. ✨
📢 1 ESLint rule behaves differently from their TSLint counterparts: 📢
* one-var:
  - Variables declared in for loops will no longer be checked.
✅ All is well! ✅
```

## Mergers

We've covered that some ESLint rules have different configuration styles than their TSLint equivalents.
It's reasonable that multiple TSLint rules may occasionally output uses of the same ESLint rule.
Each of these cases is dealt with a "merge" on the tslint-to-eslint-config side, which takes in two rule arguments for the same ESLint rule and creates a single equivalent.

```ts
const mergers = new Map([
	["@typescript-eslint/ban-types", mergeBanTypes],
	["@typescript-eslint/indent", mergeIndent],
	[
		"@typescript-eslint/no-unnecessary-type-assertion",
		mergeNoUnnecessaryTypeAssertion,
	],
	// ...
]);
```

For example: ESLint's `@typescript-eslint/ban-types` is a fantastic, flexible rule that can ban a configurable list of generally unfavorable types.
It's normally used for odd built-ins such as `Boolean` and `Number`, but can also be configured to check for other type names.

On the off chance that multiple TSLint rule converters will eventually end up outputting `@typescript-eslint/ban-types` usage, the merger combines banned types from both original configurations into a single rule arguments structure:

```ts
const mergeBanTypes = (existingOptions, newOptions) => {
	if (existingOptions === undefined && newOptions === undefined) {
		return [];
	}

	return [
		{
			types: {
				...(existingOptions && existingOptions[0].types),
				...(newOptions && newOptions[0].types),
			},
		},
	];
};
```

## Yo Dawg

We've covered converting TSLint rules to their equivalent ESLint rules, converting TSLint rules to the _closest possible_ ESLint rules, and multiple TSLint rules outputting the same ESLint rule.
Here's another case: _what if there is no ESLint equivalent yet?_

Suppose you've written a beautiful custom TSLint rule and haven't yet converted it to ESLint, but you want to Do The Right Thing and switch your linter over.
You _could_ run both ESLint and TSLint as separate commands, and only use TSLint for your custom rule... _or_ you could use [`typescript-eslint/eslint-plugin-tslint`](https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin-tslint) to run TSLint _as an ESLint rule_.

This package gives you an ESLint rule named `@typescript-eslint/tslint/config` that itself takes in a TSLint configuration and runs TSLint within your ESLint run.

```json
// eslintrc.json
{
	"rules": {
		"@typescript-eslint/tslint/config": [
			"error",
			{
				"rules": {
					"fancy-schmancy-custom-rule": [true, "x", "y", "z"]
				}
			}
		],
		"great-converted-rule": "error"
	}
}
```

![Photo of Xzibit commonly used for the 'yo dawg' meme](./yodawg.jpg)

<em style="display:block;margin-bottom:2rem;text-align:center;">
We heard you like linters, so we put a linter in your linter...
</em>

## Plugins

Some TSLint rule equivalents are only available in community-added plugins.
Rules are allowed to add a `plugins: string[]` to their output to indicate you should also include and install them with your ESLint configuration.

TSLint's `deprecation` rule is so far most closely represented by the `import/no-deprecated` rule in [`eslint-plugin-import`](https://github.com/benmosher/eslint-plugin-import).
Its converter indicates to use the `eslint-plugin-import` package:

```ts
const convertDeprecation = () => {
	return {
		notices: ["Only import statements will be checked for deprecation."],
		plugins: ["eslint-plugin-import"],
		rules: [
			{
				ruleName: "import/no-deprecated",
			},
		],
	};
};
```

As a result, tslint-to-eslint-config knows to tell the user to install the imported package...

```text
$ npx tslint-to-eslint-config
✨ 1 rule replaced with its ESLint equivalent. ✨
⚡ 1 package is required for new ESLint rules. ⚡
        eslint-plugin-import
✅ All is well! ✅
```

...and add `import` to the list of `plugins` in your ESLint configuration.

```json
module.exports = {
    // ...
    "plugins": [
        "@typescript-eslint",
        "import"
    ],
    "rules": {
        "import/no-deprecated": "error"
    }
};
```

## Existing Files and Extended Rulesets

tslint-to-eslint-config is intended to be _idempotent_: meaning you should be able to run it as many times as you want in a folder, with the same or better results each time.
More and more previously-unsupported TSLint rule features will be enabled in ESLint as typescript-eslint is developed.
Re-running tslint-to-eslint-config every few version releases is likely to get you better and better results.

Adding to the complication: both ESLint and TSLint can extend from community rulesets such as [tslint-microsoft-contrib](https://npmjs.com/package/tslint-microsoft-contrib) and [eslint-plugin-react](https://npmjs.com/package/eslint-plugin-react).

This all means tslint-to-eslint-config needs to respect whatever ESLint configuration file exists on disk. There can now be at least _four_ sources of information for what goes into your ESLint configuration:

- ESLint rules enabled directly in an existing ESLint configuration
- ESLint rules enabled via an extended ruleset
- TSLint rules enabled directly in an existing TSLint configuration
- TSLint rules enabled via an extended ruleset

_(even worse, a few ESLint environment or parser settings are also read from your `package.json` and/or `tsconfig.json` if available... yikes!)_

What a nightmare.

### Extended Rulesets

Rules that _would_ be printed in the output ESLint configuration are skipped if they directly match an existing ESLint plugin.
As an example: if your ESLint configuration extends from, say, [eslint-config-airbnb](https://npmjs.com/package/eslint-config-airbnb), and some of your stylistic TSLint rules happen to output ESLint rules that are already configured the same way in `eslint-config-airbnb`, your ESLint config won't bother including them.

Eventually, I'd love to have tslint-to-eslint-config know to use contributed ESLint rulesets based on your TSLint extensions.
That issue's [waiting on GitHub now](https://github.com/typescript-eslint/tslint-to-eslint-config/issues/11).
_Accepting PRs!_
😉

### Configuration Trimming

ESLint and TSLint both support a `--print-config` flag to print the flattened configuration including extended rulesets.
tslint-to-eslint-config uses that flag to split ESLint and TSLint configuration settings into two categories:

- **Full** configurations: ones enabled in any way by the user _or_ via an extended ruleset
- **Raw** configurations: ones directly enabled in the user's file(s) on disk

_Full_ configurations are used to generate most output ESLint file contents, including rules.
_Raw_ configurations are used to populate the output ESLint `extends` _(list of extended ESLint rulesets)_ and `globals` _(list of globally available variables to never consider undeclared)_.

- `extends` itself should respect the raw list from your configuration.
- We have to respect the _raw_ configuration for `globals` because ESLint resolves it to a _massive_ list of global variables that you wouldn't want to explicitly write out in your configuration.

These definitions break down somewhat for users who have multiple of their own ESLint and/or TSLint configuration files extending from each other...
If you want to help build a better system, please do contribute on GitHub!
💖

## Miscellaneous Pending Features

Open source is a beautiful thing.
You can start a project with one singular focus and be told of feature suggestions you never would have thought of on your own.

It'd be swell if tslint-to-eslint-config could [migrate your editor settings (e.g. `.vscode/settings.json`)](https://github.com/typescript-eslint/tslint-to-eslint-config/issues/133).
Editor configurations are a supremely important part of how users interact with their linters.
Some rules, such as around import ordering or stylistic preferences, would be practically unusable without editor auto-fixing.

Even better, how about [migrating inline `tslint:disable` comments to `eslint-disable`s](https://github.com/typescript-eslint/tslint-to-eslint-config/issues/136)?
Manually changing those comments over is a pain in the butt.

Thanks for reading this far -- happy linting!
