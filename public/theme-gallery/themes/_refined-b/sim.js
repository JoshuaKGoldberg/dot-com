/*
 * Shared stage for the refined-aurora physics themes: two margin canvases (left/right),
 * pointer position + velocity tracking, a fixed-timestep loop that sleeps at rest,
 * dark-mode tracking, and visibility handling.
 */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const isDark = () => document.documentElement.classList.contains("dark");

const STOPS = {
	dark: [[84, 250, 168], [58, 218, 214], [104, 150, 255], [184, 112, 255]],
	light: [[28, 176, 126], [38, 160, 200], [92, 116, 226], [152, 92, 214]],
};
/** Aurora colour ramp, t in 0..1 -> [r,g,b]. */
export function aurora(t, dark) {
	const s = STOPS[dark ? "dark" : "light"];
	const f = clamp(t) * (s.length - 1), k = Math.min(s.length - 2, Math.floor(f)), u = f - k;
	return [lerp(s[k][0], s[k + 1][0], u) | 0, lerp(s[k][1], s[k + 1][1], u) | 0, lerp(s[k][2], s[k + 1][2], u) | 0];
}
export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export const DT = 1 / 60;

/**
 * opts: root, host, reducedMotion, reach (px of pointer influence beyond a margin),
 *  resize(stage), step(stage) -> true while active, draw(stage), idleFps (0 = sleep at rest),
 *  breathe (CSS opacity breathing while at rest)
 */
export function createStage({ root, host, reducedMotion, reach = 140, minMargin = 64, resize, step, draw, idleFps = 0, breathe = true }) {
	const st = {
		w: 1, h: 1, mw: 0, dark: isDark(), reduced: !!reducedMotion, dpr: 1, time: 0, frame: 0,
		sides: [], ptr: { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0, inside: false, moved: false },
		active: true,
	};
	const wrap = document.createElement("div");
	Object.assign(wrap.style, { position: "absolute", inset: "0", pointerEvents: "none", contain: "paint" });
	if (breathe && !st.reduced) wrap.style.animation = "rb-breathe 9s ease-in-out infinite";
	host.appendChild(wrap);
	const style = document.createElement("style");
	style.textContent = "@keyframes rb-breathe{0%,100%{opacity:.82}50%{opacity:1}}";
	wrap.appendChild(style);
	for (const side of ["l", "r"]) {
		const canvas = document.createElement("canvas");
		Object.assign(canvas.style, { position: "absolute", top: "0", [side === "l" ? "left" : "right"]: "0", pointerEvents: "none" });
		wrap.appendChild(canvas);
		st.sides.push({ side, canvas, ctx: canvas.getContext("2d"), w: 0, h: 0, x0: 0, sign: side === "l" ? 1 : -1 });
	}
	let raf = 0, last = 0, acc = 0, alive = true, lastDraw = 0, lastMoveT = 0;

	function layout() {
		const r = root.getBoundingClientRect();
		const rem = parseFloat(getComputedStyle(root).fontSize) || 16;
		st.w = r.width; st.h = r.height;
		st.mw = Math.max(0, Math.floor((r.width - 52 * rem) / 2));
		st.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		const show = st.mw >= minMargin;
		for (const s of st.sides) {
			s.canvas.style.display = show ? "block" : "none";
			s.w = show ? st.mw : 0; s.h = Math.round(st.h);
			s.x0 = s.side === "l" ? 0 : st.w - st.mw;
			s.canvas.style.width = s.w + "px"; s.canvas.style.height = s.h + "px";
			s.canvas.width = Math.max(1, Math.round(s.w * st.dpr)); s.canvas.height = Math.max(1, Math.round(s.h * st.dpr));
			s.ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
		}
		st.show = show;
		resize?.(st);
		wake(true);
	}
	/** Pointer in a side's local coordinates. Right side mirrors x so (0,*) is the outer edge on both. */
	st.local = (s) => {
		const x = st.ptr.x - s.x0;
		return { x: s.side === "l" ? x : s.w - x, y: st.ptr.y };
	};
	st.nearMargin = () => {
		const p = st.ptr;
		return p.x < st.mw + reach || p.x > st.w - st.mw - reach;
	};
	function frame(now) {
		raf = 0;
		if (!alive || document.hidden || !st.show) return;
		let dt = Math.min(0.1, (now - last) / 1000 || DT);
		last = now;
		// pointer velocity decays when no move events arrive
		const p = st.ptr;
		const since = now - lastMoveT;
		if (since > 40) { const k = Math.exp(-dt * 12); p.vx *= k; p.vy *= k; }
		p.speed = Math.hypot(p.vx, p.vy);
		acc += dt;
		let active = false, n = 0;
		while (acc >= DT && n < 4) { active = step(st, DT) || active; st.time += DT; acc -= DT; n++; }
		if (n === 4) acc = 0;
		if (n === 0) active = st.active;
		st.active = active;
		const idle = !active && idleFps > 0 && !st.reduced;
		if (!idle || now - lastDraw >= 1000 / idleFps - 2 || st.dirty) { draw(st); lastDraw = now; st.dirty = false; st.frame++; }
		if (active || idle || p.speed > 2) raf = requestAnimationFrame(frame);
	}
	function wake(forceDraw) {
		if (forceDraw) st.dirty = true;
		if (!raf && alive && !document.hidden && st.show) { last = performance.now(); raf = requestAnimationFrame(frame); }
	}
	st.wake = wake;
	const onMove = (e) => {
		const r = root.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
		const p = st.ptr;
		if (p.moved) {
			const dt = Math.max(8, now - lastMoveT) / 1000;
			const vx = (x - p.x) / dt, vy = (y - p.y) / dt;
			// light smoothing keeps flicks distinct from slow passes
			p.vx = lerp(p.vx, vx, 0.6); p.vy = lerp(p.vy, vy, 0.6);
		}
		p.x = x; p.y = y; p.moved = true; lastMoveT = now;
		p.inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
		if (st.nearMargin()) wake();
	};
	const onLeave = () => { st.ptr.x = st.ptr.y = -9999; st.ptr.moved = false; st.ptr.inside = false; };
	const onVis = () => { if (!document.hidden) wake(true); else if (raf) { cancelAnimationFrame(raf); raf = 0; } };
	const mo = new MutationObserver(() => { const d = isDark(); if (d !== st.dark) { st.dark = d; st.onMode?.(st); wake(true); } });
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	const ro = new ResizeObserver(layout);
	ro.observe(root);
	addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerleave", onLeave);
	document.addEventListener("visibilitychange", onVis);
	layout();
	if (st.reduced) { st.dirty = true; draw(st); }
	return {
		st,
		destroy() {
			alive = false; cancelAnimationFrame(raf);
			removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerleave", onLeave);
			document.removeEventListener("visibilitychange", onVis);
			mo.disconnect(); ro.disconnect();
			wrap.remove();
		},
	};
}
