/* Shared #313 base for the wave-14 delight themes: calm header + paper footer. */
import { buildWashes, disposer, fullBleed, grainLayer, isDark, loop, pointer, whenVisible } from "../_refined-d/kit.js";
import { calmAurora } from "./aurora.js";
export { disposer, isDark };

export function paperBase(root, reducedMotion, d, seed) {
	const dark = isDark();
	calmAurora(root, d, { reducedMotion });
	const footer = root.querySelector(".site-footer");
	if (!footer) return { dark };
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
	const g = grainLayer(deco, "rp-grain rpf-grain", dark, seed);
	d.add(g.cancel);
	const ro = new ResizeObserver(() => W.measure());
	ro.observe(deco);
	d.add(() => ro.disconnect());
	const pt = pointer(d, () => { if (live) lp.wake(); });
	let live = false, pe = 0;
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
	return { dark };
}
