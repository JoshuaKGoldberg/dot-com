import type { CollectionEntry } from "astro:content";
import { clsx } from "clsx";
import { For } from "solid-js";

import { ProjectEntry } from "./ProjectEntry";
import styles from "./ProjectEntryList.module.css";
import { Text } from "./Text";

export interface ProjectEntryListProps {
	category: string;
	class?: string | undefined;
	projects: CollectionEntry<"projects">[];
}

export function ProjectEntryList(props: ProjectEntryListProps) {
	return (
		<div class={clsx(styles.projectEntryList, props.class)}>
			<Text as="h2" class={styles.h2} fontSize="small" fontWeight="light">
				{props.category}
			</Text>
			<ul class={styles.projects}>
				<For each={props.projects}>
					{(project) => (
						<ProjectEntry class={styles.projectEntry} project={project} />
					)}
				</For>
			</ul>
		</div>
	);
}
