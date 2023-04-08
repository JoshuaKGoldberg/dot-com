import { clsx } from "clsx";
import { JSX, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

import styles from "./Text.module.css";

const fontSizes = {
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
};

export type FontWeight = keyof typeof fontWeights;

export interface TextProps {
	as: keyof JSX.IntrinsicElements;
	children: JSX.Element;
	class?: string | undefined;
	fontSize?: FontSize;
	fontWeight?: FontWeight;
}

export function Text(props: TextProps) {
	const [knownProps, rest] = splitProps(props, [
		"as",
		"children",
		"fontSize",
		"fontWeight",
	]);

	return (
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
