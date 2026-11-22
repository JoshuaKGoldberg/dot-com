// Infinite Mandelbrot zoom. Float32 shaders run out of precision around 1e-5, so deep frames use
// perturbation theory: the CPU computes one reference orbit in doubles, the shader iterates only the
// small float32 delta from it (with Zhuoran-style rebasing, so there are no glitches). A tiny CPU
// autopilot samples the view, steers toward high-iteration boundary points, picks references, and
// when it nears the double-precision floor the image dissolves into the next region.
import { mountCanvas, trackPointer, createLoop, makeButton, observeSize, program, FULLSCREEN_VS } from "./_wild/kit.js";

const MAXREF = 4096;
const S_START = 3.2;
const S_END = 2.5e-9;

const REGIONS = [
	[-0.7436438870371587, 0.13182590420531197],
	[-0.77568377, 0.13646737],
	[0.360240443, -0.641313061],
	[-0.10109636384562, 0.95628651080914],
	[-1.25066, 0.02012],
];

const FS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uOrb;
uniform vec2 uOff;
uniform float uS;
uniform float uAspect;
uniform int uIter;
uniform int uRefLen;
uniform vec2 uRes;
uniform float uDpr;
uniform vec2 uPtr;
uniform float uReveal;
uniform float uFade;
uniform float uDark;
uniform vec3 uCol;
uniform float uHue;
uniform float uBase;
out vec4 o;

vec3 palette(float t){
	vec3 a = uDark > 0.5 ? vec3(0.34, 0.4, 0.58) : vec3(0.55, 0.58, 0.66);
	vec3 b = uDark > 0.5 ? vec3(0.36, 0.36, 0.42) : vec3(0.40, 0.38, 0.40);
	vec3 c = vec3(1.0, 1.0, 1.0);
	vec3 d = (uDark > 0.5 ? vec3(0.55, 0.64, 0.78) : vec3(0.0, 0.14, 0.34)) + uHue;
	return a + b * cos(6.2831853 * (c * t + d));
}

void main(){
	vec2 frag = gl_FragCoord.xy;
	vec2 uv = frag / uRes - 0.5;
	vec2 dc = uOff + vec2(uv.x * uAspect, uv.y) * uS;
	vec2 dz = vec2(0.0);
	int m = 0;
	float mu = -1.0;
	for (int i = 0; i < ${MAXREF}; i++) {
		if (i >= uIter) break;
		vec2 Z = texelFetch(uOrb, ivec2(m, 0), 0).xy;
		dz = vec2(2.0 * (Z.x * dz.x - Z.y * dz.y) + dz.x * dz.x - dz.y * dz.y,
		          2.0 * (Z.x * dz.y + Z.y * dz.x) + 2.0 * dz.x * dz.y) + dc;
		m++;
		vec2 Zn = texelFetch(uOrb, ivec2(m, 0), 0).xy;
		vec2 z = Zn + dz;
		float r2 = dot(z, z);
		if (r2 > 1.0e4) {
			mu = float(i) + 1.0 - log(log(r2) * 0.5) * 1.442695;
			break;
		}
		if (r2 < dot(dz, dz) || m >= uRefLen - 1) { dz = z; m = 0; }
	}

	vec2 p = vec2(frag.x, uRes.y - frag.y) / uDpr;
	float dl = length(p - uPtr);
	float lamp = exp(-dl * dl / (2.0 * 210.0 * 210.0)) * uReveal;
	float inCol = smoothstep(uCol.x - 30.0, uCol.x + 70.0, p.x) * (1.0 - smoothstep(uCol.y - 70.0, uCol.y + 30.0, p.x));
	float A = uBase * (1.0 - uCol.z * inCol) + lamp * 0.62 + uReveal * 0.1;
	A = clamp(A, 0.0, 0.92) * uFade;

	vec3 col;
	if (mu < 0.0) {
		col = uDark > 0.5 ? vec3(0.015, 0.02, 0.06) : vec3(0.97, 0.97, 1.0);
		A *= 0.7;
	} else {
		float lm = log(mu + 1.0);
		float t = lm * 0.42;
		col = palette(t);
		float shade = 0.72 + 0.28 * sin(lm * 5.0);
		col *= shade;
		if (uDark < 0.5) col = mix(col, vec3(1.0), 0.15);
		col += vec3(1.0, 0.9, 0.7) * lamp * 0.18;
	}
	o = vec4(col * A, A);
}`;

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { context: "webgl2", maxDpr: 1, scale: 0.5, maxPixels: 4.5e5 });
	const gl = view.gl;
	if (!gl) {
		view.destroy();
		return;
	}
	const prog = program(gl, FULLSCREEN_VS, FS);
	prog.use();
	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	const orb = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, orb);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, MAXREF, 1, 0, gl.RG, gl.FLOAT, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	gl.clearColor(0, 0, 0, 0);
	prog.seti("uOrb", 0);
	prog.set("uDark", dark ? 1 : 0);

	// ---- view state (doubles live in JS) -----------------------------------------------------
	let cx = REGIONS[0][0];
	let cy = REGIONS[0][1];
	let S = S_START;
	let regionIdx = (Math.random() * REGIONS.length) | 0;
	let hue = 0;
	let fade = 0; // 0..1
	let phase = "in"; // in | run | out
	let ref = { x: cx, y: cy, S: S, len: 1 };
	let col = { l: 0, r: 0, k: 0 };
	let W = 2;
	let H = 2;

	// Capped at 900 so a frame can never stall the GPU long enough for a watchdog reset.
	const iterFor = (s) => Math.min(900, Math.round(150 + 72 * Math.log2(S_START / Math.max(s, 1e-12))));

	function escapeCount(x0, y0, M) {
		let x = 0;
		let y = 0;
		let n = 0;
		while (n < M) {
			const xx = x * x;
			const yy = y * y;
			if (xx + yy > 4) break;
			y = 2 * x * y + y0;
			x = xx - yy + x0;
			n++;
		}
		return n;
	}

	/** Sample the central window; returns {ref, target}. */
	function survey() {
		const M = iterFor(S);
		const G = 18;
		let bestRef = null;
		let bestTarget = null;
		for (let j = 0; j < G; j++) {
			for (let i = 0; i < G; i++) {
				const px = cx + ((i + 0.5) / G - 0.5) * S * 0.9;
				const py = cy + ((j + 0.5) / G - 0.5) * S * 0.9;
				const n = escapeCount(px, py, M);
				if (!bestRef || n > bestRef.n) bestRef = { x: px, y: py, n };
				if (n < M && n > 8 && (!bestTarget || n > bestTarget.n)) bestTarget = { x: px, y: py, n };
			}
		}
		// hill-climb the reference toward a point that survives all M iterations, so the shader
		// rarely has to rebase onto a full-magnitude z (which would throw away the precision we need)
		let win = S * 0.45;
		for (let round = 0; round < 40 && bestRef.n < M; round++) {
			let improved = null;
			for (let j = 0; j < 7; j++) {
				for (let i = 0; i < 7; i++) {
					const px = bestRef.x + ((i + 0.5) / 7 - 0.5) * win;
					const py = bestRef.y + ((j + 0.5) / 7 - 0.5) * win;
					const n = escapeCount(px, py, M);
					if (n > (improved ? improved.n : bestRef.n)) improved = { x: px, y: py, n };
				}
			}
			if (improved) bestRef = improved;
			win *= 0.62;
		}
		return { ref: bestRef, target: bestTarget, M };
	}

	function buildReference(rx, ry, M) {
		const data = new Float32Array(MAXREF * 2);
		let x = 0;
		let y = 0;
		let len = 1; // Z0 = 0
		for (let n = 0; n < Math.min(M + 4, MAXREF - 2); n++) {
			const xx = x * x;
			const yy = y * y;
			const ny = 2 * x * y + ry;
			x = xx - yy + rx;
			y = ny;
			if (x * x + y * y > 16) break;
			data[len * 2] = x;
			data[len * 2 + 1] = y;
			len++;
		}
		gl.bindTexture(gl.TEXTURE_2D, orb);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MAXREF, 1, gl.RG, gl.FLOAT, data);
		ref = { x: rx, y: ry, S, len };
	}

	function refresh(force) {
		if (!force && S > ref.S / 6) return null;
		const sv = survey();
		if (sv.ref) buildReference(sv.ref.x, sv.ref.y, sv.M);
		return sv;
	}

	function startRegion(idx) {
		regionIdx = idx % REGIONS.length;
		cx = REGIONS[regionIdx][0];
		cy = REGIONS[regionIdx][1];
		S = S_START;
		hue = (hue + 0.23) % 1;
		refresh(true);
	}

	// ---- pointer / keys ----------------------------------------------------------------------
	const BLOCK = "a, button, input, p, h1, h2, h3, li, span, img, nav, time, picture";
	let diving = 0; // +1 in, -1 out
	let pointerDive = false;
	let activeUntil = 0;
	const ptr = trackPointer(layer, {
		onMove: () => {
			activeUntil = performance.now() + 2600;
			if (reducedMotion) requestAnimationFrame(() => draw());
		},
		onDown: (p, e) => {
			if (e.target.closest?.(BLOCK)) return;
			if (reducedMotion) {
				startRegion(regionIdx + 1);
				staticDive();
				return;
			}
			pointerDive = true;
		},
		onUp: () => {
			pointerDive = false;
		},
	});
	const keys = new Set();
	const onKey = (e) => {
		if (e.target.closest?.("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
		const k = e.key.toLowerCase();
		if (k !== "z" && k !== "x") return;
		e.preventDefault();
		if (e.type === "keydown") keys.add(k);
		else keys.delete(k);
		activeUntil = performance.now() + 2600;
	};
	window.addEventListener("keydown", onKey);
	window.addEventListener("keyup", onKey);

	function pointerComplex() {
		const sx = ptr.seen ? ptr.x / view.cssW : 0.5;
		const sy = ptr.seen ? 1 - ptr.y / view.cssH : 0.5;
		const asp = view.cssW / view.cssH;
		return [cx + (sx - 0.5) * asp * S, cy + (sy - 0.5) * S];
	}

	// ---- draw -----------------------------------------------------------------------------------
	function draw() {
		gl.viewport(0, 0, view.width, view.height);
		gl.clear(gl.COLOR_BUFFER_BIT);
		prog.use();
		gl.bindVertexArray(vao);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, orb);
		prog.set("uOff", cx - ref.x, cy - ref.y);
		prog.set("uS", S);
		prog.set("uAspect", view.cssW / view.cssH);
		gl.uniform1i(prog.loc("uIter"), iterFor(S));
		gl.uniform1i(prog.loc("uRefLen"), ref.len);
		prog.set("uRes", view.width, view.height);
		prog.set("uDpr", view.dpr);
		prog.set("uPtr", ptr.seen ? ptr.x : -9999, ptr.seen ? ptr.y : -9999);
		const alive = ptr.seen && ptr.inside && (performance.now() < activeUntil || reducedMotion);
		prog.set("uReveal", reveal);
		prog.set("uFade", fade);
		prog.set("uCol", col.l, col.r, col.k);
		prog.set("uHue", hue);
		prog.set("uBase", dark ? 0.3 : 0.34);
		void alive;
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	let reveal = 0;
	function measure() {
		const lr = layer.getBoundingClientRect();
		const page = root.querySelector(".site-page");
		if (page && W > 900) {
			const pr = page.getBoundingClientRect();
			col = { l: pr.left - lr.left + 40, r: pr.right - lr.left - 40, k: 0.72 };
		} else col = { l: 0, r: W, k: 0.5 };
	}

	function staticDive() {
		// reduced motion: run the autopilot synchronously down to a rich, fixed frame
		S = S_START;
		refresh(true);
		for (let k = 0; k < 14; k++) {
			S *= 0.42;
			const sv = survey();
			if (sv.target) {
				cx += (sv.target.x - cx) * 0.7;
				cy += (sv.target.y - cy) * 0.7;
			}
		}
		refresh(true);
		fade = 1;
		draw();
	}

	// ---- loop -----------------------------------------------------------------------------------
	let pilotTimer = 0;
	let loop = null;
	function tick(dt) {
		const interactive = pointerDive || keys.size > 0;
		const alive = ptr.seen && ptr.inside && performance.now() < activeUntil;
		reveal += ((alive || interactive ? 1 : 0) - reveal) * Math.min(1, dt * 3.5);

		if (phase === "in") {
			fade = Math.min(1, fade + dt / 1.6);
			if (fade >= 1) phase = "run";
		} else if (phase === "out") {
			fade = Math.max(0, fade - dt / 1.6);
			if (fade <= 0) {
				startRegion(regionIdx + 1);
				phase = "in";
			}
		}

		let rate = 0.105; // e-folds per second
		if (interactive) {
			const dir = keys.has("x") ? -1 : 1;
			rate = dir * 0.95;
			const [px, py] = ptr.seen ? pointerComplex() : [cx, cy];
			const S2 = Math.min(S_START, S * Math.exp(-rate * dt));
			const k = S2 / S;
			// keep the complex point under the pointer fixed while scaling
			cx = px - (px - cx) * k;
			cy = py - (py - cy) * k;
			S = S2;
			pilotTimer -= dt;
			if (pilotTimer <= 0) {
				pilotTimer = 0.6;
				const sv = survey();
				if (sv.target) {
					pilot.x = sv.target.x;
					pilot.y = sv.target.y;
					pilot.on = true;
				}
			}
			if (pilot.on && rate > 0) {
				// gentle pull toward interesting boundary so a dive never ends in empty exterior
				const g = 1 - Math.exp(-dt * 0.9);
				cx += (pilot.x - cx) * g * 0.6;
				cy += (pilot.y - cy) * g * 0.6;
			}
		} else {
			S *= Math.exp(-rate * dt);
			pilotTimer -= dt;
			if (pilotTimer <= 0) {
				pilotTimer = 1.1;
				const sv = survey();
				if (sv.target) {
					pilot.x = sv.target.x;
					pilot.y = sv.target.y;
					pilot.on = true;
				}
			}
			if (pilot.on) {
				const g = 1 - Math.exp(-dt * 0.55);
				const mx = (pilot.x - cx) * g;
				const my = (pilot.y - cy) * g;
				const cap = S * 0.12 * dt;
				const mag = Math.hypot(mx, my);
				const f = mag > cap ? cap / mag : 1;
				cx += mx * f;
				cy += my * f;
			}
		}
		refresh(false);
		if (S <= S_END && phase === "run") phase = "out";
		draw();
	}
	const pilot = { x: 0, y: 0, on: false };

	function resize() {
		view.fit();
		W = view.cssW;
		H = view.cssH;
		measure();
	}

	resize();
	startRegion(regionIdx);
	const button = makeButton(root, reducedMotion ? "next region" : "hold Z / press in the margin to dive · X to retreat", {
		title: "Hold Z (or press and hold on empty background) to zoom toward the cursor; hold X to zoom back out",
	});
	button.addEventListener("click", () => {
		if (reducedMotion) {
			startRegion(regionIdx + 1);
			staticDive();
		} else if (phase === "run") phase = "out";
	});

	if (reducedMotion) {
		staticDive();
	} else {
		fade = 0;
		loop = createLoop((dt) => tick(dt), { maxDt: 0.05, fps: 30 });
	}

	const stopSize = observeSize(layer, () => {
		const w0 = W;
		resize();
		if (Math.abs(W - w0) > 2 && reducedMotion) draw();
	});

	return () => {
		loop?.stop();
		stopSize();
		ptr.destroy();
		window.removeEventListener("keydown", onKey);
		window.removeEventListener("keyup", onKey);
		button.remove();
		gl.deleteTexture(orb);
		gl.deleteVertexArray(vao);
		prog.dispose();
		view.destroy();
	};
}
