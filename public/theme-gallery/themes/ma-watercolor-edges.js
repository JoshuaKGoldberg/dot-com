import { createStage, fitCanvas, el, rng, rgba, clamp, lerp, smooth, STOPS, TAU } from "./_medium-d/kit.js";

// A wobbly closed blob path.
function blob(x, cx, cy, rx, ry, r, wob) {
	const n = 72, ph = [r() * TAU, r() * TAU, r() * TAU];
	x.beginPath();
	for (let i = 0; i <= n; i++) {
		const a = (i / n) * TAU, k = 1 + wob * (Math.sin(a * 3 + ph[0]) * 0.5 + Math.sin(a * 5 + ph[1]) * 0.3 + Math.sin(a * 8 + ph[2]) * 0.2);
		const px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k;
		i ? x.lineTo(px, py) : x.moveTo(px, py);
	}
	x.closePath();
}
// Wet-on-wet wash: a few glazes with a pigment-pooled darker edge.
function wash(w, h, col, seed, dark) {
	const c = document.createElement("canvas"); c.width = w; c.height = h;
	const x = c.getContext("2d"), r = rng(seed);
	for (let g = 0; g < 4; g++) {
		const side = r() < 0.5 ? r() * 0.28 : 1 - r() * 0.28, cx = w * (r() < 0.2 ? 0.3 + r() * 0.4 : side), cy = h * (0.0 + r() * 0.3), rx = w * (0.09 + r() * 0.12), ry = h * (0.3 + r() * 0.25);
		blob(x, cx, cy, rx, ry, r, 0.22);
		x.fillStyle = rgba(col, dark ? 0.11 : 0.16); x.fill();
		x.strokeStyle = rgba(col, dark ? 0.2 : 0.26); x.lineWidth = Math.max(1, w / 500); x.stroke();
	}
	x.globalCompositeOperation = "destination-in";
	const m = x.createLinearGradient(0, 0, 0, h);
	m.addColorStop(0, "rgba(0,0,0,1)"); m.addColorStop(0.45, "rgba(0,0,0,.7)"); m.addColorStop(1, "rgba(0,0,0,0)");
	x.fillStyle = m; x.fillRect(0, 0, w, h);
	return c;
}
function paperTile(dark) {
	const c = document.createElement("canvas"); c.width = c.height = 128;
	const x = c.getContext("2d"), r = rng(7);
	for (let i = 0; i < 900; i++) { x.fillStyle = dark ? `rgba(200,210,255,${0.02 + r() * 0.03})` : `rgba(120,100,70,${0.03 + r() * 0.04})`; x.fillRect(r() * 128, r() * 128, 1 + r() * 1.5, 1 + r() * 1.5); }
	return c.toDataURL();
}
function ridges(w, h, dark) {
	const c = document.createElement("canvas"); c.width = w; c.height = h;
	const x = c.getContext("2d"), r = rng(21);
	const sets = dark
		? [[[40, 58, 105], 0.4], [[28, 42, 86], 0.55], [[18, 30, 66], 0.7]]
		: [[[186, 212, 222], 0.5], [[165, 200, 198], 0.52], [[140, 182, 178], 0.52]];
	sets.forEach(([col, a], i) => {
		const base = h * (0.42 + i * 0.2), ph = r() * 9, amp = h * (0.2 - i * 0.03);
		x.beginPath(); x.moveTo(0, h);
		for (let px = 0; px <= w; px += 6) x.lineTo(px, base - amp * (0.5 + 0.5 * Math.sin(px / (w / (2.6 + i)) + ph)) - amp * 0.35 * Math.sin(px / 61 + ph * 2) * (0.5 + 0.5 * Math.sin(px / 300)));
		x.lineTo(w, h); x.closePath();
		const g = x.createLinearGradient(0, base - amp, 0, h);
		g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, a * 0.35));
		x.fillStyle = g; x.fill();
		x.strokeStyle = rgba(col.map((v) => v * (dark ? 1.5 : 0.8)), 0.4); x.lineWidth = 1.2; x.stroke();
	});
	return c;
}

export function activate({ root, reducedMotion }) {
	const st = createStage({ root, reducedMotion });
	const { b, c, a } = st.layers;
	const washes = [], PAD = 60, top = st.topWrap(b);
	let paper = null, hills = null, hillsEl = null;

	function build() {
		for (const w of washes) w.el.remove();
		washes.length = 0;
		const dark = st.dark, W = Math.round(st.W * 0.5 + PAD), H = Math.round(st.H * 0.36 * 0.5);
		const cols = STOPS[dark ? "dark" : "light"];
		[[cols[0], 11, 0], [cols[2], 23, 1], [cols[3], 37, 2], [cols[1], 41, 3]].forEach(([col, seed, i]) => {
			const cv = wash(W, H, col, seed, dark);
			cv.style.cssText = `position:absolute;left:${-PAD}px;top:0;width:${st.W + PAD * 2}px;height:${st.H * 0.36}px;pointer-events:none;`;
			top.appendChild(cv);
			washes.push({ el: cv, k: 0.4 + i * 0.35, ph: i * 1.7 });
		});
		a.style.cssText = "";
		paper ??= el("div", "position:absolute;inset:0;pointer-events:none;background-size:128px 128px", st.layers.a);
		paper.style.backgroundImage = `url(${paperTile(dark)})`; paper.style.opacity = dark ? "0.9" : "1";
		const hh = Math.round(st.H * 0.17), hw = Math.round(st.W * 0.6);
		hills?.remove();
		hills = ridges(hw, Math.round(hh * 0.6), dark);
		hills.style.cssText = `position:absolute;left:${-PAD}px;bottom:0;width:${st.W + PAD * 2}px;height:${hh}px;pointer-events:none`;
		c.appendChild(hills);
	}
	st.sizers.push(build); st.themers.push(build);
	build();

	const draw = (dt, t) => {
		const p = st.ptr, en = p.energy, px = p.has ? p.sx / st.W - 0.5 : 0, k = st.reduced ? 0 : 1;
		const gain = 0.95 + 0.1 * en;
		for (const w of washes) {
			const dx = Math.sin(t * 0.07 + w.ph) * 18 * k + px * 46 * w.k;
			const dy = Math.cos(t * 0.05 + w.ph * 1.3) * 5 * k + en * 8 * w.k;
			w.el.style.transform = `translate3d(${dx}px,${dy}px,0)`;
			w.el.style.opacity = String(clamp(gain - 0.04 * w.k + en * 0.1, 0, 1));
		}
		if (hills) hills.style.transform = `translate3d(${-px * 14}px,0,0)`;
	};
	st.draws.push(draw);
	st.start();
	return () => { st.destroy(); };
}
