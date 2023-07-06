import { clsx } from "clsx";
import { For, JSX } from "solid-js";

import { Anchor } from "./Anchor";
import styles from "./ContentEntry.module.css";
import { Text } from "./Text";

const widths = {
	half: styles.widthsHalf,
	third: styles.widthsThird,
};

export type ContentEntryWidths = keyof typeof widths;

export interface ContentEntryProps {
	children?: JSX.Element;
	class?: string | undefined;
	description?: string | undefined;
	image?: string | undefined;
	links?: [string, string][] | undefined;
	subtitle?: string | undefined;
	title: string;
	url: string;
	widths: ContentEntryWidths;
}

export function ContentEntry(props: ContentEntryProps) {
	return (
		<>
			<li class={clsx(styles.contentEntry, widths[props.widths], props.class)}>
				{props.image && (
					<img alt="" class={styles.image} src={`/images/${props.image}`} />
				)}
				<div class={styles.contents}>
					<Text
						as="a"
						class={styles.title}
						fontSize="medium"
						fontWeight="bold"
						href={props.url}
						target="_blank"
					>
						{props.title}
					</Text>
					{props.subtitle && (
						<Text class={styles.subtitle} as="p" fontWeight="light">
							{props.subtitle}
						</Text>
					)}
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
						<Text class={styles.links} as="p" fontWeight="light">
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
