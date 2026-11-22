// _vs4/dwell.js: per-area dwell. Four areas (top header, left margin, right margin, footer) each carry a value 0..1 that
// climbs slowly (about `up` seconds) while the cursor stays near the area and decays just as slowly (`down`) when it leaves.
// Proximity is soft. Consumers map the eased value to a plain opacity (rest -> peak); nothing here touches filters.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (v) => v * v * (3 - 2 * v);

export function createDwell(root, { reduced, up = 6, down = 7 } = {}) {
	const AREAS = ["top", "left", "right", "foot"];
	const raw = { top: 0, left: 0, right: 0, foot: 0 }; // slow value
	const target = { top: 0, left: 0, right: 0, foot: 0 }; // instant soft proximity
	const v = { top: 0, left: 0, right: 0, foot: 0 }; // eased value handed to consumers
	const P = { x: -1e4, y: -1e4, has: false };
	const subs = new Set();
	let raf = 0, last = 0, dead = false;
	const footer = () => root.querySelector(".site-footer");
	function aim() {
		if (!P.has) { for (const k of AREAS) target[k] = 0; return; }
		const rr = root.getBoundingClientRect();
		const pr = root.querySelector(".site-page")?.getBoundingClientRect();
		const L = pr ? pr.left : rr.left + rr.width / 2 - 416, R = pr ? pr.right : rr.left + rr.width / 2 + 416;
		{ const q = clamp((P.y - rr.top - 140) / 170); target.top = 1 - q * q * (3 - 2 * q); } // only the top band (~0-310px) counts
		target.left = 1 - clamp((P.x - L) / 240);
		target.right = 1 - clamp((R - P.x) / 240);
		const fr = footer()?.getBoundingClientRect();
		if (fr) { const dy = P.y < fr.top ? fr.top - P.y : P.y > fr.bottom ? P.y - fr.bottom : 0; target.foot = 1 - clamp(dy / 260); }
	}
	function tick(now) {
		raf = 0;
		if (dead) return;
		const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016); last = now;
		aim();
		let busy = false;
		for (const k of AREAS) {
			const t = target[k];
			if (reduced) raw[k] = t;
			else if (raw[k] < t) raw[k] = Math.min(t, raw[k] + dt / up);
			else if (raw[k] > t) raw[k] = Math.max(t, raw[k] - dt / down);
			if (raw[k] !== t) busy = true;
			v[k] = ease(raw[k]);
		}
		for (const f of subs) f(v);
		if (busy && !document.hidden) raf = requestAnimationFrame(tick); else last = 0;
	}
	const wake = () => { if (!raf && !dead) raf = requestAnimationFrame(tick); };
	const onMove = (e) => { if (e.pointerType === "touch") return; P.x = e.clientX; P.y = e.clientY; P.has = true; wake(); };
	const onOut = (e) => { if (!e.relatedTarget) { P.has = false; wake(); } };
	const onScroll = () => { if (P.has) wake(); };
	const onVis = () => { if (!document.hidden) { last = 0; wake(); } };
	addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerout", onOut, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	root.addEventListener("scroll", onScroll, { passive: true });
	return {
		v, raw, target, P,
		sub(fn) { subs.add(fn); fn(v); return () => subs.delete(fn); },
		destroy() { dead = true; cancelAnimationFrame(raf); subs.clear(); removeEventListener("pointermove", onMove); document.removeEventListener("pointerout", onOut); document.removeEventListener("visibilitychange", onVis); root.removeEventListener("scroll", onScroll); },
	};
}
