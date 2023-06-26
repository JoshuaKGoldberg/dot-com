import { JSX, splitProps } from "solid-js";

import { Squiggly } from "./Squiggly";
import { Text, TextProps } from "./Text";

export type SquigglyIfActiveProps<As extends keyof JSX.HTMLElementTags> =
	TextProps<As> & {
		active: boolean;
	};

export function SquigglyIfActive<As extends keyof JSX.HTMLElementTags>(
	props: SquigglyIfActiveProps<As>
) {
	const [knownProps, restProps] = splitProps(props, ["active"]);
	// eslint-disable-next-line solid/reactivity
	const Component = knownProps.active ? Squiggly : Text;

	// @ts-expect-error -- Dynamic components in TypeScript are tough.
	return <Component {...restProps} />;
}
