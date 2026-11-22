import { isDark, trackPointer, topWash, clamp } from "./_quiet-b/kit.js";

const RADIUS = 240;

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const ptr = trackPointer(() => wake());
	const wash = topWash(root.querySelector(".site-scenery .scenery-a"), { dark, height: 84, alpha: dark ? 0.3 : 0.2, reduced: reducedMotion, ptr });
	const links = [...root.querySelectorAll(".site-link")];
	let raf = 0, last = 0, lit = new Set();

	const frame = (now) => {
		raf = 0;
		const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
		last = now;
		ptr.step(dt);
		const r = RADIUS * (1 + ptr.energy * 0.7);
		const next = new Set();
		if (ptr.has) {
			for (const a of links) {
				const b = a.getBoundingClientRect();
				if (b.bottom < -20 || b.top > innerHeight + 20) continue;
				const cx = clamp(ptr.sx, b.left, b.right), cy = clamp(ptr.sy, b.top, b.bottom + 6);
				const d = Math.hypot(ptr.sx - cx, ptr.sy - cy);
				const p = clamp(1 - d / r) ** 1.5 * (0.55 + 0.45 * ptr.energy + 0.0);
				if (p > 0.01) {
					a.style.setProperty("--qa-p", p.toFixed(3));
					// lean: the hue window slides with the pointer's position along the link
					a.style.setProperty("--qa-x", clamp((ptr.sx - b.left) / Math.max(1, b.width)).toFixed(2));
					next.add(a);
				}
			}
		}
		for (const a of lit) if (!next.has(a)) a.style.removeProperty("--qa-p");
		lit = next;
		if (ptr.busy() || ptr.has && lit.size) raf = requestAnimationFrame(frame);
		else last = 0;
	};
	function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); wash.wake(); }
	const onScroll = () => { if (ptr.has) wake(); };
	root.addEventListener("scroll", onScroll, { passive: true });

	return () => {
		cancelAnimationFrame(raf);
		root.removeEventListener("scroll", onScroll);
		for (const a of links) a.style.removeProperty("--qa-p"), a.style.removeProperty("--qa-x");
		ptr.destroy();
		wash.destroy();
	};
}
