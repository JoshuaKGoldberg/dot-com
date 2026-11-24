import type { JSX } from "solid-js";

export interface ChartFigureProps {
	caption?: JSX.Element;
	children: JSX.Element;
	title: string;
}

// Why the inline CSS instead of CSS modules, you ask?
// ...because Astro isn't loading them in production builds:
// https://github.com/JoshuaKGoldberg/dot-com/issues/195
export function ChartFigure(props: ChartFigureProps) {
	return (
		<figure
			style={{
				"align-items": "center",
				display: "flex",
				"flex-direction": "column",
				margin: 0,
			}}
		>
			<p
				style={{
					"font-family": "var(--fontDisplay)",
					"font-size": "1.5rem",
					"margin-top": "0.75rem",
					"text-align": "center",
				}}
			>
				{props.title}
			</p>
			{props.caption}
			<div
				aria-label={props.title}
				role="img"
				style={{
					"aspect-ratio": "1",
					"max-width": "25rem",
					"min-height": 0,
					// The canvas is larger until it's hydrated
					overflow: "clip",
					position: "relative",
					width: "100%",
				}}
			>
				{props.children}
			</div>
		</figure>
	);
}
