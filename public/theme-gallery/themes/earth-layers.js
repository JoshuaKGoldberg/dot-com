import { createJourney, stops, rng, clamp, lerp, smooth } from "./_scroll/lib.js";

const HV = 5.6; // world height in viewport heights
const GROUND = 2.3;
const ZONES = [
	[0, "Sky", 0],
	[1.0, "Canopy", 0],
	[1.95, "Forest floor", 0],
	[2.38, "Topsoil", 0],
	[3.1, "Bedrock", 0],
	[4.4, "Mantle", 0],
	[5.3, "Core", 0],
];

function pal(dark) {
	return dark
		? {
				grad: [[0, "#050a1e"], [0.12, "#101c3c"], [0.17, "#1a2a4a"], [0.2, "#0b1a1c"], [0.33, "#071312"], [0.41, "#2c1e17"], [0.55, "#2a2528"], [0.7, "#2d2026"], [0.8, "#6d1b12"], [0.92, "#e05a14"], [1, "#ffd25a"]],
				far: ["#16244a", "#1b2b52"], crown: ["#0b2220", "#0e2c27", "#133832"], trunk: "#21160f", trunkHi: "#3a281a", litter: ["#6b3a1a", "#8a5a22", "#4e3a1c"], soil: "#150e0a", pebble: "#4a4f58", strata: ["#4a3f48", "#373d4b", "#5a4a40", "#3d4040", "#2b2a35"], fossil: "#b7ad98", ray: "rgba(150,190,255,0.05)",
			}
		: {
				grad: [[0, "#5d93d2"], [0.12, "#9cc4ea"], [0.17, "#e3e8ea"], [0.2, "#4d7d4e"], [0.33, "#2c5036"], [0.41, "#7a5236"], [0.55, "#8e7d70"], [0.7, "#9a6a54"], [0.8, "#b5381c"], [0.92, "#f27a1c"], [1, "#fff0a0"]],
				far: ["#8fb0cf", "#7aa0c0"], crown: ["#2d6a45", "#245a3c", "#1b4a33"], trunk: "#4a3322", trunkHi: "#7b5a3c", litter: ["#b0702c", "#c88a38", "#8a5a24"], soil: "#4a2f1c", pebble: "#9a9a9a", strata: ["#c9a48b", "#8f97a3", "#d6b583", "#b9b8a8", "#615f6e"], fossil: "#f0e6cf", ray: "rgba(255,240,170,0.13)",
			};
}

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const P = pal(dark);
	const overlay = root.querySelector(".overlay-b");
	const hud = document.createElement("div");
	hud.className = "el-hud";
	hud.setAttribute("aria-hidden", "true");
	const gauge = document.createElement("div");
	gauge.className = "el-gauge";
	gauge.setAttribute("aria-hidden", "true");
	gauge.innerHTML = "<i></i>";
	overlay.append(hud, gauge);

	// speckle pattern (baked once)
	const tile = document.createElement("canvas");
	tile.width = tile.height = 96;
	{
		const t = tile.getContext("2d");
		const r = rng(5);
		for (let i = 0; i < 160; i++) {
			t.fillStyle = r() < 0.5 ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.09)";
			const s = 1 + r() * 2.2;
			t.fillRect(r() * 96, r() * 96, s, s);
		}
	}
	let pattern = null;
	let F = null; // features
	let camToY;

	function build(S) {
		const vh = S.cssH;
		const W = S.cssW;
		const r = rng(42);
		F = { crowns: [[], [], []], trunks: [], roots: [], pebbles: [], mush: [], litter: [], veins: [], fossils: [], strata: [], stars: [], clouds: [], embers: [], rays: [], bands: [] };
		for (let row = 0; row < 3; row++) {
			const step = 56 + row * 20;
			for (let x = -60; x < W + 80; x += step * (0.7 + r() * 0.6)) F.crowns[row].push({ x, h: (110 + r() * 90) * (1 + row * 0.25), w: (70 + r() * 40) * (1 + row * 0.2) });
		}
		for (let i = 0; i < 14; i++) F.trunks.push({ x: r() * W, w: 12 + r() * 26, row: i % 2, tone: r() });
		F.trunks.sort((a, b) => b.row - a.row);
		for (let i = 0; i < 7; i++) {
			const x0 = (i + 0.5) * (W / 7) + (r() - 0.5) * 80;
			const branches = [];
			const grow = (x, y, ang, len, w, d) => {
				const x2 = x + Math.cos(ang) * len;
				const y2 = y + Math.sin(ang) * len;
				branches.push([x, y, x2, y2, w]);
				if (d > 0 && w > 0.8) {
					grow(x2, y2, ang + 0.5 + r() * 0.5, len * 0.72, w * 0.6, d - 1);
					grow(x2, y2, ang - 0.5 - r() * 0.5, len * 0.72, w * 0.6, d - 1);
					if (r() < 0.5) grow(x2, y2, ang + (r() - 0.5) * 0.3, len * 0.8, w * 0.7, d - 1);
				}
			};
			grow(x0, 0, Math.PI / 2 + (r() - 0.5) * 0.5, vh * 0.12, 11, 4);
			F.roots.push(branches);
		}
		for (let i = 0; i < 70; i++) F.pebbles.push({ x: r() * W, y: GROUND + 0.1 + r() * 0.85, s: 3 + r() * 11, c: r() });
		for (let i = 0; i < 9; i++) F.mush.push({ x: r() * W, s: 12 + r() * 16, dots: [r(), r(), r()] });
		for (let i = 0; i < 90; i++) F.litter.push({ x: r() * W, dy: r() * 8, s: 5 + r() * 9, c: (r() * 3) | 0, a: r() * 3 });
		for (let i = 0; i < 11; i++) {
			const pts = [];
			let x = r() * W, y = 4.35 + r() * 1.2;
			for (let k = 0; k < 7; k++) {
				pts.push([x, y]);
				x += (r() - 0.5) * 140;
				y += 0.03 + r() * 0.11;
			}
			F.veins.push(pts);
		}
		for (let i = 0; i < 5; i++) F.fossils.push({ x: (i + 0.3 + r() * 0.4) * (W / 5), y: 3.25 + r() * 1.0, s: 18 + r() * 22, a: r() * 6, kind: i % 2 });
		for (let i = 0; i < 160; i++) F.stars.push({ x: r() * W, y: r() * 0.95, s: r() * 1.6 + 0.3, ph: r() * 6 });
		for (let i = 0; i < 6; i++) F.clouds.push({ x: r() * W, y: 0.12 + r() * 0.55, s: 70 + r() * 90, v: 3 + r() * 7 });
		for (let i = 0; i < 5; i++) F.rays.push({ x: r() * W, w: 40 + r() * 70, sk: 0.25 + r() * 0.25 });
		for (let i = 0; i < 60; i++) F.embers.push({ x: r() * W, y: r(), v: 0.02 + r() * 0.05, s: 1 + r() * 2.2, ph: r() * 6 });
		const bounds = [3.1, 3.55, 3.85, 4.1, 4.45];
		for (let i = 0; i < 4; i++) F.bands.push({ y0: bounds[i], y1: bounds[i + 1], c: P.strata[i], ph: r() * 6, amp: 10 + r() * 14 });
		F.geode = { x: W * (0.18 + r() * 0.1), y: 3.72, rx: 72, ry: 36 };
		F.gold = Array.from({ length: 24 }, () => ({ x: r() * W, y: 3.2 + r() * 1.1 }));
		camToY = stops(S.anchors, [0.5, 1.5, 2.72, 3.65, 4.8, 5.15]);
	}

	function wave(x, ph, amp) {
		return Math.sin(x * 0.011 + ph) * amp + Math.sin(x * 0.027 + ph * 2.1) * amp * 0.4;
	}
	function tree(c, x, base, w, h, col) {
		c.fillStyle = col;
		c.beginPath();
		const tiers = 4;
		c.moveTo(x, base - h);
		for (let k = 1; k <= tiers; k++) {
			const y = base - h + (h * k) / tiers;
			const ww = (w * k) / tiers;
			c.lineTo(x + ww * 0.5, y - 6);
			c.lineTo(x + ww * 0.28, y - 6);
		}
		c.lineTo(x + w * 0.08, base);
		c.lineTo(x - w * 0.08, base);
		for (let k = tiers; k >= 1; k--) {
			const y = base - h + (h * k) / tiers;
			const ww = (w * k) / tiers;
			c.lineTo(x - ww * 0.28, y - 6);
			c.lineTo(x - ww * 0.5, y - 6);
		}
		c.closePath();
		c.fill();
	}

	function draw(S) {
		const c = S.ctx;
		const vh = S.cssH;
		const W = S.cssW;
		if (!F) build(S);
		c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
		const centerVh = camToY(S.p);
		const cam = (centerVh - 0.5) * vh; // world px of screen top
		const Y = (v) => v * vh - cam;
		const t = S.t;
		// master gradient
		const g = c.createLinearGradient(0, Y(0), 0, Y(HV));
		for (const [o, col] of P.grad) g.addColorStop(o, col);
		c.fillStyle = g;
		c.fillRect(0, 0, W, vh);

		const top = cam, bot = cam + vh;
		// sky bits
		if (top < 1.1 * vh) {
			if (dark) {
				c.fillStyle = "#fff";
				for (const s of F.stars) {
					c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 1.5 + s.ph);
					c.fillRect(s.x, Y(s.y), s.s, s.s);
				}
				c.globalAlpha = 1;
				c.fillStyle = "#eef3ff";
				c.beginPath();
				c.arc(W * 0.78, Y(0.3), 30, 0, 7);
				c.fill();
			} else {
				const sg = c.createRadialGradient(W * 0.78, Y(0.3), 0, W * 0.78, Y(0.3), 260);
				sg.addColorStop(0, "rgba(255,248,210,.95)");
				sg.addColorStop(0.12, "rgba(255,240,180,.8)");
				sg.addColorStop(1, "rgba(255,240,180,0)");
				c.fillStyle = sg;
				c.fillRect(W * 0.78 - 260, Y(0.3) - 260, 520, 520);
			}
			c.fillStyle = dark ? "rgba(120,140,190,.35)" : "rgba(255,255,255,.85)";
			for (const k of F.clouds) {
				const x = ((k.x + (reducedMotion ? 0 : t * k.v)) % (W + 300)) - 150;
				const y = Y(k.y) - cam * 0.05;
				for (let i = 0; i < 5; i++) {
					c.beginPath();
					c.ellipse(x + (i - 2) * k.s * 0.32, y + (i % 2) * 5 - Math.abs(i - 2) * 4, k.s * 0.34, k.s * 0.18, 0, 0, 7);
					c.fill();
				}
			}
			// far ridges
			for (let L = 0; L < 2; L++) {
				c.fillStyle = P.far[L];
				c.beginPath();
				c.moveTo(0, Y(1.3));
				for (let x = 0; x <= W; x += 20) c.lineTo(x, Y(0.93 + L * 0.06) - (Math.abs(Math.sin(x * 0.006 + L * 3)) * 0.07 + Math.sin(x * 0.017 + L) * 0.015) * vh);
				c.lineTo(W, Y(1.3));
				c.fill();
			}
		}
		// canopy + trunks
		if (bot > 1.0 * vh && top < GROUND * vh) {
			c.fillStyle = dark ? "#071a18" : "#1f4a35";
			c.fillRect(0, Y(1.45), W, Y(GROUND) - Y(1.45));
			for (let row = 0; row < 3; row++) {
				const sh = (cam - 1.4 * vh) * (0.14 - row * 0.05);
				for (const tr of F.crowns[row]) tree(c, tr.x, Y(1.22 + row * 0.14) + sh + tr.h * 0.35, tr.w, tr.h, P.crown[row]);
				// trunks between rows
				if (row === 0) {
					for (const tk of F.trunks)
						if (tk.row === 1) {
							c.fillStyle = P.trunk;
							c.globalAlpha = 0.55;
							c.fillRect(tk.x, Y(1.4), tk.w * 0.7, Y(GROUND) - Y(1.4));
							c.globalAlpha = 1;
						}
				}
			}
			for (const tk of F.trunks)
				if (tk.row === 0) {
					c.fillStyle = P.trunk;
					c.fillRect(tk.x, Y(1.3), tk.w, Y(GROUND + 0.02) - Y(1.3));
					c.fillStyle = P.trunkHi;
					c.globalAlpha = 0.5;
					c.fillRect(tk.x + tk.w * 0.15, Y(1.3), tk.w * 0.18, Y(GROUND) - Y(1.3));
					c.globalAlpha = 1;
					for (let k = 0; k < 9; k++) {
						c.fillStyle = "rgba(0,0,0,.18)";
						c.fillRect(tk.x + ((k * 7.3 + tk.tone * 20) % tk.w), Y(1.5 + k * 0.09), 2, 28);
					}
				}
			// foreground boughs at canopy
			for (const tr of F.crowns[2]) tree(c, tr.x + 20, Y(1.04) + (cam - 0.8 * vh) * -0.2 + tr.h * 0.2, tr.w * 1.5, tr.h * 0.9, P.crown[2]);
			// god rays
			c.fillStyle = P.ray;
			for (const r of F.rays) {
				const sway = Math.sin(t * 0.3 + r.x) * 6;
				c.beginPath();
				c.moveTo(r.x + sway, Y(1.2));
				c.lineTo(r.x + r.w + sway, Y(1.2));
				c.lineTo(r.x + r.w + r.sk * vh * 1.2 + sway, Y(GROUND));
				c.lineTo(r.x + r.sk * vh * 1.2 + sway, Y(GROUND));
				c.fill();
			}
		}
		// ground + soil
		if (bot > (GROUND - 0.15) * vh) {
			const gy = Y(GROUND);
			c.fillStyle = P.soil;
			c.beginPath();
			c.moveTo(0, Y(3.5));
			c.lineTo(0, gy + wave(0, 1, 6));
			for (let x = 0; x <= W; x += 16) c.lineTo(x, gy + wave(x, 1, 6));
			c.lineTo(W, Y(3.5));
			c.fill();
			const soilGrad = c.createLinearGradient(0, gy, 0, Y(3.2));
			soilGrad.addColorStop(0, dark ? "rgba(30,20,14,0)" : "rgba(60,36,20,0)");
			soilGrad.addColorStop(1, dark ? "rgba(20,14,12,.0)" : "rgba(110,86,70,.0)");
			// litter
			for (const l of F.litter) {
				c.fillStyle = P.litter[l.c];
				c.beginPath();
				c.ellipse(l.x, gy + wave(l.x, 1, 6) - l.dy * 0.3 - 1, l.s, l.s * 0.35, l.a, 0, 7);
				c.fill();
			}
			// mushrooms
			for (const m of F.mush) {
				const y0 = gy + wave(m.x, 1, 6) + 1;
				c.fillStyle = dark ? "#cfc8b8" : "#f1e8d6";
				c.fillRect(m.x - m.s * 0.12, y0 - m.s * 0.8, m.s * 0.24, m.s * 0.8);
				c.fillStyle = dark ? "#9b2f2a" : "#d23b30";
				c.beginPath();
				c.ellipse(m.x, y0 - m.s * 0.8, m.s * 0.55, m.s * 0.4, 0, Math.PI, 0);
				c.fill();
				c.fillStyle = "rgba(255,255,255,.85)";
				for (let k = 0; k < 3; k++) {
					c.beginPath();
					c.arc(m.x + (m.dots[k] - 0.5) * m.s * 0.7, y0 - m.s * (0.9 + k * 0.05), m.s * 0.07, 0, 7);
					c.fill();
				}
			}
			// speckle across soil
			pattern ||= c.createPattern(tile, "repeat");
			c.save();
			c.beginPath();
			c.rect(0, gy - 4, W, Y(3.4) - gy);
			c.clip();
			c.translate(0, -cam % 96);
			c.fillStyle = pattern;
			c.globalAlpha = 0.9;
			c.fillRect(0, gy + cam % 96 - 4, W, Y(3.4) - gy + 96);
			c.restore();
			c.globalAlpha = 1;
			// roots
			c.lineCap = "round";
			c.strokeStyle = dark ? "#6a4a2d" : "#c9a26b";
			for (const set of F.roots)
				for (const b of set) {
					c.lineWidth = b[4];
					c.beginPath();
					c.moveTo(b[0] + 0, gy + b[1]);
					c.lineTo(b[2], gy + b[3]);
					c.stroke();
				}
			// pebbles
			for (const p of F.pebbles) {
				const py = Y(p.y);
				if (py < -20 || py > vh + 20) continue;
				c.fillStyle = P.pebble;
				c.beginPath();
				c.ellipse(p.x, py, p.s, p.s * 0.7, 0.4, 0, 7);
				c.fill();
				c.fillStyle = "rgba(255,255,255,.18)";
				c.beginPath();
				c.ellipse(p.x - p.s * 0.2, py - p.s * 0.2, p.s * 0.45, p.s * 0.25, 0.4, 0, 7);
				c.fill();
			}
			// worm
			c.strokeStyle = dark ? "#b87a78" : "#e0988f";
			c.lineWidth = 7;
			c.beginPath();
			const wy = Y(2.62);
			for (let x = W * 0.58; x < W * 0.58 + 120; x += 6) c.lineTo(x, wy + Math.sin(x * 0.09 + (reducedMotion ? 0 : t * 2)) * 8);
			c.stroke();
			// mycelium
			c.strokeStyle = dark ? "rgba(150,255,210,.5)" : "rgba(255,255,255,.5)";
			c.lineWidth = 1.2;
			c.beginPath();
			for (let i = 0; i < 8; i++) {
				const x = (i + 0.5) * (W / 8);
				const y = Y(2.9 + (i % 3) * 0.1);
				c.moveTo(x, y);
				c.quadraticCurveTo(x + 40, y + 30, x + 90, y + 6);
				c.quadraticCurveTo(x + 120, y - 10, x + 160, y + 20);
			}
			c.stroke();
		}
		// strata
		if (bot > 3.0 * vh && top < 4.7 * vh) {
			pattern ||= c.createPattern(tile, "repeat");
			for (const b of F.bands) {
				c.fillStyle = b.c;
				c.beginPath();
				c.moveTo(0, Y(b.y1 + 0.2));
				for (let x = 0; x <= W; x += 16) c.lineTo(x, Y(b.y0) + wave(x, b.ph, b.amp));
				c.lineTo(W, Y(b.y1 + 0.2));
				c.fill();
				c.strokeStyle = "rgba(0,0,0,.22)";
				c.lineWidth = 2;
				c.beginPath();
				for (let x = 0; x <= W; x += 16) c.lineTo(x, Y(b.y0) + wave(x, b.ph, b.amp));
				c.stroke();
				c.strokeStyle = "rgba(255,255,255,.08)";
				c.lineWidth = 1;
				for (let k = 1; k < 4; k++) {
					c.beginPath();
					for (let x = 0; x <= W; x += 24) c.lineTo(x, Y(b.y0 + (k * (b.y1 - b.y0)) / 4) + wave(x, b.ph + k, b.amp * 0.7));
					c.stroke();
				}
			}
			c.save();
			c.beginPath();
			c.rect(0, Y(3.0), W, Y(4.7) - Y(3.0));
			c.clip();
			c.translate(0, -cam % 96);
			c.fillStyle = pattern;
			c.fillRect(0, Y(3.0) + (cam % 96) - 96, W, Y(4.7) - Y(3.0) + 192);
			c.restore();
			for (const f of F.fossils) {
				const fy = Y(f.y);
				if (fy < -60 || fy > vh + 60) continue;
				c.strokeStyle = P.fossil;
				c.fillStyle = P.fossil;
				c.lineWidth = 3;
				c.globalAlpha = 0.8;
				if (f.kind === 0) {
					c.beginPath();
					for (let a = 0; a < 14; a += 0.3) {
						const rr = f.s * (0.08 + a / 15);
						const x = f.x + Math.cos(a + f.a) * rr, y = fy + Math.sin(a + f.a) * rr;
						a === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
					}
					c.stroke();
				} else {
					c.beginPath();
					c.ellipse(f.x, fy, f.s, f.s * 0.5, f.a * 0.2, 0, 7);
					c.stroke();
					for (let k = -2; k <= 2; k++) {
						c.beginPath();
						c.moveTo(f.x + k * f.s * 0.28, fy - f.s * 0.45);
						c.lineTo(f.x + k * f.s * 0.28, fy + f.s * 0.45);
						c.stroke();
					}
				}
				c.globalAlpha = 1;
			}
			c.fillStyle = "#ffd75a";
			for (const gd of F.gold) c.fillRect(gd.x, Y(gd.y), 2.4, 2.4);
			// geode
			const ge = F.geode;
			const gyy = Y(ge.y);
			c.fillStyle = dark ? "#0b0714" : "#241a35";
			c.beginPath();
			c.ellipse(ge.x, gyy, ge.rx, ge.ry, -0.1, 0, 7);
			c.fill();
			for (let k = 0; k < 14; k++) {
				const a = (k / 14) * Math.PI * 2;
				const ex = ge.x + Math.cos(a) * ge.rx * 0.82, ey = gyy + Math.sin(a) * ge.ry * 0.82;
				const ln = 12 + ((k * 7) % 9);
				c.fillStyle = k % 2 ? "#b58cff" : "#8f5ee0";
				c.beginPath();
				c.moveTo(ex - 4, ey);
				c.lineTo(ex - Math.cos(a) * ln, ey - Math.sin(a) * ln);
				c.lineTo(ex + 4, ey);
				c.fill();
			}
		}
		// deep: veins, embers, core
		if (bot > 4.2 * vh) {
			c.lineCap = "round";
			c.lineJoin = "round";
			for (const v of F.veins) {
				c.beginPath();
				v.forEach(([x, y], i) => (i ? c.lineTo(x, Y(y)) : c.moveTo(x, Y(y))));
				c.strokeStyle = "rgba(255,110,30,.28)";
				c.lineWidth = 9;
				c.stroke();
				c.strokeStyle = "rgba(255,220,120,.9)";
				c.lineWidth = 2.2;
				c.stroke();
			}
			const cy = Y(HV - 0.05);
			const cg = c.createRadialGradient(W / 2, cy, 0, W / 2, cy, vh * 0.95);
			cg.addColorStop(0, "rgba(255,255,235,1)");
			cg.addColorStop(0.18, "rgba(255,226,120,.95)");
			cg.addColorStop(0.5, "rgba(255,120,30,.45)");
			cg.addColorStop(1, "rgba(255,80,20,0)");
			c.fillStyle = cg;
			c.fillRect(0, cy - vh, W, vh * 2);
			for (const e of F.embers) {
				const y = (((e.y - (reducedMotion ? 0 : t * e.v)) % 1) + 1) % 1;
				c.fillStyle = `rgba(255,${180 + ((e.ph * 10) % 60)},80,${0.35 + 0.4 * Math.sin(t * 2 + e.ph)})`;
				c.fillRect(e.x + Math.sin(t + e.ph) * 6, vh - y * vh * 0.9, e.s, e.s);
			}
		}
		// HUD
		let zi = 0;
		for (let i = 0; i < ZONES.length; i++) if (centerVh >= ZONES[i][0]) zi = i;
		const depthFrac = clamp((centerVh - GROUND) / (HV - GROUND - 0.3));
		let label;
		if (centerVh < GROUND) label = centerVh < 1.0 ? `${Math.round(lerp(380, 60, centerVh))} m above ground` : `${Math.round(lerp(60, 0, (centerVh - 1) / 1.3))} m above ground`;
		else {
			const km = Math.pow(depthFrac, 3.2) * 6371;
			label = km < 0.1 ? `${Math.max(1, Math.round(km * 1000))} m deep` : km < 100 ? `${km.toFixed(1)} km deep` : `${Math.round(km).toLocaleString("en-US")} km deep`;
		}
		hud.textContent = `${ZONES[zi][1]} · ${label}`;
		gauge.style.setProperty("--m", ((centerVh / HV) * 100).toFixed(2) + "%");
	}

	const journey = createJourney(root, { reducedMotion, dark, scale: 1, maxDpr: 1.25, maxPixels: 2.4e6, ambientFps: 20, follow: 8, draw });
	return () => journey.destroy();
}
