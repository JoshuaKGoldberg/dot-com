import { createScene, addGlow, hexify, mixC, clamp, lerp, smooth, addHint, addUI } from "./_aurora-b/scene.js";
import { createAurora } from "./_aurora-b/aurora.js";
import { createFx, snowSystem, leafSystem, fireflySystem } from "./_aurora-b/fx.js";
import { AUR_DARK, AUR_LIGHT, seasonPalette, nightify } from "./_aurora-b/palettes.js";

const base = { mist: "#f6f2ea", mistA: 0.3 };
const DAY = [
	seasonPalette({ ...base, skyT: "#8bbbe6", skyM: "#cfe3ee", skyH: "#f6e6e0", farT: "#8fb0c8", farB: "#d2e0ea", midT: "#7aa3b0", midB: "#bcd3d4", hillT: "#5f9488", hillB: "#8fb8a8", leaf: ["#9ccf7a", "#b6dc8f", "#e8b8cf"], pine: ["#3f6f55", "#386549", "#497a5c"], land: ["#2e5c3a", "#1f4630"], water: "#6a98ae", wTop: "#8fb7c8", wBot: "#2f6482", leafAmt: 0.55, snow: 0, ice: 0, horizon: "#fbe3d4", horizonA: 0.4 }),
	seasonPalette({ ...base, skyT: "#4f94dc", skyM: "#9cc8ee", skyH: "#dcecf5", farT: "#86a1bd", farB: "#c9d8e3", midT: "#6f93a8", midB: "#b4cbd1", hillT: "#4f8a7c", hillB: "#7fa7a5", leaf: ["#3f7a45", "#4a8a4c", "#35693c"], pine: ["#2e5d49", "#285341", "#356b52"], land: ["#1d3a34", "#17302c"], water: "#5a9ab5", wTop: "#8fb7c8", wBot: "#2f6482", leafAmt: 1, snow: 0, ice: 0, horizon: "#fff4d6", horizonA: 0.35 }),
	seasonPalette({ ...base, skyT: "#9fb0c8", skyM: "#d9d4cc", skyH: "#f2d7b0", farT: "#a398ae", farB: "#d8cdd0", midT: "#9a8a8c", midB: "#cdbfb0", hillT: "#9a6a40", hillB: "#c3a077", leaf: ["#d9822b", "#c4502a", "#e3b13a"], pine: ["#355a45", "#2e4f3d", "#3f664f"], land: ["#4d3a20", "#33271a"], water: "#66808f", wTop: "#8fa3ae", wBot: "#2f4d60", leafAmt: 1, snow: 0, ice: 0, horizon: "#f7cf9c", horizonA: 0.45 }),
	seasonPalette({ ...base, skyT: "#aebdd4", skyM: "#d9e0ea", skyH: "#f0f1f5", farT: "#b7c5d8", farB: "#e2e9f1", midT: "#a9b9c9", midB: "#d5dfe8", hillT: "#8a9aa5", hillB: "#c1cdd4", leaf: ["#6b6258", "#5a5249", "#7a7168"], pine: ["#2c4a45", "#27413d", "#33544e"], land: ["#e4ecf3", "#c4d2e0"], water: "#a9c4d4", wTop: "#c9dce6", wBot: "#7fa0b6", leafAmt: 0, snow: 1, ice: 1, horizon: "#f7d9d6", horizonA: 0.4 }),
];
const NIGHT_LAND = [null, null, null, hexify(["#7b93b4", "#2f4468"])];
const INT = [0.8, 0.55, 0.85, 1];
const NAMES = ["Early spring", "Spring", "Early summer", "Summer", "Late summer", "Early autumn", "Autumn", "Late autumn", "Early winter", "Winter", "Deep winter", "Late winter"];
const seasonName = (S) => NAMES[Math.floor(clamp(S, 0, 0.9999) * 12)];

export function activate({ root, reducedMotion }) {
	const dark = () => document.documentElement.classList.contains("dark");
	let S = 0.22, Starget = 0.22, follow = true;
	const palette = (v, d) => (d ? nightify(DAY[v], { land: NIGHT_LAND[v] }) : DAY[v]);
	const scene = createScene(root, { reduced: reducedMotion, nVar: 4, palette, waterFrac: 0.8, hardFrac: 0.45, bareFrac: 0.45, seed: 93, fgCount: 8, reflectOpacity: 0.6 });
	const aurora = createAurora({ root, reducedMotion, dark, palette: dark() ? AUR_DARK : AUR_LIGHT, intensity: 0.7 });
	aurora.onFrame((c) => scene.reflectFrom(c, performance.now() / 1000));
	const glow = addGlow(root.querySelector(".scenery-a"), { x: 0.88, y: 0.2, size: 340, rgb: [230, 238, 255], core: [236, 241, 255] });
	const fx = createFx(root, { reduced: reducedMotion });
	const snow = fx.add(snowSystem({ max: 150, speed: 0.8 }));
	const petals = fx.add(leafSystem({ colors: [[244, 196, 216], [252, 226, 236]], kind: "petal", max: 50, seed: 4 }));
	const leaves = fx.add(leafSystem({ colors: [[217, 130, 43], [196, 80, 42], [227, 177, 58]], max: 90, seed: 7 }));
	const flies = fx.add(fireflySystem({ rgb: [232, 160, 20], dark, n: 28 }));
	const hint = addHint(root, reducedMotion ? "Drag the slider to change the season" : "Scroll or drag the slider to move through the year");
	const ui = addUI(root, `<span>Season</span><input type="range" min="0" max="999" step="1" aria-label="Season" /><output></output><button type="button" aria-pressed="true" title="Let page scroll drive the season">Scroll</button>`, "seasons");
	const slider = ui.querySelector("input"), out = ui.querySelector("output"), followBtn = ui.querySelector("button");

	function apply() {
		const sv = clamp(S, 0, 0.9999) * 4, b = Math.floor(sv), f = sv - b, u = smooth(f);
		scene.setMix(b, u);
		const d = dark();
		aurora.setIntensity(lerp(INT[b], INT[(b + 1) % 4], u) * (d ? 1 : 0.6));
		const sv2 = Math.round(clamp(S) * 999); if (slider.value != sv2) slider.value = sv2; const nm = seasonName(S); if (out.textContent !== nm) out.textContent = nm;
		const sn = S > 0.7 ? smooth(clamp((S - 0.72) / 0.06)) : S < 0.06 ? 1 - smooth(S / 0.06) : 0;
		const fall = S > 0.42 && S < 0.7 ? Math.sin(((S - 0.42) / 0.28) * Math.PI) : 0;
		const petal = S > 0.06 && S < 0.22 ? Math.sin(((S - 0.06) / 0.16) * Math.PI) : 0;
		const fly = S > 0.1 && S < 0.44 ? Math.sin(((S - 0.1) / 0.34) * Math.PI) : 0;
		snow.density = sn; petals.rate = reducedMotion ? 0 : petal * 7; leaves.rate = reducedMotion ? 0 : fall * 9; flies.amount = fly > 0.05 ? Math.min(1, fly * 1.4) : 0;
		if (reducedMotion) fx.redraw();
	}
	function style() {
		const d = dark();
		glow.set(d ? [190, 205, 245] : [255, 238, 205], d ? [236, 241, 255] : [255, 248, 226]);
		glow.el.style.opacity = d ? 0.7 : 0.85;
		scene.stars.style.opacity = d ? 1 : 0;
		aurora.setPalette(d ? AUR_DARK : AUR_LIGHT);
		flies.setColor(d ? [214, 255, 120] : [232, 160, 20]);
		leaves.colors[0] = d ? [160, 100, 50] : [217, 130, 43];
		fx.s.waterY = scene.waterY;
		apply(); aurora.redraw();
	}
	scene.onBuild = style;
	style();
	fx.start();

	// smooth the season toward its target (one rAF loop while it moves)
	let raf = 0, ticking = false;
	function tick() {
		raf = 0;
		const dS = Starget - S;
		S += dS * (reducedMotion ? 1 : 0.12);
		if (Math.abs(Starget - S) < 0.0008) S = Starget;
		apply();
		if (S !== Starget) raf = requestAnimationFrame(tick);
	}
	const want = () => { if (!raf) raf = requestAnimationFrame(tick); };
	const onScroll = () => { if (!follow) return; Starget = clamp(0.18 + scene.scrollT * 0.78, 0, 0.995); want(); };
	root.addEventListener("scroll", onScroll, { passive: true });
	slider.addEventListener("input", () => { follow = false; followBtn.setAttribute("aria-pressed", "false"); Starget = slider.value / 999; hint.hide(); want(); });
	followBtn.addEventListener("click", () => { follow = !follow; followBtn.setAttribute("aria-pressed", String(follow)); hint.hide(); if (follow) { Starget = clamp(0.18 + scene.scrollT * 0.78, 0, 0.995); want(); } });
	const hide = () => { hint.hide(); window.removeEventListener("pointermove", hide); };
	window.addEventListener("pointermove", hide, { passive: true });
	root.addEventListener("scroll", hide, { passive: true, once: true });
	return () => { cancelAnimationFrame(raf); root.removeEventListener("scroll", onScroll); window.removeEventListener("pointermove", hide); aurora.destroy(); fx.destroy(); scene.destroy(); glow.el.remove(); };
}
