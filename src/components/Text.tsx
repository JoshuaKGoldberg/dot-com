import { clsx } from "clsx";
import { type JSX, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

import styles from "./Text.module.css";

const fontSizes = {
	large: styles.fontSizeLarge,
	medium: styles.fontSizeMedium,
	small: styles.fontSizeSmall,
	smaller: styles.fontSizeSmaller,
	subtitle: styles.fontSizeSubtitle,
	title: styles.fontSizeTitle,
};

export type FontSize = keyof typeof fontSizes;

const fontWeights = {
	bold: styles.fontWeightBold,
	bolder: styles.fontWeightBolder,
	light: styles.fontWeightLight,
	medium: styles.fontWeightNormal,
};

export type FontWeight = keyof typeof fontWeights;

export type TextProps<As extends keyof JSX.HTMLElementTags> = {
	as: As;
	children: JSX.Element;
	class?: string | undefined;
	fontSize?: FontSize;
	fontWeight?: FontWeight;
} & JSX.HTMLElementTags[As];

export function Text<As extends keyof JSX.HTMLElementTags>(
	props: TextProps<As>,
) {
	const [knownProps, rest] = splitProps(props, [
		"as",
		"children",
		"fontSize",
		"fontWeight",
	]);

	return (
		// @ts-expect-error - Dynamic components in TypeScript are tough.
		<Dynamic
			component={props.as}
			{...rest}
			class={clsx([
				styles.text,
				knownProps.fontSize && fontSizes[knownProps.fontSize],
				knownProps.fontWeight && fontWeights[knownProps.fontWeight],
				rest.class,
			])}
		>
			{props.children}
		</Dynamic>
	);
}
