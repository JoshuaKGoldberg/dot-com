// 133 — Ink Bleed: ink deposited by the cursor diffuses anisotropically along a baked paper-fibre map (WebGL2 ping-pong), then fades.
import { createLoop, initGL, makePingPong, makeProgram, bindTex, pass, mountCanvas, trackPointer, rng, GLSL_NOISE } from "./kit-126-135/kit.js";

const SIM = `
uniform sampler2D prev, fiber;
uniform vec2 res;
uniform float dpr;
uniform vec4 seg;   // css px
uniform float amt;
uniform float decay;
out vec4 o;
float dseg(vec2 p, vec2 a, vec2 b){ vec2 ab=b-a; float t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-4),0.,1.); return length(p-a-ab*t); }
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 px = 1.0 / res;
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
  float c  = texture(prev, uv).r;
  float l  = texture(prev, uv - vec2(px.x,0)).r, r = texture(prev, uv + vec2(px.x,0)).r;
  float d  = texture(prev, uv - vec2(0,px.y)).r, u = texture(prev, uv + vec2(0,px.y)).r;
  float dl = texture(prev, uv - px).r, dr = texture(prev, uv + vec2(px.x,-px.y)).r;
  float ul = texture(prev, uv + vec2(-px.x,px.y)).r, ur = texture(prev, uv + px).r;
  float cxx = l + r - 2.0*c, cyy = d + u - 2.0*c;
  float cxy = (ur - ul - dr + dl) * 0.25;
  float lap = cxx + cyy;
  vec3 f = texture(fiber, p / 380.0).rgb;
  vec2 o2 = (f.rg - 0.5) * 2.0;       // cos2θ, sin2θ  (y flipped between css and texture; consistent)
  float strength = f.b;
  float cnn = 0.5 * (lap + o2.x*(cxx - cyy) + o2.y*(2.0*cxy));
  // isotropic seep + a strong creep along fibres (flat paper between fibres barely moves)
  float n = c + (0.045 + 0.1*(1.0-strength)) * lap * 0.5 + strength * 0.8 * (cnn - 0.5*lap) + strength * 0.11 * lap;
  n = n * decay - 0.00045 * step(0.0005, n);
  n = max(n, 0.0);
  if (amt > 0.0){
    float dd = dseg(p, seg.xy, seg.zw);
    n += amt * exp(-dd*dd / (2.0*4.4*4.4));
  }
  o = vec4(min(n, 1.6), 0.0, 0.0, 1.0);
}`;

const RENDER = `
${GLSL_NOISE}
uniform sampler2D state, fiber;
uniform vec2 res;
uniform float dpr;
uniform vec3 paper, inkC;
uniform float darkMode;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
  vec3 f = texture(fiber, p / 380.0).rgb;
  float c = texture(state, uv).r;
  float fib = f.b;
  float mott = fbm(p/70.0) - 0.5;
  float grain = h21(floor(gl_FragCoord.xy)) - 0.5;
  vec3 col = paper * (1.0 + mott*0.07 + grain*0.035);
  col += (darkMode > 0.5 ? -1.0 : 1.0) * fib * 0.035;      // fibres catch a little light
  // ink: soak, with a darker pooled edge where it meets clean paper
  float soak = smoothstep(0.02, 0.55, c * (0.85 + 0.3*fib));
  float edge = smoothstep(0.03, 0.18, c) * (1.0 - smoothstep(0.18, 0.7, c));
  float a = clamp(soak * 0.62 + edge * 0.18, 0.0, 0.8);
  col = mix(col, inkC, a);
  col *= 1.0 - 0.1*pow(length(uv-0.5)*1.25, 2.0);
  o = vec4(col, 1.0);
}`;

function fiberTexture(gl, dark) {
	const S = 512;
	const cv = document.createElement("canvas");
	cv.width = cv.height = S;
	const g = cv.getContext("2d");
	g.fillStyle = "rgb(128,128,0)";
	g.fillRect(0, 0, S, S);
	const r = rng(2024);
	g.lineCap = "round";
	for (let i = 0; i < 1500; i++) {
		const th = r() * Math.PI;
		const len = 18 + r() * 60;
		const x = r() * S;
		const y = r() * S;
		const bend = (r() - 0.5) * 0.5;
		const R = Math.round(128 + 127 * Math.cos(2 * th));
		const G = Math.round(128 + 127 * Math.sin(2 * th));
		g.strokeStyle = `rgb(${R},${G},${Math.round(150 + r() * 105)})`;
		g.lineWidth = 0.8 + r() * 1.2;
		g.beginPath();
		for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
			if (ox || oy) if (x + ox < -80 || x + ox > S + 80 || y + oy < -80 || y + oy > S + 80) continue;
			g.moveTo(x + ox, y + oy);
			g.quadraticCurveTo(x + ox + Math.cos(th + bend) * len * 0.5, y + oy + Math.sin(th + bend) * len * 0.5, x + ox + Math.cos(th) * len, y + oy + Math.sin(th) * len);
		}
		g.stroke();
	}
	const tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	return tex;
}

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { maxDpr: 1.5, scale: 0.7, type: "webgl2", opts: { antialias: false, alpha: false, powerPreference: "low-power" } });
	const ctx = initGL(view.canvas);
	if (!ctx || !ctx.floatRT) {
		view.destroy();
		return;
	}
	const { gl } = ctx;
	const simP = makeProgram(gl, SIM);
	const renP = makeProgram(gl, RENDER);
	const fiber = fiberTexture(gl, dark);
	let state = null;
	let loop = null;
	view.onResize = () => {
		state?.dispose();
		state = makePingPong(gl, view.w, view.h, { internal: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT });
		state.clear();
		loop?.wake();
	};
	view.onResize();
	const pal = dark ? { paper: [0.075, 0.09, 0.14], ink: [0.82, 0.86, 1.0] } : { paper: [0.965, 0.94, 0.88], ink: [0.1, 0.12, 0.24] };
	const render = () => {
		renP.use();
		bindTex(gl, 0, state.read.tex);
		bindTex(gl, 1, fiber);
		renP.i1("state", 0);
		renP.i1("fiber", 1);
		renP.f2("res", view.w, view.h);
		renP.f1("dpr", view.dpr);
		renP.f3("paper", ...pal.paper);
		renP.f3("inkC", ...pal.ink);
		renP.f1("darkMode", dark ? 1 : 0);
		pass(gl, null, view.w, view.h);
	};
	const cleanup = () => {
		loop?.stop();
		tracker?.destroy();
		state.dispose();
		gl.deleteTexture(fiber);
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
			const speed = Math.hypot(p.vx, p.vy);
			const amt = Math.min(0.5, 0.2 + 2.0 / (speed + 4));
			const seg = [p.px, p.py, p.x, p.y, amt];
			pending = pending ? [pending[0], pending[1], p.x, p.y, Math.max(pending[4], amt)] : seg;
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
			bindTex(gl, 1, fiber);
			simP.i1("prev", 0);
			simP.i1("fiber", 1);
			simP.f2("res", view.w, view.h);
			simP.f1("dpr", view.dpr);
			simP.f4("seg", ...(pending ? pending.slice(0, 4) : [0, 0, 0, 0]));
			simP.f1("amt", pending ? pending[4] : 0);
			simP.f1("decay", 0.9985);
			pass(gl, state.write, view.w, view.h);
			state.swap();
			pending = null;
		}
		if (steps) render();
		return now - lastActive < 14000 || pending !== null;
	});
	render();
	return cleanup;
}
