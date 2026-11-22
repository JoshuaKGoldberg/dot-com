// #297 Fog Band: a volumetric, fog-soft WebGL aurora band across the top, bent by the cursor.
import { createRig, GLCanvas, BAND_FS, idle, scrollAway } from "./_medium-e/kit.js";

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const host = root.querySelector(".scenery-b") ?? root;
	const wrap = document.createElement("div");
	wrap.className = "ma-fog-band";
	wrap.setAttribute("aria-hidden", "true");
	host.appendChild(wrap);
	const gl = new GLCanvas(wrap, BAND_FS, { scale: 0.32 });
	let cancelIdle = () => {}, rig = null;
	const unscroll = scrollAway(root, wrap, { rate: 0.6, fade: 420 });

	const size = () => { const r = wrap.getBoundingClientRect(); gl.resize(r.width, r.height); return r; };
	cancelIdle = idle(() => {
		if (!gl.ok) { wrap.classList.add("is-fallback"); return; }
		let rect = size();
		rig = createRig({
			reduced: reducedMotion, targets: [wrap], fps: 22, rest: [0.64, 0.12],
			onFrame(s) {
				const mx = (s.x - rect.left) / rect.width, my = (s.y - rect.top) / rect.height;
				gl.draw({ T: s.t + 30, E: s.energy, DK: dark ? 1 : 0, AMP: dark ? 0.62 : 0.85, FOG: 1, RAYS: 0.8, WAVE: 0.8, LOWF: 0.3, BASE: -0.1, FADE: 0.12, HGT: 0.5, WX: rect.width / 900, M: [mx, my] });
			},
		});
		gl.onFail = () => wrap.classList.add("is-fallback");
		const ro = new ResizeObserver(() => { rect = size(); rig.redraw(); });
		ro.observe(wrap);
		rig.start();
		cleanup = () => { ro.disconnect(); rig.destroy(); };
	});
	let cleanup = () => {};
	return () => { cancelIdle(); unscroll(); cleanup(); gl.destroy(); wrap.remove(); };
}
