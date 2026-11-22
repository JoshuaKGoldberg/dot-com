// #204 Equations Over the Lake. Fractal midpoint-displacement mountains over a lake, with faint chalk
// equations (Euler, graph theory, primes) written into the evening sky and mirrored in the water.
//
// Parameters (see _adk/kit.js): { seed, date, hour, season, weather, wind, latitude, longitude, tz }
//   seed drives the midpoint displacement of every ridge and which equations are chalked where.
// generate(params) is pure: ridge height arrays (midpoint displacement) and the placed chalk items.
import { mountScene, rng, css, mix, mul, clamp, lerp, fillRidge } from "./_adk/kit.js";
import { paintLakeScene } from "./_adk/lake.js";

const EQS = [
	[["e"], ["iπ", 1], [" + 1 = 0"]],
	[["V − E + F = 2"]],
	[["Σ 1/n² = π²/6"]],
	[["Σ deg(v) = 2|E|"]],
	[["a² + b² = c²"]],
	[["2  3  5  7  11  13  17  19  23  29  31 …"]],
	[["n! ≈ √(2πn) (n/e)"], ["n", 1]],
	[["P(n) ⟹ P(n+1)"]],
	[["gcd(a, b) = gcd(b, a mod b)"]],
	[["|E| ≤ 3|V| − 6"]],
	[["∀ ε > 0  ∃ δ > 0"]],
	[["φ = (1 + √5) / 2"]],
	[["ζ(s) = Σ n"], ["−s", 1]],
	[["∮ ω = ∫ dω"]],
];
const DIAGRAMS = ["k4", "right", "spiral", "bridges"];

function mpd(rand, levels, rough, seedVals) {
	const n = (1 << levels) + 1;
	const a = new Float32Array(n);
	a[0] = seedVals[0];
	a[n - 1] = seedVals[1];
	let amp = 1;
	for (let step = n - 1; step > 1; step >>= 1) {
		for (let i = 0; i < n - 1; i += step) {
			const m = i + (step >> 1);
			a[m] = (a[i] + a[i + step]) / 2 + (rand() - 0.5) * amp;
		}
		amp *= rough;
	}
	// light smoothing so the summits read as rounded Adirondack tops, not alpine teeth
	const b = new Float32Array(n);
	for (let i = 0; i < n; i++) b[i] = (a[Math.max(0, i - 1)] + a[i] * 2 + a[Math.min(n - 1, i + 1)]) / 4;
	let lo = Infinity;
	let hi = -Infinity;
	for (const v of b) {
		lo = Math.min(lo, v);
		hi = Math.max(hi, v);
	}
	return b.map((v) => (v - lo) / (hi - lo || 1));
}

export function generate(p) {
	const rand = rng(p.seed * 97 + 5);
	const ridges = [
		{ h: mpd(rand, 9, 0.56, [rand(), rand()]), base: 0.3, amp: 0.3, depth: 1 },
		{ h: mpd(rand, 9, 0.52, [rand(), rand()]), base: 0.16, amp: 0.22, depth: 0.6 },
		{ h: mpd(rand, 9, 0.48, [rand(), rand()]), base: 0.05, amp: 0.13, depth: 0.25 },
	];
	const chalk = [];
	const used = new Set();
	const count = 9;
	for (let tries = 0; chalk.length < count && tries < 200; tries++) {
		const x = 0.04 + rand() * 0.92;
		const y = 0.16 + rand() * 0.44;
		const central = x > 0.2 && x < 0.8 && y > 0.12 && y < 0.5;
		if (central && rand() < 0.65) continue;
		if (chalk.some((c) => Math.abs(c.x - x) < 0.22 && Math.abs(c.y - y) < 0.1)) continue;
		if (chalk.length >= 6 && chalk.length < 8) {
			chalk.push({ x, y, d: DIAGRAMS[(rand() * DIAGRAMS.length) | 0], rot: (rand() - 0.5) * 0.3, size: 70 + rand() * 40 });
			continue;
		}
		let k = (rand() * EQS.length) | 0;
		while (used.has(k)) k = (k + 1) % EQS.length;
		used.add(k);
		chalk.push({ x, y, eq: EQS[k], rot: (rand() - 0.5) * 0.25, size: 24 + rand() * 12 });
	}
	return { ridges, chalk };
}

function drawEq(ctx, parts, size) {
	let x = 0;
	for (const [t, sup] of parts) {
		if (sup) {
			ctx.font = `${size * 0.62}px Caveat, "Segoe Script", cursive`;
			ctx.fillText(t, x, -size * 0.38);
			x += ctx.measureText(t).width;
		} else {
			ctx.font = `${size}px Caveat, "Segoe Script", cursive`;
			ctx.fillText(t, x, 0);
			x += ctx.measureText(t).width;
		}
	}
	return x;
}

function drawDiagram(ctx, d, s) {
	ctx.lineWidth = 1.8;
	ctx.lineCap = "round";
	ctx.beginPath();
	if (d === "k4") {
		const v = [[0, -s * 0.5], [-s * 0.5, s * 0.35], [s * 0.5, s * 0.35], [0, 0.0]];
		for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
			ctx.moveTo(v[i][0], v[i][1]);
			ctx.lineTo(v[j][0], v[j][1]);
		}
		ctx.stroke();
		for (const [x, y] of v) {
			ctx.beginPath();
			ctx.arc(x, y, 3.2, 0, 6.2832);
			ctx.fill();
		}
	} else if (d === "right") {
		ctx.moveTo(-s * 0.5, s * 0.3);
		ctx.lineTo(s * 0.5, s * 0.3);
		ctx.lineTo(-s * 0.5, -s * 0.3);
		ctx.closePath();
		ctx.moveTo(-s * 0.5 + 12, s * 0.3);
		ctx.lineTo(-s * 0.5 + 12, s * 0.3 - 12);
		ctx.lineTo(-s * 0.5, s * 0.3 - 12);
		ctx.stroke();
		ctx.font = `20px Caveat, cursive`;
		ctx.fillText("a", -s * 0.5 - 14, 0);
		ctx.fillText("b", 0, s * 0.3 + 18);
		ctx.fillText("c", 4, -4);
	} else if (d === "spiral") {
		let a = 0;
		let r = 2;
		ctx.moveTo(0, 0);
		for (let i = 0; i < 120; i++) {
			a += 0.12;
			r *= 1.0195;
			ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
		}
		ctx.stroke();
	} else {
		// Konigsberg-ish: two banks and an island joined by bridges
		for (const [cx, cy] of [[-s * 0.4, 0], [s * 0.4, 0], [0, -s * 0.3], [0, s * 0.3]]) {
			ctx.moveTo(cx + 6, cy);
			ctx.arc(cx, cy, 6, 0, 6.2832);
		}
		ctx.moveTo(-s * 0.4, 0);
		ctx.quadraticCurveTo(-s * 0.2, -s * 0.28, 0, -s * 0.3);
		ctx.moveTo(-s * 0.4, 0);
		ctx.quadraticCurveTo(-s * 0.2, s * 0.28, 0, s * 0.3);
		ctx.moveTo(s * 0.4, 0);
		ctx.quadraticCurveTo(s * 0.2, -s * 0.28, 0, -s * 0.3);
		ctx.moveTo(s * 0.4, 0);
		ctx.quadraticCurveTo(s * 0.2, s * 0.28, 0, s * 0.3);
		ctx.moveTo(0, -s * 0.3);
		ctx.lineTo(0, s * 0.3);
		ctx.stroke();
	}
}

export function activate({ root, mode, reducedMotion }) {
	let dead = false;
	document.fonts?.load("28px Caveat").then(() => {
		if (!dead && root.__adk) root.__adk.set({});
	});
	const stop = mountScene(root, {
		id: "chalkboard-lake",
		mode,
		reducedMotion,
		generate,
		horizon: 0.64,
		paint(ctx, scene, view, env) {
			paintLakeScene(ctx, view, env, {
				horizon: 0.64,
				ridges: [],
				midground(b, hy) {
					// chalk in the sky first, so ridges can pass in front of the lowest lines
					const night = env.tone === "dark";
					const col = night ? [244, 244, 236] : [34, 54, 96];
					const vis = (night ? 0.62 : 0.55) * (1 - env.fog * 0.5) * (1 - 0.3 * env.cover);
					const rr = rng(env.p.seed + 1);
					for (const c of scene.chalk) {
						b.save();
						let ox = 0;
						if (c.eq) {
							b.fillStyle = "rgba(0,0,0,0)";
							const w = drawEq(b, c.eq, c.size);
							ox = Math.min(0, view.w - 14 - c.x * view.w - w);
						}
						b.translate(c.x * view.w + ox, c.y * hy);
						b.rotate(c.rot);
						for (const pass of [0, 1]) {
							b.fillStyle = css(col, vis * (pass ? 0.35 : 1));
							b.strokeStyle = css(col, vis * (pass ? 0.35 : 1));
							const dx = pass ? 0.9 : 0;
							b.save();
							b.translate(dx, dx);
							if (c.eq) drawEq(b, c.eq, c.size);
							else drawDiagram(b, c.d, c.size);
							b.restore();
						}
						// a little chalk dust
						b.fillStyle = css(col, vis * 0.5);
						for (let i = 0; i < 14; i++) b.fillRect((rr() - 0.2) * 200, (rr() - 0.7) * 40, 1.2, 1.2);
						b.restore();
					}
					scene.ridges.forEach((R) => {
						const step = 6;
						const n = Math.ceil(view.w / step) + 2;
						const ys = new Float32Array(n);
						const m = R.h.length - 1;
						for (let i = 0; i < n; i++) {
							const u = (i * step) / view.w;
							const k = u * m;
							const i0 = Math.min(m - 1, Math.floor(k));
							const v = lerp(R.h[i0], R.h[i0 + 1], k - i0);
							ys[i] = hy - R.base * hy - R.amp * hy * Math.pow(Math.max(0, v), 1.15);
						}
						const near = mul(env.lit(env.land.ridge), 0.85);
						const far = mix(env.lit(mix(env.land.ridge, [140, 160, 190], 0.5)), env.haze, 0.35);
						let c = mix(near, far, R.depth);
						c = mix(c, env.haze, env.fog * (0.3 + 0.5 * R.depth));
						if (env.snowAmt) c = mix(c, env.lit([232, 238, 246], 0.85), env.snowAmt * 0.5);
						fillRidge(b, ys, step, hy + 2, c, mix(c, env.haze, 0.3 + 0.35 * R.depth));
						b.strokeStyle = css(mix(env.haze, [255, 255, 255], 0.3), 0.14 + 0.3 * env.night);
						b.lineWidth = 1.1;
						b.beginPath();
						ys.forEach((y, i) => (i ? b.lineTo(i * step, y) : b.moveTo(0, y)));
						b.stroke();
					});
				},
			});
		},
	});
	return () => {
		dead = true;
		stop();
	};
}
