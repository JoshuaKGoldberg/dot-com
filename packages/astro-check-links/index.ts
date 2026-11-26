import type { AstroIntegration } from "astro";

import { AstroError } from "astro/errors";
import {
	LinkChecker,
	type LinkResult,
	LinkState,
	resetSharedAgents,
} from "linkinator";
import { once } from "node:events";
import { readdir, readFile } from "node:fs/promises";
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
	let origin: string | undefined;

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
						origin,
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
						...(page ? [`  On:   ${page}`] : []),
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
				const invalidIgnore = ignore.find(
					(pattern) => typeof pattern === "string" && !pattern.startsWith("/"),
				);
				if (invalidIgnore !== undefined) {
					throw new AstroError(
						`Invalid path in the ignore option of checkLinks(): ${String(invalidIgnore)}`,
						'Ignored paths start with a /, such as "/downloads/".',
					);
				}

				const urls = aliases.map((url) => {
					const parsed = URL.parse(url);
					if (
						!parsed?.host ||
						!/^https?:$/.test(parsed.protocol) ||
						parsed.href !== `${parsed.origin}/`
					) {
						throw new AstroError(
							`Invalid URL in the aliases option of checkLinks(): ${url}`,
							'Aliases are origins without a path, such as "https://example.com".',
						);
					}

					return parsed;
				});

				if (config.site) {
					urls.unshift(new URL(config.site));
				}

				base = config.base;
				hosts = new Set(urls.map((url) => url.host));
				origin = urls[0]?.origin;
			},
		},
		name: "astro-check-links",
	};
}

/**
 * Rewrites absolute links to the site within its base path to the local server,
 * so they're checked against the build like any other link.
 * Absolute links to the site outside its base path are left as other sites.
 */
function createSiteRewriter(
	hosts: Set<string>,
	base: string,
	prefix: string,
	local: string,
) {
	if (!hosts.size) {
		return (text: string) => text;
	}

	const escape = (text: string) =>
		text.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&");
	const origins = `(?:https?:)?//(?:${[...hosts].map(escape).join("|")})`;
	const roots = [...new Set([base.replace(/\/*$/, ""), prefix.slice(0, -1)])]
		.map(escape)
		.join("|");
	const inBase = new RegExp(
		`${origins}(?=(?:${roots})(?:/|[?#"'\\s<>)]|$))`,
		"gi",
	);

	return (text: string) => text.replace(inBase, local);
}

function describeBrokenLink(
	link: LinkResult,
	local: string,
	origin: string | undefined,
): BrokenLink {
	// Text from the served build has the local server in place of the site
	const restoreSite = (text: string) =>
		origin ? text.replaceAll(local, origin) : text;

	const messages = (link.failureDetails ?? [])
		.map((detail) => ("message" in detail ? detail.message : ""))
		.filter(Boolean);
	const invalid = !messages.length && !link.status;

	return {
		// linkinator reports links it couldn't parse as they were written
		link: invalid
			? restoreSite(link.url)
			: restoreSite(toSitePath(link.url, local)),
		page: link.parent
			? toSitePath(link.parent, local).replace(
					/(?<=\/)index\.html(?=[?#]|$)/,
					"",
				)
			: "",
		text: link.displayText && restoreSite(link.displayText),
		why: messages.length
			? messages.join(", ")
			: invalid
				? describeInvalidLink(restoreSite(link.url))
				: describeStatus(link),
	};
}

function describeInvalidLink(url: string) {
	const hash = /#.*/s.exec(url)?.[0] ?? "";

	return safeDecode(hash) === undefined
		? "Fragment has a % that isn't part of an escape, so a literal % should be written as %25"
		: "Invalid URL";
}

function describeStatus(link: LinkResult) {
	const pathname = URL.parse(link.url)?.pathname ?? "";

	if (link.status === 404) {
		if (pathname.includes("//")) {
			return "Path has an empty segment (//), which doesn't match a file in the build";
		}

		if (safeDecode(pathname) === undefined) {
			return "Path has a % that isn't part of an escape, so a literal % should be written as %25";
		}
	}

	return `HTTP ${String(link.status)}`;
}

async function findBrokenLinks({
	base,
	directory,
	hosts,
	ignore,
	origin,
}: {
	base: string;
	directory: string;
	hosts: Set<string>;
	ignore: (RegExp | string)[];
	origin: string | undefined;
}) {
	const files = await listFiles(directory);
	const prefix = new URL(base.replace(/\/*$/, "/"), "http://localhost")
		.pathname;
	const server = await serveBuild({ base, directory, files, hosts, prefix });

	try {
		const address = server.address();
		if (!address || typeof address === "string") {
			throw new Error("Could not start a local server for the build.");
		}

		const local = `http://127.0.0.1:${String(address.port)}`;

		// Starting from every page and stylesheet also checks ones nothing links to
		const path = files
			.filter((file) => /\.(?:css|html)$/.test(file))
			.map((file) => {
				const url = new URL(local);
				url.pathname =
					prefix +
					file.replace(/(?:^|(?<=\/))index\.html$/, "").replaceAll("%", "%25");
				return url.href;
			});

		if (!path.length) {
			return { broken: [], checked: 0 };
		}

		const result = await withoutProxyForLocalhost(() =>
			new LinkChecker().check({
				checkCss: true,
				checkFragments: true,
				// Text fragments, like #:~:text=hello, match text rather than only ids
				fragmentsToSkip: (fragment) =>
					Promise.resolve(fragment.includes(":~:")),
				// External links are out of scope, and would make builds depend on other sites
				linksToSkip: (link) => Promise.resolve(shouldSkip(link, local)),
				path,
			}),
		);

		// Links that can't be parsed are reported once per time they appear
		const broken = new Map<string, BrokenLink>();
		for (const link of result.links) {
			if (link.state === LinkState.BROKEN && !isUnparsedExternal(link, local)) {
				const described = describeBrokenLink(link, local, origin);
				const key = JSON.stringify([described.page, described.link]);
				const existing = broken.get(key);
				broken.set(key, {
					...described,
					text: existing?.text ?? described.text,
				});
			}
		}

		return {
			broken: [...broken.values()].sort(
				(a, b) => a.page.localeCompare(b.page) || a.link.localeCompare(b.link),
			),
			checked: result.links.filter((link) => link.state === LinkState.OK)
				.length,
		};
	} finally {
		server.closeAllConnections();
		server.close();
	}

	function shouldSkip(link: string, local: string) {
		const url = URL.parse(link);
		if (!url) {
			return false;
		}

		if (url.origin !== local) {
			return true;
		}

		const paths = [url.pathname, safeDecode(url.pathname) ?? url.pathname];

		return ignore.some((pattern) =>
			paths.some((path) => {
				if (typeof pattern === "string") {
					return path.startsWith(pattern);
				}

				// Global and sticky expressions would otherwise test from their last match
				pattern.lastIndex = 0;
				return pattern.test(path);
			}),
		);
	}
}

/**
 * Finds links to other sites that linkinator reports anyway, because it
 * couldn't decode their fragments before skipping them.
 */
function isUnparsedExternal(link: LinkResult, local: string) {
	const url = URL.parse(link.url.replace(/#.*/s, ""), link.parent);

	return (
		!link.status &&
		!link.failureDetails?.length &&
		url !== null &&
		url.origin !== local
	);
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

	const segments = pathname
		.slice(prefix.length)
		.split("/")
		.map((segment) => safeDecode(segment));

	// Empty segments, encoded slashes, and invalid escapes don't match files
	if (
		segments.slice(0, -1).includes("") ||
		segments.some((segment) => segment === undefined || segment.includes("/"))
	) {
		return undefined;
	}

	const path = segments.join("/");

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

function safeDecode(text: string) {
	try {
		return decodeURIComponent(text);
	} catch {
		return undefined;
	}
}

// Serves the build under its base path, much like static hosts do
async function serveBuild({
	base,
	directory,
	files,
	hosts,
	prefix,
}: {
	base: string;
	directory: string;
	files: string[];
	hosts: Set<string>;
	prefix: string;
}) {
	const known = new Set(files);
	let rewrite = (text: string) => text;

	const server = createServer((request, response) => {
		const [pathname = "/", query] = (request.url ?? "/").split(/\?(.*)/s);
		const resolved = resolveRequest(known, prefix, pathname);

		if (!resolved) {
			response.writeHead(404).end();
			return;
		}

		if ("redirect" in resolved) {
			response
				.writeHead(301, {
					location: resolved.redirect + (query ? `?${query}` : ""),
				})
				.end();
			return;
		}

		const headers = {
			"content-type":
				contentTypes[extname(resolved.file)] ?? "application/octet-stream",
		};

		if (request.method === "HEAD") {
			response.writeHead(200, headers).end();
			return;
		}

		readFile(join(directory, resolved.file)).then(
			(body) =>
				response
					.writeHead(200, headers)
					.end(
						/\.(?:css|html)$/.test(resolved.file)
							? rewrite(body.toString())
							: body,
					),
			() => response.writeHead(500).end(),
		);
	});

	server.listen(0, "127.0.0.1");
	await once(server, "listening");

	const address = server.address();
	if (address && typeof address !== "string") {
		rewrite = createSiteRewriter(
			hosts,
			base,
			prefix,
			`http://127.0.0.1:${String(address.port)}`,
		);
	}

	return server;
}

// linkinator reports pages by their full local URL, like http://127.0.0.1:1234/blog/my-post/
function toSitePath(url: string, local: string) {
	if (!url.startsWith(`${local}/`)) {
		return url;
	}

	const path = url.slice(local.length);

	// Show characters such as spaces as written, but keep escapes like %2F and %25
	try {
		return decodeURI(path.replaceAll("%25", "%2525"));
	} catch {
		return path;
	}
}

/**
 * Runs linkinator without any proxy from the environment for its requests to
 * the local server, which a proxy couldn't reach.
 */
async function withoutProxyForLocalhost<T>(run: () => Promise<T>) {
	const original = {
		NO_PROXY: process.env.NO_PROXY,
		no_proxy: process.env.no_proxy,
	};

	for (const [key, value] of Object.entries(original)) {
		process.env[key] = value ? `${value},127.0.0.1` : "127.0.0.1";
	}

	resetSharedAgents();

	try {
		return await run();
	} finally {
		for (const [key, value] of Object.entries(original)) {
			if (value === undefined) {
				Reflect.deleteProperty(process.env, key);
			} else {
				process.env[key] = value;
			}
		}

		resetSharedAgents();
	}
}
