import readingTime from "reading-time";
import type { JSX } from "solid-js/jsx-runtime";

import styles from "./DateAndMinutes.module.css";

export interface DateAndMinutesProps {
	body: string;
	children?: JSX.Element;
	date: Date;
	year?: "numeric" | undefined;
}

export function DateAndMinutes(props: DateAndMinutesProps) {
	const estimate = () =>
		Math.ceil((readingTime(props.body).minutes * 1.5) / 5) * 5;

	return (
		<>
			{props.date.toLocaleString("default", {
				day: "numeric",
				month: "short",
				year: props.year,
			})}
			<span class={styles.between} />
			{estimate()} minute read
			{props.children && (
				<>
					<span class={styles.between} />
					{props.children}
				</>
			)}
		</>
	);
}
