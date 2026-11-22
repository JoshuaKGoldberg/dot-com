// _vs2/index.js: the shared Lake Stars kit. Each vs2-*.js calls makeTheme(config).
import { marginLayer, rng, TAU, isDark, clamp } from "../_dl-c/kit.js";
import { starrySky } from "./stars.js";
import { vsAurora } from "./aurora.js";
import { vsFooter } from "./footer.js";
import { vsSquiggle } from "./squiggle.js";
import { vsPortrait } from "./portrait.js";

// the rare shooting star from #347: only on a quick flick through a margin
function shootingStarFx(dark) {
	let shoot = null, lastShot = -99, T = 0;
	const rr = rng(9001);
	return {
		fps: () => 30,
		step(dt) { T += dt; if (shoot) { shoot.age += dt; shoot.x += shoot.dx * 720 * dt; shoot.y += shoot.dy * 720 * dt; if (shoot.age > 0.9) shoot = null; } return !!shoot; },
		onPointer(p, L) {
			if (!shoot && p.speed > 1700 && T - lastShot > 7 && rr() < 0.5 && (p.x < L.zones[0][1] || p.x > L.zones[1][0]) && p.y < L.H * 0.85) {
				const m = Math.hypot(p.vx, p.vy) || 1;
				shoot = { x: p.x, y: p.y, dx: p.vx / m, dy: Math.min(p.vy / m, 0.6), age: 0 };
				const mm = Math.hypot(shoot.dx, shoot.dy); shoot.dx /= mm; shoot.dy /= mm; lastShot = T;
			}
		},
		draw(g) {
			if (!shoot) return;
			const e = shoot.age / 0.9, a = Math.sin(Math.min(1, e) * Math.PI) * 0.8, len = 110;
			const x2 = shoot.x - shoot.dx * len, y2 = shoot.y - shoot.dy * len;
			const gr = g.createLinearGradient(shoot.x, shoot.y, x2, y2);
			const c = dark ? "225,235,255" : "70,100,175";
			gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
			g.strokeStyle = gr; g.lineWidth = 1.4; g.lineCap = "round";
			g.beginPath(); g.moveTo(shoot.x, shoot.y); g.lineTo(x2, y2); g.stroke();
		},
	};
}

export function makeTheme({ seed, weather = "none", dock = null, squiggle = {}, aurora = {}, edges = "constellation" }) {
	return function activate({ root, reducedMotion }) {
		const dark = isDark();
		const aur = vsAurora(root, { reduced: reducedMotion, ...aurora });
		const foot = vsFooter(root, { reducedMotion, seed, weather, dock });
		const layer = reducedMotion ? null : marginLayer(root, shootingStarFx(dark), { reduced: false, host: root.querySelector(".scenery-c"), dark });
		const sq = vsSquiggle(root, squiggle);
		const por = vsPortrait(root);
		// stars: more frequent, more varied in size and more visible at rest than #361-365; AST-tree edges and a rainbow tint wake near the cursor
		const sky = starrySky({ root, dark, reduced: reducedMotion, seed, sizeScale: 1, alphaScale: 0.9, rest: 0.65, density: 1.5, radius: 230, body: { density: 0.22, alpha: 0.35 }, edgeStyle: edges });
		window.__vs2 = { aur, foot }; // test hook
		return () => { sky(); por(); sq(); layer?.destroy(); foot?.destroy(); aur.destroy(); };
	};
}
