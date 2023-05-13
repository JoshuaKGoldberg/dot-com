import { JSX, splitProps } from "solid-js";

import { Squiggly, SquigglyProps } from "./Squiggly";
import { Text } from "./Text";

export type SquigglyIfActiveProps<As extends keyof JSX.HTMLElementTags> =
	SquigglyProps<As> & {
		active: boolean;
	};

export function SquigglyIfActive<As extends keyof JSX.HTMLElementTags>(
	props: SquigglyIfActiveProps<As>
) {
	const [knownProps, restProps] = splitProps(props, ["active", "title"]);

	return <>{knownProps.active ? (
		// @ts-expect-error - Dynamic components in TypeScript are tough.
		<Squiggly {...restProps} title={knownProps.title} />
	) : (
		// @ts-expect-error - Dynamic components in TypeScript are tough.
		<Text {...restProps}>{knownProps.title}</Text>
	)}</>;
}
