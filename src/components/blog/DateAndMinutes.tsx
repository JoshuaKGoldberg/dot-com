import type { JSX } from "solid-js/jsx-runtime";

import readingTime from "reading-time";

import styles from "./DateAndMinutes.module.css";

export interface DateAndMinutesProps {
	body: string;
	children?: JSX.Element;
	date: Date;
	year?: "numeric" | undefined;
}

export function DateAndMinutes(props: DateAndMinutesProps) {
	const estimate = () => Math.ceil(readingTime(props.body).minutes / 5) * 5;

	return (
		<>
			{props.date.toLocaleString("default", {
				day: "numeric",
				month: "short",
				timeZone: "GMT",
				year: props.year,
			})}
			<span class={styles.betweenDateAndTime} />
			<span class={styles.together}>{estimate()} minute read</span>
			{props.children && (
				<>
					<span class={styles.beforeChildren} />
					{props.children}
				</>
			)}
		</>
	);
}
