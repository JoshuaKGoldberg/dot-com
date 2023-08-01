import type { ImageMetadata } from "astro";
import { Image } from "astro:assets";
import clsx from "clsx";

import styles from "./ContentEntryImage.module.css";

const variants = {
	round: styles.round,
	square: styles.square,
};

export type ContentEntryImageVariant = keyof typeof variants;

export interface ContentEntryImageProps {
	alt: string;
	format?: string;
	src: string;
	variant: ContentEntryImageVariant;
}

export function ContentEntryImage(props: ContentEntryImageProps) {
	return (
		<img
			alt={props.alt}
			class={clsx(
				styles.contentEntryImage,
				variants[props.variant],
				props.format === "png" && styles.notAntiAliased
			)}
			src={props.src}
		/>
	);
}
