import { createEngine, idleChain, isDark, GLAurora, RibbonAurora, addCanvas, sizeCanvas, Parallax, ridgeCanvas, makePineVariants, starCanvas, Birds, hex, rgba } from "./_aurora-e/kit.js";

const PAL = {
	light: {
		ridges: [
			{ top: "#aebfd6", bottom: "#dfe6ee", shade: "#93a8c4", lit: "#f6f4ee" },
			{ top: "#93aec5", bottom: "#cfdde4", shade: "#7a97b2", lit: "#ecf1f0" },
			{ top: "#7da1ad", bottom: "#bdd2d3", shade: "#5f8696" },
			{ top: "#628f94", bottom: "#9dbfb8", shade: "#48737c" },
		],
		trees: [["#7d9da6", "#7497a1", "#86a6ae"], ["#5f8b8a", "#568283", "#6a9693"], ["#47766f", "#3d6c67", "#4f7f77"]],
		canopy: ["#2c5a52", "#234c46", "#356a5f"],
		bird: ["rgba(45,55,70,.6)", "rgba(35,45,60,.75)", "rgba(25,32,45,.9)"],
	},
	dark: {
		ridges: [
			{ top: "#2e3d6c", bottom: "#46598a", shade: "#1b2650", lit: "#5f739f" },
			{ top: "#25345f", bottom: "#394e7e", shade: "#162049" },
			{ top: "#1c2a52", bottom: "#2e4270", shade: "#101a3b" },
			{ top: "#15204a", bottom: "#243764", shade: "#0c1330" },
		],
		trees: [["#1d2c56", "#192850", "#22335f"], ["#16234a", "#121e41", "#1a2a55"], ["#0f1a3a", "#0c1632", "#13204a"]],
		canopy: ["#070c1d", "#050914", "#0a1226"],
		bird: ["rgba(190,205,235,.5)", "rgba(200,214,240,.66)", "rgba(215,226,248,.82)"],
	},
};
const cv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? hex(v) : v]));
const WIDE = 1.3;

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const P = PAL[dark ? "dark" : "light"];
	const sceneryB = root.querySelector(".scenery-b");
	const sceneryC = root.querySelector(".scenery-c");
	const overlay = root.querySelector(".overlay-a");
	const par = new Parallax();
	// aurora panorama: a canvas wider than the window that pans with the pointer
	const auroraWrap = document.createElement("div");
	auroraWrap.style.cssText = `position:absolute;top:0;height:100%;width:${WIDE * 100}%;left:${-(WIDE - 1) * 50}%;pointer-events:none`;
	sceneryB.appendChild(auroraWrap);
	par.add(auroraWrap, 16, { scroll: 0.3, y: 0.05 });
	const gl = new GLAurora(auroraWrap, { dark, scale: 0.5, span: 1.5, fog: 0.5 });
	let fallback = null, fbCanvas = null, fbCtx = null;
	const useFallback = () => {
		if (fallback) return;
		gl.destroy();
		fallback = new RibbonAurora({ dark, rays: 0.15, span: 1.4 });
		fbCanvas = addCanvas(auroraWrap, "left:0;top:0;width:100%;height:100%");
		fbCtx = sizeCanvas(fbCanvas, eng.s.w * WIDE, eng.s.h, 0.2);
		eng.wake();
	};
	gl.onFail = useFallback;
	let built = false, birds = null, cancel = () => {};
	const layersHost = document.createElement("div");
	layersHost.style.cssText = "position:absolute;inset:0;pointer-events:none";
	sceneryC.appendChild(layersHost);
	let frame = null;

	const eng = createEngine({
		root, reduced: reducedMotion, host: sceneryB, rest: [0.6, 0.3], follow: 4,
		onResize(s) {
			if (gl.ok) gl.resize(s.w * WIDE, s.h);
			if (fallback) fbCtx = sizeCanvas(fbCanvas, s.w * WIDE, s.h, 0.2);
			if (built) rebuild(s);
		},
		onFrame(s) {
			if (!gl.ok && !fallback) useFallback();
			if (s.busy || s.force || s.tick % 2 === 0) {
				// cursor in the wide canvas, shifted by the current pan
				const panX = -s.px * 16 + (WIDE - 1) * 0.5 * s.w;
				const mxw = (s.x + panX * 0) / s.w;
				const fx = (s.x + (WIDE - 1) * 0.5 * s.w + s.px * 16) / (s.w * WIDE);
				const T = s.drift * 0.6 + s.phase * 3 + 40;
				if (gl.ok) gl.draw(T, s.energy, fx, s.y / s.h);
				else if (fallback) fallback.draw(fbCtx, fbCanvas.width, fbCanvas.height, { cx: fx * fbCanvas.width, cy: s.y * 0.2, phase: s.phase + s.drift * 0.1, scale: 0.2 });
			}
			par.apply(s);
			if (birds && !reducedMotion) { birds.update(s.dt || 0.033, { x: s.x, y: s.y }); birds.draw(); }
			return !!birds && !reducedMotion;
		},
	});

	function rebuild(s) {
		cancel();
		layersHost.textContent = "";
		for (let i = par.items.length - 1; i > 0; i--) par.items.splice(i, 1); // keep aurora wrap (index 0)
		const { w, h } = s;
		const variants = makePineVariants(260, 8);
		const add = (el, depth) => { layersHost.appendChild(el); par.add(el, depth, { scroll: 0.8 }); };
		const R = P.ridges.map(cv);
		const MX = 120;
		const tasks = [];
		if (dark) tasks.push(() => { const el = starCanvas({ w: Math.round(w * 1.2), h: Math.round(h * 0.5), count: 170, seed: 9 }); el.style.cssText = `position:absolute;left:${-w * 0.1}px;top:0;opacity:.85`; add(el, 6); });
		const spec = [
			{ baseY: 0.58, amp: 0.3, scale: 0.28, seed: 101, d: 10, forest: null },
			{ baseY: 0.65, amp: 0.2, scale: 0.2, seed: 117, d: 20, forest: { rows: 2, rowGap: 6, tree: [8, 12], gap: [4, 6], seed: 3 }, t: 0 },
			{ baseY: 0.73, amp: 0.12, scale: 0.15, seed: 133, d: 34, forest: { rows: 3, rowGap: 6, tree: [10, 16], gap: [4, 7], seed: 4 }, t: 1 },
			{ baseY: 0.81, amp: 0.07, scale: 0.1, seed: 149, d: 50, forest: { rows: 3, rowGap: 7, tree: [14, 22], gap: [5, 8], seed: 5 }, t: 2 },
		];
		spec.forEach((sp, i) => tasks.push(() => add(ridgeCanvas({ w, h, mx: MX, dpr: Math.min(s.dpr, 1.25), geo: { baseY: h * sp.baseY, amp: h * sp.amp, scale: w * sp.scale, seed: sp.seed, power: 1.15 }, pal: R[i], variants, treeCols: sp.forest ? P.trees[sp.t].map(hex) : null, forest: sp.forest }), sp.d)));
		tasks.push(() => { // treetop canopy just under the sill
			const el = ridgeCanvas({ w, h, mx: MX, dpr: Math.min(s.dpr, 1.25), geo: { baseY: h * 0.92, amp: h * 0.04, scale: w * 0.06, seed: 171, power: 1 }, pal: { top: hex(P.canopy[0]), bottom: hex(P.canopy[1]) }, variants, treeCols: P.canopy.map(hex), forest: { rows: 3, rowGap: 9, tree: [26, 40], gap: [6, 10], seed: 6 } });
			add(el, 72);
		});
		tasks.push(() => {
			if (!dark) {
				if (!birds) birds = new Birds(sceneryC, { flocks: [{ seed: 12, groups: 3, perGroup: [3, 6], size: [5, 9], band: [0.12, 0.4], speed: [30, 56], respawn: [2, 8], flap: [3, 6] }], colors: P.bird });
				birds.resize(w, h);
				sceneryC.appendChild(birds.c);
				if (reducedMotion) { birds.settle(6); birds.draw(); }
			}
			if (!frame) {
				frame = document.createElement("div");
				frame.className = "ft-frame";
				frame.innerHTML = '<i class="top"></i><i class="l"></i><i class="r"></i><i class="sill"></i><i class="b b1"></i><i class="b b2"></i><i class="b b3"></i><i class="b b4"></i>';
				overlay.appendChild(frame);
			}
		});
		tasks.push(() => { built = true; eng.start(); });
		cancel = idleChain(tasks);
	}
	const c1 = idleChain([() => rebuild(eng.s)]);
	eng.start();
	return () => { c1(); cancel(); eng.destroy(); gl.destroy(); fbCanvas?.remove(); auroraWrap.remove(); layersHost.remove(); frame?.remove(); birds?.c.remove(); };
}
