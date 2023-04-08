import { clsx } from "clsx";

import styles from "./ProjectEntry.module.css";
import { Text } from "./Text";

export interface ProjectEntryProps {
	class?: string | undefined;
}

export function ProjectEntry(props: ProjectEntryProps) {
	return (
		<li class={clsx(styles.projectEntry, props.class)}>
			<img alt="" class={styles.logo} src="/logos/typescript-eslint.svg" />
			<div class={styles.contents}>
				<Text as="div" fontSize="medium" fontWeight="bold">
					typescript-eslint
				</Text>
				<Text
					as="div"
					class={styles.description}
					fontSize="small"
					fontWeight="light"
				>
					The tooling that enables ESLint and Prettier to support TypeScript.
				</Text>
				<Text class={styles.role} as="p" fontWeight="light">
					Maintainer
				</Text>
			</div>
		</li>
	);
}
