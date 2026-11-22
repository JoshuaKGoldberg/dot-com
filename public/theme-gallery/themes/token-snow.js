// #205 Token Snowfall. Winter at the lake: each snowflake is grown with six-fold symmetry from a code token
// (every character of the token adds a branch), and the snowfall rate follows the weather parameter.
//
// Parameters (see _adk/kit.js): { seed, date, hour, season, weather, wind, latitude, longitude, tz }
//   plus `intensity` (0..1, default 0.6): how hard it snows when weather is "snow".
//   Defaults for this theme: season "winter", weather "snow" (the concept needs snow); hour comes from the clock.
//   Weather -> rate: snow = intensity, cloudy = flurries, fog = a few drifting flakes, clear/rain = none.
// generate(params) is pure: flake positions, depths and token assignments. flakeSpec(token) is pure too.
import { mountScene, rng, hashStr, css, mix, mul, clamp, lerp, paintPine, paintPineBand } from "./_adk/kit.js";
import { paintLakeScene } from "./_adk/lake.js";

export const TOKENS = ["const", "=>", "async", "?.", "<T>", "===", "{}", "let", "await", "...", "!==", "??", "typeof", "keyof", "infer", "enum", "satisfies", "|>"];

// Every character adds one branch: its code decides where on the arm, how long, and which way it forks.
export function flakeSpec(token) {
	const h = hashStr(token);
	const arms = [];
	for (let i = 0; i < token.length; i++) {
		const c = token.charCodeAt(i);
		arms.push({ at: 0.22 + ((c % 7) / 7) * 0.6, len: 0.16 + ((c % 5) / 5) * 0.28, ang: 0.6 + ((c >> 2) % 4) * 0.12 });
	}
	return { token, arms, tip: h % 3, plate: (h >> 3) % 2 === 0, core: 0.1 + ((h >> 5) % 4) * 0.03 };
}

const cache = new Map();
function flakeSprite(token, dpr, dark) {
	const key = `${token}|${dpr}|${dark}`;
	if (cache.has(key)) return cache.get(key);
	const S = 96;
	const c = document.createElement("canvas");
	c.width = Math.round(S * dpr);
	c.height = Math.round(S * dpr);
	const g = c.getContext("2d");
	g.scale(dpr, dpr);
	g.translate(S / 2, S / 2);
	const spec = flakeSpec(token);
	const R = S * 0.46;
	g.strokeStyle = dark ? "rgba(236,244,255,0.95)" : "rgba(255,255,255,0.98)";
	g.lineCap = "round";
	const shadow = dark ? "rgba(150,180,255,0.0)" : "rgba(80,110,150,0.55)";
	for (const pass of dark ? [1] : [0, 1]) {
		g.strokeStyle = pass === 0 ? shadow : dark ? "rgba(236,244,255,0.95)" : "rgba(255,255,255,1)";
		g.lineWidth = pass === 0 ? 3.4 : 1.8;
		for (let a = 0; a < 6; a++) {
			g.save();
			g.rotate((a * Math.PI) / 3);
			g.beginPath();
			g.moveTo(0, 0);
			g.lineTo(0, -R);
			for (const arm of spec.arms) {
				const y = -R * arm.at;
				const l = R * arm.len;
				g.moveTo(0, y);
				g.lineTo(Math.sin(arm.ang) * l, y - Math.cos(arm.ang) * l);
				g.moveTo(0, y);
				g.lineTo(-Math.sin(arm.ang) * l, y - Math.cos(arm.ang) * l);
			}
			if (spec.tip === 0) {
				g.moveTo(-3, -R + 4);
				g.lineTo(0, -R - 3);
				g.lineTo(3, -R + 4);
			} else if (spec.tip === 1) {
				g.moveTo(0, -R);
				g.lineTo(0, -R - 5);
			}
			g.stroke();
			g.restore();
		}
		if (spec.plate) {
			g.beginPath();
			for (let a = 0; a < 6; a++) {
				const ang = (a * Math.PI) / 3;
				g.lineTo(Math.sin(ang) * R * spec.core * 3, -Math.cos(ang) * R * spec.core * 3);
			}
			g.closePath();
			if (pass === 1) {
				g.fillStyle = dark ? "rgba(236,244,255,0.55)" : "rgba(255,255,255,0.8)";
				g.fill();
			}
			g.stroke();
		}
	}
	cache.set(key, c);
	return c;
}

export function generate(p) {
	const rand = rng(p.seed * 67 + 3);
	const intensity = clamp(p.intensity ?? 0.6);
	const rate = { snow: intensity, cloudy: 0.12, fog: 0.08, clear: 0, rain: 0 }[p.weather];
	const n = Math.round(95 * rate);
	const flakes = Array.from({ length: n }, () => ({ x: rand(), y: rand(), d: 0.25 + 0.75 * Math.pow(rand(), 1.4), tok: TOKENS[(rand() * TOKENS.length) | 0], ph: rand() * 6.28, rot: rand() * 6.28, spin: (rand() - 0.5) * 0.6 }));
	const dust = Array.from({ length: Math.round(220 * rate) }, () => ({ x: rand(), y: rand(), r: 0.6 + rand() * 1.3, v: 14 + rand() * 24, ph: rand() * 6.28 }));
	const featured = { token: TOKENS[(rand() * TOKENS.length) | 0], x: 0.86 + rand() * 0.08, ph: rand() };
	return { flakes, dust, featured, rate };
}

export function activate({ root, mode, reducedMotion }) {
	return mountScene(root, {
		id: "token-snow",
		mode,
		reducedMotion,
		fx: false,
		defaults: { season: "winter", weather: "snow" },
		controls: [{ key: "intensity", label: "Snowfall", min: 0, max: 1, step: 0.05, default: 0.6 }],
		generate,
		horizon: 0.62,
		paint(ctx, scene, view, env) {
			const lake = paintLakeScene(ctx, view, env, { horizon: 0.62 });
			const H = view.h;
			const rand = rng(env.p.seed * 5 + 9);
			// snowy shore pines, big in the corners
			const snowC = env.lit([244, 247, 252], 0.9);
			const g = mix(env.lit(env.land.conifer), env.haze, env.fog * 0.3);
			for (const [x, h, k] of [[0.03, 0.46, 1], [0.1, 0.34, 0.9], [0.17, 0.22, 0.8], [0.97, 0.5, 1], [0.9, 0.36, 0.9], [0.83, 0.24, 0.8]]) {
				paintPine(ctx, x * view.w, H * (0.86 + (1 - k) * 0.1) + 14, H * h, mix(g, [6, 16, 14], 0.1 * (1 - k)), 1, snowC, (rand() - 0.5) * 0.04);
			}
			// snow banks
			for (const [cx, w, y] of [[0.02, 0.36, 0.95], [0.98, 0.36, 0.96]]) {
				const sg = ctx.createLinearGradient(0, H * y - 40, 0, H);
				sg.addColorStop(0, css(env.lit([248, 250, 254], 0.9)));
				sg.addColorStop(1, css(env.lit([196, 210, 230], 0.9)));
				ctx.fillStyle = sg;
				ctx.beginPath();
				ctx.ellipse(cx * view.w, H * y + 30, w * view.w, 70, 0, Math.PI, 0);
				ctx.fill();
				ctx.fillRect((cx - w) * view.w, H * y + 30, 2 * w * view.w, H);
			}
			void lake;
			void paintPineBand;
		},
		frame(ctx, scene, view, env, t, dt, still) {
			const dark = env.tone === "dark";
			const wind = env.wind;
			// distant flurry dust
			ctx.fillStyle = dark ? "rgba(230,238,255,0.7)" : "rgba(255,255,255,0.9)";
			ctx.beginPath();
			for (const d of scene.dust) {
				const tt = still ? 0 : t;
				const y = ((d.y * view.h + tt * d.v) % (view.h + 10)) - 5;
				const x = (d.x * view.w + Math.sin(tt * 0.7 + d.ph) * 14 + tt * wind * 22) % view.w;
				ctx.moveTo(x + d.r, y);
				ctx.arc(x, y, d.r, 0, 6.2832);
			}
			ctx.fill();
			const dpr = view.dpr;
			for (const f of scene.flakes) {
				const tt = still ? 0 : t;
				const sp = sprite(f.tok);
				const speed = 18 + 54 * f.d;
				const y = ((f.y * view.h + tt * speed) % (view.h + 80)) - 40;
				const x = ((f.x * view.w + Math.sin(tt * 0.6 + f.ph) * (16 + 22 * f.d) + tt * wind * (20 + 30 * f.d)) % (view.w + 80) + view.w + 80) % (view.w + 80) - 40;
				const size = 14 + 48 * f.d;
				const rot = f.rot + tt * f.spin * (0.4 + f.d);
				ctx.globalAlpha = 0.5 + 0.45 * f.d;
				const c = Math.cos(rot) * (size / 96);
				const s = Math.sin(rot) * (size / 96);
				ctx.setTransform(c * dpr, s * dpr, -s * dpr, c * dpr, x * dpr, y * dpr);
				ctx.drawImage(sp, -48, -48, 96, 96);
			}
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.globalAlpha = 1;
			// the featured flake, with the token it was grown from
			if (scene.rate > 0 || still) {
				const F = scene.featured;
				const tt = still ? 8 : t;
				const y = ((tt * 11 + F.ph * view.h) % (view.h + 200)) - 100;
				const x = F.x * view.w + Math.sin(tt * 0.3) * 12;
				const rot = tt * 0.08;
				const c = Math.cos(rot) * 1.3;
				const s = Math.sin(rot) * 1.3;
				ctx.globalAlpha = 0.9;
				ctx.setTransform(c * dpr, s * dpr, -s * dpr, c * dpr, x * dpr, y * dpr);
				ctx.drawImage(sprite(F.token), -48, -48, 96, 96);
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
				ctx.globalAlpha = 1;
				ctx.font = "11px ui-monospace, Menlo, monospace";
				ctx.textAlign = "center";
				ctx.fillStyle = css(env.ink, 0.75);
				ctx.fillText(`${F.token}  →  ${flakeSpec(F.token).arms.length} branch pairs`, x, y + 76);
				ctx.textAlign = "left";
			}
			function sprite(tok) {
				return flakeSprite(tok, dpr, dark);
			}
		},
	});
}
