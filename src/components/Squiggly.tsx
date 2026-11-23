import clsx from "clsx";
import { type JSX, splitProps } from "solid-js";

import type { TextProps } from "./Text";

import styles from "./Squiggly.module.css";
import { Text } from "./Text";

const variants = {
	active: styles.active,
	onHover: styles.onHover,
	passive: styles.passive,
};

export type SquigglyProps<As extends keyof JSX.HTMLElementTags> =
	TextProps<As> & {
		variant?: SquigglyVariant;
	};

export type SquigglyVariant = keyof typeof variants;

export function Squiggly<As extends keyof JSX.HTMLElementTags>(
	props: SquigglyProps<As>,
) {
	const [squigglyProps, textProps] = splitProps(props, ["variant"]);
	const variant = () => squigglyProps.variant ?? "active";

	return (
		<Text
			{...textProps}
			class={clsx(styles.squiggly, variants[variant()], props.class)}
			data-squiggle={variant()}
		>
			{props.children}
		</Text>
	);
}
