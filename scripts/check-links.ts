// Checks that links in the built site point to pages, assets, and heading
// anchors that exist in it. Run `pnpm build` first to create dist/.
import { LinkChecker, LinkState } from "linkinator";
import { once } from "node:events";
import { createServer } from "node:net";

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
	path: "dist",
	port,
	recurse: true,
	urlRewriteExpressions: [{ pattern: site, replacement: local }],
});

const broken = new Map<string, { link: string; page: string; why: string }>();

for (const link of result.links) {
	if (link.state !== LinkState.BROKEN) {
		continue;
	}

	const page = toSitePath(link.parent);
	const url = toSitePath(link.url);
	const messages = (link.failureDetails ?? [])
		.map((detail) => ("message" in detail ? detail.message : ""))
		.filter(Boolean);
	const why = messages.length
		? messages.join(", ")
		: `HTTP ${String(link.status)}`;

	// Pages can be crawled from both /page and /page/
	broken.set(`${page} ${url}`, { link: url, page, why });
}

if (broken.size) {
	console.error(`Found ${String(broken.size)} broken link(s):`);

	for (const { link, page, why } of [...broken.values()].sort((a, b) =>
		a.page.localeCompare(b.page),
	)) {
		console.error(`\n  On:   ${page}\n  Link: ${link}\n  Why:  ${why}`);
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

// linkinator reports local URLs as paths on disk, like dist/blog/my-post
function toSitePath(url = "") {
	const path = url.replace(local, "").replace(/^dist(?=[/#?]|$)/, "");
	return path.replace(/\/$/, "") || "/";
}
