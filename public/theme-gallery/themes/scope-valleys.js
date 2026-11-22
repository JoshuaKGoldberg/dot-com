// #201 Scope Valleys. Nested lexical scopes become nested valleys receding into haze. The global scope is the
// far, hazy range; each inner function or block is a nearer, steeper valley, and the innermost holds a lean-to.
// Each declared binding is a tree on its valley floor, labelled with its name.
//
// Parameters (see _adk/kit.js): { seed, date, hour, season, weather, wind, latitude, longitude, tz }
//   seed picks which real snippet is analysed (via _adk/mini.js) and the terrain jitter.
// generate(params) is pure: it parses the snippet, extracts the scope chain and bindings, and lays out the valleys.
import { mountScene, rng, makeNoise, css, mix, mul, clamp, lerp, paintSky, paintPine, offscreen, paintFogBand, blob } from "./_adk/kit.js";
import { parse, children, SNIPPETS } from "./_adk/mini.js";

const KEYS = ["scopes", "cfg", "loop", "gcd"];

function scopesOf(ast) {
	const mk = (kind, name) => ({ kind, name, bindings: [], kids: [] });
	const root = mk("global", "global");
	function visit(n, scope) {
		let s = scope;
		const fn = n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression";
		if (n.type === "FunctionDeclaration" && n.id) scope.bindings.push(n.id.name);
		if (fn) {
			s = mk("function", n.id ? n.id.name : "anonymous");
			scope.kids.push(s);
			for (const p of n.params || []) s.bindings.push(p.name);
		} else if ((n.type === "BlockStatement" && scope.kind !== "pending") || n.type === "ForOfStatement" || n.type === "ForStatement" || n.type === "WhileStatement") {
			if (n.type === "BlockStatement" && scope.justFn === n) {
				// function body shares the function scope
			} else {
				s = mk("block", n.type === "BlockStatement" ? "block" : n.type.replace("Statement", "").toLowerCase());
				scope.kids.push(s);
			}
		}
		if (n.type === "VariableDeclarator" && n.id) s.bindings.push(n.id.name);
		if (fn) s.justFn = n.body;
		for (const c of children(n)) {
			if (fn && c === n.body && c.type === "BlockStatement") {
				for (const cc of children(c)) visit(cc, s);
			} else visit(c, s);
		}
	}
	visit(ast, root);
	return root;
}

function deepestChain(s) {
	let best = [s];
	for (const k of s.kids) {
		const c = [s, ...deepestChain(k)];
		if (c.length > best.length) best = c;
	}
	return best;
}

export function generate(p) {
	const rand = rng(p.seed * 43 + 3);
	const key = KEYS[Math.abs(p.seed) % KEYS.length];
	const chain = deepestChain(scopesOf(parse(SNIPPETS[key]))).slice(0, 5).map((s) => ({ kind: s.kind, name: s.name, bindings: [...new Set(s.bindings)].slice(0, 4) }));
	const layers = chain.map((s, i) => ({ ...s, off: rand() * 50, cx: 0.5 + (rand() - 0.5) * 0.08, seedT: rand() }));
	return { key, layers, fire: rand() };
}

function profile(noise, L, t, N, view, x) {
	const floor = lerp(0.52, 0.88, t) * view.h;
	const wallH = lerp(0.28, 0.5, t) * view.h;
	const halfW = lerp(0.7, 0.34, t) * view.w;
	const cx = lerp(0.5, 0.74, t) * view.w + L.cx * 20 - 10;
	const u = Math.abs(x - cx) / halfW;
	const n = noise.fbm1((x / view.w) * lerp(2.5, 4.5, t) + L.off, 4);
	const k = clamp((u - 0.2) / 0.8);
	const wall = k * k * (3 - 2 * k) + Math.max(0, u - 1) * 0.3;
	return { y: floor - wallH * wall * (0.8 + 0.4 * n) - 0.04 * view.h * n * (0.3 + wall), floor, cx };
}

export function activate({ root, mode, reducedMotion }) {
	let lean = { x: 0, y: 0 };
	return mountScene(root, {
		id: "scope-valleys",
		mode,
		reducedMotion,
		generate,
		horizon: 0.78,
		paint(ctx, scene, view, env) {
			const N = scene.layers.length;
			const noise = makeNoise(env.p.seed * 3 + 2);
			const hy0 = view.h * 0.55;
			paintSky(ctx, view, env, hy0 + 20);
			const rand = rng(env.p.seed * 19 + 1);
			const ink = env.ink;
			scene.layers.forEach((L, i) => {
				const t = N > 1 ? i / (N - 1) : 1;
				let col = mix(env.lit(mix(env.land.ridge, env.land.conifer, t * 0.7)), env.haze, (1 - t) * 0.7 + env.fog * (0.3 + 0.3 * (1 - t)));
				if (env.snowAmt) col = mix(col, env.lit([232, 238, 246], 0.85), env.snowAmt * 0.5);
				const step = 5;
				const ys = [];
				for (let x = -10; x <= view.w + 10; x += step) ys.push(profile(noise, L, t, N, view, x).y);
				let miny = Math.min(...ys);
				const g = ctx.createLinearGradient(0, miny, 0, view.h);
				g.addColorStop(0, css(mix(col, [255, 255, 255], 0.08 * env.light)));
				g.addColorStop(0.55, css(mix(col, env.haze, 0.18 * (1 - t) + 0.05)));
				g.addColorStop(1, css(mix(col, env.haze, 0.45 * (1 - t))));
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.moveTo(-10, view.h);
				ys.forEach((y, k) => ctx.lineTo(-10 + k * step, y));
				ctx.lineTo(view.w + 10, view.h);
				ctx.closePath();
				ctx.fill();
				ctx.strokeStyle = css(mix(env.haze, [255, 255, 255], 0.3), (0.18 + 0.3 * env.night) * (1 - t * 0.4));
				ctx.lineWidth = 1.2;
				ctx.beginPath();
				ys.forEach((y, k) => (k ? ctx.lineTo(-10 + k * step, y) : ctx.moveTo(-10, y)));
				ctx.stroke();
				// haze between layers
				const hz = ctx.createLinearGradient(0, miny, 0, profile(noise, L, t, N, view, view.w * 0.5).floor);
				hz.addColorStop(0, css(env.haze, 0));
				hz.addColorStop(1, css(env.haze, 0.28 * (1 - t) + env.fog * 0.3));
				ctx.fillStyle = hz;
				ctx.fillRect(0, miny, view.w, view.h - miny);
				// pines on the walls
				const pr = rng(Math.floor(L.seedT * 1e6));
				const tc = mix(col, env.lit(env.land.conifer), 0.5);
				const ph = lerp(10, 34, t);
				for (let x = 0; x < view.w; x += lerp(9, 17, pr()) * (1.4 - t * 0.5)) {
					const pf = profile(noise, L, t, N, view, x);
					if (pf.y > pf.floor - 8 || Math.abs(x - pf.cx) < 40) continue;
					paintPine(ctx, x, pf.y + 4 + pr() * ph * 0.7, ph * (0.6 + pr() * 0.8), mix(tc, [10, 24, 20], pr() * 0.3), env.snowAmt * 0.7, env.lit([240, 244, 250], 0.9));
				}
				// binding trees on the valley floor
				const pfl = profile(noise, L, t, N, view, view.w * 0.5);
				const fl = pfl.floor;
				const vcx = pfl.cx;
				ctx.font = `italic ${Math.round(lerp(9, 13, t))}px ui-monospace, Menlo, monospace`;
				L.bindings.forEach((name, b) => {
					const bx = vcx + (b - (L.bindings.length - 1) / 2) * view.w * lerp(0.04, 0.07, t) + (rand() - 0.5) * 14;
					const by = fl + rand() * 6 + 2;
					const bh = lerp(16, 50, t);
					paintPine(ctx, bx, by, bh, mix(env.lit(env.land.conifer), env.haze, (1 - t) * 0.5), env.snowAmt, env.lit([240, 244, 250], 0.9));
					ctx.fillStyle = css(ink, 0.6 + 0.3 * t);
					ctx.textAlign = "center";
					ctx.fillText(name, bx, by + lerp(10, 18, t));
				});
				// scope label on the far wall
				ctx.textAlign = "left";
				ctx.font = `${Math.round(lerp(10, 12, t))}px ui-monospace, Menlo, monospace`;
				ctx.fillStyle = css(ink, 0.55 + 0.25 * t);
				const lx = view.w * 0.04;
				const lp = profile(noise, L, t, N, view, lx);
				ctx.fillText(`${L.kind === "function" ? "function " : ""}${L.name}${L.kind === "function" ? "()" : ""}`, lx, clamp(lp.y + 22, 40, view.h - 20));
				if (i === N - 1) {
					// pond + lean-to in the innermost valley
					const px = vcx;
					const py = fl + view.h * 0.035;
					const wg = ctx.createLinearGradient(0, py - 10, 0, py + 24);
					wg.addColorStop(0, css(mix(env.water.top, env.sky.hor, 0.4), 0.95));
					wg.addColorStop(1, css(env.water.bot, 0.95));
					ctx.fillStyle = wg;
					ctx.beginPath();
					ctx.ellipse(px + view.w * 0.07, py, view.w * 0.065, view.h * 0.024, 0, 0, 6.2832);
					ctx.fill();
					const lx2 = px - view.w * 0.05;
					const ly = fl + 6;
					lean = { x: lx2, y: ly };
					const wood = env.lit([92, 64, 42]);
					ctx.fillStyle = css(mul(wood, 0.7));
					ctx.beginPath();
					ctx.moveTo(lx2 - 36, ly);
					ctx.lineTo(lx2 - 36, ly - 30);
					ctx.lineTo(lx2 + 10, ly - 40);
					ctx.lineTo(lx2 + 36, ly - 8);
					ctx.lineTo(lx2 + 36, ly);
					ctx.closePath();
					ctx.fill();
					ctx.fillStyle = css(env.lit([30, 22, 18]), 0.9);
					ctx.beginPath();
					ctx.moveTo(lx2 - 30, ly);
					ctx.lineTo(lx2 - 30, ly - 24);
					ctx.lineTo(lx2 + 8, ly - 32);
					ctx.lineTo(lx2 + 28, ly - 6);
					ctx.lineTo(lx2 + 28, ly);
					ctx.fill();
					ctx.fillStyle = css(wood);
					ctx.beginPath();
					ctx.moveTo(lx2 - 40, ly - 28);
					ctx.lineTo(lx2 + 10, ly - 44);
					ctx.lineTo(lx2 + 10, ly - 38);
					ctx.lineTo(lx2 - 40, ly - 22);
					ctx.fill();
					if (env.snowAmt) {
						ctx.fillStyle = css(env.lit([244, 247, 252]), 0.95);
						ctx.beginPath();
						ctx.moveTo(lx2 - 40, ly - 28);
						ctx.lineTo(lx2 + 10, ly - 44);
						ctx.lineTo(lx2 + 10, ly - 41);
						ctx.lineTo(lx2 - 40, ly - 25);
						ctx.fill();
					}
				}
			});
			paintFogBand(ctx, view, env, hy0 + view.h * 0.12, env.fog * 0.8);
			void offscreen;
			void blob;
		},
		frame(ctx, scene, view, env, t, dt, still) {
			const f = env.night > 0.15 || env.cover > 0.6 || env.alt < 12 ? 1 : 0.35;
			const x = lean.x + 6;
			const y = lean.y - 6;
			const fl = still ? 1 : 0.85 + 0.15 * Math.sin(t * 9 + Math.sin(t * 3.7) * 2);
			const r = 54 * f * fl + 10;
			const g = ctx.createRadialGradient(x, y, 0, x, y, r);
			g.addColorStop(0, `rgba(255,190,100,${0.75 * f})`);
			g.addColorStop(1, "rgba(255,150,60,0)");
			ctx.fillStyle = g;
			ctx.fillRect(x - r, y - r, r * 2, r * 2);
			ctx.fillStyle = `rgba(255,220,150,${0.95 * fl})`;
			ctx.beginPath();
			ctx.ellipse(x, y + 1, 3.4, 4.6 * fl, 0, 0, 6.2832);
			ctx.fill();
			// smoke
			const col = env.tone === "dark" ? [190, 200, 225] : [110, 118, 130];
			for (let i = 0; i < 6; i++) {
				const k = (((still ? 0.4 : t * 0.12) + i / 6) % 1);
				const sx = x + Math.sin(k * 5 + i) * 6 + k * (14 + env.wind * 30);
				const sy = y - 10 - k * 70;
				ctx.fillStyle = css(col, 0.16 * (1 - k));
				ctx.beginPath();
				ctx.arc(sx, sy, 3 + k * 9, 0, 6.2832);
				ctx.fill();
			}
		},
	});
}
