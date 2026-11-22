import { createEdge, makeAurora } from "./_fr-d/edge.js";
import { createFooter } from "./_fr-d/footer.js";

// 330: #244's focus aurora in a top band, snowy spruce stands in the corners, slow snow along the edges, and a frozen-lake footer.
export function activate({ root, reducedMotion }) {
	const sides = [[], []];
	const fxInit = (E) => {
		let q = 330;
		const r = () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296);
		for (let i = 0; i < 2; i++) {
			const x0 = i ? E.w - E.stripW : 0;
			sides[i] = Array.from({ length: Math.round(E.h / 28) }, () => ({ x: x0 + r() * E.stripW, y: r() * E.h, z: 0.4 + r() * 0.9, ph: r() * 6.28 }));
		}
	};
	const edge = createEdge(root, {
		reducedMotion, seed: 330,
		hint: "Still: soft haze. Move: crisp rays",
		aurora: makeAurora({ style: "curtain", focus: true, scale: 5, bands: 3, rays: 0.85, base: 0.5, hgt: 0.5, edge: 0.04, gain: 1.6 }),
		stands: { snow: true, colors: { dark: ["#1a2b46", "#0e1b31", "#070f1f"], light: ["#9db7c2", "#5f8590", "#33565e"] } },
		fx: true,
		fxInit,
		fxUpdate(dt, s, E) {
			if (reducedMotion) return;
			dt = Math.min(dt, 0.05);
			for (let i = 0; i < 2; i++) {
				const x0 = i ? E.w - E.stripW : 0;
				for (const f of sides[i]) {
					f.y += (16 + 22 * f.z) * dt;
					f.x += Math.sin(s.t * 0.5 + f.ph) * 8 * dt + 4 * dt;
					if (f.y > E.h + 4) f.y = -4;
					if (f.x > x0 + E.stripW) f.x = x0; if (f.x < x0) f.x = x0 + E.stripW;
				}
			}
		},
		fxDraw(ctx, i, E) {
			ctx.fillStyle = E.dark ? "rgba(232,241,255,.85)" : "rgba(255,255,255,.95)";
			ctx.beginPath();
			for (const f of sides[i]) { const r = 0.9 + f.z * 0.9; ctx.moveTo(f.x + r, f.y); ctx.arc(f.x, f.y, r, 0, 6.2832); }
			ctx.fill();
			if (!E.dark) { ctx.strokeStyle = "rgba(110,140,185,.45)"; ctx.lineWidth = 0.6; ctx.stroke(); }
		},
	});
	const foot = createFooter(root, { snow: true, ice: true, peak: true, seed: 330, aurora: () => edge.aur, viewH: () => edge.band, reduced: reducedMotion, glowAlpha: 0.6 });
	return () => { edge.destroy(); foot(); };
}
