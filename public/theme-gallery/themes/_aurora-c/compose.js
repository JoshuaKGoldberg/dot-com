// Assembles the shared scene (sky, ridges, ground/banks, edge pines) from a short spec.
import { buildSky, buildRidges, buildPines, newLayer, PAL } from "./scene.js";
import { rgba, lerp, clamp } from "../forest-kit/kit.js";

export { PAL };

export async function compose(S, { alive, idle }, o) {
	const { w, h } = S;
	const pal = o.pal;
	const horizon = o.horizon;
	const sky = buildSky(S, { pal, horizon: 1, glow: o.glow, seed: o.seed });
	S.add(sky.el);
	await idle();
	if (!alive()) return null;
	const fb = { bottom: horizon };
	const ridges = buildRidges(S, {
		seed: o.seed,
		horizon,
		ridges: [
			{ name: "far", baseY: horizon - 0.12, amp: o.farAmp ?? 0.24, scale: 0.26, seed: o.seed + 7, pal: pal.far, depth: 8, x0: o.x0 ?? 2.3 },
			{ name: "mid", baseY: horizon - 0.06, amp: 0.09, scale: 0.16, seed: o.seed + 21, pal: pal.mid, depth: 14, forest: { rows: 3, rowGap: 6, tree: [9, 15], gap: [4, 7], seed: o.seed + 31, colors: pal.midTrees, ...fb } },
			{ name: "hills", baseY: horizon - 0.02, amp: 0.045, scale: 0.1, seed: o.seed + 41, pal: pal.hills, depth: 22, forest: { rows: 3, rowGap: 7, tree: [16, 26], gap: [5, 9], seed: o.seed + 51, colors: pal.hillTrees, ...fb } },
		],
	});
	for (const r of ridges) {
		S.add(r.layer.el);
		S.addParallax(r.layer.el, r.depth);
		await idle();
		if (!alive()) return null;
	}
	const reflect = [sky, ...ridges.map((r) => r.layer)];
	let ground = null;
	if (o.ground) {
		const g = o.ground;
		ground = newLayer(S, 30);
		const x = ground.x;
		const gy = (u) => h * g.y + Math.sin(u * 6.1 + 1) * h * 0.012 + Math.sin(u * 13.7) * h * 0.005 + Math.pow(Math.abs(u * 2 - 1), 2) * h * g.edge;
		x.beginPath();
		x.moveTo(0, ground.h);
		for (let px = 0; px <= w; px += 6) x.lineTo(px, gy(px / w));
		x.lineTo(w, ground.h);
		x.closePath();
		const gr = x.createLinearGradient(0, h * g.y - 20, 0, h);
		gr.addColorStop(0, rgba(g.top));
		gr.addColorStop(1, rgba(g.bottom));
		x.fillStyle = gr;
		x.fill();
		S.add(ground.el);
		S.groundY = (px) => gy(clamp(px / w));
	}
	const banks = o.banks;
	const bankY = (side, px) => {
		if (!banks) return S.groundY ? S.groundY(px) + 4 : h;
		const t = side === "l" ? clamp((px + 40) / (w * banks.l + 40)) : clamp((w + 40 - px) / (w * banks.r + 40));
		const top = (side === "l" ? banks.topL : banks.topR) * h;
		return lerp(top, h + 30, Math.pow(t, 2.2)) + Math.sin(px * 0.09 + (side === "l" ? 3 : 9)) * 3;
	};
	const pines = buildPines(S, { seed: o.seed, pal, banks, reach: o.reach ?? [0.24, 0.2], size: o.size ?? [0.2, 0.5], count: o.count ?? [8, 7], z: 60 }, bankY);
	S.add(pines.el);
	S.addParallax(pines.el, 24);
	await idle();
	if (!alive()) return null;
	return { sky, ridges, ground, pines, reflect: [...reflect, pines], bankY };
}
