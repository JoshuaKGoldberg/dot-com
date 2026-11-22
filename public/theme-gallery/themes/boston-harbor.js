import { el, rng } from "./two-skies-one-shore/lib.js";

const W = 1600;
const H = 320;
const HZ = 232; // harbor line

export function activate({ root }) {
	const b = root.querySelector(".scenery-b");
	const rand = rng(1630);
	const svg = el("svg", { class: "harbor-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMax slice" }, b);

	const defs = el("defs", {}, svg);
	const lg = el("linearGradient", { id: "bh-water", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
	el("stop", { offset: 0, style: "stop-color: var(--water-top)" }, lg);
	el("stop", { offset: 1, style: "stop-color: var(--water-bot)" }, lg);

	const hancockX = 1010;
	const pruX = 640;
	const keepOut = (x, w) => (x + w > hancockX - 20 && x < hancockX + 70) || (x + w > pruX - 40 && x < pruX + 70);

	// Generate a layer of flat rectangular buildings (some stepped).
	function layer(cls, { hMin, hMax, wMin, wMax, skipTowers }) {
		const rects = [];
		let x = -20;
		while (x < W + 20) {
			const w = wMin + rand() * (wMax - wMin);
			if (skipTowers && keepOut(x, w)) {
				x += w;
				continue;
			}
			const h = hMin + Math.pow(rand(), 1.6) * (hMax - hMin);
			rects.push({ x, w, h });
			// occasional setback crown
			if (h > hMin + (hMax - hMin) * 0.45 && rand() < 0.5) rects.push({ x: x + w * 0.2, w: w * 0.6, h: h + 8 + rand() * 12 });
			x += w + (rand() < 0.3 ? 2 + rand() * 6 : 0);
		}
		const g = el("g", { class: cls }, svg);
		for (const r of rects) el("rect", { x: r.x.toFixed(1), y: (HZ - r.h).toFixed(1), width: r.w.toFixed(1), height: r.h.toFixed(1) }, g);
		return { g, rects };
	}

	// Water + reflection first (behind skyline).
	el("rect", { class: "water", x: 0, y: HZ, width: W, height: H - HZ }, svg);

	const far = layer("far", { hMin: 14, hMax: 44, wMin: 14, wMax: 34, skipTowers: false });
	const mid = layer("mid", { hMin: 12, hMax: 62, wMin: 20, wMax: 50, skipTowers: true });

	// Prudential-like: wide podium, tall square shaft, stepped crown, mast.
	const pru = el("g", { class: "mid" }, svg);
	el("rect", { x: pruX - 22, y: HZ - 40, width: 74, height: 40 }, pru);
	el("rect", { x: pruX - 4, y: HZ - 150, width: 38, height: 112 }, pru);
	el("rect", { x: pruX, y: HZ - 160, width: 30, height: 12 }, pru);
	el("rect", { x: pruX + 5, y: HZ - 170, width: 20, height: 12 }, pru);
	el("rect", { x: pruX + 11, y: HZ - 176, width: 8, height: 8 }, pru);
	el("rect", { x: pruX + 14.4, y: HZ - 206, width: 1.2, height: 32 }, pru);

	// Hancock-like: slim slanted slab with sheared facade and a seam.
	const han = el("g", { class: "mid" }, svg);
	const hx = hancockX;
	el("path", { d: `M${hx} ${HZ}L${hx + 2} ${HZ - 166}L${hx + 46} ${HZ - 180}L${hx + 40} ${HZ}Z` }, han);
	el("path", { class: "seam", d: `M${hx + 24} ${HZ - 173}L${hx + 20} ${HZ}` }, han);

	const near = layer("near", { hMin: 6, hMax: 24, wMin: 24, wMax: 70, skipTowers: false });

	// Warm window dots on the mid layer and the two towers; slow random blinks.
	const winG = el("g", {}, svg);
	const addWin = (x, y) => {
		const w = el("rect", { class: "win", x: x.toFixed(1), y: y.toFixed(1), width: 1.6, height: 1.9 }, winG);
		w.style.setProperty("--d", `${(9 + rand() * 14).toFixed(1)}s`);
		w.style.setProperty("--dl", `${(-rand() * 20).toFixed(1)}s`);
		w.style.setProperty("--wo", (0.4 + rand() * 0.4).toFixed(2));
	};
	for (const r of mid.rects) {
		const n = Math.floor((r.w * r.h) / 130);
		for (let i = 0; i < n; i++) addWin(r.x + 2 + rand() * (r.w - 5), HZ - r.h + 3 + rand() * (r.h - 8));
	}
	for (const [tx, tw, th] of [[pruX, 30, 142], [hx + 6, 32, 160]]) {
		for (let i = 0; i < 26; i++) addWin(tx + 2 + rand() * (tw - 5), HZ - th + 4 + rand() * (th - 10));
	}

	// Harbor line and a faint flipped reflection.
	el("path", { class: "hline", d: `M0 ${HZ}H${W}` }, svg);
	const refl = el("g", { class: "refl", transform: `translate(0 ${HZ * 2}) scale(1 -1)` }, svg);
	for (const r of mid.rects) {
		el("rect", { x: r.x.toFixed(1), y: (HZ - Math.min(r.h, 40) * 0.8).toFixed(1), width: r.w.toFixed(1), height: (Math.min(r.h, 40) * 0.8).toFixed(1) }, refl);
	}
	el("rect", { x: pruX - 4, y: HZ - 56, width: 38, height: 56 }, refl);
	el("path", { d: `M${hx} ${HZ}L${hx + 4} ${HZ - 56}L${hx + 44} ${HZ - 56}L${hx + 38} ${HZ}Z` }, refl);

	// Horizontal glints on the water.
	for (let i = 0; i < 26; i++) {
		const y = HZ + 6 + Math.pow(rand(), 1.2) * (H - HZ - 10);
		const x = rand() * W;
		const l = 18 + rand() * 70;
		el("path", { class: "glint", d: `M${x.toFixed(0)} ${y.toFixed(0)}h${l.toFixed(0)}`, "stroke-width": 1, opacity: (0.3 + rand() * 0.5).toFixed(2) }, svg);
	}
}
