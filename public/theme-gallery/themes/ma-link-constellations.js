import { createStage, createAurora, fitCanvas, el, rgba, clamp } from "./_medium-d/kit.js";

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
const SEL = ".site-link, .site-item, .site-nav-link, .site-social, .site-socials a";

export function activate({ root, reducedMotion }) {
	const st = createStage({ root, reducedMotion });
	createAurora(st, st.topWrap(st.layers.b), { topFrac: 0.34, gain: 1.05 });
	const hint = st.hint("Hover a link to light a constellation");
	const fx = el("canvas", "position:absolute;left:0;top:0;pointer-events:none", st.layers.oa);
	let fxx = null, raf = 0, last = 0;
	const lit = SHAPES.map(() => 0), want = SHAPES.map(() => 0), place = SHAPES.map(() => null);
	const links = [...root.querySelectorAll(SEL)];
	const idx = new Map(links.map((l, i) => [l, i % SHAPES.length]));
	const size = () => { fxx = fitCanvas(fx, st.W, st.H, st.dpr); paint(); };
	st.sizers.push(size);
	size();

	function placeFor(i, link) {
		const b = link.getBoundingClientRect(), col = st.column();
		const cx = b.left + b.width / 2 - st.ox, cy = b.top + b.height / 2 - st.oy;
		const left = cx < st.W / 2, mw = left ? col.marginL : col.marginR;
		if (mw < 70) { place[i] = null; return; } // no margin room (narrow window): keep text clear
		const s = clamp(mw * 0.72, 80, 190);
		const x0 = left ? Math.max(8, (mw - s) / 2) : st.W - mw + Math.max(8, (mw - s) / 2) ;
		const y0 = clamp(cy - s * 0.4, 70, st.H - s - 24);
		place[i] = { x0: Math.min(x0, st.W - s - 8), y0, s, tx: left ? x0 : x0 };
	}
	function paint() {
		if (!fxx) return;
		fxx.clearRect(0, 0, st.W, st.H);
		const dark = st.dark, line = dark ? [190, 215, 255] : [70, 60, 165], star = dark ? [235, 242, 255] : [60, 55, 150];
		for (let i = 0; i < SHAPES.length; i++) {
			const v = lit[i], P = place[i];
			if (v < 0.01 || !P) continue;
			const sh = SHAPES[i], k = sh.s.map(([px, py]) => [P.x0 + px * P.s, P.y0 + py * P.s * 0.8]);
			fxx.strokeStyle = rgba(line, 0.6 * v); fxx.lineWidth = 1.2; fxx.beginPath();
			sh.e.forEach(([a, b], n) => {
				const f = clamp(v * (sh.e.length + 1) - n);
				if (f <= 0) return;
				const [x1, y1] = k[a], [x2, y2] = k[b];
				fxx.moveTo(x1, y1); fxx.lineTo(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f);
			});
			fxx.stroke();
			for (const [x, y] of k) {
				const g = fxx.createRadialGradient(x, y, 0, x, y, 13);
				g.addColorStop(0, rgba(dark ? [200, 225, 255] : [120, 100, 225], 0.5 * v)); g.addColorStop(1, rgba(dark ? [200, 225, 255] : [120, 100, 225], 0));
				fxx.fillStyle = g; fxx.fillRect(x - 13, y - 13, 26, 26);
				fxx.fillStyle = rgba(star, 0.45 + 0.5 * v);
				fxx.beginPath(); fxx.arc(x, y, 1.4 + v * 1.4, 0, 6.3); fxx.fill();
			}
			fxx.fillStyle = rgba(line, 0.75 * v);
			fxx.font = "italic 600 12px system-ui, sans-serif";
			fxx.fillText(sh.name, P.x0, P.y0 - 8);
		}
	}
	st.themers.push(paint);
	function loop(now) {
		raf = 0;
		if (st.dead) return;
		const dt = Math.min(0.05, (now - last) / 1000); last = now;
		let moving = false;
		for (let i = 0; i < lit.length; i++) {
			const d = want[i] - lit[i];
			if (Math.abs(d) > 0.004) { lit[i] += d * (1 - Math.exp(-dt * (d > 0 ? 3.2 : 2.2))); moving = true; } else lit[i] = want[i];
		}
		paint();
		if (moving) raf = requestAnimationFrame(loop);
	}
	function set(i, link, on) {
		if (on) placeFor(i, link);
		want[i] = on ? 1 : 0;
		if (st.reduced) { lit[i] = want[i]; paint(); return; }
		if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
	}
	const find = (e) => { const t = e.target.closest?.(SEL); return t && idx.has(t) ? t : null; };
	st.on(root, "pointerover", (e) => { const t = find(e); if (t) { hint.hide(); set(idx.get(t), t, true); } });
	st.on(root, "pointerout", (e) => { const t = find(e); if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) set(idx.get(t), t, false); });
	st.on(root, "focusin", (e) => { const t = find(e); if (t) { hint.hide(); set(idx.get(t), t, true); } });
	st.on(root, "focusout", (e) => { const t = find(e); if (t) set(idx.get(t), t, false); });
	st.start();
	return () => { cancelAnimationFrame(raf); fx.remove(); st.destroy(); };
}
