import { createNight, rgba, clamp } from "./_aurora-d/kit.js";

// Each constellation: stars in a unit box, and line segments between them.
const SHAPES = [
	{ name: "Ursa Major", s: [[0, 0.5], [0.15, 0.42], [0.3, 0.46], [0.45, 0.55], [0.5, 0.8], [0.8, 0.82], [0.85, 0.5]], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
	{ name: "Cassiopeia", s: [[0, 0.3], [0.25, 0.75], [0.5, 0.4], [0.75, 0.8], [1, 0.25]], e: [[0, 1], [1, 2], [2, 3], [3, 4]] },
	{ name: "Orion", s: [[0.2, 0], [0.8, 0.05], [0.4, 0.5], [0.5, 0.5], [0.6, 0.5], [0.15, 1], [0.85, 0.95]], e: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 1]] },
	{ name: "Cygnus", s: [[0.5, 0], [0.5, 0.35], [0.5, 0.7], [0.5, 1], [0.05, 0.4], [0.95, 0.4]], e: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]] },
	{ name: "Lyra", s: [[0.5, 0], [0.3, 0.55], [0.7, 0.6], [0.35, 1], [0.75, 1]], e: [[0, 1], [0, 2], [1, 2], [1, 3], [3, 4], [4, 2]] },
	{ name: "Scorpius", s: [[0.8, 0], [0.7, 0.2], [0.6, 0.35], [0.5, 0.5], [0.4, 0.65], [0.3, 0.85], [0.1, 1], [0, 0.8]], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]] },
	{ name: "Leo", s: [[0.1, 0.8], [0.25, 0.5], [0.2, 0.2], [0.4, 0], [0.55, 0.25], [0.6, 0.65], [0.95, 0.7]], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1], [4, 5], [5, 6]] },
	{ name: "Pegasus", s: [[0.1, 0.2], [0.8, 0.1], [0.9, 0.75], [0.2, 0.9], [1, 0.45], [0, 0.55]], e: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [3, 5]] },
];
// Anchor (fraction of viewport), size (fraction of width): kept to the sides and the top band.
const SLOTS = [
	[0.04, 0.1, 0.17], [0.78, 0.08, 0.17], [0.02, 0.24, 0.14], [0.86, 0.2, 0.12],
	[0.3, 0.02, 0.14], [0.58, 0.04, 0.13], [0.9, 0.04, 0.09], [0.22, 0.3, 0.09],
];

export function activate({ root, reducedMotion }) {
	const scene = createNight({
		root,
		reducedMotion,
		starsAbove: true,
		milky: 0.35,
		aurora: { y0: 0.38, gap: 0.045, hgt: 0.27, gain: 0.9, flow: 1.4 },
	});
	const hint = scene.hint("Hover a link to light a constellation");
	let fx = null, fxx = null, raf = 0, last = 0, dead = false;
	const lit = SHAPES.map(() => 0), want = SHAPES.map(() => 0);
	const links = [...root.querySelectorAll(".site-link, .site-item")];
	const map = new Map(links.map((l, i) => [l, i % SHAPES.length]));

	function size() {
		if (!fx) {
			fx = document.createElement("canvas");
			fx.style.cssText = "position:absolute;left:0;top:0;pointer-events:none";
			scene.el.insertBefore(fx, scene.el.querySelector(".ad-land"));
		}
		const dpr = scene.dpr;
		fx.width = Math.ceil(scene.w * dpr); fx.height = Math.ceil(scene.wy * dpr);
		fx.style.width = `${scene.w}px`; fx.style.height = `${scene.wy}px`;
		fxx = fx.getContext("2d");
		fxx.setTransform(dpr, 0, 0, dpr, 0, 0);
		draw();
	}
	scene.afterBuild = size;

	function layout(i) {
		const [ax, ay, sz] = SLOTS[i];
		const W = scene.w, s = Math.max(90, W * sz);
		return { x: ax * W, y: ay * scene.wy + 30, s, k: SHAPES[i].s.map(([px, py]) => [ax * W + px * s, ay * scene.wy + 30 + py * s * 0.8]) };
	}
	function draw() {
		if (!fxx) return;
		fxx.clearRect(0, 0, scene.w, scene.wy);
		const dark = scene.dark;
		const line = dark ? [190, 215, 255] : [80, 70, 170];
		for (let i = 0; i < SHAPES.length; i++) {
			const L = layout(i), v = lit[i], sh = SHAPES[i];
			if (v > 0.01) {
				fxx.strokeStyle = rgba(line, 0.7 * v);
				fxx.lineWidth = 1.2;
				fxx.beginPath();
				sh.e.forEach(([a, b], n) => {
					const f = clamp(v * (sh.e.length + 1) - n); // lines draw in sequence
					if (f <= 0) return;
					const [x1, y1] = L.k[a], [x2, y2] = L.k[b];
					fxx.moveTo(x1, y1); fxx.lineTo(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f);
				});
				fxx.stroke();
			}
			for (const [x, y] of L.k) {
				const r = 1.3 + v * 1.7;
				fxx.fillStyle = rgba(dark ? [235, 242, 255] : [70, 60, 160], 0.55 + 0.45 * v);
				fxx.beginPath(); fxx.arc(x, y, r, 0, Math.PI * 2); fxx.fill();
				if (v > 0.05) {
					const g = fxx.createRadialGradient(x, y, 0, x, y, 12);
					g.addColorStop(0, rgba(dark ? [200, 225, 255] : [120, 100, 220], 0.5 * v));
					g.addColorStop(1, rgba(dark ? [200, 225, 255] : [120, 100, 220], 0));
					fxx.fillStyle = g; fxx.fillRect(x - 12, y - 12, 24, 24);
				}
			}
			if (v > 0.05) {
				fxx.fillStyle = rgba(line, 0.75 * v);
				fxx.font = "italic 600 12px system-ui, sans-serif";
				fxx.fillText(sh.name, L.x, L.y - 10);
			}
		}
	}
	function loop(now) {
		raf = 0;
		if (dead) return;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		let moving = false;
		for (let i = 0; i < lit.length; i++) {
			const d = want[i] - lit[i];
			if (Math.abs(d) > 0.004) { lit[i] += d * (1 - Math.exp(-dt * (d > 0 ? 3.2 : 2.2))); moving = true; } else lit[i] = want[i];
		}
		draw();
		if (moving) raf = requestAnimationFrame(loop);
	}
	function set(i, on) {
		want[i] = on ? 1 : 0;
		if (scene.reduced) { lit[i] = want[i]; draw(); return; }
		if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
	}
	const find = (e) => { const t = e.target.closest?.(".site-link, .site-item"); return t && map.has(t) ? t : null; };
	let first = true;
	const over = (e) => { const t = find(e); if (!t) return; if (first) { first = false; hint.hide(); } set(map.get(t), true); };
	const out = (e) => { const t = find(e); if (!t) return; const to = e.relatedTarget; if (to && t.contains(to)) return; set(map.get(t), false); };
	scene.on(root, "pointerover", over);
	scene.on(root, "pointerout", out);
	scene.on(root, "focusin", over);
	scene.on(root, "focusout", out);
	return () => { dead = true; cancelAnimationFrame(raf); scene.destroy(); };
}
