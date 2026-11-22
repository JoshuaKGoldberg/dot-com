/*
 * Edge-only scenery for the #324-331 ribbon themes. Nothing spans the page:
 *  - a ribbon aurora hugging the top edge, brightest in the corners and running
 *    partway down the side edges, fading out within ~400px of scroll;
 *  - two short spruce stands anchored to the bottom-left / bottom-right corners;
 *  - a spruce-and-lake footer (footer.js) that mirrors the live aurora.
 * No masks, no cover layers, nothing painted over the content column.
 */
import { createAurora } from "./aurora.js";
import { createFooter, spruceStand } from "./footer.js";
import { addHint, isDark, watchDark } from "../forest-kit/kit.js";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function createEdges({ root, reducedMotion }, opt) {
	const host = root.querySelector(".scenery-a");
	const page = root.querySelector(".site-page");
	const hint = addHint(root, opt.hint || "Move the pointer to bend the ribbon");
	let dark = isDark();
	let dead = false, raf = 0, last = 0, footerVisible = false, scrollFade = 1, pointerSeen = false;
	const reduced = !!reducedMotion;
	const pointer = { x: -1e4, y: -1e4, active: false };
	const state = { reduced, pointer };

	const aur = createAurora({ ...opt.aurora, dark, alphaDark: true, rest: opt.aurora.rest || [0.86, 0.04] });
	const low = aur.low;
	low.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;will-change:opacity;transform:translateZ(0)";
	low.setAttribute("aria-hidden", "true");
	host.appendChild(low);

	// side stands
	const stands = ["l", "r"].map((side) => {
		const c = document.createElement("canvas");
		c.setAttribute("aria-hidden", "true");
		c.style.cssText = `position:absolute;bottom:0;${side === "l" ? "left" : "right"}:0;pointer-events:none;transition:opacity .5s ease`;
		host.appendChild(c);
		return { c, side };
	});

	function layout() {
		const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
		aur.resize(w, h);
		low.style.width = low.width * opt.aurora.scale + "px";
		low.style.height = low.height * opt.aurora.scale + "px";
		const textLeft = page ? page.getBoundingClientRect().left + 24 : 0;
		const sw = clamp(textLeft - 6, 0, 250);
		const dpr = Math.min(1.5, window.devicePixelRatio || 1);
		const sh = Math.round(h * (opt.standHeight || 0.22));
		stands.forEach(({ c, side }, i) => {
			c.style.display = sw < 50 ? "none" : "block";
			if (sw < 50) return;
			c.style.width = sw + "px"; c.style.height = sh + "px";
			c.width = Math.round(sw * dpr); c.height = Math.round(sh * dpr);
			const x = c.getContext("2d");
			x.setTransform(dpr, 0, 0, dpr, 0, 0);
			x.clearRect(0, 0, sw, sh);
			if (side === "r") { x.translate(sw, 0); x.scale(-1, 1); }
			spruceStand(x, sw, sh, { dark, seed: (opt.seed || 3) + i * 17, density: opt.standDensity || 1 });
		});
		aur.update(0, state);
		aur.tick();
	}

	const footer = createFooter(root, { ...opt.footer, getAurora: () => aur, isDark: () => dark, reducedMotion: reduced, onVisible: (v) => { footerVisible = v; stands.forEach((s) => (s.c.style.opacity = v ? "0" : "1")); wake(); } });

	function applyDark() {
		aur.setDark(dark);
	}

	function frame(now) {
		raf = 0;
		if (dead) return;
		const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
		last = now;
		if (!document.hidden && (scrollFade > 0.01 || footerVisible)) {
			aur.update(dt, state);
			aur.tick();
		}
		if (!reduced) raf = requestAnimationFrame(frame);
	}
	function wake() { if (!raf && !reduced && !dead) { last = performance.now(); raf = requestAnimationFrame(frame); } }

	const on = (t, e, f, o) => { t.addEventListener(e, f, o); cleanups.push(() => t.removeEventListener(e, f, o)); };
	const cleanups = [];
	on(window, "pointermove", (e) => {
		pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
		if (!pointerSeen) { pointerSeen = true; hint.hide(); }
		if (reduced) { aur.update(0.016, state); if (scrollFade > 0.01) aur.tick(); }
	}, { passive: true });
	on(document.documentElement, "pointerleave", () => { pointer.active = false; });
	on(root, "scroll", () => {
		scrollFade = clamp(1 - root.scrollTop / 400);
		low.style.opacity = scrollFade.toFixed(3);
		low.style.visibility = scrollFade < 0.01 ? "hidden" : "visible";
		if (scrollFade > 0.01) wake();
	}, { passive: true });
	let rt = 0;
	on(window, "resize", () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
	on(document, "visibilitychange", () => { if (!document.hidden) wake(); });
	const unwatch = watchDark((d) => { dark = d; applyDark(); footer?.setDark(d); layout(); });

	applyDark();
	layout();
	wake();

	return () => {
		dead = true; cancelAnimationFrame(raf); clearTimeout(rt); unwatch();
		cleanups.forEach((f) => f());
		footer?.destroy(); low.remove(); stands.forEach((s) => s.c.remove());
	};
}
