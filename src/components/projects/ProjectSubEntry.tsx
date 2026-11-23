import { Text } from "../Text";

export interface ProjectSubEntryProps {
	description: string;
	href: string;
	title: string;
}

export function ProjectSubEntry(props: ProjectSubEntryProps) {
	return (
		<Text as="li" fontSize="small">
			<Text as="a" data-squiggle="onHover" font="label" href={props.href}>
				{props.title}
			</Text>
			<Text as="span" fontWeight="light">
				: {props.description}
			</Text>
		</Text>
	);
}
