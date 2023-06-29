import clsx from "clsx";

import styles from "./Anchor.module.css";
import { Text, type TextProps } from "./Text";

export function Anchor(props: Omit<TextProps<"a">, "as">) {
	return (
		<Text as="a" {...props} class={clsx(styles.anchor, props.class)}>
			{props.children}
		</Text>
	);
}
