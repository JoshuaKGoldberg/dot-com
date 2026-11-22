import { createEngine, idleChain, isDark, GLAurora, RibbonAurora, addCanvas, sizeCanvas, Parallax, ridgeCanvas, edgeTrees, makePineVariants, forestGeo, paintForest, canvasLayer, ridgeGeo, Birds, cloudSprite, starCanvas, hex, rgba, rng } from "./_aurora-e/kit.js";

const PAL = {
	light: {
		far: { top: "#8fa9c2", bottom: "#d0dde6", shade: "#6483a3", lit: "#f0f4f6" },
		mid: { top: "#7a9bad", bottom: "#bdd1d6", shade: "#557890", lit: "#e6eef0" },
		midT: ["#628896", "#587f90", "#6d939d"],
		hill: { top: "#5b868b", bottom: "#86abaa", shade: "#3d6169" },
		hillT: ["#477470", "#3d6a68", "#507d77"],
		fg: ["#1f403a", "#18332f", "#244640"],
		mist: [255, 252, 244], bird: ["rgba(52,70,92,.55)", "rgba(36,52,74,.7)", "rgba(20,32,50,.85)"],
	},
	dark: {
		far: { top: "#2b3a68", bottom: "#41547e", shade: "#18234a", lit: "#5a6e99" },
		mid: { top: "#22305b", bottom: "#364a76", shade: "#131d40" },
		midT: ["#1b2a52", "#17244a", "#20315a"],
		hill: { top: "#192649", bottom: "#2a3c65", shade: "#0f1832" },
		hillT: ["#131f40", "#101a38", "#17254a"],
		fg: ["#060b1b", "#040815", "#081022"],
		mist: [150, 175, 225], bird: ["rgba(190,205,235,.5)", "rgba(200,214,240,.66)", "rgba(215,226,248,.82)"],
	},
};
const cv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? hex(v) : v]));

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const P = PAL[dark ? "dark" : "light"];
	const sceneryB = root.querySelector(".scenery-b");
	const sceneryC = root.querySelector(".scenery-c");
	const par = new Parallax();
	let gl = new GLAurora(sceneryB, { dark, scale: 0.5, fog: 1 });
	let fallback = null, fbCanvas = null, fbCtx = null;
	const useFallback = () => {
		if (fallback) return;
		gl.destroy();
		fallback = new RibbonAurora({ dark, rays: 0.12 });
		fbCanvas = addCanvas(sceneryB, "left:0;top:0;width:100%;height:100%");
		fbCtx = sizeCanvas(fbCanvas, eng.s.w, eng.s.h, 0.2);
		eng.wake();
	};
	gl.onFail = () => useFallback();
	let built = false;
	let starEl = null, birds = null, cancelBuild = () => {};

	const eng = createEngine({
		root, reduced: reducedMotion, host: sceneryB, rest: [0.64, 0.3], follow: 5,
		onResize(s) {
			if (gl.ok) gl.resize(s.w, s.h);
			if (fallback) fbCtx = sizeCanvas(fbCanvas, s.w, s.h, 0.2);
			if (built) { rebuild(s); }
		},
		onFrame(s) {
			if (!gl.ok && !fallback) useFallback();
			const idleTick = !s.busy && !s.force;
			if (!idleTick || s.tick % 2 === 0) {
				const T = s.drift * 0.7 + s.phase * 3 + 20;
				if (gl.ok) gl.draw(T, s.energy, s.x / s.w, s.y / s.h);
				else if (fallback) fallback.draw(fbCtx, fbCanvas.width, fbCanvas.height, { cx: s.x * 0.2, cy: s.y * 0.2, phase: s.phase + s.drift * 0.1, scale: 0.2 });
			}
			par.apply(s);
			if (birds && !reducedMotion) { birds.update(s.dt || 0.033, { x: s.x, y: s.y }); birds.draw(); }
			return !!birds && !reducedMotion;
		},
	});
	const layersHost = document.createElement("div");
	layersHost.style.cssText = "position:absolute;inset:0;pointer-events:none";
	sceneryC.appendChild(layersHost);

	function rebuild(s) {
		cancelBuild();
		layersHost.textContent = "";
		par.items = [];
		const { w, h } = s;
		const dpr = Math.min(s.dpr, 1.25);
		const variants = makePineVariants(91, 8);
		const q = { far: cv(P.far), mid: cv(P.mid), hill: cv(P.hill) };
		const mt = P.midT.map(hex), ht = P.hillT.map(hex);
		const add = (el, depth) => { layersHost.appendChild(el); par.add(el, depth); return el; };
		const mistEl = (cls, top, hh) => {
			const m = document.createElement("canvas");
			const sp = cloudSprite(700, 130, cls === "a" ? 5 : 17, P.mist, dark ? 0.2 : 0.45);
			m.width = 700; m.height = 130;
			m.getContext("2d").drawImage(sp, 0, 0);
			m.className = `ae-mist ${cls}`;
			m.style.top = top;
			m.style.height = hh;
			return m;
		};
		const tasks = [
			() => {
				if (!dark) return;
				starEl = starCanvas({ w: Math.round(w * 1.1), h: Math.round(h * 0.55), count: 140 });
				starEl.style.cssText = `position:absolute;left:${-w * 0.05}px;top:0;opacity:.8`;
				add(starEl, 3);
			},
			() => add(ridgeCanvas({ w, h, dpr, geo: { baseY: h * 0.62, amp: h * 0.34, scale: w * 0.26, seed: 7, power: 1.15, x0: 2.3 }, pal: q.far }), 6),
			() => add(mistEl("a", "46%", "20%"), 9),
			() => add(ridgeCanvas({ w, h, dpr, geo: { baseY: h * 0.69, amp: h * 0.13, scale: w * 0.16, seed: 21, power: 1.2 }, pal: q.mid, variants, treeCols: mt, forest: { rows: 3, rowGap: 6, tree: [9, 15], gap: [4, 7], seed: 31 } }), 13),
			() => add(mistEl("b", "58%", "22%"), 18),
			() => add(ridgeCanvas({ w, h, dpr, geo: { baseY: h * 0.77, amp: h * 0.06, scale: w * 0.1, seed: 41, power: 1.1 }, pal: q.hill, variants, treeCols: ht, forest: { rows: 3, rowGap: 7, tree: [16, 26], gap: [5, 9], seed: 51 } }), 24),
			() => {
				const mx = 70, lw = w + mx * 2, lh = h + 100;
				const lay = canvasLayer(lw, lh, dpr);
				const base = (x) => h * 0.9;
				const fg = P.fg.map(hex);
				const trees = [...edgeTrees({ w: lw, h, side: "l", n: 8, height: 0.52, reach: 0.26, seed: 3, ybase: () => h * 0.86 }), ...edgeTrees({ w: lw, h, side: "r", n: 7, height: 0.42, reach: 0.24, seed: 9, ybase: () => h * 0.88 })].map((t) => ({ ...t, x: t.x }));
				// grounds so trunks don't float
				lay.x.fillStyle = rgba(fg[1]);
				for (const [a, b, y] of [[0, 0.3, 0.86], [0.76, 1, 0.9]]) {
					lay.x.beginPath(); lay.x.moveTo(a * lw, lh);
					for (let x = a * lw; x <= b * lw; x += 12) lay.x.lineTo(x, h * y + 30 + Math.sin(x * 0.02) * 4 + (a === 0 ? (x / lw) * h * 0.1 : (1 - x / lw) * h * 0.1));
					lay.x.lineTo(b * lw, lh); lay.x.fill();
				}
				paintForest(lay.x, { trees, w: lw, h: lh }, variants, fg);
				lay.c.style.cssText = `position:absolute;left:${-mx}px;top:0;width:${lw}px;height:${lh}px`;
				add(lay.c, 52);
			},
			() => {
				if (!birds) birds = new Birds(sceneryC, { flocks: [{ seed: 3, groups: 3, perGroup: [5, 9], size: [3.6, 6.2], band: [0.1, 0.4], speed: [46, 78], respawn: [1.2, 6], flap: [6, 9] }], colors: P.bird, resident: 0 });
				birds.resize(w, h);
				birds.c.style.zIndex = 2;
				sceneryC.appendChild(birds.c);
				if (reducedMotion) { birds.settle(5); birds.draw(); }
			},
			() => { built = true; eng.start(); },
		];
		cancelBuild = idleChain(tasks);
	}
	const first = () => { rebuild(eng.s); };
	const cancelFirst = idleChain([first]);
	// show the aurora immediately
	eng.start();

	return () => {
		cancelFirst(); cancelBuild(); eng.destroy();
		(gl.ok || gl.gl) && gl.destroy();
		fbCanvas?.remove(); layersHost.remove(); birds?.c.remove();
	};
}
