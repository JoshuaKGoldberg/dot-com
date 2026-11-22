import { createEdge, edgeShape } from "./_fr-d/edge.js";
import { createFooter } from "./_fr-d/footer.js";
import { createAurora } from "./_fr-d/aurora.js";

// 334: two aurora layers like a camera's depth of field, both confined to the top band. Movement racks the near layer into focus; the far one stays hazy.
function depth(dark, shape) {
	const far = createAurora({
		alphaMode: true, bottom: 1, dark, shape: (u, v) => shape(u, v) * 0.95, style: "curtain", focus: true, scale: 12, bands: 2, rays: 0.4, base: 0.38, hgt: 0.6, edge: 0.07, gain: 1.3, sigma: 0.3, follow: 1.5, crispMul: 0.1, rest: [0.34, 0.2], idleFps: 20,
		colors: { dark: [[110, 160, 255], [140, 130, 255], [185, 110, 255], [255, 110, 200]], light: [[120, 160, 235], [150, 145, 232], [185, 135, 228], [228, 145, 195]] },
	});
	const near = createAurora({ alphaMode: true, bottom: 1, dark, shape, style: "curtain", focus: true, scale: 5, bands: 3, rays: 1, base: 0.5, hgt: 0.46, edge: 0.045, gain: 1.6, crispMul: 1.25, rest: [0.66, 0.26], idleFps: 24 });
	return {
		update(dt, s) { far.update(dt, s); near.update(dt, s); },
		resize(w, h) { far.resize(w, h); near.resize(w, h); },
		setDark(d) { far.setDark(d); near.setDark(d); },
		drawMain(ctx, a = 1) { far.drawMain(ctx, a * (1 - 0.3 * near.state().crisp)); near.drawMain(ctx, a); },
		draw(ctx, x, y, W, H, a, sy, sh) { far.draw(ctx, x, y, W, H, a * 0.8, sy, sh); near.draw(ctx, x, y, W, H, a, sy, sh); },
		state: () => near.state(),
	};
}

export function activate({ root, reducedMotion }) {
	const edge = createEdge(root, {
		reducedMotion, seed: 334,
		hint: "Still: both layers hazy. Move: the near one snaps into focus",
		aurora: depth,
		stands: {},
	});
	const foot = createFooter(root, { peak: true, islands: true, seed: 334, aurora: () => edge.aur, viewH: () => edge.band, reduced: reducedMotion });
	return () => { edge.destroy(); foot(); };
}
void edgeShape;
