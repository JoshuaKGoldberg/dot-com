/* Wave 14 shared helpers: pointer velocity, a sleeping fixed-timestep loop, margin geometry, link squiggle engine. */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Window-level pointer with smoothed velocity (px/s). Coordinates are client coords. */
export function pointerV(d, onMove) {
	const p = { x: -999, y: -999, vx: 0, vy: 0, has: false, speed: 0 };
	let t0 = 0;
	d.on(window, "pointermove", (e) => {
		const now = performance.now();
		if (p.has && t0) {
			const dt = Math.max(0.008, (now - t0) / 1000);
			p.vx = p.vx * 0.45 + ((e.clientX - p.x) / dt) * 0.55;
			p.vy = p.vy * 0.45 + ((e.clientY - p.y) / dt) * 0.55;
		}
		t0 = now;
		p.x = e.clientX; p.y = e.clientY; p.has = true;
		p.speed = Math.hypot(p.vx, p.vy);
		onMove?.(p);
	}, { passive: true });
	d.on(document, "pointerleave", () => { p.has = false; onMove?.(p); });
	/** Call once per sim step: velocity relaxes when the pointer stops reporting. */
	p.relax = (dt) => {
		const k = Math.exp(-dt * 7);
		p.vx *= k; p.vy *= k;
		if (Math.abs(p.vx) < 1) p.vx = 0;
		if (Math.abs(p.vy) < 1) p.vy = 0;
		p.speed = Math.hypot(p.vx, p.vy);
	};
	return p;
}

/** Fixed-timestep rAF loop that sleeps: step(h) returns true while still busy. draw() runs at ~fps. */
export function simLoop(d, { step, draw, fps = 30, h = 1 / 60 }) {
	let raf = 0, last = 0, acc = 0, lastDraw = 0, awake = false;
	const frame = (now) => {
		raf = 0;
		if (!awake || document.hidden) return;
		const dt = Math.min(0.1, (now - (last || now - 16)) / 1000);
		last = now; acc += dt;
		let busy = false, n = 0;
		while (acc >= h && n < 6) { busy = step(h) || busy; acc -= h; n++; }
		if (!n) busy = true;
		if (now - lastDraw >= 1000 / fps - 2 || !busy) { lastDraw = now; draw(); }
		if (busy) raf = requestAnimationFrame(frame);
		else { awake = false; last = 0; acc = 0; }
	};
	const api = {
		wake() { awake = true; if (!raf && !document.hidden) raf = requestAnimationFrame(frame); },
		stop() { awake = false; cancelAnimationFrame(raf); raf = 0; },
	};
	d.on(document, "visibilitychange", () => { if (!document.hidden && awake && !raf) { last = 0; raf = requestAnimationFrame(frame); } });
	d.add(api.stop);
	return api;
}

/** Side-margin strips of the fixed scenery host: the area outside the ~52rem column. */
export function marginStrips(host, maxW = 300) {
	const W = host.clientWidth, H = host.clientHeight;
	const half = 26 * 16 + 24;
	const side = (W - half * 2) / 2;
	if (side < 70) return { W, H, strips: [] };
	const w = Math.min(maxW, side - 6);
	return { W, H, strips: [{ x0: 4, w, side: -1 }, { x0: W - 4 - w, w, side: 1 }] };
}

export function mountCanvas(host, cls, d) {
	const c = document.createElement("canvas");
	c.className = `dl-cv ${cls}`;
	host.append(c);
	d.add(() => c.remove());
	return c;
}

/** Calls fn after the host resizes (debounced). */
export function onResize(host, fn, d) {
	let t = 0, first = true;
	const ro = new ResizeObserver(() => { if (first) { first = false; return; } clearTimeout(t); t = setTimeout(fn, 140); });
	ro.observe(host);
	d.add(() => { ro.disconnect(); clearTimeout(t); });
}

/**
 * Link squiggle engine. Tracks the pointer against every .site-link and calls
 * theme.step(st, dt, f) per link while it is lit or still settling. f = { near, inside, fx, px, w, h, t }.
 * theme.step returns true while the link still needs frames. theme.clear(link, st) resets on teardown.
 */
export function squiggleEngine(root, d, theme, { radius = 0, reducedMotion = false } = {}) {
	const links = [...root.querySelectorAll(".site-link")];
	const states = links.map((a) => ({ a }));
	theme.init?.(states);
	const p = { x: 0, y: 0, has: false };
	let raf = 0, last = 0, t = 0, moved = false;
	const frame = (now) => {
		raf = 0;
		const dt = Math.min(0.08, last ? (now - last) / 1000 : 0.016);
		last = now; t += dt;
		let busy = false;
		for (const st of states) {
			let near = 0, inside = false, fx = 0.5, px = 0, w = 0, h = 0;
			if (moved || st.busy || st.live) {
				const b = st.a.getBoundingClientRect();
				w = b.width; h = b.height;
				if (p.has && b.bottom > -40 && b.top < innerHeight + 40) {
					const cx = clamp(p.x, b.left, b.right), cy = clamp(p.y, b.top, b.bottom + 6);
					const dist = Math.hypot(p.x - cx, p.y - cy);
					inside = dist < 1;
					near = radius ? clamp(1 - dist / radius) : (inside ? 1 : 0);
					fx = clamp((p.x - b.left) / Math.max(1, w));
					px = p.x - b.left;
				}
			}
			if (!(moved || st.busy || st.live || near)) continue;
			const b2 = theme.step(st, dt, { near, inside, fx, px, w, h, t });
			st.busy = !!b2;
			busy = busy || st.busy;
		}
		moved = false;
		if (busy) raf = requestAnimationFrame(frame);
		else last = 0;
	};
	const wake = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); };
	d.on(window, "pointermove", (e) => { p.x = e.clientX; p.y = e.clientY; p.has = true; moved = true; wake(); }, { passive: true });
	d.on(root, "scroll", () => { if (p.has) { moved = true; wake(); } }, { passive: true });
	d.on(document, "pointerleave", () => { p.has = false; moved = true; wake(); });
	d.add(() => { cancelAnimationFrame(raf); for (const st of states) theme.clear?.(st); });
	return { states, wake };
}
