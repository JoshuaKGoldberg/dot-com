// #197 Lint Lake. A still lake whose surface carries the page's own lint diagnostics as ripples;
// the reflection shows faint, mirrored source code.
//
// Parameters (see _adk/kit.js): { seed, date, hour, season, weather, wind, latitude, longitude, tz }
// plus data input to generate(): `diags`, produced by a tiny hand-written linter run over the page DOM
// (links with href="#", empty alt text, heading order). generate(params, diags) is pure.
import { mountScene, rng, css, mix, offscreen } from "./_adk/kit.js";
import { paintLakeScene } from "./_adk/lake.js";
import { SNIPPETS } from "./_adk/mini.js";

export function lintPage(root) {
	const out = [];
	for (const a of root.querySelectorAll("a[href='#']")) out.push({ rule: "jsx-a11y/anchor-is-valid", sev: "warn", x: a.getBoundingClientRect().left });
	for (const img of root.querySelectorAll("img[alt='']")) out.push({ rule: "jsx-a11y/alt-text", sev: "info", x: 0 });
	const heads = [...root.querySelectorAll("h1,h2,h3")].map((h) => Number(h.tagName[1]));
	heads.forEach((h, i) => {
		if (i && h - heads[i - 1] > 1) out.push({ rule: "heading-order", sev: "error", x: 0 });
	});
	const h1s = heads.filter((h) => h === 1).length;
	if (h1s !== 1) out.push({ rule: "single-h1", sev: "error", x: 0 });
	// a synthetic pair so the lake is never glassy-smooth when the page is clean
	out.push({ rule: "no-floating-promises", sev: "error", x: 0 }, { rule: "no-unused-vars", sev: "warn", x: 0 });
	return out;
}

const SEV = { error: [232, 92, 84], warn: [236, 168, 64], info: [96, 160, 214] };

export function generate(p, diags) {
	const rand = rng(p.seed * 29 + 3);
	const items = diags.slice(0, 16).map((d, i) => ({
		rule: d.rule,
		sev: d.sev === "warn" ? "warn" : d.sev,
		x: 0.06 + 0.88 * ((i * 0.618 + rand() * 0.25) % 1),
		y: 0.12 + 0.8 * rand(),
		period: 5 + rand() * 5,
		phase: rand(),
		label: i % 3 === 0,
	}));
	const counts = { error: 0, warn: 0, info: 0 };
	for (const d of diags) counts[d.sev]++;
	return { ripples: items, counts, total: diags.length };
}

function drawCode(ctx, view, env, hy) {
	const lakeH = view.h - hy;
	const { c, ctx: o } = offscreen(view, view.w, lakeH);
	o.translate(0, lakeH);
	o.scale(1, -1);
	o.font = "15px ui-monospace, Menlo, monospace";
	const lines = [...SNIPPETS.noEval.split("\n"), "", ...SNIPPETS.cfg.split("\n")];
	const col = env.tone === "dark" ? [214, 226, 255] : [18, 50, 70];
	const kw = /\b(const|function|if|return|for|of|continue)\b/;
	for (let i = 0; i < lines.length; i++) {
		const x = i < 12 ? view.w * 0.04 : view.w * 0.58;
		const y = lakeH - 20 - ((i % 14) * 20 + (i < 12 ? 0 : 0));
		const t = lines[i];
		o.fillStyle = css(kw.test(t) ? mix(col, [120, 160, 255], 0.5) : col, 0.9);
		o.fillText(t, x, y);
		void y;
	}
	return { c, lakeH };
}

export function activate({ root, mode, reducedMotion }) {
	const diags = lintPage(root);
	let code = null;
	return mountScene(root, {
		id: "lint-lake",
		mode,
		reducedMotion,
		defaults: { wind: 0.12 },
		generate: (p) => generate(p, diags),
		horizon: 0.6,
		paint(ctx, scene, view, env) {
			const lake = paintLakeScene(ctx, view, env, { horizon: 0.6, ripple: 0.5 });
			const hy = lake.hy;
			code = drawCode(ctx, view, env, hy);
			// mirrored code, rippling a little more with depth
			ctx.save();
			ctx.globalAlpha = env.tone === "dark" ? 0.24 : 0.26;
			const strip = 2;
			for (let y = 0; y < code.lakeH; y += strip) {
				const dx = Math.sin(y * 0.19 + env.p.seed) * (1 + (y / code.lakeH) * 5) * (0.4 + env.wind * 2);
				ctx.drawImage(code.c, 0, y * view.dpr, view.w * view.dpr, strip * view.dpr, dx, hy + y, view.w, strip);
			}
			ctx.restore();
			// status-bar line, like an editor
			ctx.font = "11px ui-monospace, Menlo, monospace";
			ctx.fillStyle = css(env.ink, 0.6);
			const c = scene.counts;
			ctx.fillText(`✖ ${c.error} errors   ⚠ ${c.warn} warnings   ⓘ ${c.info} info`, 16, view.h - 14);
			// a small dock and lamp
			const dx = view.w * 0.1;
			ctx.fillStyle = css(env.lit([70, 56, 46]));
			ctx.beginPath();
			ctx.moveTo(0, hy + 36);
			ctx.lineTo(dx + 60, hy + 30);
			ctx.lineTo(dx + 70, hy + 36);
			ctx.lineTo(0, hy + 46);
			ctx.fill();
			for (let i = 0; i < 4; i++) ctx.fillRect(dx - 40 + i * 30, hy + 38, 3, 14);
			ctx.fillStyle = css(env.lit([60, 48, 40]));
			ctx.fillRect(dx + 54, hy + 8, 3, 24);
			if (env.night > 0.3) {
				const a = env.night * (1 - env.cover * 0.4);
				const g = ctx.createRadialGradient(dx + 55, hy + 8, 0, dx + 55, hy + 8, 44);
				g.addColorStop(0, `rgba(255,200,120,${0.5 * a})`);
				g.addColorStop(1, "rgba(255,200,120,0)");
				ctx.fillStyle = g;
				ctx.fillRect(dx - 20, hy - 60, 150, 200);
				ctx.fillStyle = `rgba(255,226,170,${a})`;
				ctx.beginPath();
				ctx.arc(dx + 55, hy + 8, 3, 0, 6.2832);
				ctx.fill();
			}
		},
		frame(ctx, scene, view, env, t, dt, still) {
			const hy = view.h * 0.6;
			const lakeH = view.h - hy;
			for (const r of scene.ripples) {
				const col = SEV[r.sev];
				const cx = r.x * view.w;
				const cy = hy + 14 + r.y * (lakeH - 24);
				const persp = 0.3 + (cy - hy) / lakeH;
				const k0 = still ? 0.45 : ((t / r.period + r.phase) % 1);
				for (let i = 0; i < 3; i++) {
					const k = (k0 - i * 0.16 + 1) % 1;
					const rad = (5 + k * 95) * persp;
					ctx.strokeStyle = css(env.tone === "dark" ? mix(col, [255, 255, 255], 0.2) : mix(col, [20, 30, 50], 0.1), 0.95 * (1 - k) * (1 - k));
					ctx.lineWidth = 1.6;
					ctx.beginPath();
					ctx.ellipse(cx, cy, rad, rad * 0.24, 0, 0, 6.2832);
					ctx.stroke();
				}
				ctx.fillStyle = css(col, 0.9);
				ctx.beginPath();
				ctx.arc(cx, cy, 1.6, 0, 6.2832);
				ctx.fill();
				if (r.label) {
					ctx.font = "10px ui-monospace, Menlo, monospace";
					ctx.fillStyle = css(env.ink, 0.6);
					const tx = cx + 8;
					ctx.fillText(r.rule, tx, cy - 6);
					const wd = ctx.measureText(r.rule).width;
					ctx.strokeStyle = css(col, 0.85);
					ctx.lineWidth = 1;
					ctx.beginPath();
					for (let x = 0; x <= wd; x += 2) ctx.lineTo(tx + x, cy - 3 + (x % 4 < 2 ? 0 : 1.6));
					ctx.stroke();
				}
			}
		},
	});
}
