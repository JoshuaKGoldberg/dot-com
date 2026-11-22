import { raisedAurora, sideSky, ticker, trackPointer, isDark, clamp, rng, STAR, TAU } from "./_refined-c/kit.js";

const SP = 58, K = 46, KC = 30, C = 2.1, REACH = 125;

export function activate({ root, reducedMotion }) {
	const aur = raisedAurora({ root, reducedMotion, level: 2 });
	const host = root.querySelector(".scenery-c");
	let tk = null, meshes = [];
	const ptr = trackPointer(() => tk?.wake());

	const sky = sideSky({
		root, host, seed: 308, galaxyDust: 200, galaxyAlpha: 0.85,
		onLayout(sides) {
			const r = rng(308);
			meshes = sides.map((s) => {
				const cols = Math.max(2, Math.round(s.w / SP)) + 1, rows = Math.round(s.h / SP) + 1;
				const cw = s.w / (cols - 1), rh = s.h / (rows - 1), n = cols * rows;
				const m = { cols, rows, n, rx: new Float32Array(n), ry: new Float32Array(n), ux: new Float32Array(n), uy: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n), stars: [], awake: false };
				for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
					const k = j * cols + i;
					m.rx[k] = i * cw; m.ry[k] = j * rh;
				}
				// sparse stars: bilinear-attached to a cell of four nodes
				for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
					if (r() > 0.62) continue;
					m.stars.push({ k: j * cols + i, fx: 0.12 + r() * 0.76, fy: 0.12 + r() * 0.76, r: 0.8 + r() * r() * 1.6, a: 0.45 + r() * 0.55 });
				}
				return m;
			});
			if (tk) { render(); tk.wake(); }
		},
	});

	const step = (h) => {
		const p = ptr.p;
		let awake = false;
		sky.sides.forEach((s, si) => {
			const m = meshes[si];
			const { cols, rows, n, ux, uy, vx, vy, rx, ry } = m;
			const [px, py] = sky.toLocal(s, p.x, p.y);
			const sp = Math.hypot(p.vx, p.vy);
			const touch = p.seen && sp > 6 && px > -REACH && px < s.w + REACH;
			let maxE = 0;
			// accelerations from displacement (springs to rest + neighbour coupling)
			for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
				const k = j * cols + i;
				let ax = -K * ux[k] - C * vx[k], ay = -K * uy[k] - C * vy[k];
				if (i > 0) { ax += KC * (ux[k - 1] - ux[k]); ay += KC * (uy[k - 1] - uy[k]); }
				if (i < cols - 1) { ax += KC * (ux[k + 1] - ux[k]); ay += KC * (uy[k + 1] - uy[k]); }
				if (j > 0) { ax += KC * (ux[k - cols] - ux[k]); ay += KC * (uy[k - cols] - uy[k]); }
				if (j < rows - 1) { ax += KC * (ux[k + cols] - ux[k]); ay += KC * (uy[k + cols] - uy[k]); }
				if (touch) {
					// force from cursor velocity (momentum), plus a small shove away from the cursor
					const dx = rx[k] + ux[k] - px, dy = ry[k] + uy[k] - py, d2 = dx * dx + dy * dy;
					if (d2 < REACH * REACH * 2) {
						const g = Math.exp(-d2 / (2 * 52 * 52)), inv = 1 / (Math.sqrt(d2) + 12);
						ax += (p.vx * 1.9 + dx * inv * sp * 0.35) * g;
						ay += (p.vy * 1.9 + dy * inv * sp * 0.35) * g;
					}
				}
				m.ax ||= new Float32Array(n); m.ay ||= new Float32Array(n);
				m.ax[k] = ax; m.ay[k] = ay;
			}
			for (let k = 0; k < n; k++) {
				vx[k] += m.ax[k] * h; vy[k] += m.ay[k] * h;
				ux[k] += vx[k] * h; uy[k] += vy[k] * h;
				const lim = 46, mag = Math.hypot(ux[k], uy[k]);
				if (mag > lim) { ux[k] *= lim / mag; uy[k] *= lim / mag; }
				maxE = Math.max(maxE, mag + 0.15 * Math.hypot(vx[k], vy[k]));
			}
			if (maxE > 0.06) awake = true;
			else { ux.fill(0); uy.fill(0); vx.fill(0); vy.fill(0); }
			m.awake = maxE > 0.06;
		});
		p.vx *= Math.exp(-h * 10); p.vy *= Math.exp(-h * 10);
		return awake || Math.abs(p.vx) + Math.abs(p.vy) > 6;
	};

	function render() {
		const dark = isDark(), base = STAR[dark ? "dark" : "light"], line = dark ? "150,200,255" : "90,110,190";
		sky.sides.forEach((s, si) => {
			const m = meshes[si], ctx = s.ctx;
			ctx.clearRect(0, 0, s.w, s.h);
			if (!m) return;
			const { cols, rows, rx, ry, ux, uy } = m;
			if (m.awake) {
				// edges fade in with displacement, so the mesh is only visible while disturbed
				ctx.lineWidth = 0.7;
				const edge = (a, b) => {
					const e = (Math.hypot(ux[a], uy[a]) + Math.hypot(ux[b], uy[b])) * 0.5;
					const al = clamp((e - 1.2) / 22) * (dark ? 0.27 : 0.36);
					if (al < 0.02) return;
					ctx.strokeStyle = `rgba(${line},${al})`;
					ctx.beginPath(); ctx.moveTo(rx[a] + ux[a], ry[a] + uy[a]); ctx.lineTo(rx[b] + ux[b], ry[b] + uy[b]); ctx.stroke();
				};
				for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
					const k = j * cols + i;
					if (i < cols - 1) edge(k, k + 1);
					if (j < rows - 1) edge(k, k + cols);
				}
			}
			for (const st of m.stars) {
				const a = st.k, b = a + 1, c = a + cols, d = c + 1, fx = st.fx, fy = st.fy;
				const w0 = (1 - fx) * (1 - fy), w1 = fx * (1 - fy), w2 = (1 - fx) * fy, w3 = fx * fy;
				const x = w0 * (rx[a] + ux[a]) + w1 * (rx[b] + ux[b]) + w2 * (rx[c] + ux[c]) + w3 * (rx[d] + ux[d]);
				const y = w0 * (ry[a] + uy[a]) + w1 * (ry[b] + uy[b]) + w2 * (ry[c] + uy[c]) + w3 * (ry[d] + uy[d]);
				const disp = Math.hypot(w0 * ux[a] + w1 * ux[b] + w2 * ux[c] + w3 * ux[d], w0 * uy[a] + w1 * uy[b] + w2 * uy[c] + w3 * uy[d]);
				const al = Math.min(1, (dark ? 0.78 : 0.62) * st.a + clamp(disp / 30) * 0.25);
				ctx.fillStyle = `rgba(${base},${al})`;
				if (st.r <= 1.1) ctx.fillRect(x - 0.5, y - 0.5, 1.1, 1.1); else { ctx.beginPath(); ctx.arc(x, y, st.r * 0.8, 0, TAU); ctx.fill(); }
			}
		});
	}
	tk = ticker({ step, render, hz: 60, fps: 60 });
	render();
	return () => { aur.destroy(); tk.destroy(); ptr.destroy(); sky.destroy(); };
}
