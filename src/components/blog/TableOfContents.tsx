import type { MarkdownHeading } from "astro";

import clsx from "clsx";
import { createSignal, For, onCleanup, onMount } from "solid-js";

import { Squiggly } from "../Squiggly";
import { Text } from "../Text";
import { getActiveHeading, getLinkedHeading } from "./getActiveHeading";
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
						heading,
					});
					break;
				case 3:
					groups[groups.length - 1].children.push({
						children: [],
						heading,
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
	let pointing = false;
	let root!: HTMLOListElement;

	/**
	 * Long tables of contents scroll on their own, so this keeps the active
	 * link in view there, without moving the page.
	 * It leaves them alone while someone is pointing at or tabbing through them.
	 */
	function revealLink(slug: string | undefined) {
		const { clientHeight, scrollHeight, scrollTop } = root;
		if (
			pointing ||
			scrollHeight <= clientHeight ||
			root.matches(":has(:focus-visible)")
		) {
			return;
		}

		const link = root.querySelector<HTMLElement>(
			slug ? `a[href="#${CSS.escape(slug)}"]` : "a",
		);
		if (!link) {
			return;
		}

		const linkTop =
			link.getBoundingClientRect().top -
			root.getBoundingClientRect().top +
			scrollTop;
		const linkBottom = linkTop + link.offsetHeight;
		if (linkTop >= scrollTop && linkBottom <= scrollTop + clientHeight) {
			return;
		}

		root.scrollTop = linkTop - (clientHeight - link.offsetHeight) / 2;
	}

	onMount(() => {
		const headings = props.headings
			.filter(({ depth }) => depth >= 2 && depth <= 4)
			.map(({ slug }) => document.getElementById(slug))
			.filter((heading) => heading !== null);

		/**
		 * Whether a link to a heading was followed, and if so, whether the page
		 * has reached it yet. Once the reader scrolls away, or a scroll ends
		 * without reaching it, it's no longer used.
		 */
		let following: "arrived" | "arriving" | undefined;

		function followLink() {
			following = location.hash ? "arriving" : undefined;
			updateActiveHeading();
		}

		function updateActiveHeading() {
			let active: HTMLElement | undefined;

			if (following) {
				active = getLinkedHeading(headings);

				if (active) {
					following = "arrived";
				} else if (following === "arrived") {
					following = undefined;
				}
			}

			const slug = (active ?? getActiveHeading(headings))?.id;
			if (slug === getActiveSlug()) {
				return;
			}

			revealLink(slug);
			setActiveSlug(slug);
		}

		followLink();

		const listeners = {
			hashchange: followLink,
			popstate: followLink,
			resize: updateActiveHeading,
			scroll: updateActiveHeading,
			scrollend: () => {
				if (following === "arriving") {
					following = undefined;
				}
			},
		};

		for (const [event, listener] of Object.entries(listeners)) {
			addEventListener(event, listener, { passive: true });
		}

		onCleanup(() => {
			for (const [event, listener] of Object.entries(listeners)) {
				removeEventListener(event, listener);
			}
		});
	});

	return (
		<>
			<label class={styles.toggle}>
				<input type="checkbox" value="Expand table of contents" />
				<Squiggly as="span" fontSize="small">
					Table of Contents
				</Squiggly>
			</label>
			<nav aria-label="Table of contents" class={styles.tableOfContents}>
				<ol
					class={clsx(styles.ol, styles.tableRoot)}
					onPointerEnter={(event) => {
						pointing = event.pointerType !== "touch";
					}}
					onPointerLeave={() => {
						pointing = false;
					}}
					ref={root}
				>
					<li class={styles.li}>
						<Text
							as="a"
							class={clsx(styles.back, !getActiveSlug() && styles.active)}
							fontWeight="light"
							href="#top"
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
													{h4s.length ? (
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
													) : null}
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
