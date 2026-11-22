// Electric field lines between draggable charges, traced on the CPU and drawn as pulsing GL lines + iron filings.
import { createLoop, makeButton, mountCanvas, program, siteColors, trackPointer } from "./_kit/kit.js";

const LVS = `#version 300 es
precision highp float;
layout(location=0) in vec2 pos; layout(location=1) in vec3 meta; // s, seed, u (-1 = filing, value in seed)
uniform vec2 cssSize;
out vec3 vMeta;
void main(){ vec2 c = pos / cssSize * 2. - 1.; gl_Position = vec4(c.x, -c.y, 0., 1.); vMeta = meta; }`;
const LFS = `#version 300 es
precision mediump float;
in vec3 vMeta; uniform float time, dark, boost; uniform vec3 warm, cool, muted; out vec4 o;
void main(){
	float a; vec3 c;
	if (vMeta.z < -0.5) { // filing
		a = vMeta.y * (dark > .5 ? .34 : .3); c = muted;
	} else {
		float ph = fract(vMeta.x / 210. - time * .28 + vMeta.y);
		float pulse = pow(1. - ph, 5.) * smoothstep(0., .03, ph);
		float fadeIn = smoothstep(0., 36., vMeta.x);
		a = (.27 + .73 * pulse) * fadeIn * (.8 + .4*boost);
		c = mix(warm, cool, smoothstep(0., 1., vMeta.z));
		c = mix(c, vec3(dark > .5 ? 1. : .1), pulse * (dark > .5 ? .45 : .25));
	}
	o = vec4(c * a, dark > .5 ? a * .6 : a);
}`;
const PVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 p; // x,y,q
uniform vec2 cssSize; uniform float dpr, size; out float vQ;
void main(){ vec2 c = p.xy / cssSize * 2. - 1.; gl_Position = vec4(c.x, -c.y, 0., 1.); gl_PointSize = size * dpr; vQ = p.z; }`;
const PFS = `#version 300 es
precision mediump float;
in float vQ; uniform vec3 warm, cool; uniform float dark; out vec4 o;
void main(){
	vec2 d = gl_PointCoord * 2. - 1.; float r = length(d);
	if (r > 1.) discard;
	vec3 base = vQ > 0. ? warm : cool;
	float glow = smoothstep(1., .35, r) * .45;
	float disc = smoothstep(.43, .38, r);
	float ring = smoothstep(.5, .45, r) * smoothstep(.36, .41, r);
	float sym = 0.;
	vec2 q = d / .3;
	float hbar = step(abs(q.y), .18) * step(abs(q.x), 1.);
	float vbar = step(abs(q.x), .18) * step(abs(q.y), 1.) * (vQ > 0. ? 1. : 0.);
	sym = max(hbar, vbar);
	vec3 c = base;
	c = mix(c, mix(base, vec3(1.), .55), ring);
	c = mix(c, vec3(dark > .5 ? .05 : 1.), sym * disc);
	float a = max(max(glow, disc), ring);
	o = vec4(c * a, dark > .5 ? a * .85 : a);
}`;

const SEEDS = 34;
const STEP = 5;
const MAX_STEPS = 330;
const MAX_CHARGES = 6;

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { scale: 1, maxDpr: 1.5, options: { antialias: true } });
	const gl = view.gl;
	if (!gl) return () => view.destroy();
	const colors = siteColors(root);
	const warm = dark ? [1, 0.55, 0.32] : [0.86, 0.3, 0.12];
	const cool = dark ? [0.38, 0.85, 0.95] : [0.04, 0.38, 0.52];
	const muted = dark ? [0.5, 0.7, 0.78] : [0.3, 0.4, 0.45];
	const lp = program(gl, LVS, LFS);
	const pp = program(gl, PVS, PFS);

	const hint = document.createElement("div");
	hint.className = "fl-hint";
	hint.textContent = "Drag a charge";
	root.append(hint);
	const dock = document.createElement("div");
	dock.className = "fl-dock";
	root.append(dock);
	const bPos = makeButton(dock, "+ charge", { title: "Add a positive charge" });
	const bNeg = makeButton(dock, "− charge", { title: "Add a negative charge" });
	const bReset = makeButton(dock, "Reset", { title: "Restore the three starting charges" });
	bPos.dataset.act = "pos";
	bNeg.dataset.act = "neg";
	bReset.dataset.act = "reset";

	// charges live in fractions of the viewport so resizing keeps the composition
	const START = () => [
		{ fx: 0.1, fy: 0.3, q: 1 },
		{ fx: 0.9, fy: 0.5, q: -1.6 },
		{ fx: 0.16, fy: 0.78, q: 1 },
	];
	let charges = START();
	for (const c of charges) {
		c.ph = Math.random() * 6.28;
		c.x = 0;
		c.y = 0;
	}

	let W = view.cssW;
	let H = view.cssH;
	const maxVerts = (SEEDS * 4 * MAX_STEPS) * 2 + 8000;
	const lineData = new Float32Array(maxVerts * 5);
	let lineCount = 0;
	let filingCount = 0;
	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	const lbuf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, lbuf);
	gl.bufferData(gl.ARRAY_BUFFER, lineData.byteLength, gl.DYNAMIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
	gl.enableVertexAttribArray(1);
	gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 8);
	const pvao = gl.createVertexArray();
	gl.bindVertexArray(pvao);
	const pbuf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
	const pdata = new Float32Array(MAX_CHARGES * 3);

	let ex = 0;
	let ey = 0;
	function field(x, y) {
		let fx = 0;
		let fy = 0;
		for (const c of charges) {
			const dx = x - c.x;
			const dy = y - c.y;
			const r2 = dx * dx + dy * dy + 64;
			fx += (c.q * dx) / r2;
			fy += (c.q * dy) / r2;
		}
		ex = fx;
		ey = fy;
	}
	const hash = (n) => {
		const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
		return s - Math.floor(s);
	};

	function trace(sx, sy, dir, id, fromSign) {
		// RK2 along dir * E; returns number of points written (into temp)
		let x = sx;
		let y = sy;
		const pts = tmp;
		let n = 0;
		let s = 0;
		let hit = 0;
		for (let i = 0; i < MAX_STEPS; i++) {
			pts[n * 3] = x;
			pts[n * 3 + 1] = y;
			pts[n * 3 + 2] = s;
			n++;
			field(x, y);
			let m = Math.hypot(ex, ey);
			if (m < 1e-7) break;
			const k1x = (dir * ex) / m;
			const k1y = (dir * ey) / m;
			field(x + (k1x * STEP) / 2, y + (k1y * STEP) / 2);
			m = Math.hypot(ex, ey);
			if (m < 1e-7) break;
			x += ((dir * ex) / m) * STEP;
			y += ((dir * ey) / m) * STEP;
			s += STEP;
			// terminate on a sink (opposite sign charge)
			let done = false;
			for (const c of charges) {
				if (c.q * dir < 0 && Math.hypot(x - c.x, y - c.y) < 9) {
					hit = c.q * dir;
					done = true;
					break;
				}
			}
			if (done) {
				pts[n * 3] = x;
				pts[n * 3 + 1] = y;
				pts[n * 3 + 2] = s;
				n++;
				break;
			}
			if (x < -30 || y < -30 || x > W + 30 || y > H + 30) break;
		}
		return { n, hit };
	}
	const tmp = new Float32Array((MAX_STEPS + 4) * 3);

	function rebuild() {
		let v = 0;
		const put = (x, y, a, b, c) => {
			const o = v * 5;
			lineData[o] = x;
			lineData[o + 1] = y;
			lineData[o + 2] = a;
			lineData[o + 3] = b;
			lineData[o + 4] = c;
			v++;
		};
		const hasPos = charges.some((c) => c.q > 0);
		let id = 0;
		for (const c of charges) {
			if (c.q < 0 && hasPos) {
				// negative charges only seed lines that escape to the edge (no duplicates)
			}
			const count = Math.max(8, Math.round(SEEDS * Math.min(2, Math.abs(c.q))));
			const dir = c.q > 0 ? 1 : -1;
			const rot = c.ph * 0.0 + hash(id + 1) * 6.28;
			for (let k = 0; k < count; k++) {
				const a = rot + (k / count) * 6.2832;
				const sx = c.x + Math.cos(a) * 11;
				const sy = c.y + Math.sin(a) * 11;
				const { n, hit } = trace(sx, sy, dir, id, c.q);
				if (c.q < 0 && hasPos && hit) continue; // duplicate of a line from a positive charge
				if (n < 3) continue;
				const seed = hash(id * 7 + k);
				const total = tmp[(n - 1) * 3 + 2] || 1;
				for (let i = 0; i < n - 1; i++) {
					// orient u: 0 at the positive end, 1 at the negative end
					const u0 = c.q > 0 ? tmp[i * 3 + 2] / total : 1 - tmp[i * 3 + 2] / total;
					const u1 = c.q > 0 ? tmp[(i + 1) * 3 + 2] / total : 1 - tmp[(i + 1) * 3 + 2] / total;
					// pulses travel positive -> negative: for negative seeds, arc length runs against the flow
					const s0 = c.q > 0 ? tmp[i * 3 + 2] : total - tmp[i * 3 + 2];
					const s1 = c.q > 0 ? tmp[(i + 1) * 3 + 2] : total - tmp[(i + 1) * 3 + 2];
					put(tmp[i * 3], tmp[i * 3 + 1], s0, seed, Math.min(1, u0 * 1.1));
					put(tmp[(i + 1) * 3], tmp[(i + 1) * 3 + 1], s1, seed, Math.min(1, u1 * 1.1));
				}
				if (v > maxVerts - 8000) break;
			}
			id++;
		}
		lineCount = v;
		// iron filings
		const gap = Math.max(24, Math.sqrt((W * H) / 1700));
		let fv = 0;
		for (let y = gap / 2; y < H; y += gap) {
			for (let x = gap / 2 + ((Math.floor(y / gap) & 1) * gap) / 2; x < W; x += gap) {
				const jx = x + (hash(x * 3.1 + y) - 0.5) * gap * 0.5;
				const jy = y + (hash(y * 5.7 + x) - 0.5) * gap * 0.5;
				field(jx, jy);
				const m = Math.hypot(ex, ey);
				if (m < 1e-6) continue;
				const dx = ex / m;
				const dy = ey / m;
				const len = 4.5;
				const a = Math.min(1, m * 90 + 0.18);
				put(jx - dx * len, jy - dy * len, 0, a, -1);
				put(jx + dx * len, jy + dy * len, 0, a, -1);
				fv += 2;
				if (v > maxVerts - 4) break;
			}
		}
		filingCount = fv;
		gl.bindBuffer(gl.ARRAY_BUFFER, lbuf);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, lineData, 0, v * 5);
		total = v;
	}
	let total = 0;

	function place(t) {
		for (const c of charges) {
			if (c.drag) continue;
			const wob = reducedMotion ? 0 : 1;
			c.x = c.fx * W + Math.sin(t * 0.21 + c.ph) * 16 * wob;
			c.y = c.fy * H + Math.cos(t * 0.17 + c.ph * 1.3) * 12 * wob;
		}
	}

	function draw(t, boost) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, view.width, view.height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, dark ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
		gl.bindVertexArray(vao);
		lp.use();
		lp.set("cssSize", W, H);
		lp.set("time", t);
		lp.set("dark", dark ? 1 : 0);
		lp.set("boost", boost);
		lp.set("warm", warm);
		lp.set("cool", cool);
		lp.set("muted", muted);
		gl.drawArrays(gl.LINES, 0, total);
		// charges
		charges.forEach((c, i) => {
			pdata[i * 3] = c.x;
			pdata[i * 3 + 1] = c.y;
			pdata[i * 3 + 2] = c.q;
		});
		gl.bindVertexArray(pvao);
		gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
		gl.bufferData(gl.ARRAY_BUFFER, pdata, gl.DYNAMIC_DRAW);
		pp.use();
		pp.set("cssSize", W, H);
		pp.set("dpr", view.dpr);
		pp.set("size", 34);
		pp.set("warm", warm);
		pp.set("cool", cool);
		pp.set("dark", dark ? 1 : 0);
		gl.drawArrays(gl.POINTS, 0, charges.length);
	}

	let boost = 0;
	let lastInteract = -1e9;
	const frame = (dt, t) => {
		place(t);
		rebuild();
		if (performance.now() - lastInteract > 3000) boost = Math.max(0, boost - dt * 0.4);
		draw(reducedMotion ? 3 : t, boost);
	};

	// dragging via window listeners so text and links stay clickable
	let dragging = null;
	const hit = (s) => charges.find((c) => Math.hypot(c.x - s.x, c.y - s.y) < 20);
	const pointer = trackPointer(layer, {
		onDown(s, e) {
			if (e.button !== 0) return;
			const c = hit(s);
			if (!c) return;
			e.preventDefault();
			dragging = c;
			window.getSelection()?.removeAllRanges();
			c.drag = true;
			boost = 1;
			root.style.cursor = "grabbing";
			hint.style.opacity = "0";
			loop.kick(reducedMotion ? 3 : 1);
		},
		onMove(s) {
			if (dragging) {
				dragging.x = Math.min(Math.max(s.x, 8), W - 8);
				dragging.y = Math.min(Math.max(s.y, 8), H - 8);
				dragging.fx = dragging.x / W;
				dragging.fy = dragging.y / H;
				lastInteract = performance.now();
				boost = 1;
				loop.kick(reducedMotion ? 3 : 1);
			} else if (s.inside) {
				root.style.cursor = hit(s) ? "grab" : "";
			}
		},
		onUp() {
			if (dragging) {
				dragging.drag = false;
				dragging = null;
				root.style.cursor = "";
			}
		},
	});

	const add = (q) => {
		if (charges.length >= MAX_CHARGES) return;
		charges.push({ fx: 0.3 + Math.random() * 0.4, fy: 0.25 + Math.random() * 0.5, q, ph: Math.random() * 6.28, x: 0, y: 0 });
		boost = 1;
		lastInteract = performance.now();
		loop.kick(reducedMotion ? 3 : 1);
	};
	bPos.addEventListener("click", () => add(1));
	bNeg.addEventListener("click", () => add(-1));
	bReset.addEventListener("click", () => {
		charges = START();
		for (const c of charges) Object.assign(c, { ph: Math.random() * 6.28, x: 0, y: 0 });
		loop.kick(reducedMotion ? 3 : 1);
	});

	const loop = createLoop(frame, { continuous: !reducedMotion, fps: 0 });
	if (reducedMotion) loop.kick(3);
	let rt = 0;
	const ro = new ResizeObserver(() => {
		clearTimeout(rt);
		rt = setTimeout(() => {
			view.fit();
			W = view.cssW;
			H = view.cssH;
			loop.kick(3);
		}, 100);
	});
	ro.observe(layer);

	return () => {
		loop.stop();
		ro.disconnect();
		clearTimeout(rt);
		pointer.destroy();
		root.style.cursor = "";
		hint.remove();
		dock.remove();
		view.destroy();
	};
}
