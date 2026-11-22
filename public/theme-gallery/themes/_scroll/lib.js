// Shared helpers for the 166-175 scroll-story themes.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
	const t = clamp((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};
export function rng(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
export function hex(c) {
	if (Array.isArray(c)) return c;
	const n = parseInt(c.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

const SECTION_SELECTORS = [".site-hero", ".site-about", ".site-posts", ".site-projects", ".site-talks", ".site-footer"];

/** Scroll progress (0..1) at which each of the six sections is centred. Monotonic. */
export function sectionAnchors(root) {
	const max = Math.max(1, root.scrollHeight - root.clientHeight);
	const rootTop = root.getBoundingClientRect().top;
	const raw = SECTION_SELECTORS.map((sel) => {
		const el = root.querySelector(sel);
		if (!el) return 0;
		const r = el.getBoundingClientRect();
		const center = r.top - rootTop + root.scrollTop + r.height / 2;
		return clamp((center - root.clientHeight / 2) / max);
	});
	raw[0] = 0;
	raw[5] = 1;
	return raw.map((p, i) => 0.82 * p + 0.18 * (i / 5));
}

/** Piecewise-linear map from progress to journey values, given per-anchor values (numbers or arrays). */
export function stops(anchors, values) {
	return (p) => {
		if (p <= anchors[0]) return values[0];
		for (let i = 1; i < anchors.length; i++) {
			if (p <= anchors[i]) {
				const t = (p - anchors[i - 1]) / Math.max(1e-6, anchors[i] - anchors[i - 1]);
				const a = values[i - 1];
				const b = values[i];
				const e = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
				return Array.isArray(a) ? a.map((v, k) => lerp(v, b[k], e)) : lerp(a, b, e);
			}
		}
		return values[values.length - 1];
	};
}

/**
 * Scroll-driven canvas journey. draw(state, dt) is called when progress changes,
 * and at `ambientFps` when ambient animation is wanted. Reduced motion snaps to
 * the nearest section anchor with no tweening and no ambient loop.
 */
export function createJourney(root, o) {
	const layer = root.querySelector(o.layer || ".scenery-a");
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", pointerEvents: "none" });
	layer.append(canvas);
	const gl = o.type === "webgl" ? canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" }) : null;
	const ctx = o.type === "webgl" ? null : canvas.getContext("2d");
	if (o.type === "webgl" && !gl) {
		// The browser refused a WebGL context (limit hit, GPU reset, or WebGL blocked).
		// Skip the canvas and leave the theme's static CSS scene.
		canvas.remove();
		root.classList.add("webgl-unavailable");
		return { state: { root, canvas, gl: null }, redraw() {}, destroy() {} };
	}
	const reduced = !!o.reducedMotion;
	const S = { root, canvas, ctx, gl, p: 0, target: 0, t: 0, w: 2, h: 2, cssW: 2, cssH: 2, dpr: 1, anchors: [0, 0.2, 0.4, 0.6, 0.8, 1], vel: 0, dark: !!o.dark, reduced };
	let raf = 0;
	let last = 0;
	let acc = 0;
	let dirty = true;
	let dead = false;
	const ambientFps = reduced ? 0 : o.ambientFps || 0;

	function fit() {
		S.cssW = Math.max(2, layer.clientWidth);
		S.cssH = Math.max(2, layer.clientHeight);
		let r = Math.min(window.devicePixelRatio || 1, o.maxDpr || 1.5) * (o.scale || 1);
		r = Math.min(r, Math.sqrt((o.maxPixels || 3e6) / (S.cssW * S.cssH)));
		S.dpr = r;
		S.w = canvas.width = Math.max(2, Math.round(S.cssW * r));
		S.h = canvas.height = Math.max(2, Math.round(S.cssH * r));
		if (gl) gl.viewport(0, 0, S.w, S.h);
		S.anchors = sectionAnchors(root);
		o.resize?.(S);
		readTarget();
		if (reduced) S.p = S.target;
		dirty = true;
		kick();
	}
	function readTarget() {
		const max = root.scrollHeight - root.clientHeight;
		const raw = max > 0 ? clamp(root.scrollTop / max) : 0;
		if (reduced) {
			let best = 0;
			for (let i = 1; i < 6; i++) if (Math.abs(S.anchors[i] - raw) < Math.abs(S.anchors[best] - raw)) best = i;
			S.target = S.anchors[best];
			S.section = best;
		} else S.target = raw;
		S.raw = raw;
	}
	function onScroll() {
		const before = S.target;
		readTarget();
		if (reduced && before === S.target) return;
		if (reduced) S.p = S.target;
		dirty = true;
		kick();
	}
	function frame(now) {
		raf = 0;
		if (dead || document.hidden) return;
		const dt = Math.min(0.1, last ? (now - last) / 1000 : 1 / 60);
		last = now;
		acc += dt;
		const moving = Math.abs(S.target - S.p) > 0.0002;
		if (moving && !reduced) {
			const before = S.p;
			S.p += (S.target - S.p) * (1 - Math.exp(-dt * (o.follow || 9)));
			S.vel = (S.p - before) / Math.max(dt, 1e-3);
		} else S.vel = 0;
		const due = ambientFps && acc >= 1 / ambientFps - 0.002;
		if (moving || dirty || due) {
			S.t += acc;
			o.draw(S, acc);
			acc = 0;
			dirty = false;
		}
		if (moving || ambientFps) raf = requestAnimationFrame(frame);
		else last = 0;
	}
	function kick() {
		if (!raf && !dead && !document.hidden) raf = requestAnimationFrame(frame);
	}
	const onVis = () => {
		if (document.hidden) {
			cancelAnimationFrame(raf);
			raf = 0;
		} else {
			last = 0;
			kick();
		}
	};
	const ro = new ResizeObserver(fit);
	ro.observe(layer);
	root.addEventListener("scroll", onScroll, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	document.fonts?.ready.then(() => !dead && fit());
	S.t = 3;
	fit();
	S.p = S.target;
	return {
		state: S,
		redraw() {
			dirty = true;
			kick();
		},
		destroy() {
			dead = true;
			cancelAnimationFrame(raf);
			ro.disconnect();
			root.removeEventListener("scroll", onScroll);
			document.removeEventListener("visibilitychange", onVis);
			gl?.getExtension("WEBGL_lose_context")?.loseContext();
			canvas.remove();
		},
	};
}

export function addEl(parent, html, cls) {
	const el = document.createElement("div");
	if (cls) el.className = cls;
	el.innerHTML = html;
	parent.append(el);
	return el;
}

export function compileProgram(gl, fs) {
	const vs = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;
	const mk = (type, src) => {
		const s = gl.createShader(type);
		gl.shaderSource(s, src);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
		return s;
	};
	const p = gl.createProgram();
	gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
	gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
	gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
	const cache = {};
	return {
		use: () => gl.useProgram(p),
		u(name, ...v) {
			if (!(name in cache)) cache[name] = gl.getUniformLocation(p, name);
			const l = cache[name];
			if (l === null) return;
			if (v.length === 1) gl.uniform1f(l, v[0]);
			else if (v.length === 2) gl.uniform2f(l, ...v);
			else if (v.length === 3) gl.uniform3f(l, ...v);
			else gl.uniform4f(l, ...v);
		},
	};
}
export function drawFullscreen(gl) {
	gl.drawArrays(gl.TRIANGLES, 0, 3);
}
/** Shared GLSL helpers. */
export const GLSL_NOISE = `
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=0.5; } return s; }
`;
