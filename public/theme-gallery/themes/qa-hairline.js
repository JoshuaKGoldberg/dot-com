import { createPainter, createPointer, createLoop, mk, onSize } from "./_quiet-a/kit.js";

export function activate({ root, mode, reducedMotion }) {
	const wrap = mk("div", "qa-hairline");
	wrap.setAttribute("aria-hidden", "true");
	const canvas = mk("canvas", "", wrap);
	root.prepend(wrap);
	const dark = mode === "dark" || document.documentElement.classList.contains("dark");
	const painter = createPainter(canvas, {
		dark,
		profile: { c0: 0.08, amp: 0.05, sig: 0.2, fade: 1.4, gain: 1.05, reach: 420, pullX: 0.14, maxA: dark ? 0.5 : 0.3 },
	});
	const ptr = createPointer(() => loop.wake());
	const size = () => {
		painter.setSize(wrap.clientWidth, wrap.clientHeight, 6);
		loop.once();
	};
	const loop = createLoop(wrap, (t) => painter.draw(t, wrap.getBoundingClientRect(), ptr), { fps: 20, reduced: reducedMotion, ptr });
	const off = onSize([wrap], size);
	size();
	return () => {
		off();
		loop.destroy();
		ptr.destroy();
		wrap.remove();
	};
}
