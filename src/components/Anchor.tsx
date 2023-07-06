import clsx from "clsx";

import styles from "./Anchor.module.css";
import { Squiggly } from "./Squiggly";
import type { TextProps } from "./Text";

export function Anchor(props: Omit<TextProps<"a">, "as">) {
	return (
		<Squiggly as="a" {...props} class={clsx(styles.anchor, props.class)}>
			{props.children}
		</Squiggly>
	);
}
