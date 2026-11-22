// 127 — Dune Wind: ripple-marked dunes warped by a displacement field the cursor pushes away, plus airborne grains.
import { createLoop, initGL, makePingPong, makeProgram, bindTex, pass, mountCanvas, trackPointer, GLSL_NOISE } from "./kit-126-135/kit.js";

const SIM = `
uniform sampler2D prev;
uniform vec2 res;
uniform float dpr;
uniform vec4 wind;   // css px: cursor xy, velocity xy (px/frame)
uniform float gust;  // 0..1
uniform float heal;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 D = texture(prev, uv).rg;
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
  D *= 0.9965;
  float m = max(length(D), 1e-5);
  D *= max(m - heal, 0.0) / m;
  if (gust > 0.0){
    vec2 r = p - wind.xy;
    float d = length(r);
    float w = exp(-d*d/(2.0*85.0*85.0)) * gust;
    vec2 away = r / max(d, 1.0);
    // push away from the cursor, and carry some sand along the stroke (screen y points down; texture y up)
    vec2 f = away * 3.2 + wind.zw * 0.55;
    D += vec2(f.x, -f.y) * w;
    D = D * min(1.0, 70.0 / max(length(D), 1e-3));
  }
  o = vec4(D, 0.0, 1.0);
}`;

const RENDER = `
${GLSL_NOISE}
uniform sampler2D state;
uniform vec2 res;
uniform float dpr;
uniform vec3 litC, midC, shadeC;
uniform float contrast;
out vec4 o;

float dunes(vec2 q, float amp){
  vec2 dir = normalize(vec2(0.82, 0.57));
  float w = fbm(q/380.0 + 4.0);
  float s = dot(q, dir)/240.0 + 2.2*w;
  float f = fract(s);
  float prof = f * (1.0 - smoothstep(0.6, 1.0, f));
  float rip = sin(dot(q, vec2(-0.57, 0.82))/1.7 + 7.0*fbm(q/80.0) + s*2.0);
  float ripAmp = smoothstep(0.25, 0.7, fbm(q/210.0 + 9.0)) * (1.0 - 0.6*prof);
  return (prof*11.0 + rip*0.5*ripAmp) * amp;
}
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
  vec2 D = texture(state, uv).rg;
  vec2 q = p - vec2(D.x, -D.y);
  float colMask = mix(0.42, 1.0, smoothstep(330.0, 540.0, abs(p.x - 0.5*res.x/dpr)));
  float amp = colMask;
  float e = 1.5;
  float h = dunes(q, amp);
  float hx = dunes(q + vec2(e, 0.0), amp);
  float hy = dunes(q + vec2(0.0, e), amp);
  vec2 g = vec2(hx - h, hy - h) / e;
  vec3 n = normalize(vec3(-g * 1.5, 1.0));
  vec3 L = normalize(vec3(-0.75, -0.25, 0.5));
  float lit = dot(n, L);
  float t = clamp(0.5 + (lit - L.z) * 2.6 * contrast, 0.0, 1.0);
  vec3 col = t < 0.5 ? mix(shadeC, midC, t*2.0) : mix(midC, litC, (t-0.5)*2.0);
  float grain = h21(floor(gl_FragCoord.xy)) - 0.5;
  col *= 1.0 + grain * 0.05;
  // sand piling where displaced
  col += 0.03 * clamp(length(D)/30.0, 0.0, 1.0) * (litC - midC) * 2.0;
  col *= 1.0 - 0.13 * pow(length(uv - 0.5) * 1.25, 2.0);
  o = vec4(col, 1.0);
}`;

const PVS = `#version 300 es
layout(location=0) in vec4 a;
uniform vec2 cssRes;
uniform float dpr;
out float alpha;
void main(){
  vec2 p = a.xy / cssRes;
  gl_Position = vec4(p.x*2.0-1.0, 1.0-p.y*2.0, 0.0, 1.0);
  gl_PointSize = a.z * dpr;
  alpha = a.w;
}`;
const PFS = `
uniform vec3 grain;
in float alpha;
out vec4 o;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = alpha * smoothstep(1.0, 0.35, d);
  o = vec4(grain * a, a);
}`.replace("in float alpha", "in float alpha");

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
	const ptP = makeProgram(gl, PFS, PVS);
	const mainVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
	const ptVao = gl.createVertexArray();
	const MAXG = 420;
	const gdata = new Float32Array(MAXG * 4);
	const gbuf = gl.createBuffer();
	gl.bindVertexArray(ptVao);
	gl.bindBuffer(gl.ARRAY_BUFFER, gbuf);
	gl.bufferData(gl.ARRAY_BUFFER, gdata.byteLength, gl.DYNAMIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
	gl.bindVertexArray(mainVao);

	let state = null;
	let loop = null;
	let lastActive = 0;
	view.onResize = () => {
		state?.dispose();
		state = makePingPong(gl, Math.round(view.w / 2), Math.round(view.h / 2), { internal: gl.RG16F, format: gl.RG, type: gl.HALF_FLOAT });
		state.clear();
		loop?.wake();
	};
	view.onResize();

	const pal = dark
		? { litC: [0.5, 0.58, 0.74], midC: [0.17, 0.22, 0.34], shadeC: [0.075, 0.1, 0.18], contrast: 0.85, grain: [0.7, 0.78, 0.95] }
		: { litC: [0.99, 0.95, 0.85], midC: [0.92, 0.84, 0.69], shadeC: [0.8, 0.67, 0.5], contrast: 0.85, grain: [0.6, 0.42, 0.2] };

	const grains = [];
	const cleanupBase = () => {
		loop?.stop();
		tracker?.destroy();
		window.removeEventListener("pointerdown", down);
		state.dispose();
		gl.deleteBuffer(gbuf);
		gl.deleteVertexArray(ptVao);
		view.destroy();
		ctx.destroy();
	};
	const render = () => {
		renP.use();
		bindTex(gl, 0, state.read.tex);
		renP.i1("state", 0);
		renP.f2("res", view.w, view.h);
		renP.f1("dpr", view.dpr);
		renP.f3("litC", ...pal.litC);
		renP.f3("midC", ...pal.midC);
		renP.f3("shadeC", ...pal.shadeC);
		renP.f1("contrast", pal.contrast);
		gl.disable(gl.BLEND);
		pass(gl, null, view.w, view.h);
		if (grains.length) {
			let i = 0;
			for (const g of grains) {
				gdata[i++] = g.x;
				gdata[i++] = g.y;
				gdata[i++] = g.s;
				gdata[i++] = Math.min(1, g.life * 1.6) * 0.8;
			}
			gl.bindVertexArray(ptVao);
			gl.bindBuffer(gl.ARRAY_BUFFER, gbuf);
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, gdata, 0, i);
			ptP.use();
			ptP.f2("cssRes", view.cssW, view.cssH);
			ptP.f1("dpr", view.dpr);
			ptP.f3("grain", ...pal.grain);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.drawArrays(gl.POINTS, 0, grains.length);
			gl.disable(gl.BLEND);
			gl.bindVertexArray(mainVao);
		}
	};
	let tracker = null;
	let down = () => {};
	if (reducedMotion) {
		render();
		return cleanupBase;
	}

	let gustAmt = 0;
	let wx = 0;
	let wy = 0;
	let vx = 0;
	let vy = 0;
	const spawn = (x, y, dx, dy, speed) => {
		const n = Math.min(7, 1 + Math.floor(speed * 0.25));
		for (let k = 0; k < n && grains.length < MAXG; k++) {
			const a = Math.random() * 6.283;
			const r = Math.random() * 46;
			const gx = x + Math.cos(a) * r;
			const gy = y + Math.sin(a) * r;
			const ax = gx - x;
			const ay = gy - y;
			const al = Math.hypot(ax, ay) || 1;
			const sp = 40 + Math.random() * 110;
			grains.push({ x: gx, y: gy, vx: (ax / al) * sp + dx * 14 + 26, vy: (ay / al) * sp + dy * 14 - 10 * Math.random(), life: 1.2 + Math.random() * 1.4, s: 1.2 + Math.random() * 1.6 });
		}
	};
	tracker = trackPointer(layer, {
		onMove(p) {
			wx = p.x;
			wy = p.y;
			vx = vx * 0.5 + p.vx * 0.5;
			vy = vy * 0.5 + p.vy * 0.5;
			const speed = Math.hypot(p.vx, p.vy);
			gustAmt = Math.min(1, gustAmt + Math.min(speed / 14, 0.6));
			spawn(p.x, p.y, p.vx, p.vy, speed);
			lastActive = performance.now();
			loop.wake();
		},
	});
	down = (e) => {
		const r = layer.getBoundingClientRect();
		wx = e.clientX - r.left;
		wy = e.clientY - r.top;
		vx = vy = 0;
		gustAmt = 1;
		spawn(wx, wy, 0, 0, 24);
		lastActive = performance.now();
		loop.wake();
	};
	window.addEventListener("pointerdown", down, { passive: true });

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
			simP.f4("wind", wx, wy, vx, vy);
			simP.f1("gust", gustAmt);
			simP.f1("heal", 0.012);
			pass(gl, state.write, state.w, state.h);
			state.swap();
			gustAmt *= 0.55;
			if (gustAmt < 0.02) gustAmt = 0;
			vx *= 0.9;
			vy *= 0.9;
			for (let i = grains.length - 1; i >= 0; i--) {
				const g = grains[i];
				g.vx *= 0.985;
				g.vy *= 0.985;
				g.x += g.vx / 60;
				g.y += g.vy / 60;
				g.life -= 1 / 60;
				if (g.life <= 0) grains.splice(i, 1);
			}
		}
		if (steps) render();
		return now - lastActive < 11000 || grains.length > 0;
	});
	render();
	return cleanupBase;
}
