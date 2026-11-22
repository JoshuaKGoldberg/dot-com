// 304 Field Lines: margin aurora strands are traced field lines of a vertical ambient field.
// The cursor is a magnetic dipole (a compass needle with inertia) that bends them.
import { topAurora } from "./_refined-b/top.js";
import { createStage, aurora, clamp, lerp } from "./_refined-b/sim.js";

const DS = 7;
const KDIP = 6e5;

export function activate({ root, reducedMotion }) {
	const killTop = topAurora({ root, reducedMotion, level: 1 });
	// compass-needle dipole state (shared by both margins)
	const D = { x: 0, y: 0, vx: 0, vy: 0, phi: 0, om: 0, s: 0, init: false };
	let grads = [];
	let seedsN = 14;
	const lines = [[], []];

	function mkGrads(st) {
		grads = st.sides.map((sd) => {
			const g = sd.ctx.createLinearGradient(0, 0, 0, sd.h);
			for (let i = 0; i <= 6; i++) { const c = aurora(0.1 + 0.8 * (i / 6) * (i % 2 ? 0.85 : 1), st.dark); g.addColorStop(i / 6, `rgb(${c[0]},${c[1]},${c[2]})`); }
			return g;
		});
	}

	function field(x, y, st, t, side, out) {
		// ambient: mostly vertical, swaying like curtain folds
		let bx = 0.2 * Math.sin(y * 0.0062 + t * 0.22 + side * 2.3) + 0.12 * Math.sin(y * 0.015 - t * 0.31 + x * 0.02) + 0.0016 * (x - 90) * 0.4;
		let by = 1;
		let dbx = 0, dby = 0;
		if (D.s > 0.01) {
			const lx = st._lx[side], ly = st._ly[side];
			const rx = x - lx, ry = y - ly;
			const r2 = rx * rx + ry * ry + 14 * 14;
			const inv = 1 / (r2 * Math.sqrt(r2));
			const mx = st._mx[side], my = st._my[side];
			const md = (mx * rx + my * ry) / r2;
			dbx = KDIP * D.s * inv * (3 * md * rx - mx);
			dby = KDIP * D.s * inv * (3 * md * ry - my);
			bx += dbx; by += dby;
		}
		out.bx = bx; out.by = by; out.d = Math.hypot(dbx, dby) / (Math.hypot(bx, by) + 1e-6);
	}

	const tmp = { bx: 0, by: 0, d: 0 };
	function trace(x, y, dir, maxN, st, side, w, h, pts) {
		for (let i = 0; i < maxN; i++) {
			field(x, y, st, st.time, side, tmp);
			const m = Math.hypot(tmp.bx, tmp.by) || 1;
			// midpoint step
			const hx = x + (dir * tmp.bx / m) * DS * 0.5, hy = y + (dir * tmp.by / m) * DS * 0.5;
			field(hx, hy, st, st.time, side, tmp);
			const m2 = Math.hypot(tmp.bx, tmp.by) || 1;
			x += (dir * tmp.bx / m2) * DS; y += (dir * tmp.by / m2) * DS;
			if (y > h + 12 || y < -40 || x < -50 || x > w + 50) break;
			if (D.s > 0.01) { const dx = x - st._lx[side], dy = y - st._ly[side]; if (dx * dx + dy * dy < 81) break; }
			pts.push(x, y, tmp.d);
		}
	}

	function build(st) {
		for (let si = 0; si < 2; si++) {
			const sd = st.sides[si];
			if (!sd.w) { lines[si].length = 0; continue; }
			const L = [];
			const n = seedsN;
			for (let i = 0; i < n; i++) {
				const x = ((i + 0.5 + 0.35 * Math.sin(i * 2.7 + si)) / n) * sd.w;
				const pts = [x, -8, 0];
				trace(x, -8, 1, 175, st, si, sd.w, sd.h, pts);
				L.push({ pts, k: 0.55 + 0.45 * Math.sin(i * 1.9 + si * 4), ph: i * 0.37, loop: false });
			}
			if (D.s > 0.12) {
				const ring = 8;
				for (let i = 0; i < ring; i++) {
					const a = (i / ring) * Math.PI * 2 + 0.3, r0 = 18 + 22 * ((i * 5) % 3);
					const sx = st._lx[si] + Math.cos(a) * r0, sy = st._ly[si] + Math.sin(a) * r0;
					const f = [sx, sy, 0], b = [];
					trace(sx, sy, 1, 52, st, si, sd.w, sd.h, f);
					trace(sx, sy, -1, 52, st, si, sd.w, sd.h, b);
					const pts = [];
					for (let j = b.length - 3; j >= 0; j -= 3) pts.push(b[j], b[j + 1], b[j + 2]);
					pts.push(...f);
					L.push({ pts, k: 0.8, ph: i, loop: true });
				}
			}
			lines[si] = L;
		}
	}

	function step(st, dt) {
		const p = st.ptr;
		const near = p.moved && p.x > -50 && st.nearMargin();
		if (!D.init && p.moved) { D.x = p.x; D.y = p.y; D.init = true; }
		const sp = p.speed;
		// position follows the cursor like a spring-damped magnet
		const k = 90, c = 2 * Math.sqrt(k) * 0.9;
		if (near) {
			D.vx += ((p.x - D.x) * k - c * D.vx) * dt; D.vy += ((p.y - D.y) * k - c * D.vy) * dt;
		} else { D.vx *= 0.9; D.vy *= 0.9; }
		D.x += D.vx * dt; D.y += D.vy * dt;
		// strength: present near margins, boosted by cursor speed
		const sTarget = near ? 0.55 + Math.min(1.1, sp / 900) : 0;
		D.s += (sTarget - D.s) * (1 - Math.exp(-dt * (sTarget > D.s ? 7 : 2.2)));
		if (D.s < 0.004) D.s = 0;
		// compass needle: torque toward the velocity direction, restoring toward the ambient field
		const w = Math.min(1, sp / 450);
		const ph = Math.atan2(p.vx, p.vy);
		let dphi = ph - D.phi; dphi = Math.atan2(Math.sin(dphi), Math.cos(dphi));
		const tq = (near ? 38 * w * Math.sin(dphi) : 0) - 14 * Math.sin(D.phi) - 3.2 * D.om;
		D.om += tq * dt; D.phi += D.om * dt;
		// publish per-side local dipole frames (right side mirrors x)
		st._lx = []; st._ly = []; st._mx = []; st._my = [];
		for (let i = 0; i < 2; i++) {
			const sd = st.sides[i];
			const x = D.x - sd.x0;
			st._lx[i] = sd.side === "l" ? x : sd.w - x; st._ly[i] = D.y;
			const mx = Math.sin(D.phi), my = Math.cos(D.phi);
			st._mx[i] = sd.side === "l" ? mx : -mx; st._my[i] = my;
		}
		return D.s > 0.004 || Math.abs(D.om) > 0.02 || Math.abs(D.phi) > 0.01 || sp > 3;
	}

	function draw(st) {
		if (!st.show) return;
		if (!st._lx) { step(st, 0); }
		if (!grads.length || grads[0] === undefined || st._gk !== st.dark + ":" + st.sides[0].h) { mkGrads(st); st._gk = st.dark + ":" + st.sides[0].h; }
		build(st);
		const t = st.reduced ? 0 : st.time;
		for (let si = 0; si < 2; si++) {
			const sd = st.sides[si], ctx = sd.ctx;
			ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
			ctx.clearRect(0, 0, sd.w, sd.h);
			if (!sd.w) continue;
			if (sd.side === "r") { ctx.translate(sd.w, 0); ctx.scale(-1, 1); }
			ctx.globalCompositeOperation = st.dark ? "lighter" : "source-over";
			ctx.strokeStyle = grads[si]; ctx.fillStyle = grads[si]; ctx.lineCap = "round"; ctx.lineJoin = "round";
			const gain = st.dark ? 1 : 1.35;
			for (const ln of lines[si]) {
				const pts = ln.pts, n = pts.length / 3;
				if (n < 3) continue;
				for (let pass = 0; pass < 2; pass++) {
					ctx.lineWidth = pass ? 1.1 : 4.5;
					for (let i = 0; i < n - 1; i += 6) {
						const j1 = Math.min(n - 1, i + 6);
						const y = pts[i * 3 + 1];
						const env = 0.3 + 0.7 * Math.pow(Math.sin(clamp(y / sd.h) * Math.PI), 0.8);
						const sh = 0.8 + 0.2 * Math.sin(y * 0.012 - t * 0.9 + ln.ph);
						const dd = pts[i * 3 + 2];
						const a = (0.035 + 0.1 * ln.k) * env * sh * (1 + 3 * Math.min(1, dd * 1.2)) * (pass ? 2.8 : 1) * gain;
						ctx.globalAlpha = Math.min(0.6, a);
						ctx.beginPath(); ctx.moveTo(pts[i * 3], pts[i * 3 + 1]);
						for (let j = i + 1; j <= j1; j++) ctx.lineTo(pts[j * 3], pts[j * 3 + 1]);
						ctx.stroke();
					}
				}
				// sparks drifting along the line
				if (!st.reduced || true) {
					for (let q = 0; q < 2; q++) {
						const f = (((t * (0.05 + 0.03 * ln.k) + ln.ph * 0.13 + q * 0.5) % 1) + 1) % 1;
						const idx = Math.min(n - 1, Math.floor(f * n));
						ctx.globalAlpha = (st.dark ? 0.5 : 0.55) * ln.k * Math.sin(f * Math.PI);
						ctx.fillRect(pts[idx * 3] - 1.2, pts[idx * 3 + 1] - 1.2, 2.4, 2.4);
					}
				}
			}
			// faint glow at the magnet
			if (D.s > 0.1) {
				const lx = st._lx[si], ly = st._ly[si];
				const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 46);
				const c = aurora(0.45, st.dark);
				g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.16 * Math.min(1, D.s)})`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
				ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(lx - 46, ly - 46, 92, 92);
			}
			ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
		}
	}

	const stage = createStage({ root, host: root.querySelector(".scenery-c"), reducedMotion, reach: 150, step, draw, idleFps: 20, resize: (st) => { seedsN = Math.max(8, Math.round(st.mw / 15)); st._gk = ""; } });
	return () => { stage.destroy(); killTop(); };
}
