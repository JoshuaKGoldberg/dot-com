// #286 Quiet Winter: light snowfall in the margins, frosted ridges along the bottom, a soft aurora on top.
import { addAurora, canvasAt, clamp, disposer, el, hex, mix, paintRidge, pine, pointer, rgba, rng, scrollT, ticker, TAU } from "./_medium-b/kit.js";

export function activate({ root, mode, reducedMotion }) {
	const d = disposer();
	const dark = mode === "dark";
	const sceneryA = root.querySelector(".scenery-a");
	const overlay = root.querySelector(".overlay-a");
	if (!sceneryA || !overlay) return;
	addAurora(d, root, { dark, reduced: reducedMotion, height: "56%", intensity: dark ? 1.05 : 1.1 });
	const wrap = el(sceneryA, "inset:0;overflow:hidden");
	let layers = [], snowC = [], flakes = [], W = 0, H = 0, EW = 0, sy = 0, px = 0;
	const r = rng(286);

	// light: frosted pastels; dark: deep blue ridges with pale frost on the crests
	const PAL = dark
		? [
			{ top: "#1c2f55", bottom: "#132240", cap: "#a8c4ea", capA: 0.45, a: 0.95 },
			{ top: "#26406d", bottom: "#182a50", cap: "#c4d8f4", capA: 0.6, a: 1 },
			{ top: "#32507f", bottom: "#1b2f56", cap: "#e4eefc", capA: 0.75, a: 1 },
		]
		: [
			{ top: "#cfdfee", bottom: "#eaf2f9", cap: "#ffffff", capA: 0.9, a: 0.95 },
			{ top: "#d6e4f1", bottom: "#eef5fa", cap: "#ffffff", capA: 0.95, a: 1 },
			{ top: "#e0ebf5", bottom: "#f6fafd", cap: "#ffffff", capA: 1, a: 1 },
		];

	function build() {
		W = root.clientWidth; H = root.clientHeight;
		if (!W || !H) return;
		EW = Math.round(clamp((W - 832) / 2 + 40, 56, 300));
		wrap.textContent = ""; overlay.querySelectorAll(".mqw").forEach((n) => n.remove());
		const rh = Math.round(clamp(H * 0.2, 110, 200)), lw = W + 120;
		const DEPTH = [6, 14, 26];
		layers = PAL.map((p, i) => {
			const c = canvasAt(wrap, `left:-60px;bottom:0;will-change:transform;contain:paint`, lw, rh);
			const base = rh * (0.55 + i * 0.2), amp = rh * (0.34 - i * 0.04);
			paintRidge(c.x, lw, rh, { base, amp, scale: lw * (0.09 - i * 0.02), seed: 3 + i * 2.7, top: hex(p.top), bottom: hex(p.bottom), alpha: p.a, cap: hex(p.cap), capAlpha: p.capA, capWidth: 1.6 });
			if (i >= 1) { // a few snowy pines tucked on the nearer ridges
				const R = rng(40 + i);
				const col = dark ? "#1c3350" : "#9db6c8", snow = dark ? "rgba(214,228,248,.9)" : "rgba(255,255,255,.95)";
				for (let k = 0; k < (i === 1 ? 14 : 12); k++) {
					const xx = R() * lw, hh = rh * (0.16 + R() * 0.12) * (i === 2 ? 1.2 : 0.9);
					const yy = ridgeBase(xx, base, amp, lw * (0.09 - i * 0.02), 3 + i * 2.7) + 4;
					pine(c.x, xx, yy, hh, col, snow);
				}
			}
			c.depth = DEPTH[i];
			return c;
		});
		snowC = [0, 1].map((side) => canvasAt(overlay, `${side ? "right" : "left"}:0;top:0`, EW, H, 0.75));
		snowC.forEach((c) => c.c.classList.add("mqw"));
		flakes = [];
		const n = clamp(Math.round(H / 20), 18, 40);
		for (let i = 0; i < n * 2; i++) flakes.push({ side: i % 2, x: r() * EW, y: r() * H, s: 0.5 + r() * 1.2, ph: r() * 6.28 });
		move(); drawSnow(0);
	}
	function ridgeBase(x, base, amp, scale, seed) { return base - amp * (0.5 + 0.28 * Math.sin(x / scale + seed) + 0.16 * Math.sin(x / (scale * 0.43) + seed * 2.3) + 0.08 * Math.sin(x / (scale * 0.19) + seed * 4.1)); }
	function move() {
		for (const l of layers) l.c.style.transform = `translate3d(${(-px * l.depth).toFixed(1)}px,${(Math.min(sy * 0.02, 18) * (l.depth / 26)).toFixed(1)}px,0)`;
	}
	function drawSnow(t) {
		for (const c of snowC) c.x.clearRect(0, 0, EW, H);
		for (const side of [0, 1]) {
			const x = snowC[side]?.x; if (!x) continue;
			x.fillStyle = dark ? "rgba(228,238,255,.85)" : "rgba(150,176,208,.9)";
			x.beginPath();
			for (const f of flakes) if (f.side === side) { x.moveTo(f.x + 1 + f.s, f.y); x.arc(f.x, f.y, 1 + f.s * 0.9, 0, TAU); }
			x.fill();
		}
	}
	scrollT(d, root, (v, top) => { sy = top; move(); });
	const ptr = pointer(d, () => { px = clamp((ptr.x / Math.max(1, W)) * 2 - 1, -1, 1); move(); });
	let loop = { wake() {} };
	if (!reducedMotion) {
		loop = ticker(d, (dt, t) => {
			const gust = Math.sin(t * 0.15) * 8;
			for (const f of flakes) {
				f.y += (18 + f.s * 16) * dt; f.x += (Math.sin(t * 0.7 + f.ph) * 10 + 4 + gust) * dt;
				if (f.y > H + 6) { f.y = -6; f.x = r() * EW; }
				if (f.x > EW + 6) f.x = -6; if (f.x < -6) f.x = EW + 6;
			}
			drawSnow(t); return true;
		}, { fps: 30, el: wrap });
	}
	const ro = new ResizeObserver(() => { clearTimeout(ro.t); ro.t = setTimeout(() => { build(); loop.wake(); }, 120); });
	ro.observe(root);
	d.add(() => { ro.disconnect(); clearTimeout(ro.t); wrap.remove(); overlay.querySelectorAll(".mqw").forEach((n) => n.remove()); });
	build(); loop.wake();
	return () => d.run();
}
