import { Text } from "./Text";

export interface ProjectSubEntryProps {
	description: string;
	title: string;
}

export function ProjectSubEntry(props: ProjectSubEntryProps) {
	return (
		<Text as="li" fontSize="small">
			<Text as="span" fontWeight="bold">
				{props.title}
			</Text>
			<Text as="span" fontWeight="light">
				: {props.description}
			</Text>
		</Text>
	);
}
