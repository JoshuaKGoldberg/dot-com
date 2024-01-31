import {
	type ActiveDataPoint,
	ArcElement,
	Chart,
	Colors,
	Legend,
	Title,
	Tooltip,
} from "chart.js";
import { type ChartProps, Pie } from "solid-chartjs";
import { onMount } from "solid-js";

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

const fontBase = {
	family: "League SpartanVariable",
};

export function PieChart(props: PieChartProps) {
	/**
	 * You must register optional elements before using the chart,
	 * otherwise you will have the most primitive UI
	 */
	onMount(() => {
		Chart.register(ArcElement, Colors, Legend, Title, Tooltip);
	});

	return (
		<div
			aria-label={[
				"Pie chart: ",
				props.title,
				". ",
				props.data.datasets[0].label,
				": ",
				props.data.datasets[0].data
					.map((value, i) => `${props.data.labels[i]}, ${value}`)
					.join("; "),
				".",
			].join("")}
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
					maintainAspectRatio: false,
					plugins: {
						legend: {
							labels: {
								font: {
									...fontBase,
									size: 16,
								},
							},
						},
						title: {
							display: true,
							font: {
								...fontBase,
								size: 20,
							},
							fullSize: true,
							padding: 20,
							text: props.title,
						},
					},
					responsive: true,
				}}
			/>
		</div>
	);
}
