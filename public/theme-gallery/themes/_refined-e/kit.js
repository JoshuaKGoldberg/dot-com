// _refined-e: shared helpers for the wave-12 footer themes #314-316 and #318.
// - GL: tiny WebGL full-quad runner (reduced resolution; CSS upscale is the blur), with textures + array uniforms
// - GLSL: dithered aurora shader library (no y-dependent ray noise, so no horizontal banding)
// - topAurora: the raised top aurora (levels 1-3), scroll-away with transform/opacity only
// - footerStage: footer host element that fills the page width, loops only while on screen
// - marginSky: subtle stars / galaxy wisps in the side margins
// - birds/loon drawing helpers, silhouettes (ridges, spruce, pines)

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;
export function rng(seed) {
	let s = seed >>> 0 || 1;
	return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const isDark = () => document.documentElement.classList.contains("dark");
export const idle = (fn, timeout = 250) => {
	if ("requestIdleCallback" in window) { const id = requestIdleCallback(fn, { timeout }); return () => cancelIdleCallback(id); }
	const id = setTimeout(fn, 16); return () => clearTimeout(id);
};
export const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/* ================= WebGL runner ================= */
const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
export class GL {
	constructor(parent, fs, { scale = 0.4, css = "" } = {}) {
		this.scale = scale;
		this.c = document.createElement("canvas");
		this.c.width = this.c.height = 2;
		this.c.setAttribute("aria-hidden", "true");
		this.c.style.cssText = "position:absolute;display:block;pointer-events:none;width:100%;height:100%;left:0;top:0;" + css;
		parent.appendChild(this.c);
		this.ok = false;
		this.locs = {};
		this.tex = {};
		this.c.addEventListener("webglcontextlost", (this.onLost = (e) => { e.preventDefault(); this.ok = false; this.onFail?.(); }));
		const gl = this.gl = this.c.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true, depth: false, stencil: false, powerPreference: "low-power" });
		if (!gl) return;
		const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(x)); return null; } return x; };
		const vs = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, fs);
		if (!vs || !f) return;
		const pr = gl.createProgram();
		gl.attachShader(pr, vs); gl.attachShader(pr, f); gl.linkProgram(pr);
		if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(pr)); return; }
		this.pr = pr; gl.useProgram(pr);
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const loc = gl.getAttribLocation(pr, "p");
		gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
		this.ok = true;
	}
	resize(cssW, cssH) {
		this.c.width = Math.max(2, Math.round(cssW * this.scale));
		this.c.height = Math.max(2, Math.round(cssH * this.scale));
		if (this.ok) this.gl.viewport(0, 0, this.c.width, this.c.height);
	}
	// upload a canvas as texture unit `unit`, bound to sampler uniform `name`
	setTexture(name, canvas, unit = 0) {
		if (!this.ok) return;
		const gl = this.gl;
		let t = this.tex[name];
		if (!t) t = this.tex[name] = { t: gl.createTexture(), unit };
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, t.t);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const loc = this.loc(name);
		if (loc !== null) gl.uniform1i(loc, unit);
	}
	loc(k) { return (this.locs[k] ??= this.gl.getUniformLocation(this.pr, k)); }
	draw(u) {
		if (!this.ok) return;
		const gl = this.gl;
		gl.clear(gl.COLOR_BUFFER_BIT);
		u.R = [this.c.width, this.c.height];
		for (const k in u) {
			const loc = this.loc(k);
			if (loc === null) continue;
			const v = u[k];
			if (typeof v === "number") gl.uniform1f(loc, v);
			else if (v instanceof Float32Array) gl.uniform3fv(loc, v);
			else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
			else gl.uniform3f(loc, v[0], v[1], v[2]);
		}
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
	destroy() {
		this.c.removeEventListener("webglcontextlost", this.onLost);
		try { this.gl?.getExtension("WEBGL_lose_context")?.loseContext(); } catch {}
		this.c.remove();
	}
}

/* ================= GLSL library ================= */
export const GLSL = `precision highp float;
uniform vec2 R,M;uniform float T,DK,AMP,E;
float hash(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
float fbm3(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*vn(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
vec3 pal(float t){
 vec3 g=vec3(.22,1.,.6),b=vec3(.2,.75,1.),v=vec3(.68,.45,1.),r=vec3(1.,.4,.62);
 vec3 c=mix(g,b,smoothstep(0.,.4,t));c=mix(c,v,smoothstep(.35,.85,t));return mix(c,r,smoothstep(.85,1.1,t)*.5);}
// glow accumulation (col sum, a sum) -> premultiplied rgba. Dark: additive glow. Light: tinted pastel.
vec4 glow(vec3 col,float a,float k){
 float al=1.-exp(-a*k);
 vec3 hue=col/(a+.0005);
 if(DK>.5)return vec4(hue*al*.92,al*.62);
 hue=mix(vec3(dot(hue,vec3(.33))),hue,1.2)*vec3(.5,.74,.8);float l=al*.62;return vec4(hue*l,l);}
vec4 over(vec4 top,vec4 bot){return top+bot*(1.-top.a);}
vec4 dither(vec4 o){float d=(hash(gl_FragCoord.xy+fract(T*.1))-.5)/255.;o.rgb+=d*o.a;o.a+=d*.5;return clamp(o,0.,1.);}
`;

/* A multi-ribbon curtain evaluated at any point p (uv, y down).
   Uniform knobs: BASE (curtain y), HGT, WOB, LS (layer spacing), RAYS, WX (x scale), WAVE, PULL (cursor pull strength). */
export const AURORA_FN = `
uniform float BASE,HGT,WOB,LS,RAYS,WX,WAVE,PULL,LOWF;
vec4 aurora(vec2 p,float yScale){
 float x=p.x*WX;
 float g=exp(-pow((p.x-M.x)*2.4,2.))*(.5+E*.8);
 vec3 col=vec3(0.);float a=0.;
 for(int L=0;L<3;L++){
  float fl=float(L);
  float t=T*(.03+.008*fl);
  float yc=BASE+LS*fl+(fbm3(vec2(x*.75+fl*3.1,t))-.5)*WOB+(vn(vec2(x*2.3+fl*5.,t*1.5))-.5)*WOB*.28+sin(x*3.+fl*2.+t*3.)*WAVE*.25;
  yc+=(clamp(M.y,BASE-.1,BASE+.2)-yc)*PULL*g;
  float xx=x-(p.x-M.x)*.12*g*WX;
  float ray=mix(1.,.4+.6*smoothstep(.2,.8,fbm3(vec2(xx*8.+fl*9.,t*3.))),RAYS);
  float hg=HGT*(.75+.5*fbm3(vec2(xx*1.6+fl*5.,t*2.)))*(1.+.4*g)*(1.-.1*fl);
  float d=(yc-p.y)*yScale;
  float lower=smoothstep(-.13-LOWF,.03,d);
  float v=(exp(-max(d,0.)/hg*2.2)*lower+.3*exp(-pow((d+.01)/(.05+LOWF*.5),2.)))*ray;
  v*=(.55+.8*g)*(1.-.18*fl);
  col+=pal(clamp(d/(hg*1.8),0.,1.)+fl*.12)*v;a+=v;
 }
 return vec4(col,a);
}`;

/* ================= pointer + loop ================= */
// Window listeners only. Coordinates are relative to `host` (px).
export function pointerTracker(host, onChange) {
	const s = { x: 0, y: 0, vx: 0, vy: 0, has: false, down: false, ox: 0, oy: 0, speed: 0 };
	let lx = 0, ly = 0, lt = 0;
	const onMove = (e) => {
		if (e.pointerType === "touch") return;
		const r = host.getBoundingClientRect();
		s.ox = r.left; s.oy = r.top;
		const nx = e.clientX - r.left, ny = e.clientY - r.top;
		const now = performance.now();
		const dt = Math.max(8, now - lt);
		s.vx = (nx - lx) / dt * 1000; s.vy = (ny - ly) / dt * 1000;
		s.speed = Math.hypot(s.vx, s.vy);
		lx = nx; ly = ny; lt = now;
		s.x = nx; s.y = ny; s.has = true;
		onChange?.(s, "move", e);
	};
	const onOut = (e) => { if (!e.relatedTarget && s.has) { s.has = false; onChange?.(s, "out", e); } };
	const onDown = (e) => {
		if (e.pointerType === "touch" && e.pointerType !== "mouse" && false) return;
		const r = host.getBoundingClientRect();
		s.ox = r.left; s.oy = r.top;
		onChange?.(s, "down", e);
	};
	addEventListener("pointermove", onMove, { passive: true });
	addEventListener("pointerdown", onDown, { passive: true });
	document.addEventListener("pointerout", onOut, { passive: true });
	return { s, destroy() { removeEventListener("pointermove", onMove); removeEventListener("pointerdown", onDown); document.removeEventListener("pointerout", onOut); } };
}

// Runs draw(t, dt) at ~fps only while `host` is on screen and the tab is visible. Reduced motion: one frame (+ redraw on demand).
export function createLoop({ host, fps = 24, reduced, draw, t0 = 7 }) {
	let visible = false, raf = 0, last = 0, t = reduced ? t0 : 0, dead = false, ready = false;
	const stop = () => { cancelAnimationFrame(raf); raf = 0; };
	const frame = (now) => {
		raf = 0;
		if (dead || !visible || document.hidden) return;
		raf = requestAnimationFrame(frame);
		const gap = now - last;
		if (gap < 1000 / fps - 3) return;
		last = now;
		const dt = Math.min(0.1, gap / 1000);
		t += dt;
		draw(t, dt);
	};
	const wake = () => {
		if (dead || !ready || !visible || document.hidden) return;
		if (reduced) { draw(t, 0.016); return; }
		if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
	};
	const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) wake(); else stop(); });
	io.observe(host);
	const onVis = () => { if (document.hidden) stop(); else wake(); };
	document.addEventListener("visibilitychange", onVis);
	return {
		start() { ready = true; wake(); },
		wake() { if (reduced) { if (ready && visible) draw(t, 0.016); } else wake(); },
		redraw() { if (ready && visible) draw(t, 0.016); },
		get visible() { return visible; },
		destroy() { dead = true; stop(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); },
	};
}

/* ================= footer stage ================= */
// Inserts a host inside .site-footer that spans the full width of #site, tall enough for the scene.
export function footerStage(root, { height = 260, tag = "ra-foot" } = {}) {
	const page = root.querySelector(".site-page");
	const footer = root.querySelector(".site-footer");
	if (!page || !footer) return null;
	root.classList.add("ra-footer-on");
	const host = document.createElement("div");
	host.className = tag;
	host.setAttribute("aria-hidden", "true");
	footer.prepend(host);
	const st = { host, footer, page, w: 0, h: 0, dpr: 1, onSize: null };
	const layout = () => {
		host.style.left = "0px"; host.style.width = "0px";
		const fr = footer.getBoundingClientRect(), rr = root.getBoundingClientRect();
		host.style.left = `${rr.left - fr.left}px`;
		host.style.width = `${root.clientWidth}px`;
		const w = Math.round(root.clientWidth), h = Math.round(host.clientHeight || height);
		if (w !== st.w || h !== st.h) {
			st.w = w; st.h = h; st.dpr = Math.min(devicePixelRatio || 1, 1.5);
			st.onSize?.(st);
		}
	};
	const ro = new ResizeObserver(layout);
	ro.observe(root); ro.observe(footer);
	st.layout = layout;
	st.destroy = () => { ro.disconnect(); host.remove(); root.classList.remove("ra-footer-on"); };
	return st;
}

export function mkCanvas(host, css = "") {
	const c = document.createElement("canvas");
	c.setAttribute("aria-hidden", "true");
	c.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;" + css;
	host.appendChild(c);
	return c;
}
export function sizeCanvas(c, w, h, scale) {
	c.width = Math.max(2, Math.round(w * scale)); c.height = Math.max(2, Math.round(h * scale));
	return c.getContext("2d");
}

/* ================= raised top aurora (levels 1-3) ================= */
const LEVEL = { 1: 0.3, 2: 0.55, 3: 0.8 };
const TOP_FS = GLSL + AURORA_FN + `
uniform float VH;
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 float vy=uv.y*VH;                       // viewport fraction of height
 vec2 p=vec2(uv.x,vy);
 float arch=pow(abs(2.*uv.x-1.),1.6);
 float edge=1.-.3*smoothstep(.0,1.,arch);
 vec4 A=aurora(vec2(uv.x,vy-.025*arch),1.);
 // crown: bright core at ~4-10% of the viewport, feathered out by ~22%
 float fade=smoothstep(0.,.025,vy)*(1.-smoothstep(.09,.225+.02*(vn(vec2(uv.x*3.,T*.02))-.5),vy));
 float k=AMP*edge*fade;
 gl_FragColor=dither(glow(A.rgb*k,A.a*k,1.35));
}`;

export function topAurora(root, { level = 1, reduced, host = root.querySelector(".scenery-b") }) {
	const dark = isDark();
	const VH = 0.3;
	const wrap = document.createElement("div");
	wrap.className = "ra-top-aurora";
	wrap.setAttribute("aria-hidden", "true");
	wrap.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${VH * 100}%;pointer-events:none;will-change:transform,opacity;contain:paint`;
	host.appendChild(wrap);
	const gl = new GL(wrap, TOP_FS, { scale: 0.4 });
	const amp = LEVEL[level] * 0.46 * (dark ? 1 : 1.8);
	const s = { x: 0.5, y: 0.1, tx: 0.5, ty: 0.1, e: 0, t: 12, has: false, dead: false, vis: true };
	let raf = 0, last = 0, timer = 0, W = 1, Hh = 1, pend = 0, started = false;
	const size = () => { const r = host.getBoundingClientRect(); W = r.width; Hh = r.height; gl.resize(W, Hh * VH); draw(0.016, true); };
	const ro = new ResizeObserver(size);
	ro.observe(host);
	function draw(dt, force) {
		if (!gl.ok) return;
		const a = reduced ? 1 : 1 - Math.exp(-dt * 4.5);
		const ox = s.x, oy = s.y;
		s.x += (s.tx - s.x) * a; s.y += (s.ty - s.y) * a;
		const sp = Math.hypot(s.x - ox, (s.y - oy) * 0.6) / Math.max(dt, 0.001);
		s.e += (Math.min(1, sp / 1.4) - s.e) * (1 - Math.exp(-dt * 2));
		if (!reduced) s.t += dt * (0.6 + s.e * 2);
		gl.draw({ T: s.t, DK: dark ? 1 : 0, AMP: amp, E: s.e, M: [s.x, s.y], VH,
			BASE: 0.1, HGT: 0.075, WOB: 0.16, LS: 0.016, RAYS: 0.7, WX: 3.0, WAVE: 0.16, PULL: 0.4, LOWF: 0.025 });
	}
	function frame(now) {
		raf = 0;
		if (s.dead || document.hidden || !s.vis) return;
		const gap = now - last;
		if (gap >= 1000 / 24 - 3) { last = now; draw(Math.min(0.1, gap / 1000)); }
		raf = requestAnimationFrame(frame);
	}
	const wake = () => {
		if (s.dead || !started || document.hidden || !s.vis) return;
		if (reduced) { draw(0.016); return; }
		if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
	};
	// scroll: ride up and fade out over ~460px; transform + opacity only
	const apply = () => {
		pend = 0;
		const y = root.scrollTop;
		wrap.style.transform = y ? `translate3d(0,${(-y * 0.55).toFixed(1)}px,0)` : "";
		wrap.style.opacity = y ? String(clamp(1 - y / 460).toFixed(3)) : "";
		const vis = y < 470;
		if (vis !== s.vis) { s.vis = vis; if (vis) wake(); }
	};
	const onScroll = () => { if (!pend) pend = requestAnimationFrame(apply); };
	root.addEventListener("scroll", onScroll, { passive: true });
	const onMove = (e) => {
		if (e.pointerType === "touch") return;
		const r = host.getBoundingClientRect();
		s.tx = (e.clientX - r.left) / Math.max(1, r.width); s.ty = (e.clientY - r.top) / Math.max(1, r.height); s.has = true;
		wake();
	};
	const onOut = (e) => { if (!e.relatedTarget) { s.tx = 0.5; s.ty = 0.1; } };
	addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerout", onOut, { passive: true });
	const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake(); };
	document.addEventListener("visibilitychange", onVis);
	gl.onFail = () => {};
	started = true; apply(); size(); wake();
	return () => {
		s.dead = true; cancelAnimationFrame(raf); cancelAnimationFrame(pend); ro.disconnect();
		root.removeEventListener("scroll", onScroll);
		removeEventListener("pointermove", onMove);
		document.removeEventListener("pointerout", onOut);
		document.removeEventListener("visibilitychange", onVis);
		gl.destroy(); wrap.remove();
	};
}

/* ================= margin sky: stars / galaxy wisps in the side margins ================= */
export function marginSky(root, { dark, wisps = false, stars = true, seed = 5, host = root.querySelector(".scenery-c") }) {
	const wrap = document.createElement("div");
	wrap.className = "ra-margin-sky";
	wrap.setAttribute("aria-hidden", "true");
	host.appendChild(wrap);
	let cancel = () => {};
	const build = () => {
		wrap.textContent = "";
		const W = host.clientWidth, H = host.clientHeight;
		const col = 416 + 24; // half of the 52rem column + gutter
		const mw = (W - col * 2) / 2;
		if (mw < 70) return; // CSS also hides below ~800px
		const r = rng(seed);
		const inMargin = (x) => x < mw - 6 || x > W - mw + 6;
		const toDraw = [];
		// wisps: a soft diagonal galaxy band in each margin, from soft pre-baked radial blobs
		const mk = (cls, drawFn, op) => {
			const c = document.createElement("canvas");
			const sc = cls === "wisp" ? 0.5 : 1;
			c.width = Math.round(W * sc); c.height = Math.round(H * sc);
			c.className = `ra-ms ${cls}`; c.style.opacity = op;
			drawFn(c.getContext("2d"), sc);
			wrap.appendChild(c);
			return c;
		};
		if (wisps) {
			mk("wisp", (g, sc) => {
				g.scale(sc, sc);
				const blobs = [];
				for (const side of [0, 1]) {
					const cx = side ? W - mw * 0.5 : mw * 0.5;
					for (let i = 0; i < 9; i++) {
						const t = i / 8;
						blobs.push([cx + (side ? -1 : 1) * (t - 0.5) * 70 + (r() - 0.5) * 50, H * (0.08 + t * 0.5) + (r() - 0.5) * 40, 90 + r() * 120, r()]);
					}
				}
				const C = dark ? [[110, 150, 255], [150, 110, 255], [90, 200, 220]] : [[150, 190, 240], [200, 170, 240], [150, 215, 215]];
				for (const [x, y, rad, k] of blobs) {
					const c = C[(k * 3) | 0];
					const gr = g.createRadialGradient(x, y, 0, x, y, rad);
					const a = dark ? 0.07 : 0.09;
					gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`);
					gr.addColorStop(0.5, `rgba(${c[0]},${c[1]},${c[2]},${a * 0.45})`);
					gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
					g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
				}
			}, 1);
		}
		if (stars && dark) {
			for (let layer = 0; layer < 2; layer++) {
				mk(`stars s${layer}`, (g) => {
					const n = Math.round(W * H / 8500);
					for (let i = 0; i < n; i++) {
						const x = r() * W, y = Math.pow(r(), 1.35) * H * 0.7;
						if (!inMargin(x)) continue;
						const edge = x < mw ? x / mw : (W - x) / mw;
						const dens = 0.35 + 0.65 * smooth(0, 0.7, edge);
						if (r() > dens) continue;
						const b = 0.25 + Math.pow(r(), 2.2) * 0.6;
						const rad = r() < 0.07 ? 1.25 : 0.55 + r() * 0.5;
						g.fillStyle = r() < 0.2 ? `rgba(190,215,255,${b})` : `rgba(235,240,255,${b})`;
						g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
					}
				}, 1);
			}
		}
	};
	cancel = idle(build);
	const ro = new ResizeObserver(() => { cancel(); cancel = idle(build); });
	ro.observe(host);
	return () => { cancel(); ro.disconnect(); wrap.remove(); };
}

/* ================= silhouettes ================= */
// ridge height function: sum of sines, deterministic
export function ridgeFn(seed, { amp = 20, f = 0.006, oct = 3 } = {}) {
	const r = rng(seed);
	const ph = Array.from({ length: oct }, () => r() * TAU);
	const fr = Array.from({ length: oct }, (_, i) => f * Math.pow(2.15, i) * (0.9 + r() * 0.25));
	return (x) => { let h = 0, a = 1, n = 0; for (let i = 0; i < oct; i++) { h += a * Math.sin(x * fr[i] + ph[i]); n += a; a *= 0.5; } return (h / n) * amp; };
}
// A spruce silhouette with layered boughs; (x, base) is the foot.
export function spruce(g, x, base, h, w, lean = 0) {
	const tiers = Math.max(5, Math.round(h / 8));
	g.beginPath();
	g.moveTo(x + lean, base - h);
	const right = [], left = [];
	for (let k = 1; k <= tiers; k++) {
		const t = k / tiers;
		const yy = base - h + h * t * 0.96;
		const ww = w * (0.1 + 0.9 * t) * (0.86 + 0.14 * ((k * 7) % 3) / 2);
		const lx = x + lean * (1 - t);
		right.push([lx + ww, yy], [lx + ww * 0.42, yy - h * 0.012]);
		left.push([lx - ww * 0.42, yy - h * 0.012], [lx - ww, yy]);
	}
	for (const [px, py] of right) g.lineTo(px, py);
	g.lineTo(x + w * 0.07, base); g.lineTo(x - w * 0.07, base);
	for (let i = left.length - 1; i >= 0; i--) g.lineTo(left[i][0], left[i][1]);
	g.closePath(); g.fill();
}
export function ridgePath(g, W, H, base, fn, step = 4) {
	g.beginPath(); g.moveTo(0, H);
	for (let x = 0; x <= W + step; x += step) g.lineTo(x, base - fn(x));
	g.lineTo(W, H); g.closePath();
}

/* ================= birds ================= */
export function drawBird(g, x, y, s, flap, col) {
	g.strokeStyle = col; g.lineWidth = Math.max(0.9, s * 0.13); g.lineCap = "round"; g.lineJoin = "round";
	const up = flap * s * 0.55;
	g.beginPath();
	g.moveTo(x - s, y + up * 0.5 - s * 0.05);
	g.quadraticCurveTo(x - s * 0.45, y - s * 0.28 - up, x, y);
	g.quadraticCurveTo(x + s * 0.45, y - s * 0.28 - up, x + s, y + up * 0.5 - s * 0.05);
	g.stroke();
}
// A loose, sparse flock system: groups cross the sky at long intervals.
export class Birds {
	constructor({ seed = 3, W = 1, H = 1, band = [0.1, 0.4], speed = [14, 24], gap = [7, 18], size = [4, 6.5] }) {
		this.r = rng(seed); this.W = W; this.H = H; this.o = { band, speed, gap, size };
		this.list = []; this.wait = 1.5;
	}
	spawn() {
		const { r, W, H, o } = this;
		const dir = r() < 0.5 ? 1 : -1;
		const n = 1 + ((r() * 4) | 0);
		const y0 = H * lerp(o.band[0], o.band[1], r());
		const v = lerp(o.speed[0], o.speed[1], r()) * dir;
		const sz = lerp(o.size[0], o.size[1], r());
		for (let i = 0; i < n; i++) {
			this.list.push({ x: dir > 0 ? -20 - i * (14 + r() * 10) : W + 20 + i * (14 + r() * 10), y: y0 + (i - n / 2) * (5 + r() * 4) * (0.6 + r()), v: v * (0.95 + r() * 0.1), s: sz * (0.85 + r() * 0.3), ph: r() * TAU, f: 3.4 + r() * 1.6, d: i });
		}
	}
	update(dt) {
		this.wait -= dt;
		if (this.wait <= 0) { this.spawn(); this.wait = lerp(this.o.gap[0], this.o.gap[1], this.r()); }
		for (const b of this.list) { b.x += b.v * dt; b.ph += dt * b.f; }
		this.list = this.list.filter((b) => b.x > -60 && b.x < this.W + 60);
	}
	draw(g, col) {
		for (const b of this.list) {
			const f = Math.sin(b.ph);
			// glide a bit: flap in bursts
			const glide = 0.5 + 0.5 * Math.sin(b.ph * 0.23 + b.d);
			drawBird(g, b.x, b.y + Math.sin(b.ph * 0.5) * 1.2, b.s, f * (0.35 + 0.65 * glide), col);
		}
	}
	get active() { return this.list.length > 0; }
}

/* ================= loon (original, vector) ================= */
// Draws a common-loon-like bird swimming rightwards, bow at +x, centered on the waterline at (x, y).
// `sc` scales (body length ~ 44*sc); `head` in [-1,1] turns/dips the head; `dark` selects plumage palette.
export function drawLoon(g, x, y, sc, { dark, head = 0, dir = 1, rim = [120, 220, 190] } = {}) {
	g.save();
	g.translate(x, y); g.scale(dir * sc, sc);
	const body = dark ? "#070c18" : "#1a2538";
	const back = dark ? "#0a1222" : "#223048";
	const white = dark ? "rgba(214,226,242,.85)" : "#f2f5f8";
	// body: low in the water, slightly raised stern
	g.fillStyle = body;
	g.beginPath();
	g.moveTo(-24, -1);
	g.bezierCurveTo(-27, -5, -20, -9, -8, -9.5);
	g.bezierCurveTo(2, -10, 11, -8.5, 16, -5.5);
	g.bezierCurveTo(19, -4, 19, -1, 17, 0);
	g.lineTo(-24, 0);
	g.closePath(); g.fill();
	// back highlight (aurora rim light) and checker spots
	g.fillStyle = back;
	g.beginPath(); g.ellipse(-4, -7.2, 15, 2.6, -0.04, 0, TAU); g.fill();
	g.strokeStyle = `rgba(${rim[0]},${rim[1]},${rim[2]},${dark ? 0.55 : 0.0})`;
	g.lineWidth = 0.7;
	g.beginPath(); g.moveTo(-22, -4.6); g.bezierCurveTo(-18, -9, -6, -10, 3, -9.5); g.bezierCurveTo(9, -9.2, 14, -7.8, 16, -5.8); g.stroke();
	g.fillStyle = white;
	for (let i = 0; i < 9; i++) { const px = -17 + i * 3.5, py = -7.6 + (i % 2) * 1.6; g.globalAlpha = dark ? 0.55 : 0.85; g.fillRect(px, py, 1.1, 0.9); }
	g.globalAlpha = 1;
	// neck + head (S curve), head tilt by `head`
	const hy = -9 + head * 1.2;
	g.fillStyle = body;
	g.beginPath();
	g.moveTo(10, -6);
	g.bezierCurveTo(14, -10, 17, -15 + head, 17.5, -20 + head * 2);
	g.bezierCurveTo(17.8, -23, 21, -24.6, 24, -23.4 + head);
	g.lineTo(34, -21.6 + head * 2.4);       // dagger bill tip
	g.lineTo(24.6, -20.4 + head);
	g.bezierCurveTo(22.6, -19.4, 21.8, -16, 21, -12);
	g.bezierCurveTo(20.6, -8, 18, -4.6, 14, -3);
	g.closePath(); g.fill();
	// white throat necklace
	g.strokeStyle = white; g.lineWidth = 0.9; g.globalAlpha = dark ? 0.7 : 0.95;
	for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(18.4 + i * 0.25, -14.6 + i * 1.1); g.lineTo(21.2 + i * 0.1, -14 + i * 1.1); g.stroke(); }
	g.globalAlpha = 1;
	// red eye
	g.fillStyle = "#e0485a"; g.beginPath(); g.arc(23, -22.4 + head, 0.8, 0, TAU); g.fill();
	g.restore();
}
