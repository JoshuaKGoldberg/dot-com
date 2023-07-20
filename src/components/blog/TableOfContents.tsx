import type { MarkdownHeading } from "astro";
import clsx from "clsx";
import { createEffect, createSignal, For } from "solid-js";

import { Squiggly } from "../Squiggly";
import { Text } from "../Text";
import styles from "./TableOfContents.module.css";

export interface TableOfContentsProps {
	headings: MarkdownHeading[];
}

interface HeadingGroup {
	h2: MarkdownHeading;
	h3s: MarkdownHeading[];
}

export function TableOfContents(props: TableOfContentsProps) {
	const headingGroups = () => {
		const groups: HeadingGroup[] = [
			{
				h2: props.headings[0],
				h3s: [],
			},
		];

		for (const heading of props.headings.slice(1)) {
			if (heading.depth === 2) {
				groups.push({
					h2: heading,
					h3s: [],
				});
			} else {
				groups[groups.length - 1].h3s.push(heading);
			}
		}

		return groups;
	};

	const [getActiveSlug, setActiveSlug] = createSignal<string | undefined>(
		undefined
	);

	function updateActiveHeading() {
		const { scrollTop } = document.body;
		const headings = document.querySelectorAll<HTMLElement>("h2, h3");

		if (scrollTop < headings[0].offsetTop / 2) {
			setActiveSlug(undefined);
			return;
		}

		for (const heading of headings) {
			// Allow 56px (4rem) of leeway for the heading in the scroll position
			if (heading.offsetTop >= scrollTop - 56) {
				setActiveSlug(heading.id);
				return;
			}
		}
	}

	createEffect(updateActiveHeading);

	document.body.addEventListener("scroll", updateActiveHeading, {
		passive: true,
	});

	return (
		<>
			<label class={styles.toggle}>
				<input type="checkbox" value="Expand table of contents" />
				<Squiggly as="span" fontSize="smaller">
					Table of Contents
				</Squiggly>
			</label>
			<nav class={styles.tableOfContents}>
				<ol class={clsx(styles.ol, styles.tableRoot)}>
					<li class={styles.li}>
						<Text
							as="a"
							class={clsx(styles.back, !getActiveSlug() && styles.active)}
							fontWeight="light"
							href="#"
							onClick={(event) => {
								document.body.scroll({
									behavior: "smooth",
									top: 0,
								});
								window.location.hash = "";
								event.preventDefault();
							}}
						>
							Back to Top
						</Text>
					</li>
					<For each={headingGroups()}>
						{({ h2, h3s }) => (
							<li class={styles.li}>
								<Text
									as="a"
									class={clsx(
										styles.a,
										h2.slug === getActiveSlug() && styles.active
									)}
									fontWeight="light"
									href={`#${h2.slug}`}
								>
									{h2.text}
								</Text>
								{h3s.length ? (
									<ol class={styles.ol}>
										<For each={h3s}>
											{(h3) => (
												<li class={styles.li}>
													<Text
														as="a"
														class={clsx(
															styles.a,
															h3.slug === getActiveSlug() && styles.active
														)}
														fontWeight="light"
														href={`#${h3.slug}`}
													>
														{h3.text}
													</Text>
												</li>
											)}
										</For>
									</ol>
								) : null}
							</li>
						)}
					</For>
				</ol>
			</nav>
		</>
	);
}
