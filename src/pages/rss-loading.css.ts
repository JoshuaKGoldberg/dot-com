import { colorsBackground } from "../constants";

/**
 * Hides the feed's raw text in browsers until rss.js replaces it,
 * or shows it readably if JavaScript is off, rss.js fails, or rss.js hasn't started after a while.
 */
const styles = `rss {
	background: ${colorsBackground.light};
	color: #283556;
	line-height: 1.35;
	margin: 0 auto;
	max-width: 47rem;
	padding: 1rem;
}

@media (prefers-color-scheme: dark) {
	rss {
		background: ${colorsBackground.dark};
		color: #dae7f3;
	}
}

@media (scripting: enabled) {
	rss:not([data-failed]) {
		visibility: hidden;
	}

	rss:not([data-failed], [data-loaded]) {
		animation: 0s 5s forwards rssLoadingReveal;
	}
}

@keyframes rssLoadingReveal {
	to {
		visibility: visible;
	}
}

rss > channel > title,
rss > channel > item,
rss > channel > item > * {
	display: block;
}

rss > channel > title,
rss > channel > item > title {
	font-weight: bold;
}

rss > channel > item {
	margin: 1em 0;
}

rss > channel > :is(language, link),
rss > channel > item > guid {
	display: none;
}
`;

export function GET() {
	return new Response(styles, { headers: { "Content-Type": "text/css" } });
}
