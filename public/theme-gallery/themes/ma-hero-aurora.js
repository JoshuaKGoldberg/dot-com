// #300 Hero Aurora: a soft aurora halo behind the portrait that spills into the sky above, leaning to the cursor.
// The canvas lives inside the hero, so it scrolls away with the page.
import { createRig, GLCanvas, HALO_FS, idle } from "./_medium-e/kit.js";

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const hero = root.querySelector(".site-hero");
	const portrait = root.querySelector(".site-portrait");
	if (!hero || !portrait) return;
	const wrap = document.createElement("div");
	wrap.className = "ma-hero-halo";
	wrap.setAttribute("aria-hidden", "true");
	hero.prepend(wrap);
	const gl = new GLCanvas(wrap, HALO_FS, { scale: 0.45 });
	let rig = null, ro = null, rect = null, C = [0.5, 0.6], RADU = 0.2;

	const layout = () => {
		const h = hero.getBoundingClientRect(), p = portrait.getBoundingClientRect();
		const rad = p.width / 2, cx = p.left - h.left + rad, cy = p.top - h.top + p.height / 2;
		const W = rad * 5.2, up = rad * 2.5, down = rad * 1.1, H = up + down;
		wrap.style.cssText = `left:${cx - W / 2}px;top:${cy - up}px;width:${W}px;height:${H}px`;
		C = [0.5, up / H]; RADU = rad / H;
		gl.resize(W, H);
		rect = wrap.getBoundingClientRect();
	};
	const cancelIdle = idle(() => {
		if (!gl.ok) { wrap.classList.add("is-fallback"); layout(); return; }
		layout();
		rig = createRig({
			reduced: reducedMotion, targets: [hero], fps: 22, rest: [0.5, 0.1],
			onFrame(s) {
				rect = wrap.getBoundingClientRect();
				const mx = (s.x - rect.left) / rect.width, my = (s.y - rect.top) / rect.height;
				gl.draw({ T: s.t + 8, E: s.energy, DK: dark ? 1 : 0, AMP: dark ? 1.4 : 1.5, M: s.has ? [mx, my] : [0.5, -0.4], C, RAD: RADU });
			},
		});
		const onScroll = () => { if (rig.s.has) rig.wake(); };
		root.addEventListener("scroll", onScroll, { passive: true });
		ro = new ResizeObserver(() => { layout(); rig.redraw(); });
		ro.observe(hero);
		rig.start();
		cleanup = () => root.removeEventListener("scroll", onScroll);
	});
	let cleanup = () => {};
	return () => { cancelIdle(); cleanup(); ro?.disconnect(); rig?.destroy(); gl.destroy(); wrap.remove(); };
}
