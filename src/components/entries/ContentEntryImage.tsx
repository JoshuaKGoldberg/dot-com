import clsx from "clsx";
import { createSignal } from "solid-js";

import styles from "./ContentEntryImage.module.css";

const variants = {
	round: styles.round,
	square: styles.square,
};

export type ContentEntryImageVariant = keyof typeof variants;

export interface ContentEntryImageProps {
	alt: string;
	src: string;
	variant: ContentEntryImageVariant;
}

export function ContentEntryImage(props: ContentEntryImageProps) {
	const [loaded, setLoaded] = createSignal(false);

	const markLoaded = () => {
		setTimeout(() => {
			setLoaded(true);
		});
	};

	return (
		<img
			alt={props.alt}
			class={clsx(
				styles.contentEntryImage,
				variants[props.variant],
				loaded() && styles.contentEntryImageLoaded,
			)}
			onLoad={markLoaded}
			ref={(element) => {
				if (element.complete) {
					markLoaded();
				}
			}}
			src={props.src.startsWith("http") ? props.src : `/images/${props.src}`}
		/>
	);
}
