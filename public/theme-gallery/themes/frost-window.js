// 134 — Frost Window: crystalline frost grows in from the edges of a pane; the cursor's warmth melts clear trails (patterned by the crystals) that slowly refreeze.
import { createLoop, initGL, makePingPong, makeProgram, bindTex, pass, mountCanvas, trackPointer, GLSL_NOISE } from "./kit-126-135/kit.js";

const SIM = `
uniform sampler2D prev;
uniform vec2 res;
uniform float dpr;
uniform vec4 seg;
uniform float amt;
uniform float freeze;
out vec4 o;
float dseg(vec2 p, vec2 a, vec2 b){ vec2 ab=b-a; float t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-4),0.,1.); return length(p-a-ab*t); }
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 px = 1.0/res;
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
  float m = texture(prev, uv).r;
  float n = (texture(prev, uv+vec2(px.x,0)).r + texture(prev, uv-vec2(px.x,0)).r + texture(prev, uv+vec2(0,px.y)).r + texture(prev, uv-vec2(0,px.y)).r) * 0.25;
  m = mix(m, n, 0.06);
  m = max(m - freeze, 0.0);
  if (amt > 0.0){
    float d = dseg(p, seg.xy, seg.zw);
    m = max(m, amt * smoothstep(34.0, 6.0, d));
  }
  o = vec4(m, 0.0, 0.0, 1.0);
}`;

const RENDER = `
${GLSL_NOISE}
uniform sampler2D state;
uniform vec2 res;
uniform float dpr;
uniform vec3 skyT, skyB, bokehA, bokehB, frostC, frostD;
uniform float darkMode;
out vec4 o;

float ridged(vec2 q){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ float n = 1.0 - abs(2.0*vnoise(q)-1.0); s += a*n*n; q = q*2.1 + vec2(3.7,1.3); a*=0.5; } return s; }

vec3 scene(vec2 p, vec2 size){
  float t = p.y / size.y;
  vec3 col = mix(skyT, skyB, smoothstep(0.0, 1.0, t));
  // out-of-focus lights
  for (int k=0;k<2;k++){
    float sc = k==0 ? 150.0 : 90.0;
    vec2 g = p/sc + float(k)*11.3;
    vec2 i = floor(g), f = fract(g);
    for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){
      vec2 b = vec2(float(x), float(y));
      vec2 id = i + b;
      float on = step(0.55, h21(id*1.7 + 5.0));
      vec2 c = b + 0.2 + 0.6*vec2(h21(id+1.3), h21(id+7.1));
      float r = 0.18 + 0.2*h21(id+3.3);
      float d = length(c - f);
      float disc = smoothstep(r, r*0.55, d) * on;
      vec3 bc = mix(bokehA, bokehB, h21(id+9.0));
      col += bc * disc * (k==0 ? 0.2 : 0.14);
    }
  }
  return col;
}
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 size = res / dpr;
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
  float m = texture(state, uv).r;
  // distance to the nearest pane edge, and the crystal growth direction
  float dl = p.x, dr = size.x - p.x, dt = p.y, db = size.y - p.y;
  float dEdge = min(min(dl, dr), min(dt, db));
  bool horiz = min(dt, db) < min(dl, dr);
  vec2 q = horiz ? vec2(p.x/26.0, dEdge/120.0) : vec2(p.y/26.0, dEdge/120.0);
  q += 1.3*vec2(vnoise(p/90.0), vnoise(p/90.0+4.0));
  float fronds = ridged(q);
  float fine = ridged(p/13.0 + 2.0);
  float pat = clamp(0.62*fronds + 0.38*fine, 0.0, 1.0);
  float cov = 1.0 - smoothstep(20.0, 300.0, dEdge + 70.0*(vnoise(p/60.0)-0.5));
  cov = mix(0.5, 1.0, cov);
  // frost is thinner (more transparent) in the open pane
  float thick = clamp(cov * (0.55 + 0.7*pat), 0.0, 1.0);
  // refreezing is patterned: each point has its own freezing threshold
  float thr = 0.12 + 0.76*vnoise(p/9.0)*0.5 + 0.38*vnoise(p/31.0);
  float alive = smoothstep(thr - 0.1, thr + 0.1, 1.0 - m*1.15);
  float a = clamp(thick * alive * 0.95, 0.0, 0.95);
  vec3 sc = scene(p, size);
  vec3 fc = mix(frostD, frostC, pat);
  fc += (h21(floor(gl_FragCoord.xy)) - 0.5) * 0.03;
  // sparkle on crystal ridges
  float sp = pow(max(fine - 0.55, 0.0) * 2.4, 2.0) * step(0.8, h21(floor(p/3.0)));
  fc += sp * (darkMode > 0.5 ? 0.5 : 0.25);
  vec3 col = mix(sc, fc, a);
  // wet edge where the frost has just melted
  float wet = smoothstep(0.05, 0.4, m) * (1.0 - smoothstep(0.4, 0.95, m)) * thick;
  col += wet * (darkMode > 0.5 ? 0.06 : 0.1);
  col *= 1.0 - 0.08*pow(length(uv-0.5)*1.25, 2.0);
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
	let state = null;
	let loop = null;
	view.onResize = () => {
		state?.dispose();
		state = makePingPong(gl, Math.round(view.w / 2), Math.round(view.h / 2), { internal: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT });
		state.clear();
		loop?.wake();
	};
	view.onResize();
	const pal = dark
		? { skyT: [0.03, 0.06, 0.14], skyB: [0.07, 0.1, 0.18], bokehA: [1.0, 0.65, 0.3], bokehB: [0.3, 0.7, 0.85], frostC: [0.38, 0.5, 0.62], frostD: [0.12, 0.18, 0.27] }
		: { skyT: [0.42, 0.62, 0.82], skyB: [0.86, 0.72, 0.58], bokehA: [1.0, 0.8, 0.4], bokehB: [0.4, 0.7, 0.5], frostC: [0.97, 0.99, 1.0], frostD: [0.8, 0.88, 0.96] };
	const render = () => {
		renP.use();
		bindTex(gl, 0, state.read.tex);
		renP.i1("state", 0);
		renP.f2("res", view.w, view.h);
		renP.f1("dpr", view.dpr);
		for (const k of ["skyT", "skyB", "bokehA", "bokehB", "frostC", "frostD"]) renP.f3(k, ...pal[k]);
		renP.f1("darkMode", dark ? 1 : 0);
		pass(gl, null, view.w, view.h);
	};
	const cleanup = () => {
		loop?.stop();
		tracker?.destroy();
		state.dispose();
		view.destroy();
		ctx.destroy();
	};
	let tracker = null;
	if (reducedMotion) {
		render();
		return cleanup;
	}
	let pending = null;
	let lastActive = 0;
	tracker = trackPointer(layer, {
		onMove(p) {
			pending = pending ? [pending[0], pending[1], p.x, p.y] : [p.px, p.py, p.x, p.y];
			lastActive = performance.now();
			loop.wake();
		},
	});
	let acc = 0;
	loop = createLoop((dt, now) => {
		acc += dt;
		let steps = 0;
		while (acc >= 1 / 60 && steps < 3) {
			acc -= 1 / 60;
			steps++;
			simP.use();
			bindTex(gl, 0, state.read.tex);
			simP.i1("prev", 0);
			simP.f2("res", state.w, state.h);
			simP.f1("dpr", view.dpr / 2);
			simP.f4("seg", ...(pending ?? [0, 0, 0, 0]));
			simP.f1("amt", pending ? 1 : 0);
			simP.f1("freeze", 1 / (60 * 8));
			pass(gl, state.write, state.w, state.h);
			state.swap();
			pending = null;
		}
		if (steps) render();
		return now - lastActive < 9500 || pending !== null;
	});
	render();
	return cleanup;
}
