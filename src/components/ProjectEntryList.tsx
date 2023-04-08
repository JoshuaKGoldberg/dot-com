import { clsx } from "clsx";

import { ProjectEntry } from "./ProjectEntry";
import styles from "./ProjectEntryList.module.css";
import { Text } from "./Text";

export interface ProjectEntryListProps {
	class?: string | undefined;
}

export function ProjectEntryList(props: ProjectEntryListProps) {
	return (
		<div class={clsx(styles.projectEntryList, props.class)}>
			<Text as="h2" class={styles.h2} fontSize="small" fontWeight="light">
				Biggest Projects
			</Text>
			<ul class={styles.projects}>
				<ProjectEntry class={styles.projectEntry} />
				<ProjectEntry class={styles.projectEntry} />
			</ul>
		</div>
	);
}
