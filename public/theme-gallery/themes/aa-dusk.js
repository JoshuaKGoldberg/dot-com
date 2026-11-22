import { createScene, addGlow, hexify, mapColors, night, mixC, clamp, lerp, smooth, addHint, addUI } from "./_aurora-b/scene.js";
import { createAurora } from "./_aurora-b/aurora.js";
import { AUR_DARK, AUR_LIGHT, NIGHT_SKY } from "./_aurora-b/palettes.js";

const mk = (o) => {
	const P = hexify({ leaf: ["#7a5a6a", "#6a4a60", "#8a6a70"], leafAmt: 1, snow: 0, ice: 0, ...o });
	const sh = (c, k) => mixC(c, [8, 12, 30], k);
	P.pineMid = P.pine.map((c) => mixC(c, P.mid.bottom, 0.4));
	P.pineShore = P.pine; P.fgPine = P.pine.map((c) => sh(c, 0.25));
	return P;
};
const DARK = [
	mk({ sky: [[0, "#2a2a62"], [0.4, "#6b3f7a"], [0.75, "#d9626a"], [1, "#f6a65a"]], horizon: "#ffb066", horizonA: 0.5, far: { top: "#6e4580", bottom: "#b05a72", shade: "#472c64" }, mid: { top: "#573a73", bottom: "#8c4a6e", shade: "#3a2658" }, hills: { top: "#3d2a5c", bottom: "#603868", shade: "#2a1d46" }, pine: ["#2c2048", "#261b40", "#33264f"], land: ["#1f1738", "#150f28"], water: "#7a4a78", wTop: "#f0a070", wBot: "#3c2456", mist: "#f0a8a0", mistA: 0.3, bark: "#20183a" }),
	mk({ sky: [[0, "#161d52"], [0.4, "#3b3a7a"], [0.75, "#a0507a"], [1, "#e0806e"]], horizon: "#e0806e", horizonA: 0.35, far: { top: "#3e4180", bottom: "#7a5486", shade: "#262860" }, mid: { top: "#2f3468", bottom: "#5a4577", shade: "#1c2050" }, hills: { top: "#222a54", bottom: "#3f3b6a", shade: "#161a3c" }, pine: ["#1c2148", "#171c40", "#222850"], land: ["#120f2c", "#0b0920"], water: "#2a2a5a", wTop: "#a05a86", wBot: "#141a44", mist: "#9a82b8", mistA: 0.26, bark: "#141632" }),
	mk({ sky: NIGHT_SKY, far: { top: "#2b3a68", bottom: "#41547e", shade: "#18234a" }, mid: { top: "#22305b", bottom: "#364a76", shade: "#131d40" }, hills: { top: "#192649", bottom: "#2a3c65", shade: "#0f1832" }, pine: ["#101a38", "#0d1630", "#141f42"], land: ["#070d1e", "#050a17"], water: "#162645", wTop: "#2c4270", wBot: "#0b1630", mist: "#7f96c8", mistA: 0.2, bark: "#0a1020" }),
];
const LIGHT = [
	mk({ sky: [[0, "#e9a58c"], [0.5, "#f6c9a6"], [0.85, "#fde6c4"]], horizon: "#ffd9a0", horizonA: 0.5, far: { top: "#c795a0", bottom: "#ecc7b4", shade: "#9a6f86" }, mid: { top: "#a98397", bottom: "#d9b3a8", shade: "#7e5f78" }, hills: { top: "#7f7388", bottom: "#b79e9c", shade: "#5c5070" }, pine: ["#4a4560", "#423d58", "#524c68"], land: ["#3e3648", "#2c2638"], water: "#e0a58f", wTop: "#f3c8a6", wBot: "#8a7494", mist: "#fff0dc", mistA: 0.34, bark: "#4a3c46" }),
	mk({ sky: [[0, "#b7a3cf"], [0.5, "#e6b6c0"], [0.85, "#f7d3c2"]], horizon: "#f8c0b0", horizonA: 0.4, far: { top: "#9a8cc0", bottom: "#d9bfd0", shade: "#7060a0" }, mid: { top: "#8678a8", bottom: "#c3a8c2", shade: "#5f5088" }, hills: { top: "#665c88", bottom: "#a08aa6", shade: "#463e6a" }, pine: ["#3f3c64", "#37345a", "#47446c"], land: ["#322e50", "#25223e"], water: "#b39ac0", wTop: "#e4b6c4", wBot: "#6c5c92", mist: "#f6dcea", mistA: 0.32, bark: "#3a3452" }),
	mk({ sky: [[0, "#a3b6e0"], [0.5, "#ccd0ec"], [0.85, "#e9dded"]], horizon: "#efd6e6", horizonA: 0.35, far: { top: "#8b9cc6", bottom: "#cfd3e8", shade: "#6475a6" }, mid: { top: "#7a8bb4", bottom: "#bcc3dc", shade: "#55668f" }, hills: { top: "#5d6e96", bottom: "#9aa6c4", shade: "#3e4f78" }, pine: ["#34456a", "#2e3e62", "#3a4c72"], land: ["#26334f", "#1b2640"], water: "#8ea6cc", wTop: "#bccae4", wBot: "#5a7098", mist: "#eef0fa", mistA: 0.34, bark: "#2c3856" }),
];
const palette = (v, dark) => (dark ? DARK[v] : LIGHT[v]);
const NAMES = (T) => (T < 0.16 ? "Sunset" : T < 0.5 ? "Dusk" : T < 0.82 ? "Twilight" : "Night");

function localT(now = new Date()) {
	const d = now.getHours() + now.getMinutes() / 60;
	if (d >= 20.5 || d < 5) return 1;
	if (d >= 16.5) return (d - 16.5) / 4;
	if (d >= 5 && d < 6.5) return 1 - (d - 5) / 1.5;
	return 0;
}
const fmtTime = (n) => n.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function activate({ root, reducedMotion }) {
	const dark = () => document.documentElement.classList.contains("dark");
	const now = new Date();
	const T0 = localT(now);
	let useLocal = T0 > 0;
	let T = 0, Tt = 0;
	const scene = createScene(root, { reduced: reducedMotion, nVar: 3, palette, waterFrac: 0.8, hardFrac: 0, seed: 61, fgCount: 8, reflectOpacity: 0.7 });
	const aurora = createAurora({ root, reducedMotion, dark, palette: dark() ? AUR_DARK : AUR_LIGHT, intensity: 0 });
	aurora.onFrame((c) => scene.reflectFrom(c, performance.now() / 1000));
	const scA = root.querySelector(".scenery-a");
	const sun = addGlow(scA, { x: 0.72, y: 0.4, size: 420, rgb: [255, 160, 90], core: [255, 222, 160] });
	const moon = addGlow(scA, { x: 0.86, y: 0.2, size: 320, rgb: [190, 205, 245], core: [236, 241, 255] });
	const hint = addHint(root, "Scroll to carry the valley from sunset to night");
	const ui = addUI(root, `<span>Sky</span><output></output><button type="button" aria-pressed="true" title="Start the sky at your local time">Local time</button>`, "dusk");
	const out = ui.querySelector("output"), btn = ui.querySelector("button");
	if (T0 === 0) btn.hidden = true;
	const setHint = () => {
		if (T0 > 0 && useLocal) hint.el.textContent = `Sky set to your local time (${fmtTime(now)}) · scroll to ${T0 > 0.85 ? "wind back toward sunset" : "reach full night"}`;
		else hint.el.textContent = "Scroll to carry the valley from sunset to night";
	};
	setHint();
	const target = () => {
		const s = scene.scrollT;
		if (!useLocal || T0 === 0) return s;
		return T0 > 0.85 ? T0 * (1 - s) : T0 + (1 - T0) * s;
	};
	function apply() {
		const d = dark();
		const sv = clamp(T) * 2, b = Math.min(1, Math.floor(sv)), u = smooth(sv - b);
		scene.setMix(b, u);
		const dusk = smooth(clamp((T - 0.4) / 0.5));
		aurora.setIntensity(dusk * (d ? 1 : 0.5));
		const st = (el, k, v) => { v = typeof v === "number" ? +v.toFixed(3) : v; if (el.__s?.[k] !== v) { (el.__s ||= {})[k] = v; k === "text" ? (el.textContent = v) : (el.style[k] = v); } };
		st(scene.stars, "opacity", d ? dusk : dusk * dusk * 0.3);
		const sunA = 1 - smooth(clamp(T / 0.6));
		st(sun.el, "opacity", sunA * (d ? 1 : 0.85));
		st(sun.el, "transform", `translate3d(0,${(T * scene.h * 0.42).toFixed(0)}px,0)`);
		st(moon.el, "opacity", d ? smooth(clamp((T - 0.45) / 0.4)) * 0.75 : smooth(clamp((T - 0.7) / 0.3)) * 0.4);
		st(out, "text", NAMES(T));
	}
	function style() {
		const d = dark();
		sun.set(d ? [255, 150, 90] : [255, 190, 130], d ? [255, 214, 150] : [255, 236, 190]);
		moon.set(d ? [190, 205, 245] : [200, 210, 245], d ? [236, 241, 255] : [250, 250, 255]);
		aurora.setPalette(d ? AUR_DARK : AUR_LIGHT);
		apply(); aurora.redraw();
	}
	scene.onBuild = style;
	Tt = target(); T = Tt;
	style();
	let raf = 0;
	function tick() { raf = 0; T += (Tt - T) * (reducedMotion ? 1 : 0.12); if (Math.abs(Tt - T) < 0.0008) T = Tt; apply(); if (T !== Tt) raf = requestAnimationFrame(tick); }
	const want = () => { Tt = target(); if (!raf) raf = requestAnimationFrame(tick); };
	root.addEventListener("scroll", want, { passive: true });
	btn.addEventListener("click", () => { useLocal = !useLocal; btn.setAttribute("aria-pressed", String(useLocal)); setHint(); want(); });
	const ht = setTimeout(() => hint.hide(), 9000);
	return () => { clearTimeout(ht); cancelAnimationFrame(raf); root.removeEventListener("scroll", want); aurora.destroy(); scene.destroy(); sun.el.remove(); moon.el.remove(); };
}
