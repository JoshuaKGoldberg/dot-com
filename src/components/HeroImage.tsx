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

const [previousImage, setPreviousImage] = createSignal<string | undefined>();

export function HeroImage(props: HeroImageProps) {
	const src = createMemo(() =>
		typeof props.src === "string"
			? { dark: props.src, light: props.src }
			: props.src,
	);

	const [loaded, setLoaded] = createSignal(false);

	const markLoaded = () => {
		setTimeout(() => {
			setLoaded(true);

			const current = src().dark;

			setTimeout(() => {
				if (current === src().dark) {
					setPreviousImage(current);
				}
			}, 500);
		});
	};

	return (
		<div
			class={clsx(
				styles.heroImage,
				styles[props.size],
				loaded() && styles.heroImageLoaded,
				previousImage() === src().dark && styles.heroImageRepeated,
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
