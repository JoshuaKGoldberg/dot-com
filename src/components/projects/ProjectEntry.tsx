import type { Project, ProjectBase } from "joshuakgoldberg";

import { For } from "solid-js";

import { ContentEntry } from "../entries/ContentEntry";
import styles from "./ProjectEntry.module.css";
import { ProjectSubEntry } from "./ProjectSubEntry";

export interface ProjectEntryProps {
	project: Project;
}

function projectUrl(project: ProjectBase) {
	return project.url ?? `https://github.com/JoshuaKGoldberg/${project.repo}`;
}

function projectTitle(project: ProjectBase) {
	return project.name ?? project.repo;
}

export function ProjectEntry(props: ProjectEntryProps) {
	return (
		<ContentEntry
			image={
				props.project.image
					? {
							alt: `${projectTitle(props.project)} logo`,
							src: props.project.image,
							variant: "square",
					  }
					: undefined
			}
			links={[
				["Repo", projectUrl(props.project)],
				...Object.entries(props.project.links ?? []),
			]}
			description={props.project.description}
			subtitle={props.project.role ?? "Creator & Maintainer"}
			title={projectTitle(props.project)}
			url={projectUrl(props.project)}
			widths="half"
		>
			{props.project.more && (
				<li>
					<ul class={styles.subList}>
						<For each={props.project.more}>
							{(more) => (
								<ProjectSubEntry
									description={more.description}
									href={projectUrl(more)}
									title={projectTitle(more)}
								/>
							)}
						</For>
					</ul>
				</li>
			)}
		</ContentEntry>
	);
}
