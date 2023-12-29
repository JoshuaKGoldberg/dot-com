import type { JSX } from "solid-js";

import clsx from "clsx";

import { Squiggly } from "../Squiggly";
import styles from "./TabsSquiggly.module.css";

export interface TabsSquigglyProps {
	active: boolean;
	children: JSX.Element;
}

export function TabsSquiggly(props: TabsSquigglyProps) {
	return (
		<Squiggly
			as="div"
			class={clsx(styles.squiggly, props.active && styles.active)}
			variant={props.active ? "passive" : "onHover"}
		>
			{props.children}
		</Squiggly>
	);
}
