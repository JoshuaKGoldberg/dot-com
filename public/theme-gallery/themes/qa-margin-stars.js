import { isDark, auroraAt, rgba, rng, trackPointer, createLoop, makeCanvas, sizeCanvas, idle, onResize } from "./_quiet-e/kit.js";

const PER_SIDE = 16;

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const overlay = root.querySelector(".site-overlay") || root;
	const page = root.querySelector(".site-page");
	const base = dark ? [215, 228, 250] : [70, 90, 130];
	const baseAlpha = dark ? 0.85 : 0.6;
	let sides = [], dead = false, scrollY = 0;
	const rand = rng(277);
	// Star seeds in unit space so resizes keep the same sky.
	const seeds = [0, 1].map(() => Array.from({ length: PER_SIDE }, () => ({
		u: rand(), v: rand(), r: 0.9 + rand() * 1.0, ph: rand() * 6.28, sp: 0.15 + rand() * 0.3, a: 0.45 + rand() * 0.55,
	})));
	const edges = new Map(); // "side:i-j" -> alpha

	const build = () => {
		for (const s of sides) s.c.remove();
		sides = [];
		const rect = page.getBoundingClientRect(), orect = overlay.getBoundingClientRect();
		const vw = root.clientWidth, vh = root.clientHeight;
		const w = Math.min(rect.left - 20, 260);
		if (w < 90) return; // narrow screens: no margins, no stars
		[0, 1].forEach((i) => {
			const x = (i === 0 ? rect.left - 12 - w : rect.right + 12) - orect.left;
			const c = makeCanvas(overlay, `left:${x}px;top:0;width:${w}px;height:${vh}px`);
			const ctx = sizeCanvas(c, w, vh, devicePixelRatio);
			const stars = seeds[i].map((s) => ({ ...s, x: s.u * w, y: s.v * vh }));
			sides.push({ c, ctx, x, w, h: vh, stars });
		});
		loop.wake();
	};

	const ptr = trackPointer(() => loop.wake());
	const R = 170;
	const draw = (t) => {
		const { p } = ptr;
		const orect = overlay.getBoundingClientRect(), ox = orect.left, oy = orect.top;
		for (const [si, s] of sides.entries()) {
			const { ctx, stars } = s;
			ctx.clearRect(0, 0, s.w, s.h);
			const px = p.x - ox - s.x, py = p.y - oy;
			const near = [];
			const off = reducedMotion ? 0 : (scrollY * 0.06) % s.h;
			for (let i = 0; i < stars.length; i++) {
				const st = stars[i];
				const y = (st.y - off + s.h) % s.h;
				st.cy = y;
				const d = Math.hypot(px - st.x, py - y);
				const prox = p.seen ? Math.max(0, 1 - d / R) : 0;
				st.prox = prox;
				if (prox > 0) near.push([d, i]);
				const tw = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(t * st.sp + st.ph);
				const col = prox > 0 ? auroraAt(dark, 0.2 + 0.6 * (1 - prox)) : base;
				const mixc = prox > 0 ? col : base;
				const a = Math.min(1, (baseAlpha * st.a * tw) + prox * 0.55);
				const r = st.r + prox * 0.7 + ptr.p.energy * prox * 0.4;
				ctx.fillStyle = rgba(mixc, a);
				ctx.beginPath(); ctx.arc(st.x, y, r, 0, 6.283); ctx.fill();
			}
			// Connect the nearest few into a fleeting constellation.
			near.sort((a, b) => a[0] - b[0]);
			const pick = near.slice(0, 4).map((n) => n[1]).sort((a, b) => a - b);
			const live = new Set();
			for (let k = 0; k < pick.length - 1; k++) live.add(`${si}:${pick[k]}-${pick[k + 1]}`);
			for (const key of live) if (!edges.has(key)) edges.set(key, 0);
			for (const [key, a] of edges) {
				if (!key.startsWith(si + ":")) continue;
				const na = live.has(key) ? Math.min(a + 0.08, 1) : a - 0.03;
				if (na <= 0) { edges.delete(key); continue; }
				edges.set(key, na);
				const [i, j] = key.slice(2).split("-").map(Number);
				const A = stars[i], B = stars[j];
				ctx.strokeStyle = rgba(auroraAt(dark, 0.35), na * (dark ? 0.5 : 0.5));
				ctx.lineWidth = 0.8;
				ctx.beginPath(); ctx.moveTo(A.x, A.cy); ctx.lineTo(B.x, B.cy); ctx.stroke();
			}
		}
	};

	let lastT = 0, skip = 0;
	const loop = createLoop((dt) => {
		lastT += dt;
		ptr.decay(dt);
		// Ambient twinkle is slow: redraw at ~6fps unless the cursor is awake.
		if (++skip >= 4 || ptr.p.energy > 0 || edges.size > 0 || ptr.p.seen) { skip = 0; draw(lastT); }
		return !reducedMotion || ptr.p.seen || edges.size > 0;
	}, { fps: 24 });

	const onScroll = () => { scrollY = root.scrollTop; if (!reducedMotion) loop.wake(); };
	root.addEventListener("scroll", onScroll, { passive: true });
	const stopResize = onResize(build);
	idle(() => { if (!dead) { build(); draw(0); } });

	return () => {
		dead = true;
		loop.destroy(); ptr.destroy(); stopResize();
		root.removeEventListener("scroll", onScroll);
		for (const s of sides) s.c.remove();
	};
}
