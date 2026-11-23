import { emojiBlast } from "emoji-blast";

import styles from "./EmojiBlastHeart.module.css";
import { Text } from "./Text";

export function EmojiBlastHeart() {
	return (
		<Text
			as="button"
			class={styles.heart}
			fontSize="smaller"
			onClick={() => {
				emojiBlast();
			}}
			type="button"
		>
			💙
		</Text>
	);
}
