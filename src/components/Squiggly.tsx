/* TODO: remove interactions... */

import clsx from "clsx";
import { JSX, splitProps } from "solid-js";

import styles from "./Squiggly.module.css";
import type { TextProps } from "./Text";
import { Text } from "./Text";

export function Squiggly<As extends keyof JSX.HTMLElementTags>(
	props: TextProps<As>
) {
	const [outerProps, textProps] = splitProps(props, ["class"]);

	return (
		// I'm not 100% confident I'm getting this right... but the
		// tabIndex=0 on the Text along with onBlur and onFocus I
		// hope is the right move for accessibility?
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div class={clsx([styles.squiggly, outerProps.class])}>
			{/* @ts-expect-error - Dynamic components in TypeScript are tough. */}
			<Text {...textProps} class={styles.title}>
				{textProps.children}
			</Text>
		</div>
	);
}
