import clsx from "clsx";

import styles from "./Anchor.module.css";
import type { TextProps } from "./Text";

export function Anchor(props: Omit<TextProps<"a">, "as">) {
	return (
		<a {...props} class={clsx(styles.anchor, props.class)}>
			{props.children}
		</a>
	);
}
