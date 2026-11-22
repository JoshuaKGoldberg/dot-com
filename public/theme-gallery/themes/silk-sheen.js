// 131 — Silk Sheen: analytic folded-silk shader (anisotropic sheen). A spring-smoothed cursor tugs the fabric and sweeps the light.
import { createLoop, initGL, makeProgram, pass, mountCanvas, trackPointer, GLSL_NOISE } from "./kit-126-135/kit.js";

const FS = `
${GLSL_NOISE}
uniform vec2 res;
uniform float dpr;
uniform vec3 mouse;   // css px xy, excite 0..1
uniform vec3 cA, cB, cSheen, cShade;
uniform float sheenAmt;
out vec4 o;

vec2 warp(vec2 p){
  vec2 d = p - mouse.xy;
  float r2 = dot(d, d);
  float w = exp(-r2 / (2.0*170.0*170.0));
  return p + d * (-0.22 * w * (0.35 + 0.65*mouse.z));   // fabric is drawn toward the cursor
}
float sm2(vec2 p){ return 0.62*vnoise(p) + 0.38*vnoise(p*2.1 + 5.0); }
float fold(vec2 q, float amp){
  float n1 = sm2(q/520.0 + 2.0);
  float s1 = dot(q, vec2(0.34, 0.94))/300.0 + 1.5*n1;
  float s2 = dot(q, vec2(-0.2, 0.98))/190.0 + 1.6*sm2(q/380.0 + 7.0);
  float s3 = dot(q, vec2(0.8, 0.6))/420.0 + 1.2*n1;
  float h = 0.62*sin(s1*6.2831) + 0.26*sin(s2*6.2831 + 1.3) + 0.4*sin(s3*6.2831 + 0.4);
  return h * amp;
}
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
  vec2 q = warp(p);
  float colMask = mix(0.55, 1.0, smoothstep(330.0, 540.0, abs(p.x - 0.5*res.x/dpr)));
  float e = 3.0;
  float h = fold(q, colMask);
  float hx = fold(q + vec2(e,0.0), colMask);
  float hy = fold(q + vec2(0.0,e), colMask);
  vec2 g = vec2(hx-h, hy-h) / e;
  vec3 n = normalize(vec3(-g*7.0, 1.0));
  // light drifts toward the cursor
  vec2 lp = vec2(0.28, 0.2) + (mouse.xy/(res/dpr) - 0.5) * 0.55 * mix(0.2, 1.0, mouse.z);
  vec3 L = normalize(vec3(lp*2.0 - 1.0, 0.7) * vec3(1.0,-1.0,1.0));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  // anisotropic sheen: tangent along the folds
  vec3 T0 = vec3(0.94, -0.34, 0.0);
  vec3 T = normalize(T0 - n*dot(T0, n));
  vec3 Hh = normalize(L + vec3(0.0,0.0,1.0));
  float TH = dot(T, Hh);
  float sheen = pow(sqrt(max(1.0 - TH*TH, 0.0)), 24.0) * smoothstep(0.0, 0.5, diff);
  // shot silk: hue shifts with the slope
  vec3 base = mix(cA, cB, clamp(0.5 + g.x*5.0 + g.y*3.0, 0.0, 1.0));
  float dn = clamp(0.55 + (diff - L.z) * 4.6, 0.0, 1.0);
  vec3 col = mix(cShade, base, dn);
  col += cSheen * sheen * sheenAmt;
  col += (h21(floor(gl_FragCoord.xy)) - 0.5) * 0.012;
  col *= 1.0 - 0.12*pow(length(uv-0.5)*1.25, 2.0);
  o = vec4(col, 1.0);
}`;

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { maxDpr: 1.5, scale: 0.75, type: "webgl2", opts: { antialias: false, alpha: false, powerPreference: "low-power" } });
	const ctx = initGL(view.canvas);
	if (!ctx) {
		view.destroy();
		return;
	}
	const { gl } = ctx;
	const P = makeProgram(gl, FS);
	const pal = dark
		? { cA: [0.07, 0.13, 0.24], cB: [0.13, 0.11, 0.26], cSheen: [0.5, 0.64, 0.86], cShade: [0.02, 0.04, 0.09], sheenAmt: 0.5 }
		: { cA: [0.95, 0.88, 0.78], cB: [0.85, 0.88, 0.95], cSheen: [1, 0.99, 0.95], cShade: [0.62, 0.6, 0.72], sheenAmt: 0.55 };
	const m = { x: 0.7, y: 0.3, tx: 0.7, ty: 0.3, vx: 0, vy: 0, ex: 0 };
	const render = () => {
		P.use();
		P.f2("res", view.w, view.h);
		P.f1("dpr", view.dpr);
		P.f3("mouse", m.x, m.y, m.ex);
		for (const k of ["cA", "cB", "cSheen", "cShade"]) P.f3(k, ...pal[k]);
		P.f1("sheenAmt", pal.sheenAmt);
		pass(gl, null, view.w, view.h);
	};
	let loop = null;
	view.onResize = () => {
		m.x = m.tx = view.cssW * 0.72;
		m.y = m.ty = view.cssH * 0.3;
		render();
	};
	view.onResize();
	if (reducedMotion) {
		return () => {
			view.destroy();
			ctx.destroy();
		};
	}
	const tracker = trackPointer(layer, {
		onMove(p) {
			m.tx = p.x;
			m.ty = p.y;
			m.ex = Math.min(1, m.ex + Math.hypot(p.vx, p.vy) * 0.012);
			loop.wake();
		},
	});
	loop = createLoop((dt) => {
		// critically damped spring toward the target
		const k = 40;
		const c = 2 * Math.sqrt(k);
		m.vx += (k * (m.tx - m.x) - c * m.vx) * dt;
		m.vy += (k * (m.ty - m.y) - c * m.vy) * dt;
		m.x += m.vx * dt;
		m.y += m.vy * dt;
		m.ex = Math.max(0, m.ex - dt * 0.12);
		render();
		const still = Math.abs(m.tx - m.x) + Math.abs(m.ty - m.y) < 0.4 && Math.abs(m.vx) + Math.abs(m.vy) < 1;
		return !(still && m.ex < 0.01) || m.ex > 0.01;
	});
	return () => {
		loop.stop();
		tracker.destroy();
		view.destroy();
		ctx.destroy();
	};
}
