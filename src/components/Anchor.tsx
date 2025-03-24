import clsx from "clsx";

import styles from "./Anchor.module.css";
import { Squiggly, type SquigglyProps } from "./Squiggly";

export function Anchor(props: Omit<SquigglyProps<"a">, "as">) {
	return (
		<Squiggly as="a" {...props} class={clsx(styles.anchor, props.class)}>
			{props.children}
		</Squiggly>
	);
}
