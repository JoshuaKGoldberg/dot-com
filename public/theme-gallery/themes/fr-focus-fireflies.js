import { createEdge, makeAurora } from "./_fr-d/edge.js";
import { createFooter } from "./_fr-d/footer.js";

// 336: #244 plus fireflies in the side strips. They gather toward the cursor's height while the aurora rests soft and scatter as it crisps.
export function activate({ root, reducedMotion }) {
	let sides = [[], []];
	let sprites = null;
	const mkSprite = (rgb) => {
		const c = document.createElement("canvas"); c.width = c.height = 64;
		const s = c.getContext("2d");
		const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
		g.addColorStop(0, "rgba(255,255,235,1)"); g.addColorStop(0.12, `rgba(${rgb},0.95)`); g.addColorStop(0.35, `rgba(${rgb},0.28)`); g.addColorStop(1, `rgba(${rgb},0)`);
		s.fillStyle = g; s.fillRect(0, 0, 64, 64);
		return c;
	};
	let crispS = 0;
	const fxInit = (E) => {
		sprites = { dark: mkSprite("214,255,120"), light: mkSprite("232,160,20") };
		let q = 336;
		const r = () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296);
		for (let i = 0; i < 2; i++) {
			const x0 = i ? E.w - E.stripW : 0;
			sides[i] = Array.from({ length: Math.round(E.h / 70) }, () => ({ x: x0 + r() * E.stripW, y: E.h * (0.25 + 0.72 * r()), vx: 0, vy: 0, ph: r() * 6.28, bl: 0.35 + r() * 0.5, sz: 12 + r() * 12, a: r() * 6.28, orbit: 16 + r() * 36 }));
		}
	};
	const edge = createEdge(root, {
		reducedMotion, seed: 336,
		hint: "Rest: fireflies gather. Move: they scatter",
		aurora: makeAurora({ style: "curtain", focus: true, scale: 5, bands: 3, rays: 0.9, base: 0.5, hgt: 0.5, edge: 0.04, gain: 1.55 }),
		stands: {},
		fx: true,
		fxInit,
		fxUpdate(dt, s, E) {
			if (reducedMotion) return;
			dt = Math.min(dt, 0.05);
			crispS += (E.aur.state().crisp - crispS) * Math.min(1, dt * 6);
			const p = s.pointer;
			const gather = p.active ? 1 - Math.min(1, crispS * 2.2) : 0.3;
			const near = p.x < E.w / 2 ? 0 : 1;
			for (let i = 0; i < 2; i++) {
				const x0 = i ? E.w - E.stripW : 0, cx = x0 + E.stripW / 2;
				const my = p.active && near === i ? Math.min(E.h - 40, Math.max(120, p.y)) : E.h * 0.7;
				for (const f of sides[i]) {
					f.a += Math.sin(s.t * 0.7 + f.ph) * 1.6 * dt;
					let ax = Math.cos(f.a) * 22 + Math.sin(s.t * 0.3 + f.ph * 2) * 8 + (cx - f.x) * 0.25;
					let ay = Math.sin(f.a) * 22 - 4;
					if (gather > 0.2 && p.active && near === i) {
						const ang = s.t * 0.5 + f.ph;
						ax += (cx + Math.cos(ang) * f.orbit - f.x) * 0.9 * gather;
						ay += (my + Math.sin(ang * 1.3) * f.orbit - f.y) * 0.9 * gather;
					}
					if (crispS > 0.12) {
						const dx = f.x - cx, dy = f.y - my, d = Math.hypot(dx, dy) || 1;
						const k = Math.min(1, crispS * 2) * 340;
						ax += (dx / d) * k + Math.cos(f.a * 3) * 60 * crispS; ay += (dy / d) * k + Math.sin(f.a * 3) * 60 * crispS;
					}
					if (f.x < x0 + 10) ax += 80; if (f.x > x0 + E.stripW - 10) ax -= 80;
					if (f.y < E.h * 0.2) ay += 60; if (f.y > E.h - 10) ay -= 60;
					f.vx += (ax - f.vx * 2.2) * dt; f.vy += (ay - f.vy * 2.2) * dt;
					f.x += f.vx * dt; f.y += f.vy * dt;
				}
			}
		},
		fxDraw(ctx, i, E, s) {
			const sp = E.dark ? sprites.dark : sprites.light;
			const dim = 1 - 0.55 * Math.min(1, crispS * 2);
			for (const f of sides[i]) {
				const b = reducedMotion ? 0.7 : Math.pow(Math.max(0, Math.sin(s.t * f.bl + f.ph)), 3) * 0.85 + 0.15;
				ctx.globalAlpha = (E.dark ? 0.95 : 0.8) * b * dim;
				const z = f.sz * (0.7 + 0.3 * b);
				ctx.drawImage(sp, f.x - z, f.y - z, z * 2, z * 2);
			}
			ctx.globalAlpha = 1;
		},
	});
	const foot = createFooter(root, { campfire: true, fireflies: true, seed: 336, aurora: () => edge.aur, viewH: () => edge.band, reduced: reducedMotion });
	return () => { edge.destroy(); foot(); };
}
