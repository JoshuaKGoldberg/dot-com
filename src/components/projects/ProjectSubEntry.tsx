import { Anchor } from "../Anchor";
import { Text } from "../Text";

export interface ProjectSubEntryProps {
	description: string;
	href: string;
	title: string;
}

export function ProjectSubEntry(props: ProjectSubEntryProps) {
	return (
		<Text as="li" fontSize="small">
			<Anchor font="display" href={props.href} variant="onHover">
				{props.title}
			</Anchor>
			<Text as="span" fontWeight="light">
				: {props.description}
			</Text>
		</Text>
	);
}
