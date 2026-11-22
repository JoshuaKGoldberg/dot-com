// 305 Aurora Cloth: verlet cloth strips hang in each margin. The cursor's velocity is a wind
// that drags the cloth (aerodynamic drag toward the cursor's motion), and folds brighten as they compress.
import { topAurora } from "./_refined-b/top.js";
import { createStage, aurora, clamp } from "./_refined-b/sim.js";

const COLS = 7;
const ITER = 4;

export function activate({ root, reducedMotion }) {
	const killTop = topAurora({ root, reducedMotion, level: 2 });
	let cloths = [[], []];
	let calm = 0;

	function make(sd, h, idx) {
		const n = clamp(Math.floor(sd.w / 92), 1, 3);
		const out = [];
		for (let k = 0; k < n; k++) {
			const sw = Math.min(84, (sd.w / n) * 0.72);
			const cx = ((k + 0.5) / n) * sd.w;
			const len = h * (0.5 + 0.38 * (0.5 + 0.5 * Math.sin(k * 2.1 + idx * 1.7 + 0.6)));
			const gap = sw / (COLS - 1);
			const rows = Math.max(6, Math.round(len / 34));
			const rowGap = len / (rows - 1);
			const N = COLS * rows;
			const x = new Float32Array(N), y = new Float32Array(N), px = new Float32Array(N), py = new Float32Array(N);
			for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
				const i = r * COLS + c;
				x[i] = px[i] = cx - sw / 2 + c * gap; y[i] = py[i] = -8 + r * rowGap;
			}
			out.push({ cols: COLS, rows, N, x, y, px, py, gap, rowGap, cx, ray: Array.from({ length: COLS - 1 }, (_, c) => 0.75 + 0.5 * Math.abs(Math.sin(c * 1.9 + k * 3.3 + idx))), ph: k * 1.3 + idx });
		}
		return out;
	}

	function resize(st) {
		cloths = st.sides.map((sd, i) => (sd.w ? make(sd, sd.h, i) : []));
		calm = 0;
	}

	function step(st, dt) {
		const p = st.ptr;
		const near = p.moved && st.nearMargin();
		let energy = 0;
		for (let si = 0; si < 2; si++) {
			const sd = st.sides[si];
			if (!sd.w) continue;
			const lp = st.local(sd);
			const vx = sd.side === "l" ? p.vx : -p.vx, vy = p.vy;
			for (const c of cloths[si]) {
				const { x, y, px, py, N, cols, rows, gap, rowGap } = c;
				for (let i = cols; i < N; i++) {
					let ax = 0, ay = 1100;
					if (near) {
						const dx = x[i] - lp.x, dy = y[i] - lp.y, d2 = dx * dx + dy * dy;
						if (d2 < 220 * 220) {
							const f = Math.exp(-d2 / (2 * 75 * 75));
							const kd = 9 * f;
							const wvx = clamp(vx, -1600, 1600) * 0.7, wvy = clamp(vy, -1600, 1600) * 0.25;
							ax += kd * (wvx - (x[i] - px[i]) / dt);
							ay += kd * (wvy - (y[i] - py[i]) / dt) * 0.5;
							// soft body push so a slow pass nudges the cloth too
							const d = Math.sqrt(d2) + 1e-3;
							if (d < 60) ax += (dx / d) * (60 - d) * 18;
							// air displaced sideways by vertical motion
							ax += Math.sign(dx || 1) * Math.min(1400, Math.abs(vy)) * 0.5 * f;
						}
					}
					// keep the cloth near its margin
					if (x[i] < -10) ax += (-10 - x[i]) * 40; else if (x[i] > sd.w + 10) ax -= (x[i] - sd.w - 10) * 40;
					const nx = x[i] + (x[i] - px[i]) * 0.993 + ax * dt * dt, ny = y[i] + (y[i] - py[i]) * 0.993 + ay * dt * dt;
					px[i] = x[i]; py[i] = y[i]; x[i] = nx; y[i] = ny;
				}
				for (let it = 0; it < ITER; it++) {
					for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
						const i = r * cols + q;
						if (q < cols - 1) solve(c, i, i + 1, gap, r === 0);
						if (r < rows - 1) solve(c, i, i + cols, rowGap, false);
						if (r < rows - 1 && q < cols - 1) solve(c, i, i + cols + 1, Math.hypot(gap, rowGap), false, 0.5);
						if (r < rows - 1 && q > 0) solve(c, i, i + cols - 1, Math.hypot(gap, rowGap), false, 0.5);
					}
				}
				for (let i = cols; i < N; i++) { const a = x[i] - px[i], b = y[i] - py[i]; energy += a * a + b * b; }
			}
		}
		calm = energy < 0.02 ? calm + dt : 0;
		return calm < 0.8 || near && p.speed > 3;
	}
	function solve(c, i, j, rest, pinA, k = 1) {
		const { x, y } = c;
		const dx = x[j] - x[i], dy = y[j] - y[i];
		const d = Math.hypot(dx, dy) || 1e-6, diff = ((d - rest) / d) * 0.5 * k;
		const pinnedI = i < c.cols, pinnedJ = j < c.cols;
		const wi = pinnedI ? 0 : pinnedJ ? 2 : 1, wj = pinnedJ ? 0 : pinnedI ? 2 : 1;
		x[i] += dx * diff * wi; y[i] += dy * diff * wi;
		x[j] -= dx * diff * wj; y[j] -= dy * diff * wj;
	}

	function draw(st) {
		const dark = st.dark;
		for (let si = 0; si < 2; si++) {
			const sd = st.sides[si], ctx = sd.ctx;
			ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
			ctx.clearRect(0, 0, sd.w, sd.h);
			if (!sd.w) continue;
			if (sd.side === "r") { ctx.translate(sd.w, 0); ctx.scale(-1, 1); }
			ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
			const gain = dark ? 1 : 1.6;
			for (const c of cloths[si]) {
				const { x, y, cols, rows } = c;
				const yEnd = y[(rows - 1) * cols], hgt = Math.max(60, yEnd);
				const g = ctx.createLinearGradient(0, 0, 0, yEnd + 20);
				const stops = [[0, 0], [0.12, 0.5], [0.45, 0.8], [0.8, 1], [1, 0]];
				for (const [o, al] of stops) {
					const cc = aurora(0.08 + 0.85 * o, dark);
					g.addColorStop(o, `rgba(${cc[0]},${cc[1]},${cc[2]},${al * 0.1 * gain})`);
				}
				// soft-edged sheet: three nested layers from edge to centre
				ctx.fillStyle = g;
				const mid = (cols - 1) >> 1;
				for (let layer = 0; layer < 3; layer++) {
					const q0 = Math.min(layer, mid - 1), q1 = cols - 1 - q0;
					ctx.beginPath();
					for (let r = 0; r < rows; r++) { const i = r * cols + q0; r ? ctx.lineTo(x[i], y[i]) : ctx.moveTo(x[i], y[i]); }
					for (let r = rows - 1; r >= 0; r--) { const i = r * cols + q1; ctx.lineTo(x[i], y[i]); }
					ctx.closePath(); ctx.fill();
				}
				// ray lines; folds (columns squeezed together) glow brighter
				ctx.lineCap = "butt";
				for (let q = 1; q < cols - 1; q++) {
					const cc = aurora(0.25 + 0.6 * (q / cols), dark);
					for (let r = 0; r < rows - 1; r++) {
						const i = r * cols + q, j = i + cols;
						const sq = clamp(c.gap / Math.max(6, Math.abs(x[i + 1] - x[i - 1]) * 0.5), 0.6, 2.6);
						const t = (r + 0.5) / (rows - 1);
						const env = Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) * (1 - 0.85 * Math.pow(t, 3));
						const a = (0.07 + 0.05 * (q % 2)) * env * sq * gain * c.ray[q % c.ray.length];
						ctx.strokeStyle = `rgba(${cc[0]},${cc[1]},${cc[2]},${a})`;
						ctx.lineWidth = 3.5 * Math.min(1.6, sq);
						ctx.beginPath(); ctx.moveTo(x[i], y[i]); ctx.lineTo(x[j], y[j]); ctx.stroke();
					}
				}
			}
			ctx.globalCompositeOperation = "source-over";
		}
	}

	const stage = createStage({ root, host: root.querySelector(".scenery-c"), reducedMotion, reach: 170, step, draw, resize });
	return () => { stage.destroy(); killTop(); };
}
