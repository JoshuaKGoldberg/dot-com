import { createJourney, stops, rng, clamp, lerp, smooth, hex, mix, rgb } from "./_scroll/lib.js";

const TW = 112, TH = 56; // tile size at scale 1
const SPACING = 11;
const BUILDINGS = [
	{ kind: "cabin", label: "Home", x: 3, side: 1 },
	{ kind: "library", label: "About", x: 3 + SPACING, side: 1 },
	{ kind: "post", label: "Writing", x: 3 + SPACING * 2, side: 1 },
	{ kind: "workshop", label: "Projects", x: 3 + SPACING * 3, side: 1 },
	{ kind: "hall", label: "Speaking", x: 3 + SPACING * 4, side: 1 },
	{ kind: "camp", label: "Footer", x: 3 + SPACING * 5, side: 1 },
];

const C = (light, dark) => ({ light: hex(light), dark: hex(dark) });

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	let objs = null;
	let camToX;

	function build(S) {
		const r = rng(21);
		const list = [];
		BUILDINGS.forEach((b, i) => list.push({ t: "b", b, i, x: b.x, y: 3.8, depth: b.x + 3.8 }));
		for (let i = 0; i < 190; i++) {
			const x = -8 + r() * 78;
			const y = (r() < 0.5 ? -1 : 1) * (2 + r() * 15);
			if (Math.abs(y) < 1.3) continue;
			let near = false;
			for (const b of BUILDINGS) if (Math.abs(x - b.x) < 3.2 && Math.abs(y - 3.8) < 3.4) near = true;
			if (near) continue;
			if (y > 7 && x > 12 && x < 38) continue; // lake
			list.push({ t: "tree", x, y, s: 0.7 + r() * 0.7, depth: x + y, k: r() });
		}
		for (let i = 0; i < 24; i++) list.push({ t: "lamp", x: 1 + i * 2.6, y: i % 2 ? 1.2 : -1.2, depth: 1 + i * 2.6 + (i % 2 ? 1.2 : -1.2) });
		for (let i = 0; i < 40; i++) list.push({ t: "rock", x: r() * 70 - 6, y: (r() - 0.5) * 30, s: 0.15 + r() * 0.2, depth: 0 });
		for (const o of list) if (o.t === "rock") o.depth = o.x + o.y;
		list.sort((a, b) => a.depth - b.depth);
		objs = list;
		camToX = stops(S.anchors, BUILDINGS.map((b) => b.x + 0.6));
	}

	function draw(S) {
		const c = S.ctx;
		const W = S.cssW, H = S.cssH;
		if (!objs) build(S);
		c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
		const sc = clamp(H / 800, 0.7, 1.3) * (W < 900 ? 0.62 : 0.8);
		const tw = TW * sc, th = TH * sc;
		const cx = W < 900 ? W * 0.5 : W * 0.37;
		const cy = H * 0.52;
		const camX = camToX(S.p) + 0.2;
		const ox = cx - (camX * tw) / 2;
		const oy = cy - (camX * th) / 2;
		const P = (x, y, z = 0) => [ox + ((x - y) * tw) / 2, oy + ((x + y) * th) / 2 - z * th * 1.1];
		const night = dark ? 0.66 : smooth(0.5, 1, S.p) * 0.7;
		const lights = clamp(night * 1.7 - 0.25);
		const sh = (col, k = 1) => {
			const base = [col[0] * k, col[1] * k, col[2] * k];
			return rgb(mix(base, [14, 22, 52], night * 0.72 * (0.9 + 0.1 * k)));
		};
		const glows = [];
		const poly = (pts, fill) => {
			c.fillStyle = fill;
			c.beginPath();
			pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
			c.closePath();
			c.fill();
		};
		// ground in world transform
		c.fillStyle = sh(hex("#8fc678"));
		c.fillRect(0, 0, W, H);
		c.save();
		c.setTransform(S.dpr * tw / 2, S.dpr * th / 2, -S.dpr * tw / 2, S.dpr * th / 2, S.dpr * ox, S.dpr * oy);
		// grass patches
		c.fillStyle = sh(hex("#7fb868"));
		for (let i = -2; i < 20; i++) c.fillRect(i * 4, i % 2 ? -22 : -26, 3, 52);
		// lake
		c.fillStyle = sh(hex("#4d9cc2"));
		c.beginPath();
		c.ellipse(26, 13, 13, 5.2, 0, 0, 7);
		c.fill();
		c.fillStyle = sh(hex("#8fcde6"));
		c.globalAlpha = 0.55;
		c.beginPath();
		c.ellipse(24.5, 12.4, 9, 3, 0, 0, 7);
		c.fill();
		c.globalAlpha = 1;
		// road
		c.fillStyle = sh(hex("#d8c8a0"));
		c.fillRect(-12, -0.75, 84, 1.5);
		c.fillStyle = sh(hex("#c5b387"));
		c.fillRect(-12, -0.75, 84, 0.12);
		c.fillRect(-12, 0.63, 84, 0.12);
		c.fillStyle = sh(hex("#fffbe8"), 0.95);
		for (let x = -12; x < 72; x += 1.6) c.fillRect(x, -0.05, 0.8, 0.1);
		// path stubs to buildings
		for (const b of BUILDINGS) {
			c.fillStyle = sh(hex("#d8c8a0"));
			c.fillRect(b.x - 0.4, 0.7, 0.8, 1.6);
		}
		c.restore();

		const tx = (v) => v; // placeholder
		const face = (x, y, z, face, w, d, h, col) => {};
		const box = (x, y, w, d, h, cols, z0 = 0) => {
			// x,y = min corner. +x face is right, +y face is left.
			const top = [P(x, y, z0 + h), P(x + w, y, z0 + h), P(x + w, y + d, z0 + h), P(x, y + d, z0 + h)];
			poly([P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z0 + h), P(x, y + d, z0 + h)], cols[1]);
			poly([P(x + w, y, z0), P(x + w, y + d, z0), P(x + w, y + d, z0 + h), P(x + w, y, z0 + h)], cols[2]);
			if (cols[0]) poly(top, cols[0]);
		};
		const win = (fx, fy, fz, kind, u, v, wu, wv, lit) => {
			// kind 'y' = on +y face at y=fy (u along x); kind 'x' = on +x face at x=fx (u along y)
			const pt = (uu, vv) => (kind === "y" ? P(fx + uu, fy, fz + vv) : P(fx, fy + uu, fz + vv));
			const q = [pt(u, v), pt(u + wu, v), pt(u + wu, v + wv), pt(u, v + wv)];
			const on = lit * 1;
			poly(q, rgb(mix(hex(dark ? "#2a3a5a" : "#7fa8c8"), [255, 214, 120], on)));
			if (on > 0.15) {
				const m = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
				glows.push([m[0], m[1], 46 * sc, on]);
			}
			c.strokeStyle = sh(hex("#f2ead8"));
			c.lineWidth = 1.3 * sc;
			c.beginPath();
			q.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
			c.closePath();
			c.stroke();
		};
		const gable = (x, y, w, d, h, rh, roofL, roofR, wallR, ridgeAlongX = true) => {
			// ridge along x at y+d/2
			const ym = y + d / 2;
			poly([P(x, y, h), P(x + w + 0.15, y, h), P(x + w + 0.15, ym, h + rh), P(x, ym, h + rh)], roofR);
			poly([P(x + w, y + d, h), P(x + w, y, h), P(x + w, ym, h + rh)], wallR);
			poly([P(x - 0.15, y + d + 0.15, h), P(x + w + 0.15, y + d + 0.15, h), P(x + w + 0.15, ym, h + rh), P(x - 0.15, ym, h + rh)], roofL);
		};
		const sign = (x, y, z, text) => {
			const [sx, sy] = P(x, y, z);
			c.font = `700 ${Math.round(13 * sc + 1)}px "League Spartan", system-ui, sans-serif`;
			const wd = c.measureText(text).width + 18 * sc;
			c.fillStyle = sh(hex(dark ? "#1b2a4a" : "#fffdf6"));
			c.strokeStyle = rgb(hex(dark ? "#8ec7ff" : "#1170d0"));
			c.lineWidth = 1.5;
			c.beginPath();
			c.roundRect(sx - wd / 2, sy - 12 * sc, wd, 24 * sc, 12 * sc);
			c.fill();
			c.stroke();
			c.fillStyle = dark ? "#e6f1ff" : "#142842";
			c.textAlign = "center";
			c.textBaseline = "middle";
			c.fillText(text, sx, sy + 1);
			c.strokeStyle = sh(hex("#555"));
			c.beginPath();
			c.moveTo(sx, sy + 12 * sc);
			c.lineTo(sx, sy + 24 * sc);
			c.stroke();
		};
		const pine = (x, y, s, k) => {
			const [bx, by] = P(x, y);
			const hh = 54 * s * sc, ww = 30 * s * sc;
			c.fillStyle = "rgba(0,0,0,.14)";
			c.beginPath();
			c.ellipse(bx + 3, by + 2, ww * 0.55, ww * 0.25, 0, 0, 7);
			c.fill();
			c.fillStyle = sh(hex("#6b4a2e"));
			c.fillRect(bx - 2.5 * sc, by - 8 * sc, 5 * sc, 9 * sc);
			const cols = [hex("#2f7f55"), hex("#37925f"), hex("#42a56b")];
			for (let t = 0; t < 3; t++) {
				const y0 = by - 6 * sc - t * hh * 0.28;
				const half = ww * (0.62 - t * 0.14);
				poly([[bx - half, y0], [bx + half, y0], [bx, y0 - hh * 0.5]], sh(cols[t], 0.86 + (k % 0.1)));
				poly([[bx, y0], [bx + half, y0], [bx, y0 - hh * 0.5]], "rgba(0,0,0,.14)");
			}
		};
		const smoke = (x, y, z, seed) => {
			const t = reducedMotion ? 0.3 : S.t;
			for (let i = 0; i < 6; i++) {
				const f = ((t * 0.28 + i / 6 + seed) % 1);
				const [px, py] = P(x, y, z);
				c.fillStyle = `rgba(${dark ? 170 : 235},${dark ? 180 : 235},${dark ? 200 : 240},${0.5 * (1 - f)})`;
				c.beginPath();
				c.arc(px + f * 30 * sc + Math.sin(f * 6 + seed) * 4, py - f * 70 * sc, (5 + f * 13) * sc, 0, 7);
				c.fill();
			}
		};
		const buildingDraw = (o) => {
			const { b, i } = o;
			const x = b.x - 1.6, y = 1.6 + (i % 2) * 0.5;
			const lit = lights * (0.85 + 0.15 * Math.sin(i * 7 + 1));
			const wall = (hexc) => [null, sh(hex(hexc), 0.9), sh(hex(hexc), 0.74)];
			const c3 = (top, hexc) => [sh(hex(top), 1), ...wall(hexc).slice(1)];
			// shadow
			poly([P(x + 0.3, y + 3.6, 0), P(x + 4.4, y + 3.6, 0), P(x + 4.8, y + 1.5, 0), P(x + 0.8, y + 1.5, 0)], "rgba(0,0,0,.13)");
			if (b.kind === "cabin") {
				box(x, y, 4, 3, 1.5, c3("#d9a066", "#b9773e"));
				for (let k = 1; k < 5; k++) {
					c.strokeStyle = "rgba(60,30,10,.28)";
					c.lineWidth = 1.2;
					c.beginPath();
					const a = P(x, y + 3, k * 0.3), bb = P(x + 4, y + 3, k * 0.3), cc = P(x + 4, y, k * 0.3);
					c.moveTo(a[0], a[1]); c.lineTo(bb[0], bb[1]); c.lineTo(cc[0], cc[1]);
					c.stroke();
				}
				gable(x, y, 4, 3, 1.5, 1.2, sh(hex("#9b3b2e")), sh(hex("#b5483a")), sh(hex("#b9773e"), 0.74));
				win(x, y + 3, 0, "y", 2.6, 0.5, 0.9, 0.7, lit);
				win(x, y + 3, 0, "y", 0.5, 0.5, 0.9, 0.7, lit);
				win(x + 4, y, 0, "x", 1.0, 0.5, 1.0, 0.7, lit);
				poly([P(x + 1.6, y + 3, 0), P(x + 2.3, y + 3, 0), P(x + 2.3, y + 3, 1.1), P(x + 1.6, y + 3, 1.1)], sh(hex("#5a3319")));
				box(x + 0.6, y + 0.3, 0.55, 0.55, 3.1, [sh(hex("#8a8f98")), sh(hex("#767b84")), sh(hex("#5c6068"))]);
				smoke(x + 0.88, y + 0.58, 3.1, 0);
				sign(x + 2, y + 1.5, 4.5, b.label);
			} else if (b.kind === "library") {
				box(x, y, 4, 3.2, 2.4, c3("#e8e2d4", "#c9c2b0"));
				gable(x, y, 4, 3.2, 2.4, 1.1, sh(hex("#3d6f9c")), sh(hex("#4a82b4")), sh(hex("#c9c2b0"), 0.74));
				for (let k = 0; k < 3; k++) win(x, y + 3.2, 0.2, "y", 0.4 + k * 1.25, 0.4, 0.8, 1.5, lit);
				win(x + 4, y, 0.2, "x", 0.8, 0.4, 1.0, 1.5, lit);
				box(x + 3.3, y + 3.2, 0.5, 0.5, 4.4, [sh(hex("#d4cebb")), sh(hex("#bfb8a4")), sh(hex("#a59e8a"))]);
				const [fx, fy] = P(x + 3.55, y + 3.45, 4.4);
				c.strokeStyle = sh(hex("#555"));
				c.lineWidth = 2;
				c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 30 * sc); c.stroke();
				poly([[fx, fy - 30 * sc], [fx + 22 * sc, fy - 24 * sc + Math.sin(S.t * 3) * (reducedMotion ? 0 : 2)], [fx, fy - 17 * sc]], sh(hex("#e04a3a")));
				sign(x + 2, y + 1.6, 5, b.label);
			} else if (b.kind === "post") {
				box(x, y, 4.2, 3, 1.9, c3("#f4efe4", "#d98f6b"));
				poly([P(x - 0.2, y + 3.2, 1.9), P(x + 4.4, y + 3.2, 1.9), P(x + 2.1, y + 1.5, 3.6)], sh(hex("#8c3a3a"), 0.95));
				poly([P(x + 4.4, y + 3.2, 1.9), P(x + 4.4, y - 0.2, 1.9), P(x + 2.1, y + 1.5, 3.6)], sh(hex("#a64848"), 0.85));
				poly([P(x - 0.2, y - 0.2, 1.9), P(x - 0.2, y + 3.2, 1.9), P(x + 2.1, y + 1.5, 3.6)], sh(hex("#7a3030"), 0.8));
				poly([P(x + 4.4, y - 0.2, 1.9), P(x + 4.4, y + 3.2, 1.9), P(x + 2.1, y + 1.5, 3.6)], "rgba(0,0,0,0)");
				win(x, y + 3, 0.2, "y", 0.5, 0.4, 1.0, 0.9, lit);
				win(x, y + 3, 0.2, "y", 2.7, 0.4, 1.0, 0.9, lit);
				poly([P(x + 1.7, y + 3, 0), P(x + 2.5, y + 3, 0), P(x + 2.5, y + 3, 1.2), P(x + 1.7, y + 3, 1.2)], sh(hex("#6a3a22")));
				// mailbox
				box(x + 4.8, y + 3.2, 0.5, 0.35, 0.5, [sh(hex("#3d6fb0")), sh(hex("#2f5a94")), sh(hex("#24477a"))], 0.5);
				box(x + 4.95, y + 3.3, 0.12, 0.12, 0.5, [sh(hex("#555")), sh(hex("#444")), sh(hex("#333"))]);
				sign(x + 2.1, y + 1.5, 4.9, b.label);
			} else if (b.kind === "workshop") {
				box(x, y, 4.6, 3.2, 1.9, c3("#9aa7b4", "#7b8896"));
				for (let k = 0; k < 3; k++) {
					const x0 = x + k * 1.53;
					poly([P(x0, y, 1.9), P(x0 + 1.53, y, 2.9), P(x0 + 1.53, y + 3.2, 2.9), P(x0, y + 3.2, 1.9)], sh(hex("#c7d0d8"), 0.98));
					poly([P(x0 + 1.53, y, 2.9), P(x0 + 1.53, y + 3.2, 2.9), P(x0 + 1.53, y + 3.2, 1.9), P(x0 + 1.53, y, 1.9)], sh(hex("#5f6b78"), 0.9));
				}
				win(x, y + 3.2, 0.3, "y", 0.4, 0.3, 1.2, 0.9, lit);
				win(x, y + 3.2, 0.3, "y", 2.7, 0.3, 1.2, 0.9, lit);
				poly([P(x + 1.8, y + 3.2, 0), P(x + 2.7, y + 3.2, 0), P(x + 2.7, y + 3.2, 1.4), P(x + 1.8, y + 3.2, 1.4)], sh(hex("#d0652d")));
				box(x + 3.7, y + 0.3, 0.6, 0.6, 4, [sh(hex("#a8643f")), sh(hex("#8e4f31")), sh(hex("#6d3a22"))]);
				smoke(x + 4.0, y + 0.6, 4, 0.4);
				// gear
				const [gx, gy] = P(x + 4.6, y + 1.6, 1.0);
				const rot = reducedMotion ? 0 : S.t * 0.8;
				c.fillStyle = sh(hex("#e0a030"));
				c.beginPath();
				for (let k = 0; k < 16; k++) {
					const a = rot + (k / 16) * Math.PI * 2;
					const rr = (k % 2 ? 14 : 19) * sc;
					c.lineTo(gx + Math.cos(a) * rr * 0.9, gy + Math.sin(a) * rr * 0.55);
				}
				c.closePath();
				c.fill();
				sign(x + 2.3, y + 1.6, 5.7, b.label);
			} else if (b.kind === "hall") {
				box(x, y, 4.6, 3.4, 2.3, c3("#e9d8e4", "#b7849e"));
				gable(x, y, 4.6, 3.4, 2.3, 1.3, sh(hex("#5b3f77")), sh(hex("#6e4e8e")), sh(hex("#b7849e"), 0.74));
				poly([P(x + 1.3, y + 3.4, 0), P(x + 3.3, y + 3.4, 0), P(x + 3.3, y + 3.4, 1.6), P(x + 2.3, y + 3.4, 2.0), P(x + 1.3, y + 3.4, 1.6)], sh(hex("#4a2a42")));
				// marquee bulbs
				for (let k = 0; k < 7; k++) {
					const [mx, my] = P(x + 1.0 + k * 0.45, y + 3.45, 1.95);
					c.fillStyle = rgb(mix([120, 110, 100], [255, 226, 130], lights > 0.2 ? 1 : 0.1 + 0.3 * ((k + Math.floor(S.t * 3)) % 2)));
					c.beginPath(); c.arc(mx, my, 3 * sc, 0, 7); c.fill();
					if (lights > 0.2) glows.push([mx, my, 22 * sc, lights * 0.8]);
				}
				win(x + 4.6, y, 0.3, "x", 0.6, 0.4, 0.9, 1.1, lit);
				win(x + 4.6, y, 0.3, "x", 1.9, 0.4, 0.9, 1.1, lit);
				// spotlight beams
				if (lights > 0.2) {
					const [bx, by] = P(x + 2.3, y + 3.5, 2.6);
					c.fillStyle = `rgba(255,240,200,${0.13 * lights})`;
					poly([[bx - 4, by], [bx + 4, by], [bx + 90 * sc, by - 150 * sc], [bx + 40 * sc, by - 150 * sc]], c.fillStyle);
				}
				sign(x + 2.3, y + 1.7, 5.4, b.label);
			} else {
				// camp: tent + fire + lean-to + dock
				const [tx0, ty0] = [x + 0.4, y + 0.6];
				poly([P(tx0, ty0 + 1.6, 0), P(tx0 + 2.2, ty0 + 1.6, 0), P(tx0 + 1.1, ty0 + 0.8, 1.7)], sh(hex("#e4693a")));
				poly([P(tx0 + 2.2, ty0 + 1.6, 0), P(tx0 + 2.2, ty0, 0), P(tx0 + 1.1, ty0 + 0.8, 1.7)], sh(hex("#b8492a"), 0.9));
				poly([P(tx0 + 0.75, ty0 + 1.6, 0), P(tx0 + 1.45, ty0 + 1.6, 0), P(tx0 + 1.1, ty0 + 0.8, 1.2)], sh(hex("#5a2412")));
				const [fx, fy] = P(x + 3.2, y + 2.2, 0);
				c.fillStyle = sh(hex("#7a6f66"));
				for (let k = 0; k < 8; k++) { c.beginPath(); c.ellipse(fx + Math.cos(k * 0.785) * 16 * sc, fy + Math.sin(k * 0.785) * 8 * sc, 4.5 * sc, 3 * sc, 0, 0, 7); c.fill(); }
				const fl = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(S.t * 11) * Math.sin(S.t * 7.3);
				poly([[fx - 7 * sc, fy], [fx + 7 * sc, fy], [fx + 2 * sc, fy - 22 * sc * fl], [fx - 3 * sc, fy - 12 * sc]], rgb([255, 150, 40]));
				poly([[fx - 4 * sc, fy], [fx + 4 * sc, fy], [fx, fy - 13 * sc * fl]], rgb([255, 230, 120]));
				glows.push([fx, fy - 6 * sc, 70 * sc, 0.5 + lights * 0.5]);
				// dock
				box(x + 2, y - 3, 0.9, 4, 0.15, [sh(hex("#b08a5a")), sh(hex("#96724a")), sh(hex("#7a5a3a"))]);
				sign(x + 1.5, y + 0.8, 3.7, b.label);
			}
		};
		for (const o of objs) {
			if (o.t === "tree") {
				const [px, py] = P(o.x, o.y);
				if (px < -60 || px > W + 60 || py < -80 || py > H + 40) continue;
				pine(o.x, o.y, o.s, o.k);
			} else if (o.t === "lamp") {
				const [px, py] = P(o.x, o.y);
				if (px < -40 || px > W + 40 || py < -80 || py > H + 40) continue;
				c.strokeStyle = sh(hex("#33383f"));
				c.lineWidth = 2.5 * sc;
				c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - 34 * sc); c.stroke();
				c.fillStyle = rgb(mix([210, 205, 190], [255, 230, 140], lights));
				c.beginPath(); c.arc(px, py - 36 * sc, 4 * sc, 0, 7); c.fill();
				if (lights > 0.1) glows.push([px, py - 36 * sc, 56 * sc, lights]);
			} else if (o.t === "rock") {
				const [px, py] = P(o.x, o.y);
				if (px < -20 || px > W + 20 || py < -20 || py > H + 20 || Math.abs(o.y) < 1.5) continue;
				c.fillStyle = sh(hex("#9ea3a6"));
				c.beginPath(); c.ellipse(px, py, 14 * o.s * 3 * sc, 8 * o.s * 3 * sc, 0, 0, 7); c.fill();
			} else {
				const [px] = P(o.b.x, 3.8);
				if (px < -300 || px > W + 300) continue;
				buildingDraw(o);
			}
		}
		// lights + dusk wash
		if (night > 0.05) {
			c.globalCompositeOperation = "lighter";
			for (const [gx, gy, r, a] of glows) {
				const g = c.createRadialGradient(gx, gy, 0, gx, gy, r);
				g.addColorStop(0, `rgba(255,190,90,${0.5 * a})`);
				g.addColorStop(1, "rgba(255,170,60,0)");
				c.fillStyle = g;
				c.fillRect(gx - r, gy - r, r * 2, r * 2);
			}
			c.globalCompositeOperation = "source-over";
		}
	}

	const journey = createJourney(root, { reducedMotion, dark, scale: 1, maxDpr: 1.25, maxPixels: 2.4e6, ambientFps: 24, follow: 7, draw });
	return () => journey.destroy();
}
