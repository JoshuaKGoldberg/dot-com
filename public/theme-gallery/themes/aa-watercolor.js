import { createEngine, idleChain, isDark, addCanvas, sizeCanvas, Parallax, ridgeCanvas, edgeTrees, makePineVariants, paintForest, canvasLayer, Birds, rng, hex, rgba, lerp, clamp, TAU } from "./_aurora-e/kit.js";

const PIG = {
	dark: [[70, 255, 175], [70, 190, 255], [180, 120, 255], [255, 110, 160]],
	light: [[60, 175, 140], [80, 150, 205], [160, 115, 200], [225, 120, 150]],
};
const PAL = {
	light: {
		far: { top: "#a9bccb", bottom: "#e2e4e0", shade: "#8aa0b4", lit: "#f6f0e4" },
		mid: { top: "#8fb0b4", bottom: "#d0ddd5", shade: "#6f9298", lit: null },
		midT: ["#6f9a97", "#668f90", "#78a39d"],
		hill: { top: "#6d9a94", bottom: "#a4c3b6", shade: "#4c7a78" },
		hillT: ["#4f827a", "#46786f", "#58897f"],
		fg: ["#2a5a55", "#1f4a48", "#336b62"],
		bird: ["rgba(70,70,100,.5)", "rgba(55,55,90,.65)", "rgba(40,40,80,.8)"],
	},
	dark: {
		far: { top: "#2a3566", bottom: "#3d4c80", shade: "#1b2552", lit: "#566596" },
		mid: { top: "#1f2c5c", bottom: "#33467a", shade: "#131c46" },
		midT: ["#1a2751", "#16234b", "#1f2f5c"],
		hill: { top: "#18254f", bottom: "#293c6c", shade: "#0f1838" },
		hillT: ["#12204a", "#0f1b40", "#172a56"],
		fg: ["#0a1230", "#070d26", "#0d1a3c"],
		bird: ["rgba(190,205,235,.5)", "rgba(200,214,240,.66)", "rgba(215,226,248,.82)"],
	},
};
const cv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? hex(v) : v]));

// Paper grain: baked once into a small tile.
function paperTile(dark) {
	const N = 192, c = document.createElement("canvas");
	c.width = c.height = N;
	const x = c.getContext("2d"), r = rng(12);
	const img = x.createImageData(N, N);
	for (let i = 0; i < N * N; i++) {
		const v = r();
		const light = v > 0.5;
		const a = Math.abs(v - 0.5) * (dark ? 0.1 : 0.14);
		img.data.set(light ? (dark ? [200, 210, 255, a * 255] : [255, 255, 255, a * 255 * 1.4]) : (dark ? [0, 0, 20, a * 255] : [120, 95, 60, a * 255]), i * 4);
	}
	x.putImageData(img, 0, 0);
	x.lineWidth = 0.6;
	for (let i = 0; i < 60; i++) { // fibres
		x.strokeStyle = dark ? "rgba(180,190,240,.05)" : "rgba(110,90,60,.07)";
		const px = r() * N, py = r() * N, a = r() * TAU, l = 4 + r() * 10;
		x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + 2, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
	}
	return c.toDataURL("image/png");
}

function strokeSprite(rgb, a, wide) {
	const W = 64, H = 128, c = document.createElement("canvas");
	c.width = W; c.height = H;
	const x = c.getContext("2d");
	x.translate(W / 2, H / 2); x.scale(1, H / W);
	const g = x.createRadialGradient(0, 0, 0, 0, 0, W / 2);
	g.addColorStop(0, rgba(rgb, a * 0.55));
	g.addColorStop(0.6, rgba(rgb, a * 0.5));
	g.addColorStop(0.8, rgba(rgb, a * 0.75)); // pigment pools at the edge
	g.addColorStop(1, rgba(rgb, 0));
	x.fillStyle = g; x.fillRect(-W / 2, -W / 2, W, W);
	return c;
}

function dabSprite(rgb, a) {
	const W = 64, c = document.createElement("canvas");
	c.width = W; c.height = 128;
	const x = c.getContext("2d");
	x.translate(W / 2, 64); x.scale(1, 2);
	const g = x.createRadialGradient(0, 0, 0, 0, 0, W / 2);
	g.addColorStop(0, rgba(rgb, a * 0.6)); g.addColorStop(0.5, rgba(rgb, a * 0.25)); g.addColorStop(1, rgba(rgb, 0));
	x.fillStyle = g; x.fillRect(-W / 2, -W / 2, W, W);
	return c;
}

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const P = PAL[dark ? "dark" : "light"];
	const pig = PIG[dark ? "dark" : "light"];
	const sceneryB = root.querySelector(".scenery-b");
	const sceneryC = root.querySelector(".scenery-c");
	const overlay = root.querySelector(".overlay-a");
	const par = new Parallax();
	const SC = 0.3;
	const cA = addCanvas(sceneryB, "left:0;top:0;width:100%;height:100%");
	const cT = document.createElement("canvas"); // pigment pulled by the cursor
	let ctxA, ctxT;
	const A = dark ? 0.11 : 0.15;
	const bands = pig.map((c) => ({ stroke: strokeSprite(c, A, true), dab: dabSprite(c, A * 1.2) }));
	const rnd = rng(8);
	const seeds = pig.map(() => [rnd() * 6, rnd() * 6, rnd() * 6]);
	const strokes = pig.map(() => Array.from({ length: 140 }, () => [rnd(), rnd(), rnd()]));
	let paper = null, built = false, birds = null, cancel = () => {}, prev = null, hue = 0;
	const layersHost = document.createElement("div");
	layersHost.style.cssText = "position:absolute;inset:0;pointer-events:none";
	sceneryC.appendChild(layersHost);

	function draw(s) {
		const W = cA.width, H = cA.height, sc = W / s.w;
		const ctx = ctxA;
		ctx.clearRect(0, 0, W, H);
		ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
		const sig = W * 0.17, cx = s.x * sc, cy = s.y * sc, ph = s.phase + s.drift * 0.06;
		for (let b = 0; b < bands.length; b++) {
			const [s0, s1, s2] = seeds[b];
			const n = Math.ceil(s.w / 13);
			for (let i = 0; i < n; i++) {
				const j = strokes[b][i % 140];
				const xcss = i * 13 + (j[0] - 0.5) * 10, u = xcss / s.w;
				const x = xcss * sc, dxc = x - cx;
				const g = Math.exp(-(dxc * dxc) / (2 * sig * sig));
				let by = s.h * (0.17 + b * 0.065) + 40 * Math.sin(u * 3.2 + s0 + ph * 0.55) + 22 * Math.sin(u * 7.1 + s1 - ph * 0.8);
				let byy = by * sc;
				byy += (cy + 40 * sc - byy) * 0.4 * g;
				const hg = (130 + 60 * Math.sin(u * 4.7 + s2 + ph * 0.4) + 80 * j[1] + 170 * g) * sc;
				const wd = (90 + 60 * j[2]) * sc;
				ctx.globalAlpha = clamp((0.5 + (dark ? 0.3 : 0.55) * g) * (1 - 0.1 * b) * (0.7 + 0.4 * j[1]), 0, 1);
				ctx.drawImage(bands[b].stroke, x - dxc * 0.28 * g - wd / 2, byy - hg * 0.72, wd, hg);
			}
		}
		// pigment trail
		if (ctxT) {
			if (prev && s.speed > 30) {
				const d = Math.hypot(s.x - prev[0], s.y - prev[1]);
				const k = Math.max(1, Math.min(8, Math.ceil(d / 14)));
				for (let q = 1; q <= k; q++) {
					const x = lerp(prev[0], s.x, q / k) * sc, y = lerp(prev[1], s.y, q / k) * sc;
					hue = (hue + 0.045) % bands.length;
					const bd = bands[Math.floor(hue)];
					const r = (80 + Math.min(70, s.speed * 0.06)) * sc;
					ctxT.globalAlpha = 0.4;
					ctxT.drawImage(bd.dab, x - r, y - r * 1.2, r * 2, r * 2.4);
				}
			}
			prev = [s.x, s.y];
			ctxT.globalAlpha = 1;
			ctxT.globalCompositeOperation = "destination-out";
			ctxT.fillStyle = `rgba(0,0,0,${s.reduced ? 0.5 : 0.022})`;
			ctxT.fillRect(0, 0, W, H);
			ctxT.globalCompositeOperation = "source-over";
			ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
			ctx.globalAlpha = 0.8;
			ctx.drawImage(cT, 0, 0);
		}
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
	}

	const eng = createEngine({
		root, reduced: reducedMotion, host: sceneryB, rest: [0.64, 0.3], follow: 4,
		onResize(s) {
			ctxA = sizeCanvas(cA, s.w, s.h, SC);
			ctxT = sizeCanvas(cT, s.w, s.h, SC);
			if (built) rebuild(s);
		},
		onFrame(s) {
			if (!s.busy && !s.force && s.tick % 2) { /* skip aurora on odd idle ticks */ } else draw(s);
			par.apply(s);
			if (birds && !reducedMotion) { birds.update(s.dt || 0.033, { x: s.x, y: s.y }); birds.draw(); }
			return !!birds && !reducedMotion;
		},
	});

	function paintTrees(lay, trees, variants, cols) {
		const x = lay.x;
		for (let pass = 0; pass < 3; pass++) {
			x.save();
			x.translate((pass - 1) * 1.6, (pass % 2) * 1.2 - 0.6);
			x.globalAlpha = 0.55;
			const jitter = cols.map((c) => c.map((v) => clamp(v + (pass - 1) * 10, 0, 255)));
			paintForest(x, { trees, w: lay.w, h: lay.h }, variants, jitter);
			x.restore();
		}
	}
	function rebuild(s) {
		cancel();
		layersHost.textContent = "";
		par.items = [];
		const { w, h } = s;
		const variants = makePineVariants(257, 8);
		const q = { far: cv(P.far), mid: cv(P.mid), hill: cv(P.hill) };
		const add = (el, depth) => { layersHost.appendChild(el); par.add(el, depth); };
		const soft = 0.6;
		cancel = idleChain([
			() => add(ridgeCanvas({ w, h, dpr: soft, geo: { baseY: h * 0.64, amp: h * 0.32, scale: w * 0.25, seed: 17, power: 1.2, x0: 1.3 }, pal: q.far }), 6),
			() => add(ridgeCanvas({ w, h, dpr: soft, geo: { baseY: h * 0.7, amp: h * 0.12, scale: w * 0.16, seed: 29, power: 1.2 }, pal: q.mid, variants, treeCols: P.midT.map(hex), forest: { rows: 3, rowGap: 6, tree: [9, 15], gap: [4, 7], seed: 31 } }), 13),
			() => add(ridgeCanvas({ w, h, dpr: 0.8, geo: { baseY: h * 0.78, amp: h * 0.055, scale: w * 0.1, seed: 43, power: 1.1 }, pal: q.hill, variants, treeCols: P.hillT.map(hex), forest: { rows: 3, rowGap: 7, tree: [16, 26], gap: [5, 9], seed: 52 } }), 22),
			() => {
				const mx = 70, lw = w + mx * 2, lh = h + 100, dpr = Math.min(s.dpr, 1.25);
				const lay = canvasLayer(lw, lh, dpr);
				const fg = P.fg.map(hex);
				const trees = [...edgeTrees({ w: lw, h, side: "l", n: 8, height: 0.52, reach: 0.26, seed: 5, ybase: () => h * 0.86 }), ...edgeTrees({ w: lw, h, side: "r", n: 7, height: 0.42, reach: 0.24, seed: 11, ybase: () => h * 0.88 })];
				lay.x.fillStyle = rgba(fg[1], 0.9);
				for (const [a, b, y] of [[0, 0.3, 0.86], [0.76, 1, 0.9]]) {
					lay.x.beginPath(); lay.x.moveTo(a * lw, lh);
					for (let x = a * lw; x <= b * lw; x += 12) lay.x.lineTo(x, h * y + 30 + Math.sin(x * 0.02) * 4 + (a === 0 ? (x / lw) * h * 0.1 : (1 - x / lw) * h * 0.1));
					lay.x.lineTo(b * lw, lh); lay.x.fill();
				}
				paintTrees(lay, trees, variants, fg);
				lay.c.style.cssText = `position:absolute;left:${-mx}px;top:0;width:${lw}px;height:${lh}px`;
				add(lay.c, 50);
			},
			() => {
				if (!birds) birds = new Birds(sceneryC, { flocks: [{ seed: 7, groups: 2, perGroup: [4, 7], size: [3.8, 6], band: [0.1, 0.35], speed: [40, 66], respawn: [2, 7], flap: [5, 8] }], colors: P.bird });
				birds.resize(w, h);
				sceneryC.appendChild(birds.c);
				if (reducedMotion) { birds.settle(5); birds.draw(); }
			},
			() => { built = true; eng.start(); },
		]);
	}
	const c1 = idleChain([
		() => {
			paper = document.createElement("div");
			paper.className = "ae-paper";
			paper.style.backgroundImage = `url(${paperTile(dark)})`;
			overlay.appendChild(paper);
		},
		() => rebuild(eng.s),
	]);
	eng.start();
	return () => { c1(); cancel(); eng.destroy(); cA.remove(); layersHost.remove(); paper?.remove(); birds?.c.remove(); };
}
