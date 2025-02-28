import {
	type ActiveDataPoint,
	ArcElement,
	Chart,
	Colors,
	Tooltip,
} from "chart.js";
import { type ChartProps, Pie } from "solid-chartjs";
import { For, onMount } from "solid-js";

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

	// Why the inline CSS instead of CSS modules, you ask?
	// ...because Astro isn't loading them in production builds:
	// https://github.com/JoshuaKGoldberg/dot-com/issues/195
	return (
		<figure
			style={{
				"align-items": "center",
				display: "flex",
				"flex-direction": "column",
				margin: 0,
			}}
		>
			<h4 style={{ "text-align": "center" }}>{props.title}</h4>
			<figcaption
				style={{
					display: "flex",
					"flex-wrap": "wrap",
					gap: "0.5rem 1rem",
					"justify-content": "center",
					margin: "0.75rem 0",
				}}
			>
				<For each={props.data.datasets[0].data.map((data, i) => [data, i])}>
					{([value, i]) => (
						<Text
							as="div"
							fontSize="smaller"
							style={{
								"align-items": "baseline",
								display: "inline-flex",
								gap: "0.35rem",
							}}
						>
							<span
								style={{
									"background-color": props.colors[i],
									display: "inline-block",
									height: "0.7rem",
									width: "1.5rem",
								}}
							/>
							<span>
								{props.data.labels[i]}: ${value.toLocaleString()}
							</span>
						</Text>
					)}
				</For>
			</figcaption>
			<div
				style={{
					"max-height": "25rem",
				}}
			>
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
			</div>
		</figure>
	);
}
