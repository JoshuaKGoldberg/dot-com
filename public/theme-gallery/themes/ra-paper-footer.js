/*
 * #313 Paper Footer: #276 grain and blurry pastel gradients live only in the
 * footer, running (and leaning toward the cursor) only while it is on screen.
 * Level-1 raised aurora at the top, margin stars at night.
 */
import { buildWashes, disposer, fullBleed, grainLayer, isDark, loop, marginStars, pointer, raisedAurora, whenVisible } from "./_refined-d/kit.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const dark = isDark();
	raisedAurora(root, 1, d);
	marginStars(root, d, { dark, count: 70, seed: 313 });

	const footer = root.querySelector(".site-footer");
	if (!footer) return () => d.run();
	const deco = document.createElement("div");
	deco.className = "rpf";
	footer.prepend(deco);
	d.add(() => deco.remove());
	fullBleed(root, footer, deco, d);

	const W = buildWashes(deco, [
		{ cls: "rpf-1 rp-teal", depth: 0.9, k: 0.05 },
		{ cls: "rpf-2 rp-lilac", depth: 1, k: 0.05 },
		{ cls: "rpf-3 rp-pink", depth: 0.8, k: 0.05 },
		{ cls: "rpf-4 rp-mint", depth: 1, k: 0.05 },
		{ cls: "rpf-5 rp-sky", depth: 1.2, k: 0.05 },
		{ cls: "rpf-6 rp-peach", depth: 1.2, k: 0.05 },
	]);
	const g = grainLayer(deco, "rp-grain rpf-grain", dark, 313);
	d.add(g.cancel);
	const meas = () => W.measure();
	const ro = new ResizeObserver(meas);
	ro.observe(deco);
	d.add(() => ro.disconnect());

	const pt = pointer(d, () => { if (live) lp.wake(); });
	let live = false;
	let pe = 0;
	const lp = loop(
		(dt) => {
			const r = deco.getBoundingClientRect();
			pe += (pt.energy - pe) * 0.12;
			const busy = W.tick(pt, pe, r.left, r.top, "x");
			return pt.decay(dt) || busy || Math.abs(pe - pt.energy) > 0.004;
		},
		{ fps: 30, el: deco, d },
	);
	whenVisible(root, footer, (v) => {
		live = v;
		deco.classList.toggle("is-live", v && !reducedMotion);
		if (v) lp.wake();
	}, d);
	return () => d.run();
}
