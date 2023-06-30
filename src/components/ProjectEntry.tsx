import type { CollectionEntry } from "astro:content";
import { clsx } from "clsx";
import { For } from "solid-js";

import styles from "./ProjectEntry.module.css";
import { ProjectSubEntry } from "./ProjectSubEntry";
import { Text } from "./Text";

export interface ProjectEntryProps {
	class?: string | undefined;
	project: CollectionEntry<"projects">;
}

export function ProjectEntry(props: ProjectEntryProps) {
	return (
		<>
			<li class={clsx(styles.projectEntry, props.class)}>
				{props.project.data.image && (
					<img
						alt=""
						class={styles.image}
						src={`/images/${props.project.data.image}`}
					/>
				)}
				<div class={styles.contents}>
					<Text
						as="a"
						fontSize="medium"
						fontWeight="bold"
						href={
							props.project.url ??
							`https://github.com/JoshuaKGoldberg/${props.project.title}`
						}
					>
						{props.project.data.title ?? props.project.slug}
					</Text>
					<Text
						as="div"
						class={styles.description}
						fontSize="small"
						fontWeight="light"
					>
						{props.project.data.description}
					</Text>
					<Text class={styles.role} as="p" fontWeight="light">
						{props.project.data.role ?? "Creator & Maintainer"}
					</Text>
				</div>
			</li>
			{props.project.data.more && (
				<li class={clsx(styles.projectEntry, props.class)}>
					<ul class={styles.subList}>
						<For each={props.project.data.more}>
							{(more) => <ProjectSubEntry {...more} />}
						</For>
					</ul>
				</li>
			)}
		</>
	);
}
