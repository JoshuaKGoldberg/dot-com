import { createJourney, stops, rng, clamp, lerp, smooth, hex, mix, rgb } from "./_scroll/lib.js";

const HV = 6; // world height in viewport heights
const SIGNS = ["Trailhead", "About", "Writing", "Projects", "Speaking", "Summit"];
const FT0 = 1300, FT1 = 5344; // trailhead to Mt Marcy summit, ft

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const P = dark
		? { sky: ["#0b1030", "#3a3566"], rock: "#4a4d66", alp: "#2f4a58", forest: "#14352f", deep: "#0b2523", ridge: ["#2a3566", "#222b58", "#1b2348"], water: "#35588a", trail: "#a0865f", trailEdge: "#201a14", tree: ["#103a32", "#0d2e2a", "#154a3c"], contour: "255,255,255", snow: "#c8d2f0", text: "#e6ecff", sun: "#eef2ff" }
		: { sky: ["#8ac3ec", "#f1f1e4"], rock: "#b4ae9e", alp: "#a2b17c", forest: "#5d8c63", deep: "#3f6c4d", ridge: ["#9db6d2", "#86a2c2", "#7092b4"], water: "#7fb5d6", trail: "#d4b886", trailEdge: "#8a6a46", tree: ["#2f6a48", "#27583c", "#3a7b52"], contour: "70,50,20", snow: "#ffffff", text: "#33291d", sun: "#fff3b8" };
	const overlay = root.querySelector(".overlay-b");
	const hud = document.createElement("div");
	hud.className = "th-hud";
	hud.setAttribute("aria-hidden", "true");
	hud.innerHTML = `<div class="th-ft"><b>0</b> ft</div><svg viewBox="0 0 200 56" width="200" height="56"><path class="th-prof" d=""/><path class="th-done" d=""/><circle class="th-dot" r="4.5" cx="0" cy="0"/></svg><div class="th-sub">Mt. Marcy · 5,344 ft</div>`;
	overlay.append(hud);
	const ftEl = hud.querySelector("b");
	const dot = hud.querySelector(".th-dot");
	const prof = hud.querySelector(".th-prof");
	const done = hud.querySelector(".th-done");
	let F = null;
	let sOf;

	function build(S) {
		const W = S.cssW, vh = S.cssH, Hw = HV * vh;
		const wide = W > 900;
		const L = wide ? W * 0.12 : W * 0.12, R = wide ? W * 0.5 : W * 0.88;
		const rr = rng(8);
		const y0 = Hw - 0.5 * vh, y1 = 0.95 * vh;
		const N = 21;
		const corners = [[(L + R) / 2, y0]];
		for (let i = 1; i <= N; i++) corners.push([(i % 2 ? R : L) + (rr() - 0.5) * W * 0.04, lerp(y0, y1, i / N)]);
		corners[N] = [(L + R) * 0.5 + (N % 2 ? 40 : -40), y1];
		// sample with rounded corners
		const pts = [corners[0]];
		for (let i = 1; i < corners.length - 1; i++) {
			const a = corners[i - 1], b = corners[i], c = corners[i + 1];
			const rad = 0.09;
			const p1 = [lerp(b[0], a[0], rad), lerp(b[1], a[1], rad)];
			const p2 = [lerp(b[0], c[0], rad), lerp(b[1], c[1], rad)];
			for (let k = 0; k <= 10; k++) {
				const t = k / 10;
				pts.push([(1 - t) * (1 - t) * p1[0] + 2 * (1 - t) * t * b[0] + t * t * p2[0], (1 - t) * (1 - t) * p1[1] + 2 * (1 - t) * t * b[1] + t * t * p2[1]]);
			}
		}
		pts.push(corners[corners.length - 1]);
		// densify + cumulative length
		const dense = [];
		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i], b = pts[i + 1];
			const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
			for (let k = 0; k < n; k++) dense.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
		}
		dense.push(pts[pts.length - 1]);
		const cum = [0];
		for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
		const total = cum[cum.length - 1];
		// trees
		const trees = [];
		const dist = (x, y) => {
			let m = 1e9;
			for (let i = 0; i < dense.length; i += 3) {
				const d = Math.hypot(dense[i][0] - x, dense[i][1] - y);
				if (d < m) m = d;
			}
			return m;
		};
		for (let i = 0; i < 1100; i++) {
			const x = rr() * W, y = lerp(0.9 * vh, Hw + 0.4 * vh, rr());
			const f = y / Hw;
			const dens = smoothstep01((f - 0.4) / 0.4) * 0.95 + 0.05 * (f > 0.3 ? 1 : 0);
			if (rr() > dens) continue;
			if (dist(x, y) < 26) continue;
			trees.push({ x, y, h: 14 + rr() * 22 * (0.6 + f * 0.7), c: (rr() * 3) | 0 });
		}
		trees.sort((a, b) => a.y - b.y);
		const rocks = [];
		for (let i = 0; i < 220; i++) {
			const x = rr() * W, y = lerp(0.8 * vh, Hw * 0.7, rr());
			if (dist(x, y) < 20) continue;
			rocks.push({ x, y, s: 4 + rr() * 11, a: rr() * 3 });
		}
		const flowers = [];
		for (let i = 0; i < 260; i++) {
			const x = rr() * W, y = lerp(Hw * 0.42, Hw * 0.7, rr());
			if (dist(x, y) < 14) continue;
			flowers.push({ x, y, c: (rr() * 3) | 0 });
		}
		const clouds = Array.from({ length: 6 }, () => ({ x: rr() * W, y: lerp(0.3 * vh, 1.1 * vh, rr()), s: 70 + rr() * 90, v: 3 + rr() * 6 }));
		const stars = Array.from({ length: 140 }, () => ({ x: rr() * W, y: rr() * 0.75 * vh, s: rr() * 1.5 + 0.4, ph: rr() * 7 }));
		const ridgePh = [rr() * 9, rr() * 9, rr() * 9];
		F = { W, vh, Hw, dense, cum, total, trees, rocks, flowers, clouds, stars, ridgePh };
		sOf = stops(S.anchors, [0, 0.2, 0.42, 0.64, 0.84, 1]);
		// elevation profile
		const ptsP = [];
		for (let i = 0; i <= 60; i++) {
			const s = i / 60;
			ptsP.push([s * 200, 52 - 46 * (smooth(0, 1, s) * 0.55 + s * 0.45 + 0.025 * Math.sin(s * 40))]);
		}
		F.prof = ptsP;
		prof.setAttribute("d", "M" + ptsP.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L"));
	}
	const smoothstep01 = (t) => {
		t = clamp(t);
		return t * t * (3 - 2 * t);
	};
	const profAt = (s) => {
		const i = Math.min(60, Math.round(s * 60));
		return F.prof[i];
	};
	function at(s) {
		const target = s * F.total;
		let lo = 0, hi = F.cum.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (F.cum[mid] < target) lo = mid + 1;
			else hi = mid;
		}
		const i = Math.max(1, lo);
		const a = F.dense[i - 1], b = F.dense[i];
		const seg = F.cum[i] - F.cum[i - 1] || 1;
		const t = (target - F.cum[i - 1]) / seg;
		return { x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), dx: b[0] - a[0], i, d: target };
	}
	function pathTo(c, Y, upto) {
		c.beginPath();
		for (let i = 0; i < F.dense.length; i++) {
			if (F.cum[i] > upto) break;
			const p = F.dense[i];
			i ? c.lineTo(p[0], Y(p[1])) : c.moveTo(p[0], Y(p[1]));
		}
	}

	function draw(S) {
		const c = S.ctx;
		if (!F) build(S);
		const { W, vh, Hw } = F;
		c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
		const s = sOf(S.p);
		const h = at(s);
		const fh = lerp(0.6, 0.74, smooth(0.8, 1, S.p));
		const camTop = clamp(h.y - fh * vh, -0.2 * vh, Hw - vh + 0.5 * vh);
		const Y = (y) => y - camTop;
		const t = S.t;
		// base gradient
		const g = c.createLinearGradient(0, Y(0), 0, Y(Hw));
		g.addColorStop(0, P.sky[0]);
		g.addColorStop(0.1, P.sky[1]);
		g.addColorStop(0.15, P.rock);
		g.addColorStop(0.32, P.rock);
		g.addColorStop(0.5, P.alp);
		g.addColorStop(0.7, P.forest);
		g.addColorStop(1, P.deep);
		c.fillStyle = g;
		c.fillRect(0, 0, W, vh);

		// panorama: sun/moon, clouds, ridges and lakes
		if (camTop < 1.1 * vh) {
			if (dark) {
				c.fillStyle = "#fff";
				for (const st of F.stars) {
					c.globalAlpha = 0.4 + 0.6 * Math.sin(t * 1.4 + st.ph) ** 2;
					c.fillRect(st.x, Y(st.y), st.s, st.s);
				}
				c.globalAlpha = 1;
			}
			const sx = W * 0.72, sy = Y(0.3 * vh);
			const sg = c.createRadialGradient(sx, sy, 0, sx, sy, 240);
			sg.addColorStop(0, dark ? "rgba(225,235,255,.8)" : "rgba(255,246,200,.95)");
			sg.addColorStop(0.15, dark ? "rgba(225,235,255,.25)" : "rgba(255,246,190,.45)");
			sg.addColorStop(1, "rgba(255,246,190,0)");
			c.fillStyle = sg;
			c.fillRect(sx - 240, sy - 240, 480, 480);
			c.fillStyle = P.sun;
			c.beginPath();
			c.arc(sx, sy, 24, 0, 7);
			c.fill();
			c.fillStyle = dark ? "rgba(130,150,210,.3)" : "rgba(255,255,255,.85)";
			for (const k of F.clouds) {
				const x = ((k.x + (reducedMotion ? 0 : t * k.v)) % (W + 300)) - 150;
				for (let i = 0; i < 5; i++) {
					c.beginPath();
					c.ellipse(x + (i - 2) * k.s * 0.32, Y(k.y) + (i % 2) * 5 - Math.abs(i - 2) * 4 + (camTop - 0.3 * vh) * 0.05, k.s * 0.34, k.s * 0.16, 0, 0, 7);
					c.fill();
				}
			}
			const bases = [0.58, 0.7, 0.82];
			for (let k = 0; k < 3; k++) {
				c.fillStyle = P.ridge[k];
				c.beginPath();
				c.moveTo(0, Y(bases[k] * vh + 400));
				for (let x = 0; x <= W; x += 14) {
					const u = x / W;
					const yy = bases[k] * vh - (0.5 + 0.28 * Math.sin(u * (3 + k * 2) + F.ridgePh[k]) + 0.16 * Math.sin(u * (11 + k * 4) + F.ridgePh[k] * 2)) * (0.2 - k * 0.04) * vh;
					c.lineTo(x, Y(yy));
				}
				c.lineTo(W, Y(bases[k] * vh + 400));
				c.fill();
				if (k === 1) {
					// lakes in the valley between ridges
					c.fillStyle = P.water;
					for (let j = 0; j < 4; j++) {
						c.beginPath();
						c.ellipse(W * (0.12 + j * 0.24 + (k * 0.05)), Y(0.83 * vh + (j % 2) * 20), 44 + j * 14, 8 + j * 2, 0, 0, 7);
						c.fill();
					}
				}
			}
			// summit rock massif
			c.fillStyle = P.rock;
			c.beginPath();
			c.moveTo(0, Y(1.5 * vh));
			for (let x = 0; x <= W; x += 14) {
				const u = x / W;
				c.lineTo(x, Y(0.98 * vh + (Math.abs(Math.sin(u * 5 + 1.2)) * -0.07 - Math.sin(u * 17) * 0.006) * vh + Math.pow(Math.abs(u - 0.3), 1.2) * 0.45 * vh));
			}
			c.lineTo(W, Y(1.5 * vh));
			c.fill();
		}
		// contour lines (topo map)
		c.lineWidth = 1;
		const step = 62;
		const k0 = Math.floor(camTop / step) - 1, k1 = Math.ceil((camTop + vh) / step) + 1;
		for (let k = k0; k <= k1; k++) {
			const wy = k * step;
			if (wy < vh * 0.95 || wy > Hw) continue;
			const index = k % 5 === 0;
			c.strokeStyle = `rgba(${P.contour},${index ? 0.2 : 0.09})`;
			c.lineWidth = index ? 1.4 : 1;
			c.beginPath();
			for (let x = -10; x <= W + 10; x += 22) {
				const y = Y(wy) + Math.sin(x * 0.011 + k * 1.7) * 14 + Math.sin(x * 0.029 + k) * 6;
				x < 0 ? c.moveTo(x, y) : c.lineTo(x, y);
			}
			c.stroke();
			if (index && W > 900) {
				const ft = Math.round(lerp(FT1, FT0, clamp((wy - 0.95 * vh) / (Hw - 0.5 * vh - 0.95 * vh))) / 50) * 50;
				c.fillStyle = `rgba(${P.contour},0.5)`;
				c.font = "600 11px 'League Spartan', system-ui, sans-serif";
				c.textAlign = "left";
				c.fillText(`${ft.toLocaleString("en-US")} ft`, W * 0.56, Y(wy) - 4);
			}
		}
		// rocks and flowers
		for (const r of F.rocks) {
			const y = Y(r.y);
			if (y < -20 || y > vh + 20) continue;
			c.fillStyle = dark ? "#3a3d54" : "#8f8b80";
			c.beginPath();
			c.ellipse(r.x, y, r.s, r.s * 0.65, r.a, 0, 7);
			c.fill();
			c.fillStyle = "rgba(255,255,255,.2)";
			c.beginPath();
			c.ellipse(r.x - r.s * 0.2, y - r.s * 0.2, r.s * 0.5, r.s * 0.3, r.a, 0, 7);
			c.fill();
		}
		const fc = dark ? ["#a98fd8", "#d9b86a", "#d98fb8"] : ["#d6558d", "#f2c230", "#fff"];
		for (const f of F.flowers) {
			const y = Y(f.y);
			if (y < -4 || y > vh + 4) continue;
			c.fillStyle = fc[f.c];
			c.fillRect(f.x, y, 2.4, 2.4);
		}
		// snow patches near the top
		c.fillStyle = P.snow;
		c.globalAlpha = 0.8;
		for (let i = 0; i < 9; i++) {
			const y = Y(1.0 * vh + (i % 3) * 70);
			c.beginPath();
			c.ellipse(W * (0.08 + i * 0.11), y + 40, 26 + (i % 4) * 8, 8, 0, 0, 7);
			c.fill();
		}
		c.globalAlpha = 1;
		// trail
		c.lineCap = "round";
		c.lineJoin = "round";
		pathTo(c, Y, Infinity);
		c.strokeStyle = P.trailEdge;
		c.globalAlpha = 0.35;
		c.lineWidth = 17;
		c.stroke();
		c.globalAlpha = 1;
		c.strokeStyle = P.trail;
		c.lineWidth = 11;
		c.stroke();
		c.setLineDash([3, 14]);
		c.strokeStyle = "rgba(255,255,255,.35)";
		c.lineWidth = 2;
		c.stroke();
		c.setLineDash([]);
		pathTo(c, Y, h.d);
		c.strokeStyle = dark ? "rgba(255,180,90,.85)" : "rgba(214,90,20,.8)";
		c.lineWidth = 3.5;
		c.stroke();
		// trees
		for (const tr of F.trees) {
			const y = Y(tr.y);
			if (y < -50) continue;
			if (y > vh + 40) break;
			const w = tr.h * 0.62;
			c.fillStyle = "rgba(0,0,0,.14)";
			c.beginPath();
			c.ellipse(tr.x + 4, y + 1, w * 0.55, w * 0.2, 0, 0, 7);
			c.fill();
			c.fillStyle = P.tree[tr.c];
			c.beginPath();
			c.moveTo(tr.x, y - tr.h);
			c.lineTo(tr.x + w * 0.5, y - tr.h * 0.3);
			c.lineTo(tr.x + w * 0.22, y - tr.h * 0.34);
			c.lineTo(tr.x + w * 0.6, y);
			c.lineTo(tr.x - w * 0.6, y);
			c.lineTo(tr.x - w * 0.22, y - tr.h * 0.34);
			c.lineTo(tr.x - w * 0.5, y - tr.h * 0.3);
			c.closePath();
			c.fill();
		}
		// signs at each section
		for (let i = 0; i < 6; i++) {
			const sp = at([0, 0.2, 0.42, 0.64, 0.84, 1][i]);
			const x = sp.x + (i % 2 ? 22 : -22), y = Y(sp.y);
			if (y < -40 || y > vh + 40) continue;
			c.fillStyle = dark ? "#8a6a46" : "#7a5632";
			c.fillRect(x - 2, y - 34, 4, 36);
			const label = SIGNS[i];
			c.font = "700 13px 'League Spartan', system-ui, sans-serif";
			const wd = c.measureText(label).width + 16;
			c.fillStyle = dark ? "#e7d5a8" : "#f4e4b8";
			c.strokeStyle = dark ? "#2a1d10" : "#6a4824";
			c.lineWidth = 1.5;
			const left = i % 2 === 0;
			c.beginPath();
			c.roundRect(left ? x - wd - 2 : x + 2, y - 46, wd, 20, 3);
			c.fill();
			c.stroke();
			c.fillStyle = "#3a2a18";
			c.textAlign = "center";
			c.fillText(label, (left ? x - wd - 2 : x + 2) + wd / 2, y - 32);
		}
		// summit cairn + flag
		{
			const e = F.dense[F.dense.length - 1];
			const y = Y(e[1]);
			if (y > -80 && y < vh + 40) {
				c.fillStyle = dark ? "#5a5d75" : "#8d8a80";
				for (let k = 0; k < 4; k++) {
					c.beginPath();
					c.ellipse(e[0] + 26, y + 2 - k * 7, 13 - k * 2.5, 5, 0, 0, 7);
					c.fill();
				}
				c.strokeStyle = "#e8e0d0";
				c.lineWidth = 2;
				c.beginPath();
				c.moveTo(e[0] + 26, y - 26);
				c.lineTo(e[0] + 26, y - 58);
				c.stroke();
				c.fillStyle = "#e0402e";
				const fl = reducedMotion ? 0 : Math.sin(t * 4) * 2;
				c.beginPath();
				c.moveTo(e[0] + 26, y - 58);
				c.lineTo(e[0] + 48, y - 52 + fl);
				c.lineTo(e[0] + 26, y - 44);
				c.fill();
			}
		}
		// hiker
		{
			const x = h.x, y = Y(h.y);
			const dir = h.dx >= 0 ? 1 : -1;
			const ph = reducedMotion ? 0 : h.d * 0.11;
			const moving = reducedMotion ? 0 : Math.min(1, Math.abs(S.vel) * 25 + 0.0);
			const sw = Math.sin(ph) * 5 * (moving > 0.02 ? 1 : 0.15);
			const bob = Math.abs(Math.sin(ph)) * 1.6 * moving;
			if (dark) {
				const hg = c.createRadialGradient(x + dir * 10, y - 18, 0, x + dir * 10, y - 18, 130);
				hg.addColorStop(0, "rgba(255,220,150,.5)");
				hg.addColorStop(1, "rgba(255,200,120,0)");
				c.fillStyle = hg;
				c.fillRect(x - 130, y - 150, 280, 260);
			}
			c.fillStyle = "rgba(0,0,0,.22)";
			c.beginPath();
			c.ellipse(x, y + 1, 9, 3, 0, 0, 7);
			c.fill();
			c.save();
			c.translate(x, y - bob);
			c.scale(dir * 1.45, 1.45);
			c.lineCap = "round";
			c.strokeStyle = "#3b4a6b";
			c.lineWidth = 3.2;
			c.beginPath();
			c.moveTo(0, -11); c.lineTo(sw, 0);
			c.moveTo(0, -11); c.lineTo(-sw, 0);
			c.stroke();
			c.strokeStyle = "#8a8f98";
			c.lineWidth = 1.2;
			c.beginPath();
			c.moveTo(5, -16); c.lineTo(10 + sw * 0.6, 0);
			c.stroke();
			c.fillStyle = "#c8431f";
			c.fillRect(-4.5, -26, 9, 16);
			c.fillStyle = "#6a2b1a";
			c.fillRect(-9, -25, 6, 13);
			c.fillStyle = "#f0c9a2";
			c.beginPath();
			c.arc(1, -30, 4.3, 0, 7);
			c.fill();
			c.fillStyle = "#2f4a6b";
			c.beginPath();
			c.arc(1, -31.5, 4.6, Math.PI, 0);
			c.fill();
			c.fillRect(-3.5, -32, 9, 1.6);
			c.restore();
		}
		// HUD
		const ft = Math.round(lerp(FT0, FT1, s) / 10) * 10;
		ftEl.textContent = ft.toLocaleString("en-US");
		const pp = profAt(s);
		dot.setAttribute("cx", pp[0].toFixed(1));
		dot.setAttribute("cy", pp[1].toFixed(1));
		const n = Math.max(1, Math.round(s * 60));
		done.setAttribute("d", "M" + F.prof.slice(0, n + 1).map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L"));
	}
	const journey = createJourney(root, { reducedMotion, dark, scale: 1, maxDpr: 1.25, maxPixels: 2.4e6, ambientFps: 20, follow: 8, draw });
	return () => journey.destroy();
}
