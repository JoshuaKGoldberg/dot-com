import { emojiBlast } from "emoji-blast";

import styles from "./EmojiBlastHeart.module.css";

export function EmojiBlastHeart() {
	return (
		<button
			aria-label="love"
			class={styles.heart}
			onClick={() => {
				if (document.documentElement.dataset.motion === "playing") {
					emojiBlast();
				}
			}}
			type="button"
		>
			<svg
				aria-hidden="true"
				class={styles.outline}
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2.75"
				viewBox="0 0 24 24"
			>
				<path d="M12 20.6C5.2 15.4 3 12.2 3 9a4.6 4.6 0 0 1 9-1.3A4.6 4.6 0 0 1 21 9c0 3.2-2.2 6.4-9 11.6z" />
			</svg>
		</button>
	);
}
