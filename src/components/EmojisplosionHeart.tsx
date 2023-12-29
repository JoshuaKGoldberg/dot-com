import { emojisplosion } from "emojisplosion";

import styles from "./EmojisplosionHeart.module.css";
import { Text } from "./Text";

export function EmojisplosionHeart() {
	return (
		<Text
			as="button"
			class={styles.heart}
			fontSize="small"
			fontWeight="light"
			onClick={() => emojisplosion()}
			type="button"
		>
			💙
		</Text>
	);
}
