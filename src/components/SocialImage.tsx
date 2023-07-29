import clsx from "clsx";
import type { JSX } from "solid-js/jsx-runtime";

import styles from "./SocialImage.module.css";

export type SocialImageProps = JSX.ImgHTMLAttributes<HTMLImageElement> & {
	alt: string;
};

export function SocialImage(props: SocialImageProps) {
	return (
		<img
			{...props}
			alt={props.alt}
			class={clsx(styles.socialImage, props.class)}
		/>
	);
}
