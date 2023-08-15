import type { Project, projectCategories } from "joshuakgoldberg";

import { GroupedEntries } from "../GroupedEntries";
import { ProjectEntry } from "./ProjectEntry";

function byMoreOrStars(a: Project, b: Project) {
	if (a.more && !b.more) {
		return 1;
	}

	if (b.more && !a.more) {
		return -1;
	}

	return b.stars - a.stars;
}

export interface ProjectsGroupedProps {
	projectCategories: typeof projectCategories;
}

export function ProjectsGrouped(props: ProjectsGroupedProps) {
	return (
		<GroupedEntries
			groups={Object.entries(props.projectCategories).map(
				([category, { projects }]) => [category, projects.sort(byMoreOrStars)]
			)}
			renderEntry={(project) => <ProjectEntry project={project} />}
		/>
	);
}
