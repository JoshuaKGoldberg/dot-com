// https://github.com/eslint-community/eslint-plugin-eslint-comments/issues/214
declare module "@eslint-community/eslint-plugin-eslint-comments/configs" {
	import type eslint from "eslint";
	export const recommended: eslint.Linter.ConfigWithExtends;
}
