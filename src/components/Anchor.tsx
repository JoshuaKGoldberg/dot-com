import { Squiggly, type SquigglyProps } from "./Squiggly";

export function Anchor(props: Omit<SquigglyProps<"a">, "as">) {
	return (
		<Squiggly as="a" {...props}>
			{props.children}
		</Squiggly>
	);
}
