import { createJourney, stops, rng, clamp, lerp, smooth, hex, mix, rgb } from "./_scroll/lib.js";

const SKY = [
	[0, "#060b1f", "#0d1431", "#1b2447"],
	[4.6, "#070d24", "#16204a", "#2a3466"],
	[5.6, "#2c3b6e", "#9a6f9c", "#ff9a68"],
	[7.2, "#5f8fcf", "#a9c6e0", "#ffd7a2"],
	[11, "#3b7bd2", "#82b8e8", "#c4e3f6"],
	[15.5, "#4a86d0", "#8fc0e6", "#f2e4bd"],
	[18.2, "#5272b6", "#e09a78", "#ffb868"],
	[19.4, "#3a3a7a", "#b5507a", "#ff6a3a"],
	[20.5, "#141845", "#4c3a72", "#8a4f7e"],
	[22, "#060a1c", "#0f1838", "#1b2650"],
	[24, "#060b1f", "#0d1431", "#1b2447"],
].map(([h, a, b, c]) => [h, hex(a), hex(b), hex(c)]);

const DAY = ["#8fa9c4", "#557f84", "#2f5a4a", "#183b32"].map(hex);
const NIGHT = ["#1a2347", "#121b3a", "#0b1228", "#060a18"].map(hex);
const FOG = [0.62, 0.4, 0.2, 0.06];

function skyAt(h) {
	let i = 0;
	while (i < SKY.length - 2 && h > SKY[i + 1][0]) i++;
	const a = SKY[i], b = SKY[i + 1];
	const t = smooth(0, 1, (h - a[0]) / (b[0] - a[0]));
	return [mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t)];
}
const fmt = (h) => {
	let hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
	const ap = hh >= 12 && hh < 24 ? "PM" : "AM";
	hh = hh % 12 || 12;
	return `${hh}:${String(mm).padStart(2, "0")} ${ap}`;
};
const LIGHT = { "--siteBg": hex("#fdffff"), "--siteFg": hex("#283556"), "--siteFgStrong": hex("#142842"), "--siteMuted": hex("#5b6b8c"), "--siteAccent": hex("#0f66bf"), "--siteSubtle": hex("#d7e9ef") };
const DARKV = { "--siteBg": hex("#0b1220"), "--siteFg": hex("#dae7f3"), "--siteFgStrong": hex("#f1f6fb"), "--siteMuted": hex("#a3b4cc"), "--siteAccent": hex("#7fc0ff"), "--siteSubtle": hex("#12304a") };

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const overlay = root.querySelector(".overlay-b");
	const hud = document.createElement("div");
	hud.className = "tl-hud";
	hud.setAttribute("aria-hidden", "true");
	overlay.append(hud);
	let ridges, trees, stars, clouds, hourOf, lastN = -1, shoot = { t: -99, x: 0, y: 0 };

	function build(S) {
		const r = rng(77);
		const W = S.cssW, H = S.cssH;
		ridges = [0, 1, 2, 3].map((k) => {
			const pts = [];
			const ph = r() * 20;
			for (let x = -10; x <= W + 20; x += 8) {
				const u = x / W;
				const peak = k === 0 ? Math.pow(Math.abs(Math.sin(u * 3.1 + ph)), 1.5) * 0.9 + Math.sin(u * 13 + ph) * 0.06 : Math.sin(u * (2 + k) + ph) * 0.5 + 0.5 + Math.sin(u * (9 + k * 5) + ph * 2) * 0.09;
				pts.push([x, H * (0.62 - [0.2, 0.12, 0.06, 0.02][k] - peak * [0.11, 0.08, 0.06, 0.05][k])]);
			}
			return pts;
		});
		trees = [];
		for (let side = 0; side < 2; side++) {
			for (let i = 0; i < 9; i++) {
				const near = i < 3;
				trees.push({ x: side ? W - r() * W * 0.14 : r() * W * 0.14, h: (near ? 260 : 150) + r() * 140, w: (near ? 70 : 45) + r() * 25 });
			}
		}
		stars = Array.from({ length: 190 }, () => ({ x: r() * W, y: r() * H * 0.55, s: r() * 1.5 + 0.4, ph: r() * 7 }));
		clouds = Array.from({ length: 7 }, () => ({ x: r() * W, y: H * (0.08 + r() * 0.3), s: 60 + r() * 90, v: 3 + r() * 6 }));
		hourOf = stops(S.anchors, [5.3, 8.4, 12.3, 16.4, 19.5, 22.9]);
	}

	function draw(S) {
		const c = S.ctx, W = S.cssW, H = S.cssH, hy = H * 0.62;
		if (!ridges) build(S);
		c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
		const h = hourOf(S.p);
		const [top, midc, hor] = skyAt(h);
		const dimk = dark ? 0.55 : 1;
		const tone = (col) => (dark ? mix(col, [8, 12, 30], 0.42) : col);
		// sun elevation 0..1 ; day light factor
		const sunA = ((h - 6) / 12) * Math.PI;
		const sunUp = Math.sin(sunA);
		const L = smooth(-0.1, 0.35, sunUp);
		const sg = c.createLinearGradient(0, 0, 0, hy);
		sg.addColorStop(0, rgb(tone(top)));
		sg.addColorStop(0.55, rgb(tone(midc)));
		sg.addColorStop(1, rgb(tone(hor)));
		c.fillStyle = sg;
		c.fillRect(0, 0, W, hy + 2);
		const night = 1 - smooth(-0.25, 0.1, sunUp);
		const nightLate = h > 12 ? 1 : 1;
		// stars
		if (night > 0.02) {
			c.fillStyle = "#fff";
			for (const s of stars) {
				c.globalAlpha = night * (0.35 + 0.65 * Math.sin(S.t * 1.7 + s.ph) ** 2) * smooth(hy, hy * 0.2, s.y + 0);
				c.fillRect(s.x, s.y, s.s, s.s);
			}
			c.globalAlpha = 1;
			if (!reducedMotion && S.t - shoot.t > 6.5 && night > 0.8) shoot = { t: S.t, x: W * (0.2 + Math.random() * 0.6), y: H * 0.12 };
			const st = S.t - shoot.t;
			if (!reducedMotion && st < 0.8) {
				c.strokeStyle = `rgba(255,255,255,${0.9 * (1 - st / 0.8)})`;
				c.lineWidth = 1.6;
				c.beginPath();
				c.moveTo(shoot.x + st * 380, shoot.y + st * 160);
				c.lineTo(shoot.x + st * 380 - 70, shoot.y + st * 160 - 30);
				c.stroke();
			}
		}
		// sun + moon
		const sx = W / 2 - Math.cos(sunA) * W * 0.55;
		const sy = hy - sunUp * H * 0.5;
		const mA = sunA + Math.PI;
		const moonUp = Math.sin(mA);
		const mx = W / 2 - Math.cos(mA) * W * 0.55;
		const my = hy - moonUp * H * 0.46;
		const bodies = [];
		if (sunUp > -0.15) bodies.push([sx, sy, "sun", sunUp]);
		if (moonUp > -0.05) bodies.push([mx, my, "moon", moonUp]);
		for (const [x, y, kind, up] of bodies) {
			const warm = kind === "sun" ? 1 - smooth(0.05, 0.5, up) : 0;
			const col = kind === "sun" ? [255, 235 - warm * 80, 190 - warm * 120] : [225, 235, 255];
			const R = kind === "sun" ? 340 : 160;
			const g = c.createRadialGradient(x, y, 0, x, y, R);
			g.addColorStop(0, rgb(col, kind === "sun" ? 0.9 : 0.5));
			g.addColorStop(0.1, rgb(col, kind === "sun" ? 0.4 : 0.22));
			g.addColorStop(1, rgb(col, 0));
			c.fillStyle = g;
			c.fillRect(x - R, y - R, R * 2, R * 2);
			c.fillStyle = rgb(kind === "sun" ? [255, 250 - warm * 70, 225 - warm * 120] : [240, 244, 255]);
			c.beginPath();
			c.arc(x, y, kind === "sun" ? 26 : 20, 0, 7);
			c.fill();
			if (kind === "moon") {
				c.fillStyle = rgb(tone(midc), 0.85);
				c.beginPath();
				c.arc(x + 9, y - 3, 17, 0, 7);
				c.fill();
			}
		}
		// clouds
		const cloudCol = mix([255, 255, 255], hor, 0.35 + 0.4 * (1 - L));
		for (const k of clouds) {
			const x = ((k.x + (reducedMotion ? 0 : S.t * k.v)) % (W + 400)) - 200;
			c.fillStyle = rgb(mix(cloudCol, [20, 24, 50], night * 0.8 + (dark ? 0.15 : 0)), 0.5 * (0.4 + L * 0.6) + 0.15);
			for (let i = 0; i < 5; i++) {
				c.beginPath();
				c.ellipse(x + (i - 2) * k.s * 0.34, k.y + (i % 2) * 5 - Math.abs(i - 2) * 5, k.s * 0.38, k.s * 0.16, 0, 0, 7);
				c.fill();
			}
		}
		// lake
		const lg = c.createLinearGradient(0, hy, 0, H);
		lg.addColorStop(0, rgb(tone(mix(hor, [40, 80, 100], 0.2))));
		lg.addColorStop(1, rgb(tone(mix(top, [10, 30, 50], 0.45))));
		c.fillStyle = lg;
		c.fillRect(0, hy, W, H - hy);
		// ridges + reflections
		const ridgeCols = ridges.map((_, k) => {
			const base = mix(NIGHT[k], DAY[k], L);
			return tone(mix(base, hor, FOG[k] * (0.45 + 0.55 * (1 - Math.abs(L - 0.4)))));
		});
		for (let pass = 0; pass < 2; pass++) {
			c.save();
			if (pass === 1) {
				c.beginPath();
				c.rect(0, hy, W, H - hy);
				c.clip();
				c.translate(0, hy * 2);
				c.scale(1, -1);
				c.globalAlpha = 0.38;
			}
			ridges.forEach((pts, k) => {
				c.fillStyle = rgb(ridgeCols[k]);
				c.beginPath();
				c.moveTo(-10, hy + 2 + (pass ? 40 : 0));
				for (const [x, y] of pts) c.lineTo(x, y);
				c.lineTo(W + 20, hy + 2 + (pass ? 40 : 0));
				c.closePath();
				c.fill();
			});
			c.restore();
		}
		// glitter column
		const gx = sunUp > 0 ? sx : moonUp > 0 ? mx : -1;
		if (gx >= 0) {
			const intensity = sunUp > 0 ? Math.min(1, sunUp * 3) : moonUp * 0.8;
			c.fillStyle = sunUp > 0 ? `rgba(255,236,190,${0.55 * intensity})` : `rgba(215,228,255,${0.5 * intensity})`;
			for (let y = hy + 6; y < H; y += 7) {
				const f = (y - hy) / (H - hy);
				const wob = Math.sin(y * 0.4 + (reducedMotion ? 0 : S.t * 2)) * (4 + f * 30);
				const wd = (10 + f * 90) * (0.4 + 0.6 * Math.abs(Math.sin(y * 1.7)));
				c.fillRect(gx - wd / 2 + wob, y, wd, 1.6);
			}
		}
		// foreground pines
		const pc = tone(mix(mix(NIGHT[3], [10, 28, 24], L), hor, 0.05));
		for (const t of trees) {
			c.fillStyle = rgb(pc);
			c.beginPath();
			const base = H + 10, tip = base - t.h;
			c.moveTo(t.x, tip);
			for (let k = 1; k <= 6; k++) {
				const y = tip + (t.h * k) / 6;
				c.lineTo(t.x + (t.w * k) / 12 + 3, y - 8);
				c.lineTo(t.x + (t.w * k) / 22, y - 8);
			}
			for (let k = 6; k >= 1; k--) {
				const y = tip + (t.h * k) / 6;
				c.lineTo(t.x - (t.w * k) / 22, y - 8);
				c.lineTo(t.x - (t.w * k) / 12 - 3, y - 8);
			}
			c.closePath();
			c.fill();
		}
		// vignette of warmth at horizon during golden hours
		const glow = (1 - Math.abs(sunUp - 0.1) * 2.5) * (sunUp > -0.2 && sunUp < 0.45 ? 1 : 0);
		if (glow > 0) {
			const gg = c.createRadialGradient(sx, hy, 0, sx, hy, W * 0.7);
			gg.addColorStop(0, `rgba(255,150,80,${0.26 * clamp(glow)})`);
			gg.addColorStop(1, "rgba(255,150,80,0)");
			c.fillStyle = gg;
			c.fillRect(0, hy - H * 0.4, W, H * 0.6);
		}
		hud.textContent = `${fmt(h)}`;
		hud.dataset.phase = night > 0.7 ? "night" : L < 0.6 ? (h < 12 ? "dawn" : "dusk") : "day";
		// page colours follow the light in light mode
		if (!dark) {
			const n = Math.round(clamp((night * 0.9 + (1 - L) * 0.25) * 1.15) * 25) / 25;
			if (n !== lastN) {
				lastN = n;
				for (const key of Object.keys(LIGHT)) {
					const v = mix(LIGHT[key], DARKV[key], n);
					root.style.setProperty(key, `rgb(${v[0] | 0} ${v[1] | 0} ${v[2] | 0})`);
				}
			}
		}
	}
	const journey = createJourney(root, { reducedMotion, dark, scale: 1, maxDpr: 1.25, maxPixels: 2.4e6, ambientFps: 20, follow: 9, draw });
	return () => journey.destroy();
}
