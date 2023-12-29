import { clsx } from "clsx";
import { For, type JSX } from "solid-js";

import { Anchor } from "../Anchor";
import { Text } from "../Text";
import styles from "./ContentEntry.module.css";
import {
	ContentEntryImage,
	type ContentEntryImageProps,
} from "./ContentEntryImage";

const widths = {
	full: styles.widthsFull,
	half: styles.widthsHalf,
	third: styles.widthsThird,
};

export type ContentEntryWidths = keyof typeof widths;

export interface ContentEntryProps {
	children?: JSX.Element;
	class?: string | undefined;
	description?: string | undefined;
	image?: ContentEntryImageProps | undefined;
	links?: [string, string][] | undefined;
	subtitle: JSX.Element;
	title: string;
	url: string;
	widths: ContentEntryWidths;
}

export function ContentEntry(props: ContentEntryProps) {
	return (
		<>
			<li class={clsx(styles.contentEntry, widths[props.widths], props.class)}>
				{props.image && <ContentEntryImage {...props.image} />}
				<div class={styles.contents}>
					<Text
						as="a"
						class={styles.title}
						fontSize="medium"
						fontWeight="bold"
						href={props.url}
						{...(props.url.startsWith("/") ? {} : { target: "_blank" })}
					>
						{props.title}
					</Text>
					<Text as="p" class={styles.subtitle} fontWeight="light">
						{props.subtitle}
					</Text>
					{props.description && (
						<Text
							as="div"
							class={styles.description}
							fontSize="small"
							fontWeight="light"
						>
							{props.description}
						</Text>
					)}
					{props.links && (
						<Text as="p" class={styles.links} fontWeight="light">
							<For each={props.links.sort(([a], [b]) => a.localeCompare(b))}>
								{([text, href]) => (
									<Anchor
										{...(props.description
											? { fontSize: "smaller" }
											: { class: styles.anchorLarger, fontSize: "small" })}
										href={href}
									>
										{text}
									</Anchor>
								)}
							</For>
						</Text>
					)}
				</div>
			</li>
			{props.children}
		</>
	);
}
