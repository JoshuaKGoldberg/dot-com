import clsx from "clsx";

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
	return (
		<img
			alt={props.alt}
			class={clsx(styles.contentEntryImage, variants[props.variant])}
			loading="lazy"
			src={props.src}
		/>
	);
}
