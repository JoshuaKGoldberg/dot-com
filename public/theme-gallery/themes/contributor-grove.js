// #203 Contributor Grove. An open-source grove: each tree is a contributor, procedurally grown from a hash of
// their handle, and the fireflies are merged pull requests.
//
// Parameters (see _adk/kit.js): { seed, date, hour, season, weather, wind, latitude, longitude, tz }
//   plus `merged` (0..60, default 28): how many fireflies (merged PRs) drift through the grove.
//   seed picks which contributors stand in the grove and where.
// generate(params) is pure: tree specs (species, proportions, canopy lobes) come only from hashStr(handle).
import { mountScene, rng, hashStr, css, mix, mul, clamp, lerp, makeSprite, blitSprite, blob } from "./_adk/kit.js";
import { paintLakeScene } from "./_adk/lake.js";

const HANDLES = ["juniper", "oksana", "tavish", "mireille", "dax", "ines", "bram", "koa", "yusuf", "linnea", "petra", "odile", "caspian", "wren", "thaddeus", "soledad"];
const SPECIES = ["oak", "conifer", "birch", "maple", "willow"];

export function treeSpec(handle) {
	const h = hashStr(handle);
	const r = rng(h);
	const species = SPECIES[h % SPECIES.length];
	const spec = { handle, species, lean: (r() - 0.5) * 0.14, fam: (r() * 5) | 0, blobs: [], limbs: [], commits: 20 + Math.floor(r() * 480) };
	const trunkH = { oak: 0.34, conifer: 0.1, birch: 0.42, maple: 0.36, willow: 0.3 }[species];
	spec.trunkH = trunkH;
	spec.trunkW = { oak: 0.055, conifer: 0.04, birch: 0.03, maple: 0.045, willow: 0.05 }[species];
	const nb = { oak: 24, conifer: 0, birch: 17, maple: 30, willow: 22 }[species];
	const cw = { oak: 0.4, conifer: 0.28, birch: 0.2, maple: 0.34, willow: 0.38 }[species];
	for (let i = 0; i < nb; i++) {
		const a = r() * 6.2832;
		const d = Math.sqrt(r());
		const x = Math.cos(a) * d * cw + spec.lean * 2;
		const y = -trunkH - 0.12 - (Math.sin(a) * 0.5 + 0.5) * (1 - trunkH - 0.12) * (0.4 + 0.6 * d) * (species === "birch" ? 1.2 : 0.9) + (species === "oak" ? 0.1 : 0);
		spec.blobs.push({ x, y: Math.min(y, -trunkH - 0.04), r: (0.055 + r() * 0.05) * (species === "birch" ? 0.8 : 1) * (1.2 - d * 0.4) });
	}
	const nl = 2 + ((r() * 3) | 0);
	for (let i = 0; i < nl; i++) spec.limbs.push({ a: (i / (nl - 1 || 1) - 0.5) * (species === "oak" ? 1.8 : 1.1) + (r() - 0.5) * 0.3, l: 0.16 + r() * 0.12 });
	spec.strands = species === "willow" ? Array.from({ length: 28 }, () => ({ a: (r() - 0.5) * 2, l: 0.2 + r() * 0.2, h: r() })) : [];
	return spec;
}

export function generate(p) {
	const rand = rng(p.seed * 91 + 13);
	const order = [...HANDLES].sort(() => rand() - 0.5).slice(0, 9);
	const trees = order.map((name, i) => {
		const side = i % 2 ? 1 : -1;
		const x = 0.5 + side * (0.24 + rand() * 0.24);
		return { ...treeSpec(name), x, y: 0.64 + rand() * 0.32, size: 0.8 + rand() * 0.4, phase: rand() * 6.28 };
	});
	trees.sort((a, b) => a.y - b.y);
	const merged = Math.round(p.merged ?? 28);
	const flies = Array.from({ length: merged }, () => ({ x: rand(), y: 0.52 + rand() * 0.45, ph: rand() * 6.28, sp: 0.2 + rand() * 0.5, r: 0.4 + rand() * 0.9, n: 1000 + ((rand() * 9000) | 0) }));
	const flowers = Array.from({ length: 160 }, () => ({ x: rand(), y: 0.64 + rand() * 0.36, c: (rand() * 3) | 0, s: 1 + rand() * 1.3 }));
	return { trees, flies, flowers, wob: [rand() * 6, rand() * 6, rand() * 6] };
}

function foliage(env, fam, far) {
	const s = env.p.season;
	const pal = env.land.leaf;
	let c;
	if (s === "summer") c = mix(pal[fam % pal.length], [40, 90, 50], 0.2);
	else c = pal[fam % pal.length];
	return mix(mix(env.lit(c), [44, 66, 112], env.night * 0.35), env.haze, far * 0.5 + env.fog * 0.35);
}

function drawTree(ctx, t, env, th, far) {
	const bark = mix(mix(env.lit(t.species === "birch" ? [228, 224, 214] : env.land.bark), [40, 52, 90], env.night * 0.3), env.haze, env.fog * 0.3);
	const winter = env.p.season === "winter";
	const lightDir = env.sm.sun.x < 0.5 ? -1 : 1;
	const tw = t.trunkW * th;
	ctx.fillStyle = css(bark);
	ctx.beginPath();
	ctx.moveTo(-tw, 0);
	ctx.quadraticCurveTo(-tw * 0.7, -t.trunkH * th * 0.5, t.lean * th - tw * 0.5, -t.trunkH * th);
	ctx.lineTo(t.lean * th + tw * 0.5, -t.trunkH * th);
	ctx.quadraticCurveTo(tw * 0.7, -t.trunkH * th * 0.5, tw * 1.2, 0);
	ctx.fill();
	if (t.species === "birch") {
		ctx.fillStyle = css(env.lit([40, 36, 34]), 0.8);
		for (let i = 0; i < 7; i++) ctx.fillRect(-tw * 0.6 + (i % 2) * tw * 0.5, -t.trunkH * th * (0.1 + i * 0.12), tw * 0.8, 1.6);
	}
	// limbs
	ctx.strokeStyle = css(bark);
	ctx.lineCap = "round";
	for (const l of t.limbs) {
		const x0 = t.lean * th;
		const y0 = -t.trunkH * th;
		ctx.lineWidth = tw * 0.7;
		ctx.beginPath();
		ctx.moveTo(x0, y0);
		ctx.quadraticCurveTo(x0 + Math.sin(l.a) * l.l * th * 0.5, y0 - l.l * th * 0.7, x0 + Math.sin(l.a) * l.l * th * 1.3, y0 - Math.cos(l.a) * l.l * th * 1.3);
		ctx.stroke();
	}
	if (t.species === "conifer") {
		const base = foliage(env, 0, far);
		const g = mix(env.lit(env.land.conifer), env.haze, far * 0.5 + env.fog * 0.35);
		const tiers = 7;
		for (let i = 0; i < tiers; i++) {
			const k = i / (tiers - 1);
			const w = th * lerp(0.26, 0.07, k) * 1.1;
			const y1 = -t.trunkH * th - k * th * 0.78 * 0.9 + th * 0.04;
			const y0 = y1 + th * 0.2;
			ctx.fillStyle = css(mul(g, 0.8 - k * 0.1));
			ctx.beginPath();
			ctx.moveTo(t.lean * th * (1 - k), y1 - th * 0.1);
			ctx.lineTo(-w, y0);
			ctx.lineTo(w, y0);
			ctx.fill();
			ctx.fillStyle = css(mix(g, [255, 255, 255], 0.05 + env.light * 0.06));
			ctx.beginPath();
			ctx.moveTo(t.lean * th * (1 - k), y1 - th * 0.1);
			ctx.lineTo(lightDir * w, y0);
			ctx.lineTo(lightDir * w * 0.2, y0);
			ctx.fill();
			if (env.snowAmt) {
				ctx.fillStyle = css(env.lit([244, 247, 252], 0.9), 0.9);
				ctx.beginPath();
				ctx.moveTo(t.lean * th * (1 - k), y1 - th * 0.1);
				ctx.lineTo(-w * 0.7, y1 + th * 0.06);
				ctx.lineTo(w * 0.7, y1 + th * 0.06);
				ctx.fill();
			}
		}
		void base;
		return;
	}
	if (winter) {
		// bare crown: fine forks, snow on top
		ctx.strokeStyle = css(bark);
		ctx.lineWidth = Math.max(1, tw * 0.25);
		for (const b of t.blobs) {
			ctx.beginPath();
			ctx.moveTo(t.lean * th, -t.trunkH * th);
			ctx.quadraticCurveTo(b.x * th * 0.5, (b.y * th * 0.5 - t.trunkH * th * 0.5), b.x * th, b.y * th);
			ctx.stroke();
		}
		ctx.fillStyle = css(env.lit([244, 247, 252], 0.9), 0.8);
		for (const b of t.blobs) {
			ctx.beginPath();
			ctx.arc(b.x * th, b.y * th - b.r * th * 0.4, b.r * th * 0.45, Math.PI, 0);
			ctx.fill();
		}
		return;
	}
	if (t.species === "willow") {
		const c = foliage(env, t.fam, far);
		ctx.strokeStyle = css(mix(c, [150, 170, 80], 0.3), 0.85);
		ctx.lineWidth = 1.3;
		for (const s of t.strands) {
			const x = t.lean * th + s.a * th * 0.36;
			const y = -t.trunkH * th - th * (0.3 + 0.2 * s.h) + Math.abs(s.a) * th * 0.18;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.quadraticCurveTo(x + s.a * th * 0.06, y + s.l * th * 0.5, x + s.a * th * 0.05, y + s.l * th);
			ctx.stroke();
		}
	}
	const c = foliage(env, t.fam, far);
	const dark = mul(c, 0.66);
	const light = mix(c, [255, 255, 220], 0.2 * env.light + 0.05);
	for (const pass of [0, 1, 2]) {
		for (const b of t.blobs) {
			const x = b.x * th;
			const y = b.y * th;
			const r = b.r * th;
			if (pass === 0) {
				ctx.fillStyle = css(dark);
				ctx.beginPath();
				ctx.arc(x - lightDir * r * 0.15, y + r * 0.2, r * 1.04, 0, 6.2832);
			} else if (pass === 1) {
				ctx.fillStyle = css(c);
				ctx.beginPath();
				ctx.arc(x, y, r * 0.92, 0, 6.2832);
			} else {
				ctx.fillStyle = css(light, 0.85);
				ctx.beginPath();
				ctx.arc(x + lightDir * r * 0.22, y - r * 0.26, r * 0.5, 0, 6.2832);
			}
			ctx.fill();
		}
	}
	// leaf specks
	const rr = rng(hashStr(t.handle) + 5);
	for (let i = 0; i < 110; i++) {
		const b = t.blobs[(rr() * t.blobs.length) | 0];
		ctx.fillStyle = css(rr() < 0.5 ? light : dark, 0.8);
		ctx.beginPath();
		ctx.arc(b.x * th + (rr() - 0.5) * b.r * th * 2, b.y * th + (rr() - 0.5) * b.r * th * 2, 1.2, 0, 6.2832);
		ctx.fill();
	}
	if (env.p.season === "spring" && t.fam % 2 === 0) {
		ctx.fillStyle = css(env.lit([255, 214, 226]), 0.9);
		for (let i = 0; i < 26; i++) {
			const b = t.blobs[(rr() * t.blobs.length) | 0];
			ctx.beginPath();
			ctx.arc(b.x * th + (rr() - 0.5) * b.r * th * 1.8, b.y * th + (rr() - 0.5) * b.r * th * 1.8, 1.8, 0, 6.2832);
			ctx.fill();
		}
	}
}

export function activate({ root, mode, reducedMotion }) {
	let sprites = [];
	let geom = { top: 0 };
	return mountScene(root, {
		id: "contributor-grove",
		mode,
		reducedMotion,
		defaults: { merged: 28 },
		controls: [{ key: "merged", label: "Merged PRs", min: 0, max: 60, step: 1, default: 28 }],
		generate,
		horizon: 0.5,
		paint(ctx, scene, view, env) {
			const lake = paintLakeScene(ctx, view, env, { horizon: 0.5 });
			const H = view.h;
			const hy = lake.hy;
			// meadow bank
			const top = H * 0.6;
			geom.top = top;
			const g = ctx.createLinearGradient(0, top, 0, H);
			const gc = env.lit(mix(env.land.ground, [60, 110, 60], env.p.season === "winter" ? 0 : 0.2));
			g.addColorStop(0, css(mix(gc, [255, 255, 255], 0.12)));
			g.addColorStop(1, css(mul(gc, 0.72)));
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.moveTo(0, H);
			for (let x = 0; x <= view.w; x += 8) ctx.lineTo(x, top + Math.sin(x * 0.006 + scene.wob[0]) * H * 0.02 + Math.sin(x * 0.017 + scene.wob[1]) * H * 0.008);
			ctx.lineTo(view.w, H);
			ctx.closePath();
			ctx.fill();
			// shoreline highlight
			ctx.strokeStyle = css(env.lit([240, 244, 232]), 0.18);
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			for (let x = 0; x <= view.w; x += 8) {
				const y = top + Math.sin(x * 0.006 + scene.wob[0]) * H * 0.02 + Math.sin(x * 0.017 + scene.wob[1]) * H * 0.008;
				x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
			}
			ctx.stroke();
			// flowers
			const fl = { spring: [[255, 230, 240], [255, 238, 120], [240, 250, 255]], summer: [[190, 150, 255], [255, 232, 110], [255, 255, 255]], autumn: [[240, 140, 70], [200, 90, 60], [230, 210, 120]], winter: [[255, 255, 255], [220, 232, 250], [255, 255, 255]] }[env.p.season];
			for (const f of scene.flowers) {
				ctx.fillStyle = css(env.lit(fl[f.c], 0.9), 0.85);
				ctx.beginPath();
				ctx.arc(f.x * view.w, f.y * H, f.s, 0, 6.2832);
				ctx.fill();
			}
			sprites = scene.trees.map((t) => {
				const scale = lerp(0.52, 1, (t.y - 0.62) / 0.36);
				const th = 0.5 * H * scale * t.size * (0.7 + 0.3 * clamp(t.commits / 400));
				const w = th * 1.1;
				const sp = makeSprite(view, w, th * 1.5, (c) => {
					c.translate(w / 2, th * 1.5 - 4);
					drawTree(c, t, env, th, 0);
				});
				return { sp, w, th, x: t.x * view.w, y: t.y * H, label: t.handle, commits: t.commits };
			});
			// shadows
			for (const s of sprites) {
				ctx.fillStyle = "rgba(0,0,0,0.16)";
				ctx.beginPath();
				ctx.ellipse(s.x + 8, s.y + 1, s.th * 0.24, s.th * 0.035, 0, 0, 6.2832);
				ctx.fill();
			}
		},
		frame(ctx, scene, view, env, t, dt, still) {
			const wind = 0.3 + env.wind * 1.3;
			sprites.forEach((s, i) => {
				const tr = scene.trees[i];
				const rot = still ? 0 : (Math.sin(t * 0.55 + tr.phase) * 0.012 + Math.sin(t * 1.9 + tr.phase * 2) * 0.004) * wind;
				blitSprite(ctx, s.sp, s.x, s.y, s.w / 2, s.sp.h - 4, rot);
				// name tag at the base
				ctx.font = "10px ui-monospace, Menlo, monospace";
				ctx.textAlign = "center";
				const tw = ctx.measureText(s.label).width + 10;
				ctx.fillStyle = css(env.lit([110, 80, 54]), 0.9);
				ctx.fillRect(s.x - tw / 2, s.y + 6, tw, 14);
				ctx.fillStyle = css(env.night > 0.5 ? [250, 236, 210] : [252, 244, 226], 0.95);
				ctx.fillText(s.label, s.x, s.y + 16);
			});
			ctx.textAlign = "left";
			// fireflies: merged PRs. At night they glow; by day they are pale motes of pollen.
			const glow = clamp(env.night * 1.2 + (env.alt < 8 ? 0.35 : 0) + (env.cover > 0.6 ? 0.2 : 0), 0.12, 1);
			const warm = [255, 226, 130];
			ctx.globalCompositeOperation = env.tone === "dark" ? "lighter" : "source-over";
			scene.flies.forEach((f) => {
				const tt = still ? 0 : t;
				const x = (f.x + Math.sin(tt * 0.12 * f.sp + f.ph) * 0.04 + Math.sin(tt * 0.31 + f.ph * 3) * 0.008) * view.w;
				const y = (f.y + Math.cos(tt * 0.1 * f.sp + f.ph) * 0.03) * view.h;
				const blink = still ? 0.8 : 0.5 + 0.5 * Math.sin(tt * (1.2 + f.sp) + f.ph * 5);
				const a = glow * (0.25 + 0.75 * blink * blink);
				if (env.tone === "dark") {
					const r = (10 + f.r * 8) * (0.6 + blink * 0.6);
					const g = ctx.createRadialGradient(x, y, 0, x, y, r);
					g.addColorStop(0, css(warm, 0.75 * a));
					g.addColorStop(1, css(warm, 0));
					ctx.fillStyle = g;
					ctx.fillRect(x - r, y - r, r * 2, r * 2);
					ctx.fillStyle = css([255, 252, 220], a);
					ctx.beginPath();
					ctx.arc(x, y, 1.2 * f.r + 0.3, 0, 6.2832);
					ctx.fill();
				} else {
					ctx.fillStyle = css([255, 252, 236], 0.45 * (0.4 + 0.6 * blink) * (env.p.season === "winter" ? 0.4 : 1));
					ctx.beginPath();
					ctx.arc(x, y, 1 + f.r * 0.8, 0, 6.2832);
					ctx.fill();
				}
			});
			ctx.globalCompositeOperation = "source-over";
			// every few seconds one pull request merges
			if (scene.flies.length) {
				const period = 6;
				const k = still ? 0.45 : (t / period) % 1;
				const n = still ? 0 : Math.floor(t / period);
				const f = scene.flies[(n * 7) % scene.flies.length];
				const x = f.x * view.w;
				const y = f.y * view.h - k * 26;
				const a = Math.sin(clamp(k * 1.5) * Math.PI) * 0.9;
				ctx.font = "11px ui-monospace, Menlo, monospace";
				ctx.fillStyle = css(env.tone === "dark" ? [255, 238, 180] : [60, 90, 50], a);
				ctx.fillText(`✓ merged #${f.n + n}`, x + 8, y);
				ctx.strokeStyle = css(env.tone === "dark" ? warm : [90, 140, 70], a * 0.8);
				ctx.lineWidth = 1.2;
				ctx.beginPath();
				ctx.arc(x, f.y * view.h, 4 + k * 22, 0, 6.2832);
				ctx.stroke();
			}
			void blob;
		},
	});
}
