import type { CollectionEntry } from "astro:content";

import { groupBy } from "../utils";
import { ProjectEntryList } from "./ProjectEntryList";

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
	const grouped = Object.entries(
		groupBy(
			// eslint-disable-next-line solid/reactivity
			props.projects.sort(byMoreOrStars),
			(project) => project.data.category
		)
	).sort(([a], [b]) => a.localeCompare(b));

	return grouped.map(([category, projects]) => (
		<ProjectEntryList
			category={category}
			class="projectEntryList"
			projects={projects}
		/>
	));
}
