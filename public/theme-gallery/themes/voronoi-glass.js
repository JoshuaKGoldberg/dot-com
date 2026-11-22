// Voronoi stained glass: sites are Lloyd-relaxed on the CPU (weighted so cells thin out behind the
// text column); the glass itself is a WebGL2 fragment shader that finds nearest and second-nearest
// cell in one pass each. Move the cursor to light it, click to shatter.
import { mountCanvas, trackPointer, createLoop, makeButton, observeSize, program, FULLSCREEN_VS, hsl } from "./_wild/kit.js";

const MAXN = 180;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uSites;
uniform int uN;
uniform vec2 uRes;
uniform float uDpr;
uniform vec2 uPtr;
uniform float uReveal;
uniform float uTime;
uniform vec3 uPulse;
uniform float uDark;
uniform vec3 uCol;      // column left, right, strength
uniform float uBase;
uniform vec3 uPal[8];
uniform vec3 uBg;
out vec4 o;

void main(){
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
	float best = 1e12; int bi = 0;
	for (int i = 0; i < ${MAXN}; i++) {
		if (i >= uN) break;
		vec4 s = texelFetch(uSites, ivec2(i, 0), 0);
		float b = texelFetch(uSites, ivec2(i, 1), 0).x;
		vec2 d = p - s.xy;
		float c = dot(d, d) + b;
		if (c < best) { best = c; bi = i; }
	}
	vec4 S = texelFetch(uSites, ivec2(bi, 0), 0);
	float edge = 1e4;
	for (int j = 0; j < ${MAXN}; j++) {
		if (j >= uN) break;
		if (j == bi) continue;
		vec4 s = texelFetch(uSites, ivec2(j, 0), 0);
		float b = texelFetch(uSites, ivec2(j, 1), 0).x;
		vec2 d = p - s.xy;
		float c = dot(d, d) + b;
		float L = length(s.xy - S.xy);
		edge = min(edge, (c - best) / (2.0 * L + 1e-3));
	}

	int ci = int(mod(S.z, 8.0));
	vec3 glass = uPal[ci];
	float tint = fract(S.z * 0.137);
	// pooled colour toward the lead, faint hand-made streaks, slow sunbeam
	float pool = smoothstep(0.0, 34.0, edge);
	float streak = sin(p.x * 0.047 + S.z * 7.1 + sin(p.y * 0.021 + S.z)) * sin(p.y * 0.039 + S.z * 3.3);
	float lum = 0.74 + 0.26 * pool + 0.09 * streak + (tint - 0.5) * 0.14;
	float beam = pow(0.5 + 0.5 * sin(dot(p, vec2(0.72, 0.52)) * 0.0042 - uTime * 0.1), 7.0);
	vec3 col = glass * lum;

	float dl = length(p - uPtr);
	float lamp = exp(-dl * dl / (2.0 * 170.0 * 170.0)) * uReveal;
	col += vec3(1.0, 0.93, 0.78) * lamp * (0.28 + 0.4 * (1.0 - pool));
	col += glass * beam * 0.35;

	float rim = smoothstep(7.0, 1.8, edge) * (1.0 - smoothstep(1.2, 2.2, edge));
	float lead = 1.0 - smoothstep(1.5, 3.1, edge);
	col += vec3(1.0) * rim * 0.18 * (0.4 + lamp);

	float flash = S.w;
	col = mix(col, vec3(1.0, 0.97, 0.9), clamp(flash, 0.0, 1.0) * 0.65);

	float ringD = abs(length(p - uPulse.xy) - uPulse.z * 720.0);
	float ring = exp(-ringD * ringD / 3600.0) * max(0.0, 1.0 - uPulse.z / 1.5);

	// subtle behind the text column, bright near the cursor
	float inCol = smoothstep(uCol.x - 30.0, uCol.x + 60.0, p.x) * (1.0 - smoothstep(uCol.y - 60.0, uCol.y + 30.0, p.x));
	float A = uBase * (1.0 - uCol.z * inCol);
	A += lamp * 0.78 + flash * 0.55 + beam * 0.05 + ring * 0.7;
	A = clamp(A, 0.0, 0.94);

	vec3 leadCol = mix(vec3(0.07, 0.09, 0.15), vec3(0.01, 0.015, 0.03), uDark);
	vec3 outc = mix(col, leadCol, lead * 0.92);
	float alpha = mix(A, min(1.0, A * 1.25 + 0.02), lead);
	if (uDark > 0.5) {
		// glowing glass: light adds to the page rather than covering it
		o = vec4(outc * alpha * 1.05, alpha * mix(0.35, 0.9, lead * (1.0 - flash)));
	} else {
		o = vec4(outc * alpha, alpha);
	}
}`;

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { context: "webgl2", maxDpr: 1.25, scale: 0.6, maxPixels: 7e5 });
	const gl = view.gl;
	if (!gl) {
		view.destroy();
		return;
	}

	const prog = program(gl, FULLSCREEN_VS, FS);
	prog.use();
	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);

	const tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, MAXN, 2, 0, gl.RGBA, gl.FLOAT, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	gl.clearColor(0, 0, 0, 0);

	// jewel palette, tuned per mode
	const palHues = [218, 352, 38, 152, 276, 188, 48, 330];
	const pal = new Float32Array(24);
	palHues.forEach((h, i) => {
		const c = dark ? hsl(h, 82, 52) : hsl(h, 72, 50);
		pal.set(c, i * 3);
	});
	gl.uniform3fv(prog.loc("uPal"), pal);
	prog.set("uDark", dark ? 1 : 0);
	prog.seti("uSites", 0);

	// ---- sites ---------------------------------------------------------------------------
	const sx = new Float32Array(MAXN);
	const sy = new Float32Array(MAXN);
	const svx = new Float32Array(MAXN);
	const svy = new Float32Array(MAXN);
	const scol = new Float32Array(MAXN);
	const sflash = new Float32Array(MAXN);
	const sbias = new Float32Array(MAXN);
	const sage = new Float32Array(MAXN);
	const sshard = new Uint8Array(MAXN);
	let N = 0;
	let baseN = 0;
	let W = 2;
	let H = 2;
	let col = { l: 0, r: 0, k: 0 };
	const data = new Float32Array(MAXN * 8);

	const rho = (x) => {
		if (!col.k) return 1;
		const t = Math.min(1, Math.max(0, (x - col.l) / 80)) * Math.min(1, Math.max(0, (col.r - x) / 80));
		return 1 - 0.7 * t;
	};

	function seed() {
		baseN = Math.round(Math.min(150, Math.max(60, (W * H) / 8200)));
		N = 0;
		for (let i = 0; i < baseN; i++) {
			// rejection-sample against rho so relaxation starts close to the target density
			let x, y;
			do {
				x = Math.random() * W;
				y = Math.random() * H;
			} while (Math.random() > rho(x));
			addSite(x, y, 0, 0, false);
		}
	}

	function addSite(x, y, vx, vy, shard) {
		if (N >= MAXN) return -1;
		const i = N++;
		sx[i] = x;
		sy[i] = y;
		svx[i] = vx;
		svy[i] = vy;
		scol[i] = Math.random() < 0.38 ? 0 + (Math.random() < 0.5 ? 0 : 5) : (Math.random() * 8) | 0;
		sflash[i] = 0;
		sbias[i] = 0;
		sage[i] = 0;
		sshard[i] = shard ? 1 : 0;
		return i;
	}

	function removeSite(i) {
		const last = N - 1;
		if (i !== last) {
			for (const a of [sx, sy, svx, svy, scol, sflash, sbias, sage, sshard]) a[i] = a[last];
		}
		N--;
	}

	// ---- Lloyd relaxation by sampling ---------------------------------------------------------
	const GS = 18;
	let accX = new Float32Array(MAXN);
	let accY = new Float32Array(MAXN);
	let accW = new Float32Array(MAXN);
	let energy = 1;

	function lloyd(rate) {
		accX.fill(0, 0, N);
		accY.fill(0, 0, N);
		accW.fill(0, 0, N);
		for (let gy = GS / 2; gy < H; gy += GS) {
			for (let gx = GS / 2; gx < W; gx += GS) {
				let best = 1e12;
				let bi = 0;
				for (let i = 0; i < N; i++) {
					const dx = gx - sx[i];
					const dy = gy - sy[i];
					const c = dx * dx + dy * dy + sbias[i];
					if (c < best) {
						best = c;
						bi = i;
					}
				}
				const w = rho(gx);
				accX[bi] += gx * w;
				accY[bi] += gy * w;
				accW[bi] += w;
			}
		}
		let e = 0;
		for (let i = 0; i < N; i++) {
			if (accW[i] <= 0) continue;
			const tx = accX[i] / accW[i];
			const ty = accY[i] / accW[i];
			let dx = tx - sx[i];
			let dy = ty - sy[i];
			const d = Math.hypot(dx, dy);
			if (d < 1.2) continue; // dead zone stops sampling jitter
			dx *= rate;
			dy *= rate;
			sx[i] += dx;
			sy[i] += dy;
			e += Math.abs(dx) + Math.abs(dy);
		}
		energy = e;
	}

	// ---- interaction ----------------------------------------------------------------------------
	let pulse = { x: 0, y: 0, t: 9 };
	let revealTarget = 0;
	let reveal = 0;

	function shatter(px, py, { K = 38, R = 120, power = 1 } = {}) {
		pulse = { x: px, y: py, t: 0 };
		for (let k = 0; k < K; k++) {
			const a = Math.random() * 6.283;
			const r = R * Math.pow(Math.random(), 0.8);
			const sp = (1.2 + Math.random() * 5.5) * power;
			const i = addSite(px + Math.cos(a) * r * 0.5, py + Math.sin(a) * r * 0.5, Math.cos(a) * sp, Math.sin(a) * sp, true);
			if (i < 0) break;
			sbias[i] = 90000; // opens from nothing
			sflash[i] = 1;
			sage[i] = 0;
		}
		for (let i = 0; i < N; i++) {
			if (sshard[i]) continue;
			const dx = sx[i] - px;
			const dy = sy[i] - py;
			const d = Math.hypot(dx, dy) + 1;
			if (d < 340 * power) {
				const k = (1 - d / (340 * power)) * 9 * power;
				svx[i] += (dx / d) * k;
				svy[i] += (dy / d) * k;
				sflash[i] = Math.max(sflash[i], 1 - d / (340 * power));
			}
		}
		energy = 1;
	}

	const ptr = trackPointer(layer, {
		onMove: () => {
			revealTarget = 1;
			wake();
		},
		onDown: (p, e) => {
			if (e.target.closest?.("button, input, a")) return;
			if (reducedMotion) return;
			shatter(p.x, p.y);
			wake();
		},
	});

	// ---- step + render ----------------------------------------------------------------------------
	function stepPhysics(dt) {
		for (let i = 0; i < N; i++) {
			sx[i] += svx[i];
			sy[i] += svy[i];
			svx[i] *= 0.9;
			svy[i] *= 0.9;
			sflash[i] *= 0.965;
			sage[i] += dt;
			if (sshard[i]) {
				const a = sage[i];
				if (a < 0.4) sbias[i] = 90000 * (1 - Math.min(1, a / 0.4)) ** 2;
				else if (a > 2.6) {
					sbias[i] += 60000 * dt * 1.2 + (a - 2.6) * 30000 * dt;
				}
			}
		}
		for (let i = N - 1; i >= 0; i--) if (sshard[i] && sbias[i] > 60000 && sage[i] > 1) removeSite(i);
		for (let i = 0; i < N; i++) {
			if (sx[i] < -20) sx[i] = -20;
			else if (sx[i] > W + 20) sx[i] = W + 20;
			if (sy[i] < -20) sy[i] = -20;
			else if (sy[i] > H + 20) sy[i] = H + 20;
		}
	}

	function upload() {
		for (let i = 0; i < N; i++) {
			data[i * 4] = sx[i];
			data[i * 4 + 1] = sy[i];
			data[i * 4 + 2] = scol[i];
			data[i * 4 + 3] = sflash[i];
			data[MAXN * 4 + i * 4] = sbias[i];
		}
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MAXN, 2, gl.RGBA, gl.FLOAT, data);
	}

	function draw(t) {
		upload();
		gl.viewport(0, 0, view.width, view.height);
		gl.clear(gl.COLOR_BUFFER_BIT);
		prog.use();
		gl.bindVertexArray(vao);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.uniform1i(prog.loc("uN"), N);
		prog.set("uRes", view.width, view.height);
		prog.set("uDpr", view.dpr);
		prog.set("uPtr", ptr.seen ? ptr.x : -9999, ptr.seen ? ptr.y : -9999);
		prog.set("uReveal", reveal);
		prog.set("uTime", t);
		prog.set("uPulse", pulse.x, pulse.y, pulse.t);
		prog.set("uCol", col.l, col.r, col.k);
		prog.set("uBase", dark ? 0.12 : 0.15);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	function measure() {
		const lr = layer.getBoundingClientRect();
		const page = root.querySelector(".site-page");
		if (page && W > 900) {
			const pr = page.getBoundingClientRect();
			col = { l: pr.left - lr.left + 40, r: pr.right - lr.left - 40, k: 0.8 };
		} else col = { l: 0, r: W, k: 0.45 };
	}

	function resize() {
		view.fit();
		W = view.cssW;
		H = view.cssH;
		measure();
		seed();
		for (let s = 0; s < (reducedMotion ? 70 : 6); s++) lloyd(0.5);
		energy = 1;
	}

	// ---- loop -------------------------------------------------------------------------------------
	let loop = null;
	let lastActive = 0;
	let nextAuto = 4;
	let frameNo = 0;
	function wake() {
		lastActive = performance.now();
		if (reducedMotion) {
			requestAnimationFrame(() => {
				reveal += (revealTarget - reveal) * 0.5;
				reveal = ptr.seen ? 1 : 0;
				draw(3);
			});
		} else loop?.kick?.();
	}

	resize();
	const button = makeButton(root, reducedMotion ? "re-cut the glass" : "click to shatter", {
		title: "Click anywhere on the background to shatter the glass; move the pointer to light it",
	});
	button.addEventListener("click", () => {
		if (reducedMotion) {
			seed();
			for (let s = 0; s < 70; s++) lloyd(0.5);
			draw(3);
		} else shatter(W * (0.15 + Math.random() * 0.7), H * (0.2 + Math.random() * 0.6), { K: 44, R: 150 });
	});

	if (reducedMotion) {
		reveal = 0;
		draw(3);
	} else {
		loop = createLoop((dt, t) => {
			frameNo++;
			const now = performance.now();
			pulse.t += dt;
			// ease pointer reveal toward 1 while the pointer is lively, back to 0.28 when idle
			const alive = ptr.seen && ptr.inside && now - ptr.lastMove < 2500;
			revealTarget = alive ? 1 : 0;
			reveal += (revealTarget - reveal) * Math.min(1, dt * 4);
			stepPhysics(dt);
			if (energy > 0.4 || sshard.subarray(0, N).some(Boolean) || frameNo % 4 === 0) lloyd(sshardAny() ? 0.16 : 0.1);
			if (t > nextAuto && !ptr.down) {
				nextAuto = t + 9 + Math.random() * 7;
				const left = Math.random() < 0.5;
				const px = col.k && W > 900 ? (left ? Math.random() * col.l : col.r + Math.random() * (W - col.r)) : Math.random() * W;
				shatter(px, Math.random() * H, { K: 14, R: 70, power: 0.45 });
			}
			draw(t);
		});
	}
	function sshardAny() {
		for (let i = 0; i < N; i++) if (sshard[i]) return true;
		return false;
	}

	const stopSize = observeSize(layer, () => {
		const w0 = W;
		const h0 = H;
		view.fit();
		if (Math.abs(view.cssW - w0) > 4 || Math.abs(view.cssH - h0) > 4) {
			resize();
			if (reducedMotion) draw(3);
		}
	});
	const onScroll = () => {};
	root.addEventListener("scroll", onScroll, { passive: true });

	return () => {
		loop?.stop();
		stopSize();
		root.removeEventListener("scroll", onScroll);
		ptr.destroy();
		button.remove();
		gl.deleteTexture(tex);
		gl.deleteVertexArray(vao);
		prog.dispose();
		view.destroy();
	};
}
