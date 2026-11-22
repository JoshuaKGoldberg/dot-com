// _dl-d/fx.js: little margin physics for wave-14 delight themes (motes, star chimes, smoke wisps).
// All fixed-timestep, driven by cursor velocity, margins only, and asleep when nothing is moving.
import { clamp, rng, TAU, rgba, margins, stageCanvas, cursorTrack, simLoop } from "./kit.js";

const SPRITE_CACHE = new Map();
function disc(rgb, hard = 0.3) {
	const k = rgb.join() + hard;
	if (SPRITE_CACHE.has(k)) return SPRITE_CACHE.get(k);
	const S = 64, c = document.createElement("canvas"); c.width = c.height = S;
	const g = c.getContext("2d"), m = S / 2, gr = g.createRadialGradient(m, m, 0, m, m, m);
	gr.addColorStop(0, rgba(rgb, 1)); gr.addColorStop(hard, rgba(rgb, 0.55)); gr.addColorStop(0.7, rgba(rgb, 0.1)); gr.addColorStop(1, rgba(rgb, 0));
	g.fillStyle = gr; g.fillRect(0, 0, S, S);
	SPRITE_CACHE.set(k, c);
	return c;
}

/* ============ dust motes ============ */
export function dustMotes(root, { dark, seed = 350, reduced, host = root.querySelector(".scenery-a") }) {
	const cols = dark ? [[255, 228, 165], [175, 228, 255], [255, 200, 225], [200, 255, 215]] : [[225, 150, 30], [80, 135, 230], [220, 100, 155], [40, 160, 140]];
	const sprites = cols.map((c) => disc(c));
	let motes = [], mg = null;
	const cur = cursorTrack(host, () => loop.wake());
	const st = stageCanvas(host, (s) => {
		mg = margins(s.W);
		motes = [];
		if (mg) {
			const r = rng(seed), n = Math.round(s.W * s.H / 36000);
			for (let i = 0; i < n; i++) {
				const side = i % 2 ? mg.left : mg.right;
				const x = side[0] + 10 + r() * (side[1] - side[0] - 20), y = 30 + r() * (s.H - 60);
				motes.push({ x, y, hx: x, hy: y, vx: 0, vy: 0, r: 1.1 + Math.pow(r(), 2) * 2.6, c: (r() * cols.length) | 0, a: 0.4 + r() * 0.45, ph: r() * TAU, sp: 0.2 + r() * 0.4, lo: side[0] + 4, hi: side[1] - 4 });
			}
		}
		loop.wake(); loop.redraw();
	});
	const step = (h) => {
		let busy = false;
		const hasC = cur.has;
		const cs = Math.hypot(cur.vx, cur.vy);
		for (const m of motes) {
			if (hasC && cs > 8) {
				const dx = m.x - cur.x, dy = m.y - cur.y, d2 = dx * dx + dy * dy;
				if (d2 < 360 * 360) {
					const d = Math.sqrt(d2) + 0.001, f = Math.exp(-d2 / (2 * 125 * 125)) / (0.6 + m.r * 0.25);
					// along the wake, a counter-clockwise eddy around the cursor, and a touch of outward push
					m.vx += (cur.vx * 3 + (-dy / d) * cs * 2.2 + (dx / d) * cs * 0.5) * f * h;
					m.vy += (cur.vy * 3 + (dx / d) * cs * 2.2 + (dy / d) * cs * 0.5) * f * h;
				}
			}
			m.vx += (m.hx - m.x) * 1.1 * h; m.vy += (m.hy - m.y) * 1.1 * h;
			const k = Math.exp(-h * 1.35); m.vx *= k; m.vy *= k;
			const sp = Math.hypot(m.vx, m.vy); if (sp > 340) { m.vx *= 340 / sp; m.vy *= 340 / sp; }
			m.x += m.vx * h; m.y += m.vy * h;
			if (m.x < m.lo) { m.x = m.lo; m.vx = Math.abs(m.vx) * 0.3; } else if (m.x > m.hi) { m.x = m.hi; m.vx = -Math.abs(m.vx) * 0.3; }
			if (sp > 1.2 || Math.abs(m.x - m.hx) + Math.abs(m.y - m.hy) > 0.8) busy = true;
		}
		cur.decay(h);
		return busy || cs > 8;
	};
	const draw = (t) => {
		const g = st.ctx;
		g.clearRect(0, 0, st.W, st.H);
		g.globalCompositeOperation = dark ? "lighter" : "source-over";
		for (const m of motes) {
			const amb = reduced ? 0 : 1;
			const x = m.x + Math.sin(t * m.sp + m.ph) * 7 * amb, y = m.y + Math.cos(t * m.sp * 0.8 + m.ph) * 5 * amb;
			const sp = Math.hypot(m.vx, m.vy);
			const D = m.r * 7 * (1 + Math.min(sp / 400, 0.5));
			g.globalAlpha = clamp(m.a * (reduced ? 0.8 : 0.7 + 0.3 * Math.sin(t * m.sp * 2.2 + m.ph * 3)) * (1 + Math.min(sp / 250, 0.7)) * (dark ? 0.8 : 0.62), 0, 1);
			g.drawImage(sprites[m.c], x - D / 2, y - D / 2, D, D);
		}
		g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
	};
	const loop = simLoop({ step, draw, reduced, ambient: !reduced });
	loop.wake();
	return () => { loop.destroy(); cur.destroy(); st.destroy(); };
}

/* ============ hanging star chimes ============ */
function starPath(g, R, inner = 0.34) {
	g.beginPath();
	for (let i = 0; i < 4; i++) {
		const a = i * Math.PI / 2, b = a + Math.PI / 4, a2 = a + Math.PI / 2;
		if (i === 0) g.moveTo(Math.cos(a) * R, Math.sin(a) * R);
		g.quadraticCurveTo(Math.cos(b) * R * inner, Math.sin(b) * R * inner, Math.cos(a2) * R, Math.sin(a2) * R);
	}
	g.closePath();
}
export function starChimes(root, { dark, seed = 351, reduced, host = root.querySelector(".scenery-a") }) {
	const G = 1250, DAMP = 0.32;
	const tones = dark ? [[255, 232, 175], [190, 220, 255], [215, 195, 255], [185, 255, 228]] : [[215, 140, 30], [60, 110, 215], [130, 90, 205], [25, 150, 140]];
	const glow = tones.map((c) => disc(c, 0.18));
	let chimes = [];
	const cur = cursorTrack(host, () => loop.wake());
	const st = stageCanvas(host, (s) => {
		const mg = margins(s.W);
		chimes = [];
		if (mg) {
			const r = rng(seed), per = mg.mw > 150 ? 4 : 2;
			for (const side of [mg.left, mg.right]) {
				const slot = (side[1] - side[0] - 30) / per;
				for (let i = 0; i < per; i++) {
					const L = clamp(90 + r() * 240, 60, s.H * 0.42);
					chimes.push({ ax: side[0] + 15 + slot * (i + 0.2 + r() * 0.6), L, th: 0, om: 0, th2: 0, om2: 0, R: 5.5 + r() * 4.5, two: r() < 0.45, L2: 26 + r() * 16, tone: (r() * tones.length) | 0, ph: r() * TAU, glint: 0, cool: 0, om2: 0 });
				}
			}
		}
		loop.wake(); loop.redraw();
	});
	const pos = (c, f) => [c.ax + Math.sin(c.th) * c.L * f, Math.cos(c.th) * c.L * f];
	const step = (h, t) => {
		let busy = false;
		const hit = cur.pending && cur.has;
		for (const c of chimes) {
			if (hit) {
				c.cool -= h;
				let touched = false;
				for (const f of [0.5, 0.78, 1]) {
					const [bx, by] = pos(c, f);
					const ex = cur.x - cur.sx, ey = cur.y - cur.sy, l2 = ex * ex + ey * ey + 1e-6;
					const u = clamp(((bx - cur.sx) * ex + (by - cur.sy) * ey) / l2);
					if (Math.hypot(cur.sx + ex * u - bx, cur.sy + ey * u - by) < (f === 1 ? 20 : 12)) { touched = true; break; }
				}
				if (touched && c.cool <= 0) {
					const dv = (cur.vx * Math.cos(c.th) - cur.vy * Math.sin(c.th)) / c.L * 0.7;
					c.om += clamp(dv, -4.5, 4.5); c.glint = 1; c.cool = 0.1;
				}
			}
			const breeze = reduced ? 0 : 0.03 * Math.sin(t * 0.37 + c.ph);
			c.om += (-(G / c.L) * Math.sin(c.th - breeze) - DAMP * c.om) * h;
			c.th = clamp(c.th + c.om * h, -1.3, 1.3);
			if (c.two) {
				c.om2 += (-(G / (c.L2 * 2.2)) * (c.th2 - c.th) * 1.6 - 0.5 * c.om2) * h;
				c.th2 += c.om2 * h;
			}
			c.glint = Math.max(c.glint * Math.exp(-h * 1.3), Math.min(1, (Math.abs(c.om) - 0.3) * 0.7));
			if (Math.abs(c.om) > 0.015 || Math.abs(c.om2) > 0.02 || c.glint > 0.01) busy = true;
		}
		if (hit) cur.pending = false;
		cur.decay(h);
		return busy;
	};
	const stringCol = dark ? "rgba(190,210,255,0.16)" : "rgba(70,100,180,0.2)";
	const drawStar = (g, x, y, R, rot, c, glint, tw) => {
		g.globalCompositeOperation = dark ? "lighter" : "source-over";
		const D = R * (7 + glint * 7);
		g.globalAlpha = clamp((dark ? 0.32 : 0.26) + glint * 0.55, 0, 1) * tw;
		g.drawImage(glow[c.tone], x - D / 2, y - D / 2, D, D);
		g.globalCompositeOperation = "source-over";
		g.save(); g.translate(x, y); g.rotate(rot);
		const col = tones[c.tone];
		g.globalAlpha = clamp((dark ? 0.62 : 0.55) + glint * 0.4, 0, 1) * tw;
		g.fillStyle = rgba(dark ? col : col, 1);
		starPath(g, R * (1 + glint * 0.25));
		g.fill();
		g.restore();
	};
	const draw = (t) => {
		const g = st.ctx;
		g.clearRect(0, 0, st.W, st.H);
		g.lineWidth = 1; g.lineCap = "round";
		for (const c of chimes) {
			const tw = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 0.9 + c.ph);
			const [bx, by] = pos(c, 1);
			g.globalAlpha = 1; g.strokeStyle = stringCol;
			g.beginPath(); g.moveTo(c.ax, -2); g.lineTo(bx, by); g.stroke();
			const [mx, my] = pos(c, 0.45);
			g.fillStyle = stringCol; g.globalAlpha = 0.6; g.beginPath(); g.arc(mx, my, 1.4, 0, TAU); g.fill();
			let sx = bx, sy = by;
			if (c.two) {
				const a2 = c.th2;
				sx = bx + Math.sin(a2) * c.L2; sy = by + Math.cos(a2) * c.L2;
				g.globalAlpha = 1; g.beginPath(); g.moveTo(bx, by); g.lineTo(sx, sy); g.stroke();
				drawStar(g, bx, by + 0, c.R * 0.45, c.th * 2, c, c.glint * 0.6, tw);
				drawStar(g, sx, sy, c.R * 0.8, a2 * 2 + 0.3, c, c.glint, tw);
			} else drawStar(g, bx, by, c.R, c.th * 1.5, c, c.glint, tw);
		}
		g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
	};
	const loop = simLoop({ step, draw, reduced, ambient: !reduced });
	// ride up and fade with the top aurora as the page scrolls (transform + opacity only)
	let pend = 0;
	const apply = () => {
		pend = 0; const y = root.scrollTop;
		st.c.style.transform = y ? `translate3d(0,${(-y * 0.55).toFixed(1)}px,0)` : "";
		st.c.style.opacity = y ? String(clamp(1 - y / 420).toFixed(3)) : "";
	};
	const onScroll = () => { if (!pend) pend = requestAnimationFrame(apply); };
	root.addEventListener("scroll", onScroll, { passive: true });
	st.c.style.willChange = "transform,opacity";
	apply(); loop.wake();
	return () => { loop.destroy(); cancelAnimationFrame(pend); root.removeEventListener("scroll", onScroll); cur.destroy(); st.destroy(); };
}

/* ============ smoke wisps ============ */
export function smokeWisps(root, { dark, seed = 352, reduced, host = root.querySelector(".scenery-a") }) {
	const N = 18;
	const cols = dark ? [[120, 255, 190], [110, 200, 255], [180, 150, 255]] : [[30, 170, 130], [50, 130, 220], [130, 90, 215]];
	let wisps = [];
	const cur = cursorTrack(host, () => loop.wake());
	const st = stageCanvas(host, (s) => {
		const mg = margins(s.W);
		wisps = [];
		if (mg) {
			const r = rng(seed), per = mg.mw > 150 ? 4 : 2;
			for (const side of [mg.left, mg.right]) {
				for (let i = 0; i < per; i++) {
					const w = { bx: side[0] + 20 + r() * (side[1] - side[0] - 40), by: s.H * (0.3 + 0.7 * (i + r() * 0.8) / per), len: 130 + r() * 110, amp: 16 + r() * 22, ph: r() * TAU, lean: (r() - 0.5) * 40, col: (r() * cols.length) | 0, a: 0.75 + r() * 0.25, wd: 2.2 + r() * 2.2, lo: side[0] - 4, hi: side[1] + 4, p: [] };
					for (let k = 0; k < N; k++) { const h = home(w, k, 0); w.p.push({ x: h[0], y: h[1], vx: 0, vy: 0 }); }
					wisps.push(w);
				}
			}
		}
		loop.wake(); loop.redraw();
	});
	function home(w, k, t) {
		const u = k / (N - 1);
		const amb = reduced ? 0 : 1;
		return [w.bx + Math.sin(u * 3.4 + w.ph) * w.amp * u + w.lean * u + Math.sin(t * 0.21 + w.ph + u * 2.4) * 12 * u * amb, w.by - u * w.len + Math.cos(t * 0.17 + w.ph) * 4 * u * amb];
	}
	const step = (h, t) => {
		let busy = false;
		const cs = Math.hypot(cur.vx, cur.vy), act = cur.has && cs > 8;
		for (const w of wisps) {
			for (let k = 0; k < N; k++) {
				const p = w.p[k], u = k / (N - 1), hm = home(w, k, t);
				if (act) {
					const dx = p.x - cur.x, dy = p.y - cur.y, d2 = dx * dx + dy * dy;
					if (d2 < 380 * 380) {
						const d = Math.sqrt(d2) + 0.001, f = Math.exp(-d2 / (2 * 130 * 130)) * (0.35 + u * 0.9);
						p.vx += (cur.vx * 2.4 + (-dy / d) * cs * 2.4 + (dx / d) * cs * 0.4) * f * h;
						p.vy += (cur.vy * 2.4 + (dx / d) * cs * 2.4 + (dy / d) * cs * 0.4) * f * h;
					}
				}
				const kk = 46 * (1 - u) + 5;
				p.vx += (hm[0] - p.x) * kk * h; p.vy += (hm[1] - p.y) * kk * h;
				const dm = Math.exp(-h * (2.6 + (1 - u) * 3)); p.vx *= dm; p.vy *= dm;
				const sp = Math.hypot(p.vx, p.vy); if (sp > 320) { p.vx *= 320 / sp; p.vy *= 320 / sp; }
				p.x += p.vx * h; p.y += p.vy * h;
				if (p.x < w.lo) { p.x = w.lo; p.vx = Math.abs(p.vx) * 0.3; } else if (p.x > w.hi) { p.x = w.hi; p.vx = -Math.abs(p.vx) * 0.3; }
				if (sp > 1.5 || Math.abs(p.x - hm[0]) + Math.abs(p.y - hm[1]) > 1) busy = true;
			}
			for (let k = 1; k < N - 1; k++) { // keep the chain smooth like a smoke thread
				const a = w.p[k - 1], b = w.p[k], c = w.p[k + 1];
				b.x += ((a.x + c.x) / 2 - b.x) * 0.22; b.y += ((a.y + c.y) / 2 - b.y) * 0.22;
			}
		}
		cur.decay(h);
		return busy || act;
	};
	const poly = (g, w, scale) => {
		const L = [], Rr = [];
		for (let k = 0; k < N; k++) {
			const a = w.p[Math.max(0, k - 1)], b = w.p[Math.min(N - 1, k + 1)], p = w.p[k];
			let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
			const u = k / (N - 1), wd = (0.6 + u * w.wd * (1.2 - u * 0.4)) * scale;
			L.push([p.x - ty * wd, p.y + tx * wd]); Rr.push([p.x + ty * wd, p.y - tx * wd]);
		}
		g.beginPath(); g.moveTo(L[0][0], L[0][1]);
		for (let k = 1; k < N; k++) g.lineTo(L[k][0], L[k][1]);
		for (let k = N - 1; k >= 0; k--) g.lineTo(Rr[k][0], Rr[k][1]);
		g.closePath();
	};
	const draw = () => {
		const g = st.ctx;
		g.clearRect(0, 0, st.W, st.H);
		g.globalCompositeOperation = dark ? "lighter" : "source-over";
		for (const w of wisps) {
			const c = cols[w.col], a0 = w.p[0], a1 = w.p[N - 1];
			const gr = g.createLinearGradient(a0.x, a0.y, a1.x, a1.y);
			const A = (dark ? 0.2 : 0.22) * w.a;
			gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(0.25, rgba(c, A)); gr.addColorStop(0.7, rgba(c, A * 0.7)); gr.addColorStop(1, rgba(c, 0));
			g.fillStyle = gr;
			poly(g, w, 3.2); g.globalAlpha = 0.4; g.fill();
			poly(g, w, 1); g.globalAlpha = 1; g.fill();
		}
		g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
	};
	const loop = simLoop({ step, draw, reduced, ambient: !reduced });
	loop.wake();
	return () => { loop.destroy(); cur.destroy(); st.destroy(); };
}
