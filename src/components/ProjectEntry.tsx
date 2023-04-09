import { clsx } from "clsx";
import { For } from "solid-js";

import { Project } from "../content/projects";
import styles from "./ProjectEntry.module.css";
import { ProjectSubEntry } from "./ProjectSubEntry";
import { Text } from "./Text";

export interface ProjectEntryProps {
	class?: string | undefined;
	project: Project | Project[];
}

export function ProjectEntry(props: ProjectEntryProps) {
	return (
		<>
			{Array.isArray(props.project) ? (
				<li class={clsx(styles.projectEntry, props.class)}>
					<ul class={styles.subList}>
						<For each={props.project}>
							{(project) => <ProjectSubEntry project={project} />}
						</For>
					</ul>
				</li>
			) : (
				<li class={clsx(styles.projectEntry, props.class)}>
					{props.project.image && (
						<img
							alt=""
							class={styles.image}
							src={`/images/${props.project.image}`}
						/>
					)}
					<div class={styles.contents}>
						<Text
							as="a"
							fontSize="medium"
							fontWeight="bold"
							href="hi.joshuakgoldberg.com"
						>
							{props.project.title}
						</Text>
						<Text
							as="div"
							class={styles.description}
							fontSize="small"
							fontWeight="light"
						>
							{props.project.description}
						</Text>
						<Text class={styles.role} as="p" fontWeight="light">
							{props.project.role ?? "Creator & Maintainer"}
						</Text>
					</div>
				</li>
			)}
		</>
	);
}
