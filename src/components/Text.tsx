import { clsx } from "clsx";
import { JSX, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

import styles from "./Text.module.css";

const fontSizes = {
	smaller: styles.fontSizeSmaller,
	small: styles.fontSizeSmall,
	medium: styles.fontSizeMedium,
	large: styles.fontSizeLarge,
	subtitle: styles.fontSizeSubtitle,
	"title-primary": styles.fontSizeTitlePrimary,
	"title-secondary": styles.fontSizeTitleSecondary,
};

export type FontSize = keyof typeof fontSizes;

const fontWeights = {
	light: styles.fontWeightLight,
	medium: styles.fontWeightNormal,
	bold: styles.fontWeightBold,
	bolder: styles.fontWeightBolder,
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
	props: TextProps<As>
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
				knownProps.fontSize && fontSizes[knownProps.fontSize],
				knownProps.fontWeight && fontWeights[knownProps.fontWeight],
				rest.class,
			])}
		>
			{props.children}
		</Dynamic>
	);
}
