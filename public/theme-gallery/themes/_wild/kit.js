// Shared helpers for the 76-83 showpiece themes (WebGL canvas, loop, pointer, colour).

const colorCtx = document.createElement("canvas").getContext("2d");

/** Resolve any CSS colour (or var() value) to [r,g,b] in 0..1. */
export function parseColor(value) {
	colorCtx.fillStyle = "#000";
	colorCtx.fillStyle = String(value).trim();
	const s = colorCtx.fillStyle;
	if (s[0] === "#") {
		return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
	}
	const m = s.match(/[\d.]+/g) || [0, 0, 0];
	return [m[0] / 255, m[1] / 255, m[2] / 255];
}

export function siteColors(root) {
	const cs = getComputedStyle(root);
	const get = (name) => parseColor(cs.getPropertyValue(name));
	return {
		bg: get("--siteBg"),
		fg: get("--siteFg"),
		strong: get("--siteFgStrong"),
		muted: get("--siteMuted"),
		accent: get("--siteAccent"),
		squiggle: get("--siteSquiggle"),
		subtle: get("--siteSubtle"),
	};
}

/** Absolutely-filling canvas inside a layer. */
export function mountCanvas(layer, { scale = 1, maxDpr = 1.5, context = "webgl2", options = {}, maxPixels = 4e6 } = {}) {
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", pointerEvents: "none" });
	layer.append(canvas);
	const gl = canvas.getContext(context, { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "default", ...options });
	const api = { canvas, gl, width: 2, height: 2, cssW: 2, cssH: 2, dpr: 1 };
	api.fit = () => {
		const cssW = Math.max(2, layer.clientWidth);
		const cssH = Math.max(2, layer.clientHeight);
		let ratio = Math.min(window.devicePixelRatio || 1, maxDpr) * scale;
		ratio = Math.min(ratio, Math.sqrt(maxPixels / (cssW * cssH)));
		const w = Math.max(2, Math.round(cssW * ratio));
		const h = Math.max(2, Math.round(cssH * ratio));
		const changed = w !== canvas.width || h !== canvas.height;
		canvas.width = w;
		canvas.height = h;
		Object.assign(api, { width: w, height: h, cssW, cssH, dpr: ratio });
		if (gl && gl.viewport) gl.viewport(0, 0, w, h);
		return changed;
	};
	api.fit();
	api.destroy = () => {
		gl?.getExtension?.("WEBGL_lose_context")?.loseContext();
		canvas.remove();
	};
	return api;
}

export function compile(gl, type, src) {
	const sh = gl.createShader(type);
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(sh);
		gl.deleteShader(sh);
		throw new Error(log + "\n" + src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n"));
	}
	return sh;
}

export const FULLSCREEN_VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

/** Program with cached uniform locations: prog.set("name", ...values). */
export function program(gl, vs, fs) {
	const p = gl.createProgram();
	const v = compile(gl, gl.VERTEX_SHADER, vs);
	const f = compile(gl, gl.FRAGMENT_SHADER, fs);
	gl.attachShader(p, v);
	gl.attachShader(p, f);
	gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
	gl.deleteShader(v);
	gl.deleteShader(f);
	const cache = new Map();
	const loc = (n) => {
		if (!cache.has(n)) cache.set(n, gl.getUniformLocation(p, n));
		return cache.get(n);
	};
	return {
		program: p,
		use: () => gl.useProgram(p),
		loc,
		set(name, a, b, c, d) {
			const l = loc(name);
			if (l === null) return;
			if (typeof a === "object") {
				const n = a.length;
				(n === 2 ? gl.uniform2fv : n === 3 ? gl.uniform3fv : n === 4 ? gl.uniform4fv : gl.uniform1fv).call(gl, l, a);
			} else if (d !== undefined) gl.uniform4f(l, a, b, c, d);
			else if (c !== undefined) gl.uniform3f(l, a, b, c);
			else if (b !== undefined) gl.uniform2f(l, a, b);
			else gl.uniform1f(l, a);
		},
		seti(name, v) {
			const l = loc(name);
			if (l !== null) gl.uniform1i(l, v);
		},
		dispose: () => gl.deleteProgram(p),
	};
}

/**
 * rAF loop that pauses when the tab is hidden.
 * continuous=false: only runs for `budget` frames after kick().
 */
export function createLoop(step, { continuous = true, maxDt = 0.05, fps = 0 } = {}) {
	let raf = 0;
	let last = 0;
	let t = 0;
	let budget = continuous ? Infinity : 0;
	let stopped = false;
	let acc = 0;
	const frame = (now) => {
		raf = 0;
		if (stopped || document.hidden) return;
		const dt = Math.min(maxDt, last ? (now - last) / 1000 : 1 / 60);
		last = now;
		acc += dt;
		if (!fps || acc >= 1 / fps - 0.002) {
			t += acc;
			step(acc, t);
			acc = 0;
		}
		if (budget !== Infinity) budget--;
		if (budget > 0) raf = requestAnimationFrame(frame);
	};
	const start = () => {
		if (!raf && !stopped && !document.hidden && budget > 0) {
			last = 0;
			raf = requestAnimationFrame(frame);
		}
	};
	const onVis = () => {
		if (document.hidden) {
			cancelAnimationFrame(raf);
			raf = 0;
		} else start();
	};
	document.addEventListener("visibilitychange", onVis);
	start();
	return {
		kick(frames = 1) {
			if (budget !== Infinity) budget = Math.max(budget, frames);
			start();
		},
		stop() {
			stopped = true;
			cancelAnimationFrame(raf);
			document.removeEventListener("visibilitychange", onVis);
		},
		get time() {
			return t;
		},
	};
}

/** Window-level pointer tracking relative to a layer; never captures events. */
export function trackPointer(layer, { onMove, onDown, onUp } = {}) {
	const s = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, nx: 0.5, ny: 0.5, inside: false, down: false, seen: false, lastMove: -1e9, dx: 0, dy: 0 };
	const rel = (e) => {
		const r = layer.getBoundingClientRect();
		s.px = s.x;
		s.py = s.y;
		s.x = e.clientX - r.left;
		s.y = e.clientY - r.top;
		s.nx = s.x / r.width;
		s.ny = s.y / r.height;
		s.inside = s.x >= 0 && s.y >= 0 && s.x <= r.width && s.y <= r.height;
	};
	const move = (e) => {
		if (e.pointerType === "touch" && !s.down) return;
		const had = s.seen;
		rel(e);
		if (!had) {
			s.px = s.x;
			s.py = s.y;
		}
		s.seen = true;
		s.dx = s.x - s.px;
		s.dy = s.y - s.py;
		s.lastMove = performance.now();
		onMove?.(s, e);
	};
	const down = (e) => {
		rel(e);
		s.down = true;
		s.seen = true;
		onDown?.(s, e);
	};
	const up = (e) => {
		s.down = false;
		onUp?.(s, e);
	};
	window.addEventListener("pointermove", move, { passive: true });
	window.addEventListener("pointerdown", down, { passive: true });
	window.addEventListener("pointerup", up, { passive: true });
	window.addEventListener("pointercancel", up, { passive: true });
	s.destroy = () => {
		window.removeEventListener("pointermove", move);
		window.removeEventListener("pointerdown", down);
		window.removeEventListener("pointerup", up);
		window.removeEventListener("pointercancel", up);
	};
	return s;
}

export function observeSize(el, cb) {
	const ro = new ResizeObserver(cb);
	ro.observe(el);
	return () => ro.disconnect();
}

export function makeButton(root, label, { corner = "br", title = "" } = {}) {
	const b = document.createElement("button");
	b.type = "button";
	b.textContent = label;
	b.title = title;
	b.className = "kit-button";
	b.dataset.corner = corner;
	root.append(b);
	return b;
}

/** Union of text-bearing element rects, relative to `layer`. Cheap enough to call on scroll (rAF-throttled). */
export const TEXT_SELECTORS = [
	".site-header .site-logo",
	".site-nav",
	".site-portrait",
	".site-title",
	".site-tagline",
	".site-socials",
	".site-about p",
	".site-section-title",
	".site-item",
	".site-footer p",
].join(",");

export function textRects(root, layer, pad = 8, selectors = TEXT_SELECTORS) {
	const lr = layer.getBoundingClientRect();
	const out = [];
	for (const node of root.querySelectorAll(selectors)) {
		const r = node.getBoundingClientRect();
		if (r.width < 2 || r.height < 2) continue;
		out.push([r.left - lr.left - pad, r.top - lr.top - pad, r.right - lr.left + pad, r.bottom - lr.top + pad]);
	}
	return out;
}

/** rAF-throttled scroll listener on the scroll container. Returns a disposer. */
export function onScrollFrame(root, cb) {
	let raf = 0;
	const h = () => {
		if (!raf)
			raf = requestAnimationFrame(() => {
				raf = 0;
				cb();
			});
	};
	root.addEventListener("scroll", h, { passive: true });
	return () => {
		cancelAnimationFrame(raf);
		root.removeEventListener("scroll", h);
	};
}

export function hsl(h, s, l) {
	h = ((h % 360) + 360) % 360;
	s /= 100;
	l /= 100;
	const k = (n) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return [f(0), f(8), f(4)];
}
