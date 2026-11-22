// Shared helpers for the cursor-reactive themes (#126-135).
// Canvas sizing, window pointer tracking, a sleeping rAF loop, and a tiny WebGL2 toolkit.

export function mountCanvas(layer, { maxDpr = 1.5, scale = 1, type = "2d", opts } = {}) {
	const canvas = document.createElement("canvas");
	canvas.className = "ck-canvas";
	canvas.setAttribute("aria-hidden", "true");
	layer.append(canvas);
	const view = { canvas, w: 1, h: 1, cssW: 1, cssH: 1, dpr: 1, onResize: null };
	const measure = () => {
		view.cssW = Math.max(1, layer.clientWidth);
		view.cssH = Math.max(1, layer.clientHeight);
		view.dpr = Math.min(window.devicePixelRatio || 1, maxDpr) * scale;
		view.w = Math.max(1, Math.round(view.cssW * view.dpr));
		view.h = Math.max(1, Math.round(view.cssH * view.dpr));
		canvas.width = view.w;
		canvas.height = view.h;
		view.onResize?.(view);
	};
	view.ctx = type === "2d" ? canvas.getContext("2d", opts) : canvas.getContext(type, opts);
	const ro = new ResizeObserver(() => measure());
	ro.observe(layer);
	measure();
	view.destroy = () => {
		ro.disconnect();
		canvas.remove();
	};
	return view;
}

// Pointer position (css px relative to `layer`) from window listeners only.
export function trackPointer(layer, { onMove, onLeave } = {}) {
	const p = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, active: false, lastMove: 0 };
	const move = (e) => {
		const r = layer.getBoundingClientRect();
		const x = e.clientX - r.left;
		const y = e.clientY - r.top;
		if (!p.active) {
			p.px = x;
			p.py = y;
		} else {
			p.px = p.x;
			p.py = p.y;
		}
		p.x = x;
		p.y = y;
		p.vx = x - p.px;
		p.vy = y - p.py;
		p.active = true;
		p.lastMove = performance.now();
		onMove?.(p, e);
	};
	const leave = () => {
		p.active = false;
		onLeave?.(p);
	};
	window.addEventListener("pointermove", move, { passive: true });
	window.addEventListener("blur", leave);
	document.documentElement.addEventListener("mouseleave", leave);
	return {
		p,
		destroy() {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("blur", leave);
			document.documentElement.removeEventListener("mouseleave", leave);
		},
	};
}

// A rAF loop that sleeps. frame(dtSeconds, nowMs) returns true to keep running.
export function createLoop(frame) {
	let raf = 0;
	let last = 0;
	let dead = false;
	const tick = (now) => {
		raf = 0;
		if (dead || document.hidden) return;
		const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
		last = now;
		if (frame(dt, now)) raf = requestAnimationFrame(tick);
	};
	const onVis = () => {
		if (!document.hidden) wake();
	};
	document.addEventListener("visibilitychange", onVis);
	function wake() {
		if (dead || raf || document.hidden) return;
		last = performance.now();
		raf = requestAnimationFrame(tick);
	}
	return {
		wake,
		stop() {
			dead = true;
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			document.removeEventListener("visibilitychange", onVis);
		},
	};
}

export function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}


// ---- WebGL2 toolkit ----
const VS = `#version 300 es
out vec2 uv;
void main(){
  vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2));
  uv = p;
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;

export function initGL(canvas) {
	const gl = canvas.getContext("webgl2", {
		antialias: false,
		alpha: true,
		premultipliedAlpha: true,
		powerPreference: "low-power",
		preserveDrawingBuffer: false,
	});
	if (!gl) return null;
	const floatRT = !!gl.getExtension("EXT_color_buffer_float") || !!gl.getExtension("EXT_color_buffer_half_float");
	gl.getExtension("OES_texture_float_linear");
	const lose = gl.getExtension("WEBGL_lose_context");
	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	return { gl, floatRT, destroy: () => lose?.loseContext() };
}

export function makeProgram(gl, fsSource, vsSource = VS) {
	const compile = (type, src) => {
		const s = gl.createShader(type);
		gl.shaderSource(s, src);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
			console.error(gl.getShaderInfoLog(s), src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n"));
		}
		return s;
	};
	const prog = gl.createProgram();
	gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
	gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, "#version 300 es\nprecision highp float;\nprecision highp sampler2D;\n" + fsSource));
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
	const locs = {};
	const u = (name) => (locs[name] ??= gl.getUniformLocation(prog, name));
	return {
		prog,
		use() {
			gl.useProgram(prog);
		},
		f1(n, a) {
			gl.uniform1f(u(n), a);
		},
		f2(n, a, b) {
			gl.uniform2f(u(n), a, b);
		},
		f3(n, a, b, c) {
			gl.uniform3f(u(n), a, b, c);
		},
		f4(n, a, b, c, d) {
			gl.uniform4f(u(n), a, b, c, d);
		},
		i1(n, a) {
			gl.uniform1i(u(n), a);
		},
		f3v(n, arr) {
			gl.uniform3fv(u(n), arr);
		},
	};
}

export function makeTexture(gl, w, h, { internal, format, type, filter, data, wrap } = {}) {
	const tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, internal ?? gl.RGBA16F, w, h, 0, format ?? gl.RGBA, type ?? gl.HALF_FLOAT, data ?? null);
	const f = filter ?? gl.LINEAR;
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
	const wr = wrap ?? gl.CLAMP_TO_EDGE;
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
	return tex;
}

export function makeTarget(gl, w, h, opts = {}) {
	const tex = makeTexture(gl, w, h, opts);
	const fbo = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	return { tex, fbo, w, h };
}

export function makePingPong(gl, w, h, opts) {
	const a = makeTarget(gl, w, h, opts);
	const b = makeTarget(gl, w, h, opts);
	const pp = {
		read: a,
		write: b,
		w,
		h,
		swap() {
			[pp.read, pp.write] = [pp.write, pp.read];
		},
		clear() {
			for (const t of [a, b]) {
				gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);
			}
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		},
		dispose() {
			for (const t of [a, b]) {
				gl.deleteTexture(t.tex);
				gl.deleteFramebuffer(t.fbo);
			}
		},
	};
	return pp;
}

// Bind `target` (or the screen if null) and draw the fullscreen triangle.
export function pass(gl, target, w, h) {
	gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
	gl.viewport(0, 0, w, h);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function bindTex(gl, unit, tex) {
	gl.activeTexture(gl.TEXTURE0 + unit);
	gl.bindTexture(gl.TEXTURE_2D, tex);
}

// Common GLSL helpers.
export const GLSL_NOISE = `
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y);
}
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=0.5;} return s; }
`;
