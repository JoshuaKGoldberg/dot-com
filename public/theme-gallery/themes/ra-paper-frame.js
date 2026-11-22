/*
 * #311 Paper Frame: #276 grain and soft pastel washes frame every edge. The
 * washes lean toward the cursor and brighten with movement; a level-2 raised
 * aurora sits at the top and margin stars appear at night.
 */
import { buildWashes, disposer, grainLayer, isDark, loop, marginStars, pointer, raisedAurora } from "./_refined-d/kit.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const dark = isDark();
	const scenery = root.querySelector(".scenery-a");
	if (!scenery) return;

	const field = document.createElement("div");
	field.className = "rp-field";
	scenery.append(field);
	d.add(() => field.remove());
	const W = buildWashes(field, [
		{ cls: "rp-f1 rp-teal", depth: 0.9 },
		{ cls: "rp-f2 rp-lilac", depth: 0.7 },
		{ cls: "rp-f3 rp-pink", depth: 0.8 },
		{ cls: "rp-f4 rp-mint", depth: 1 },
		{ cls: "rp-f5 rp-sky", depth: 1.1 },
		{ cls: "rp-f6 rp-peach", depth: 1.1 },
	]);
	const hair = document.createElement("div");
	hair.className = "rp-hair";
	field.append(hair);
	const g = grainLayer(field, "rp-grain rp-frame-grain", dark);
	d.add(g.cancel);
	W.measure();
	d.on(window, "resize", W.measure, { passive: true });

	raisedAurora(root, 2, d);
	marginStars(root, d, { dark, count: 80, seed: 311 });

	const pt = pointer(d, () => lp.wake());
	let pe = 0;
	const lp = loop(
		(dt) => {
			const r = field.getBoundingClientRect();
			pe += (pt.energy - pe) * 0.12;
			const busy = W.tick(pt, pe, r.left, r.top);
			return pt.decay(dt) || busy || Math.abs(pe - pt.energy) > 0.004;
		},
		{ fps: 30, el: field, d },
	);
	return () => d.run();
}
