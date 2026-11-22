// Shared helper for the ty-* typography themes (#386-400).
// Wraps gd-bloom's activate: rewrites the hero copy on `root` (which the gallery restores pristine before every
// activation), optionally adds preconnect hints for remote font hosts, then runs the base theme.
export const COPY = {
	title: "Hello. I’m Josh.",
	tagline: "I’m a serious TypeScript developer.",
};

export function withType(baseActivate, { title = COPY.title, tagline = COPY.tagline, preconnect = [] } = {}) {
	return function activate(ctx) {
		const { root } = ctx;
		const h1 = root.querySelector(".site-title");
		const p = root.querySelector(".site-tagline");
		if (h1) h1.innerHTML = title;
		if (p) p.innerHTML = tagline;

		// real apostrophes in the running text too (O'Reilly, I'm ...)
		for (const el of root.querySelectorAll(".site-about, .site-item-title, .site-item-description")) {
			const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) node.nodeValue = node.nodeValue.replace(/(\w)'(\w)/g, "$1\u2019$2");
		}

		// preconnect lives in <head>, outside root, so cleanup removes it
		const links = preconnect.map((origin) => {
			const link = document.createElement("link");
			link.rel = "preconnect";
			link.href = origin;
			link.crossOrigin = "";
			link.dataset.tyType = "";
			document.head.append(link);
			return link;
		});

		const cleanup = baseActivate(ctx);
		return () => {
			for (const link of links) link.remove();
			if (typeof cleanup === "function") cleanup();
		};
	};
}
