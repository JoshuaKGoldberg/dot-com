import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import type { TextProps } from "./Text";

import styles from "./Squiggly.module.css";
import { Text } from "./Text";

export type SquigglyProps<As extends keyof JSX.HTMLElementTags> =
	TextProps<As> & {
		variant?: SquigglyVariant;
	};

/**
 * - active: always has a squiggle
 * - current: has one while it's current, hovered, or focused
 * - onHover: has one while it's hovered or focused
 */
export type SquigglyVariant = "active" | "current" | "onHover";

export function Squiggly<As extends keyof JSX.HTMLElementTags>(
	props: SquigglyProps<As>,
) {
	const [squigglyProps, textProps] = splitProps(props, ["variant"]);

	return (
		<Text
			{...textProps}
			class={clsx(styles.squiggly, props.class)}
			data-squiggle={squigglyProps.variant ?? "active"}
		>
			{props.children}
		</Text>
	);
}
