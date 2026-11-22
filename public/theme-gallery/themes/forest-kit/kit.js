// forest-kit: shared canvas engine for themes 91-98 (stage loop, noise, ridges, pines, birds, water).
import { rng } from "../two-skies-one-shore/lib.js";
export { rng };

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;
export const hex = (s) => {
	const n = parseInt(s.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
// Piecewise-linear colour ramp: stops = [[t, [r,g,b]], ...] sorted by t.
export function ramp(stops, t) {
	if (t <= stops[0][0]) return stops[0][1];
	for (let i = 1; i < stops.length; i++) {
		if (t <= stops[i][0]) {
			const [t0, c0] = stops[i - 1];
			const [t1, c1] = stops[i];
			return mixC(c0, c1, smooth((t - t0) / (t1 - t0)));
		}
	}
	return stops[stops.length - 1][1];
}

// ---------- noise ----------
export function makeNoise(seed, period = 0) {
	const r = rng(seed);
	const N = period || 512;
	const P = new Float32Array(N);
	for (let i = 0; i < N; i++) P[i] = r();
	const at = (i) => P[((i % N) + N) % N];
	return (x) => {
		const i = Math.floor(x);
		const f = x - i;
		const u = f * f * (3 - 2 * f);
		return at(i) * (1 - u) + at(i + 1) * u;
	};
}
export function fbm(noise, x, oct = 4, gain = 0.5) {
	let s = 0, a = 1, n = 0, f = 1;
	for (let o = 0; o < oct; o++) {
		s += a * noise(x * f + o * 17.3);
		n += a;
		a *= gain;
		f *= 2;
	}
	return s / n;
}

// ---------- stage: canvas + loop + pointer + scroll ----------
export function createStage(root, { reducedMotion, dprCap = 1.5, host, build, draw, update, idleBuild = true }) {
	const parent = host || root.querySelector(".scenery-a");
	const canvas = document.createElement("canvas");
	canvas.className = "fk-canvas";
	canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
	parent.appendChild(canvas);
	const ctx = canvas.getContext("2d", { alpha: false });
	const s = {
		canvas, ctx, root, w: 0, h: 0, dpr: 1, t: 0, dt: 0.016, reduced: !!reducedMotion,
		pointer: { x: -1e4, y: -1e4, nx: 0, ny: 0, vx: 0, vy: 0, active: false },
		px: 0, py: 0, scrollY: 0, scrollT: 0, ready: false, frame: 0,
	};
	const cleanups = [];
	let raf = 0, last = 0, running = false, dead = false, built = false, idleId = 0;
	s.on = (target, type, fn, opts) => {
		target.addEventListener(type, fn, opts);
		cleanups.push(() => target.removeEventListener(type, fn, opts));
	};
	const toLocal = (cx, cy) => {
		const r = canvas.getBoundingClientRect();
		return [cx - r.left, cy - r.top];
	};
	s.toLocal = toLocal;
	s.on(window, "pointermove", (e) => {
		const [x, y] = toLocal(e.clientX, e.clientY);
		const p = s.pointer;
		p.vx = x - p.x;
		p.vy = y - p.y;
		if (!p.active) { p.vx = 0; p.vy = 0; }
		p.x = x; p.y = y; p.active = true;
		p.nx = clamp((x / s.w) * 2 - 1, -1, 1);
		p.ny = clamp((y / s.h) * 2 - 1, -1, 1);
		if (s.reduced) s.invalidate();
	}, { passive: true });
	s.on(document.documentElement, "pointerleave", () => { s.pointer.active = false; });
	s.on(root, "scroll", () => {
		s.scrollY = root.scrollTop;
		s.scrollT = clamp(root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight));
		if (s.reduced) s.invalidate();
	}, { passive: true });

	const frame = (now) => {
		raf = 0;
		if (!running || dead) return;
		const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
		last = now;
		step(dt);
		if (running && !s.reduced) raf = requestAnimationFrame(frame);
	};
	function step(dt) {
		s.dt = dt;
		s.t += dt;
		s.frame++;
		const k = 1 - Math.exp(-dt * 3.5);
		s.px += (s.pointer.nx - s.px) * k;
		s.py += (s.pointer.ny - s.py) * k;
		update?.(dt, s);
		draw(s.ctx, s);
	}
	const resize = () => {
		const w = parent.clientWidth, h = parent.clientHeight;
		if (!w || !h) return;
		const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
		if (w === s.w && h === s.h && dpr === s.dpr && built) return;
		s.w = w; s.h = h; s.dpr = dpr;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		const go = () => {
			idleId = 0;
			if (dead) return;
			build(s);
			built = true;
			s.ready = true;
			if (!running) s.start();
			else if (s.reduced) s.invalidate();
		};
		if (idleBuild && !built && "requestIdleCallback" in window) idleId = requestIdleCallback(go, { timeout: 150 });
		else go();
	};
	const ro = new ResizeObserver(() => { if (!dead) resize(); });
	ro.observe(parent);
	s.start = () => {
		if (!s.ready || dead) return;
		running = true;
		last = performance.now();
		if (s.reduced) { s.invalidate(); return; }
		if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
	};
	s.invalidate = () => {
		if (!s.ready || dead || raf) return;
		raf = requestAnimationFrame((now) => { raf = 0; last = now; step(0.016); });
	};
	s.advance = (secs, dt = 1 / 30) => { for (let t = 0; t < secs; t += dt) { s.t += dt; update?.(dt, s); } };
	s.on(document, "visibilitychange", () => {
		if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
		else if (running && !s.reduced && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
	});
	s.destroy = () => {
		dead = true;
		running = false;
		cancelAnimationFrame(raf);
		if (idleId && window.cancelIdleCallback) cancelIdleCallback(idleId);
		ro.disconnect();
		cleanups.forEach((f) => f());
		canvas.remove();
	};
	return s;
}

export function canvasLayer(w, h, dpr) {
	const c = document.createElement("canvas");
	c.width = Math.max(1, Math.ceil(w * dpr));
	c.height = Math.max(1, Math.ceil(h * dpr));
	const x = c.getContext("2d");
	x.scale(dpr, dpr);
	return { c, x, w, h };
}

// A click/press that lands on empty scenery (not on text, links, buttons or the gallery chrome).
export function isEmptyAt(root, cx, cy) {
	const e = document.elementFromPoint(cx, cy);
	if (!e || !root.contains(e) && e !== root) return false;
	if (e.closest("a,button,input,select,textarea,label,.fk-ui,[contenteditable]")) return false;
	if (e === root) return true;
	return ["DIV", "MAIN", "SECTION", "HEADER", "FOOTER", "UL", "OL", "NAV", "PICTURE"].includes(e.tagName);
}
// Tap = pointerdown+up close together with no text selected. Calls fn(clientX, clientY, event).
export function onEmptyTap(stage, fn) {
	let d = null;
	stage.on(window, "pointerdown", (e) => { d = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
	stage.on(window, "pointerup", (e) => {
		if (!d) return;
		const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
		const quick = performance.now() - d.t < 600;
		d = null;
		if (moved > 6 || !quick) return;
		const sel = window.getSelection();
		if (sel && !sel.isCollapsed) return;
		if (isEmptyAt(stage.root, e.clientX, e.clientY)) fn(e.clientX, e.clientY, e);
	});
}

// ---------- ridges & forests ----------
export function ridgeGeo({ w, h, baseY, amp, scale, seed, oct = 4, step = 2, power = 1.4, detail = 0.05, x0 = 0 }) {
	const noise = makeNoise(seed);
	const fine = makeNoise(seed + 99);
	const n = Math.ceil(w / step) + 1;
	const ys = new Float32Array(n);
	const base = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const x = i * step;
		const v = clamp((fbm(noise, x / scale + x0, oct) - 0.3) / 0.52);
		const shape = Math.pow(v, power);
		base[i] = baseY - amp * shape;
		ys[i] = base[i] - amp * detail * fine(x / 11) * (0.4 + shape);
	}
	return { ys, base, step, w, h, n, baseY, amp, yAt: (x) => ys[clamp(Math.round(x / step), 0, n - 1)] };
}

// pal: { top, bottom, shade, lit, light(+1 = light from left), depth }
export function paintRidge(x, geo, pal) {
	const { ys, step, w, h, n } = geo;
	let minY = Infinity;
	for (let i = 0; i < n; i++) if (ys[i] < minY) minY = ys[i];
	const g = x.createLinearGradient(0, minY, 0, h);
	g.addColorStop(0, rgba(pal.top));
	g.addColorStop(1, rgba(pal.bottom));
	x.fillStyle = g;
	x.beginPath();
	x.moveTo(0, h);
	for (let i = 0; i < n; i++) x.lineTo(i * step, ys[i]);
	x.lineTo(w, h);
	x.closePath();
	x.fill();
	if (!pal.shade) return;
	// Faceted shading: from each summit a spur runs down; the face away from the light darkens, the near face lightens.
	const L = pal.light ?? 1;
	const B = geo.base || ys;
	const win = 14;
	const peaks = [], vals = [];
	for (let i = win; i < n - win; i++) {
		let isMax = true, isMin = true;
		for (let j = -win; j <= win; j += 2) {
			if (B[i + j] < B[i] - 0.01) isMax = false;
			if (B[i + j] > B[i] + 0.01) isMin = false;
		}
		if (isMax && (!peaks.length || i - peaks[peaks.length - 1] > win)) peaks.push(i);
		if (isMin && (!vals.length || i - vals[vals.length - 1] > win)) vals.push(i);
	}
	const bottom = Math.min(h, geo.baseY + geo.amp * 0.2);
	const drawFace = (col, fromI, toI, spurI, strength) => {
		const y0 = ys[spurI];
		const g = x.createLinearGradient(0, y0, 0, bottom);
		g.addColorStop(0, rgba(col, strength));
		g.addColorStop(1, rgba(col, 0));
		x.fillStyle = g;
		x.beginPath();
		x.moveTo(spurI * step, ys[spurI]);
		const dir = toI > fromI ? 1 : -1;
		for (let i = fromI; i !== toI + dir; i += dir) x.lineTo(i * step, ys[i]);
		const bx = (spurI - (toI - spurI) * 0.35) * step;
		x.lineTo(toI * step, bottom);
		x.lineTo(bx, bottom);
		x.closePath();
		x.fill();
	};
	for (const p of peaks) {
		const nextV = vals.find((v) => v > p), prevV = [...vals].reverse().find((v) => v < p);
		const rightV = nextV ?? Math.min(n - 1, p + 60), leftV = prevV ?? Math.max(0, p - 60);
		const away = L > 0 ? rightV : leftV, near = L > 0 ? leftV : rightV;
		if (pal.shade) drawFace(pal.shade, p, away, p, 0.55);
		if (pal.lit) drawFace(pal.lit, p, near, p, 0.4);
	}
}

// Pine silhouette polygon relative to base (0,0), apex (0,-h).
export function pinePoly(rand, h, wMax, tiers) {
	const pts = [0, -h];
	const left = [];
	for (let i = 0; i < tiers; i++) {
		const f = (i + 1) / tiers;
		const y = -h + h * 0.94 * Math.pow(f, 0.95) + rand() * h * 0.015;
		const wd = wMax * Math.pow(f, 0.82) * (0.88 + rand() * 0.24);
		const droop = h * 0.035;
		left.push([-wd, y + droop]);
		if (i < tiers - 1) left.push([-wd * 0.34, y - h * 0.055]);
	}
	for (const [px, py] of left) pts.push(px, py);
	pts.push(-wMax * 0.07, 0, wMax * 0.07, 0);
	for (let i = left.length - 1; i >= 0; i--) pts.push(-left[i][0] * (0.9 + rand() * 0.2), left[i][1]);
	return Float32Array.from(pts);
}
export function makePineVariants(seed, count = 8) {
	const r = rng(seed);
	return Array.from({ length: count }, () => pinePoly(r, 1, 0.2 + r() * 0.08, 5 + ((r() * 4) | 0)));
}

// Static forest strip geometry: rows of trees below a ridge.
export function forestGeo({ w, h, ridge, rows = 4, rowGap = 9, tree = [18, 30], gap = [6, 11], seed, bottom, bareFrac = 0 }) {
	const r = rng(seed);
	const trees = [];
	for (let row = 0; row < rows; row++) {
		const rf = row / Math.max(1, rows - 1);
		let x = -10 - r() * gap[1];
		while (x < w + 10) {
			const yBase = ridge.yAt(x) + row * rowGap + tree[0] * 0.45 + r() * 3;
			if (yBase < (bottom ?? h) + 4) {
				const th = lerp(tree[0], tree[1], r()) * (0.85 + rf * 0.3) * (r() < 0.05 ? 1.45 : 1);
				trees.push({ x, y: yBase, h: th, v: (r() * 8) | 0, b: r() < 0.45 ? 0 : r() < 0.6 ? 1 : 2, row, bare: r() < bareFrac });
			}
			x += lerp(gap[0], gap[1], r());
		}
	}
	trees.sort((a, b) => a.y - b.y);
	return { trees, w, h };
}
export function paintForest(x, geo, variants, colors) {
	const buckets = [[], [], []];
	for (const t of geo.trees) buckets[t.b].push(t);
	for (let b = 0; b < 3; b++) {
		x.fillStyle = rgba(colors[b]);
		x.beginPath();
		for (const t of buckets[b]) {
			const p = variants[t.v % variants.length];
			const sw = t.h;
			x.moveTo(t.x + p[0] * sw, t.y + p[1] * t.h);
			for (let i = 2; i < p.length; i += 2) x.lineTo(t.x + p[i] * sw, t.y + p[i + 1] * t.h);
			x.closePath();
		}
		x.fill();
	}
}

// ---------- sprites ----------
export function glowSprite(size, color, stops = [1, 0.35, 0]) {
	const l = canvasLayer(size, size, 1);
	const g = l.x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	g.addColorStop(0, rgba(color, stops[0]));
	g.addColorStop(0.35, rgba(color, stops[1]));
	g.addColorStop(1, rgba(color, stops[2]));
	l.x.fillStyle = g;
	l.x.fillRect(0, 0, size, size);
	return l.c;
}
export function cloudSprite(w, h, seed, color = [255, 255, 255], alpha = 0.5) {
	const r = rng(seed);
	const l = canvasLayer(w, h, 1);
	const puffs = 16 + ((r() * 8) | 0);
	for (let i = 0; i < puffs; i++) {
		const px = w * (0.15 + 0.7 * r());
		const rad = h * (0.22 + r() * 0.3) * (1 - Math.abs(px / w - 0.5) * 0.9);
		const py = h * (0.5 + (r() - 0.5) * 0.25) + rad * 0.1;
		const g = l.x.createRadialGradient(px, py, 0, px, py, rad);
		g.addColorStop(0, rgba(color, alpha));
		g.addColorStop(1, rgba(color, 0));
		l.x.fillStyle = g;
		l.x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
	}
	return l.c;
}
export function makeStars(rand, count, w, maxY) {
	const a = [];
	for (let i = 0; i < count; i++) {
		a.push({ x: rand() * w, y: Math.pow(rand(), 1.2) * maxY, s: rand() < 0.07 ? 1.8 : 0.7 + rand() * 0.7, o: 0.25 + rand() * 0.75, tw: rand() < 0.3 ? 0.6 + rand() * 1.8 : 0, ph: rand() * 6 });
	}
	return a;
}
export function drawStars(x, stars, t, alpha, color = [255, 255, 255], dx = 0, dy = 0) {
	if (alpha <= 0.01) return;
	for (const s of stars) {
		const tw = s.tw ? 0.65 + 0.35 * Math.sin(t * s.tw + s.ph) : 1;
		x.fillStyle = rgba(color, s.o * tw * alpha);
		x.fillRect(s.x + dx, s.y + dy, s.s, s.s);
	}
}

// ---------- wind ----------
// Gentle gusts travelling left to right. Returns roughly -1..1.
export function windAt(t, x, strength = 1, w = 1200) {
	const g = Math.sin(t * 0.7 - x / w * 5) * 0.5 + Math.sin(t * 1.9 - x / w * 11 + 1.3) * 0.25 + Math.sin(t * 0.23 + 0.7) * 0.4 + 0.45;
	return g * strength;
}
// Draw a pre-rendered layer with a horizontal-band shear that reads as treetops swaying.
export function drawSheared(ctx, layer, x, y, { bands = 8, amp = 2, t = 0, phase = 0, wind = 1, fromY = 0 }) {
	const sc = layer.c.width / layer.w;
	const bh = layer.h / bands;
	for (let i = 0; i < bands; i++) {
		const f = 1 - i / (bands - 1); // top bands move most
		const off = (Math.sin(t * 1.3 + i * 0.5 + phase) * 0.5 + windAt(t, x + phase * 90, wind) * 0.9) * amp * f * f;
		ctx.drawImage(layer.c, 0, i * bh * sc, layer.c.width, Math.ceil(bh * sc) + 1, x + off, y + i * bh, layer.w, bh + 0.5);
	}
}

// ---------- water ----------
// Reflection: buf (a canvasLayer of width w, height depth) holds the flipped scene; draw it in wobbling strips.
export function drawReflectionStrips(ctx, buf, { y, w, depth, t, amp = 2, strip = 3, alpha = 0.7, fadeTo = 0.25, phase = 0, calm = 0 }) {
	const sc = buf.c.width / buf.w;
	for (let d = 0; d < depth; d += strip) {
		const f = d / depth;
		const a = lerp(alpha, alpha * fadeTo, f);
		const dx = (Math.sin(d * 0.13 + t * 1.4 + phase) * (0.3 + f) + Math.sin(d * 0.05 - t * 0.7 + phase * 2) * 0.8) * amp * (1 - calm);
		ctx.globalAlpha = a;
		ctx.drawImage(buf.c, 0, d * sc, buf.c.width, strip * sc, dx, y + d, w, strip + 0.6);
	}
	ctx.globalAlpha = 1;
}

// Ring ripples that live on the water plane (flattened by `squash`).
export class Ripples {
	constructor(max = 24) { this.list = []; this.max = max; }
	add(x, y, strength = 1, size = 1) {
		if (this.list.length >= this.max) this.list.shift();
		this.list.push({ x, y, age: 0, a: strength, size });
	}
	step(dt) {
		for (const r of this.list) r.age += dt;
		this.list = this.list.filter((r) => r.age < 3.4 * r.size + 0.8);
	}
	draw(ctx, { squash = 0.22, color = [255, 255, 255], dark = [0, 0, 0], perspective = null }) {
		ctx.lineWidth = 1.1;
		for (const r of this.list) {
			const life = r.age / (3.4 * r.size + 0.8);
			const sq = perspective ? perspective(r.y) : squash;
			for (let k = 0; k < 3; k++) {
				const rad = (r.age * 38 - k * 9) * r.size;
				if (rad <= 0) continue;
				const a = (1 - life) * (1 - k * 0.3) * r.a;
				ctx.strokeStyle = rgba(color, a * 0.7);
				ctx.beginPath();
				ctx.ellipse(r.x, r.y, rad, rad * sq, 0, 0, TAU);
				ctx.stroke();
				ctx.strokeStyle = rgba(dark, a * 0.18);
				ctx.beginPath();
				ctx.ellipse(r.x, r.y + 1.2, rad, rad * sq, 0, 0, TAU);
				ctx.stroke();
			}
		}
	}
}

// ---------- particles ----------
export class Pool {
	constructor(max) {
		this.max = max;
		this.n = 0;
		this.a = Array.from({ length: max }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, s: 1, k: 0, r: 0, vr: 0, c: 0 }));
	}
	emit(x, y, vx, vy, life, s = 1, k = 0, c = 0) {
		if (this.n >= this.max) return null;
		const p = this.a[this.n++];
		p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.s = s; p.k = k; p.c = c; p.r = Math.random() * TAU; p.vr = (Math.random() - 0.5) * 4;
		return p;
	}
	step(dt, fn) {
		for (let i = 0; i < this.n; ) {
			const p = this.a[i];
			p.life -= dt;
			if (p.life <= 0 || fn(p, dt) === false) {
				const last = this.a[--this.n];
				this.a[this.n] = p;
				this.a[i] = last;
			} else i++;
		}
	}
	clear() { this.n = 0; }
}

// ---------- birds ----------
// Adds one bird's silhouette to the current path. (x,y) = body centre, s = wingspan/2 in px.
export function birdPath(ctx, x, y, s, phase, dir = 1, amp = 0.9, pitch = 0) {
	const a1 = Math.sin(phase) * amp;
	const a2 = Math.sin(phase - 0.95) * amp * 1.15 - 0.12 + (1 - amp) * 0.25;
	const c = Math.cos(pitch), sn = Math.sin(pitch);
	const P = (px, py) => [x + px * c - py * sn, y + px * sn + py * c];
	for (const side of [-1, 1]) {
		const wx = side * 0.52 * s * Math.cos(a1), wy = -0.52 * s * Math.sin(a1);
		const tx = wx + side * 0.58 * s * Math.cos(a2), ty = wy - 0.58 * s * Math.sin(a2);
		const [sx0, sy0] = P(side * 0.1 * s, -0.06 * s);
		const [cx0, cy0] = P(wx, wy - 0.2 * s);
		const [tx0, ty0] = P(tx, ty);
		const [cx1, cy1] = P(wx * 0.9, wy + 0.04 * s);
		const [sx1, sy1] = P(side * 0.1 * s, 0.1 * s);
		ctx.moveTo(sx0, sy0);
		ctx.quadraticCurveTo(cx0, cy0, tx0, ty0);
		ctx.quadraticCurveTo(cx1, cy1, sx1, sy1);
		ctx.closePath();
	}
	// body + tail
	const [hx, hy] = P(dir * 0.3 * s, -0.02 * s);
	const [tl, tly] = P(-dir * 0.42 * s, 0.03 * s);
	ctx.moveTo(hx, hy);
	ctx.quadraticCurveTo(...P(0, -0.13 * s), tl, tly);
	ctx.quadraticCurveTo(...P(0, 0.14 * s), hx, hy);
	ctx.closePath();
}
// A perched songbird, facing dir.
export function perchedPath(ctx, x, y, s, dir = 1, bob = 0) {
	const k = s * 0.5;
	ctx.moveTo(x + dir * k * 0.9, y - k * (1.1 + bob));
	ctx.quadraticCurveTo(x + dir * k * 1.15, y - k * 1.4, x + dir * k * 0.7, y - k * 1.6); // head
	ctx.quadraticCurveTo(x + dir * k * 0.2, y - k * 1.5, x - dir * k * 0.3, y - k * 1.1);
	ctx.lineTo(x - dir * k * 1.9, y - k * 0.55 + bob * k); // tail tip
	ctx.lineTo(x - dir * k * 1.7, y - k * 0.2);
	ctx.quadraticCurveTo(x - dir * k * 0.2, y + k * 0.15, x + dir * k * 0.7, y - k * 0.3);
	ctx.quadraticCurveTo(x + dir * k * 1.1, y - k * 0.7, x + dir * k * 0.9, y - k * 1.1);
	ctx.closePath();
}

// Groups of birds that cross the scene with gentle flocking, plus resident birds that perch and flit.
export class Flock {
	constructor({ seed = 1, groups = 3, perGroup = [4, 9], size = [4.5, 8], band = [0.12, 0.4], speed = [38, 70], formation = "loose", respawn = [2, 9], flap = [5, 8], skim = null, fadeDepth = true }) {
		this.r = rng(seed);
		this.o = { groups, perGroup, size, band, speed, formation, respawn, flap, skim };
		this.groups = [];
		this.birds = [];
		this.perchers = [];
		this.w = 1000; this.h = 600;
		this.onSkim = null;
		this.t = 0;
		for (let g = 0; g < groups; g++) {
			const grp = { id: g, active: false, wait: g * 2.2 + this.r() * 3, dir: 1, ax: 0, ay: 0, yc: 0, speed: 50, birds: [], size: 6, bucket: 0, ph: this.r() * 6 };
			this.groups.push(grp);
			const n = ((perGroup[0] + this.r() * (perGroup[1] - perGroup[0])) | 0) || 1;
			for (let i = 0; i < n; i++) {
				const b = { x: -999, y: 0, vx: 0, vy: 0, ph: this.r() * TAU, fs: lerp(flap[0], flap[1], this.r()), s: 5, dir: 1, g, slot: i, ox: 0, oy: 0, bucket: 0, panic: 0, amp: 0.9, skimT: 0, mode: "fly", z: 0 };
				grp.birds.push(b);
				this.birds.push(b);
			}
		}
	}
	resize(w, h) { this.w = w; this.h = h; for (const g of this.groups) if (g.active) this.spawn(g, true); }
	slotOffset(grp, i, n) {
		const sp = grp.size * 2.6;
		if (this.o.formation === "v") {
			const side = i % 2 ? 1 : -1;
			const rank = Math.ceil(i / 2);
			return [-grp.dir * rank * sp * 0.95, side * rank * sp * 0.6 * (i === 0 ? 0 : 1)];
		}
		// loose cloud: deterministic scatter
		const a = (i * 2.399) % TAU;
		const rr = Math.sqrt(i + 0.5) * sp * 0.75;
		return [Math.cos(a) * rr * 1.5, Math.sin(a) * rr * 0.7];
	}
	spawn(grp, instant = false) {
		const { r, o } = this;
		grp.dir = r() < 0.6 ? 1 : -1;
		grp.size = lerp(o.size[0], o.size[1], r());
		grp.speed = lerp(o.speed[0], o.speed[1], r()) * (0.6 + grp.size / o.size[1] * 0.5);
		grp.bucket = grp.size < lerp(o.size[0], o.size[1], 0.4) ? 0 : grp.size < lerp(o.size[0], o.size[1], 0.75) ? 1 : 2;
		const [b0, b1] = o.band;
		grp.yc = lerp(b0, b1, r()) * this.h;
		grp.ay = grp.yc;
		grp.ax = instant ? lerp(this.w * 0.1, this.w * 0.9, r()) : grp.dir > 0 ? -60 - r() * 80 : this.w + 60 + r() * 80;
		grp.active = true;
		grp.ph = r() * TAU;
		grp.glideSeed = r() * 10;
		const n = grp.birds.length;
		grp.birds.forEach((b, i) => {
			const [ox, oy] = this.slotOffset(grp, i, n);
			b.ox = ox; b.oy = oy; b.dir = grp.dir; b.s = grp.size * (0.85 + r() * 0.3); b.bucket = grp.bucket;
			b.x = grp.ax + ox + (r() - 0.5) * 20; b.y = grp.ay + oy + (r() - 0.5) * 10;
			b.vx = grp.dir * grp.speed; b.vy = 0; b.mode = "fly";
		});
	}
	// perches: [{x, y}] (getter-fed each frame). Adds resident birds.
	addResidents(n, size = [5, 7]) {
		for (let i = 0; i < n; i++) {
			this.perchers.push({ x: 0, y: 0, vx: 0, vy: 0, ph: this.r() * TAU, fs: lerp(8, 12, this.r()), s: lerp(size[0], size[1], this.r()), dir: this.r() < 0.5 ? -1 : 1, perch: -1, mode: "wait", timer: i * 0.8 + this.r() * 3, bob: 0, panic: 0, bucket: 1, hopT: 2 + this.r() * 6, amp: 1 });
		}
	}
	scare(x, y, r = 140, force = 1) {
		for (const b of this.birds) {
			if (b.mode !== "fly") continue;
			const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy);
			if (d < r * 1.6) { b.panic = 1.4; b.vx += (dx / (d + 1)) * 90 * force; b.vy += (dy / (d + 1)) * 90 * force - 20; }
		}
		for (const p of this.perchers) {
			if (p.mode !== "perch" && p.mode !== "flit") continue;
			const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
			if (d < r) {
				p.mode = "away"; p.timer = 3 + this.r() * 4; p.panic = 1;
				const a = Math.atan2(dy, dx) + (this.r() - 0.5) * 1.2;
				p.vx = Math.cos(a) * 150 * force; p.vy = Math.sin(a) * 150 * force - 60;
				p.dir = p.vx >= 0 ? 1 : -1;
			}
		}
	}
	update(dt, env = {}) {
		this.t += dt;
		const { w, h, o } = this;
		const wind = env.wind || 0;
		const perches = env.perches || [];
		const ptr = env.pointer;
		const calm = env.calm ?? 1; // 0 = hush (birds idle), 1 = normal
		for (const grp of this.groups) {
			if (!grp.active) {
				if (this.o.respawn && (grp.wait -= dt * calm) <= 0) this.spawn(grp);
				continue;
			}
			const gl = Math.sin(this.t * 0.45 + grp.glideSeed) > 0.55 ? 1 : 0;
			grp.glide = gl;
			grp.ax += grp.dir * grp.speed * dt * (gl ? 0.92 : 1) * (0.4 + 0.6 * Math.min(1, calm + 0.3));
			grp.ay = grp.yc + Math.sin(this.t * 0.31 + grp.ph) * h * 0.035 + (env.yDrift || 0);
			for (const b of grp.birds) {
				const tx = grp.ax + b.ox + Math.sin(this.t * 0.8 + b.slot * 1.7) * 7;
				let ty = grp.ay + b.oy + Math.cos(this.t * 0.95 + b.slot * 2.1) * 5;
				if (o.skim && env.waterY != null) ty = env.waterY - 4 - Math.abs(Math.sin(this.t * 0.6 + b.slot + grp.ph)) * 26 * (b.slot % 2 ? 1 : 0.5);
				let ax = (tx - b.x) * 2.2, ay = (ty - b.y) * 2.2;
				// separation
				for (const q of grp.birds) {
					if (q === b) continue;
					const dx = b.x - q.x, dy = b.y - q.y, d2 = dx * dx + dy * dy;
					const m = grp.size * 2.2;
					if (d2 < m * m && d2 > 0.01) { const d = Math.sqrt(d2); ax += (dx / d) * (m - d) * 6; ay += (dy / d) * (m - d) * 6; }
				}
				if (ptr?.active) {
					const dx = b.x - ptr.x, dy = b.y - ptr.y, d = Math.hypot(dx, dy);
					if (d < 90) { const k = (1 - d / 90) * 220; ax += (dx / (d + 1)) * k; ay += (dy / (d + 1)) * k; }
				}
				ax += wind * 18;
				b.vx += ax * dt; b.vy += ay * dt;
				const damp = Math.exp(-dt * (b.panic > 0 ? 0.6 : 1.5));
				b.vx *= damp; b.vy *= damp;
				if (b.panic > 0) b.panic -= dt;
				b.x += b.vx * dt; b.y += b.vy * dt;
				b.ph += dt * b.fs * TAU * (b.panic > 0 ? 1.5 : gl ? 0.35 : 1) * (0.85 + 0.15 * Math.sin(this.t + b.slot));
				b.amp = b.panic > 0 ? 1.05 : gl ? 0.18 : 0.85;
				b.dir = b.vx >= 0 ? 1 : -1;
				if (o.skim && env.waterY != null && b.y > env.waterY - 5 && (b.skimT -= dt) <= 0) { b.skimT = 1.2 + this.r(); this.onSkim?.(b.x, env.waterY + 2); }
			}
			const offscreen = grp.dir > 0 ? grp.ax - grp.birds.reduce((m, b) => Math.min(m, -b.ox), 0) > w + 120 : grp.ax + grp.birds.reduce((m, b) => Math.max(m, b.ox), 0) < -120;
			if (offscreen) { grp.active = false; grp.wait = lerp(o.respawn[0], o.respawn[1], this.r()); }
		}
		// residents
		const free = perches.map((p, i) => i);
		for (const p of this.perchers) {
			if (p.mode === "perch" || p.mode === "return" || p.mode === "flit") { const i = free.indexOf(p.perch); if (i >= 0) free.splice(i, 1); }
		}
		for (const p of this.perchers) {
			const pc = perches[p.perch];
			if (p.mode === "wait") {
				if ((p.timer -= dt) <= 0 && free.length && calm > 0.3) {
					const i = free.splice((this.r() * free.length) | 0, 1)[0];
					p.perch = i; p.mode = "return";
					p.x = this.r() < 0.5 ? -30 : w + 30; p.y = h * (0.1 + this.r() * 0.3); p.vx = (p.x < 0 ? 1 : -1) * 70; p.vy = 0;
				} else if (p.timer < -4) p.timer = 0.5;
			} else if (p.mode === "perch") {
				if (!pc) { p.mode = "away"; p.timer = 2; p.vx = 60; p.vy = -60; continue; }
				p.x = pc.x; p.y = pc.y;
				p.bob = Math.max(0, p.bob - dt * 3);
				if ((p.hopT -= dt) <= 0) {
					p.hopT = 3 + this.r() * 9;
					if (this.r() < 0.35 && calm > 0.3) { p.mode = "flit"; p.timer = 2 + this.r() * 2.5; const a = this.r() * TAU; p.vx = Math.cos(a) * 70; p.vy = -40 - this.r() * 40; p.dir = p.vx >= 0 ? 1 : -1; }
					else { p.dir = this.r() < 0.5 ? -1 : 1; p.bob = 1; }
				}
			} else if (p.mode === "return" || p.mode === "flit") {
				if (!pc) { p.mode = "away"; p.timer = 2; continue; }
				if (p.mode === "flit" && (p.timer -= dt) > 0) {
					// loop around the perch
					const a = this.t * 2.2 + p.ph;
					const tx = pc.x + Math.cos(a) * 46, ty = pc.y - 18 + Math.sin(a * 1.3) * 18;
					p.vx += (tx - p.x) * 3 * dt * 4; p.vy += (ty - p.y) * 3 * dt * 4;
				} else {
					p.mode = "return";
					const dx = pc.x - p.x, dy = pc.y - p.y, d = Math.hypot(dx, dy);
					const sp = Math.min(95, 16 + d * 1.5);
					p.vx += ((dx / (d + 0.01)) * sp - p.vx) * Math.min(1, dt * 3);
					p.vy += ((dy / (d + 0.01)) * sp - p.vy) * Math.min(1, dt * 3);
					if (d < 3) { p.mode = "perch"; p.hopT = 3 + this.r() * 6; p.vx = p.vy = 0; p.x = pc.x; p.y = pc.y; continue; }
				}
				p.vx *= Math.exp(-dt * 1.2); p.vy *= Math.exp(-dt * 1.2);
				p.x += p.vx * dt; p.y += p.vy * dt;
				p.dir = p.vx >= 0 ? 1 : -1;
				p.ph += dt * p.fs * TAU;
			} else if (p.mode === "away") {
				p.ph += dt * p.fs * TAU * 1.25;
				p.vy -= 18 * dt;
				p.x += p.vx * dt; p.y += p.vy * dt;
				p.vx *= Math.exp(-dt * 0.35);
				if ((p.timer -= dt) <= 0 || p.y < -40 || p.x < -60 || p.x > w + 60) { p.mode = "wait"; p.timer = 5 + this.r() * 8; p.perch = -1; }
			}
		}
	}
	// colors: [far, mid, near] fill styles. reflect: {y, scaleY:-1} optional
	draw(ctx, colors, { reflectY = null, reflectAlpha = 0.4 } = {}) {
		const flip = reflectY != null;
		for (let bk = 0; bk < 3; bk++) {
			ctx.beginPath();
			for (const g of this.groups) {
				if (!g.active) continue;
				for (const b of g.birds) {
					if (b.bucket !== bk) continue;
					const y = flip ? 2 * reflectY - b.y : b.y;
					birdPath(ctx, b.x, y, b.s, flip ? -b.ph : b.ph, b.dir, b.amp, flip ? -Math.atan2(b.vy, Math.abs(b.vx) + 20) * 0.25 : Math.atan2(b.vy, Math.abs(b.vx) + 20) * 0.25);
				}
			}
			for (const p of this.perchers) {
				if (p.bucket !== bk || p.mode === "wait" || p.mode === "perch") continue;
				const y = flip ? 2 * reflectY - p.y : p.y;
				birdPath(ctx, p.x, y, p.s * 1.9, flip ? -p.ph : p.ph, p.dir, 0.95, 0);
			}
			if (!flip) {
				for (const p of this.perchers) {
					if (p.bucket !== bk || p.mode !== "perch") continue;
					perchedPath(ctx, p.x, p.y, p.s * 1.9, p.dir, p.bob * 0.2);
				}
			}
			ctx.fillStyle = flip ? rgbaFromStyle(colors[bk], reflectAlpha) : colors[bk];
			ctx.fill();
		}
	}
	// freeze a good-looking static frame (reduced motion)
	settle(env, secs = 5) {
		for (const g of this.groups) if (!g.active) { g.wait = 0; }
		for (let i = 0; i < secs * 20; i++) this.update(0.05, env);
	}
}
function rgbaFromStyle(s, a) {
	if (Array.isArray(s)) return rgba(s, a);
	const m = /rgba?\(([^)]+)\)/.exec(s);
	if (!m) return s;
	const [r, g, b] = m[1].split(",").map(parseFloat);
	return `rgba(${r},${g},${b},${a})`;
}

// ---------- ui ----------
export function addUI(root, html, cls = "") {
	const host = root.querySelector(".overlay-b") || root;
	const d = document.createElement("div");
	d.className = `fk-ui ${cls}`;
	d.innerHTML = html;
	host.appendChild(d);
	return d;
}
export function addHint(root, text) {
	const host = root.querySelector(".overlay-b") || root;
	const d = document.createElement("div");
	d.className = "fk-hint";
	d.textContent = text;
	host.appendChild(d);
	return { el: d, hide() { d.classList.add("is-gone"); } };
}
export const isDark = () => document.documentElement.classList.contains("dark");
export function watchDark(fn) {
	const mo = new MutationObserver(() => fn(isDark()));
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	return () => mo.disconnect();
}

// ---------- live trees (individually swaying pines) ----------
export class LiveTrees {
	constructor(variants) {
		this.v = variants;
		this.trees = [];
	}
	add(x, y, h, o = {}) {
		const t = { x, y, h, v: o.v ?? (Math.random() * 8) | 0, b: o.b ?? 0, grp: o.grp || "", ww: o.ww ?? 1, lean: 0, shake: 0, shakeV: 0, stiff: 0.7 + Math.random() * 0.6, ph: Math.random() * 6, snow: 0, tag: o.tag };
		this.trees.push(t);
		return t;
	}
	update(dt) {
		for (const t of this.trees) {
			if (t.shake === 0 && t.shakeV === 0) continue;
			t.shakeV += (-90 * t.shake - 3.2 * t.shakeV) * dt;
			t.shake += t.shakeV * dt;
			if (Math.abs(t.shake) < 0.0004 && Math.abs(t.shakeV) < 0.004) { t.shake = 0; t.shakeV = 0; }
		}
	}
	bend(t, time, wind, strength = 1) {
		const gust = windAt(time, t.x, wind);
		return (gust * 0.03 + Math.sin(time * 1.1 + t.ph) * 0.006 * wind) * strength / t.stiff + t.shake;
	}
	crown(t, time, wind) {
		return [t.x + this.bend(t, time, wind) * t.h * 0.97 ** 1.7 * 1, t.y - t.h * 0.97];
	}
	// colors: array of 3 fill styles; ox,oy parallax offset; flip: mirror around y=flipY
	draw(ctx, time, wind, colors, { ox = 0, oy = 0, flipY = null, filter = null, snowColor = null } = {}) {
		for (let bk = 0; bk < 3; bk++) {
			ctx.beginPath();
			for (const t of this.trees) {
				if (t.b !== bk || (filter && !filter(t))) continue;
				this.path(ctx, t, time, wind, ox, oy, flipY);
			}
			ctx.fillStyle = colors[bk];
			ctx.fill();
		}
	}
	path(ctx, t, time, wind, ox, oy, flipY) {
		const p = this.v[t.v % this.v.length];
		const L = this.bend(t, time, wind);
		const h = t.h, w = t.h * t.ww;
		const X = (px, py) => t.x + ox + px * w + L * h * Math.pow(-py, 1.7);
		const Y = (py) => { const y = t.y + oy + py * h; return flipY == null ? y : 2 * flipY - y; };
		ctx.moveTo(X(p[0], p[1]), Y(p[1]));
		for (let i = 2; i < p.length; i += 2) ctx.lineTo(X(p[i], p[i + 1]), Y(p[i + 1]));
		ctx.closePath();
	}
	// returns index of tree hit at (x,y) (already offset-compensated by caller) or -1
	hit(x, y, time, wind, ox = 0, oy = 0, filter = null) {
		let best = -1, bd = 1e9;
		for (let i = 0; i < this.trees.length; i++) {
			const t = this.trees[i];
			if (filter && !filter(t)) continue;
			const top = t.y + oy - t.h;
			if (y < top - 6 || y > t.y + oy + 4) continue;
			const f = clamp((y - top) / t.h);
			const half = t.h * 0.26 * Math.pow(f, 0.85) + 5;
			const cx = t.x + ox + this.bend(t, time, wind) * t.h * Math.pow(1 - f, 1.7);
			if (Math.abs(x - cx) <= half) {
				const d = Math.abs(x - cx) - half + (t.y - t.h) * 0; // prefer nearer (lower base y)
				if (-t.y < bd) { bd = -t.y; best = i; }
			}
		}
		return best;
	}
}
