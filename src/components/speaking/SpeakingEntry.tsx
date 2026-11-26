import type { CollectionEntry } from "astro:content";

import { ContentEntry } from "../entries/ContentEntry";

export type SpeakingData = CollectionEntry<"speaking">["data"];

export interface SpeakingEntryProps {
	speaking: SpeakingData;
}

export function SpeakingEntry(props: SpeakingEntryProps) {
	return (
		<ContentEntry
			description={props.speaking.title}
			descriptionSize="small"
			links={
				props.speaking.links &&
				Object.entries(props.speaking.links).map(([text, link]) =>
					typeof link === "string"
						? [text, link]
						: [
								text,
								link.href,
								link.timestamps.map((timestamp) => ({
									href: linkToTimestamp(link.href, timestamp),
									label: `${text} at ${timestamp}`,
								})),
							],
				)
			}
			subtitle={[
				props.speaking.date.toLocaleString("en-US", {
					day: "numeric",
					month: "short",
					timeZone: "GMT",
				}),
				props.speaking.location,
			]
				.filter(Boolean)
				.join(" - ")}
			title={props.speaking.event}
			url={props.speaking.href}
			widths="third"
		/>
	);
}

function linkToTimestamp(href: string, timestamp: string) {
	const seconds = timestamp
		.split(":")
		.reduce((total, part) => total * 60 + Number(part), 0);
	const url = new URL(href);
	url.searchParams.set("t", `${String(seconds)}s`);
	return url.href;
}
