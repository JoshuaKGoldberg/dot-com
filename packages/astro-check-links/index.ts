import type { AstroIntegration } from "astro";

import { AstroError } from "astro/errors";
import { LinkChecker, type LinkResult, LinkState } from "linkinator";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Options for the checkLinks() integration.
 */
export interface CheckLinksOptions {
	/**
	 * Other URLs the site is served from, such as `"https://example.com"` for a
	 * `site` of `"https://www.example.com"`.
	 * Absolute links to them are checked against the build, like links to `site`.
	 */
	aliases?: string[];

	/**
	 * Whether broken links fail the build, rather than being logged as a warning.
	 * @default true
	 */
	failOnBrokenLinks?: boolean;

	/**
	 * Links not to check, such as to files served by something other than the build.
	 * Strings match the start of a link's path, including any `base`, and
	 * regular expressions are tested against the path.
	 */
	ignore?: (RegExp | string)[];
}

interface BrokenLink {
	link: string;
	page: string;
	text?: string;
	why: string;
}

/**
 * Checks that links in the built site point to pages, files, and heading
 * anchors that exist in the build.
 * @param options Options for which links to check and how to report them.
 * @returns An Astro integration that checks links after each build.
 */
export function checkLinks(options: CheckLinksOptions = {}): AstroIntegration {
	const { aliases = [], failOnBrokenLinks = true, ignore = [] } = options;
	let base = "/";
	let cleanUrls = false;
	let hosts = new Set<string>();

	return {
		hooks: {
			"astro:build:done": async ({ dir, logger }) => {
				const { broken, checked } = await findBrokenLinks({
					base,
					cleanUrls,
					directory: fileURLToPath(dir),
					hosts,
					ignore,
				});

				if (!broken.length) {
					logger.info(
						`Found no broken links among ${String(checked)} checked.`,
					);
					return;
				}

				const summary = `Found ${String(broken.length)} broken link(s).`;
				const details = broken.map(({ link, page, text, why }) =>
					[
						`  On:   ${page}`,
						`  Link: ${link}`,
						...(text ? [`  Text: ${text}`] : []),
						`  Why:  ${why}`,
					].join("\n"),
				);
				const hint = broken.some(({ why }) => why === "HTTP 404")
					? "If a link is to a file served by something other than this build, add its path to the `ignore` option of checkLinks()."
					: undefined;

				if (!failOnBrokenLinks) {
					logger.warn(
						[summary, ...details, ...(hint ? [hint] : [])].join("\n\n"),
					);
					return;
				}

				logger.error([summary, ...details].join("\n\n"));
				throw new AstroError(summary, hint);
			},
			"astro:config:done": ({ config }) => {
				base = config.base;
				cleanUrls = config.build.format !== "directory";
				hosts = new Set(
					[...(config.site ? [config.site] : []), ...aliases].map(
						(url) => new URL(url).host,
					),
				);
			},
		},
		name: "astro-check-links",
	};
}

function describeBrokenLink(link: LinkResult): BrokenLink {
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
}

async function findBrokenLinks({
	base,
	cleanUrls,
	directory,
	hosts,
	ignore,
}: {
	base: string;
	cleanUrls: boolean;
	directory: string;
	hosts: Set<string>;
	ignore: (RegExp | string)[];
}) {
	const port = await findOpenPort();
	const local = `http://127.0.0.1:${String(port)}`;

	// Serving the build at its base path makes links outside of it fail, as on a host
	const basePath = base.replace(/^\/+|\/+$/g, "");
	const serverRoot = basePath
		? await mkdtemp(join(tmpdir(), "astro-check-links-"))
		: directory;

	try {
		if (basePath) {
			const served = join(serverRoot, ...basePath.split("/"));
			await mkdir(dirname(served), { recursive: true });
			await symlink(directory, served, "junction");
		}

		const result = await new LinkChecker().check({
			checkCss: true,
			checkFragments: true,
			cleanUrls,
			// External links are out of scope, and would make builds depend on other sites
			linksToSkip: (link) => Promise.resolve(shouldSkip(link)),
			// Starting from every page and stylesheet also checks ones nothing links to
			path: [posix.join(basePath, "**/*.{css,html}")],
			port,
			serverRoot,
			urlRewriteExpressions: [...hosts].map((host) => ({
				pattern: new RegExp(
					`^https?://${host.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&")}(?=[/?#]|$)`,
					"i",
				),
				replacement: local,
			})),
		});

		const broken = result.links
			.flatMap((link) => {
				if (link.state === LinkState.BROKEN) {
					return [describeBrokenLink(link)];
				}

				// The local server ignores empty path segments, but most hosts don't
				if (link.state === LinkState.OK && hasEmptySegment(link.url)) {
					return [
						{
							...describeBrokenLink(link),
							why: "Path has an empty segment (//), which doesn't match a file in the build",
						},
					];
				}

				return [];
			})
			.sort(
				(a, b) => a.page.localeCompare(b.page) || a.link.localeCompare(b.link),
			);

		return {
			broken,
			checked: result.links.filter((link) => link.state === LinkState.OK)
				.length,
		};
	} finally {
		if (basePath) {
			// This removes the link to the build, not the build itself
			await rm(serverRoot, { force: true, recursive: true });
		}
	}

	function shouldSkip(link: string) {
		const url = URL.parse(link);
		if (!url) {
			return false;
		}

		const internal =
			url.origin === local ||
			(/^https?:$/.test(url.protocol) && hosts.has(url.host));

		return (
			!internal ||
			ignore.some((pattern) =>
				typeof pattern === "string"
					? url.pathname.startsWith(pattern)
					: pattern.test(url.pathname),
			)
		);
	}
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

function hasEmptySegment(url: string) {
	return URL.parse(url, "http://localhost")?.pathname.includes("//") ?? false;
}

// linkinator reports local URLs relative to the server root, like blog/my-post/index.html
function toSitePath(url = "") {
	if (/^[a-z][\w+.-]*:/i.test(url)) {
		return url;
	}

	const path = url
		.replace(/^\.?\//, "")
		.replace(/(?:^|(?<=\/))index\.html(?=[?#]|$)/, "");

	return `/${path}`;
}
