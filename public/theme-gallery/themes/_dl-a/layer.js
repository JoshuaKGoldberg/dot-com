/* A viewport-sized canvas in .scenery-c plus margin geometry, shared by the delighters. */
import { clamp } from "../_quiet-d/kit.js";
export { clamp };
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const COLUMN_HALF = 26 * 16 + 24; // the 52rem column plus air

export function reducedNow(reducedMotion) {
	return !!reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");
}

export function makeLayer(root, d, onResize) {
	const host = root.querySelector(".scenery-c");
	if (!host) return null;
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	Object.assign(canvas.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", pointerEvents: "none" });
	host.appendChild(canvas);
	const ctx = canvas.getContext("2d");
	const L = { canvas, ctx, w: 0, h: 0, dpr: 1, ox: 0, oy: 0, side: 0 };
	const fit = () => {
		const r = host.getBoundingClientRect();
		L.w = r.width; L.h = r.height; L.ox = r.left; L.oy = r.top;
		L.dpr = Math.min(1.5, devicePixelRatio || 1);
		canvas.width = Math.max(1, Math.round(L.w * L.dpr)); canvas.height = Math.max(1, Math.round(L.h * L.dpr));
		L.side = (L.w - COLUMN_HALF * 2) / 2;
		onResize?.(L);
	};
	const ro = new ResizeObserver(fit);
	ro.observe(host);
	fit();
	d.add(() => { ro.disconnect(); canvas.remove(); });
	L.clear = () => { ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0); ctx.clearRect(0, 0, L.w, L.h); };
	/** random x inside a margin (null when margins are too thin) */
	L.marginX = (rnd, pad = 14) => {
		if (L.side < 48) return null;
		const x = pad + rnd() * (L.side - pad * 2);
		return rnd() < 0.5 ? x : L.w - x;
	};
	/** pushes an x position out of the content column (soft) */
	L.inColumn = (x) => x > L.side - 6 && x < L.w - L.side + 6;
	return L;
}

/** rAF loop at <= fps that sleeps when step() returns false and pauses when hidden. */
export function sleepyLoop(step, { fps = 60, d }) {
	let raf = 0, last = 0, want = false, dead = false;
	const frame = (now) => {
		raf = 0;
		if (!want || dead || document.hidden) return;
		const dt = Math.min(0.1, (now - (last || now - 16)) / 1000);
		if (now - last >= 1000 / fps - 2) {
			last = now;
			want = !!step(dt);
			if (!want) { last = 0; return; }
		}
		raf = requestAnimationFrame(frame);
	};
	const wake = () => { want = true; if (!raf && !document.hidden && !dead) { last = 0; raf = requestAnimationFrame(frame); } };
	const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (want) wake(); };
	document.addEventListener("visibilitychange", onVis);
	d.add(() => { dead = true; cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); });
	return { wake };
}

/** Window pointer with velocity (px/s, smoothed). */
export function pointerV(d, onMove) {
	const p = { x: -999, y: -999, vx: 0, vy: 0, has: false, t: 0, speed: 0 };
	let lt = 0;
	const move = (e) => {
		const now = performance.now();
		if (p.has && now > lt) {
			const dt = Math.max(0.008, (now - lt) / 1000);
			const k = 0.5;
			p.vx += ((e.clientX - p.x) / dt - p.vx) * k; p.vy += ((e.clientY - p.y) / dt - p.vy) * k;
		}
		lt = now; p.x = e.clientX; p.y = e.clientY; p.has = true; p.t = now;
		p.speed = Math.hypot(p.vx, p.vy);
		onMove?.(p);
	};
	const leave = () => { p.has = false; p.vx = p.vy = 0; p.speed = 0; onMove?.(p); };
	d.on(window, "pointermove", move, { passive: true });
	d.on(document.documentElement, "pointerleave", leave);
	/** decays the velocity when the pointer stops */
	p.settle = (dt) => { const k = Math.exp(-dt * 8); p.vx *= k; p.vy *= k; p.speed = Math.hypot(p.vx, p.vy); };
	return p;
}
