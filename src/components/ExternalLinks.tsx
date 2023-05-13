import { For } from "solid-js";

import styles from "./ExternalLinks.module.css";
import { Text } from "./Text";

export interface ExternalLink {
	children: string;
	href: string;
}

export interface ExternalLinksProps {
	links: ExternalLink[];
}

export function ExternalLinks(props: ExternalLinksProps) {
	return (
		<div class={styles.externalLinks}>
			<For each={props.links}>{(link) => (
				<Text
					as="a"
					class={styles.externalLink}
					fontSize="subtitle"
					fontWeight="bolder"
					{...link}
				/>
			)}</For>
		</div>
	);
}
