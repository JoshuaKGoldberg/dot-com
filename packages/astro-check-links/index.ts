import type { AstroIntegration } from "astro";

import { AstroError } from "astro/errors";
import { LinkChecker, type LinkResult, LinkState } from "linkinator";
import { once } from "node:events";
import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Options for the checkLinks() integration.
 */
export interface CheckLinksOptions {
	/**
	 * Other origins the site is served from, such as `"https://example.com"`
	 * for a `site` of `"https://www.example.com"`.
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

const contentTypes: Record<string, string | undefined> = {
	".css": "text/css",
	".html": "text/html; charset=utf-8",
};

/**
 * Checks that links in the built site point to pages, files, and heading
 * anchors that exist in the build.
 * @param options Options for which links to check and how to report them.
 * @returns An Astro integration that checks links after each build.
 */
export function checkLinks(options: CheckLinksOptions = {}): AstroIntegration {
	const { aliases = [], failOnBrokenLinks = true, ignore = [] } = options;
	let base = "/";
	let hosts = new Set<string>();

	return {
		hooks: {
			"astro:build:done": async ({ dir, logger }) => {
				let results: Awaited<ReturnType<typeof findBrokenLinks>>;

				try {
					results = await findBrokenLinks({
						base,
						directory: fileURLToPath(dir),
						hosts,
						ignore,
					});
				} catch (error) {
					if (failOnBrokenLinks) {
						throw error;
					}

					logger.warn(
						`Could not check links: ${error instanceof Error ? error.message : String(error)}`,
					);
					return;
				}

				const { broken, checked } = results;

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
				hosts = new Set(
					[...(config.site ? [config.site] : []), ...aliases].map((url) => {
						const parsed = URL.parse(url);
						if (!parsed) {
							throw new AstroError(
								`Invalid URL in the aliases option of checkLinks(): ${url}`,
								'Aliases are full URLs, such as "https://example.com".',
							);
						}

						return parsed.host;
					}),
				);
			},
		},
		name: "astro-check-links",
	};
}

function describeBrokenLink(link: LinkResult, local: string): BrokenLink {
	const messages = (link.failureDetails ?? [])
		.map((detail) => ("message" in detail ? detail.message : ""))
		.filter(Boolean);
	const invalid = !messages.length && !link.status;

	return {
		// linkinator reports links it couldn't parse as they were written
		link: invalid ? link.url : toSitePath(link.url, local),
		page: toSitePath(link.parent, local),
		text: link.displayText,
		why: messages.length
			? messages.join(", ")
			: invalid
				? "Invalid URL"
				: describeStatus(link),
	};
}

function describeStatus(link: LinkResult) {
	const pathname = URL.parse(link.url)?.pathname ?? "";

	if (link.status === 404) {
		if (pathname.includes("//")) {
			return "Path has an empty segment (//), which doesn't match a file in the build";
		}

		try {
			decodeURIComponent(pathname);
		} catch {
			return "Path has a % that isn't part of a valid escape, such as %25";
		}
	}

	return `HTTP ${String(link.status)}`;
}

async function findBrokenLinks({
	base,
	directory,
	hosts,
	ignore,
}: {
	base: string;
	directory: string;
	hosts: Set<string>;
	ignore: (RegExp | string)[];
}) {
	const files = await listFiles(directory);
	const server = await serveBuild(directory, files, base);
	const address = server.address();

	if (!address || typeof address === "string") {
		throw new Error("Could not start a local server for the build.");
	}

	const local = `http://127.0.0.1:${String(address.port)}`;
	const prefix = base.replace(/\/*$/, "/");

	try {
		const result = await new LinkChecker().check({
			checkCss: true,
			checkFragments: true,
			// Text fragments, like #:~:text=hello, match text rather than ids
			fragmentsToSkip: (fragment) =>
				Promise.resolve(fragment.startsWith(":~:")),
			// External links are out of scope, and would make builds depend on other sites
			linksToSkip: (link) => Promise.resolve(shouldSkip(link)),
			// Starting from every page and stylesheet also checks ones nothing links to
			path: files
				.filter((file) => /\.(?:css|html)$/.test(file))
				.map(
					(file) =>
						local +
						prefix +
						file
							.replace(/(?:^|(?<=\/))index\.html$/, "")
							.split("/")
							.map(encodeURIComponent)
							.join("/"),
				),
			urlRewriteExpressions: [...hosts].map((host) => ({
				pattern: new RegExp(
					`^https?://${host.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&")}(?=[/?#]|$)`,
					"i",
				),
				replacement: local,
			})),
		});

		const broken = result.links
			.filter((link) => link.state === LinkState.BROKEN)
			.map((link) => describeBrokenLink(link, local))
			.sort(
				(a, b) => a.page.localeCompare(b.page) || a.link.localeCompare(b.link),
			);

		return {
			broken,
			checked: result.links.filter((link) => link.state === LinkState.OK)
				.length,
		};
	} finally {
		server.closeAllConnections();
		server.close();
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

async function listFiles(directory: string) {
	const entries = await readdir(directory, {
		recursive: true,
		withFileTypes: true,
	});

	return entries
		.filter((entry) => entry.isFile())
		.map((entry) =>
			relative(directory, join(entry.parentPath, entry.name))
				.split(sep)
				.join("/"),
		);
}

/**
 * Finds the file a static host would serve for a request's path, matching
 * case exactly, or the path it would redirect to.
 */
function resolveRequest(
	files: Set<string>,
	prefix: string,
	pathname: string,
): undefined | { file: string } | { redirect: string } {
	if (!pathname.startsWith(prefix)) {
		return `${pathname}/` === prefix ? { redirect: prefix } : undefined;
	}

	let path: string;
	try {
		path = decodeURIComponent(pathname.slice(prefix.length));
	} catch {
		return undefined;
	}

	if (path.startsWith("/") || path.includes("//")) {
		return undefined;
	}

	if (path === "" || path.endsWith("/")) {
		return files.has(`${path}index.html`)
			? { file: `${path}index.html` }
			: undefined;
	}

	for (const file of [path, `${path}.html`]) {
		if (files.has(file)) {
			return { file };
		}
	}

	return files.has(`${path}/index.html`)
		? { redirect: `${pathname}/` }
		: undefined;
}

// Serves the build under its base path, the way most static hosts do
async function serveBuild(directory: string, files: string[], base: string) {
	const known = new Set(files);
	const prefix = base.replace(/\/*$/, "/");

	const server = createServer((request, response) => {
		const [pathname = "/", query] = (request.url ?? "/").split(/\?(.*)/s);
		const resolved = resolveRequest(known, prefix, pathname);

		if (!resolved) {
			response.writeHead(404).end();
		} else if ("redirect" in resolved) {
			response
				.writeHead(301, {
					location: resolved.redirect + (query ? `?${query}` : ""),
				})
				.end();
		} else {
			response.writeHead(200, {
				"content-type":
					contentTypes[extname(resolved.file)] ?? "application/octet-stream",
			});

			if (request.method === "HEAD") {
				response.end();
			} else {
				createReadStream(join(directory, resolved.file)).pipe(response);
			}
		}
	});

	server.listen(0, "127.0.0.1");
	await once(server, "listening");

	return server;
}

// linkinator reports pages by their full local URL, like http://127.0.0.1:1234/blog/my-post/
function toSitePath(url = "", local: string) {
	return url.startsWith(`${local}/`)
		? url.slice(local.length).replace(/(?<=\/)index\.html(?=[?#]|$)/, "")
		: url;
}
