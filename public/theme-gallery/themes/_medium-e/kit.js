// _medium-e: shared helpers for wave 11 themes #297-300 (intensity 3-5).
// - createRig: pointer smoothing, energy, throttled ambient loop, pause on hidden / off-screen
// - GLCanvas: tiny WebGL full-quad shader runner at reduced resolution (CSS upscale is the blur)
// - BAND_FS / HALO_FS: dithered aurora shaders (no y-dependent ray noise, so no horizontal banding)
// - contour helpers for the topographic margins

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export function rng(seed) {
	let s = seed >>> 0 || 1;
	return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const idle = (fn, timeout = 250) => {
	if ("requestIdleCallback" in window) { const id = requestIdleCallback(fn, { timeout }); return () => cancelIdleCallback(id); }
	const id = setTimeout(fn, 16); return () => clearTimeout(id);
};

/* ---------- rig: pointer + energy + calm loop ---------- */
export function createRig({ reduced, targets = [], fps = 24, rest = [0.62, 0.3], follow = 5, onFrame }) {
	const s = { t: 0, dt: 0, energy: 0, has: false, x: 0, y: 0, tx: 0, ty: 0, rest, busy: false, force: false };
	s.x = s.tx = rest[0] * innerWidth; s.y = s.ty = rest[1] * innerHeight;
	let raf = 0, timer = 0, last = 0, dead = false, started = false, visible = true, speed = 0;
	const vis = new Map();
	const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
		for (const e of es) vis.set(e.target, e.isIntersecting);
		visible = targets.length === 0 || [...vis.values()].some(Boolean);
		if (visible) wake(); else stopLoops();
	}) : null;
	for (const t of targets) { vis.set(t, true); io?.observe(t); }
	const stopLoops = () => { cancelAnimationFrame(raf); raf = 0; clearTimeout(timer); timer = 0; };
	function wake() {
		if (dead || !started || document.hidden || !visible) return;
		clearTimeout(timer); timer = 0;
		if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
	}
	function frame(now) {
		raf = 0; if (dead) return;
		const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
		step(dt);
	}
	function step(dt) {
		s.dt = dt;
		const a = reduced ? 1 : 1 - Math.exp(-dt * follow);
		const ox = s.x, oy = s.y;
		if (!s.has) { s.tx = rest[0] * innerWidth; s.ty = rest[1] * innerHeight; }
		s.x += (s.tx - s.x) * a; s.y += (s.ty - s.y) * a;
		let busy = false;
		if (Math.abs(s.tx - s.x) < 0.4 && Math.abs(s.ty - s.y) < 0.4) { s.x = s.tx; s.y = s.ty; } else busy = true;
		speed = speed * 0.6 + (Math.hypot(s.x - ox, s.y - oy) / dt) * 0.4;
		if (speed < 5) speed = 0; else busy = true;
		const target = reduced ? 0 : Math.min(1, speed / 650);
		s.energy += (target - s.energy) * (1 - Math.exp(-dt * 2.2));
		if (s.energy < 0.01) s.energy = 0; else busy = true;
		if (!reduced) s.t += dt * (1 + s.energy * 2.2);
		s.busy = busy;
		onFrame(s);
		s.force = false;
		if (dead) return;
		if (busy) raf = requestAnimationFrame(frame);
		else if (!reduced && !document.hidden && visible) timer = setTimeout(() => { timer = 0; step(1 / fps); }, 1000 / fps);
	}
	const onMove = (e) => {
		if (e.pointerType === "touch") return;
		s.has = true; s.tx = e.clientX; s.ty = e.clientY; wake();
	};
	const onOut = (e) => { if (!e.relatedTarget && s.has) { s.has = false; wake(); } };
	const onVis = () => { if (document.hidden) stopLoops(); else wake(); };
	addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerout", onOut, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	return {
		s, wake,
		start() { started = true; s.force = true; if (reduced) { s.t = 6; step(0.016); } else wake(); },
		redraw() { if (!started) return; s.force = true; if (reduced) step(0.016); else wake(); },
		destroy() {
			dead = true; stopLoops(); io?.disconnect();
			removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerout", onOut);
			document.removeEventListener("visibilitychange", onVis);
		},
	};
}

/* ---------- WebGL runner ---------- */
const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
export class GLCanvas {
	constructor(parent, fs, { scale = 0.35, css = "" } = {}) {
		this.scale = scale;
		this.c = document.createElement("canvas");
		this.c.width = this.c.height = 2;
		this.c.setAttribute("aria-hidden", "true");
		this.c.style.cssText = "position:absolute;display:block;pointer-events:none;width:100%;height:100%;left:0;top:0;" + css;
		parent.appendChild(this.c);
		this.ok = false;
		this.c.addEventListener("webglcontextlost", (this.onLost = (e) => { e.preventDefault(); this.ok = false; this.onFail?.(); }));
		const gl = this.gl = this.c.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true, depth: false, stencil: false, powerPreference: "low-power" });
		if (!gl) return;
		const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(x)); return null; } return x; };
		const vs = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, fs);
		if (!vs || !f) return;
		const pr = gl.createProgram();
		gl.attachShader(pr, vs); gl.attachShader(pr, f); gl.linkProgram(pr);
		if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
		this.pr = pr; gl.useProgram(pr);
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const loc = gl.getAttribLocation(pr, "p");
		gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
		this.locs = {};
		this.ok = true;
	}
	resize(cssW, cssH) {
		this.c.width = Math.max(2, Math.round(cssW * this.scale));
		this.c.height = Math.max(2, Math.round(cssH * this.scale));
		if (this.ok) this.gl.viewport(0, 0, this.c.width, this.c.height);
	}
	draw(u) {
		if (!this.ok) return;
		const gl = this.gl;
		gl.clear(gl.COLOR_BUFFER_BIT);
		u.R = [this.c.width, this.c.height];
		for (const k in u) {
			const loc = this.locs[k] ??= gl.getUniformLocation(this.pr, k);
			if (loc === null) continue;
			const v = u[k];
			if (typeof v === "number") gl.uniform1f(loc, v);
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

const COMMON = `precision highp float;
uniform vec2 R,M;uniform float T,E,DK,AMP;
float hash(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
float n1(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(hash(vec2(i,3.7)),hash(vec2(i+1.,3.7)),f);}
vec3 pal(float t){

 vec3 g=vec3(.22,1.,.6),b=vec3(.2,.75,1.),v=vec3(.68,.45,1.),r=vec3(1.,.4,.62);
 vec3 c=mix(g,b,smoothstep(0.,.4,t));c=mix(c,v,smoothstep(.35,.85,t));return mix(c,r,smoothstep(.85,1.1,t)*.5);}
// premultiplied output with ordered-noise dither so low-alpha gradients never band
vec4 finish(vec3 col,float a){
 float al=1.-exp(-a*1.35);
 vec3 hue=col/(a+.0005);
 vec4 o;
 if(DK>.5){o=vec4(hue*al*.92,al*.62);}
 else{hue=mix(vec3(dot(hue,vec3(.33))),hue,1.2)*vec3(.5,.74,.8);float l=al*.62;o=vec4(hue*l,l);}
 float d=(hash(gl_FragCoord.xy)-.5)/255.;
 o.rgb+=d*o.a;o.a+=d*.5;
 return clamp(o,0.,1.);}
`;

export const BAND_FS = COMMON + `
uniform float FOG,RAYS,HGT,WX,WAVE,LOWF,BASE,FADE;
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 float x=uv.x*WX;
 float prox=mix(1.,.45,smoothstep(.6,2.6,M.y));
 float g=exp(-pow((uv.x-M.x)*1.9,2.))*(.55+E*.8)*prox;
 vec3 col=vec3(0.);float a=0.;
 for(int L=0;L<3;L++){
  float fl=float(L);
  float t=T*(.03+.008*fl);
  float yc=.4+BASE+.07*fl+(fbm(vec2(x*.75+fl*3.1,t))-.5)*.9+(vn(vec2(x*2.3+fl*5.,t*1.5))-.5)*.12+(vn(vec2(x*4.1+fl*2.3,t*2.))-.5)*WAVE+sin(x*3.+fl*2.+t*3.)*WAVE*.25;
  yc+=(clamp(M.y,.15,.7)-yc)*.15*g;
  float xx=x-(uv.x-M.x)*.12*g*WX;
  float ray=mix(1.,.4+.6*smoothstep(.2,.8,fbm(vec2(xx*13.+fl*9.,t*3.))),RAYS);
  float hg=HGT*(.75+.5*fbm(vec2(xx*1.6+fl*5.,t*2.)))*(1.+.45*g)*(1.-.1*fl);
  float d=yc-uv.y;
  float lower=smoothstep(-.13-LOWF,.03,d);
  float v=(exp(-max(d,0.)/hg*2.2)*lower+.3*exp(-pow((d+.01)/(.05+LOWF*.5),2.)))*ray;
  v*=(.5+.85*g)*(1.-.18*fl);
  col+=pal(clamp(d/(hg*1.8),0.,1.)+fl*.12)*v;a+=v;
 }
 float f=fbm(vec2(x*.8+T*.012,uv.y*1.4-T*.006));
 float fm=smoothstep(.35,.85,f)*FOG*(1.-smoothstep(.2,.95,uv.y));
 col+=pal(.2+.5*f)*fm*.4;a+=fm*.4;
 float fade=(.18+.82*smoothstep(0.,.36,uv.y))*(1.-smoothstep(.28+FADE,.7+FADE,uv.y+(vn(vec2(x*2.2,T*.02+3.))-.5)*(.3+FADE*1.5)));
 gl_FragColor=finish(col*fade*AMP,a*fade*AMP);
}`;

export const HALO_FS = COMMON + `
uniform vec2 C;uniform float RAD;
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 float asp=R.x/R.y;
 vec2 q=(uv-C)*vec2(asp,1.)/RAD;
 vec2 mc=(M-C)*vec2(asp,1.)/RAD;
 float md=length(mc);vec2 cdir=mc/max(md,.001);
 float prox=clamp(1.-md/10.,0.,1.)*.75+.25;
 float r=length(q);vec2 dir=q/max(r,.001);
 float up=smoothstep(-.4,.8,-dir.y);
 float lobe=pow(max(0.,dot(dir,cdir)),2.)*prox*(.5+E*1.1)*(.25+.75*up);
 float angW=.16+.84*up;
 vec3 col=vec3(0.);float a=0.;
 for(int L=0;L<3;L++){
  float fl=float(L);
  float t=T*(.05+.012*fl);
  float r0=1.07+.09*fl+(vn(dir*1.6+vec2(fl*4.,t*2.))-.5)*.2+lobe*.1;
  float ray=.4+.6*smoothstep(.25,.85,fbm(dir*3.2+vec2(fl*7.,t*3.)));
  float d=r-r0;
  float hg=(.5+.4*up+.6*lobe)*(1.-.12*fl);
  float v=exp(-max(d,0.)/hg*2.4)*smoothstep(-.12,.04,d)*ray*angW*(.7+.9*lobe);
  col+=pal(clamp(d/hg*.55,0.,1.)+fl*.18+lobe*.1)*v;a+=v;
 }
 float sp=exp(-(q.x*q.x/2.6+pow(q.y+1.75,2.)/1.1))*(.55+.45*fbm(vec2(q.x*1.2,q.y*.8-T*.03)));
 col+=pal(.4+.25*sin(T*.05+q.x*.5))*sp*.28;a+=sp*.28;
 float ef=smoothstep(0.,.12,uv.x)*smoothstep(1.,.88,uv.x)*smoothstep(0.,.1,uv.y)*smoothstep(1.,.8,uv.y)*(1.-smoothstep(.9,2.3,q.x));
 gl_FragColor=finish(col*ef*AMP,a*ef*AMP);
}`;

/* ---------- contours ---------- */
// Smooth height field: a few anisotropic gaussian massifs per margin plus a gentle swell.
export function heightField(vw, vh, colL, colR) {
	const r = rng(299);
	const sx = clamp(vw * 0.13, 150, 300), sy = vh * 0.3;
	const hills = [];
	const side = (cx, flip) => {
		hills.push([cx + flip * sx * 0.15, vh * (0.3 + r() * 0.06), 1.0, sx * 1.1, sy * 1.0, flip * 0.35]);
		hills.push([cx - flip * sx * 0.3, vh * (0.82 + r() * 0.06), 0.62, sx * 0.9, sy * 0.7, -flip * 0.4]);
		hills.push([cx + flip * sx * 0.5, vh * 0.58, 0.3, sx * 0.5, sy * 0.4, 0.2]);
	};
	side(Math.max(0, colL) * 0.55, 1);
	side(vw - Math.max(0, vw - colR) * 0.55, -1);
	return (x, y) => {
		let h = 0;
		for (const [bx, by, A, a, b, rot] of hills) {
			const dx = x - bx, dy = y - by;
			const c = Math.cos(rot), s = Math.sin(rot);
			const u = (dx * c + dy * s) / a, v = (-dx * s + dy * c) / b;
			h += A * Math.exp(-(u * u + v * v));
		}
		return h + 0.035 * Math.sin(x / 190 + y / 260) + 0.025 * Math.sin(y / 120 - x / 310 + 1.3);
	};
}
// Marching squares over [x0,x1]x[0,h]; returns an array of segments [x1,y1,x2,y2] per level.
export function contourSegments(f, x0, x1, h, cell, levels) {
	const nx = Math.ceil((x1 - x0) / cell), ny = Math.ceil(h / cell);
	const W = nx + 1;
	const g = new Float32Array(W * (ny + 1));
	for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) g[j * W + i] = f(x0 + i * cell, j * cell);
	return levels.map((lv) => {
		const out = [];
		const L = (a, b) => (lv - a) / (b - a);
		for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
			const a = g[j * W + i], b = g[j * W + i + 1], c = g[(j + 1) * W + i + 1], e = g[(j + 1) * W + i];
			const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (e > lv ? 1 : 0);
			if (idx === 0 || idx === 15) continue;
			const X = x0 + i * cell, Y = j * cell;
			const T = [X + L(a, b) * cell, Y], Rr = [X + cell, Y + L(b, c) * cell], B = [X + L(e, c) * cell, Y + cell], Lf = [X, Y + L(a, e) * cell];
			const pairs = { 1: [Lf, B], 2: [B, Rr], 3: [Lf, Rr], 4: [T, Rr], 5: [T, Lf, B, Rr], 6: [T, B], 7: [T, Lf], 8: [T, Lf], 9: [T, B], 10: [T, Rr, Lf, B], 11: [T, Rr], 12: [Lf, Rr], 13: [B, Rr], 14: [Lf, B] }[idx];
			for (let k = 0; k < pairs.length; k += 2) out.push([pairs[k][0], pairs[k][1], pairs[k + 1][0], pairs[k + 1][1]]);
		}
		return out;
	});
}

/* ---------- scroll-away: an element rides the scroll at a fraction of its speed and fades out.
   transform + opacity only, set from a passive scroll handler. Returns cleanup. ---------- */
export function scrollAway(root, el, { rate = 0.6, fade = 460 } = {}) {
	let pending = 0;
	el.style.willChange = "transform, opacity";
	const apply = () => {
		pending = 0;
		const y = root.scrollTop;
		el.style.transform = y ? `translate3d(0,${(-y * rate).toFixed(1)}px,0)` : "";
		el.style.opacity = y ? String(clamp(1 - y / fade).toFixed(3)) : "";
	};
	const on = () => { if (!pending) pending = requestAnimationFrame(apply); };
	root.addEventListener("scroll", on, { passive: true });
	apply();
	return () => { root.removeEventListener("scroll", on); cancelAnimationFrame(pending); };
}
