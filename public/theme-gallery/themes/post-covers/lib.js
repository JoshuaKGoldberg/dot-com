// Shared helpers for the data-art themes (146-155).
let dataPromise;
export function loadData() {
	dataPromise ??= fetch(new URL("./site-data.json", import.meta.url)).then((r) => r.json());
	return dataPromise;
}

export function hash(str) {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
	return h >>> 0;
}

export function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

/** Mounts a viewport-filling 2d canvas in a layer. dpr capped at 1.5. */
export function mountCanvas(layer, { maxDpr = 1.5 } = {}) {
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", pointerEvents: "none" });
	layer.append(canvas);
	const ctx = canvas.getContext("2d");
	const api = { canvas, ctx, w: 1, h: 1, dpr: 1 };
	api.fit = () => {
		const w = Math.max(2, layer.clientWidth);
		const h = Math.max(2, layer.clientHeight);
		const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		Object.assign(api, { w, h, dpr });
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};
	api.fit();
	return api;
}

/** Runs fn(dt, t) on rAF; pauses when hidden. Returns {stop, kick}. */
export function loop(fn) {
	let raf = 0, last = 0, stopped = false;
	const tick = (t) => {
		raf = 0;
		if (stopped || document.hidden) return;
		const dt = Math.min(0.05, (t - (last || t)) / 1000);
		last = t;
		if (fn(dt, t / 1000) === false) { last = 0; return; }
		raf = requestAnimationFrame(tick);
	};
	const kick = () => { if (!raf && !stopped && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
	const vis = () => kick();
	document.addEventListener("visibilitychange", vis);
	kick();
	return {
		kick,
		stop() { stopped = true; cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", vis); },
	};
}

/** Floating tooltip inside root's overlay. */
export function makeTip(root) {
	const tip = document.createElement("div");
	tip.className = "da-tip";
	tip.hidden = true;
	tip.setAttribute("aria-hidden", "true");
	const style = document.createElement("style");
	style.textContent = `.site .da-tip{position:fixed;z-index:40;pointer-events:none;max-width:19rem;padding:.55rem .75rem;border-radius:.6rem;font:500 .85rem/1.35 var(--siteFont);background:var(--siteBg);color:var(--siteFg);border:1px solid var(--siteSubtle);box-shadow:0 8px 28px rgba(0,0,0,.28)}.site .da-tip[hidden]{display:none}.site .da-tip b{display:block;color:var(--siteFgStrong);font-weight:700}.site .da-tip small{color:var(--siteMuted);font-size:.78rem}.site .da-tip i{display:block;font-style:normal}`;
	root.append(style, tip);
	return {
		el: tip,
		show(html, x, y) {
			tip.innerHTML = html;
			tip.hidden = false;
			const r = tip.getBoundingClientRect();
			let left = x + 14, top = y + 14;
			if (left + r.width > innerWidth - 8) left = x - r.width - 14;
			if (top + r.height > innerHeight - 8) top = y - r.height - 14;
			tip.style.left = left + "px";
			tip.style.top = top + "px";
		},
		hide() { tip.hidden = true; },
	};
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const dayOfYear = (iso) => {
	const d = new Date(iso + "T00:00:00Z");
	return (d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5;
};
