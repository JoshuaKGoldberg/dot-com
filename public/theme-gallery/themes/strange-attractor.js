// Strange attractor dust. A Clifford / De Jong map is iterated for ~250k points entirely on the GPU
// (transform feedback), splatted additively into a half-float accumulation buffer that decays each
// frame, then tone-mapped. Cursor warps the parameters and stirs the dust; click jumps to a new attractor.
import { mountCanvas, trackPointer, createLoop, makeButton, observeSize, compile } from "./_wild/kit.js";

const PRESETS = [
	{ t: 0, p: [-1.4, 1.6, 1.0, 0.7] },
	{ t: 1, p: [1.641, 1.902, 0.316, 1.525] },
	{ t: 0, p: [1.7, 1.7, 0.6, 1.2] },
	{ t: 1, p: [-0.827, -1.637, 1.659, -0.943] },
	{ t: 0, p: [-1.7, 1.3, -0.1, -1.21] },
	{ t: 1, p: [-2.24, -2.43, -2.88, -2.63] },
	{ t: 0, p: [1.5, -1.8, 1.6, 0.9] },
	{ t: 1, p: [2.01, -2.53, 1.61, -0.33] },
];

const VS = `#version 300 es
precision highp float;
precision highp int;
in vec2 aPos;
uniform vec4 uP;
uniform int uType;
uniform vec2 uExt;
uniform uint uSeed;
uniform float uJit;
uniform vec2 uPtr;
uniform float uPtrOn;
uniform float uHue;
uniform float uSize;
uniform float uDark;
out vec2 vNew;
out vec3 vCol;

uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd(uint v){ return float(pcg(v)) / 4294967295.0; }

vec3 pal(float t){
	vec3 a = uDark > 0.5 ? vec3(0.25, 0.85, 1.0) : vec3(0.08, 0.2, 0.72);
	vec3 b = uDark > 0.5 ? vec3(1.0, 0.32, 0.72) : vec3(0.78, 0.08, 0.38);
	vec3 c = uDark > 0.5 ? vec3(0.55, 0.45, 1.0) : vec3(0.36, 0.1, 0.72);
	vec3 w = 0.5 + 0.5 * cos(6.2831853 * (t - vec3(0.0, 0.3333, 0.6667)));
	w = w * w;
	return (a * w.x + b * w.y + c * w.z) / (w.x + w.y + w.z + 1e-4);
}

void main(){
	vec2 p = aPos;
	vec2 q;
	if (uType == 0) q = vec2(sin(uP.x * p.y) + uP.z * cos(uP.x * p.x), sin(uP.y * p.x) + uP.w * cos(uP.y * p.y));
	else q = vec2(sin(uP.x * p.y) - cos(uP.y * p.x), sin(uP.z * p.x) - cos(uP.w * p.y));
	uint id = uint(gl_VertexID);
	q += (vec2(rnd(id * 2u + uSeed), rnd(id * 2u + 1u + uSeed * 3u)) - 0.5) * uJit;
	vec2 dp = q - uPtr;
	float k = uPtrOn * exp(-dot(dp, dp) * 5.0);
	q += vec2(-dp.y, dp.x) * k * 0.32 + dp * k * 0.18;
	vNew = q;
	vec2 v = q - p;
	float a = atan(v.y, v.x) * 0.159155 + 0.5;
	vCol = pal(a * 0.5 + uHue + length(v) * 0.12);
	gl_Position = vec4(q / uExt, 0.0, 1.0);
	gl_PointSize = uSize;
}`;

const PFS = `#version 300 es
precision highp float;
in vec3 vCol;
uniform float uK;
out vec4 o;
void main(){
	vec2 c = gl_PointCoord - 0.5;
	float a = exp(-dot(c, c) * 12.0) * uK;
	o = vec4(vCol * a, a);
}`;

const FSQ = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

const DECAY_FS = `#version 300 es
precision mediump float;
out vec4 o;
void main(){ o = vec4(0.0); }`;

const SHOW_FS = `#version 300 es
precision highp float;
uniform sampler2D uAcc;
uniform vec2 uRes;
uniform float uDark;
uniform float uGain;
uniform float uRef;
out vec4 o;
void main(){
	vec4 s = texture(uAcc, gl_FragCoord.xy / uRes);
	float w = s.a;
	vec3 avg = s.rgb / max(w, 1e-4);
	float a = pow(clamp(log(1.0 + w * uGain) / uRef, 0.0, 1.0), 1.7);
	if (uDark > 0.5) o = vec4(avg * a * 1.25, a * 0.2);
	else o = vec4(avg * a * 0.95, a * 0.92);
}`;

function link(gl, vs, fs, varyings) {
	const p = gl.createProgram();
	const a = compile(gl, gl.VERTEX_SHADER, vs);
	const b = compile(gl, gl.FRAGMENT_SHADER, fs);
	gl.attachShader(p, a);
	gl.attachShader(p, b);
	if (varyings) gl.transformFeedbackVaryings(p, varyings, gl.SEPARATE_ATTRIBS);
	gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
	gl.deleteShader(a);
	gl.deleteShader(b);
	const cache = {};
	p.u = (n) => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(p, n)));
	return p;
}

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { context: "webgl2", maxDpr: 1, scale: 1, maxPixels: 1.5e6, options: { premultipliedAlpha: true } });
	const gl = view.gl;
	if (!gl) {
		view.destroy();
		return;
	}
	const canvas = view.canvas;
	canvas.style.transition = "opacity 0.9s ease";
	canvas.style.opacity = reducedMotion ? "0.8" : "0.62";
	canvas.classList.add("attractor-canvas");

	const floatOk = !!gl.getExtension("EXT_color_buffer_float");
	const P = link(gl, VS, PFS, ["vNew"]);
	const D = link(gl, FSQ, DECAY_FS);
	const S = link(gl, FSQ, SHOW_FS);

	// ---- point state, ping-pong ----
	const N = Math.round(Math.min(300000, Math.max(120000, (view.width * view.height) / 3.4)));
	const init = new Float32Array(N * 2);
	for (let i = 0; i < init.length; i++) init[i] = (Math.random() - 0.5) * 3;
	const bufs = [gl.createBuffer(), gl.createBuffer()];
	const vaos = [gl.createVertexArray(), gl.createVertexArray()];
	const aPos = gl.getAttribLocation(P, "aPos");
	for (let i = 0; i < 2; i++) {
		gl.bindBuffer(gl.ARRAY_BUFFER, bufs[i]);
		gl.bufferData(gl.ARRAY_BUFFER, init, gl.DYNAMIC_COPY);
		gl.bindVertexArray(vaos[i]);
		gl.enableVertexAttribArray(aPos);
		gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
	}
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	const tf = gl.createTransformFeedback();
	const emptyVao = gl.createVertexArray();
	let cur = 0;

	// ---- accumulation target ----
	let accTex = null;
	let fbo = null;
	let accW = 0;
	let accH = 0;
	function makeAcc() {
		if (accTex) gl.deleteTexture(accTex);
		if (fbo) gl.deleteFramebuffer(fbo);
		accW = view.width;
		accH = view.height;
		accTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, accTex);
		if (floatOk) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, accW, accH, 0, gl.RGBA, gl.HALF_FLOAT, null);
		else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, accW, accH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, accTex, 0);
		gl.viewport(0, 0, accW, accH);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
	makeAcc();

	// ---- parameters / morphing ----
	let presetIdx = (Math.random() * PRESETS.length) | 0;
	let from = { t: PRESETS[presetIdx].t, p: PRESETS[presetIdx].p.slice() };
	let to = from;
	let morph = 1; // 0..1
	let morphSpeed = 0.4;
	let hue = Math.random();
	let boost = 0;
	let seedCounter = 1;

	function nextPreset() {
		presetIdx = (presetIdx + 1 + ((Math.random() * (PRESETS.length - 1)) | 0)) % PRESETS.length;
		const cp = from.t === to.t ? { t: to.t, p: to.p.slice() } : { t: to.t, p: to.p.slice() };
		from = morph >= 1 ? cp : { t: morph < 0.5 ? from.t : to.t, p: from.p.map((v, i) => v + (to.p[i] - v) * morph) };
		to = { t: PRESETS[presetIdx].t, p: PRESETS[presetIdx].p.slice() };
		morph = 0;
		boost = 1;
		hue += 0.17;
	}

	const ptr = trackPointer(layer, {
		onDown: (p, e) => {
			if (e.target.closest?.("button, input, a")) return;
			burst();
		},
		onMove: () => {
			if (reducedMotion) return;
			activeUntil = performance.now() + 2800;
		},
	});
	let activeUntil = 0;
	let warpX = 0;
	let warpY = 0;

	function burst() {
		nextPreset();
		if (reducedMotion) {
			morph = 1;
			from = to;
			renderStatic();
		}
	}

	const cur4 = [0, 0, 0, 0];
	let type = 0;
	function evalParams(t, tNow) {
		const ease = morph * morph * (3 - 2 * morph);
		for (let i = 0; i < 4; i++) cur4[i] = from.p[i] + (to.p[i] - from.p[i]) * ease;
		type = ease < 0.5 ? from.t : to.t;
		// slow breathing + cursor warp
		const drift = reducedMotion ? 0 : 1;
		cur4[0] += Math.sin(tNow * 0.071) * 0.035 * drift + warpX * 0.28;
		cur4[1] += Math.cos(tNow * 0.057) * 0.035 * drift + warpY * 0.28;
		cur4[2] += Math.sin(tNow * 0.043 + 1) * 0.03 * drift;
		cur4[3] += Math.cos(tNow * 0.049 + 2) * 0.03 * drift;
	}

	function frame(tNow, dt) {
		const w = view.width;
		const h = view.height;
		if (w !== accW || h !== accH) makeAcc();

		evalParams(dt, tNow);
		const ext = type === 0 ? [1 + Math.abs(cur4[2]), 1 + Math.abs(cur4[3])] : [2.0, 2.0];
		const sx = ext[0] * 1.04;
		const sy = ext[1] * 1.04;

		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.viewport(0, 0, accW, accH);
		gl.enable(gl.BLEND);

		// decay
		gl.blendFunc(gl.ZERO, gl.CONSTANT_COLOR);
		const decay = floatOk ? 0.9 : 0.8;
		gl.blendColor(decay, decay, decay, decay);
		gl.useProgram(D);
		gl.bindVertexArray(emptyVao);
		gl.drawArrays(gl.TRIANGLES, 0, 3);

		// iterate + splat
		gl.blendFunc(gl.ONE, gl.ONE);
		gl.useProgram(P);
		gl.uniform4fv(P.u("uP"), cur4);
		gl.uniform1i(P.u("uType"), type);
		gl.uniform2f(P.u("uExt"), sx, sy);
		gl.uniform1ui(P.u("uSeed"), (seedCounter++ * 2654435761) >>> 0);
		gl.uniform1f(P.u("uJit"), 0.012 + boost * 0.05);
		gl.uniform1f(P.u("uHue"), hue + tNow * 0.004);
		gl.uniform1f(P.u("uSize"), 2.1);
		gl.uniform1f(P.u("uDark"), dark ? 1 : 0);
		const lit = ptr.seen && ptr.inside && !reducedMotion;
		const pxA = lit ? ((ptr.x / view.cssW) * 2 - 1) * sx : 0;
		const pyA = lit ? (1 - (ptr.y / view.cssH) * 2) * sy : 0;
		gl.uniform2f(P.u("uPtr"), pxA, pyA);
		gl.uniform1f(P.u("uPtrOn"), lit ? 1 : 0);
		gl.uniform1f(P.u("uK"), (dark ? 0.1 : 0.11) * (1 + boost * 1.2));
		gl.bindVertexArray(vaos[cur]);
		gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bufs[1 - cur]);
		gl.beginTransformFeedback(gl.POINTS);
		gl.drawArrays(gl.POINTS, 0, N);
		gl.endTransformFeedback();
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
		gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
		cur = 1 - cur;

		// present
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, w, h);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(S);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, accTex);
		gl.uniform1i(S.u("uAcc"), 0);
		gl.uniform2f(S.u("uRes"), w, h);
		gl.uniform1f(S.u("uDark"), dark ? 1 : 0);
		{
			const g = 22;
			gl.uniform1f(S.u("uGain"), g);
			gl.uniform1f(S.u("uRef"), Math.log(1 + g * (2.5)));
		}
		gl.bindVertexArray(emptyVao);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	function renderStatic() {
		for (let i = 0; i < 14; i++) frame(2, 0);
	}

	// ---- loop ----
	const button = makeButton(root, reducedMotion ? "new attractor" : "move to warp · click for a new attractor", {
		title: "Move the pointer to bend the attractor and stir the dust; click the background to morph into a new one",
	});
	button.addEventListener("click", burst);

	let loop = null;
	let nextAuto = 26;
	function tickState(dt, t) {
		if (morph < 1) morph = Math.min(1, morph + dt * morphSpeed * 0.55);
		boost *= Math.pow(0.12, dt);
		if (boost < 0.01) boost = 0;
		const active = performance.now() < activeUntil;
		const lit = ptr.seen && ptr.inside && active;
		const tx = lit ? ptr.x / view.cssW - 0.5 : 0;
		const ty = lit ? ptr.y / view.cssH - 0.5 : 0;
		warpX += (tx - warpX) * Math.min(1, dt * 2.5);
		warpY += (ty - warpY) * Math.min(1, dt * 2.5);
		canvas.style.opacity = active || boost > 0 ? "1" : "0.62";
		if (t > nextAuto && morph >= 1) {
			nextAuto = t + 34;
			morphSpeed = 0.18;
			nextPreset();
			boost = 0;
		}
	}

	if (reducedMotion) {
		renderStatic();
	} else {
		loop = createLoop(
			(dt, t) => {
				tickState(dt, t);
				frame(t, dt);
			},
			{ maxDt: 0.05 },
		);
	}

	const stopSize = observeSize(layer, () => {
		view.fit();
		makeAcc();
		if (reducedMotion) renderStatic();
	});

	return () => {
		loop?.stop();
		stopSize();
		ptr.destroy();
		button.remove();
		gl.deleteTransformFeedback(tf);
		for (const b of bufs) gl.deleteBuffer(b);
		for (const v of vaos) gl.deleteVertexArray(v);
		gl.deleteVertexArray(emptyVao);
		gl.deleteProgram(P);
		gl.deleteProgram(D);
		gl.deleteProgram(S);
		if (accTex) gl.deleteTexture(accTex);
		if (fbo) gl.deleteFramebuffer(fbo);
		view.destroy();
	};
}
