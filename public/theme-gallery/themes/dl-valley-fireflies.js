import { calmAurora, marginLayer, squiggleFx, glowSprite, rng, clamp, TAU, isDark, lerp, toZone } from "./_dl-c/kit.js";
import { valleyFooter } from "./_dl-c/valley.js";

// #348: fireflies in the margins wander and blink; they gather toward a resting cursor (at the column's edge, never over the text).
export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const glow = glowSprite(dark ? [255, 205, 80] : [236, 160, 20], 64);
	const core = glowSprite(dark ? [255, 248, 210] : [255, 214, 110], 16);
	let flies = [];
	const rnd = rng(348);
	let T = 0;
	const fx = {
		ambient: !reducedMotion,
		fps: 30,
		init(L) {
			flies = [];
			const n = clamp(Math.round(L.H / 120), 4, 9);
			L.zones.forEach(([x0, x1], zi) => {
				for (let i = 0; i < n; i++) flies.push({ z: zi, x: lerp(x0 + 20, x1 - 20, rnd()), y: lerp(40, L.H - 20, rnd()), vx: 0, vy: 0, h: rnd() * TAU, ph: rnd() * TAU, f: 0.18 + rnd() * 0.22, sz: 0.8 + rnd() * 0.5 });
			});
		},
		step(dt, p, L) {
			T += dt;
			const rest = p.has && p.still > 0.35 && p.speed < 60;
			const side = p.x < L.W / 2 ? 0 : 1;
			for (const f of flies) {
				const [x0, x1] = L.zones[f.z];
				f.h += (Math.sin(T * 0.7 + f.ph * 3) + Math.sin(T * 1.3 + f.ph)) * 0.9 * dt;
				let ax = Math.cos(f.h) * 26, ay = Math.sin(f.h) * 26;
				if (p.has && f.z === side) {
					const tx = clamp(toZone(L, p.x) + (side ? 22 : -22), x0 + 12, x1 - 12), ty = p.y;
					const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) + 1;
					if (rest) {
						const pull = Math.min(1, p.still / 1.2) * (d > 40 ? 42 : 14);
						ax += dx / d * pull + (-dy / d) * 14; ay += dy / d * pull + (dx / d) * 14;
					} else if (p.speed > 500) {
						const fd = Math.hypot(f.x - p.x, f.y - p.y);
						if (fd < 150) { const k = (1 - fd / 150) * 220; ax += (f.x - p.x) / (fd + 1) * k; ay += (f.y - p.y) / (fd + 1) * k; }
					}
				}
				f.vx += (ax - f.vx) * (1 - Math.exp(-dt * 1.4)); f.vy += (ay - f.vy) * (1 - Math.exp(-dt * 1.4));
				f.x += f.vx * dt; f.y += f.vy * dt;
				if (f.x < x0 + 6) { f.x = x0 + 6; f.h = Math.PI - f.h; } else if (f.x > x1 - 6) { f.x = x1 - 6; f.h = Math.PI - f.h; }
				if (f.y < 8) { f.y = 8; f.h = -f.h; } else if (f.y > L.H - 8) { f.y = L.H - 8; f.h = -f.h; }
			}
			return rest || p.speed > 20 || p.still < 1.5;
		},
		draw(g, t, L, p) {
			g.globalCompositeOperation = dark ? "lighter" : "source-over";
			for (const f of flies) {
				const ph = (t * f.f + f.ph / TAU) % 1;
				let b = ph < 0.55 ? Math.pow(Math.sin((ph / 0.55) * Math.PI), 1.6) : 0;   // slow pulse, then a dark rest
				if (reducedMotion) b = 0.75;
				const a = 0.12 + 0.88 * b;
				const sz = 46 * f.sz * (0.7 + 0.4 * b);
				g.globalAlpha = a * (dark ? 0.85 : 0.7);
				g.drawImage(glow, f.x - sz / 2, f.y - sz / 2, sz, sz);
				g.globalAlpha = a;
				const c = 9 * f.sz; g.drawImage(core, f.x - c / 2, f.y - c / 2, c, c);
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
		},
	};
	const aur = calmAurora(root, { reduced: reducedMotion });
	const foot = valleyFooter(root, { reducedMotion });
	const layer = marginLayer(root, fx, { reduced: reducedMotion, host: root.querySelector(".overlay-a"), dark });
	const sq = squiggleFx(root, "fireflies");
	return () => { sq(); layer.destroy(); foot?.destroy(); aur(); };
}
