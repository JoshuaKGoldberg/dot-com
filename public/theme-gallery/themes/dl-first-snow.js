import { calmAurora, marginLayer, squiggleFx, glowSprite, rng, clamp, TAU, isDark, lerp } from "./_dl-c/kit.js";
import { valleyFooter } from "./_dl-c/valley.js";

// #358: winter valley. Sparse snowflakes in the margins bounce off the cursor and settle on the footer treeline.
export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const spr = glowSprite(dark ? [235, 244, 255] : [128, 160, 200], 24);
	const rnd = rng(358), rk = rng(5);
	let flakes = [], extra = [];
	let foot = null, layer = null, pileDirty = false, tt = 0;
	const MAXP = 6;
	const mk = (L, z) => {
		const [x0, x1] = L.zones[z];
		return { z, x: lerp(x0 + 4, x1 - 4, rnd()), y: rnd() * L.H, vx: 0, vy: 0, r: 1.1 + rnd() * 1.5, ph: rnd() * TAU, f: 0.4 + rnd() * 0.6, tmp: false };
	};
	function footerPos() {
		const fr = foot.host.getBoundingClientRect(), lr = layer.canvas.getBoundingClientRect();
		return { x0: fr.left - lr.left, y0: fr.top - lr.top, vis: fr.top < lr.bottom + 40 && fr.bottom > lr.top };
	}
	function land(f, fp) {
		const pile = foot.pile; if (!pile) return;
		const i = clamp(Math.round((f.x - fp.x0) / 2), 1, pile.length - 2);
		pile[i] = Math.min(MAXP, pile[i] + 0.55); pile[i - 1] = Math.min(MAXP, pile[i - 1] + 0.3); pile[i + 1] = Math.min(MAXP, pile[i + 1] + 0.3);
		pileDirty = true;
	}
	const fx = {
		ambient: !reducedMotion,
		fps: 30,
		init(L) {
			flakes = []; extra = [];
			const n = clamp(Math.round(L.H / 55), 8, 20);
			L.zones.forEach((_, z) => { for (let i = 0; i < n; i++) flakes.push(mk(L, z)); });
		},
		step(dt, p, L) {
			tt += dt;
			const fp = foot && foot.surf ? footerPos() : null;
			let busy = false;
			// the cursor sweeping the footer knocks loose snow off the treeline
			if (fp && fp.vis && p.has && p.speed > 450 && foot.pile) {
				const ci = Math.round((p.x - fp.x0) / 2);
				for (let i = Math.max(1, ci - 22); i < Math.min(foot.pile.length - 1, ci + 22); i++) {
					const sy = fp.y0 + foot.surf[i];
					if (Math.abs(p.y - sy) < 60 && foot.pile[i] > 1.4 && rk() < 0.12 && extra.length < 14) {
						foot.pile[i] -= 0.9; pileDirty = true;
						const ex = fp.x0 + i * 2;
						extra.push({ z: ex < L.W / 2 ? 0 : 1, x: ex, y: sy - foot.pile[i] - 2, vx: p.vx * 0.12 + (rk() - 0.5) * 30, vy: -30 - rk() * 30, r: 1 + rk() * 1.2, ph: rk() * TAU, f: 0.6, tmp: true });
					}
				}
			}
			for (const f of flakes.concat(extra)) {
				const tvx = Math.sin(f.ph + tt * f.f) * 9, tvy = 13 + f.r * 7;
				const k = 1 - Math.exp(-dt * 1.3);
				f.vx += (tvx - f.vx) * k; f.vy += (tvy - f.vy) * k;
				if (p.has) {
					const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy);
					if (d < 95) {
						const w = (1 - d / 95) ** 2;
						f.vx += (dx / (d + 1) * 260 + p.vx * 0.45) * w * dt * 6; f.vy += (dy / (d + 1) * 260 + p.vy * 0.45) * w * dt * 6;
					}
				}
				f.x += f.vx * dt; f.y += f.vy * dt;
				const [x0, x1] = L.zones[f.z];
				if (f.x < x0 + 2 || f.x > x1 - 2) {
					if (f.tmp) f.dead = true; else { f.x = clamp(f.x, x0 + 2, x1 - 2); f.vx *= -0.5; }
				}
				let landed = false;
				if (fp && foot.surf) {
					const i = clamp(Math.round((f.x - fp.x0) / 2), 0, foot.surf.length - 1);
					const floor = fp.y0 + foot.surf[i] - (foot.pile ? foot.pile[i] : 0);
					if (f.y + f.r * 0.5 >= floor && f.y < floor + 30 && f.vy > 0) { land(f, fp); landed = true; }
				}
				if (landed || f.y > L.H + 6) {
					if (f.tmp) f.dead = true;
					else { f.y = -6; f.x = lerp(x0 + 4, x1 - 4, rnd()); f.vx = 0; f.vy = 10; }
				}
				if (!f.dead) busy = true;
			}
			if (extra.length) extra = extra.filter((e) => !e.dead);
			if (pileDirty && reducedMotion) { pileDirty = false; foot?.loop?.redraw(); }
			return busy;
		},
		draw(g) {
			g.globalAlpha = dark ? 0.85 : 0.75;
			for (const f of flakes.concat(extra)) {
				const sz = f.r * 5.5;
				g.drawImage(spr, f.x - sz / 2, f.y - sz / 2, sz, sz);
			}
			g.globalAlpha = 1;
		},
	};
	// settled snow, painted onto the footer's own overlay canvas so it scrolls with the treeline
	const hooks = {
		onBuild(api) {
			if (!api.pile) return;
			const r = rng(11);
			for (let i = 0; i < api.pile.length; i++) api.pile[i] = 1.1 + 0.9 * Math.sin(i * 0.31) * Math.sin(i * 0.07 + 1) + r() * 0.8;
		},
		overlay(g, t, dt, api) {
			const pile = api.pile, surf = api.surf; if (!pile || !surf) return;
			const n = pile.length;
			const hAt = (i) => (pile[Math.max(0, i - 1)] + pile[i] * 2 + pile[Math.min(n - 1, i + 1)]) / 4;
			g.fillStyle = dark ? "rgba(224,236,252,.95)" : "rgba(255,255,255,.98)";
			g.beginPath();
			g.moveTo(0, surf[0] + 1);
			for (let i = 0; i < n; i++) g.lineTo(i * 2, surf[i] - hAt(i));
			for (let i = n - 1; i >= 0; i--) g.lineTo(i * 2, surf[i] + 1.5);
			g.closePath(); g.fill();
			if (!dark) {
				g.strokeStyle = "rgba(130,160,190,.45)"; g.lineWidth = 0.6; g.beginPath();
				for (let i = 0; i < n; i++) { if (i) g.lineTo(i * 2, surf[i] - hAt(i)); else g.moveTo(0, surf[0] - hAt(0)); }
				g.stroke();
			}
		},
	};
	const aur = calmAurora(root, { reduced: reducedMotion });
	foot = valleyFooter(root, { reducedMotion, winter: true, hooks });
	layer = marginLayer(root, fx, { reduced: reducedMotion, host: root.querySelector(".overlay-a"), dark });
	const sq = squiggleFx(root, "snow");
	return () => { sq(); layer.destroy(); foot?.destroy(); aur(); };
}
