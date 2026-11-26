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

/** Text, href, and optionally links to parts of it, such as timestamps */
export type ContentEntryLink = [
	text: string,
	href: string,
	parts?: ContentEntryLinkPart[],
];

export interface ContentEntryLinkPart {
	href: string;
	label: string;
}

export interface ContentEntryProps {
	children?: JSX.Element;
	class?: string | undefined;
	description?: JSX.Element | undefined;
	descriptionSize?: "medium" | "small";
	image?: ContentEntryImageProps | undefined;
	links?: ContentEntryLink[] | undefined;
	subtitle: JSX.Element;
	title: JSX.Element;
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
								{([text, href, parts]) => {
									const anchor = (
										<Anchor
											class={
												props.description || parts
													? undefined
													: styles.anchorAlone
											}
											fontSize="smaller"
											href={href}
											variant="onHover"
										>
											{text}
										</Anchor>
									);

									return parts ? (
										<span
											class={props.description ? undefined : styles.anchorAlone}
										>
											{anchor}
											<sup class={styles.parts}>
												<For each={parts}>
													{(part, index) => (
														<Anchor
															aria-label={part.label}
															href={part.href}
															title={part.label}
															variant="onHover"
														>
															[{index() + 1}]
														</Anchor>
													)}
												</For>
											</sup>
										</span>
									) : (
										anchor
									);
								}}
							</For>
						</Text>
					)}
				</div>
			</li>
			{props.children}
		</>
	);
}
