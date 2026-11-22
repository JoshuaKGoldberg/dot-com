import { createScene, addGlow, hexify, mapColors, night, mixC, addHint, watchDark } from "./_aurora-b/scene.js";
import { createAurora } from "./_aurora-b/aurora.js";
import { createFx, snowSystem } from "./_aurora-b/fx.js";

const DAY = hexify({
	sky: [[0, "#a9b9d4"], [0.5, "#d4dcea"], [0.85, "#f1eaf0"]], horizon: "#f7d9d6", horizonA: 0.45,
	far: { top: "#b3c2d8", bottom: "#e2e9f1", shade: "#8497b3" },
	mid: { top: "#a3b4c8", bottom: "#d3dee8", shade: "#7389a3" },
	hills: { top: "#92a4b4", bottom: "#c4d0d8", shade: "#697e90" },
	pine: ["#2f4d4a", "#294541", "#365a54"], pineMid: ["#6f8796", "#667d8e", "#7b92a0"], pineShore: ["#27423f", "#223a38", "#2d4b47"], fgPine: ["#1f3836", "#1a302e", "#25423f"],
	leaf: ["#6b6258", "#5a5249", "#7a7168"], leafAmt: 0, bark: "#4a4038",
	land: ["#e6eef5", "#c6d4e2"], water: "#a9c4d4", wTop: "#cfe0ea", wBot: "#86a6bc", ice: 1, snow: 1, mist: "#f3f6fa", mistA: 0.4,
});
const AUR_DARK = { a: [[0.2, 1, 0.55], [0.1, 0.85, 0.75], [0.6, 0.35, 1]], b: [[0.15, 0.95, 0.7], [0.15, 0.7, 0.9], [0.75, 0.3, 0.95]] };
const AUR_LIGHT = { a: [[0.4, 0.82, 0.66], [0.45, 0.72, 0.88], [0.78, 0.6, 0.95]] };

function palette(_v, dark) {
	if (!dark) return DAY;
	const P = mapColors(DAY, (c) => night(c, 1));
	P.sky = hexify([[0, "#040918"], [0.5, "#0a1632"], [0.85, "#1a2c58"]]);
	P.horizon = hexify("#2d6a7a"); P.horizonA = 0.22;
	P.snowCol = [150, 176, 210];
	P.land = hexify(["#7b93b4", "#2f4468"]);
	P.far = { top: [78, 98, 140], bottom: [40, 56, 94], shade: [20, 30, 60] };
	P.mid = { top: [56, 74, 112], bottom: [32, 46, 78], shade: [16, 24, 50] };
	P.hills = { top: [40, 56, 90], bottom: [26, 38, 66], shade: [12, 20, 42] };
	P.pineMid = hexify(["#2a3a5c", "#25344f", "#2f4064"]); P.pine = hexify(["#162238", "#121c30", "#1b2a44"]); P.pineShore = hexify(["#0f1a2e", "#0c1626", "#132039"]); P.fgPine = hexify(["#0a1222", "#080f1c", "#0d182b"]);
	P.water = hexify("#142544"); P.wTop = hexify("#3f6a8a"); P.wBot = hexify("#0a1630");
	P.mist = [120, 150, 200]; P.mistA = 0.22;
	P.bark = [20, 26, 44];
	return P;
}

export function activate({ root, reducedMotion }) {
	const dark = () => document.documentElement.classList.contains("dark");
	const scene = createScene(root, { reduced: reducedMotion, nVar: 1, palette, waterFrac: 0.78, hardFrac: 0.16, fgCount: 9, reflectOpacity: 0.85 });
	const aurora = createAurora({ root, reducedMotion, dark, palette: dark() ? AUR_DARK : AUR_LIGHT, intensity: dark() ? 1 : 0.55, top: 0.9 });
	aurora.onFrame((c) => scene.reflectFrom(c, performance.now() / 1000));
	const sty = () => { scene.stars.style.opacity = dark() ? 1 : 0; };
	const glow = addGlow(root.querySelector(".scenery-a"), { x: 0.88, y: 0.2, size: 340, rgb: [230, 238, 255], core: [236, 241, 255] });
	const style = () => {
		const d = dark();
		glow.set(d ? [190, 205, 245] : [255, 232, 214], d ? [236, 241, 255] : [255, 246, 232]);
		glow.el.style.opacity = d ? 0.7 : 0.8;
		aurora.setPalette(d ? AUR_DARK : AUR_LIGHT); aurora.setIntensity(d ? 1 : 0.55);
		sty();
	};
	style();
	scene.onBuild = () => { style(); aurora.redraw(); };
	const fx = createFx(root, { reduced: reducedMotion });
	const snow = snowSystem({ max: 150, speed: 0.8 });
	snow.density = 1;
	fx.add(snow);
	fx.s.waterY = 0;
	fx.start();
	const hint = addHint(root, reducedMotion ? "Move the pointer to bend the aurora" : "Move the pointer to draw the aurora toward it");
	const hide = () => { hint.hide(); window.removeEventListener("pointermove", hide); };
	window.addEventListener("pointermove", hide, { passive: true });
	return () => { window.removeEventListener("pointermove", hide); aurora.destroy(); fx.destroy(); scene.destroy(); glow.el.remove(); };
}
