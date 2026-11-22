import { calmAurora, marginLayer, squiggleFx, rng, clamp, TAU, isDark, lerp } from "./_dl-c/kit.js";
import { valleyFooter } from "./_dl-c/valley.js";

// #349: slender reeds at the bottom side edges: damped springs driven by cursor position and velocity. They sleep at rest.
export function activate({ root, reducedMotion }) {
	const dark = isDark();
	let reeds = [];
	const rnd = rng(349);
	const COL = dark ? ["#1f4468", "#27527a", "#1a3a5c"] : ["#6f9c88", "#5f8f7c", "#82ab94"];
	const RIM = dark ? "rgba(120,200,200,.28)" : "rgba(255,255,255,.5)";
	const TAIL = dark ? "#2a2433" : "#7c5b49";
	const fx = {
		ambient: false,
		fps: 40,
		init(L) {
			reeds = [];
			L.zones.forEach(([x0, x1], zi) => {
				const w = x1 - x0, n = Math.round(w / 8);
				// clumps toward the outer edge
				for (let i = 0; i < n; i++) {
					const clump = Math.pow(rnd(), 1.6);
					const x = zi === 0 ? x0 + clump * w * 0.95 + 4 : x1 - clump * w * 0.95 - 4;
					const edge = zi === 0 ? 1 - (x - x0) / w : 1 - (x1 - x) / w;
					const h = (60 + rnd() * 80) * (0.55 + 0.55 * edge);
					reeds.push({ x, h, rest: 0, th: 0, w: 0, tail: rnd() < 0.28 && h > 70, c: (rnd() * 3) | 0, lw: 1.1 + rnd() * 0.9, tg: 0 });
				}
			});
			for (const r of reeds) { r.rest = (rnd() - 0.5) * 0.16; r.th = r.rest; }
			reeds.sort((a, b) => a.h - b.h);
		},
		step(dt, p, L) {
			let busy = false;
			for (const r of reeds) {
				let push = 0, infl = 0;
				if (p.has) {
					const sx = r.x + Math.sin(r.th) * r.h * 0.65, sy = L.H - Math.cos(r.th) * r.h * 0.65;
					const d2 = (sx - p.x) ** 2 + (sy - p.y) ** 2;
					infl = Math.exp(-d2 / (2 * 55 * 55));
					push = infl * clamp(p.vx / 700, -1.6, 1.6) * 62;
					r.tg = infl * Math.sign(r.x - p.x || 1) * 0.55;
				} else r.tg = 0;
				const k = 30, c = 2.3;
				const acc = -k * (r.th - r.rest - r.tg) - c * r.w + push;
				r.w += acc * dt; r.th = clamp(r.th + r.w * dt, -1.3, 1.3);
				if (Math.abs(r.w) > 0.01 || Math.abs(r.th - r.rest - r.tg) > 0.003) busy = true;
			}
			return busy || (p.has && p.still < 0.4);
		},
		draw(g, t, L) {
			g.lineCap = "round";
			const N = 7;
			for (const r of reeds) {
				let x = r.x, y = L.H + 2, ang = 0;
				const seg = r.h / N;
				const pts = [[x, y]];
				for (let i = 1; i <= N; i++) {
					const s = i / N;
					ang = r.th * Math.pow(s, 1.35);
					x += Math.sin(ang) * seg; y -= Math.cos(ang) * seg;
					pts.push([x, y]);
				}
				g.strokeStyle = COL[r.c];
				for (let i = 0; i < N; i++) {
					g.lineWidth = r.lw * (1.15 - i / N * 0.7);
					g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke();
				}
				g.strokeStyle = RIM; g.lineWidth = 0.6;
				g.beginPath(); g.moveTo(pts[2][0] + 0.7, pts[2][1]); for (let i = 3; i <= N; i++) g.lineTo(pts[i][0] + 0.7, pts[i][1]); g.stroke();
				if (r.tail) {
					const a = pts[N - 2], b = pts[N - 1];
					g.strokeStyle = TAIL; g.lineWidth = 3.4; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
					g.strokeStyle = COL[r.c]; g.lineWidth = 0.9; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(pts[N][0], pts[N][1]); g.stroke();
				}
			}
		},
	};
	const aur = calmAurora(root, { reduced: reducedMotion });
	const foot = valleyFooter(root, { reducedMotion });
	const layer = marginLayer(root, fx, { reduced: reducedMotion, host: root.querySelector(".overlay-a"), dark });
	const sq = squiggleFx(root, "reeds");
	return () => { sq(); layer.destroy(); foot?.destroy(); aur(); };
}
