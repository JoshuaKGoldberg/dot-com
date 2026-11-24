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

export interface ContentEntryProps {
	children?: JSX.Element;
	class?: string | undefined;
	description?: string | undefined;
	descriptionSize?: "medium" | "small";
	image?: ContentEntryImageProps | undefined;
	links?: [string, string][] | undefined;
	subtitle: JSX.Element;
	title: string;
	url: string;
	widths: ContentEntryWidths;
}

export type ContentEntryWidths = keyof typeof widths;

export function ContentEntry(props: ContentEntryProps) {
	return (
		<>
			<li class={clsx(styles.contentEntry, widths[props.widths], props.class)}>
				{props.image && <ContentEntryImage {...props.image} />}
				<div class={styles.contents}>
					<Anchor
						class={styles.title}
						font="display"
						fontSize="medium"
						href={props.url}
						tone="strong"
						variant="onHover"
						{...(props.url.startsWith("/") ? {} : { target: "_blank" })}
					>
						{props.title}
					</Anchor>
					<Text as="p" fontSize="small" tone="muted">
						{props.subtitle}
					</Text>
					{props.description && (
						<Text
							as="div"
							class={styles.description}
							fontSize={props.descriptionSize ?? "medium"}
							fontWeight="light"
						>
							{props.description}
						</Text>
					)}
					{props.links && (
						<Text as="p" class={styles.links} font="label">
							<For each={props.links.sort(([a], [b]) => a.localeCompare(b))}>
								{([text, href]) => (
									<Anchor
										class={props.description ? undefined : styles.anchorAlone}
										fontSize="smaller"
										href={href}
										variant="onHover"
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
