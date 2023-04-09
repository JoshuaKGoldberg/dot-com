import type { JSX } from "solid-js";

import styles from "./SubHeading.module.css";
import { Text } from "./Text";

export interface SubHeadingProps {
	children: JSX.Element;
	class?: string | undefined;
}

export function SubHeading(props: SubHeadingProps) {
	return (
		<Text
			as="h2"
			class={styles.subHeading}
			fontWeight="light"
			fontSize="medium"
		>
			{props.children}
		</Text>
	);
}
