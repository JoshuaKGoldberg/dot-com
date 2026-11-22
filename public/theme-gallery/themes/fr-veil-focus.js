import { createEdge } from "./_fr-d/edge.js";
import { createFooter } from "./_fr-d/footer.js";
import { createAurora } from "./_fr-d/aurora.js";

// 338: #242's breathing washes pull into soft curtains when the cursor moves, then relax back into a veil. Top band only.
function veilFocus(dark, shape) {
	const wash = createAurora({ alphaMode: true, bottom: 1, dark, shape, style: "wash", scale: 14, gain: 1.9, idleFps: 20 });
	const curtain = createAurora({ alphaMode: true, bottom: 1, dark, shape, style: "curtain", focus: true, scale: 7, bands: 3, rays: 0.4, base: 0.5, hgt: 0.5, edge: 0.05, gain: 1.5, crispMul: 0.45, idleFps: 20 });
	let m = 0;
	return {
		update(dt, s) {
			wash.update(dt, s); curtain.update(dt, s);
			const target = Math.min(1, curtain.state().energy * 2.4);
			m += (target - m) * (1 - Math.exp(-Math.max(dt, 0.001) * (target > m ? 4 : 1.1)));
			if (s.reduced) m = 0;
		},
		resize(w, h) { wash.resize(w, h); curtain.resize(w, h); },
		setDark(d) { wash.setDark(d); curtain.setDark(d); },
		drawMain(ctx, a = 1) { if (m < 0.97) wash.drawMain(ctx, a * (1 - 0.9 * m)); if (m > 0.03) curtain.drawMain(ctx, a * m); },
		draw(ctx, x, y, W, H, a, sy, sh) { if (m < 0.97) wash.draw(ctx, x, y, W, H, a * (1 - 0.9 * m), sy, sh); if (m > 0.03) curtain.draw(ctx, x, y, W, H, a * m, sy, sh); },
		state: () => ({ ...curtain.state(), morph: m }),
	};
}

export function activate({ root, reducedMotion }) {
	const edge = createEdge(root, { reducedMotion, seed: 338, hint: "Still: a breathing veil. Move: it pulls into curtains", aurora: veilFocus, stands: {} });
	const foot = createFooter(root, { peak: true, tower: true, snag: true, seed: 338, aurora: () => edge.aur, viewH: () => edge.band, reduced: reducedMotion });
	return () => { edge.destroy(); foot(); };
}
