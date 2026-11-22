// #198 Graph Peaks. The ridgeline is a generated graph: peaks are vertices, ridges are edges, chords
// triangulate the mountain mass. At night the sky holds classic graph drawings as constellations.
//
// Parameters (see _adk/kit.js): { seed, date, hour, season, weather, wind, latitude, longitude, tz }
//   seed picks the peak positions, which graphs hang in the sky, and the hiker's walk.
// generate(params) is pure and returns normalised vertices/edges; paint() and frame() only draw.
import { mountScene, rng, css, mix, mul, smooth, clamp } from "./_adk/kit.js";
import { paintLakeScene } from "./_adk/lake.js";

const circle = (n, r = 1, off = -Math.PI / 2) => Array.from({ length: n }, (_, i) => [Math.cos(off + (i / n) * 6.2832) * r, Math.sin(off + (i / n) * 6.2832) * r]);
const allPairs = (n) => {
	const e = [];
	for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) e.push([i, j]);
	return e;
};
export const GRAPHS = {
	"K₄": { v: [[0, -1], [-0.87, 0.5], [0.87, 0.5], [0, 0]], e: allPairs(4) },
	"K₅": { v: circle(5), e: allPairs(5) },
	"K₃,₃": { v: [[-1, -0.5], [0, -0.5], [1, -0.5], [-1, 0.5], [0, 0.5], [1, 0.5]], e: [0, 1, 2].flatMap((i) => [3, 4, 5].map((j) => [i, j])) },
	Petersen: {
		v: [...circle(5), ...circle(5, 0.5)],
		e: [...[0, 1, 2, 3, 4].flatMap((i) => [[i, (i + 1) % 5], [i, i + 5], [i + 5, 5 + ((i + 2) % 5)]])],
	},
	"Q₃": {
		v: [[-1, -1], [1, -1], [1, 1], [-1, 1], [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]],
		e: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]],
	},
	"W₆": { v: [...circle(6), [0, 0]], e: [...[0, 1, 2, 3, 4, 5].flatMap((i) => [[i, (i + 1) % 6], [i, 6]])] },
	"C₇": { v: circle(7), e: [...[0, 1, 2, 3, 4, 5, 6].flatMap((i) => [[i, (i + 1) % 7], [i, (i + 3) % 7]])].filter(([a, b], i, arr) => arr.findIndex(([c, d]) => (c === b && d === a) || (c === a && d === b)) === i) },
};

function range(rand, n, lo, hi, xJit = 0.35) {
	const v = [];
	for (let i = 0; i < n; i++) {
		const x = (i + 0.5 + (rand() - 0.5) * xJit * 2) / n;
		v.push({ x: clamp(x, 0.01, 0.99) * 1.1 - 0.05, h: lo + (hi - lo) * Math.pow(rand(), 0.8) });
	}
	const e = [];
	for (let i = 0; i < n - 1; i++) {
		e.push([i, i + 1]);
		if (i < n - 2) e.push([i, i + 2]);
		if (i < n - 3 && rand() < 0.3) e.push([i, i + 3]);
	}
	return { v, e };
}

export function generate(p) {
	const rand = rng(p.seed * 53 + 17);
	const far = range(rand, 13, 0.28, 0.46, 0.3);
	const near = range(rand, 9, 0.13, 0.3, 0.3);
	const names = Object.keys(GRAPHS);
	const pick = [...names].sort(() => rand() - 0.5).slice(0, 3);
	const spots = [[0.16 + rand() * 0.08, 0.2 + rand() * 0.1], [0.82 + rand() * 0.08, 0.14 + rand() * 0.1], [0.46 + rand() * 0.1, 0.1 + rand() * 0.08]];
	const consts = pick.map((n, i) => ({ name: n, g: GRAPHS[n], x: spots[i][0], y: spots[i][1], size: 0.09 + rand() * 0.03, rot: (rand() - 0.5) * 0.9 }));
	// the hiker: a random walk along the near-range edges
	const adj = near.v.map(() => []);
	for (const [a, b] of near.e) {
		adj[a].push(b);
		adj[b].push(a);
	}
	let cur = (rand() * near.v.length) | 0;
	const walk = [cur];
	for (let i = 0; i < 60; i++) {
		cur = adj[cur][(rand() * adj[cur].length) | 0];
		walk.push(cur);
	}
	return { far, near, consts, walk };
}

function peakY(r, hy, i) {
	return hy - r.v[i].h * hy;
}

function ridgePath(ctx, r, view, hy, jitter) {
	const pts = [[-20, hy]];
	const n = r.v.length;
	pts.push([-20, peakY(r, hy, 0) + 40]);
	for (let i = 0; i < n; i++) {
		const x = r.v[i].x * view.w;
		const y = peakY(r, hy, i);
		pts.push([x, y]);
		if (i < n - 1) {
			const x2 = r.v[i + 1].x * view.w;
			const y2 = peakY(r, hy, i + 1);
			const lowest = Math.max(y, y2);
			const sx = (x + x2) / 2 + (jitter(i) - 0.5) * (x2 - x) * 0.3;
			const sy = Math.min(lowest + (hy - lowest) * (0.25 + jitter(i + 99) * 0.35), hy - 4);
			// a few small kinks along each edge
			pts.push([x + (sx - x) * 0.5, (y + sy) / 2 + (jitter(i + 7) - 0.5) * 6]);
			pts.push([sx, sy]);
			pts.push([sx + (x2 - sx) * 0.5, (sy + y2) / 2 + (jitter(i + 13) - 0.5) * 6]);
		}
	}
	pts.push([view.w + 20, peakY(r, hy, n - 1) + 40], [view.w + 20, hy]);
	ctx.beginPath();
	ctx.moveTo(pts[0][0], pts[0][1]);
	for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
	ctx.closePath();
}

function paintRange(ctx, r, view, env, hy, depth, rand) {
	const near = mul(env.lit(env.land.ridge, 1), 0.78);
	const far = mix(env.lit(mix(env.land.ridge, [120, 140, 170], 0.4)), env.haze, 0.3);
	let c = mix(near, far, depth);
	c = mix(c, env.haze, env.fog * (0.3 + 0.5 * depth));
	if (env.snowAmt) c = mix(c, env.lit([232, 238, 246], 0.85), env.snowAmt * 0.45);
	const g = ctx.createLinearGradient(0, hy * 0.45, 0, hy);
	g.addColorStop(0, css(mix(c, [255, 255, 255], 0.1 * env.light)));
	g.addColorStop(1, css(mix(c, env.haze, 0.12 + 0.35 * depth)));
	ctx.fillStyle = g;
	ridgePath(ctx, r, view, hy, rand);
	ctx.fill();
	// graph overlay
	const line = env.tone === "dark" ? [200, 220, 255] : [255, 255, 255];
	const aLine = (env.tone === "dark" ? 0.6 : 0.45) * (1 - 0.6 * env.fog) * (1 - 0.35 * depth);
	ctx.strokeStyle = css(line, aLine);
	ctx.lineWidth = 1;
	ctx.beginPath();
	for (const [a, b] of r.e) {
		ctx.moveTo(r.v[a].x * view.w, peakY(r, hy, a));
		ctx.lineTo(r.v[b].x * view.w, peakY(r, hy, b));
	}
	ctx.stroke();
	for (let i = 0; i < r.v.length; i++) {
		const x = r.v[i].x * view.w;
		const y = peakY(r, hy, i);
		ctx.fillStyle = css(line, 0.2 * (1 - depth * 0.5));
		ctx.beginPath();
		ctx.arc(x, y, 6 - depth * 2, 0, 6.2832);
		ctx.fill();
		ctx.fillStyle = css(line, 0.9 * (1 - depth * 0.4) * (1 - env.fog * 0.5));
		ctx.beginPath();
		ctx.arc(x, y, 2.6 - depth, 0, 6.2832);
		ctx.fill();
	}
}

function paintConstellations(ctx, scene, view, env, hy) {
	const vis = 0.22 + 0.7 * env.night * (1 - 0.85 * env.cover);
	const col = env.tone === "dark" ? [214, 226, 255] : [40, 62, 100];
	for (const c of scene.consts) {
		const cx = c.x * view.w;
		const cy = c.y * hy * 1.4;
		const s = c.size * view.w;
		const cr = Math.cos(c.rot);
		const sr = Math.sin(c.rot);
		const pos = c.g.v.map(([x, y]) => [cx + (x * cr - y * sr) * s, cy + (x * sr + y * cr) * s * 0.9]);
		ctx.strokeStyle = css(col, 0.42 * vis);
		ctx.lineWidth = 0.9;
		ctx.beginPath();
		for (const [a, b] of c.g.e) {
			ctx.moveTo(pos[a][0], pos[a][1]);
			ctx.lineTo(pos[b][0], pos[b][1]);
		}
		ctx.stroke();
		for (const [x, y] of pos) {
			ctx.fillStyle = css(col, 0.18 * vis);
			ctx.beginPath();
			ctx.arc(x, y, 6, 0, 6.2832);
			ctx.fill();
			ctx.fillStyle = css(env.tone === "dark" ? [255, 250, 236] : col, 0.95 * vis);
			ctx.beginPath();
			ctx.arc(x, y, 2.1, 0, 6.2832);
			ctx.fill();
		}
		ctx.font = "italic 13px Georgia, 'Times New Roman', serif";
		ctx.fillStyle = css(col, 0.55 * vis);
		ctx.fillText(c.name, cx + s * 1.15, cy + s * 0.2);
	}
}

export function activate({ root, mode, reducedMotion }) {
	return mountScene(root, {
		id: "graph-peaks",
		mode,
		reducedMotion,
		generate,
		horizon: 0.66,
		paint(ctx, scene, view, env) {
			paintLakeScene(ctx, view, env, {
				horizon: 0.66,
				ridges: [],
				midground(b, hy) {
					paintConstellations(b, scene, view, env, hy);
					const r = rng(env.p.seed + 5);
					paintRange(b, scene.far, view, env, hy, 0.75, r);
					paintRange(b, scene.near, view, env, hy, 0.35, rng(env.p.seed + 6));
				},
			});
		},
		frame(ctx, scene, view, env, t, dt, still) {
			const hy = view.h * 0.66;
			const r = scene.near;
			const pts = scene.walk.map((i) => [r.v[i].x * view.w, peakY(r, hy, i)]);
			// distance along the walk at ~48px/s, looping
			const seg = [];
			let total = 0;
			for (let i = 0; i < pts.length - 1; i++) {
				const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
				seg.push(d);
				total += d;
			}
			let d = still ? total * 0.3 : (t * 48) % total;
			let i = 0;
			while (d > seg[i]) {
				d -= seg[i];
				i++;
			}
			const k = d / seg[i];
			const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k;
			const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
			const warm = env.tone === "dark" ? [255, 214, 140] : [255, 120, 60];
			const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
			g.addColorStop(0, css(warm, 0.8));
			g.addColorStop(1, css(warm, 0));
			ctx.fillStyle = g;
			ctx.fillRect(x - 16, y - 16, 32, 32);
			ctx.fillStyle = css(mix(warm, [255, 255, 255], 0.5), 1);
			ctx.beginPath();
			ctx.arc(x, y, 2.4, 0, 6.2832);
			ctx.fill();
			// twinkle on one constellation vertex
			void smooth;
			void mul;
		},
	});
}
