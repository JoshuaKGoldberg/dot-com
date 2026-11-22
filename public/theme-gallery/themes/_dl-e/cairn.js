/*
 * A tiny rigid-body cairn (hand-rolled, Box2D-lite style): convex polygon stones, SAT clipping
 * contacts, warm-started sequential impulses, friction, fixed 60 Hz step, island sleep.
 * Fixed in a bottom corner; the cursor's velocity nudges nearby stones. A toppled cairn rebuilds itself.
 */
import { clamp, isDark, rng } from "./kit.js";

const DT = 1 / 60, G = 1100;
const dot = (a, b, c, d) => a * c + b * d;

/* ---------------------------------------------------------------- bodies */
function superellipse(rx, ry, n, rnd, jitter) {
	const pts = [];
	for (let i = 0; i < n; i++) {
		const t = ((i + 0.5) / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
		const j = 1 + (rnd() - 0.5) * jitter;
		pts.push([Math.sign(c) * Math.abs(c) ** 0.55 * rx * j, Math.sign(s) * Math.abs(s) ** 0.55 * ry * (1 + (rnd() - 0.5) * jitter * 0.6)]);
	}
	// make sure the polygon winds counter-clockwise in a y-down world too: sort by angle
	return pts;
}
function makeBody(verts, density, static_) {
	const b = { x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0, verts, wv: [], wn: [], n: verts.length, fr: 0.8, static: !!static_, r: 0, rx: 0, ry: 0 };
	// area / centroid / inertia (polygon about its local origin, recentred)
	let A = 0, cx = 0, cy = 0, I = 0;
	for (let i = 0; i < verts.length; i++) {
		const [x1, y1] = verts[i], [x2, y2] = verts[(i + 1) % verts.length];
		const cr = x1 * y2 - x2 * y1;
		A += cr / 2; cx += ((x1 + x2) * cr) / 6; cy += ((y1 + y2) * cr) / 6;
		I += (cr / 12) * (x1 * x1 + x1 * x2 + x2 * x2 + y1 * y1 + y1 * y2 + y2 * y2);
	}
	cx /= A; cy /= A;
	b.verts = verts.map(([x, y]) => [x - cx, y - cy]);
	I = I - A * (cx * cx + cy * cy);
	b.area = Math.abs(A);
	const m = b.area * density;
	b.invM = static_ ? 0 : 1 / m;
	b.invI = static_ ? 0 : 1 / (Math.abs(I) * density);
	b.r = Math.max(...b.verts.map(([x, y]) => Math.hypot(x, y)));
	// edge normals (outward)
	b.ln = b.verts.map(([x1, y1], i) => {
		const [x2, y2] = b.verts[(i + 1) % b.n];
		const ex = x2 - x1, ey = y2 - y1, l = Math.hypot(ex, ey) || 1;
		return [ey / l, -ex / l];
	});
	b.xs = b.verts.map((v) => v[0]); b.ys = b.verts.map((v) => v[1]);
	b.rx = Math.max(...b.xs.map(Math.abs)); b.ry = Math.max(...b.ys.map(Math.abs));
	b.mass = m;
	b.wv = b.verts.map(() => [0, 0]); b.wn = b.ln.map(() => [0, 0]);
	return b;
}
function ensureCCW(verts) {
	let A = 0;
	for (let i = 0; i < verts.length; i++) { const [x1, y1] = verts[i], [x2, y2] = verts[(i + 1) % verts.length]; A += x1 * y2 - x2 * y1; }
	return A < 0 ? verts.slice().reverse() : verts;
}
function updateWorld(b) {
	const c = Math.cos(b.a), s = Math.sin(b.a);
	for (let i = 0; i < b.n; i++) {
		const [x, y] = b.verts[i];
		b.wv[i][0] = b.x + c * x - s * y; b.wv[i][1] = b.y + s * x + c * y;
		const [nx, ny] = b.ln[i];
		b.wn[i][0] = c * nx - s * ny; b.wn[i][1] = s * nx + c * ny;
	}
}

/* ---------------------------------------------------------------- collision */
function maxSep(A, B) {
	let best = -Infinity, bi = 0;
	for (let i = 0; i < A.n; i++) {
		const nx = A.wn[i][0], ny = A.wn[i][1], vx = A.wv[i][0], vy = A.wv[i][1];
		let s = Infinity;
		for (let j = 0; j < B.n; j++) { const d = dot(nx, ny, B.wv[j][0] - vx, B.wv[j][1] - vy); if (d < s) s = d; }
		if (s > best) { best = s; bi = i; }
	}
	return [best, bi];
}
/** Returns contacts [{px,py,nx,ny,sep,id}] with normal pointing A -> B. */
function collide(A, B) {
	const [sa, ia] = maxSep(A, B);
	if (sa > 0.5) return null;
	const [sb, ib] = maxSep(B, A);
	if (sb > 0.5) return null;
	const flip = sb > sa + 0.05;
	const R = flip ? B : A, I = flip ? A : B, ri = flip ? ib : ia;
	const rn = R.wn[ri];
	// incident edge: most anti-parallel normal
	let ii = 0, best = Infinity;
	for (let i = 0; i < I.n; i++) { const d = dot(rn[0], rn[1], I.wn[i][0], I.wn[i][1]); if (d < best) { best = d; ii = i; } }
	let p1 = I.wv[ii].slice(), p2 = I.wv[(ii + 1) % I.n].slice();
	const r1 = R.wv[ri], r2 = R.wv[(ri + 1) % R.n];
	let tx = r2[0] - r1[0], ty = r2[1] - r1[1];
	const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
	const clip = (a, b, nx, ny, off) => {
		const da = dot(nx, ny, a[0], a[1]) - off, db = dot(nx, ny, b[0], b[1]) - off;
		const out = [];
		if (da <= 0) out.push(a);
		if (db <= 0) out.push(b);
		if (da * db < 0) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 1]); }
		return out;
	};
	let seg = clip(p1, p2, -tx, -ty, -dot(tx, ty, r1[0], r1[1]));
	if (seg.length < 2) return null;
	seg = clip(seg[0], seg[1], tx, ty, dot(tx, ty, r2[0], r2[1]));
	if (seg.length < 2) return null;
	const out = [];
	seg.forEach((p, k) => {
		const sep = dot(rn[0], rn[1], p[0] - r1[0], p[1] - r1[1]);
		if (sep <= 0.5) out.push({ px: p[0], py: p[1], nx: flip ? -rn[0] : rn[0], ny: flip ? -rn[1] : rn[1], sep, id: (flip ? 1 : 0) * 1000 + ri * 100 + ii * 10 + k, jn: 0, jt: 0 });
	});
	return out.length ? out : null;
}

/* ---------------------------------------------------------------- world */
class World {
	constructor() { this.bodies = []; this.arb = new Map(); this.still = 0; this.asleep = false; }
	add(b) { this.bodies.push(b); updateWorld(b); return b; }
	wake() { this.asleep = false; this.still = 0; }
	step() {
		const bs = this.bodies;
		for (const b of bs) {
			if (b.static) continue;
			b.vy += G * DT;
			b.vx *= 0.9995; b.w *= 0.998;
			updateWorld(b);
		}
		// contacts
		const next = new Map();
		for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
			const A = bs[i], B = bs[j];
			if (A.static && B.static) continue;
			if (Math.hypot(A.x - B.x, A.y - B.y) > A.r + B.r + 2) continue;
			const cs = collide(A, B);
			if (!cs) continue;
			const key = i * 64 + j, old = this.arb.get(key);
			if (old) for (const c of cs) { const o = old.cs.find((q) => q.id === c.id); if (o) { c.jn = o.jn; c.jt = o.jt; } }
			next.set(key, { A, B, cs, fr: Math.sqrt(A.fr * B.fr) });
		}
		this.arb = next;
		// warm start + pre-step
		for (const { A, B, cs } of next.values()) for (const c of cs) {
			c.rax = c.px - A.x; c.ray = c.py - A.y; c.rbx = c.px - B.x; c.rby = c.py - B.y;
			const rnA = c.rax * c.ny - c.ray * c.nx, rnB = c.rbx * c.ny - c.rby * c.nx;
			c.mn = 1 / (A.invM + B.invM + A.invI * rnA * rnA + B.invI * rnB * rnB);
			const tx = -c.ny, ty = c.nx;
			const rtA = c.rax * ty - c.ray * tx, rtB = c.rbx * ty - c.rby * tx;
			c.mt = 1 / (A.invM + B.invM + A.invI * rtA * rtA + B.invI * rtB * rtB);
			c.bias = -(0.2 / DT) * Math.min(0, c.sep + 0.6);
			// apply accumulated impulse
			const px = c.jn * c.nx + c.jt * tx, py = c.jn * c.ny + c.jt * ty;
			A.vx -= A.invM * px; A.vy -= A.invM * py; A.w -= A.invI * (c.rax * py - c.ray * px);
			B.vx += B.invM * px; B.vy += B.invM * py; B.w += B.invI * (c.rbx * py - c.rby * px);
		}
		for (let it = 0; it < 12; it++) {
			for (const { A, B, cs, fr } of next.values()) for (const c of cs) {
				// normal
				let dvx = B.vx - B.w * c.rby - A.vx + A.w * c.ray, dvy = B.vy + B.w * c.rbx - A.vy - A.w * c.rax;
				const vn = dvx * c.nx + dvy * c.ny;
				let dj = c.mn * (-vn + c.bias);
				const jn0 = c.jn; c.jn = Math.max(jn0 + dj, 0); dj = c.jn - jn0;
				let px = dj * c.nx, py = dj * c.ny;
				A.vx -= A.invM * px; A.vy -= A.invM * py; A.w -= A.invI * (c.rax * py - c.ray * px);
				B.vx += B.invM * px; B.vy += B.invM * py; B.w += B.invI * (c.rbx * py - c.rby * px);
				// friction
				dvx = B.vx - B.w * c.rby - A.vx + A.w * c.ray; dvy = B.vy + B.w * c.rbx - A.vy - A.w * c.rax;
				const tx = -c.ny, ty = c.nx, vt = dvx * tx + dvy * ty;
				let djt = -vt * c.mt;
				const m = fr * c.jn, jt0 = c.jt; c.jt = clamp(jt0 + djt, -m, m); djt = c.jt - jt0;
				px = djt * tx; py = djt * ty;
				A.vx -= A.invM * px; A.vy -= A.invM * py; A.w -= A.invI * (c.rax * py - c.ray * px);
				B.vx += B.invM * px; B.vy += B.invM * py; B.w += B.invI * (c.rbx * py - c.rby * px);
			}
		}
		let e = 0;
		for (const b of bs) {
			if (b.static) continue;
			b.x += b.vx * DT; b.y += b.vy * DT; b.a += b.w * DT;
			e = Math.max(e, Math.hypot(b.vx, b.vy) + Math.abs(b.w) * b.r * 0.8);
		}
		for (const b of bs) updateWorld(b);
		this.still = e < 3 ? this.still + DT : 0;
		if (this.still > 0.6) this.asleep = true;
	}
}

/* ---------------------------------------------------------------- the cairn */
const PALETTE = {
	dark: [["#7b8499", "#5a6378"], ["#6c7589", "#4d566b"], ["#8a93a6", "#646d82"], ["#737d92", "#515a6e"], ["#9aa3b5", "#6e788c"]],
	light: [["#b3ab9f", "#8c857a"], ["#a39c91", "#7e776d"], ["#bdb5a8", "#948d82"], ["#aaa296", "#837c72"], ["#c6beb1", "#9d968a"]],
};
const SIZES = [[31, 10.5], [24, 9.5], [18, 8], [12.5, 6.5], [7.5, 5.5]];

function stoneSprite(b, colors, dark, seed) {
	const pad = 4, w = Math.ceil(b.rx * 2 + pad * 2), h = Math.ceil(b.ry * 2 + pad * 2);
	const sc = 2;
	const c = document.createElement("canvas");
	c.width = w * sc; c.height = h * sc;
	const g = c.getContext("2d");
	g.scale(sc, sc); g.translate(w / 2, h / 2);
	const path = () => {
		const v = b.verts, n = v.length;
		g.beginPath();
		const mid = (i) => [(v[i][0] + v[(i + 1) % n][0]) / 2, (v[i][1] + v[(i + 1) % n][1]) / 2];
		const m0 = mid(n - 1);
		g.moveTo(m0[0], m0[1]);
		for (let i = 0; i < n; i++) { const m = mid(i); g.quadraticCurveTo(v[i][0], v[i][1], m[0], m[1]); }
		g.closePath();
	};
	path();
	const grad = g.createLinearGradient(0, -b.ry, 0, b.ry);
	grad.addColorStop(0, colors[0]); grad.addColorStop(1, colors[1]);
	g.fillStyle = grad; g.fill();
	g.save(); g.clip();
	const rnd = rng(seed);
	// speckle
	for (let i = 0; i < 26; i++) {
		g.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
		g.beginPath(); g.arc((rnd() - 0.5) * b.rx * 1.9, (rnd() - 0.5) * b.ry * 1.9, 0.4 + rnd() * 0.7, 0, 6.3); g.fill();
	}
	// light from above: soft top sheen, shade underneath
	const sh = g.createLinearGradient(0, -b.ry, 0, b.ry);
	sh.addColorStop(0, dark ? "rgba(190,210,255,0.28)" : "rgba(255,255,255,0.4)");
	sh.addColorStop(0.45, "rgba(255,255,255,0)");
	sh.addColorStop(1, dark ? "rgba(0,0,10,0.28)" : "rgba(60,40,20,0.18)");
	g.fillStyle = sh; g.fillRect(-w, -h, w * 2, h * 2);
	g.restore();
	path(); g.lineWidth = 0.8; g.strokeStyle = dark ? "rgba(10,14,28,0.55)" : "rgba(70,56,40,0.35)"; g.stroke();
	return { c, w, h };
}

/**
 * Builds a cairn in the bottom `corner` ("left" | "right") of the fixed overlay host.
 * Returns { destroy }.
 */
export function cairn(root, d, { corner = "left", seed = 357, reducedMotion, host = root.querySelector(".overlay-a"), inset = 70 } = {}) {
	if (!host) return null;
	const dark = isDark();
	const W = 150, H = 130;
	const cvs = document.createElement("canvas");
	cvs.className = `dl-cairn dl-cairn-${corner}`;
	cvs.setAttribute("aria-hidden", "true");
	const dpr = Math.min(2, devicePixelRatio || 1);
	cvs.width = W * dpr; cvs.height = H * dpr;
	cvs.style.cssText = `position:absolute;bottom:14px;${corner}:${inset}px;width:${W}px;height:${H}px;pointer-events:none;`;
	host.append(cvs);
	const ctx = cvs.getContext("2d");
	const groundY = H - 10, homeX = W / 2;
	const pal = PALETTE[dark ? "dark" : "light"];

	let world, stones, sprites, alpha = 1, rebuildAt = 0, raf = 0, alive = true, acc = 0, last = 0, fadeDir = 0;

	function build() {
		const rnd = rng(seed + (corner === "left" ? 0 : 11));
		world = new World();
		const ground = makeBody(ensureCCW([[-300, 0], [300, 0], [300, 40], [-300, 40]]), 1, true);
		ground.x = homeX; ground.y = groundY + 20; ground.fr = 0.9;
		world.add(ground);
		stones = [];
		let top = groundY;
		const order = corner === "left" ? SIZES : SIZES.map(([x, y], i) => [x * (i === 0 ? 0.9 : 1.05), y]);
		order.forEach(([rx, ry], i) => {
			const verts = ensureCCW(superellipse(rx, ry, 11, rnd, 0.1));
			const b = makeBody(verts, 0.012, false);
			b.fr = 0.85;
			b.x = homeX + (rnd() - 0.5) * 3; b.y = top - b.ry - 0.2; b.a = (rnd() - 0.5) * 0.05;
			top -= b.ry * 2 - 1;
			b.home = { x: b.x, y: b.y };
			world.add(b);
			stones.push(b);
		});
		sprites = stones.map((b, i) => stoneSprite(b, pal[(i + (corner === "left" ? 0 : 2)) % pal.length], dark, seed * 13 + i));
		for (let i = 0; i < 90 && !world.asleep; i++) world.step();
		world.asleep = true;
		for (const b of stones) { b.vx = b.vy = b.w = 0; b.home = { x: b.x, y: b.y, a: b.a }; }
	}
	function paint() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		ctx.globalAlpha = alpha;
		// soft contact shadow + a thin flat slab so the stones read as sitting on something
		const sg = ctx.createRadialGradient(homeX, groundY + 1, 2, homeX, groundY + 1, 52);
		sg.addColorStop(0, dark ? "rgba(0,0,8,0.45)" : "rgba(40,30,20,0.28)"); sg.addColorStop(1, "rgba(0,0,0,0)");
		ctx.save(); ctx.translate(0, groundY + 1); ctx.scale(1, 0.16); ctx.translate(0, -(groundY + 1)); ctx.fillStyle = sg; ctx.fillRect(homeX - 60, groundY - 52, 120, 110); ctx.restore();
		stones.forEach((b, i) => {
			const s = sprites[i];
			ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
			ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
			ctx.restore();
		});
		ctx.globalAlpha = 1;
	}

	// pointer: nudge stones by the cursor's velocity
	const P = { x: 0, y: 0, t: 0, vx: 0, vy: 0, has: false };
	function frame(now) {
		raf = 0;
		if (!alive || document.hidden) { last = 0; return; }
		const dt = Math.min(0.05, last ? (now - last) / 1000 : DT);
		last = now;
		acc += dt;
		let n = 0;
		while (acc >= DT && n++ < 4) { if (!world.asleep) world.step(); acc -= DT; }
		if (n >= 4) acc = 0;
		// rebuild after a topple: fade out, reset, fade in
		if (world.asleep && !fadeDir && !rebuildAt && toppled()) rebuildAt = now + 1500;
		if (rebuildAt && now >= rebuildAt) { fadeDir = -1; rebuildAt = 0; }
		if (fadeDir) {
			alpha = clamp(alpha + fadeDir * dt * 2.2, 0, 1);
			if (fadeDir < 0 && alpha <= 0) { build(); fadeDir = 1; }
			else if (fadeDir > 0 && alpha >= 1) fadeDir = 0;
		}
		paint();
		if (!world.asleep || fadeDir || rebuildAt || acc > 0) raf = requestAnimationFrame(frame); else last = 0;
	}
	const wake = () => { world.wake(); if (!raf && alive && !document.hidden) raf = requestAnimationFrame(frame); };
	function toppled() {
		for (let i = 0; i < stones.length; i++) {
			const b = stones[i];
			if (Math.abs(b.x - homeX) > 16 + b.rx * 0.5 || Math.abs(b.a) > 0.5) return true;
			if (i && stones[i - 1].y - b.y < stones[i - 1].ry * 0.9) return true;
		}
		return false;
	}
	function onMove(e) {
		const now = performance.now(), dtm = Math.max(8, now - P.t) / 1000;
		const r = cvs.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		if (P.has && now - P.t < 120) { P.vx = (x - P.x) / dtm; P.vy = (y - P.y) / dtm; } else { P.vx = P.vy = 0; }
		P.x = x; P.y = y; P.t = now; P.has = true;
		if (x < -60 || x > W + 60 || y < -60 || y > H + 60 || fadeDir || alpha < 1) return;
		const sp = Math.hypot(P.vx, P.vy);
		if (sp < 120) return;
		let hit = false;
		for (const b of stones) {
			const dx = x - b.x, dy = y - b.y;
			const dist = Math.hypot(dx, dy) - Math.max(b.rx, b.ry) * 0.9;
			if (dist > 22) continue;
			const f = clamp(1 - Math.max(0, dist) / 22);
			// impulse as a velocity change, bigger for lighter (higher) stones, capped so it wobbles rather than flies
			const k = clamp(sp / 1800) * f * 50;
			const ux = P.vx / sp, uy = P.vy / sp;
			const J = b.mass * k;
			const rx = x - b.x, ry = y - b.y;
			const rl = Math.hypot(rx, ry) || 1, clampR = Math.min(rl, b.r * 0.9) / rl;
			const ax = rx * clampR, ay = ry * clampR;
			b.vx += (ux * J) * b.invM; b.vy += (uy * J * 0.4) * b.invM;
			b.w += b.invI * (ax * uy * J * 0.4 - ay * ux * J);
			hit = true;
		}
		if (hit) wake();
	}
	addEventListener("pointermove", onMove, { passive: true });
	const onVis = () => { if (!document.hidden) { last = 0; if (!world.asleep) wake(); } };
	document.addEventListener("visibilitychange", onVis);
	build(); paint();
	d.add(() => {
		alive = false; cancelAnimationFrame(raf);
		removeEventListener("pointermove", onMove);
		document.removeEventListener("visibilitychange", onVis);
		cvs.remove();
	});
	return { cvs };
}
