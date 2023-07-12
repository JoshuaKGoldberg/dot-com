import type { CollectionEntry } from "astro:content";
import { For } from "solid-js";

import { ContentEntry } from "./ContentEntry";
import styles from "./ProjectEntry.module.css";
import { ProjectSubEntry } from "./ProjectSubEntry";

export interface ProjectEntryProps {
	project: CollectionEntry<"projects">;
}

export function ProjectEntry(props: ProjectEntryProps) {
	const url = () =>
		props.project.data.url ??
		`https://github.com/JoshuaKGoldberg/${props.project.slug}`;

	return (
		<ContentEntry
			description={props.project.data.description}
			image={props.project.data.image}
			subtitle={props.project.data.role ?? "Creator & Maintainer"}
			links={[
				["Repo", url()],
				...Object.entries(props.project.data.links ?? []),
			]}
			title={props.project.data.title ?? props.project.slug}
			url={url()}
			widths="half"
		>
			{props.project.data.more && (
				<li>
					<ul class={styles.subList}>
						<For each={props.project.data.more}>
							{(more) => <ProjectSubEntry {...more} />}
						</For>
					</ul>
				</li>
			)}
		</ContentEntry>
	);
}
