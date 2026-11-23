import type { JSX } from "solid-js/jsx-runtime";

import styles from "./DateAndMinutes.module.css";

export interface DateAndMinutesProps {
	children?: JSX.Element;
	date: Date;
	minutes: number;
	year?: "numeric" | undefined;
}

export function DateAndMinutes(props: DateAndMinutesProps) {
	return (
		<>
			{props.date.toLocaleString("default", {
				day: "numeric",
				month: "short",
				timeZone: "GMT",
				year: props.year,
			})}
			<span class={styles.betweenDateAndTime} />
			<span class={styles.together}>{props.minutes} minute read</span>
			{props.children && (
				<>
					<span class={styles.beforeChildren} />
					{props.children}
				</>
			)}
		</>
	);
}
