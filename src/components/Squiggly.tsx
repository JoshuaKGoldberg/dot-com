import { JSX, createSignal, splitProps } from "solid-js";

import styles from "./Squiggly.module.css";
import { Text } from "./Text";
import clsx from "clsx";
import type { TextProps } from "./Text";

const alignStyles = {
	left: styles.left,
	right: styles.right,
};

export type SquigglyAlign = "left" | "right";

export type SquigglyProps<As extends keyof JSX.HTMLElementTags> = Omit<
	TextProps<As>,
	"children"
> & {
	align: SquigglyAlign;
	info: string;
	title: string;
};

export function Squiggly<As extends keyof JSX.HTMLElementTags>(
	props: SquigglyProps<As>
) {
	const [knownProps, textProps] = splitProps(props, [
		"align",
		"class",
		"info",
		"title",
	]);

	const idFromInfo = knownProps.info.replace(/[\W_]/g, "-").slice(0, 15);
	const [getTriggered, setTriggered] = createSignal(false);

	return (
		<div
			aria-describedby={idFromInfo}
			class={clsx([
				styles.squiggly,
				alignStyles[knownProps.align],
				getTriggered() && styles.triggered,
				knownProps.class,
			])}
			onBlur={() => setTriggered(false)}
			onFocus={() => setTriggered(true)}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					setTriggered(false);
				}
			}}
		>
			{/* @ts-expect-error - Dynamic components in TypeScript are tough. */}
			<Text
				{...textProps}
				as="div"
				class={styles.title}
				tabIndex={0}
				onFocus={() => setTriggered(true)}
				onBlur={() => setTriggered(false)}
			>
				{knownProps.title}
			</Text>
			<div id={idFromInfo} class={styles.infoArea} role="tooltip">
				<Text as="div" class={styles.info} fontSize="smaller">
					{knownProps.info}
				</Text>
			</div>
		</div>
	);
}
