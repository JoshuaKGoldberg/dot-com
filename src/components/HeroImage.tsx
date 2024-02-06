import clsx from "clsx";
import { createMemo, createSignal } from "solid-js";

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

type Load = "initial" | "loaded" | "loading";

export function HeroImage(props: HeroImageProps) {
	const src = createMemo(() =>
		typeof props.src === "string"
			? { dark: props.src, light: props.src }
			: props.src,
	);

	const [load, setLoad] = createSignal<Load>("initial");

	setTimeout(() => {
		setLoad("loading");
	});

	const markLoaded = () => {
		setTimeout(() => {
			setLoad("loaded");
		});
	};

	return (
		<div
			class={clsx(
				styles.heroImage,
				styles[props.size],
				load() === "loaded" && styles.heroImageLoaded,
				load() === "loading" && styles.heroImageLoading,
				props.class,
			)}
		>
			<picture>
				<source
					media="(prefers-color-scheme: dark)"
					onLoad={markLoaded}
					srcset={src().dark}
				/>
				<source
					media="(prefers-color-scheme: light)"
					onLoad={markLoaded}
					srcset={src().light}
				/>
				<img
					alt={props.alt}
					class={props.size}
					loading="lazy"
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
