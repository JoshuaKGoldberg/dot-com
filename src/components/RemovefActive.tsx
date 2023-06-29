import { JSX, Show, splitProps } from "solid-js";

import { Text, TextProps } from "./Text";

export type RemoveIfActiveProps<As extends keyof JSX.HTMLElementTags> =
	TextProps<As> & {
		active: boolean;
	};

export function RemoveIfActive<As extends keyof JSX.HTMLElementTags>(
	props: RemoveIfActiveProps<As>
) {
	const [knownProps, restProps] = splitProps(props, ["active"]);

	return (
		<Show when={!knownProps.active}>
			{/* @ts-expect-error -- Dynamic components in TypeScript are tough. */}
			<Text {...restProps} />
		</Show>
	);
}
