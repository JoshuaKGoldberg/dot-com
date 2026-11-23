import { clsx } from "clsx";
import { type JSX, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

import styles from "./Text.module.css";

const fonts = {
	display: styles.fontDisplay,
	label: styles.fontLabel,
};

export type Font = keyof typeof fonts;

const fontSizes = {
	medium: styles.fontSizeMedium,
	small: styles.fontSizeSmall,
	smaller: styles.fontSizeSmaller,
	smallest: styles.fontSizeSmallest,
	subtitle: styles.fontSizeSubtitle,
	title: styles.fontSizeTitle,
};

export type FontSize = keyof typeof fontSizes;

const fontWeights = {
	bold: styles.fontWeightBold,
	light: styles.fontWeightLight,
};

export type FontWeight = keyof typeof fontWeights;

const tones = {
	muted: styles.toneMuted,
	strong: styles.toneStrong,
};

export type TextProps<As extends keyof JSX.HTMLElementTags> =
	JSX.HTMLElementTags[As] & {
		as: As;
		children: JSX.Element;
		class?: string | undefined;
		font?: Font;
		fontSize?: FontSize;
		fontWeight?: FontWeight;
		tone?: Tone;
	};

export type Tone = keyof typeof tones;

export function Text<As extends keyof JSX.HTMLElementTags>(
	props: TextProps<As>,
) {
	const [knownProps, rest] = splitProps(props, [
		"as",
		"children",
		"font",
		"fontSize",
		"fontWeight",
		"tone",
	]);

	return (
		// @ts-expect-error - Dynamic components in TypeScript are tough.
		<Dynamic
			component={props.as}
			{...rest}
			class={clsx([
				styles.text,
				knownProps.font && fonts[knownProps.font],
				knownProps.fontSize && fontSizes[knownProps.fontSize],
				knownProps.fontWeight && fontWeights[knownProps.fontWeight],
				knownProps.tone && tones[knownProps.tone],
				rest.class,
			])}
		>
			{props.children}
		</Dynamic>
	);
}
