/**
 * Serves files that aren't part of the Astro build from the FILES R2 bucket.
 * Cloudflare only runs this Worker for requests that don't match a built asset,
 * so anything in dist/ always takes precedence over the bucket.
 */

interface Env {
	FILES: R2Bucket;
}

export default {
	async fetch(request, env) {
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response(null, {
				headers: { allow: "GET, HEAD" },
				status: 405,
			});
		}

		const url = new URL(request.url);
		const key = toKey(url.pathname);
		if (key === undefined) {
			return notFound();
		}

		const object = await env.FILES.get(
			key === "" || key.endsWith("/") ? `${key}index.html` : key,
			{ onlyIf: request.headers },
		);
		if (object) {
			return toResponse(object, request.method);
		}

		// Like Apache, send /folder to /folder/ when the folder has an index.html
		if (!key.endsWith("/") && (await env.FILES.head(`${key}/index.html`))) {
			url.pathname += "/";
			return Response.redirect(url.toString(), 301);
		}

		return notFound();
	},
} satisfies ExportedHandler<Env>;

function notFound() {
	return new Response("Not Found", {
		headers: { "content-type": "text/plain;charset=UTF-8" },
		status: 404,
	});
}

function toKey(pathname: string) {
	try {
		return decodeURIComponent(pathname).slice(1);
	} catch {
		return undefined;
	}
}

function toResponse(object: R2Object | R2ObjectBody, method: string) {
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);

	// R2 leaves out the body when the request's If-None-Match etc. matched
	if (!("body" in object)) {
		return new Response(null, { headers, status: 304 });
	}

	return new Response(method === "HEAD" ? null : object.body, { headers });
}
