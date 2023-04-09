import { Project } from "../content/projects";
import { Text } from "./Text";

export interface ProjectSubEntryProps {
	project: Project;
}

export function ProjectSubEntry(props: ProjectSubEntryProps) {
	return (
		<Text as="li" fontSize="small">
			<Text as="span" fontWeight="bold">
				{props.project.title}
			</Text>
			<Text as="span" fontWeight="light">
				: {props.project.description}
			</Text>
		</Text>
	);
}
