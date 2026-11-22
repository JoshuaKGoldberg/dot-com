// _hp/fx-hover.js: #488-492, snazzy hover effects in the page's own language (aurora, snarks, stars, spotlight)
import { faded, bodyDomeFade, aurora, skyGradient, ring, rgba, radialFade, silhouetteGlow } from "./kit.js";
import { PAL, lut, rng, smooth, clamp } from "./kit.js";

const TAU = Math.PI * 2;
const withCircle = (g, E, fn, r = 128) => { g.save(); E.circle(g, r); g.clip(); fn(); g.restore(); };

// 488: an aurora blooms down from the top of the circle
export const hoverAurora = {
	pad: 8, assets: ["bg", "body"], fps: 40,
	setup(E) {
		const au = aurora(E), A = faded(E, 0.3, 0.97), body = bodyDomeFade(E, 0.85, 1.0), D = E.D;
		const scratch = E.mk(D), sg = scratch.getContext("2d");
		const base = E.dark ? 0.7 : 0.95;
		let ph = 0, last = null;
		return (g, t, h) => {
			ph += last == null ? 0 : (t - last) * (0.6 + 2 * h); last = t;
			g.globalAlpha = base * (1 - 0.55 * h); g.drawImage(A, E.o, E.o); g.globalAlpha = 1;
			if (h > 0.004) {
				// aurora painted off-screen, revealed from the top down by a soft vertical mask
				sg.globalCompositeOperation = "source-over"; sg.clearRect(0, 0, D, D);
				const gr = sg.createLinearGradient(0, 0, 0, D), y = h * 1.15;
				sg.fillStyle = E.dark ? "rgba(6,14,36,0.9)" : "rgba(228,236,255,0.85)"; sg.fillRect(0, 0, D, D);
				const o0 = E.o, o1 = E.o; // aurora.draw paints at E.o: shift via translate
				sg.save(); sg.translate(-E.o, -E.o); au.draw(sg, ph, 1.15); sg.restore();
				sg.globalCompositeOperation = "destination-in";
				gr.addColorStop(0, "#000"); gr.addColorStop(clamp(y - 0.35), "#000"); gr.addColorStop(clamp(y), "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0)");
				sg.fillStyle = gr; sg.fillRect(0, 0, D, D);
				sg.globalCompositeOperation = "destination-in"; sg.beginPath(); sg.arc(D / 2, D / 2, D / 2, 0, TAU); sg.fill();
				g.globalAlpha = smooth(0, 0.3, h); g.drawImage(scratch, E.o, E.o); g.globalAlpha = 1;
			}
			g.drawImage(body, E.o, E.o);
			ring(E, g, 0.15 + 0.3 * h);
		};
	},
};

// 489: the background and the cutout separate into parallax layers
export const hoverParallax = {
	pad: 22, assets: ["bg", "body"], fps: 60,
	setup(E) {
		const bgc = E.mk(E.D), bq = bgc.getContext("2d"); bq.drawImage(E.bgFull(), 0, 0, E.D, E.D);
		const sh = silhouetteGlow(E, 5, [[0, 0, 0], [0, 0, 0]], 1);
		const P = E.dark ? PAL.dark : PAL.light;
		return (g, t, h, p) => {
			const px = (p.sx / 128) * h, py = (p.sy / 128) * h;
			withCircle(g, E, () => {
				g.globalAlpha = E.dark ? 0.8 : 0.95;
				E.drawImg(g, bgc, 1.0 + 0.1 * h, -px * 7, -py * 7); g.globalAlpha = 1;
				// the shadow the cutout throws onto the backdrop
				g.globalAlpha = (E.dark ? 0.55 : 0.28) * h; g.drawImage(sh, px * -2 * E.u + 0, py * -2 * E.u + 5 * h * E.u); g.globalAlpha = 1;
			});
			ring(E, g, 0.18 + 0.28 * h);
			// Josh pops forward: tilts toward the cursor, scales up, and may rise out of the top of the circle
			g.save(); E.dome(g, 128, 150); g.clip();
			g.translate(E.c + px * 5 * E.u, E.c + py * 3.5 * E.u - 4 * h * E.u); g.rotate(px * 0.025); g.scale(1 + 0.05 * h, 1 + 0.05 * h); g.translate(-E.c, -E.c);
			E.drawImg(g, E.img.body); g.restore();
		};
	},
};

// 490: a Goldberg snark grows outward around him from where the cursor entered
export const hoverSnark = {
	pad: 64, assets: ["bg", "body"], fps: 50,
	async setup(E) {
		const mod = await import("../_graphs/goldberg-graphs.js");
		const G = mod.GOLDBERG.find((q) => q.id === "goldberg-snark-9") || mod.GOLDBERG[0], lay = G.layouts.rotational || Object.values(G.layouts)[0];
		const n = G.n, adj = Array.from({ length: n }, () => []); for (const [a, b] of G.edges) { adj[a].push(b); adj[b].push(a); }
		const pal = E.dark ? PAL.dark : PAL.light, L = lut([...pal, pal[0]]);
		const A = faded(E, 0.3, 0.97), body = bodyDomeFade(E, 0.85, 1.0);
		const pos = lay.map(([x, y]) => [E.c + x * 140 * E.u, E.c + y * 140 * E.u]);
		let depth = null, maxD = 1, grow = 0, root = 0, last = null;
		const bfs = (r) => { depth = new Array(n).fill(-1); depth[r] = 0; const q = [r]; for (let i = 0; i < q.length; i++) for (const w of adj[q[i]]) if (depth[w] < 0) { depth[w] = depth[q[i]] + 1; q.push(w); } maxD = Math.max(...depth); };
		let lastEnter = null;
		const col = (i) => { const k = ((i / n) * 255) | 0; return [L[k * 3], L[k * 3 + 1], L[k * 3 + 2]]; };
		return (g, t, h, p) => {
			const dt = last == null ? 0 : t - last; last = t;
			const en = E.state.enter;
			if (E.state.ht && en !== lastEnter) { lastEnter = en; let bi = 0, bd = 1e9; pos.forEach((q, i) => { const d = Math.hypot(q[0] - (E.c + en.x * E.u), q[1] - (E.c + en.y * E.u)); if (d < bd) { bd = d; bi = i; } }); root = bi; bfs(root); grow = Math.max(grow, 0); }
			grow = clamp(grow + (E.state.ht ? dt / 1.5 : -dt / 0.9), 0, 1.02);
			g.globalAlpha = E.dark ? 0.7 : 0.95; g.drawImage(A, E.o, E.o); g.globalAlpha = 1;
			if (depth && grow > 0) {
				const gd = grow * (maxD + 1.2), lw = E.u;
				g.lineCap = "round";
				for (const [a, b] of G.edges) {
					const [lo, hi] = depth[a] <= depth[b] ? [a, b] : [b, a], pr = clamp(gd - depth[lo] - 0.15, 0, 1) * (depth[lo] === depth[hi] ? 0.5 : 1);
					if (pr <= 0.001) continue;
					const x0 = pos[lo][0], y0 = pos[lo][1], x1 = x0 + (pos[hi][0] - x0) * pr, y1 = y0 + (pos[hi][1] - y0) * pr;
					g.strokeStyle = rgba(col(lo), (E.dark ? 0.7 : 0.75) * smooth(0, 0.25, grow)); g.lineWidth = lw * 1.1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
				}
				for (let i = 0; i < n; i++) {
					const k = clamp(gd - depth[i] + 0.1, 0, 1); if (k <= 0) continue;
					const r = (1.2 + 1.6 * (i === root ? 1.2 : 0.7)) * E.u * (k < 1 ? 0.6 + 0.9 * Math.sin(k * 1.57) : 1);
					g.fillStyle = rgba(E.dark ? [235, 248, 255] : col(i), 0.85 * smooth(0, 0.25, grow)); g.beginPath(); g.arc(pos[i][0], pos[i][1], r, 0, TAU); g.fill();
					if (E.dark) { g.fillStyle = rgba(col(i), 0.14 * k); g.beginPath(); g.arc(pos[i][0], pos[i][1], r * 3.2, 0, TAU); g.fill(); }
				}
			}
			g.drawImage(body, E.o, E.o);
			return grow > 0.001 && !E.state.ht;
		};
	},
};

// 491: stars twinkle up around the circle and link to its edge
export const hoverStars = {
	pad: 56, assets: ["bg", "body"], fps: 40,
	setup(E) {
		const r = rng(21), stars = [], A = faded(E, 0.32, 0.96), body = bodyDomeFade(E, 0.85, 1.0);
		const pal = E.dark ? PAL.dark : PAL.light;
		for (let i = 0; i < 46; i++) {
			const a = r() * TAU, right = Math.cos(a) > 0.6, rad = 138 + r() * (right ? 18 : 44) + (r() < 0.2 ? 0 : 0);
			const x = Math.cos(a) * rad, y = Math.sin(a) * rad * 0.97;
			if (Math.abs(x) > 128 + 54 || Math.abs(y) > 128 + 54) { i--; continue; }
			stars.push({ x, y, a, m: r(), d: r() * 0.7, ph: r() * TAU, c: pal[(r() * 4) | 0] });
		}
		// constellation links: each star to its nearest circle-edge point, a few to a neighbour
		const links = stars.map((s, i) => { let b = -1, bd = 1e9; stars.forEach((q, j) => { if (j !== i) { const d = Math.hypot(q.x - s.x, q.y - s.y); if (d < bd && d < 46) { bd = d; b = j; } } }); return b; });
		return (g, t, h) => {
			g.globalAlpha = (E.dark ? 0.62 : 0.9); g.drawImage(A, E.o, E.o); g.globalAlpha = 1;
			if (h > 0.004) {
				const u = E.u, sc = (v) => E.c + v * u;
				g.lineWidth = 0.7 * u; g.lineCap = "round";
				stars.forEach((s, i) => {
					const k = smooth(s.d, s.d + 0.3, h); if (k <= 0) return;
					const ex = Math.cos(s.a) * 127, ey = Math.sin(s.a) * 127;
					g.strokeStyle = rgba(s.c, (E.dark ? 0.3 : 0.4) * k); g.beginPath(); g.moveTo(sc(ex), sc(ey)); g.lineTo(sc(ex + (s.x - ex) * k), sc(ey + (s.y - ey) * k)); g.stroke();
					const j = links[i]; if (j >= 0 && i < j) { const o = stars[j]; g.strokeStyle = rgba(s.c, (E.dark ? 0.22 : 0.3) * k); g.beginPath(); g.moveTo(sc(s.x), sc(s.y)); g.lineTo(sc(s.x + (o.x - s.x) * k), sc(s.y + (o.y - s.y) * k)); g.stroke(); }
				});
				stars.forEach((s) => {
					const k = smooth(s.d, s.d + 0.3, h); if (k <= 0) return;
					const tw = 0.55 + 0.45 * Math.sin(t * (1.6 + s.m * 2) + s.ph), rd = (0.9 + s.m * 1.4) * u * (0.6 + 0.4 * k) * (0.8 + 0.4 * tw);
					const x = sc(s.x), y = sc(s.y);
					g.fillStyle = rgba(s.c, (E.dark ? 0.18 : 0.12) * k); g.beginPath(); g.arc(x, y, rd * 3.4, 0, TAU); g.fill();
					g.fillStyle = rgba(E.dark ? [240, 250, 255] : s.c, (0.55 + 0.45 * tw) * k); g.beginPath(); g.arc(x, y, rd, 0, TAU); g.fill();
					if (s.m > 0.55) { const L2 = rd * (3 + 2 * tw); g.fillRect(x - L2, y - 0.3 * u, 2 * L2, 0.6 * u); g.fillRect(x - 0.3 * u, y - L2, 0.6 * u, 2 * L2); }
				});
			}
			g.drawImage(body, E.o, E.o);
		};
	},
};

// 492: muted background, colour restored under a soft spotlight that follows the cursor
export const hoverReveal = {
	pad: 8, assets: ["bg", "body"], fps: 60,
	setup(E) {
		const D = E.D, src = E.bgFull();
		// muted: grey, dimmed
		const muted = E.mk(D), mg = muted.getContext("2d"); mg.filter = "grayscale(1) contrast(0.9)"; mg.drawImage(src, 0, 0, D, D); mg.filter = "none";
		mg.fillStyle = E.dark ? "rgba(6,10,26,0.62)" : "rgba(236,238,246,0.7)"; mg.fillRect(0, 0, D, D);
		// colour: the same background pushed into the aurora palette
		const col = E.mk(D), cg = col.getContext("2d"), pal = E.dark ? PAL.dark : PAL.light;
		cg.filter = E.dark ? "grayscale(1) contrast(1.6) brightness(0.8)" : "grayscale(1) contrast(1.5)"; cg.drawImage(src, 0, 0, D, D); cg.filter = "none";
		const gr = cg.createLinearGradient(0, 0, D, D); gr.addColorStop(0, rgba(pal[0], 1)); gr.addColorStop(0.5, rgba(pal[1], 1)); gr.addColorStop(1, rgba(pal[3], 1));
		if (E.dark) { cg.globalCompositeOperation = "color"; cg.globalAlpha = 0.9; cg.fillStyle = gr; cg.fillRect(0, 0, D, D); cg.globalCompositeOperation = "soft-light"; cg.globalAlpha = 0.6; cg.fillRect(0, 0, D, D); }
		else { // light: an opaque pastel aurora wash with the photo's blinds multiplied back in
			const lg = cg.createLinearGradient(0, 0, D, D); lg.addColorStop(0, "hsl(170,70%,76%)"); lg.addColorStop(0.5, "hsl(215,80%,80%)"); lg.addColorStop(1, "hsl(300,70%,84%)");
			cg.globalCompositeOperation = "source-over"; cg.globalAlpha = 1; cg.fillStyle = lg; cg.fillRect(0, 0, D, D);
			cg.globalCompositeOperation = "multiply"; cg.globalAlpha = 0.45; cg.filter = "grayscale(1) contrast(1.8)"; cg.drawImage(src, 0, 0, D, D); cg.filter = "none"; cg.globalAlpha = 1; }
		const sc = E.mk(D), sq = sc.getContext("2d");
		return (g, t, h, p) => {
			const tx = D * 0.5 + p.sx * E.u * 0.9 * h + (1 - h) * -D * 0.18, ty = D * 0.5 + p.sy * E.u * 0.9 * h + (1 - h) * -D * 0.2, rad = D * (0.2 + 0.2 * h);
			withCircle(g, E, () => {
				g.drawImage(muted, E.o, E.o);
				sq.globalCompositeOperation = "source-over"; sq.clearRect(0, 0, D, D); sq.drawImage(col, 0, 0);
				sq.globalCompositeOperation = "destination-in";
				const rg = sq.createRadialGradient(tx, ty, 0, tx, ty, rad);
				for (let i = 0; i <= 6; i++) rg.addColorStop(i / 6, `rgba(0,0,0,${(1 - smooth(0.1, 1, i / 6)) * (0.45 + 0.55 * h)})`);
				sq.fillStyle = rg; sq.fillRect(0, 0, D, D);
				g.drawImage(sc, E.o, E.o);
				E.drawImg(g, E.img.body);
			});
			ring(E, g, 0.2 + 0.25 * h);
		};
	},
};
