import {
	type ActiveDataPoint,
	ArcElement,
	Chart,
	Colors,
	Tooltip,
} from "chart.js";
import { type ChartProps, Pie } from "solid-chartjs";
import { For, onMount } from "solid-js";

import styles from "./PieChart.module.css";
import { Text } from "./Text";

export interface PieChartProps {
	colors: string[];
	data: NonNullable<ChartProps["data"]> & {
		datasets: [
			{
				data: number[];
				label: string;
			},
		];
		labels: string[];
	};
	id: string;
	title: string;
}

export function PieChart(props: PieChartProps) {
	onMount(() => {
		Chart.register(ArcElement, Colors, Tooltip);
	});

	return (
		<figure class={styles.figure}>
			<h4 class={styles.title}>{props.title}</h4>
			<figcaption class={styles.captions}>
				<For each={props.data.datasets[0].data.map((data, i) => [data, i])}>
					{([value, i]) => (
						<Text as="div" class={styles.caption} fontSize="smaller">
							<span
								class={styles.colorBlock}
								style={{ "background-color": props.colors[i] }}
							/>
							<span>
								{props.data.labels[i]}: ${value}
							</span>
						</Text>
					)}
				</For>
			</figcaption>
			<Pie
				data={props.data}
				options={{
					elements: {
						arc: {
							backgroundColor: ({ index }: ActiveDataPoint) =>
								props.colors[index],
						},
					},
					layout: {
						padding: {
							bottom: 20,
						},
					},
					maintainAspectRatio: true,
					responsive: true,
				}}
			/>
		</figure>
	);
}
