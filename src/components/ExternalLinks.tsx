import { Text } from "./Text";
import styles from "./ExternalLinks.module.css";

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
			{props.links.map((link) => (
				<Text
					as="a"
					class={styles.externalLink}
					fontSize="subtitle"
					fontWeight="bolder"
					{...link}
				/>
			))}
		</div>
	);
}
