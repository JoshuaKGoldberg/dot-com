// Shared helper for the t2-* typography themes (#409-428): hero copy via _type/with-type.js, plus the sample blog post
// injected after .site-about and before the first .site-section. Mutates `root` only (the gallery restores it pristine).
import { withType } from "../_type/with-type.js";

export const POST = {
	title: "If I Wrote a Linter, Part 4: Summary",
	meta: "June 10, 2025 · 5 minute read",
	html: [
		"Over the last three posts I’ve sketched what a linter built today could look like: one that treats type information as a first-class input rather than an expensive add-on, runs rules in parallel by default, and reports problems in the same vocabulary developers already use in their editors.",
		"None of these ideas are new on their own. What’s changed is that the pieces finally fit together: native-speed parsers, a TypeScript compiler being ported to Go, and a generation of developers who expect <code>--fix</code> to just work. The hard part isn’t writing a <em>faster</em> linter; it’s keeping one fast once real projects with real configs show up.",
		"If you’ve ever silenced a lint rule because it was slow, noisy, or wrong, I’d love to hear about it. Those moments are the best signal we have for what a better tool should do, and they’re why <a class=\"site-link\" href=\"https://github.com/flint-fyi/flint\">Flint</a> exists as a prototype instead of a manifesto.",
	],
};

const MOTION_KEY = "vs-motion"; // "play" | "pause": the site's own prefers-reduced-motion override (separate from the gallery's M key)
const HEART = '<svg aria-hidden="true" class="t2-heart" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"><path d="M12 20.6C5.2 15.4 3 12.2 3 9a4.6 4.6 0 0 1 9-1.3A4.6 4.6 0 0 1 21 9c0 3.2-2.2 6.4-9 11.6z"/></svg>';
const MOTION_ICON =
	'<svg aria-hidden="true" class="t2-motion-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">' +
	'<g class="t2-g-pause"><path d="M8.5 5.5v13M15.5 5.5v13"/></g><g class="t2-g-play"><path d="M7.5 5.2l11 6.8-11 6.8z"/></g></svg>';

function readPaused(ctx) {
	let saved = null;
	try { saved = localStorage.getItem(MOTION_KEY); } catch { /* storage blocked */ }
	if (saved === "pause") return true;
	if (saved === "play") return false;
	return !!ctx.reducedMotion || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function withPost(baseActivate, opts = {}) {
	const inner = withType(baseActivate, opts);
	return function activate(ctx) {
		const { root } = ctx;
		const about = root.querySelector(".site-about");
		const article = document.createElement("article");
		article.className = "t2-post";
		article.innerHTML =
			`<h2 class="t2-post-title">${POST.title}</h2>` +
			`<p class="t2-post-meta">${POST.meta}</p>` +
			POST.html.map((p) => `<p>${p}</p>`).join("");
		if (about) about.after(article);
		else root.querySelector(".site-section")?.before(article);
		if (!opts.motionControl) return inner(ctx);

		// the footer's blue-heart emoji becomes a thin outline heart (one word, "love", for screen readers)
		const heart = root.querySelector(".site-heart");
		if (heart) { heart.setAttribute("role", "img"); heart.setAttribute("aria-label", "love"); heart.innerHTML = HEART; }

		// play / pause: the base theme is torn down and re-activated with reducedMotion toggled; the pristine markup is restored in between
		const snapshot = root.innerHTML;
		let paused = readPaused(ctx);
		let cleanup = null;
		const mount = () => {
			root.dataset.motion = paused ? "pause" : "play"; // always resolved (stored choice, else the OS default); CSS keys off this, not the media query
			const header = root.querySelector(".site-header");
			const anchor = header?.querySelector(".site-theme-toggle");
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "t2-motion-toggle";
			btn.innerHTML = MOTION_ICON;
			const sync = () => {
				btn.setAttribute("aria-pressed", String(paused));
				btn.setAttribute("aria-label", paused ? "Play animations" : "Pause animations");
				btn.dataset.state = paused ? "paused" : "playing";
			};
			sync();
			btn.addEventListener("click", () => {
				paused = !paused;
				try { localStorage.setItem(MOTION_KEY, paused ? "pause" : "play"); } catch { /* storage blocked */ }
				const top = root.scrollTop;
				if (typeof cleanup === "function") cleanup();
				root.innerHTML = snapshot;
				mount();
				root.scrollTop = top;
				root.querySelector(".t2-motion-toggle")?.focus({ preventScroll: true });
			});
			if (anchor) anchor.after(btn); else header?.append(btn);
			cleanup = inner({ ...ctx, reducedMotion: paused });
		};
		mount();
		return () => { if (typeof cleanup === "function") cleanup(); };
	};
}
