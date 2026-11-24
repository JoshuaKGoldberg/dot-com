import { CachedFactory } from "cached-factory";
import { type ActiveElement, Chart, LinearScale, Tooltip } from "chart.js";
import { Bar, type ChartProps } from "solid-chartjs";
import { onCleanup, onMount } from "solid-js";

import { chartAnimation } from "./chartAnimation";
import { ChartFigure } from "./ChartFigure";

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

const ticks = {
	color: ({ chart }: { chart: Chart }) => getComputedStyle(chart.canvas).color,
};

export function BarChart(props: BarChartProps) {
	let canvas!: HTMLCanvasElement;

	onMount(() => {
		const controller = new AbortController();

		Chart.register(LinearScale, Tooltip);
		onCleanup(() => {
			controller.abort();
		});

		void followTheme(canvas, controller.signal);
	});

	// TODO: Fix reactivity reports added by recent eslint-plugin-solid version
	/* eslint-disable solid/reactivity */
	const dataLengthTotal = props.data.datasets.reduce(
		(total, dataset) => total + dataset.data.length,
		0,
	);
	const fractional = props.colors.length / dataLengthTotal;
	let colorIndex = 0;
	const elementColors = new CachedFactory(() => {
		return props.colors[(colorIndex++ * fractional) | 0];
	});
	/* eslint-enable solid/reactivity */

	return (
		<ChartFigure title={props.title}>
			<Bar
				data={props.data}
				options={{
					animation: chartAnimation,
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
							ticks,
						},
						y: {
							stacked: true,
							ticks,
						},
					},
				}}
				ref={canvas}
			/>
		</ChartFigure>
	);
}

async function followTheme(canvas: HTMLCanvasElement, signal: AbortSignal) {
	// Reads from the document, so it can't be imported on the server
	const { onTheme } = await import("~/scenery/theme");

	if (!signal.aborted) {
		onTheme(() => {
			Chart.getChart(canvas)?.update("none");
		}, signal);
	}
}
