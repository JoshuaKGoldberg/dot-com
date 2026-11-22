// 128 — Water Ripples: a damped wave-equation heightfield (WebGL2 ping-pong, ~1/3 res) that refracts a pebble bed.
import { createLoop, initGL, makePingPong, makeProgram, bindTex, pass, mountCanvas, trackPointer, GLSL_NOISE } from "./kit-126-135/kit.js";

const SIM = `
uniform sampler2D prev;
uniform vec2 res;       // sim texels
uniform vec4 seg;       // sim-texel coords: p0 p1
uniform float amp;
uniform float damp;
out vec4 o;
float dseg(vec2 p, vec2 a, vec2 b){ vec2 ab=b-a; float t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-4),0.,1.); return length(p-a-ab*t); }
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 px = 1.0 / res;
  vec4 s = texture(prev, uv);
  float n = texture(prev, uv+vec2(px.x,0)).r + texture(prev, uv-vec2(px.x,0)).r + texture(prev, uv+vec2(0,px.y)).r + texture(prev, uv-vec2(0,px.y)).r;
  float nh = (n*0.5 - s.g) * damp;
  if (amp != 0.0){
    float d = dseg(gl_FragCoord.xy, seg.xy, seg.zw);
    nh += amp * exp(-d*d/(2.0*1.7*1.7));
  }
  o = vec4(nh, s.r, 0.0, 1.0);
}`;

const RENDER = `
${GLSL_NOISE}
uniform sampler2D state;
uniform vec2 res;   // canvas px
uniform float dpr;
uniform vec3 pebA, pebB, pebC, tint, sky, grout;
uniform float tintAmt, flatten, specAmt, specAmt0;
out vec4 o;

vec3 bed(vec2 p){
  vec2 g = p / 54.0;
  vec2 i = floor(g), f = fract(g);
  float d1 = 9.0, d2 = 9.0; vec2 c1 = vec2(0.0); float id = 0.0;
  for (int y=-1; y<=1; y++) for (int x=-1; x<=1; x++){
    vec2 b = vec2(float(x), float(y));
    vec2 r = vec2(h21(i+b+3.1), h21(i+b+17.7));
    vec2 c = b + 0.15 + 0.7*r;
    float d = length((c - f) * vec2(1.0, 1.12));
    if (d < d1){ d2 = d1; d1 = d; c1 = c; id = h21(i+b+41.3); }
    else if (d < d2) d2 = d;
  }
  vec3 col = id < 0.4 ? pebA : (id < 0.75 ? pebB : pebC);
  col *= 0.88 + 0.24*h21(vec2(id*91.0, 5.0));
  float rim = smoothstep(0.0, 0.2, d2 - d1);
  vec2 off = (f - c1);
  float lit = 0.9 - 0.45*dot(off, vec2(-0.6,-0.7));
  col *= mix(0.7, lit, 0.8) * mix(0.82, 1.0, rim);
  col = mix(grout, col, mix(0.72, 1.0, rim));
  col *= 0.94 + 0.12*vnoise(p/6.0);
  // static caustic network
  float w1 = fbm(p/120.0 + vec2(3.0, 1.0));
  float w2 = fbm(p/70.0 - vec2(w1*2.0, 4.0));
  float cs = pow(1.0 - abs(2.0*w2 - 1.0), 7.0) * 0.5 + pow(1.0 - abs(2.0*w1 - 1.0), 9.0) * 0.45;
  col += cs * 0.16 * (0.5 + 0.5*tintAmt);
  return col;
}

void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
  vec2 px = 1.0 / vec2(textureSize(state, 0));
  float hc = texture(state, uv).r;
  float hx = texture(state, uv+vec2(px.x,0)).r - texture(state, uv-vec2(px.x,0)).r;
  float hy = texture(state, uv+vec2(0,px.y)).r - texture(state, uv-vec2(0,px.y)).r;
  float lap = texture(state, uv+vec2(px.x,0)).r + texture(state, uv-vec2(px.x,0)).r + texture(state, uv+vec2(0,px.y)).r + texture(state, uv-vec2(0,px.y)).r - 4.0*hc;
  vec2 slope = vec2(hx, -hy) * 14.0;
  vec3 col = bed(p + slope*24.0);
  // calm the bed behind the prose column
  float colMask = mix(flatten, 1.0, smoothstep(330.0, 520.0, abs(p.x - 0.5*res.x/dpr)));
  col = mix(tint, col, specAmt0 * colMask);
  col = mix(col, tint, tintAmt);
  col *= 1.0 + lap * 1.6;
  vec3 n = normalize(vec3(-slope*1.6, 1.0));
  vec3 L = normalize(vec3(-0.4, 0.5, 0.8));
  vec3 Hh = normalize(L + vec3(0,0,1));
  float sp = pow(max(dot(n, Hh), 0.0), 140.0);
  float fres = pow(1.0 - n.z, 2.0);
  col = mix(col, sky, clamp(fres*2.2, 0.0, 0.5));
  col += sp * specAmt;
  col *= 1.0 - 0.12*pow(length(uv-0.5)*1.3, 2.0);
  o = vec4(col, 1.0);
}`;

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { maxDpr: 1.5, scale: 0.75, type: "webgl2", opts: { antialias: false, alpha: false, powerPreference: "low-power" } });
	const ctx = initGL(view.canvas);
	if (!ctx || !ctx.floatRT) {
		view.destroy();
		return;
	}
	const { gl } = ctx;
	const simP = makeProgram(gl, SIM);
	const renP = makeProgram(gl, RENDER);
	let sim = null;
	let sw = 1;
	let sh = 1;
	let loop = null;
	let dirty = true;
	let lastDisturb = 0;
	let pending = [];
	const CELL = 3;
	view.onResize = () => {
		sw = Math.max(32, Math.round(view.cssW / CELL));
		sh = Math.max(32, Math.round(view.cssH / CELL));
		sim?.dispose();
		sim = makePingPong(gl, sw, sh, { internal: gl.RG16F, format: gl.RG, type: gl.HALF_FLOAT });
		sim.clear();
		dirty = true;
		loop?.wake();
	};
	view.onResize();

	const pal = dark
		? { pebA: [0.1, 0.2, 0.25], pebB: [0.13, 0.17, 0.24], pebC: [0.09, 0.2, 0.2], tint: [0.04, 0.12, 0.17], sky: [0.35, 0.55, 0.7], grout: [0.03, 0.08, 0.12], tintAmt: 0.1, flatten: 0.3, specAmt: 0.3, contrast: 0.75 }
		: { pebA: [0.8, 0.88, 0.88], pebB: [0.88, 0.9, 0.85], pebC: [0.74, 0.84, 0.88], tint: [0.8, 0.93, 0.96], sky: [1, 1, 1], grout: [0.62, 0.76, 0.8], tintAmt: 0.12, flatten: 0.3, specAmt: 0.45, contrast: 0.6 };

	const stepSim = (seg, amp) => {
		simP.use();
		bindTex(gl, 0, sim.read.tex);
		simP.i1("prev", 0);
		simP.f2("res", sw, sh);
		simP.f4("seg", ...(seg ?? [0, 0, 0, 0]));
		simP.f1("amp", amp);
		simP.f1("damp", 0.9925);
		pass(gl, sim.write, sw, sh);
		sim.swap();
	};
	const render = () => {
		renP.use();
		bindTex(gl, 0, sim.read.tex);
		renP.i1("state", 0);
		renP.f2("res", view.w, view.h);
		renP.f1("dpr", view.dpr);
		for (const k of ["pebA", "pebB", "pebC", "tint", "sky", "grout"]) renP.f3(k, ...pal[k]);
		renP.f1("tintAmt", pal.tintAmt);
		renP.f1("flatten", pal.flatten);
		renP.f1("specAmt", pal.specAmt);
		renP.f1("specAmt0", pal.contrast);
		pass(gl, null, view.w, view.h);
	};
	const toSim = (x, y) => [x / CELL, sh - y / CELL];
	const disturb = (x0, y0, x1, y1, amp) => {
		pending.push([...toSim(x0, y0), ...toSim(x1, y1), amp]);
		lastDisturb = performance.now();
		loop?.wake();
	};

	const cleanup = () => {
		loop?.stop();
		tracker?.destroy();
		window.removeEventListener("pointerdown", down);
		clearTimeout(timer);
		sim.dispose();
		view.destroy();
		ctx.destroy();
	};
	let tracker = null;
	let timer = 0;
	let down = () => {};
	if (reducedMotion) {
		render();
		return cleanup;
	}

	tracker = trackPointer(layer, {
		onMove(p) {
			const speed = Math.hypot(p.vx, p.vy);
			if (speed < 0.5) return;
			disturb(p.px, p.py, p.x, p.y, -Math.min(0.03 + speed * 0.006, 0.16));
		},
	});
	down = (e) => {
		const r = layer.getBoundingClientRect();
		disturb(e.clientX - r.left, e.clientY - r.top, e.clientX - r.left, e.clientY - r.top, 1.6);
	};
	window.addEventListener("pointerdown", down, { passive: true });

	let acc = 0;
	loop = createLoop((dt, now) => {
		acc += dt;
		let steps = 0;
		while (acc >= 1 / 120 && steps < 6) {
			acc -= 1 / 120;
			steps++;
			const d = pending.shift();
			if (d) stepSim(d.slice(0, 4), d[4]);
			else stepSim(null, 0);
		}
		if (steps) {
			render();
			dirty = false;
		}
		return now - lastDisturb < 7000 || pending.length > 0;
	});
	render();
	// a couple of drops on load, so a still page is never dead
	timer = setTimeout(() => {
		const w = view.cssW;
		const h = view.cssH;
		for (const [fx, fy, a] of [[0.12, 0.35, 1.5], [0.88, 0.62, 1.4]]) disturb(fx * w, fy * h, fx * w, fy * h, a);
	}, 500);
	return cleanup;
}
