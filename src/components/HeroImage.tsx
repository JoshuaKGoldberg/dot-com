import clsx from "clsx";
import {
	createEffect,
	createMemo,
	createRoot,
	createSignal,
	onCleanup,
} from "solid-js";

import styles from "./HeroImage.module.css";

export interface ColorSchemeImages {
	dark: string;
	light: string;
}

export interface HeroImageProps {
	alt: string;
	class?: string | undefined;
	size: "large" | "small";
	src: ColorSchemeImages | string;
}

const [previousImage, setPreviousImage] = createSignal<string | undefined>(
	undefined,
);

export function HeroImage(props: HeroImageProps) {
	const src = createMemo(() =>
		typeof props.src === "string"
			? { dark: props.src, light: props.src }
			: props.src,
	);

	const [loaded, setLoaded] = createSignal(false);

	onCleanup(() => {
		console.log("setting previous image", src().dark);
		// setPreviousImage(src().dark);
	});

	const markLoaded = () => {
		console.log("Loaded!");
		setLoaded(true);
	};

	console.log(
		src().dark,
		"vs",
		previousImage(),
		src().dark === previousImage(),
	);

	console.log(
		"first clsx",
		clsx(
			styles.heroImage,
			styles[props.size],
			src().dark === previousImage() && styles.heroImageRepeated,
			loaded() && styles.heroImageLoaded,
			props.class,
		),
	);
	createEffect(() => {
		console.log(
			src().dark,
			"vs",
			previousImage(),
			src().dark === previousImage(),
		);
		console.log(
			"now clsx",
			clsx(
				styles.heroImage,
				styles[props.size],
				src().dark === previousImage() && styles.heroImageRepeated,
				loaded() && styles.heroImageLoaded,
				props.class,
			),
		);
	});

	const className = createMemo(() =>
		clsx(
			styles.heroImage,
			styles[props.size],
			src().dark === previousImage() && styles.heroImageRepeated,
			// loaded() && styles.heroImageLoaded,
			styles.heroImageLoaded,
			props.class,
		),
	);

	return (
		<div class={className()}>
			<picture transition:name="none">
				<source media="(prefers-color-scheme: dark)" srcset={src().dark} />
				<source media="(prefers-color-scheme: light)" srcset={src().light} />
				<img
					alt={props.alt}
					class={props.size}
					onLoad={markLoaded}
					ref={(element) => {
						if (element.complete) {
							markLoaded();
						}
					}}
					src={src().dark}
				/>
			</picture>
		</div>
	);
}
