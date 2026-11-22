import { raisedAurora, sideSky, ticker, trackPointer, isDark, clamp, smooth, rng, makeStars, STAR, TAU } from "./_refined-c/kit.js";

export function activate({ root, reducedMotion }) {
	const aur = raisedAurora({ root, reducedMotion, level: 1 });
	const host = root.querySelector(".scenery-c");
	let tk = null, sets = [];
	const ptr = trackPointer(() => tk?.wake());
	// Lens state: smoothed position, strength (presence) and Einstein radius.
	const L = { x: -1e4, y: -1e4, vx: 0, vy: 0, s: 0, E: 0, last: 0 };

	const sky = sideSky({
		root, host, seed: 307, galaxyDust: 0, galaxyAlpha: 0.9,
		onLayout(sides) {
			const r = rng(307);
			sets = sides.map((s) => ({
				stars: makeStars(r, Math.round(clamp(s.w * s.h / 9000, 20, 70)), s.w, s.h),
				dust: makeStars(r, Math.round(clamp(s.w * s.h / 520, 120, 420)), s.w, s.h).map((d, i) => {
					// concentrate the dust in a diagonal Milky Way band
					const t = r() * 1.6 - 0.3, off = (r() + r() + r() - 1.5) * s.w * 0.22;
					const sx = s.i === 0 ? 1 : -1;
					d.x = clamp((s.w / 2) + sx * (t - 0.5) * s.w * 0.9 + off * 0.6, 1, s.w - 1);
					d.y = clamp(t * s.h + off, 1, s.h - 1); d.r = 1; d.a = 0.12 + r() * 0.35;
					return d;
				}),
			}));
			if (tk) { render(); tk.wake(); }
		},
	});

	const step = (h) => {
		const p = ptr.p;
		const tgtOn = p.seen && performance.now() - p.t < 2200 && !reducedMotion ? 1 : (p.seen && reducedMotion ? 1 : 0);
		if (L.x < -1e3) { L.x = p.x; L.y = p.y; }
		const k = 1 - Math.exp(-h * 14);
		const px = L.x, py = L.y;
		L.x += (p.x - L.x) * k; L.y += (p.y - L.y) * k;
		const sp = Math.hypot(L.x - px, L.y - py) / h;
		L.s += (tgtOn - L.s) * (1 - Math.exp(-h * (tgtOn > L.s ? 7 : 1.6)));
		if (L.s < 0.005) L.s = 0;
		// a quick pass swells the lens a little, then it relaxes
		L.E += ((34 + clamp(sp / 900) * 16) * L.s - L.E) * (1 - Math.exp(-h * 6));
		return L.s > 0 || Math.abs(p.x - L.x) > 0.3 || Math.abs(p.y - L.y) > 0.3;
	};

	function render() {
		const dark = isDark(), base = STAR[dark ? "dark" : "light"];
		sky.sides.forEach((s, si) => {
			const ctx = s.ctx, { stars, dust } = sets[si] || {};
			ctx.clearRect(0, 0, s.w, s.h);
			if (!stars) return;
			const [lx, ly] = sky.toLocal(s, L.x, L.y);
			const on = L.E > 1;
			const draw = (a, scale) => {
				for (const st of a) {
					let x = st.x, y = st.y, al = (dark ? 0.8 : 0.62) * st.a * scale, r = st.r;
					if (on) {
						const dx = st.x - lx, dy = st.y - ly, b = Math.hypot(dx, dy) + 0.001;
						const E2 = L.E * L.E * (1 - smooth(L.E * 2.2, L.E * 6, b));
						if (E2 > 0.5) {
							const q = Math.sqrt(b * b + 4 * E2);
							const th = 0.5 * (b + q); // primary image radius
							const mag = 0.5 * (1 + (b * b + 2 * E2) / (b * q));
							const ux = dx / b, uy = dy / b;
							x = lx + ux * th; y = ly + uy * th;
							al = Math.min(1, al * Math.min(mag, 2.6) ** 0.8);
							r = st.r * (1 + 0.25 * Math.min(mag - 1, 2));
							// faint counter-image on the opposite side of the lens
							const th2 = 0.5 * (b - q), mu2 = Math.abs(0.5 * (1 - (b * b + 2 * E2) / (b * q)));
							const a2 = al * mu2 * 1.4;
							if (a2 > 0.03 && st.r > 0.9) {
								ctx.fillStyle = `rgba(${base},${Math.min(0.6, a2)})`;
								ctx.fillRect(lx + ux * th2 - 0.5, ly + uy * th2 - 0.5, 1, 1);
							}
						}
					}
					ctx.fillStyle = `rgba(${base},${al})`;
					if (r <= 1.1) ctx.fillRect(x - 0.5, y - 0.5, 1.1, 1.1); else { ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.fill(); }
				}
			};
			draw(dust, dark ? 0.9 : 0.8);
			draw(stars, 1);
			// Einstein ring hint: a thin, faint circle that only shows near the lens
			if (on && lx > -L.E - 20 && lx < s.w + L.E + 20) {
				const g = ctx.createRadialGradient(lx, ly, L.E * 0.88, lx, ly, L.E * 1.12);
				const c = dark ? "170,210,255" : "110,130,200", a = 0.075 * Math.min(1, L.s);
				g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.5, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
				ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, L.E * 1.14, 0, TAU); ctx.fill();
			}
		});
	}
	tk = ticker({ step, render, hz: 60, fps: 60 });
	render();
	return () => { aur.destroy(); tk.destroy(); ptr.destroy(); sky.destroy(); };
}
