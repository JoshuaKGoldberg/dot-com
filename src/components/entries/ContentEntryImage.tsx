import clsx from "clsx";

import styles from "./ContentEntryImage.module.css";

const variants = {
	round: styles.round,
	// Square is the default, so it needs no class
	square: undefined,
};

export const largestEntryImagePixels = 80;

export interface ContentEntryImageProps {
	alt: string;
	src: string;
	variant: ContentEntryImageVariant;
}

export type ContentEntryImageVariant = keyof typeof variants;

export function ContentEntryImage(props: ContentEntryImageProps) {
	return (
		<img
			alt={props.alt}
			class={clsx(styles.contentEntryImage, variants[props.variant])}
			height={largestEntryImagePixels}
			loading="lazy"
			src={props.src}
			width={largestEntryImagePixels}
		/>
	);
}
