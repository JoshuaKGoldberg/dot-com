import clsx from "clsx";

import type { TextProps } from "./Text";

import styles from "./Anchor.module.css";
import { Squiggly } from "./Squiggly";

export function Anchor(props: Omit<TextProps<"a">, "as">) {
	return (
		<Squiggly as="a" {...props} class={clsx(styles.anchor, props.class)}>
			{props.children}
		</Squiggly>
	);
}
