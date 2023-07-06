import type { CollectionEntry } from "astro:content";
import { For } from "solid-js";

import { groupBy } from "../utils";
import { EntryList } from "./EntryList";
import { ProjectEntry } from "./ProjectEntry";

function byMoreOrStars(
	a: CollectionEntry<"projects">,
	b: CollectionEntry<"projects">
) {
	if (a.data.more && !b.data.more) {
		return 1;
	}

	if (b.data.more && !a.data.more) {
		return -1;
	}

	return b.data.stars - a.data.stars;
}

export interface ProjectsGroupedProps {
	projects: CollectionEntry<"projects">[];
}

export function ProjectsGrouped(props: ProjectsGroupedProps) {
	return (
		<For
			each={Object.entries(
				groupBy(
					props.projects.sort(byMoreOrStars),
					(project) => project.data.category
				)
			).sort(([a], [b]) => a.localeCompare(b))}
		>
			{([category, projects]) => (
				<EntryList category={category}>
					<For each={projects}>
						{(project) => <ProjectEntry project={project} />}
					</For>
				</EntryList>
			)}
		</For>
	);
}
