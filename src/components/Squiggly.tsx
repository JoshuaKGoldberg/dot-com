import { JSX, createSignal, splitProps } from "solid-js";

import styles from "./Squiggly.module.css";
import { Text } from "./Text";
import clsx from "clsx";
import type { TextProps } from "./Text";

export type SquigglyProps<As extends keyof JSX.HTMLElementTags> = Omit<
	TextProps<As>,
	"children"
> & {
	info: string;
	title: string;
};

export function Squiggly<As extends keyof JSX.HTMLElementTags>(
	props: SquigglyProps<As>
) {
	const [knownProps, textProps] = splitProps(props, ["info", "title"]);

	const idFromInfo = knownProps.info.replace(/[\W_]/g, "-").slice(0, 15);
	const idFromTitle = knownProps.title.replace(/[\W_]/g, "-").slice(0, 15);
	const [getTriggered, setTriggered] = createSignal(false);

	return (
		<div
			aria-describedby={idFromInfo}
			class={clsx([styles.squiggly, getTriggered() && styles.triggered])}
			onBlur={() => setTriggered(false)}
			onFocus={() => setTriggered(true)}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					setTriggered(false);
				}
			}}
		>
			{/* @ts-expect-error - Dynamic components in TypeScript are tough. */}
			<Text for={idFromTitle} {...textProps} class={styles.label} as="label">
				{knownProps.title}
			</Text>
			{/* @ts-expect-error - Dynamic components in TypeScript are tough. */}
			<Text
				{...textProps}
				class={styles.title}
				id={idFromTitle}
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
