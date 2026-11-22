// 126 — Zen Garden: raked sand (WebGL2 deviation field). The cursor rakes new grooves around the stones; they slowly smooth back out.
import { createLoop, initGL, makePingPong, makeProgram, bindTex, pass, mountCanvas, trackPointer, GLSL_NOISE } from "./kit-126-135/kit.js";

const SCENE = `
uniform vec2 res;       // canvas px
uniform float dpr;
uniform vec3 stones[4]; // css px: x, y, r
const float SP = 13.0;
const float TAU = 6.2831853;

vec2 cssPos(){ return vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr; }

// Streamlines of flow past each stone, plus a few concentric rings hugging them.
float baseRaw(vec2 p){
  float psi = p.y + 5.0*sin(p.x*0.011 + 1.3) + 2.5*sin(p.x*0.037);
  float ring = 0.0, rw = 0.0;
  for (int i=0;i<4;i++){
    vec2 q = p - stones[i].xy;
    float R = stones[i].z;
    float d2 = max(dot(q,q), R*R);
    psi -= q.y * (R*R) / d2 * 1.0;
    float d = sqrt(d2);
    float w = smoothstep(R + 3.6*SP, R + 2.2*SP, d);
    ring += w * cos(TAU*(d - R)/SP);
    rw += w;
  }
  float lines = cos(TAU*psi/SP);
  rw = min(rw, 1.0);
  return 0.5 * mix(lines, ring / max(rw, 0.001), rw);
}
float baseH(vec2 p){
  float colMask = mix(0.3, 1.0, smoothstep(330.0, 520.0, abs(p.x - 0.5*res.x/dpr)));
  return baseRaw(p) * colMask;
}
float stoneSdf(int i, vec2 p){
  vec2 q = p - stones[i].xy;
  float R = stones[i].z;
  float n = vnoise(q/R*1.7 + float(i)*7.3) - 0.5;
  return length(q*vec2(1.0,1.18)) - R*(1.0 + 0.34*n);
}
`;

const SIM = `
${GLSL_NOISE}
${SCENE}
uniform sampler2D prev;
uniform vec4 seg;    // p0.xy p1.xy css px
uniform float stamp; // 1 when stamping
uniform float step_; // linear heal
uniform float decay;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 px = 1.0/res;
  float c = texture(prev, uv).r;
  float n = (texture(prev, uv+vec2(px.x,0)).r + texture(prev, uv-vec2(px.x,0)).r + texture(prev, uv+vec2(0,px.y)).r + texture(prev, uv-vec2(0,px.y)).r)*0.25;
  float dev = mix(c, n, 0.035) * decay;
  dev = sign(dev) * max(abs(dev) - step_, 0.0);
  if (stamp > 0.5){
    vec2 p = cssPos();
    vec2 a = seg.xy, b = seg.zw;
    vec2 ab = b - a; float L = max(length(ab), 0.001);
    vec2 dir = ab / L; vec2 nrm = vec2(-dir.y, dir.x);
    vec2 ap = p - a;
    float along = dot(ap, dir);
    float lat = dot(ap, nrm);
    float W = 22.0;
    float m = smoothstep(W, W-6.0, abs(lat)) * smoothstep(-1.0, 1.5, along) * smoothstep(L+1.5, L-1.0, along);
    // lift the rake around stones
    for (int i=0;i<4;i++){ m *= smoothstep(stones[i].z+2.0, stones[i].z+10.0, length(p - stones[i].xy)); }
    float target = 0.8*cos(TAU*lat/8.5) - baseH(p);
    dev = mix(dev, target, m);
  }
  o = vec4(dev, 0, 0, 1);
}`;

const RENDER = `
${GLSL_NOISE}
${SCENE}
uniform sampler2D state;
uniform vec3 sandA, sandB, stoneA, stoneB, shadowC;
uniform float darkMode;
out vec4 o;
float H(vec2 p){ return baseH(p) + texture(state, vec2(p.x*dpr/res.x, 1.0 - p.y*dpr/res.y)).r; }
void main(){
  vec2 p = cssPos();
  float e = 1.0;
  float h = H(p);
  vec2 g = vec2(H(p+vec2(e,0)) - H(p-vec2(e,0)), H(p+vec2(0,e)) - H(p-vec2(0,e))) * 0.5;
  vec3 n = normalize(vec3(-g*2.2, 1.0));
  vec3 L = normalize(vec3(-0.55, -0.6, 0.55));
  float lit = dot(n, L);
  float flat_ = L.z;
  float shade = (lit - flat_) * 0.9;
  float grain = h21(floor(gl_FragCoord.xy)) - 0.5;
  float mott = fbm(p/90.0) - 0.5;
  vec3 col = mix(sandA, sandB, 0.5 + mott*0.9 + 0.5*(h*0.35));
  col *= 1.0 + shade * 0.5 + grain*0.07;
  // stones
  for (int i=0;i<4;i++){
    float R = stones[i].z;
    vec2 q = p - stones[i].xy;
    // cast shadow, offset away from the light
    float sh = smoothstep(R*0.5, -R*0.15, stoneSdf(i, p - vec2(0.35,0.4)*R*0.9));
    col *= 1.0 - 0.28*sh;
    float s = stoneSdf(i, p);
    // contact darkening
    col *= 1.0 - 0.18*smoothstep(10.0, 0.0, s) * (1.0 - step(0.0,-s));
    if (s < 1.0){
      vec2 qn = q / (R*1.2);
      float z = sqrt(max(0.0, 1.0 - dot(qn,qn)));
      vec3 sn = normalize(vec3(qn*1.1, z + 0.15) + vec3((vec2(vnoise(q/6.0), vnoise(q/6.0+9.0))-0.5)*0.25, 0.0));
      float d = clamp(dot(sn, L)*0.9+0.25, 0.0, 1.2);
      vec3 sc = mix(stoneA, stoneB, fbm(q/R*2.4 + float(i)*3.0));
      sc *= 0.55 + 0.7*d;
      sc *= 1.0 + (h21(floor(gl_FragCoord.xy)+3.0)-0.5)*0.12;
      col = mix(col, sc, smoothstep(1.0, -0.5, s));
    }
  }
  vec2 uvn = gl_FragCoord.xy/res;
  col *= 1.0 - 0.14*pow(length(uvn-0.5)*1.25, 2.0);
  o = vec4(col, 1.0);
}`;

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { maxDpr: 1.5, scale: 0.8, type: "webgl2", opts: { antialias: false, alpha: false, powerPreference: "low-power" } });
	const ctx = initGL(view.canvas);
	if (!ctx || !ctx.floatRT) {
		view.destroy();
		return;
	}
	const { gl } = ctx;
	const simP = makeProgram(gl, SIM);
	const renP = makeProgram(gl, RENDER);
	let state = null;
	let stones = new Float32Array(12);
	const layout = () => {
		const W = view.cssW;
		const H = view.cssH;
		const u = Math.min(W, H);
		const set = (i, fx, fy, r) => {
			stones[i * 3] = fx * W;
			stones[i * 3 + 1] = fy * H;
			stones[i * 3 + 2] = r;
		};
		const wide = W > 900;
		set(0, wide ? 0.09 : 0.86, wide ? 0.3 : 0.14, Math.max(26, u * 0.065));
		set(1, wide ? 0.145 : 0.94, wide ? 0.4 : 0.21, Math.max(15, u * 0.034));
		set(2, wide ? 0.9 : 0.1, wide ? 0.72 : 0.86, Math.max(32, u * 0.078));
		set(3, wide ? 0.835 : 0.2, wide ? 0.8 : 0.93, Math.max(14, u * 0.03));
	};
	view.onResize = () => {
		layout();
		state?.dispose();
		state = makePingPong(gl, view.w, view.h, { internal: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT });
		state.clear();
		wakeRender = true;
		loop?.wake();
	};
	let wakeRender = true;
	let loop = null;
	view.onResize(view);

	const pal = dark
		? { sandA: [0.115, 0.15, 0.21], sandB: [0.17, 0.215, 0.29], stoneA: [0.34, 0.37, 0.42], stoneB: [0.2, 0.22, 0.27], shadowC: [0, 0, 0] }
		: { sandA: [0.9, 0.86, 0.77], sandB: [0.95, 0.925, 0.86], stoneA: [0.62, 0.6, 0.57], stoneB: [0.42, 0.42, 0.42], shadowC: [0, 0, 0] };

	const uniformsCommon = (P) => {
		P.f2("res", view.w, view.h);
		P.f1("dpr", view.dpr);
		gl.uniform3fv(gl.getUniformLocation(P.prog, "stones"), stones);
	};
	const draw = (stampSeg) => {
		// sim
		simP.use();
		uniformsCommon(simP);
		bindTex(gl, 0, state.read.tex);
		simP.i1("prev", 0);
		simP.f4("seg", ...(stampSeg ?? [0, 0, 0, 0]));
		simP.f1("stamp", stampSeg ? 1 : 0);
		simP.f1("step_", 0.0011);
		simP.f1("decay", 0.9965);
		pass(gl, state.write, view.w, view.h);
		state.swap();
	};
	const render = () => {
		renP.use();
		uniformsCommon(renP);
		bindTex(gl, 0, state.read.tex);
		renP.i1("state", 0);
		for (const k of ["sandA", "sandB", "stoneA", "stoneB", "shadowC"]) renP.f3(k, ...pal[k]);
		renP.f1("darkMode", dark ? 1 : 0);
		pass(gl, null, view.w, view.h);
	};

	if (reducedMotion) {
		render();
		return () => {
			state.dispose();
			view.destroy();
			ctx.destroy();
		};
	}

	let pending = null;
	let lastStamp = 0;
	let lastPt = null;
	const tracker = trackPointer(layer, {
		onMove(p) {
			if (!lastPt) lastPt = [p.x, p.y];
			const dx = p.x - lastPt[0];
			const dy = p.y - lastPt[1];
			if (dx * dx + dy * dy < 9) return;
			const seg = [lastPt[0], lastPt[1], p.x, p.y];
			lastPt = [p.x, p.y];
			pending = pending ? [pending[0], pending[1], seg[2], seg[3]] : seg;
			lastStamp = performance.now();
			loop.wake();
		},
		onLeave() {
			lastPt = null;
		},
	});
	let acc = 0;
	loop = createLoop((dt, now) => {
		acc += dt;
		let steps = 0;
		while (acc >= 1 / 60 && steps < 3) {
			acc -= 1 / 60;
			steps++;
			if (pending) {
				// long strokes are one segment; the grooves stay straight, which reads as a rake pulled across
				draw(pending);
				pending = null;
			} else draw(null);
		}
		if (!steps && !wakeRender) return true;
		render();
		wakeRender = false;
		return now - lastStamp < 15000 || pending !== null;
	});
	render();
	return () => {
		loop.stop();
		tracker.destroy();
		state.dispose();
		view.destroy();
		ctx.destroy();
	};
}
