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
	serverRoot: "dist",
	urlRewriteExpressions: [{ pattern: site, replacement: local }],
});

const broken = result.links
	.filter((link) => link.state === LinkState.BROKEN)
	.map((link) => {
		const messages = (link.failureDetails ?? [])
			.map((detail) => ("message" in detail ? detail.message : ""))
			.filter(Boolean);
		const invalid = !messages.length && !link.status;

		return {
			// linkinator reports links it couldn't parse as they were written
			link: invalid ? link.url : toSitePath(link.url),
			page: toSitePath(link.parent),
			text: link.displayText,
			why: messages.length
				? messages.join(", ")
				: invalid
					? "Invalid URL"
					: `HTTP ${String(link.status)}`,
		};
	})
	.sort((a, b) => a.page.localeCompare(b.page) || a.link.localeCompare(b.link));

if (broken.length) {
	console.error(`Found ${String(broken.length)} broken link(s):`);

	for (const { link, page, text, why } of broken) {
		console.error(
			[
				`\n  On:   ${page}`,
				`  Link: ${link}`,
				...(text ? [`  Text: ${text}`] : []),
				`  Why:  ${why}`,
			].join("\n"),
		);
	}

	if (broken.some(({ why }) => why === "HTTP 404")) {
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
