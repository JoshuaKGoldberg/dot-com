import clsx from "clsx";
import type { JSX } from "solid-js";

import styles from "./Squiggly.module.css";
import type { TextProps } from "./Text";
import { Text } from "./Text";

export function Squiggly<As extends keyof JSX.HTMLElementTags>(
	props: TextProps<As>
) {
	return (
		<Text {...props} class={clsx(styles.squiggly, props.class)}>
			{props.children}
		</Text>
	);
}
