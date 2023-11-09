import type { Project } from "joshuakgoldberg";

import { For } from "solid-js";

import { EntryList } from "../entries/EntryList";
import { TabbedEntryCategories } from "../tabs/TabbedEntryCategories";
import { ProjectEntry } from "./ProjectEntry";

export interface ProjectsTabbedProps {
	categories: Record<string, Project[]>;
}

export function ProjectsTabbed(props: ProjectsTabbedProps) {
	return (
		<TabbedEntryCategories
			renderCategory={(projects) => (
				<EntryList>
					<For each={projects.sort((a, b) => a.repo.localeCompare(b.repo))}>
						{(project) => <ProjectEntry project={project} />}
					</For>
				</EntryList>
			)}
			categories={props.categories}
			collection="project"
		/>
	);
}
