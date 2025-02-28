import type { MarkdownHeading } from "astro";

import clsx from "clsx";
import { For, createEffect, createSignal } from "solid-js";

import { Squiggly } from "../Squiggly";
import { Text } from "../Text";
import styles from "./TableOfContents.module.css";

export interface TableOfContentsProps {
	headings: MarkdownHeading[];
}

interface Heading2Group {
	children: Heading3Group[];
	heading: MarkdownHeading;
}

interface Heading3Group {
	children: MarkdownHeading[];
	heading: MarkdownHeading;
}

export function TableOfContents(props: TableOfContentsProps) {
	const headingGroups = () => {
		if (!props.headings.length) {
			return [];
		}

		const groups: Heading2Group[] = [
			{
				children: [],
				heading: props.headings[0],
			},
		];

		for (const heading of props.headings.slice(1)) {
			switch (heading.depth) {
				case 2:
					groups.push({
						children: [],
						heading: heading,
					});
					break;
				case 3:
					groups[groups.length - 1].children.push({
						children: [],
						heading: heading,
					});
					break;
				case 4:
					groups[groups.length - 1].children[
						groups[groups.length - 1].children.length - 1
					].children.push(heading);
			}
		}

		return groups;
	};

	const [getActiveSlug, setActiveSlug] = createSignal<string | undefined>(
		undefined,
	);

	// TODO: Is this available on npm? If not, perhaps I should publish it?
	function updateActiveHeading() {
		const headings = Array.from(
			document.querySelectorAll<HTMLElement>("h2, h3, h4"),
		);

		// Case: no headings at all!
		if (!headings.length) {
			return;
		}

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
						{({ children: h3s, heading: h2 }) => (
							<li class={styles.li}>
								<Text
									as="a"
									class={clsx(
										styles.a,
										h2.slug === getActiveSlug() && styles.active,
									)}
									fontWeight="light"
									href={`#${h2.slug}`}
								>
									{h2.text}
								</Text>
								{h3s.length ? (
									<ol class={styles.ol}>
										<For each={h3s}>
											{({ children: h4s, heading: h3 }) => (
												<li class={styles.li}>
													<Text
														as="a"
														class={clsx(
															styles.a,
															h3.slug === getActiveSlug() && styles.active,
														)}
														fontWeight="light"
														href={`#${h3.slug}`}
													>
														{h3.text}
													</Text>
													{h4s.length && (
														<ol class={styles.ol}>
															<For each={h4s}>
																{(h4) => (
																	<li class={styles.li}>
																		<Text
																			as="a"
																			class={clsx(
																				styles.a,
																				h4.slug === getActiveSlug() &&
																					styles.active,
																			)}
																			fontWeight="light"
																			href={`#${h4.slug}`}
																		>
																			{h4.text}
																		</Text>
																	</li>
																)}
															</For>
														</ol>
													)}
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
