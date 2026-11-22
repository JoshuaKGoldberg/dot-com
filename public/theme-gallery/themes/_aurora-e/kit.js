// _aurora-e: shared helpers for themes #257-260 (engine, parallax, scenery, aurora renderers).
import { rng, ridgeGeo, paintRidge, forestGeo, paintForest, makePineVariants, Flock, canvasLayer, glowSprite, cloudSprite, makeStars, drawStars, hex, mixC, rgba, clamp, lerp, smooth, TAU } from "../forest-kit/kit.js";
export { rng, ridgeGeo, paintRidge, forestGeo, paintForest, makePineVariants, Flock, canvasLayer, glowSprite, cloudSprite, makeStars, drawStars, hex, mixC, rgba, clamp, lerp, smooth, TAU };

export const isDark = () => document.documentElement.classList.contains("dark");
export const idle = (fn, timeout = 200) => {
	if ("requestIdleCallback" in window) {
		const id = requestIdleCallback(fn, { timeout });
		return () => cancelIdleCallback(id);
	}
	const id = setTimeout(fn, 16);
	return () => clearTimeout(id);
};
// Run builders one per idle task so startup never blocks long.
export function idleChain(tasks, done) {
	let cancel = () => {}, dead = false, i = 0;
	const next = () => {
		if (dead) return;
		if (i >= tasks.length) return done?.();
		const t = tasks[i++];
		cancel = idle(() => { if (dead) return; t(); next(); });
	};
	next();
	return () => { dead = true; cancel(); };
}

/* ---------- engine: pointer (window listeners), smoothing, energy, throttled idle drift ---------- */
export function createEngine({ root, reduced, host, rest = [0.66, 0.38], follow = 5, idleMs = 40, onResize, onFrame }) {
	const s = {
		w: 0, h: 0, dpr: 1, t: 0, drift: 0, phase: 0.8, energy: 0, speed: 0,
		x: 0, y: 0, tx: 0, ty: 0, fx: rest[0], fy: rest[1], // x,y in host px; fx,fy fractions
		px: 0, py: 0, scrollT: 0, reduced, tick: 0, active: false,
	};
	let raf = 0, timer = 0, last = 0, dead = false, started = false, lastX = 0, lastY = 0;
	const measure = () => {
		const r = host.getBoundingClientRect();
		const had = s.w > 0;
		s.ox = r.left; s.oy = r.top;
		s.w = Math.max(1, Math.round(r.width));
		s.h = Math.max(1, Math.round(r.height));
		s.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		if (!had || !s.active) { s.tx = s.x = s.fx * s.w; s.ty = s.y = s.fy * s.h; }
		onResize?.(s);
		if (started) { s.force = true; wake(); }
	};
	const setTarget = (x, y) => { s.tx = x; s.ty = y; };
	const onMove = (e) => {
		if (e.pointerType === "touch") return;
		const r = host.getBoundingClientRect();
		s.ox = r.left; s.oy = r.top;
		setTarget(e.clientX - r.left, e.clientY - r.top);
		s.active = true;
		wake();
	};
	const onOut = (e) => { if (!e.relatedTarget && s.active) { setTarget(rest[0] * s.w, rest[1] * s.h); wake(); } };
	const onScroll = () => {
		s.scrollT = clamp(root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight));
		wake();
	};
	function wake() {
		if (dead || document.hidden || !started) return;
		clearTimeout(timer); timer = 0;
		if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
	}
	function frame(now) {
		raf = 0;
		if (dead) return;
		const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
		last = now;
		step(dt, true);
	}
	function step(dt, fromRaf) {
		s.t += dt; s.tick++; s.dt = dt;
		const a = reduced ? 1 : 1 - Math.exp(-dt * follow);
		const ox = s.x, oy = s.y;
		s.x += (s.tx - s.x) * a; s.y += (s.ty - s.y) * a;
		let busy = false;
		if (Math.abs(s.tx - s.x) < 0.3 && Math.abs(s.ty - s.y) < 0.3) { s.x = s.tx; s.y = s.ty; } else busy = true;
		const sp = Math.hypot(s.x - ox, s.y - oy) / dt;
		s.speed = s.speed * 0.6 + sp * 0.4;
		if (s.speed < 4) s.speed = 0; else busy = true;
		const target = reduced ? 0 : Math.min(1, s.speed / 700);
		s.energy += (target - s.energy) * (1 - Math.exp(-dt * 3));
		if (s.energy < 0.01) s.energy = 0; else busy = true;
		s.phase += dt * s.energy * 1.4;
		if (!reduced) s.drift += dt;
		// smoothed normalised pointer for parallax
		const nx = clamp(s.x / s.w * 2 - 1, -1, 1), ny = clamp(s.y / s.h * 2 - 1, -1, 1);
		const k = 1 - Math.exp(-dt * 3.5);
		const pxo = s.px, pyo = s.py;
		s.px += (nx - s.px) * k; s.py += (ny - s.py) * k;
		if (Math.abs(s.px - pxo) > 0.0004 || Math.abs(s.py - pyo) > 0.0004) busy = true;
		s.busy = busy;
		const ext = onFrame(s, dt, !fromRaf) ; // returns true if something (birds) keeps animating
		s.force = false;
		if (dead) return;
		if (busy) raf = requestAnimationFrame(frame);
		else if (!reduced && ext && !document.hidden) timer = setTimeout(() => { timer = 0; step(idleMs / 1000, false); }, idleMs);
	}
	const onVis = () => { if (!document.hidden) wake(); else { cancelAnimationFrame(raf); raf = 0; clearTimeout(timer); timer = 0; } };
	const ro = new ResizeObserver(measure);
	ro.observe(host);
	window.addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerout", onOut, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	root.addEventListener("scroll", onScroll, { passive: true });
	measure();
	return {
		s, wake,
		start() { started = true; s.force = true; wake(); },
		destroy() {
			dead = true; cancelAnimationFrame(raf); clearTimeout(timer); ro.disconnect();
			window.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerout", onOut);
			document.removeEventListener("visibilitychange", onVis);
			root.removeEventListener("scroll", onScroll);
		},
	};
}

/* ---------- DOM helpers ---------- */
export function addCanvas(host, css = "", w = 1, h = 1) {
	const c = document.createElement("canvas");
	c.width = w; c.height = h;
	c.style.cssText = "position:absolute;display:block;pointer-events:none;" + css;
	host.appendChild(c);
	return c;
}
// Sizes a canvas to a fraction of a css size; returns {ctx,w,h} in canvas pixels.
export function sizeCanvas(c, cssW, cssH, scale) {
	c.width = Math.max(2, Math.round(cssW * scale));
	c.height = Math.max(2, Math.round(cssH * scale));
	return c.getContext("2d");
}

/* ---------- parallax layers (cached canvases moved by transform) ---------- */
export class Parallax {
	constructor() { this.items = []; }
	add(el, depth, { scroll = 0.9, y = 0.12 } = {}) { this.items.push({ el, depth, scroll, y, k: "" }); el.style.willChange = "transform"; return el; }
	apply(s, extraX = 0) {
		for (const it of this.items) {
			const x = -s.px * it.depth + extraX * it.depth * 0.0;
			const yy = -s.scrollT * it.depth * it.scroll - s.py * it.depth * it.y;
			const k = `${x.toFixed(1)},${yy.toFixed(1)}`;
			if (k !== it.k) { it.k = k; it.el.style.transform = `translate3d(${x.toFixed(1)}px,${yy.toFixed(1)}px,0)`; }
		}
	}
}

/* ---------- baked scenery ---------- */
// Paints a ridge (with optional forest) into a canvas of (w+2mx) x (h+over) and returns the canvas.
export function ridgeCanvas({ w, h, mx = 70, over = 100, dpr = 1, geo, pal, forest, variants, treeCols }) {
	const lw = w + mx * 2, lh = h + over;
	const lay = canvasLayer(lw, lh, dpr);
	const g = ridgeGeo({ w: lw, h: lh, ...geo });
	paintRidge(lay.x, g, { ...pal, depth: 70, light: 1 });
	if (forest) paintForest(lay.x, forestGeo({ w: lw, h: lh, ridge: g, bottom: lh, ...forest }), variants, treeCols);
	lay.c.style.cssText = `position:absolute;left:${-mx}px;top:0;width:${lw}px;height:${lh}px;pointer-events:none`;
	return lay.c;
}
// A canvas of tall pines hugging left and right edges (hand-placed trees list).
export function edgeTrees({ w, h, side, n, height, reach, seed, ybase }) {
	const r = rng(seed), trees = [];
	for (let i = 0; i < n; i++) {
		const t = (i + r()) / n;
		const x = side === "l" ? lerp(-20, w * reach, Math.pow(t, 0.85)) : lerp(w + 20, w * (1 - reach), Math.pow(t, 0.85));
		const th = h * height * lerp(1, 0.38, Math.pow(t, 0.75)) * (0.82 + r() * 0.36);
		trees.push({ x, y: ybase(x) + 6 + r() * 10, h: th, v: (r() * 8) | 0, b: (r() * 3) | 0, row: 0 });
	}
	trees.sort((a, b) => a.y - b.y);
	return trees;
}

export function starCanvas({ w, h, count = 150, maxY = 0.5, seed = 5, color = [225, 232, 255] }) {
	const c = document.createElement("canvas");
	c.width = w; c.height = h;
	const x = c.getContext("2d");
	drawStars(x, makeStars(rng(seed), count, w, h * maxY), 0, 1, color);
	return c;
}

/* ---------- birds (forest-kit Flock on a small canvas) ---------- */
export class Birds {
	constructor(host, { flocks, colors, resident = 0 }) {
		this.c = addCanvas(host, "left:0;top:0;width:100%;height:100%");
		this.ctx = this.c.getContext("2d");
		this.flocks = flocks.map((o) => new Flock(o));
		if (resident) this.flocks[0].addResidents?.(resident, [4.5, 6]);
		this.colors = colors;
		this.w = 0; this.h = 0; this.dirty = true;
	}
	resize(w, h) { this.w = w; this.h = h; this.c.width = w; this.c.height = h; this.flocks.forEach((f) => f.resize(w, h)); }
	settle(secs = 4) { this.flocks.forEach((f) => f.settle({ wind: 0.8, perches: [], w: this.w, h: this.h }, secs)); }
	update(dt, pointer) { for (const f of this.flocks) f.update(dt, { wind: 0.8, perches: [], pointer, w: this.w, h: this.h }); }
	draw() {
		this.ctx.clearRect(0, 0, this.w, this.h);
		for (const f of this.flocks) f.draw(this.ctx, this.colors);
	}
}

/* ---------- 2D ribbon aurora (soft, drawn at low res; the browser upscale is the blur) ---------- */
export const AURORA_DARK = [[70, 255, 170], [60, 200, 255], [190, 110, 255], [255, 90, 140]];
export const AURORA_LIGHT = [[40, 190, 130], [60, 160, 225], [170, 110, 230], [235, 120, 160]];
function ribbonSprite(rgb, dark, alpha, soft) {
	const c = document.createElement("canvas");
	c.width = 1; c.height = 128;
	const x = c.getContext("2d");
	const [r, g, b] = rgb;
	const gr = x.createLinearGradient(0, 0, 0, 128);
	gr.addColorStop(0, `rgba(${r},${g},${b},0)`);
	gr.addColorStop(0.35, `rgba(${r},${g},${b},${0.1 * alpha})`);
	gr.addColorStop(0.78, `rgba(${r},${g},${b},${0.42 * alpha})`);
	gr.addColorStop(soft ? 0.8 : 0.93, `rgba(${r},${g},${b},${(soft ? 0.5 : 0.85) * alpha})`);
	if (!soft) gr.addColorStop(0.985, `rgba(255,255,255,${(dark ? 0.2 : 0.08) * alpha})`);
	gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
	x.fillStyle = gr; x.fillRect(0, 0, 1, 128);
	return c;
}
export class RibbonAurora {
	constructor({ dark, bands = 4, alpha = 0.7, seed = 4, rays = 0.22, top = 0.1, gap = 0.05, hgt = 150, span = 1, soft = false }) {
		this.dark = dark; this.rays = rays; this.top = top; this.gap = gap; this.hgt = hgt; this.span = span;
		const pal = (dark ? AURORA_DARK : AURORA_LIGHT).slice(0, bands);
		this.sprites = pal.map((c) => ribbonSprite(c, dark, dark ? alpha : alpha * 0.8, soft));
		const r = rng(seed);
		this.seeds = pal.map(() => [r() * 6, r() * 6, r() * 6]);
	}
	// ctx is the low-res context; cx,cy cursor in the same px space; scale = lowres px per css px; focus 0..1
	draw(ctx, w, h, { cx, cy, phase, scale = 0.25, focus = 1 }) {
		ctx.clearRect(0, 0, w, h);
		ctx.globalCompositeOperation = this.dark ? "lighter" : "source-over";
		const sig = w * 0.17;
		const px = 1 / scale; // css px per low-res column
		for (let b = 0; b < this.sprites.length; b++) {
			const [s0, s1, s2] = this.seeds[b];
			const sp = this.sprites[b];
			for (let i = -Math.round(w * 0.25); i < w * 1.25; i++) {
				const u = (i / w) * this.span;
				const dxc = i - cx;
				const g = Math.exp(-(dxc * dxc) / (2 * sig * sig)) * focus;
				let by = h * (this.top + 0.2 + b * this.gap) + 0.25 * h * 0.16 * 0 + (38 * scale) * Math.sin(u * 3.2 + s0 + phase * 0.55) * 1.6 + (20 * scale) * Math.sin(u * 8.1 + s1 - phase * 0.8) * 1.4;
				by += (cy + 40 * scale - by) * 0.4 * g;
				const hg = (this.hgt + 70 * Math.sin(u * 4.7 + s2 + phase * 0.4) + 190 * g) * scale;
				const x = i - dxc * 0.28 * g;
				const flick = 1 - this.rays + this.rays * (0.5 + 0.5 * Math.sin(u * 52 + s1 * 3 + phase * 1.5 + b) * Math.sin(u * 19 + s2 - phase * 0.6));
				ctx.globalAlpha = Math.min(1, flick * (0.55 + 0.7 * g) * (1 - 0.2 * b));
				ctx.drawImage(sp, 0, 0, 1, 128, x, by - hg, 1.6, hg);
			}
		}
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
	}
}

/* ---------- WebGL aurora (one context, reduced-resolution canvas, upscaled by CSS) ---------- */
const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FS = `precision highp float;
uniform vec2 R;uniform float T,E,DK,SPAN,FOG,TOP;uniform vec3 C;uniform vec2 M;
float h(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*n(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
vec3 pal(float t){
 vec3 g=vec3(.25,1.,.62),b=vec3(.2,.78,1.),v=vec3(.72,.42,1.),r=vec3(1.,.35,.55);
 vec3 c=mix(g,b,smoothstep(.0,.35,t));c=mix(c,v,smoothstep(.3,.75,t));return mix(c,r,smoothstep(.8,1.,t)*.7);}
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 float x=uv.x*SPAN;
 vec3 col=vec3(0.);float a=0.;
 float g=exp(-pow((uv.x-M.x)*SPAN*2.2,2.));
 g*=.55+E*.6;
 for(int L=0;L<4;L++){
  float fl=float(L);
  float t=T*(.035+.01*fl);
  float lo=TOP+.17+fl*.05+(fbm(vec2(x*1.3+fl*3.1,t))-.5)*.5+(fbm(vec2(x*5.+fl*1.7,t*2.))-.5)*.05;
  lo+=((M.y*.8)-lo)*.38*g;
  float xx=x-(uv.x-M.x)*.1*g*SPAN;
  float rays=.2+.8*smoothstep(.15,.85,fbm(vec2(xx*26.+fl*9.,t*2.4+fl+uv.y*.6)));
  float hgt=(.17+.2*fbm(vec2(xx*2.2+fl*5.,t*1.6))+.12*g)*(1.-.12*fl);
  float d=lo-uv.y;
  float above=smoothstep(-.05,.04,d);
  float fall=exp(-max(d,0.)/hgt*3.);
  float hem=exp(-pow((d+.01)/.07,2.))*.5;
  float vol=above*fall*rays*.9+hem*.25;
  vol*=1.-smoothstep(.0,.07,.07-uv.y)*.0;
  vol*=(.6+.75*g)*(1.-fl*.15);
  vol*=smoothstep(0.,.05,uv.y);
  vec3 cc=pal(clamp(d/(hgt*1.6),0.,1.));
  cc=mix(cc,vec3(.85,1.,.9),hem*.2);
  col+=cc*vol;a+=vol;
 }
 float f=fbm(vec2(x*1.8+T*.01,uv.y*2.6-T*.006));
 float fogm=smoothstep(.4,.9,f)*FOG*smoothstep(.0,.3,uv.y)*(1.-smoothstep(.45,.9,uv.y));
 col*=1.+fogm*.3;a*=1.+fogm*.3;
 float fade=1.-smoothstep(.5,.85,uv.y);
 col*=fade;a*=fade;
 vec3 tone=1.-exp(-col*1.5);
 float at=1.-exp(-a*1.3);
 if(DK>.5){gl_FragColor=vec4(tone*.85,at*.62);}
 else{
  vec3 hue=col/(a+.001);
  hue=mix(vec3(dot(hue,vec3(.33))),hue,1.15)*vec3(.62,.82,.84);
  float al=at*.5;
  gl_FragColor=vec4(hue*al,al);
 }
 }`;
export class GLAurora {
	// returns null instance if WebGL is unavailable; check .ok
	constructor(host, { dark, scale = 0.4, span = 1, fog = 1, top = 0.0, css = "" }) {
		this.dark = dark; this.scale = scale; this.span = span; this.fog = fog; this.top = top;
		this.c = addCanvas(host, "left:0;top:0;width:100%;height:100%;" + css);
		const gl = this.c.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true, depth: false, stencil: false, powerPreference: "low-power" });
		this.gl = gl; this.ok = !!gl;
		this.lost = false;
		this.onLost = (e) => { e.preventDefault(); this.lost = true; this.ok = false; this.onFail?.(); };
		this.c.addEventListener("webglcontextlost", this.onLost);
		if (!gl) return;
		const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
		const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
		if (!vs || !fs) { this.ok = false; return; }
		const pr = gl.createProgram();
		gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
		if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { this.ok = false; return; }
		gl.useProgram(pr);
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const loc = gl.getAttribLocation(pr, "p");
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		this.u = {};
		for (const k of ["R", "T", "E", "DK", "SPAN", "FOG", "TOP", "C", "M"]) this.u[k] = gl.getUniformLocation(pr, k);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.clearColor(0, 0, 0, 0);
	}
	resize(cssW, cssH) {
		this.c.width = Math.max(2, Math.round(cssW * this.scale));
		this.c.height = Math.max(2, Math.round(cssH * this.scale));
		this.cw = cssW; this.ch = cssH;
		if (this.ok) this.gl.viewport(0, 0, this.c.width, this.c.height);
	}
	draw(t, energy, mx, my) {
		if (!this.ok) return;
		const gl = this.gl, u = this.u;
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.uniform2f(u.R, this.c.width, this.c.height);
		gl.uniform1f(u.T, t); gl.uniform1f(u.E, energy);
		gl.uniform1f(u.DK, this.dark ? 1 : 0); gl.uniform1f(u.SPAN, this.span);
		gl.uniform1f(u.FOG, this.fog); gl.uniform1f(u.TOP, this.top);
		gl.uniform3f(u.C, 1, 1, 1);
		gl.uniform2f(u.M, mx, my);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
	destroy() {
		this.c.removeEventListener("webglcontextlost", this.onLost);
		try { this.gl?.getExtension("WEBGL_lose_context")?.loseContext(); } catch {}
		this.c.remove();
	}
}
