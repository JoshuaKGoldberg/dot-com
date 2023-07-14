import { emojisplosion } from "emojisplosion";

import styles from "./EmojisplosionHeart.module.css";
import { Text } from "./Text";

export function EmojisplosionHeart() {
	return (
		<Text
			as="button"
			fontSize="small"
			fontWeight="light"
			class={styles.heart}
			onClick={() => emojisplosion()}
			type="button"
		>
			💙
		</Text>
	);
}
