import { createScene, addGlow, hexify, mapColors, night, mixC, addHint } from "./_aurora-b/scene.js";
import { createAurora } from "./_aurora-b/aurora.js";
import { createFx, leafSystem, geeseSystem } from "./_aurora-b/fx.js";
import { seasonPalette, nightify, AUR_EQ_DARK, AUR_EQ_LIGHT } from "./_aurora-b/palettes.js";

const DAY = seasonPalette({
	skyT: "#98a9c6", skyM: "#d9d1c8", skyH: "#f4d6a8", horizon: "#f7c88c", horizonA: 0.5,
	farT: "#a094ae", farB: "#d8cbcf", midT: "#98878a", midB: "#cbbaa8", hillT: "#9a6a40", hillB: "#c3a077",
	leaf: ["#d9822b", "#c4402a", "#e3b13a"], pine: ["#355a45", "#2e4f3d", "#3f664f"], land: ["#4d3a20", "#33271a"],
	water: "#66808f", wTop: "#9cb0b8", wBot: "#2f4d60", leafAmt: 1, snow: 0, ice: 0, mist: "#f6ece0", mistA: 0.32, bark: "#4a3a30",
});
function palette(_v, dark) {
	if (!dark) return DAY;
	const P = nightify(DAY, { horizon: hexify("#6a4a5a") });
	P.leaf = [[176, 88, 36], [160, 46, 38], [178, 134, 48]];
	P.far = { top: [70, 66, 110], bottom: [44, 52, 90], shade: [24, 28, 62] };
	P.mid = { top: [60, 56, 92], bottom: [38, 46, 78], shade: [18, 22, 50] };
	P.hills = { top: [60, 44, 62], bottom: [34, 36, 62], shade: [20, 20, 44] };
	P.land = [[24, 20, 36], [14, 12, 26]];
	P.bark = [24, 20, 34];
	P.water = [18, 30, 56]; P.wTop = [60, 78, 118]; P.wBot = [8, 16, 38];
	return P;
}
const GEESE_D = ["rgba(200,210,235,.5)", "rgba(210,220,242,.66)", "rgba(222,230,248,.82)"];
const GEESE_L = ["rgba(52,62,84,.6)", "rgba(36,46,70,.78)", "rgba(20,30,50,.9)"];

export function activate({ root, reducedMotion }) {
	const dark = () => document.documentElement.classList.contains("dark");
	const scene = createScene(root, { reduced: reducedMotion, nVar: 1, palette, waterFrac: 0.8, hardFrac: 0.8, bareFrac: 0.8, seed: 47, fgCount: 8, reflectOpacity: 0.6 });
	const aurora = createAurora({ root, reducedMotion, dark, palette: dark() ? AUR_EQ_DARK : AUR_EQ_LIGHT, intensity: 1 });
	aurora.onFrame((c) => scene.reflectFrom(c, performance.now() / 1000));
	const glow = addGlow(root.querySelector(".scenery-a"), { x: 0.88, y: 0.2, size: 340, rgb: [230, 238, 255], core: [236, 241, 255] });
	const fx = createFx(root, { reduced: reducedMotion });
	const leaves = fx.add(leafSystem({ colors: [[217, 130, 43], [196, 64, 42], [227, 177, 58]], max: 120, seed: 8 }));
	leaves.rate = reducedMotion ? 0 : 1.2;
	const geese = fx.add(geeseSystem({ colors: GEESE_D }));
	// leaves loosen where the cursor passes near a foreground hardwood
	let carry = 0;
	fx.add({
		onMove(s) {
			if (reducedMotion) return;
			const p = s.ptr, sp = Math.min(60, p.speed);
			if (sp < 3) return;
			const [tx, ty] = scene.tx.fg || [0, 0];
			const [lx, ly] = scene.tx.lake ? [0, 0] : [0, 0];
			void lx; void ly;
			const fy = scene.layers.fgl ? scene.layers.fgl.y : 0;
			void fy;
			for (const c of scene.fgCrowns) {
				const cx = c.x + tx, cy = c.y + ty, d = Math.hypot(p.x - cx, p.y - cy);
				const reach = c.r * 2.4 + 50;
				if (d > reach) continue;
				carry += (sp / 60) * (1 - d / reach) * 4;
				while (carry > 1) { carry -= 1; leaves.spawn(cx + (Math.random() - 0.5) * c.r * 2.2, cy + (Math.random() - 0.3) * c.r, p.vx * 3, p.vy * 2); }
			}
		},
		update() {}, visible: () => false, draw() {},
	});
	function style() {
		const d = dark();
		glow.set(d ? [190, 205, 245] : [255, 226, 180], d ? [236, 241, 255] : [255, 244, 222]);
		glow.el.style.opacity = d ? 0.7 : 0.8;
		scene.stars.style.opacity = d ? 1 : 0;
		aurora.setPalette(d ? AUR_EQ_DARK : AUR_EQ_LIGHT); aurora.setIntensity(d ? 1 : 0.55);
		geese.colors = d ? GEESE_D : GEESE_L;
		fx.s.waterY = scene.waterY;
		aurora.redraw();
	}
	scene.onBuild = style;
	style();
	geese.prime(fx.s);
	fx.start();
	const hint = addHint(root, reducedMotion ? "Move the pointer to bend the aurora" : "Brush the cursor past the maples to shake leaves loose");
	const hide = () => { hint.hide(); window.removeEventListener("pointermove", hide); };
	window.addEventListener("pointermove", hide, { passive: true });
	return () => { window.removeEventListener("pointermove", hide); aurora.destroy(); fx.destroy(); scene.destroy(); glow.el.remove(); };
}
