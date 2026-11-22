import { createStage, fitCanvas, el, rng, rgba, clamp, lerp, smooth, ramp, TAU } from "./_medium-d/kit.js";

function sprite(rgb, soft) {
	const S = 96, c = document.createElement("canvas"); c.width = c.height = S;
	const x = c.getContext("2d"), r = S / 2, g = x.createRadialGradient(r, r, 0, r, r, r);
	g.addColorStop(0, rgba(rgb, 0.55)); g.addColorStop(0.72, rgba(rgb, 0.7)); g.addColorStop(0.9, rgba(rgb, soft ? 0.8 : 1)); g.addColorStop(0.97, rgba(rgb, 0.35)); g.addColorStop(1, rgba(rgb, 0));
	x.fillStyle = g; x.fillRect(0, 0, S, S);
	return c;
}

// Soft spruce boughs painted once at low resolution (the CSS upscale is the defocus blur).
function boughs(W, H, dark, marginL, marginR) {
	const sc = 0.4, w = Math.ceil(W * sc), h = Math.ceil(H * sc);
	const c = document.createElement("canvas"); c.width = w; c.height = h;
	const x = c.getContext("2d"), r = rng(58);
	const cols = dark ? ["#04080f", "#070e1a", "#0a1424"] : ["#4b8a78", "#3f7b6b", "#58977f"];
	x.lineCap = "round"; x.globalAlpha = dark ? 0.9 : 0.4;
	const limb = (sx, sy, ang, len, thick, depth) => {
		const ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len + len * 0.14;
		x.strokeStyle = cols[(r() * 3) | 0]; x.lineWidth = thick;
		x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo((sx + ex) / 2, (sy + ey) / 2 - len * 0.08, ex, ey); x.stroke();
		for (let i = 0; i < 6; i++) {
			const f = 0.2 + i * 0.14, bx = lerp(sx, ex, f), by = lerp(sy, ey, f), s = i % 2 ? 1 : -1;
			if (depth > 0) limb(bx, by, ang + s * (0.9 + r() * 0.4), len * 0.4, thick * 0.75, depth - 1);
		}
	};
	const topLen = clamp(Math.min(marginL, marginR) * 0.8, 40, 170) * sc, sideLen = clamp(Math.min(marginL, marginR) * 0.45, 14, 70) * sc;
	for (const side of [0, 1]) {
		const dir = side ? Math.PI : 0, ox = side ? w : 0;
		for (let i = 0; i < 4; i++) limb(ox, h * (0.0 + i * 0.045), dir + (0.3 + r() * 0.5) * (side ? -1 : 1), topLen * (0.8 + r() * 0.5), 7 * sc * 1.8, 2);
		for (let i = 0; i < 6; i++) limb(ox, h * (0.3 + i * 0.13), dir + (r() - 0.5) * 0.5, sideLen * (1 + r() * 0.6), 6 * sc * 1.8, 1);
	}
	return c;
}

export function activate({ root, reducedMotion }) {
	const st = createStage({ root, reducedMotion });
	const bokehC = el("canvas", "position:absolute;left:0;top:0;pointer-events:none", st.topWrap(st.layers.b));
	let mf = 1, bx = null, discs = [], sprites = [], bw = 1, bh = 1, pal = ramp(st.dark), limbs = null;
	const S = 0.5; // bokeh canvas scale
	function build() {
		const dark = st.dark; pal = ramp(dark);
		bw = Math.ceil(st.W * S); bh = Math.ceil(st.H * 0.36 * S);
		bokehC.width = bw; bokehC.height = bh; bokehC.style.width = `${st.W}px`; bokehC.style.height = `${st.H * 0.36}px`;
		bx = bokehC.getContext("2d");
		const r = rng(96), tmp = [0, 0, 0];
		sprites = Array.from({ length: 6 }, (_, i) => sprite([...pal(i / 5, tmp)], i % 2));
		discs = [];
		const reach = Math.min(st.W * 0.3, 420);
		for (const side of [0, 1]) for (let i = 0; i < 24; i++) {
			const d = Math.pow(r(), 0.8) * reach, a = r() * Math.PI * 0.5; // quarter disc around the corner
			const x = side ? st.W - Math.cos(a) * d : Math.cos(a) * d, y = Math.sin(a) * d * 0.62;
			const fall = 1 - d / reach;
			discs.push({ x, y, r: 12 + r() * 52 * (0.5 + fall), s: sprites[(r() * 6) | 0], a: (dark ? 0.55 : 0.55) * (0.25 + 0.75 * fall) * (0.6 + r() * 0.5), ph: r() * TAU, sp: 0.1 + r() * 0.2 });
		}
		limbs?.remove();
		const col = st.column();
		mf = 0.3 + 0.7 * smooth(20, 170, Math.min(col.marginL, col.marginR));
		limbs = boughs(st.W, st.H, dark, col.marginL, col.marginR);
		limbs.style.cssText = `position:absolute;left:0;top:0;width:${st.W}px;height:${st.H}px;pointer-events:none;image-rendering:auto`;
		st.layers.c.appendChild(limbs);
	}
	st.sizers.push(build); st.themers.push(build);
	build();
	const draw = (dt, t) => {
		if (!bx) return;
		bx.clearRect(0, 0, bw, bh);
		bx.globalCompositeOperation = st.dark ? "lighter" : "source-over";
		const p = st.ptr, en = p.energy, k = st.reduced ? 0 : 1;
		for (const d of discs) {
			let x = d.x + Math.sin(t * d.sp + d.ph) * 8 * k, y = d.y + Math.cos(t * d.sp * 0.8 + d.ph) * 6 * k, al = d.a * mf * (0.88 + 0.12 * Math.sin(t * 0.4 + d.ph) * k);
			if (p.has) {
				const dx = p.sx - x, dy = p.sy - y, dist = Math.hypot(dx, dy), g = Math.exp(-(dist * dist) / (2 * 230 * 230));
				const pull = g * (0.1 + 0.25 * en);
				x += dx * pull; y += dy * pull; al *= 1 + g * (0.2 + 0.4 * en);
			}
			bx.globalAlpha = clamp(al, 0, 1);
			bx.drawImage(d.s, (x - d.r) * S, (y - d.r) * S, d.r * 2 * S, d.r * 2 * S);
		}
		bx.globalAlpha = 1;
	};
	st.draws.push(draw);
	st.start();
	return () => { bokehC.remove(); limbs?.remove(); st.destroy(); };
}
