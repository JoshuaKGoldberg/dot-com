import { fontData } from "astro:assets";

import {
	blogDescription,
	colorsBackground,
	site,
	siteName,
} from "../constants";

interface FeedPageOptions {
	blogDescription: string;
	colorsBackground: typeof colorsBackground;
	feedUrl: string;
	siteName: string;
	styles: string;
}

const fontFaces = (["--fontCode", "--fontDisplay", "--fontText"] as const)
	.map((cssVariable) => {
		const family = `rss${cssVariable.slice("--font".length)}`;

		return fontData[cssVariable]
			.filter((font) => font.subset === "latin")
			.map(
				(font) => `@font-face {
	font-display: swap;
	font-family: ${family};
	font-style: ${font.style ?? "normal"};
	font-weight: ${font.weight ?? "normal"};
	src: ${font.src.map(({ format, url }) => `url("${url}")${format ? ` format("${format}")` : ""}`).join(", ")};
}`,
			)
			.join("\n");
	})
	.join("\n");

/** The site's own colors and weights, as in base.css */
const styles = `
${fontFaces}

:root {
	color-scheme: light;

	--colorBackground: ${colorsBackground.light};
	--colorEmphasized: #0a58aa;
	--colorForeground: #283556;
	--colorForegroundExtra: #142842;
	--colorMuted: #4d5b7b;
	--colorSubtle: #d7e9ef;
	--fontWeightLight: 300;
}

:root.dark {
	color-scheme: dark;

	--colorBackground: ${colorsBackground.dark};
	--colorEmphasized: #77bbff;
	--colorForeground: #dae7f3;
	--colorForegroundExtra: #f1f6fb;
	--colorMuted: #93a5bf;
	--colorSubtle: #102a40;
	--fontWeightLight: 360;
}

html {
	background: var(--colorBackground);
	color: var(--colorForeground);
	font-family: rssText, serif;
	font-synthesis-weight: none;
	font-weight: var(--fontWeightLight);
	line-height: 1.25;
	-webkit-text-size-adjust: 100%;
	text-size-adjust: 100%;
}

body {
	margin: 0 auto;
	max-width: 47rem;
	padding: 2rem clamp(1rem, 5vw, 2rem) 4rem;
}

a {
	color: inherit;
	text-decoration-color: var(--colorMuted);
	text-decoration-thickness: 1px;
	text-underline-offset: 0.2em;
}

a:hover {
	color: var(--colorEmphasized);
}

a:focus-visible {
	border-radius: 2px;
	outline: 2px solid var(--colorEmphasized);
	outline-offset: 3px;
}

h1,
h2,
.siteName,
.postTitle {
	color: var(--colorForegroundExtra);
	font-family: rssDisplay, serif;
	font-weight: 400;
}

.siteName {
	font-size: 1.25rem;
	text-decoration: none;
}

header {
	margin: 1rem 0 clamp(2rem, 8vw, 4rem);
}

h1 {
	font-size: clamp(2.5rem, 1.9rem + 2.4vw, 3.25rem);
	margin: 0 0 0.75rem;
}

h2 {
	font-size: clamp(1.4rem, 1.2rem + 1.2vw, 1.625rem);
	margin: 3rem 0 1.5rem;
}

p {
	line-height: 1.55;
}

.lead {
	font-size: clamp(1.1rem, 0.85rem + 1.4vw, 1.2rem);
}

.address {
	background: var(--colorSubtle);
	border-radius: 0.5rem;
	display: block;
	font-family: rssCode, monospace;
	font-size: clamp(0.875rem, 0.75rem + 0.6vw, 1rem);
	padding: 0.75rem;
	-webkit-user-select: all;
	user-select: all;
}

ol {
	display: flex;
	flex-direction: column;
	gap: 2rem;
	list-style: none;
	margin: 0;
	padding: 0;
}

.postTitle {
	font-size: clamp(1.1rem, 0.85rem + 1.4vw, 1.2rem);
	text-decoration: none;
}

.postTitle:hover {
	text-decoration: underline;
}

.postDate {
	color: var(--colorMuted);
	display: block;
	margin: 0.15rem 0 0.5rem;
}

.postDescription {
	line-height: 1.35;
	margin: 0;
	text-wrap: pretty;
}

footer {
	margin-top: 3rem;
}
`;

/**
 * Runs in browsers that open the feed, replacing its XML with a page about it.
 * It's sent as source text, so it may only use its own options and browser globals.
 */
function renderFeedPage(options: FeedPageOptions) {
	const namespace = "http://www.w3.org/1999/xhtml";

	function create(
		tag: string,
		attributes: Record<string, string> = {},
		...children: (Node | string)[]
	) {
		const element = document.createElementNS(namespace, tag);

		for (const [name, value] of Object.entries(attributes)) {
			element.setAttribute(name, value);
		}

		element.append(...children);

		return element;
	}

	function childText(parent: Element, name: string) {
		return parent.querySelector(`:scope > ${name}`)?.textContent ?? "";
	}

	// The same choice the site's theme toggle saves, or else the system's
	const preference = matchMedia("(prefers-color-scheme: dark)");

	function readTheme() {
		try {
			const stored = localStorage.getItem("theme");
			if (stored === "dark" || stored === "light") {
				return stored;
			}
		} catch {
			// Storage throws when the browser is set to block site data
		}

		return preference.matches ? "dark" : "light";
	}

	function render() {
		const channel = document.querySelector("rss > channel");
		if (!channel) {
			throw new Error("The feed has no channel to show.");
		}

		const title = childText(channel, "title");
		const themeColor = create("meta", { name: "theme-color" });
		const html = create(
			"html",
			{ lang: "en" },
			create(
				"head",
				{},
				create("meta", { content: "width=device-width", name: "viewport" }),
				themeColor,
				create("link", {
					href: "/favicon-dark.svg",
					media: "(prefers-color-scheme: dark)",
					rel: "icon",
					type: "image/svg+xml",
				}),
				create("link", {
					href: "/favicon.svg",
					media: "(prefers-color-scheme: light)",
					rel: "icon",
					type: "image/svg+xml",
				}),
				create("link", { href: "/favicon.ico", rel: "icon", sizes: "32x32" }),
				create("link", {
					href: "/apple-touch-icon.png",
					rel: "apple-touch-icon",
				}),
				create("link", {
					href: "/rss.xml",
					rel: "alternate",
					title: "RSS Feed",
					type: "application/rss+xml",
				}),
				create("title", {}, `${title} RSS Feed | ${options.siteName}`),
				create("style", {}, options.styles),
			),
			create(
				"body",
				{},
				create(
					"header",
					{},
					create("a", { class: "siteName", href: "/" }, options.siteName),
				),
				create(
					"main",
					{},
					create("h1", {}, `${title} RSS Feed`),
					create("p", { class: "lead" }, options.blogDescription),
					create(
						"p",
						{},
						"This is an RSS feed: a list of blog posts that feed reader apps check for you, so you can see new ones as soon as they’re published. ",
						"To subscribe, paste this address into a feed reader:",
					),
					create(
						"code",
						{ class: "address" },
						options.feedUrl.replace(/rss\.xml$/, ""),
						create("wbr"),
						"rss.xml",
					),
					create(
						"p",
						{},
						"New to feeds? ",
						create("a", { href: "https://aboutfeeds.com" }, "About Feeds"),
						" explains how they work and suggests some readers.",
					),
					create("h2", {}, "Posts"),
					create(
						"ol",
						{ role: "list" },
						...Array.from(channel.querySelectorAll(":scope > item"), (item) => {
							const date = new Date(childText(item, "pubDate"));

							return create(
								"li",
								{},
								create(
									"a",
									{ class: "postTitle", href: childText(item, "link") },
									childText(item, "title"),
								),
								...(Number.isNaN(date.getTime())
									? []
									: [
											create(
												"time",
												{
													class: "postDate",
													datetime: date.toISOString().slice(0, 10),
												},
												date.toLocaleString("en-US", {
													day: "numeric",
													month: "short",
													timeZone: "GMT",
													year: "numeric",
												}),
											),
										]),
								create(
									"p",
									{ class: "postDescription" },
									childText(item, "description"),
								),
							);
						}),
					),
				),
				create(
					"footer",
					{},
					create("a", { href: "/blog" }, "See all posts on the blog"),
				),
			),
		);

		function applyTheme() {
			const theme = readTheme();
			html.classList.toggle("dark", theme === "dark");
			themeColor.setAttribute("content", options.colorsBackground[theme]);
		}

		applyTheme();
		preference.addEventListener("change", applyTheme);
		addEventListener("storage", applyTheme);

		document.documentElement.replaceWith(html);
	}

	// Tells rss-loading.css that its backstop isn't needed, as this is running
	document.documentElement.setAttribute("data-loaded", "");

	document.addEventListener("DOMContentLoaded", () => {
		try {
			render();
		} catch (error) {
			// rss-loading.css's readable raw feed is better than a blank page
			document.documentElement.setAttribute("data-failed", "");

			throw error;
		}
	});
}

const options: FeedPageOptions = {
	blogDescription,
	colorsBackground,
	feedUrl: `${site}/rss.xml`,
	siteName,
	styles,
};

export function GET() {
	return new Response(
		`(${renderFeedPage.toString()})(${JSON.stringify(options)});\n`,
		{ headers: { "Content-Type": "text/javascript" } },
	);
}
