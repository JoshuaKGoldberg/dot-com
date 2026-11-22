/*
 * #276 Paper Bleed: faint paper grain, and a watercolor aurora that bleeds in
 * from the top-right corner only. The cursor pulls it slightly; movement
 * brightens it and the energy decays. CSS blobs, one small tiled grain image.
 */
import { clamp, disposer, grainTile, loop, pointer } from "./_quiet-d/kit.js";

export function activate({ root, mode, reducedMotion }) {
	const d = disposer();
	const dark = mode === "dark";
	const scenery = root.querySelector(".scenery-a");
	const wash = root.querySelector(".scenery-b");
	if (!scenery || !wash) return;

	const grain = document.createElement("div");
	grain.className = "qpb-grain";
	scenery.append(grain);
	const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
	const cancelIdle = window.cancelIdleCallback || clearTimeout;
	const job = idle(() => {
		grain.style.backgroundImage = `url(${grainTile(96, 276, dark, dark ? 9 : 10)})`;
		grain.classList.add("is-ready");
	});
	d.add(() => cancelIdle(job));

	const field = document.createElement("div");
	field.className = "qpb-wash";
	field.innerHTML = '<i class="qpb-b1"></i><i class="qpb-b2"></i><i class="qpb-b3"></i><i class="qpb-b4"></i>';
	wash.append(field);
	d.add(() => {
		grain.remove();
		field.remove();
	});
	if (reducedMotion) return () => d.run();

	const pt = pointer(d, () => lp.wake());
	let px = 0;
	let py = 0;
	let pe = 0;
	const lp = loop(
		(dt) => {
			const r = wash.getBoundingClientRect();
			// Pull toward the cursor, relative to the corner the wash bleeds from.
			const tx = pt.has ? clamp((pt.x - r.right) / 700, -1, 0.3) : 0;
			const ty = pt.has ? clamp((pt.y - r.top) / 700, -0.3, 1) : 0;
			px += (tx - px) * 0.08;
			py += (ty - py) * 0.08;
			pe += (pt.energy - pe) * 0.12;
			field.style.transform = `translate3d(${(px * 26).toFixed(1)}px, ${(py * 22).toFixed(1)}px, 0)`;
			field.style.opacity = (1 + pe * 0.7).toFixed(3);
			const moving = pt.decay(dt);
			return moving || Math.abs(pe - pt.energy) > 0.004 || Math.abs(px - tx) > 0.003 || Math.abs(py - ty) > 0.003;
		},
		{ fps: 30, el: field, d },
	);
	return () => d.run();
}
