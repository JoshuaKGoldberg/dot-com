/*
 * Edge-only aurora scenery for the Focus & Ribbon wave. Nothing spans the page:
 * the aurora lives in a band at the very top edge and runs down the outer side
 * edges, small spruce stands grow from the bottom corners, and the footer carries
 * the treeline and lake. No masks, nothing painted in the page colour.
 */
import { createAurora } from "./aurora.js";
import { createFooter, spruce } from "./footer.js";
import { rng } from "../forest-kit/kit.js";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const isDark = () => document.documentElement.classList.contains("dark");

export function createEdge({ root, reducedMotion }, opt = {}) {
	const host = root.querySelector(".scenery-a") || root;
	const canvas = document.createElement("canvas");
	canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
	host.appendChild(canvas);
	const ctx = canvas.getContext("2d");
	const stands = document.createElement("canvas");
	const hint = document.createElement("div");
	hint.className = "fk-hint";
	hint.textContent = opt.hint || "Move the pointer";
	hint.style.cssText = "position:absolute;left:16px;bottom:16px;z-index:5;font:600 11px/1.2 system-ui,sans-serif;padding:8px 12px;border-radius:14px;background:color-mix(in srgb,var(--siteBg) 80%,transparent);color:var(--siteFgStrong);pointer-events:none;max-width:200px;transition:opacity .6s";
	root.appendChild(hint);
	const foot = createFooter(root, { reducedMotion, ...opt.footer });

	let dark = isDark(), w = 0, h = 0, aur = null, raf = 0, last = 0, dead = false, hidden = false;
	let scrollK = 1, endFade = 0, hinted = false, standsDirty = true;
	const pointer = { x: -1e4, y: -1e4, active: false };
	const state = { pointer, reduced: !!reducedMotion };
	const cleanups = [];
	const on = (t, e, fn, o) => { t.addEventListener(e, fn, o); cleanups.push(() => t.removeEventListener(e, fn, o)); };

	function marginLeft() {
		const pg = root.querySelector(".site-page");
		if (!pg) return 0;
		return pg.getBoundingClientRect().left - root.getBoundingClientRect().left;
	}
	function paintStands() {
		standsDirty = false;
		stands.width = w; stands.height = h;
		const c = stands.getContext("2d");
		c.clearRect(0, 0, w, h);
		const m = marginLeft();
		const maxD = Math.min(210, m - 10);
		if (maxD < 40) return;
		const rand = rng(opt.seed || 7);
		const cols = dark ? ["#0b1330", "#050a1a"] : ["#4a7d78", "#264f4a"];
		for (const side of [-1, 1]) {
			for (let row = 0; row < 2; row++) {
				c.fillStyle = cols[row];
				const n = row === 0 ? 7 : 6;
				for (let i = 0; i < n; i++) {
					const d = Math.pow(rand(), 1.5) * maxD;
					const k = 1 - d / maxD;
					const th = h * (row === 0 ? 0.07 + 0.15 * k * (0.6 + rand() * 0.6) : 0.05 + 0.15 * k * (0.5 + rand() * 0.6));
					if (th < 24) continue;
					const x = side < 0 ? d : w - d;
					spruce(c, x, h + 6, th, rand);
				}
			}
		}
		// a few stars near the corners
		c.fillStyle = dark ? "rgba(225,232,255,.7)" : "rgba(255,255,255,0)";
		for (let i = 0; i < 46; i++) { const sd = rand() < 0.5 ? -1 : 1; const d = rand() * Math.min(m, 260); c.fillRect(sd < 0 ? d : w - d, rand() * h * 0.5, 1, 1); }
	}
	function resize() {
		const W = host.clientWidth, H = host.clientHeight;
		if (!W || !H) return;
		w = W; h = H;
		canvas.width = w; canvas.height = h;
		aur = createAurora({ ...opt.aurora, dark, shaped: true, alphaMode: true });
		aur.resize(w, h);
		aur.setMargin(marginLeft());
		aur.setScroll(scrollK);
		aur.update(0, state);
		foot.setAurora(aur);
		standsDirty = true;
		render();
	}
	function render() {
		if (!aur) return;
		ctx.clearRect(0, 0, w, h);
		if (standsDirty) paintStands();
		ctx.globalAlpha = 1 - endFade;
		ctx.drawImage(stands, 0, 0);
		ctx.globalAlpha = 1;
		aur.draw(ctx, 0, 0, w, aur.height, 1, 0, aur.height);
	}
	function onScroll() {
		scrollK = 1 - smooth(root.scrollTop / 400);
		const dEnd = root.scrollHeight - root.clientHeight - root.scrollTop;
		endFade = smooth((650 - dEnd) / 300);
		aur?.setScroll(scrollK);
		if (state.reduced) render();
	}
	function frame(now) {
		raf = 0;
		if (dead || hidden) return;
		const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
		last = now;
		aur.update(dt, state);
		if (aur.needsRender() || endFade > 0 || true) render();
		if (!state.reduced) raf = requestAnimationFrame(frame);
	}
	on(window, "pointermove", (e) => {
		pointer.x = e.clientX - canvas.getBoundingClientRect().left; pointer.y = e.clientY - canvas.getBoundingClientRect().top; pointer.active = true;
		if (!hinted) { hinted = true; hint.style.opacity = "0"; }
		if (state.reduced) { aur.update(1, state); render(); }
	}, { passive: true });
	on(document.documentElement, "pointerleave", () => { pointer.active = false; });
	on(root, "scroll", onScroll, { passive: true });
	on(document, "visibilitychange", () => { hidden = document.hidden; if (!hidden && !raf && !state.reduced) { last = performance.now(); raf = requestAnimationFrame(frame); } });
	const ro = new ResizeObserver(() => resize());
	ro.observe(host);
	const unwatchMo = new MutationObserver(() => {
		const d = isDark();
		if (d !== dark) { dark = d; foot.setDark(d); resize(); }
	});
	unwatchMo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	resize();
	onScroll();
	if (!state.reduced) { last = performance.now(); raf = requestAnimationFrame(frame); }

	return () => {
		dead = true; cancelAnimationFrame(raf); cleanups.forEach((f) => f());
		ro.disconnect(); unwatchMo.disconnect(); foot.destroy(); canvas.remove(); hint.remove();
	};
}
