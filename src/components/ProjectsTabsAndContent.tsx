import type { CollectionEntry } from "astro:content";
import { createMemo } from "solid-js";

import { groupBy } from "../utils";
import { ProjectEntryList } from "./ProjectEntryList";
import TabsAndContent from "./TabsAndContent";

const defaultValue = "All";

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

export interface ProjectsTabsAndContentProps {
	projects: CollectionEntry<"projects">[];
}

export function ProjectsTabsAndContent(props: ProjectsTabsAndContentProps) {
	const grouped = createMemo(() =>
		Object.entries(
			groupBy(
				props.projects.sort(byMoreOrStars),
				(project) => project.data.category
			)
		).sort(([a], [b]) => a.localeCompare(b))
	);

	return (
		<TabsAndContent
			defaultValue={defaultValue}
			sections={{
				[defaultValue]: grouped().map(([category, projects]) => (
					<ProjectEntryList
						category={category}
						class="projectEntryList"
						projects={projects}
					/>
				)),
				...Object.fromEntries(
					grouped().map(([category, projects]) => [
						category,
						<ProjectEntryList projects={projects} />,
					])
				),
			}}
		/>
	);
}
// {

//
// }
