import { calmAurora, marginLayer, squiggleFx, glowSprite, rng, clamp, TAU, isDark, lerp } from "./_dl-c/kit.js";
import { valleyFooter } from "./_dl-c/valley.js";
import { starrySky } from "./_sky/stars.js";

// #347: a dark-sky margin star field (see _sky/stars.js) + a rare shooting star on a quick flick.
export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const sprites = (dark ? [[255, 238, 205], [235, 242, 255], [175, 205, 255]] : [[70, 100, 175], [100, 90, 185], [50, 130, 170]]).map((c) => glowSprite(c, 48, { cross: dark ? 0.9 : 0.6 }));
	let stars = [], shoot = null, lastShot = -99, T = 0;
	const rnd = rng(347), rr = rng(9001);
	const fx = {
		ambient: !reducedMotion,
		fps: () => (layer?.p.has && layer.p.still < 2.5 ? 30 : 4),
		init(L) {
			stars = [];
			const n = 0; // stars now come from starrySky
			for (const [x0, x1] of L.zones) {
				for (let i = 0; i < n; i++) {
					stars.push({
						x: lerp(x0 + 6, x1 - 6, rnd()), y: 10 + rnd() * (L.H - 20), rest: 0.05 + rnd() * 0.1, tmp: (rnd() * 3) | 0,
						r: 1.3 + rnd() * 1.6 + (rnd() < 0.08 ? 1.2 : 0), ph: rnd() * TAU, f: 0.5 + rnd() * 1.4, k: 0, big: rnd() < 0.3,
					});
				}
			}
		},
		onPointer(p, L) {
			if (!shoot && p.speed > 1700 && T - lastShot > 7 && rr() < 0.5 && (p.x < L.zones[0][1] || p.x > L.zones[1][0]) && p.y < L.H * 0.85) {
				const m = Math.hypot(p.vx, p.vy) || 1;
				shoot = { x: p.x, y: p.y, dx: p.vx / m, dy: Math.min(p.vy / m, 0.6) , age: 0 };
				const mm = Math.hypot(shoot.dx, shoot.dy); shoot.dx /= mm; shoot.dy /= mm;
				lastShot = T;
			}
		},
		step(dt, p, L) {
			T += dt;
			let busy = false;
			for (const s of stars) {
				let tgt = 0;
				if (p.has) { const d = Math.hypot(s.x - p.x, s.y - p.y); const k = clamp(1 - d / 220); tgt = k * k * (3 - 2 * k); }
				s.k += (tgt - s.k) * (1 - Math.exp(-dt * (tgt > s.k ? 7 : 2.5)));
				if (s.k > 0.01) busy = true;
			}
			if (shoot) { shoot.age += dt; shoot.x += shoot.dx * 720 * dt; shoot.y += shoot.dy * 720 * dt; if (shoot.age > 0.9) shoot = null; else busy = true; }
			return busy;
		},
		draw(g, t, L) {
			g.globalCompositeOperation = dark ? "lighter" : "source-over";
			for (const s of stars) {
				const tw = 0.72 + 0.28 * Math.sin(t * s.f + s.ph);
				const near = s.k * (0.55 + 0.45 * Math.sin(t * s.f * 3.1 + s.ph * 2));
				const a = Math.min(1, s.rest * tw + s.k * 0.55 + near * 0.3);
				const sz = s.r * 4.2 * (1 + s.k * 1.6);
				g.globalAlpha = a;
				const spr = sprites[s.tmp];
				g.drawImage(spr, s.x - sz / 2, s.y - sz / 2, sz, sz);
			}
			if (shoot) {
				const e = shoot.age / 0.9, a = Math.sin(Math.min(1, e) * Math.PI) * 0.95, len = 110;
				const x2 = shoot.x - shoot.dx * len, y2 = shoot.y - shoot.dy * len;
				const gr = g.createLinearGradient(shoot.x, shoot.y, x2, y2);
				const c = dark ? "225,235,255" : "70,100,175";
				gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
				g.globalAlpha = 1; g.strokeStyle = gr; g.lineWidth = 1.6; g.lineCap = "round";
				g.beginPath(); g.moveTo(shoot.x, shoot.y); g.lineTo(x2, y2); g.stroke();
				g.globalAlpha = a; g.fillStyle = dark ? "rgb(235,242,255)" : "rgb(70,100,175)"; g.beginPath(); g.arc(shoot.x, shoot.y, 1.3, 0, TAU); g.fill();
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
		},
	};
	const aur = calmAurora(root, { reduced: reducedMotion });
	const foot = valleyFooter(root, { reducedMotion });
	const layer = marginLayer(root, fx, { reduced: reducedMotion, host: root.querySelector(".scenery-c"), dark });
	const sq = squiggleFx(root, "stars");
	const sky = starrySky({ root, dark, reduced: reducedMotion, seed: 347 });
	return () => { sky(); sq(); layer.destroy(); foot?.destroy(); aur(); };
}
