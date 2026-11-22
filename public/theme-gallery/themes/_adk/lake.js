// Shared lake backdrop: sky, hazy ridges, far shore pines, mirrored lake, glints, fog.
import { css, mix, rng, makeNoise, offscreen, paintSky, paintRidges, paintPineBand, paintLake, paintGlints, paintFogBand, ridgeYs, fillRidge, clamp, lerp } from "./kit.js";

export const DEFAULT_RIDGES = [
	{ base: 0.3, amp: 0.2, freq: 1.7, oct: 4, off: 2.0, depth: 1, round: 1.1 },
	{ base: 0.18, amp: 0.17, freq: 2.2, oct: 4, off: 9.0, depth: 0.6, round: 1.0 },
	{ base: 0.06, amp: 0.1, freq: 3.1, oct: 3, off: 21.0, depth: 0.25, round: 0.9 },
];

// Paints into ctx; returns { hy, sky, ridges, back }.
export function paintLakeScene(ctx, view, env, { horizon = 0.64, ridges = DEFAULT_RIDGES, farPines = true, skyOpts, ripple = 1, glints = true, midground } = {}) {
	const hy = Math.round(view.h * horizon);
	const noise = makeNoise(env.p.seed * 3 + 11);
	const { c: back, ctx: bctx } = offscreen(view);
	const sky = paintSky(bctx, view, env, hy, skyOpts);
	const ridgeYs2 = paintRidges(bctx, view, env, hy, noise, ridges.map((r) => ({ ...r })));
	if (farPines) {
		const rand = rng(env.p.seed * 5 + 3);
		paintPineBand(bctx, env, rand, { x0: -10, x1: view.w * 0.3, baseY: hy + 1, h: view.h * 0.05, gap: [5, 9], depth: 0.3, jitter: 2 });
		paintPineBand(bctx, env, rand, { x0: view.w * 0.7, x1: view.w + 10, baseY: hy + 1, h: view.h * 0.05, gap: [5, 9], depth: 0.3, jitter: 2 });
		const shore = env.lit(env.land.conifer);
		bctx.fillStyle = css(mix(shore, env.haze, 0.35 + env.fog * 0.4));
		bctx.fillRect(0, hy - 1, view.w, 3);
	}
	if (midground) midground(bctx, hy);
	ctx.drawImage(back, 0, 0, view.w, view.h);
	paintLake(ctx, view, env, hy, back, { ripple });
	if (glints) paintGlints(ctx, view, env, hy, sky);
	paintFogBand(ctx, view, env, hy);
	return { hy, sky, ridges: ridgeYs2, back, noise };
}

export { ridgeYs, fillRidge, clamp, lerp };
