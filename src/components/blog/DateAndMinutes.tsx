import readingTime from "reading-time";

import styles from "./DateAndMinutes.module.css";

export interface DateAndMinutesProps {
	body: string;
	date: Date;
	year?: "numeric" | undefined;
}

export function DateAndMinutes(props: DateAndMinutesProps) {
	const estimate = () => Math.ceil(readingTime(props.body).minutes / 5) * 5;

	return (
		<>
			{props.date.toLocaleString("default", {
				month: "short",
				day: "numeric",
				year: props.year,
			})}
			<span class={styles.between} />
			{estimate()} minute read
		</>
	);
}
