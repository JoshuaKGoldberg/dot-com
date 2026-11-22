// #200 Type Lattice Sky. Over a quiet lake the stars form a type lattice: `unknown` at the zenith,
// `never` at the horizon (and mirrored in the water), with an aurora of union types whose strands
// are the members of each union.
//
// Parameters (see _adk/kit.js): { seed, date, hour, season, weather, wind, latitude, longitude, tz }
//   seed shuffles the lattice and chooses the unions; hour/weather decide how visible the sky is.
// generate(params) is pure: it returns lattice nodes/edges (normalised to the sky) and aurora ribbons.
import { mountScene, rng, css, mix, clamp } from "./_adk/kit.js";
import { paintLakeScene } from "./_adk/lake.js";

const LEVEL1 = {
	string: ['"a"', '"b"'],
	number: ["0", "42"],
	boolean: ["true", "false"],
	object: ["Date", "() => void"],
	symbol: [],
	bigint: ["1n"],
	null: [],
	undefined: [],
};
const UNIONS = [["string", "number"], ["string", "null", "undefined"], ["true", "false"], ["number", "bigint"], ["string", "number", "boolean"]];
const HUES = [[96, 240, 176], [90, 210, 230], [168, 140, 255], [255, 150, 210], [180, 240, 120]];

export function generate(p) {
	const rand = rng(p.seed * 61 + 11);
	const names = Object.keys(LEVEL1).sort(() => rand() - 0.5);
	const nodes = [{ id: "unknown", level: 0, x: 0.5 + (rand() - 0.5) * 0.06, y: 0.07 }];
	const edges = [];
	const n = names.length;
	names.forEach((name, i) => {
		const x = 0.08 + (0.84 * (i + 0.5)) / n + (rand() - 0.5) * 0.02;
		const y = 0.3 + (rand() - 0.5) * 0.1;
		nodes.push({ id: name, level: 1, x, y });
		edges.push([0, nodes.length - 1]);
		const pi = nodes.length - 1;
		LEVEL1[name].forEach((lit, k, arr) => {
			const dx = (k - (arr.length - 1) / 2) * 0.05;
			nodes.push({ id: lit, level: 2, x: x + dx + (rand() - 0.5) * 0.01, y: 0.56 + rand() * 0.1 });
			edges.push([pi, nodes.length - 1]);
		});
	});
	const never = nodes.length;
	nodes.push({ id: "never", level: 3, x: 0.5 + (rand() - 0.5) * 0.05, y: 0.985 });
	nodes.forEach((nd, i) => {
		const leaf = !edges.some(([a]) => a === i);
		if (leaf && nd.level > 0 && i !== never) edges.push([i, never]);
	});
	const ribbons = [0, 1, 2].map((i) => {
		const u = UNIONS[(rand() * UNIONS.length) | 0];
		return { members: u, y: 0.34 + i * 0.12 + rand() * 0.05, amp: 0.05 + rand() * 0.05, k: 2.2 + rand() * 2.4, ph: rand() * 6.28, x0: 0.02 + rand() * 0.2, x1: 0.78 + rand() * 0.2, hues: u.map((_, j) => HUES[(i * 2 + j) % HUES.length]) };
	});
	return { nodes, edges, ribbons };
}

let raySprite = null;
function getRay() {
	if (!raySprite) {
		raySprite = document.createElement("canvas");
		raySprite.width = 2;
		raySprite.height = 128;
		const g = raySprite.getContext("2d");
		const gr = g.createLinearGradient(0, 128, 0, 0);
		gr.addColorStop(0, "rgba(255,255,255,0)");
		gr.addColorStop(0.1, "rgba(255,255,255,0.9)");
		gr.addColorStop(0.4, "rgba(255,255,255,0.45)");
		gr.addColorStop(1, "rgba(255,255,255,0)");
		g.fillStyle = gr;
		g.fillRect(0, 0, 2, 128);
	}
	return raySprite;
}
const tinted = new Map();
function tintedRay(c) {
	const k = c.join(",");
	if (!tinted.has(k)) {
		const t = document.createElement("canvas");
		t.width = 2;
		t.height = 128;
		const g = t.getContext("2d");
		g.drawImage(getRay(), 0, 0);
		g.globalCompositeOperation = "source-in";
		g.fillStyle = css(c);
		g.fillRect(0, 0, 2, 128);
		tinted.set(k, t);
	}
	return tinted.get(k);
}

export function activate({ root, mode, reducedMotion }) {
	const HY = 0.66;
	return mountScene(root, {
		id: "type-lattice-sky",
		mode,
		reducedMotion,
		generate,
		horizon: HY,
		paint(ctx, scene, view, env) {
			paintLakeScene(ctx, view, env, {
				horizon: HY,
				midground(b, hy) {
					const vis = 0.3 + 0.7 * env.night * (1 - 0.7 * env.cover);
					const col = env.tone === "dark" ? [210, 226, 255] : [34, 54, 92];
					const P = scene.nodes.map((n) => [n.x * view.w, n.y * hy]);
					b.lineWidth = 1;
					b.strokeStyle = css(col, 0.55 * vis);
					b.beginPath();
					for (const [a, c] of scene.edges) {
						b.moveTo(P[a][0], P[a][1]);
						b.lineTo(P[c][0], P[c][1]);
					}
					b.stroke();
					b.font = "12px ui-monospace, Menlo, monospace";
					scene.nodes.forEach((n, i) => {
						const [x, y] = P[i];
						const r = [4.2, 3.2, 2.2, 3.6][n.level];
						const g = b.createRadialGradient(x, y, 0, x, y, r * 4);
						g.addColorStop(0, css(env.tone === "dark" ? [255, 246, 225] : col, 0.5 * vis));
						g.addColorStop(1, css(col, 0));
						b.fillStyle = g;
						b.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
						b.fillStyle = css(env.tone === "dark" ? [255, 250, 238] : col, 0.95 * vis);
						b.beginPath();
						b.arc(x, y, r * 0.6, 0, 6.2832);
						b.fill();
						b.fillStyle = css(col, 0.9 * vis);
						b.fillText(n.id, x + r + 5, y + 4);
					});
					if (vis > 0.3) {
						const [x, y] = P[P.length - 1];
						b.strokeStyle = css(col, 0.5 * vis);
						b.beginPath();
						b.ellipse(x, y, 11, 3, 0, 0, 6.2832);
						b.stroke();
					}
				},
			});
		},
		frame(ctx, scene, view, env, t, dt, still) {
			const a = env.night * (1 - 0.85 * env.cover) * (env.p.weather === "fog" ? 0.5 : 1);
			if (a < 0.05) return;
			const hy = view.h * HY;
			ctx.globalCompositeOperation = "lighter";
			for (const rb of scene.ribbons) {
				const x0 = rb.x0 * view.w;
				const x1 = rb.x1 * view.w;
				const strands = rb.members.length;
				rb.members.forEach((m, si) => {
					const ray = tintedRay(rb.hues[si]);
					const spread = (si - (strands - 1) / 2);
					for (let x = x0; x < x1; x += 3) {
						const u = (x - x0) / (x1 - x0);
						// strands diverge in the middle of the ribbon and rejoin at the ends: a union
						const split = Math.sin(u * Math.PI);
						const wob = Math.sin(u * rb.k * 6 + rb.ph + (still ? 0 : t * 0.25));
						const y = hy * (rb.y + rb.amp * Math.sin(u * 7 * 0.45 * rb.k + rb.ph) + 0.03 * spread * split * 3);
						const body = 0.55 + 0.45 * Math.sin(u * 17 + rb.ph * 2 + (still ? 0 : t * 0.5 + si));
						const h = (90 + 110 * body + 30 * wob) * (0.4 + 0.8 * Math.sin(u * Math.PI)) * (view.h / 800);
						ctx.globalAlpha = clamp(a * 0.4 * (0.5 + 0.5 * body) * Math.sin(u * Math.PI) ** 0.5);
						ctx.drawImage(ray, x + spread * split * 2, y - h, 5, h + 14);
					}
				});
			}
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = "source-over";
		},
	});
}
