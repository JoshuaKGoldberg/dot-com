// #196 AST Forest. Every tree is the real abstract syntax tree of a code snippet.
//
// Parameters (see _adk/kit.js): { seed, date, hour, season, weather, wind, latitude, longitude, tz }
//   seed     picks which six snippets grow, and the shape jitter of each tree
//   hour/date/season/weather  light, foliage and sky (via makeEnv)
// generate(params, env) is pure: it parses snippets with _adk/mini.js and lays out branches and leaves
// in tree-local units. paint()/frame() only draw what generate() returned.
import { mountScene, rng, css, mix, mul, makeSprite, blitSprite, clamp } from "./_adk/kit.js";
import { paintLakeScene } from "./_adk/lake.js";
import { parse, children, tokenize, SNIPPETS } from "./_adk/mini.js";

const PICK = ["noEval", "clamp", "fib", "loop", "filter", "gcd", "cfg", "scopes"];
const SPECIES = {
	spruce: { spread: 1.05, shrink: 0.7, up: 0.3, bend: 0.12, droop: 0, leaf: "needle" },
	birch: { spread: 0.95, shrink: 0.76, up: 0.2, bend: 0.2, droop: 0, leaf: "small" },
	maple: { spread: 1.45, shrink: 0.74, up: 0.12, bend: 0.3, droop: 0, leaf: "broad" },
	willow: { spread: 1.15, shrink: 0.8, up: 0.05, bend: 0.2, droop: 0.1, leaf: "small" },
};

const parsed = new Map();
function getAst(key) {
	if (!parsed.has(key)) {
		const src = SNIPPETS[key];
		parsed.set(key, { ast: parse(src), toks: tokenize(src).slice(0, -1) });
	}
	return parsed.get(key);
}

function annotate(n, toks) {
	const kids = children(n).map((c) => annotate(c, toks));
	const inside = toks.filter((t) => t.start >= n.start && t.end <= n.end).length;
	const inKids = kids.reduce((s, k) => s + k.tokens, 0);
	return {
		type: n.type,
		name: n.name,
		kids,
		tokens: inside,
		own: Math.max(0, inside - inKids),
		lc: kids.length ? kids.reduce((s, k) => s + k.lc, 0) : 1,
		h: kids.length ? 1 + Math.max(...kids.map((k) => k.h)) : 0,
	};
}

function speciesOf(root) {
	const c = {};
	(function walk(n) {
		c[n.type] = (c[n.type] || 0) + 1;
		n.kids.forEach(walk);
	})(root);
	const g = (k) => c[k] || 0;
	const score = {
		spruce: g("FunctionDeclaration") * 2 + g("FunctionExpression") + g("BlockStatement") * 0.6,
		birch: (g("IfStatement") + g("ConditionalExpression")) * 2 + g("BinaryExpression") * 0.5,
		maple: g("ObjectExpression") * 2 + g("CallExpression") * 1.2 + g("ArrowFunctionExpression"),
		willow: (g("ForOfStatement") + g("WhileStatement") + g("ForStatement")) * 4 + g("ArrayExpression"),
	};
	return Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
}

function growTree(key, rand) {
	const { ast, toks } = getAst(key);
	const root = annotate(ast, toks);
	const species = speciesOf(root);
	const sp = SPECIES[species];
	const branches = [];
	const leaves = [];
	const labels = [];
	const baseW = 0.05;
	function grow(n, x, y, ang, len, depth) {
		const nx = x + Math.sin(ang) * len;
		const ny = y - Math.cos(ang) * len;
		const w = Math.max(0.0035, baseW * Math.sqrt(n.lc / root.lc));
		const bend = (rand() - 0.5) * sp.bend * len;
		const mx = (x + nx) / 2 + Math.cos(ang) * bend;
		const my = (y + ny) / 2 + Math.sin(ang) * bend;
		branches.push({ x, y, cx: mx, cy: my, x2: nx, y2: ny, w, depth });
		const wide = n.kids.length > 1;
		if (depth <= 6 && (wide || depth === 0)) labels.push({ x: nx, y: ny, t: n.type, depth, wide });
		// tokens owned by this node hang as leaf sprigs near the branch end
		const own = n.own;
		for (let i = 0; i < own; i++) sprig(mx + (nx - mx) * rand(), my + (ny - my) * rand(), ang, 12 + ((rand() * 6) | 0), 0.07 + 0.03 * rand());
		if (!n.kids.length) {
			sprig(nx, ny, ang, 22, 0.09);
			return;
		}
		const k = n.kids.length;
		for (let i = 0; i < k; i++) {
			const kid = n.kids[i];
			const frac = k === 1 ? 0 : i / (k - 1) - 0.5;
			let a = ang + frac * sp.spread * Math.min(1, 0.45 + k * 0.28) + (rand() - 0.5) * 0.35;
			a += sp.droop * Math.min(depth, 8) * (ang > 0 ? 1 : -1) * 0.5;
			a -= ang * sp.up;
			const share = Math.sqrt(kid.lc / n.lc);
			const l = len * (k === 1 ? sp.shrink + 0.14 : sp.shrink) * (0.72 + 0.5 * share);
			grow(kid, nx, ny, a, l, depth + 1);
		}
	}
	function sprig(x, y, ang, count, r) {
		for (let i = 0; i < count; i++) {
			const a = rand() * 6.28;
			const d = Math.sqrt(rand()) * r;
			leaves.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, a: rand() * 3.14, s: 0.7 + rand() * 0.6, c: (rand() * 5) | 0 });
		}
		void ang;
	}
	grow(root, 0, 0, (rand() - 0.5) * 0.06, 0.2, 0);
	// normalise so the tree is 1 tall, centred on x=0
	let minY = 0;
	let minX = 0;
	let maxX = 0;
	for (const b of branches) {
		minY = Math.min(minY, b.y2);
		minX = Math.min(minX, b.x2);
		maxX = Math.max(maxX, b.x2);
	}
	for (const l of leaves) {
		minY = Math.min(minY, l.y);
		minX = Math.min(minX, l.x);
		maxX = Math.max(maxX, l.x);
	}
	const H = -minY;
	const norm = (v) => v / H;
	for (const b of branches) {
		b.x = norm(b.x);
		b.y = norm(b.y);
		b.cx = norm(b.cx);
		b.cy = norm(b.cy);
		b.x2 = norm(b.x2);
		b.y2 = norm(b.y2);
		b.w = norm(b.w);
	}
	for (const l of leaves) {
		l.x = norm(l.x);
		l.y = norm(l.y);
	}
	for (const l of labels) {
		l.x = norm(l.x);
		l.y = norm(l.y);
	}
	return { key, species, branches, leaves, labels, half: Math.max(-norm(minX), norm(maxX)) + 0.05, nodes: root.lc };
}

// slots: x (fraction of width), base (fraction of horizon..bottom, 0 = shoreline), h (fraction of viewport height)
const SLOTS = [
	{ x: 0.74, base: 0.0, h: 0.15, far: 1 },
	{ x: 0.32, base: 0.0, h: 0.17, far: 1 },
	{ x: 0.83, base: 0.22, h: 0.36, far: 0.4 },
	{ x: 0.19, base: 0.2, h: 0.38, far: 0.4 },
	{ x: 0.94, base: 0.9, h: 0.6, far: 0 },
	{ x: 0.05, base: 0.88, h: 0.56, far: 0 },
];

export function generate(p) {
	const rand = rng(p.seed * 101 + 7);
	const order = PICK.map((k) => [rand(), k]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
	const trees = SLOTS.map((slot, i) => {
		const t = growTree(order[i], rng(p.seed * 17 + i * 313));
		return { ...t, slot, phase: rand() * 6.28 };
	});
	return { trees };
}

function leafColor(env, species, idx, far) {
	const pal = env.land.leaf;
	let base;
	if (species === "spruce") base = mix(env.land.conifer, [60, 110, 80], (idx % 3) * 0.15);
	else base = pal[idx % pal.length];
	if (species === "birch" && env.p.season === "autumn") base = mix(pal[2], pal[0], (idx % 3) / 3);
	if (species === "willow" && env.p.season !== "winter") base = mix(base, [150, 170, 80], 0.35);
	return mix(env.lit(base), env.haze, far * 0.55 + env.fog * 0.4);
}

function drawTree(ctx, t, env, scale, far) {
	const sp = SPECIES[t.species];
	const winter = env.p.season === "winter";
	let bark = t.species === "birch" ? [226, 222, 212] : env.land.bark;
	bark = mix(env.lit(bark), env.haze, far * 0.55 + env.fog * 0.4);
	ctx.lineCap = "round";
	for (const b of t.branches) {
		const w1 = b.w * scale;
		const dx = b.x2 - b.x;
		const dy = b.y2 - b.y;
		const L = Math.hypot(dx, dy) || 1;
		const nx = (-dy / L) * w1 * 0.5;
		const ny = (dx / L) * w1 * 0.5;
		ctx.fillStyle = css(bark);
		ctx.beginPath();
		ctx.moveTo(b.x * scale + nx, b.y * scale + ny);
		ctx.quadraticCurveTo(b.cx * scale + nx * 0.8, b.cy * scale + ny * 0.8, b.x2 * scale + nx * 0.6, b.y2 * scale + ny * 0.6);
		ctx.lineTo(b.x2 * scale - nx * 0.6, b.y2 * scale - ny * 0.6);
		ctx.quadraticCurveTo(b.cx * scale - nx * 0.8, b.cy * scale - ny * 0.8, b.x * scale - nx, b.y * scale - ny);
		ctx.closePath();
		ctx.fill();
		if (winter && Math.abs(dy) < Math.abs(dx) * 1.2 && w1 > 1.2) {
			ctx.strokeStyle = css(env.lit([240, 244, 250], 0.9), 0.85);
			ctx.lineWidth = Math.max(1, w1 * 0.4);
			ctx.beginPath();
			ctx.moveTo(b.x * scale, b.y * scale - w1 * 0.35);
			ctx.lineTo(b.x2 * scale, b.y2 * scale - w1 * 0.35);
			ctx.stroke();
		}
	}
	// leaves
	const leafA = winter && sp.leaf !== "needle" ? 0 : 1;
	if (leafA) {
		const sz = (sp.leaf === "broad" ? 0.016 : sp.leaf === "needle" ? 0.012 : 0.011) * scale;
		const byColor = new Map();
		for (const l of t.leaves) {
			const k = l.c;
			if (!byColor.has(k)) byColor.set(k, []);
			byColor.get(k).push(l);
		}
		for (const [k, arr] of byColor) {
			ctx.fillStyle = css(leafColor(env, t.species, k, far), 0.9);
			ctx.strokeStyle = ctx.fillStyle;
			ctx.beginPath();
			for (const l of arr) {
				const x = l.x * scale;
				const y = l.y * scale;
				if (sp.leaf === "needle") {
					ctx.moveTo(x + sz * 1.7 * l.s, y);
					ctx.ellipse(x, y, sz * 1.7 * l.s, sz * 0.7, l.a, 0, 6.2832);
				} else {
					ctx.moveTo(x + sz * l.s, y);
					ctx.ellipse(x, y, sz * l.s, sz * l.s * 0.62, l.a, 0, 6.2832);
				}
			}
			ctx.fill();
		}
	}
	if (winter && sp.leaf === "needle") {
		ctx.fillStyle = css(env.lit([244, 247, 252], 0.9), 0.55);
		ctx.beginPath();
		for (const l of t.leaves) {
			if (l.c % 2) {
				ctx.moveTo(l.x * scale + 2, l.y * scale - 2);
				ctx.arc(l.x * scale, l.y * scale - 2, 2.2, 0, 6.2832);
			}
		}
		ctx.fill();
	}
	// AST joints and labels: faint, on the larger trees only
	if (far < 0.5) {
		const ink = env.tone === "dark" ? [220, 232, 255] : [24, 36, 58];
		ctx.lineWidth = 1;
		ctx.strokeStyle = css(ink, 0.4);
		ctx.font = `${far > 0 ? 8 : 10}px ui-monospace, Menlo, monospace`;
		ctx.fillStyle = css(ink, 0.5);
		let shown = 0;
		for (const l of t.labels) {
			if (!l.wide && l.depth !== 0) continue;
			ctx.beginPath();
			ctx.arc(l.x * scale, l.y * scale, 3.2, 0, 6.2832);
			ctx.stroke();
			if (shown < 4 && l.depth <= 4) {
				ctx.fillText(l.t, l.x * scale + 6, l.y * scale - 3);
				shown++;
			}
		}
	}
}

function bankLump(ctx, env, cx, cy, rx, ry, fall = 3) {
	const c = mix(env.lit(env.land.ground), env.haze, env.fog * 0.3);
	const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry * 1.2);
	g.addColorStop(0, css(mix(c, [255, 255, 255], env.snowAmt * 0.1)));
	g.addColorStop(1, css(mul(c, 0.62)));
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.moveTo(cx - rx, cy + ry * fall);
	ctx.lineTo(cx - rx, cy + ry * 0.4);
	ctx.bezierCurveTo(cx - rx * 0.8, cy - ry * 0.4, cx - rx * 0.35, cy - ry, cx, cy - ry);
	ctx.bezierCurveTo(cx + rx * 0.4, cy - ry, cx + rx * 0.8, cy - ry * 0.4, cx + rx, cy + ry * 0.4);
	ctx.lineTo(cx + rx, cy + ry * fall);
	ctx.closePath();
	ctx.fill();
}

export function activate({ root, mode, reducedMotion }) {
	let sprites = [];
	return mountScene(root, {
		id: "ast-forest",
		mode,
		reducedMotion,
		generate,
		paint(ctx, scene, view, env) {
			const lake = paintLakeScene(ctx, view, env, { horizon: 0.62 });
			const hy = lake.hy;
			const H = view.h;
			sprites = scene.trees.map((t) => {
				const th = t.slot.h * H;
				const w = t.half * th * 2 + 40;
				const s = makeSprite(view, w, th + 20, (c) => {
					c.translate(w / 2, th + 10);
					drawTree(c, t, env, th, t.slot.far);
				});
				return { s, w, th, x: view.w * t.slot.x, y: hy + t.slot.base * (H - hy) };
			});
			// near banks + spits
			bankLump(ctx, env, view.w * 0.02, H * 0.95, view.w * 0.3, H * 0.075, 4);
			bankLump(ctx, env, view.w * 0.98, H * 0.94, view.w * 0.3, H * 0.09, 4);
			bankLump(ctx, env, view.w * 0.19, hy + (H - hy) * 0.2, view.w * 0.11, H * 0.018, 1.2);
			bankLump(ctx, env, view.w * 0.83, hy + (H - hy) * 0.2, view.w * 0.11, H * 0.018, 1.2);
			// reflections
			for (let i = 0; i < sprites.length; i++) {
				const sp = sprites[i];
				ctx.save();
				ctx.translate(sp.x, sp.y);
				ctx.scale(1, -0.75);
				ctx.globalAlpha = 0.16 * (1 - env.ice * 0.6);
				ctx.drawImage(sp.s.c, -sp.w / 2, -sp.th - 10, sp.s.w, sp.s.h);
				ctx.restore();
			}
		},
		frame(ctx, scene, view, env, t, dt, still) {
			const wind = 0.25 + env.wind * 1.4;
			for (let i = 0; i < sprites.length; i++) {
				const sp = sprites[i];
				const tr = scene.trees[i];
				const rot = still ? 0 : Math.sin(t * (0.5 + 0.2 * (i % 3)) + tr.phase) * 0.011 * wind * (1 + (1 - tr.slot.far) * 0.5) + Math.sin(t * 1.7 + tr.phase) * 0.003 * wind;
				blitSprite(ctx, sp.s, sp.x, sp.y, sp.w / 2, sp.th + 10, rot);
			}
		},
		horizon: 0.62,
	});
}
