/*
 * #312 Paper Sides: #276 grain and soft gradient washes in the side margins
 * only. They breathe, lean toward the cursor and brighten when it passes;
 * a level-1 raised aurora sits at the top.
 */
import { buildWashes, disposer, grainLayer, isDark, loop, pointer, raisedAurora } from "./_refined-d/kit.js";

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
		{ cls: "rp-s1 rp-teal", depth: 1, k: 0.07 },
		{ cls: "rp-s2 rp-lilac", depth: 1.1, k: 0.07 },
		{ cls: "rp-s3 rp-pink", depth: 0.9, k: 0.07 },
		{ cls: "rp-s4 rp-lilac", depth: 1, k: 0.07 },
		{ cls: "rp-s5 rp-teal", depth: 1.1, k: 0.07 },
		{ cls: "rp-s6 rp-mint", depth: 0.9, k: 0.07 },
	]);
	const g = grainLayer(scenery, "rp-grain rp-side-grain", dark);
	d.add(() => { g.cancel(); g.el.remove(); });
	W.measure();
	d.on(window, "resize", W.measure, { passive: true });

	raisedAurora(root, 1, d);

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
