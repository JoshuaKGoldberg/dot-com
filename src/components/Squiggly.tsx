import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import styles from "./Squiggly.module.css";
import type { FontSize, TextProps } from "./Text";
import { Text } from "./Text";

const fontSizes: Record<string, string | undefined> = {
	medium: styles.medium,
	smaller: styles.smaller,
};

export type SquigglyFontSize = keyof typeof fontSizes;

const variants = {
	alwaysActive: styles.alwaysActive,
	inactive: styles.inactive,
	onHover: styles.onHover,
};

export type SquigglyVariant = keyof typeof variants;

export type SquigglyProps<As extends keyof JSX.HTMLElementTags> =
	TextProps<As> & {
		fontSize?: FontSize;
		variant?: SquigglyVariant;
	};

export function Squiggly<As extends keyof JSX.HTMLElementTags>(
	props: SquigglyProps<As>
) {
	const [squigglyProps, textProps] = splitProps(props, ["fontSize", "variant"]);

	return (
		// @ts-expect-error - Dynamic components in TypeScript are tough.
		<Text
			{...textProps}
			class={clsx(
				styles.squiggly,
				squigglyProps.fontSize && fontSizes[squigglyProps.fontSize],
				variants[squigglyProps.variant ?? "alwaysActive"],
				props.class
			)}
			fontSize={squigglyProps.fontSize}
		>
			{props.children}
		</Text>
	);
}
