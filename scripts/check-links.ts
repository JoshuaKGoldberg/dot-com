// Checks that links in the built site point to pages, assets, and heading
// anchors that exist in it. Run `pnpm build` first to create dist/.
import { LinkChecker, LinkState } from "linkinator";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:net";

if (!existsSync("dist")) {
	throw new Error("Run `pnpm build` first to create dist/.");
}

const port = await findOpenPort();
const local = `http://127.0.0.1:${String(port)}`;

// Absolute links to the site itself are checked against the build too
const site = /^https?:\/\/(?:www\.)?joshuakgoldberg\.com(?=[/?#]|$)/;

// The site's Worker serves these from its R2 bucket, outside of the build
const servedFromBucket = ["/img/"];

const result = await new LinkChecker().check({
	checkCss: true,
	checkFragments: true,
	// External links are out of scope, and would make CI depend on other sites
	linksToSkip: (link) =>
		Promise.resolve(
			(!link.startsWith(`${local}/`) && !site.test(link)) ||
				servedFromBucket.some((prefix) =>
					new URL(link).pathname.startsWith(prefix),
				),
		),
	// Starting from every page and stylesheet also checks ones nothing links to
	path: ["**/*.{css,html}"],
	port,
	recurse: true,
	serverRoot: "dist",
	urlRewriteExpressions: [{ pattern: site, replacement: local }],
});

interface BrokenLink {
	link: string;
	page: string;
	text: string | undefined;
	why: string;
}

const broken = new Map<string, BrokenLink>();

for (const link of result.links) {
	if (link.state !== LinkState.BROKEN) {
		continue;
	}

	const page = toPagePath(toSitePath(link.parent));
	const url = toSitePath(link.url);
	const messages = (link.failureDetails ?? [])
		.map((detail) => ("message" in detail ? detail.message : ""))
		.filter(Boolean);
	const why = messages.length
		? messages.join(", ")
		: link.status
			? `HTTP ${String(link.status)}`
			: "Invalid URL";

	// Pages can be crawled from several URLs, such as /page and /page/
	broken.set(`${page} ${url}`, {
		link: url,
		page,
		text: link.displayText,
		why,
	});
}

if (broken.size) {
	console.error(`Found ${String(broken.size)} broken link(s):`);

	for (const { link, page, text, why } of [...broken.values()].sort(
		(a, b) => a.page.localeCompare(b.page) || a.link.localeCompare(b.link),
	)) {
		console.error(
			[
				`\n  On:   ${page}`,
				`  Link: ${link}`,
				...(text ? [`  Text: ${text}`] : []),
				`  Why:  ${why}`,
			].join("\n"),
		);
	}

	if ([...broken.values()].some(({ why }) => why === "HTTP 404")) {
		console.error(
			"\nIf a link is to a file in the R2 bucket, add its folder to servedFromBucket in scripts/check-links.ts.",
		);
	}

	process.exitCode = 1;
} else {
	const checked = result.links.filter((link) => link.state === LinkState.OK);
	console.log(`Found no broken links among ${String(checked.length)} checked.`);
}

async function findOpenPort() {
	const server = createServer().listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	server.close();

	if (!address || typeof address === "string") {
		throw new Error("Could not find an open port for the link checker.");
	}

	return address.port;
}

function toPagePath(page: string) {
	const pathname = page.replace(/[?#].*/, "").replace(/(?<=.)\/$/, "");

	try {
		return decodeURIComponent(pathname);
	} catch {
		return pathname;
	}
}

// linkinator reports local URLs relative to dist/, like blog/my-post/index.html
function toSitePath(url = "") {
	if (/^[a-z][\w+.-]*:/i.test(url)) {
		return url;
	}

	const path = url
		.replace(/^\.?\//, "")
		.replace(/(?:^|(?<=\/))index\.html(?=[?#]|$)/, "");

	return `/${path}`;
}
