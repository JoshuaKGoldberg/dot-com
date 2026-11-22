// Thousands of particles ride a curl field as a starling cloud, condense into "Hi! I'm Josh", then scatter.
import { createLoop, makeButton, mountCanvas, program, siteColors, trackPointer } from "./_kit/kit.js";

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a; // x, y (css px), speed 0..1
uniform vec2 cssSize; uniform float size, dpr;
out float vSpeed;
void main(){
	vec2 c = a.xy / cssSize * 2. - 1.; gl_Position = vec4(c.x, -c.y, 0., 1.);
	vSpeed = a.z; gl_PointSize = (size + a.z*0.9) * dpr;
}`;
const FS = `#version 300 es
precision mediump float;
in float vSpeed; uniform vec3 slow, fast; uniform float alpha, dark; out vec4 o;
void main(){
	vec2 d = gl_PointCoord - .5; float r = dot(d,d)*4.; if (r > 1.) discard;
	float k = smoothstep(1., .15, r);
	vec3 c = mix(slow, fast, vSpeed);
	float a = k * alpha * (.55 + .45*vSpeed);
	o = vec4(c * a, dark > .5 ? a * .55 : a);
}`;

const WAVES = (() => {
	let seed = 78;
	const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	return Array.from({ length: 6 }, () => {
		const th = r() * 6.283;
		const k = 0.0035 + r() * 0.0075;
		return { kx: Math.cos(th) * k, ky: Math.sin(th) * k, ph: r() * 6.283, w: (0.12 + r() * 0.25) * (r() < 0.5 ? -1 : 1), a: 1 / k };
	});
})();

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { scale: 1, maxDpr: 1.5 });
	const gl = view.gl;
	if (!gl) return () => view.destroy();
	const colors = siteColors(root);
	const prog = program(gl, VS, FS);
	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, dark ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);

	let W = view.cssW;
	let H = view.cssH;
	let N = 0;
	let data, vx, vy, tx, ty, delay, jx, jy;
	let alive = true;

	// phases: 0 flock, 1 gather, 2 hold, 3 scatter
	let phase = reducedMotion ? 2 : 0;
	let phaseT = 0;
	const DUR = [8, 3.2, 4.2, 0.1];
	let manualHold = false;
	const btn = reducedMotion ? null : makeButton(root, "Gather ✦", { title: "Make the murmuration spell it out" });

	async function buildTargets() {
		try {
			await document.fonts.load('800 120px "League Spartan"');
		} catch {}
		if (!alive) return;
		const off = document.createElement("canvas");
		const cw = Math.min(900, Math.round(W));
		const ch = 260;
		off.width = cw;
		off.height = ch;
		const c = off.getContext("2d", { willReadFrequently: true });
		const text = "Hi! I'm Josh";
		let fs = 200;
		c.font = `800 ${fs}px "League Spartan", system-ui, sans-serif`;
		fs = Math.floor((fs * cw * 0.96) / c.measureText(text).width);
		c.font = `800 ${fs}px "League Spartan", system-ui, sans-serif`;
		c.textAlign = "center";
		c.textBaseline = "middle";
		c.fillText(text, cw / 2, ch / 2);
		const img = c.getImageData(0, 0, cw, ch).data;
		const pts = [];
		for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (img[(y * cw + x) * 4 + 3] > 140) pts.push(x, y);
		const textW = Math.min(W * 0.84, 1100);
		const sc = textW / cw;
		const ox = W / 2 - (cw * sc) / 2;
		const oy = Math.max(H * 0.58 - (ch * sc) / 2, 40);
		const count = pts.length / 2;
		for (let i = 0; i < N; i++) {
			const j = ((i * 2654435761) % count) | 0;
			const k = Math.floor(Math.random() * count);
			const pick = i < count ? (Math.random() < 0.0 ? j : k) : k;
			tx[i] = ox + (pts[pick * 2] + Math.random()) * sc;
			ty[i] = oy + (pts[pick * 2 + 1] + Math.random()) * sc;
		}
		ready = true;
		if (reducedMotion) {
			for (let i = 0; i < N; i++) {
				data[i * 3] = tx[i];
				data[i * 3 + 1] = ty[i];
				data[i * 3 + 2] = 0.1;
			}
			render();
		}
	}
	let ready = false;

	function allocate() {
		W = view.cssW;
		H = view.cssH;
		const want = Math.min(7500, Math.max(2200, Math.round((W * H) / 130)));
		if (want !== N) {
			N = want;
			data = new Float32Array(N * 3);
			vx = new Float32Array(N);
			vy = new Float32Array(N);
			tx = new Float32Array(N);
			ty = new Float32Array(N);
			delay = new Float32Array(N);
			jx = new Float32Array(N);
			jy = new Float32Array(N);
			for (let i = 0; i < N; i++) {
				data[i * 3] = Math.random() * W;
				data[i * 3 + 1] = Math.random() * H;
				const a = Math.random() * 6.283;
				vx[i] = Math.cos(a) * 40;
				vy[i] = Math.sin(a) * 40;
				delay[i] = Math.random();
				jx[i] = (Math.random() - 0.5) * 360;
				jy[i] = (Math.random() - 0.5) * 360;
			}
		}
		ready = false;
		buildTargets();
	}
	allocate();

	const pointer = trackPointer(layer);
	const flow = [0, 0];
	function field(x, y, t) {
		let dx = 0;
		let dy = 0;
		for (const w of WAVES) {
			const c = Math.cos(w.kx * x + w.ky * y + w.ph + w.w * t) * w.a;
			dx += w.ky * c;
			dy -= w.kx * c;
		}
		flow[0] = dx;
		flow[1] = dy;
	}

	let time = Math.random() * 100;
	function step(dt) {
		time += dt;
		holdK += ((phase === 2 || (phase === 1 && phaseT > 1.8) ? 1 : 0) - holdK) * Math.min(1, dt * 2.5);
		phaseT += dt;
		if (!manualHold && phaseT > DUR[phase] && phase !== 0) advance();
		else if (phase === 0 && phaseT > DUR[0] && !manualHold) advance();
		const cx1 = W * (0.5 + 0.3 * Math.sin(time * 0.17));
		const cy1 = H * (0.46 + 0.2 * Math.sin(time * 0.23 + 1.3));
		const cx2 = W * (0.5 + 0.34 * Math.sin(time * 0.11 + 2.4));
		const cy2 = H * (0.5 + 0.24 * Math.sin(time * 0.19 + 4.0));
				const g = phase === 1 ? phaseT / DUR[1] : phase === 2 ? 2 : 0;
		const px = pointer.inside && performance.now() - pointer.lastMove < 2500 ? pointer.x : -999;
		const py = pointer.y;
		for (let i = 0; i < N; i++) {
			const i3 = i * 3;
			let x = data[i3];
			let y = data[i3 + 1];
			let ax;
			let ay;
			const gi = phase === 1 ? Math.min(1, Math.max(0, (g * 1.35 - delay[i] * 0.5) * 1.8 - 0.1)) : phase === 2 ? 1 : 0;
			if (gi > 0) {
				const k = 6 + 22 * gi * gi;
				const wob = phase === 2 ? 0.8 : 0;
				ax = (tx[i] + wob * Math.sin(time * 2 + i) - x) * k - vx[i] * (2 + 7 * gi);
				ay = (ty[i] + wob * Math.cos(time * 2.3 + i * 1.3) - y) * k - vy[i] * (2 + 7 * gi);
				// partly still flocking until committed
				if (gi < 1) {
					field(x, y, time);
					ax += (flow[0] * 125 - vx[i]) * (1 - gi) * 1.2;
					ay += (flow[1] * 125 - vy[i]) * (1 - gi) * 1.2;
				}
			} else {
				field(x + jx[i], y + jy[i], time);
				const sub = i & 1;
				const cxp = sub ? cx2 : cx1;
				const cyp = sub ? cy2 : cy1;
				const wantX = flow[0] * 125 + (cxp - x) * 0.8;
				const wantY = flow[1] * 125 + (cyp - y) * 1.0;
				ax = (wantX - vx[i]) * 2.2;
				ay = (wantY - vy[i]) * 2.2;
				if (phase === 3) {
					ax += ((x - W / 2) / W) * 600 * (1 - phaseT * 2);
					ay += ((y - H * 0.58) / H) * 600 * (1 - phaseT * 2);
				}
			}
			if (px > -900) {
				const dx = x - px;
				const dy = y - py;
				const d2 = dx * dx + dy * dy;
				if (d2 < 22500) {
					const f = (1 - d2 / 22500) * 1800;
					const d = Math.sqrt(d2) + 1;
					ax += (dx / d) * f;
					ay += (dy / d) * f;
				}
			}
			vx[i] += ax * dt;
			vy[i] += ay * dt;
			x += vx[i] * dt;
			y += vy[i] * dt;
			if (x < -20) x += W + 40;
			else if (x > W + 20) x -= W + 40;
			if (y < -20) y += H + 40;
			else if (y > H + 20) y -= H + 40;
			data[i3] = x;
			data[i3 + 1] = y;
			data[i3 + 2] = Math.min(1, Math.hypot(vx[i], vy[i]) / 260);
		}
	}

	function advance() {
		if (phase === 0 && !ready) {
			phaseT = DUR[0] - 0.5;
			return;
		}
		if (phase === 2) {
			// scatter: burst outward then return to the flock
			phase = 3;
			phaseT = 0;
			const cy = H * 0.58;
			for (let i = 0; i < N; i++) {
				const dx = data[i * 3] - W / 2;
				const dy = data[i * 3 + 1] - cy;
				const d = Math.hypot(dx, dy) + 1;
				const s = 120 + Math.random() * 320;
				vx[i] += (dx / d) * s + (Math.random() - 0.5) * 160;
				vy[i] += (dy / d) * s + (Math.random() - 0.5) * 160 - 40;
			}
			setTimeout(() => {
				if (alive && phase === 3) {
					phase = 0;
					phaseT = 0;
					manualHold = false;
					if (btn) btn.textContent = "Gather ✦";
				}
			}, 160);
			return;
		}
		phase = (phase + 1) % 4;
		phaseT = 0;
		if (phase === 2 && btn) btn.textContent = "Scatter";
	}

	btn?.addEventListener("click", () => {
		if (phase === 2 || phase === 1) {
			phase = 2;
			phaseT = 999;
			manualHold = false;
			advance();
		} else if (ready && phase === 0) {
			phase = 1;
			phaseT = 0;
			btn.textContent = "Scatter";
		}
	});

	let holdK = reducedMotion ? 1 : 0;
	function render() {
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, view.width, view.height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		prog.use();
		prog.set("cssSize", view.cssW, view.cssH);
		prog.set("dpr", view.dpr);
		prog.set("size", (dark ? 1.5 : 1.7) + 0.7 * holdK);
		const slow = dark ? [0.45, 0.62, 0.9] : [0.1, 0.2, 0.38];
		const fast = dark ? [0.65, 0.95, 1.0] : [0.12, 0.38, 0.85];
		prog.set("slow", slow);
		prog.set("fast", fast);
		prog.set("alpha", (dark ? 0.8 : 0.62) * (1 + 0.5 * holdK));
		prog.set("dark", dark ? 1 : 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
		gl.drawArrays(gl.POINTS, 0, N);
	}

	const loop = createLoop(
		(dt) => {
			step(Math.min(dt, 0.033));
			render();
		},
		{ continuous: !reducedMotion },
	);
	if (reducedMotion) loop.kick(2);

	let rt = 0;
	const ro = new ResizeObserver(() => {
		clearTimeout(rt);
		rt = setTimeout(() => {
			view.fit();
			allocate();
			loop.kick(2);
		}, 150);
	});
	ro.observe(layer);

	return () => {
		alive = false;
		loop.stop();
		ro.disconnect();
		clearTimeout(rt);
		pointer.destroy();
		btn?.remove();
		view.destroy();
	};
}
