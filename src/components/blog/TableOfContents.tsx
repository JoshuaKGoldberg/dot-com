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
		const headings = Array.from(
			document.querySelectorAll<HTMLElement>("h2, h3, h4")
		);

		// Case: If the first heading is within the top half of the screen, we're at the beginning
		if (document.body.scrollTop < headings[0].offsetTop / 2) {
			setActiveSlug(undefined);
			return;
		}

		// Case: if the last heading is within the top half of the screen, the article is done
		if (
			headings[headings.length - 1].getBoundingClientRect().top <
			innerHeight / 2
		) {
			setActiveSlug(headings[headings.length - 1].id);
			return;
		}

		// Case: if a next (i + 1) heading is beyond the 2/3 point of the screen, we're at i
		const threshold = innerHeight / 3;

		for (let i = 0; i < headings.length - 1; i += 1) {
			if (headings[i + 1].getBoundingClientRect().top > threshold) {
				setActiveSlug(headings[i].id);
				return;
			}
		}

		// Fallback: we've passed all other headings, so we're at the last one
		setActiveSlug(headings[headings.length - 1].id);
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
