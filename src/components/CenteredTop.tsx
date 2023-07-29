import type { ParentProps } from "solid-js";

import styles from "./CenteredTop.module.css";
import { Text } from "./Text";

export interface CenteredTopProps extends ParentProps {
	class?: string | undefined;
	primary: string;
	secondary: string;
}

export function CenteredTop(props: CenteredTopProps) {
	return (
		<div class={styles.centeredTop}>
			<Text as="h1" class={styles.title} fontSize="title">
				{props.primary}
			</Text>
			<Text as="p" fontSize="small">
				{props.secondary}
			</Text>
		</div>
	);
}
