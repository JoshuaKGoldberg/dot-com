// 309 Light Strands: hanging aurora strands are verlet pendulum chains. The cursor drags them by its velocity,
// and neighbouring strands collide (nodes flash where they bump).
import { topAurora } from "./_refined-b/top.js";
import { createStage, aurora, clamp } from "./_refined-b/sim.js";

const NODES = 15;
const RAD = 10;

export function activate({ root, reducedMotion }) {
	const killTop = topAurora({ root, reducedMotion, level: 3 });
	let sets = [[], []];
	let calm = 0;

	function make(sd, idx) {
		const n = clamp(Math.floor(sd.w / 32), 3, 8);
		const out = [];
		for (let k = 0; k < n; k++) {
			const ax = ((k + 0.5) / n) * sd.w + 4 * Math.sin(k * 3.1 + idx);
			const len = sd.h * (0.34 + 0.4 * (0.5 + 0.5 * Math.sin(k * 1.7 + idx * 2.3 + 0.4)));
			const seg = len / (NODES - 1);
			const x = new Float32Array(NODES), y = new Float32Array(NODES), px = new Float32Array(NODES), py = new Float32Array(NODES), fl = new Float32Array(NODES);
			for (let i = 0; i < NODES; i++) { x[i] = px[i] = ax; y[i] = py[i] = -6 + i * seg; }
			out.push({ x, y, px, py, fl, seg, k, ax });
		}
		return out;
	}
	const resize = (st) => { sets = st.sides.map((sd, i) => (sd.w ? make(sd, i) : [])); calm = 0; };

	function step(st, dt) {
		const p = st.ptr, near = p.moved && st.nearMargin();
		let energy = 0;
		for (let si = 0; si < 2; si++) {
			const sd = st.sides[si];
			if (!sd.w) continue;
			const lp = st.local(sd), vx = sd.side === "l" ? p.vx : -p.vx, vy = p.vy;
			const S = sets[si];
			for (const c of S) {
				const { x, y, px, py, fl } = c;
				for (let i = 1; i < NODES; i++) {
					let ax = 0, ay = 1500;
					if (near) {
						const dx = x[i] - lp.x, dy = y[i] - lp.y, d2 = dx * dx + dy * dy;
						if (d2 < 200 * 200) {
							const f = Math.exp(-d2 / (2 * 60 * 60));
							ax += 14 * f * (clamp(vx, -1800, 1800) * 0.8 - (x[i] - px[i]) / dt);
							ay += 4 * f * (clamp(vy, -1800, 1800) * 0.3 - (y[i] - py[i]) / dt);
							const d = Math.sqrt(d2) + 1e-3;
							if (d < 45) { ax += (dx / d) * (45 - d) * 60; ay += (dy / d) * (45 - d) * 20; }
						}
					}
					const nx = x[i] + (x[i] - px[i]) * 0.996 + ax * dt * dt, ny = y[i] + (y[i] - py[i]) * 0.996 + ay * dt * dt;
					px[i] = x[i]; py[i] = y[i]; x[i] = nx; y[i] = ny;
					fl[i] *= 0.96;
				}
			}
			for (let it = 0; it < 4; it++) {
				for (const c of S) {
					const { x, y, seg } = c;
					for (let i = 0; i < NODES - 1; i++) {
						const dx = x[i + 1] - x[i], dy = y[i + 1] - y[i], d = Math.hypot(dx, dy) || 1e-6, df = (d - seg) / d;
						const wi = i === 0 ? 0 : 0.5, wj = i === 0 ? 1 : 0.5;
						x[i] += dx * df * wi; y[i] += dy * df * wi; x[i + 1] -= dx * df * wj; y[i + 1] -= dy * df * wj;
					}
					// keep inside the margin
					for (let i = 1; i < NODES; i++) { if (x[i] < 2) x[i] = 2; else if (x[i] > sd.w - 2) x[i] = sd.w - 2; }
				}
				// strand-to-strand collisions
				for (let a = 0; a < S.length - 1; a++) {
					const A = S[a], B = S[a + 1];
					for (let i = 1; i < NODES; i++) for (let j = Math.max(1, i - 1); j <= Math.min(NODES - 1, i + 1); j++) {
						const dx = B.x[j] - A.x[i], dy = B.y[j] - A.y[i], d2 = dx * dx + dy * dy;
						if (d2 < RAD * RAD) {
							const d = Math.sqrt(d2) || 1e-3, push = (RAD - d) * 0.5;
							const ux = dx / d, uy = dy / d;
							const rv = Math.abs((B.x[j] - B.px[j]) - (A.x[i] - A.px[i])) / dt;
							A.x[i] -= ux * push; A.y[i] -= uy * push; B.x[j] += ux * push; B.y[j] += uy * push;
							const f = Math.min(1, rv / 500);
							if (f > A.fl[i]) A.fl[i] = f; if (f > B.fl[j]) B.fl[j] = f;
						}
					}
				}
			}
			for (const c of S) for (let i = 1; i < NODES; i++) { const a = c.x[i] - c.px[i], b = c.y[i] - c.py[i]; energy += a * a + b * b + c.fl[i] * 0.01; }
		}
		calm = energy < 0.02 ? calm + dt : 0;
		return calm < 0.8 || (near && p.speed > 3);
	}

	function draw(st) {
		const dark = st.dark, gain = dark ? 1 : 1.6;
		for (let si = 0; si < 2; si++) {
			const sd = st.sides[si], ctx = sd.ctx;
			ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
			ctx.clearRect(0, 0, sd.w, sd.h);
			if (!sd.w) continue;
			if (sd.side === "r") { ctx.translate(sd.w, 0); ctx.scale(-1, 1); }
			ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
			ctx.lineCap = "round"; ctx.lineJoin = "round";
			for (const c of sets[si]) {
				const { x, y, fl } = c;
				const yEnd = y[NODES - 1];
				const g = ctx.createLinearGradient(0, 0, 0, Math.max(80, yEnd));
				for (let i = 0; i <= 4; i++) { const cc = aurora(0.1 + 0.8 * (i / 4) * ((c.k % 2) ? 1 : 0.85), dark); g.addColorStop(i / 4, `rgb(${cc[0]},${cc[1]},${cc[2]})`); }
				ctx.strokeStyle = g;
				for (const [w, a] of [[7, 0.05], [2.4, 0.16], [1, 0.45]]) {
					ctx.lineWidth = w; ctx.globalAlpha = Math.min(1, a * gain);
					ctx.beginPath(); ctx.moveTo(x[0], y[0]);
					for (let i = 1; i < NODES - 1; i++) ctx.quadraticCurveTo(x[i], y[i], (x[i] + x[i + 1]) / 2, (y[i] + y[i + 1]) / 2);
					ctx.lineTo(x[NODES - 1], y[NODES - 1]); ctx.stroke();
				}
				ctx.fillStyle = g;
				for (let i = 2; i < NODES; i += 1) {
					const tipBoost = i === NODES - 1 ? 1 : 0.35;
					const f = fl[i];
					ctx.globalAlpha = Math.min(1, (0.06 + 0.3 * f) * gain * (0.6 + tipBoost));
					ctx.beginPath(); ctx.arc(x[i], y[i], 4.5 + 5 * f, 0, 6.283); ctx.fill();
					ctx.globalAlpha = Math.min(1, (0.3 * tipBoost + 0.55 * f) * gain);
					ctx.beginPath(); ctx.arc(x[i], y[i], 1.3 + 0.8 * f + (i === NODES - 1 ? 0.8 : 0), 0, 6.283); ctx.fill();
				}
			}
			ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
		}
	}
	const stage = createStage({ root, host: root.querySelector(".scenery-c"), reducedMotion, reach: 170, step, draw, resize });
	return () => { stage.destroy(); killTop(); };
}
