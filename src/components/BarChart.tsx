import { CachedFactory } from "cached-factory";
import { type ActiveElement, Chart, LinearScale, Tooltip } from "chart.js";
import { type ChartProps, Bar } from "solid-chartjs";
import { onMount } from "solid-js";

export interface BarChartProps {
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

export function BarChart(props: BarChartProps) {
	onMount(() => {
		Chart.register(LinearScale, Tooltip);
	});

	const dataLengthTotal = props.data.datasets.reduce(
		(total, dataset) => total + dataset.data.length,
		0,
	);
	const fractional = props.colors.length / dataLengthTotal;
	let colorIndex = 0;
	const elementColors = new CachedFactory(() => {
		return props.colors[(colorIndex++ * fractional) | 0];
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
			<div
				style={{
					"max-height": "25rem",
				}}
			>
				<Bar
					data={props.data}
					options={{
						elements: {
							bar: {
								backgroundColor: ({ element }: ActiveElement) =>
									elementColors.get(element),
							},
						},
						layout: {
							padding: {
								bottom: 20,
							},
						},
						maintainAspectRatio: true,
						responsive: true,
						scales: {
							x: {
								stacked: true,
							},
							y: {
								stacked: true,
							},
						},
					}}
				/>
			</div>
		</figure>
	);
}
