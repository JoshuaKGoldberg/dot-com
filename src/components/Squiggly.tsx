import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import type { FontSize, TextProps } from "./Text";

import styles from "./Squiggly.module.css";
import { Text } from "./Text";

const fontSizes: Record<string, string | undefined> = {
	medium: styles.medium,
	smaller: styles.smaller,
};

const variants = {
	active: styles.alwaysActive,
	inactive: styles.inactive,
	onHover: styles.onHover,
	passive: styles.passive,
};

export type SquigglyVariant = keyof typeof variants;

export type SquigglyProps<As extends keyof JSX.HTMLElementTags> =
	TextProps<As> & {
		fontSize?: FontSize;
		variant?: SquigglyVariant;
	};

export function Squiggly<As extends keyof JSX.HTMLElementTags>(
	props: SquigglyProps<As>,
) {
	const [squigglyProps, textProps] = splitProps(props, ["fontSize", "variant"]);

	return (
		// @ts-expect-error - Dynamic components in TypeScript are tough.
		<Text
			{...textProps}
			class={clsx(
				styles.squiggly,
				squigglyProps.fontSize && fontSizes[squigglyProps.fontSize],
				variants[squigglyProps.variant ?? "active"],
				props.class,
			)}
			fontSize={squigglyProps.fontSize}
		>
			{props.children}
		</Text>
	);
}
