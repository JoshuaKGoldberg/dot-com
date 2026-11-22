// Dynamic features: lake (aurora reflection + ripples), mist banks, fireflies, tall grass, loon.
import { cloudSprite, rgba } from "../forest-kit/kit.js";
import { reflectInto } from "./scene.js";

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry(a) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function mkCanvas(cls, css, w, h, z) {
	const c = document.createElement("canvas");
	c.width = Math.max(1, Math.ceil(w));
	c.height = Math.max(1, Math.ceil(h));
	c.className = "aa-cv " + cls;
	c.style.cssText = css + (z != null ? `;z-index:${z}` : "");
	return c;
}

// ------------------------------------------------------------------ lake
export function lake(S, o) {
	const pal = o.pal, dark = S.dark;
	const W = S.w, wy = Math.round(S.h * o.horizon), H = Math.ceil(S.h - wy), kv = o.kv ?? 0.34;
	const cv = mkCanvas("aa-lake", `left:0;top:${wy}px;width:${W}px;height:${H}px`, W, H, 30);
	const x = cv.getContext("2d", { alpha: false });
	S.add(cv);
	// static reflection of sky + ridges + pines
	const rs = document.createElement("canvas");
	rs.width = W;
	rs.height = H;
	const rx = rs.getContext("2d");
	reflectInto(rx, o.reflect, { wy, kv, w: W });
	const tint = rx.createLinearGradient(0, 0, 0, H);
	tint.addColorStop(0, rgba(pal.waterTop, dark ? 0.2 : 0.3));
	tint.addColorStop(1, rgba(pal.water, dark ? 0.7 : 0.55));
	rx.fillStyle = tint;
	rx.fillRect(0, 0, W, H);
	const buf = document.createElement("canvas");
	buf.width = W;
	buf.height = H;
	const bx = buf.getContext("2d");
	const base = x.createLinearGradient(0, 0, 0, H);
	base.addColorStop(0, rgba(pal.waterTop));
	base.addColorStop(1, rgba(pal.water));
	const ripples = [];
	const L = {
		wy, H, W, ripples,
		add(px, py, a = 1, size = 1) {
			if (ripples.length >= 5) ripples.shift();
			ripples.push({ x: px, y: py - wy, age: 0, a, size });
		},
	};
	S.lake = L;
	let stirT = 0, tt = 3;
	const amp0 = o.wobble ?? 1.6;
	const SQ = 0.24;
	function wave(px, py) {
		let dx = 0, dy = 0;
		for (const r of ripples) {
			const R = r.age * 62 * r.size, life = r.age / (3.6 * r.size + 0.8);
			const d = Math.hypot(px - r.x, (py - r.y) / SQ);
			const e = Math.exp(-(((d - R) / (16 * r.size + 6)) ** 2)) * (1 - life) * r.a;
			const s = Math.sin((d - R) * 0.32) * e;
			dx += s * 5 * Math.sign(px - r.x || 1);
			dy += s * 2;
		}
		return [dx, dy];
	}
	function paint(t, energy) {
		bx.globalCompositeOperation = "source-over";
		bx.drawImage(rs, 0, 0);
		bx.save();
		bx.setTransform(1, 0, 0, -kv, 0, wy * kv);
		bx.globalCompositeOperation = dark ? "lighter" : "source-over";
		bx.globalAlpha = o.auroraAlpha ?? (dark ? 0.85 : 0.5);
		bx.drawImage(S.aurora.canvas, 0, 0, W, S.aurH);
		bx.restore();
		x.fillStyle = base;
		x.fillRect(0, 0, W, H);
		const amp = amp0 * (1 + energy * 1.6);
		let y0 = 1e9, y1 = -1;
		for (const r of ripples) {
			y0 = Math.min(y0, r.y - 60 * r.size - 8);
			y1 = Math.max(y1, r.y + 60 * r.size + 8);
		}
		const STRIP = 2, SEG = 16;
		for (let r = 0; r < H; r += STRIP) {
			const f = r / H;
			const dx = (Math.sin(r * 0.13 + t * 1.2) * (0.3 + f) + Math.sin(r * 0.05 - t * 0.6) * 0.8) * amp;
			x.globalAlpha = lerp(0.96, 0.5, f);
			if (ripples.length && r > y0 && r < y1) {
				for (let sx = 0; sx < W; sx += SEG) {
					const [wx, wyy] = wave(sx + SEG / 2, r);
					x.drawImage(buf, sx, clamp(r + wyy, 0, H - STRIP), SEG, STRIP, sx + dx + wx, r, SEG + 0.5, STRIP + 0.5);
				}
			} else x.drawImage(buf, 0, r, W, STRIP, dx, r, W, STRIP + 0.5);
		}
		x.globalAlpha = 1;
		const hg = x.createLinearGradient(0, 0, 0, 6);
		hg.addColorStop(0, dark ? "rgba(160,200,230,.22)" : "rgba(255,255,255,.5)");
		hg.addColorStop(1, "rgba(255,255,255,0)");
		x.fillStyle = hg;
		x.fillRect(0, 0, W, 6);
		x.lineWidth = 1.1;
		for (const r of ripples) {
			const life = r.age / (3.6 * r.size + 0.8);
			for (let k = 0; k < 3; k++) {
				const rad = r.age * 62 * r.size - k * 10 * r.size;
				if (rad <= 0) continue;
				const a = (1 - life) * (1 - k * 0.3) * r.a;
				x.strokeStyle = dark ? `rgba(190,225,235,${a * 0.45})` : `rgba(255,255,255,${a * 0.8})`;
				x.beginPath();
				x.ellipse(r.x, r.y, rad, rad * SQ, 0, 0, TAU);
				x.stroke();
			}
		}
	}
	let hint = null;
	if (o.hint) hint = S.hint(o.hint);
	if (o.tap) {
		S.onTap((px, py) => {
			if (py > wy - 4) {
				L.add(px, clamp(py, wy + 4, S.h), 1, 1);
				hint?.hide();
			}
		});
	}
	return {
		frame(dt) {
			tt += dt;
			for (const r of ripples) r.age += dt;
			while (ripples.length && ripples[0].age > 3.6 * ripples[0].size + 0.8) ripples.shift();
			if (o.stir) {
				stirT -= dt;
				const p = S.ptr;
				if (p.active && p.y > wy + 4 && p.speed > 0.3 && stirT <= 0) {
					L.add(p.x, p.y, 0.45, 0.7);
					stirT = 0.28;
				}
			}
			paint(tt, S.ptr.energy);
		},
		still() {
			paint(3, 0);
		},
		destroy() {
			S.lake = null;
		},
	};
}

// ------------------------------------------------------------------ mist
export function mist(S, o) {
	const W = S.w, y0 = Math.round(S.h * o.y0), bh = Math.round(S.h * (o.y1 - o.y0));
	const sc = 0.35;
	const cv = mkCanvas("aa-mist", `left:0;top:${y0}px;width:${W}px;height:${bh}px`, W * sc, bh * sc, o.z ?? 40);
	const x = cv.getContext("2d");
	S.add(cv);
	const sprites = [3, 8, 14].map((seed) => cloudSprite(640, 128, seed, o.color, o.alpha));
	const r = mulberry(o.seed ?? 5);
	const banks = [];
	for (let i = 0; i < o.count; i++) {
		const w = lerp(o.size[0], o.size[1], r()) * (W / 1280 * 0.5 + 0.5);
		const y = (o.cluster ? bh * (0.3 + 0.7 * Math.pow(r(), o.cluster)) : r() * bh) - w * 0.1;
		banks.push({ sp: sprites[i % 3], w, h: w * 0.2, y, x: r() * (W + w * 2), vx: (r() < 0.5 ? -1 : 1) * lerp(o.speed[0], o.speed[1], r()), ox: 0, oy: 0, tx: 0, ty: 0, a: lerp(0.55, 1, r()), ph: r() * 6 });
	}
	let tt = 5;
	function paint(dt, still) {
		x.clearRect(0, 0, cv.width, cv.height);
		const p = S.ptr;
		const k = 1 - Math.exp(-dt * 2.2);
		for (const b of banks) {
			const span = W + b.w * 2;
			const bx = ((((b.x + tt * b.vx) % span) + span) % span) - b.w;
			let infl = 0;
			if (o.stir && p.active && !still) {
				const dx = bx + b.w / 2 + b.ox - p.sx, dy = y0 + b.y + b.h / 2 - p.sy;
				infl = Math.exp(-(dx * dx + dy * dy * 1.6) / (2 * 230 * 230));
				b.tx = Math.sign(dx || 1) * infl * (50 + 120 * p.energy);
				b.ty = -infl * 14;
			} else {
				b.tx = 0;
				b.ty = 0;
			}
			b.ox += (b.tx - b.ox) * k;
			b.oy += (b.ty - b.oy) * k;
			const breathe = 0.85 + 0.15 * Math.sin(tt * 0.3 + b.ph);
			x.globalAlpha = b.a * breathe * (1 - 0.5 * infl);
			x.drawImage(b.sp, (bx + b.ox) * sc, (b.y + b.oy) * sc, b.w * sc, b.h * sc);
		}
		x.globalAlpha = 1;
	}
	return {
		frame(dt) {
			tt += dt;
			paint(dt, false);
		},
		still() {
			paint(0.03, true);
		},
	};
}

// ------------------------------------------------------------------ fireflies
export function fireflies(S, o) {
	const W = S.w, H = S.h;
	const cv = mkCanvas("aa-flies", `left:0;top:0;width:${W}px;height:${H}px`, W, H, 5);
	const x = cv.getContext("2d");
	S.add(cv, S.over);
	const NB = o.tint ? 8 : 1;
	const sprites = new Array(NB);
	const mk = (rgb) => {
		const c = document.createElement("canvas");
		c.width = c.height = 48;
		const s = c.getContext("2d");
		const g = s.createRadialGradient(24, 24, 0, 24, 24, 24);
		g.addColorStop(0, "rgba(255,255,240,1)");
		g.addColorStop(0.1, rgba(rgb, 0.95));
		g.addColorStop(0.32, rgba(rgb, 0.3));
		g.addColorStop(1, rgba(rgb, 0));
		s.fillStyle = g;
		s.fillRect(0, 0, 48, 48);
		return c;
	};
	let tintT = -99, tt = 4;
	const retint = () => {
		for (let i = 0; i < NB; i++) {
			const c = S.aurora.colorAt((i + 0.5) / NB, tt).map((v) => Math.min(255, v * 0.8 + 70));
			sprites[i] = mk(c);
		}
		tintT = tt;
	};
	if (o.tint) retint();
	else sprites[0] = mk(o.rgb);
	const r = mulberry(o.seed ?? 31);
	const n = Math.max(16, Math.min(o.max ?? 36, Math.round((W * H) / (o.density ?? 30000))));
	const yMin = (o.yMin ?? 0.3) * H;
	const flies = [];
	for (let i = 0; i < n; i++) flies.push({ x: r() * W, y: yMin + (H - yMin) * r(), vx: 0, vy: 0, ph: r() * 6.28, bl: 0.35 + r() * 0.5, sz: lerp(10, 20, r()), a: r() * 6.28, orbit: 28 + r() * 70 });
	function paint(still) {
		x.clearRect(0, 0, W, H);
		for (const f of flies) {
			const b = still ? 0.75 : Math.pow(Math.max(0, Math.sin(tt * f.bl + f.ph)), 3) * 0.85 + 0.15;
			x.globalAlpha = (S.dark ? 0.92 : 0.8) * b;
			const s = f.sz * (0.7 + 0.3 * b);
			const sp = o.tint ? sprites[clamp(Math.floor((f.x / W) * NB), 0, NB - 1)] : sprites[0];
			x.drawImage(sp, f.x - s, f.y - s, s * 2, s * 2);
		}
		x.globalAlpha = 1;
	}
	return {
		frame(dt, now) {
			tt += dt;
			if (o.tint && tt - tintT > 3) retint();
			const p = S.ptr;
			const resting = p.active && now - p.moved > 700;
			const moving = p.active && now - p.moved < 250;
			for (const f of flies) {
				f.a += Math.sin(tt * 0.7 + f.ph) * 1.6 * dt;
				let ax = Math.cos(f.a) * 22 + Math.sin(tt * 0.3 + f.ph * 2) * 8;
				let ay = Math.sin(f.a) * 22 - 4;
				if (resting) {
					const ang = tt * 0.5 + f.ph;
					ax += (p.x + Math.cos(ang) * f.orbit - f.x) * 1.1;
					ay += (p.y + Math.sin(ang * 1.3) * f.orbit * 0.7 - f.y) * 1.1;
				} else if (moving) {
					const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1;
					if (d < 200) {
						const k = (1 - d / 200) * 380;
						ax += (dx / d) * k;
						ay += (dy / d) * k;
					}
				}
				if (!resting && f.y < yMin) ay += 40 * (1 - f.y / yMin);
				if (f.x < 10) ax += 60;
				if (f.x > W - 10) ax -= 60;
				if (f.y < 20) ay += 60;
				if (f.y > H - 10) ay -= 60;
				f.vx += (ax - f.vx * 2.2) * dt;
				f.vy += (ay - f.vy * 2.2) * dt;
				f.x += f.vx * dt;
				f.y += f.vy * dt;
			}
			paint(false);
		},
		still() {
			paint(true);
		},
	};
}

// ------------------------------------------------------------------ grass
export function grass(S, o) {
	const W = S.w, top = Math.round(S.h * o.top), gh = S.h - top + 8;
	const dpr = Math.min(S.dpr, 1.25);
	const cv = mkCanvas("aa-grass", `left:0;top:${top}px;width:${W}px;height:${gh}px`, W * dpr, gh * dpr, o.z ?? 70);
	const x = cv.getContext("2d");
	x.scale(dpr, dpr);
	S.add(cv);
	const r = mulberry(o.seed ?? 12);
	const rows = o.rows.map((row, ri) => {
		const blades = [];
		const n = Math.round(row.count * (W / 1280));
		for (let i = 0; i < n; i++) {
			const u = (i + r()) / n;
			const edge = Math.pow(Math.abs(u * 2 - 1), 1.4);
			const clump = 0.75 + 0.5 * Math.sin(u * 23 + ri * 2) * Math.sin(u * 7.3 + ri);
			const h = lerp(row.h[0], row.h[1], r()) * (0.4 + 0.9 * edge) * clamp(clump, 0.5, 1.3);
			blades.push({ x: u * W, h, bw: lerp(2.2, 4.4, r()) * (row.w ?? 1), ph: r() * 6.28, l: 0, lv: 0, q: Math.floor(r() * 3), by: gh - row.sink + r() * 4 });
		}
		return { blades, color: row.color, tip: row.tip };
	});
	const grads = rows.map((row) => {
		const g = x.createLinearGradient(0, gh - row.blades.reduce((m, b) => Math.max(m, b.h), 0) - 10, 0, gh);
		g.addColorStop(0, row.color[1]);
		g.addColorStop(1, row.color[0]);
		return g;
	});
	let tt = 6;
	function paint(dt, still) {
		x.clearRect(0, 0, W, gh);
		const p = S.ptr;
		const sig = 130 + 150 * p.energy;
		const vf = clamp(1 - Math.max(0, top - p.sy) / (S.h * 0.6), 0.35, 1);
		const tipCols = o.tipColors();
		rows.forEach((row, ri) => {
			x.beginPath();
			const tips = [[], [], []];
			for (const b of row.blades) {
				const wind = Math.sin(tt * 0.9 + b.x * 0.006 + b.ph * 0.25) * 0.1 + Math.sin(tt * 0.37 + b.x * 0.002) * 0.09 + Math.sin(tt * 1.7 + b.ph) * 0.015;
				let push = 0;
				if (p.active && !still) {
					const dx = b.x - p.sx;
					push = Math.sign(dx || 1) * Math.exp(-(dx * dx) / (2 * sig * sig)) * vf * (0.55 + 0.5 * p.energy);
				}
				const target = wind + push;
				if (still) {
					b.l = target;
					b.lv = 0;
				} else {
					b.lv += (46 * (target - b.l) - 7.5 * b.lv) * dt;
					b.l += b.lv * dt;
				}
				const hh = b.h, tx = b.x + b.l * hh * 0.85, ty = b.by - hh * (1 - Math.abs(b.l) * 0.12);
				const cx = b.x + b.l * hh * 0.3, cy = b.by - hh * 0.55;
				x.moveTo(b.x - b.bw, b.by);
				x.quadraticCurveTo(cx - b.bw * 0.6, cy, tx, ty);
				x.quadraticCurveTo(cx + b.bw * 0.6, cy, b.x + b.bw, b.by);
				if (row.tip) tips[b.q].push(cx, cy, tx, ty);
			}
			x.fillStyle = grads[ri];
			x.fill();
			if (row.tip) {
				x.lineWidth = 1.3;
				for (let q = 0; q < 3; q++) {
					x.beginPath();
					const a = tips[q];
					for (let i = 0; i < a.length; i += 4) {
						x.moveTo(a[i] + (a[i + 2] - a[i]) * 0.5, a[i + 1] + (a[i + 3] - a[i + 1]) * 0.5);
						x.lineTo(a[i + 2], a[i + 3]);
					}
					x.strokeStyle = tipCols[q];
					x.stroke();
				}
			}
		});
	}
	return {
		frame(dt) {
			tt += dt;
			paint(dt, false);
		},
		still() {
			paint(0.03, true);
		},
	};
}

// ------------------------------------------------------------------ loon
function loonPath(c) {
	c.beginPath();
	c.moveTo(-0.52, 0.0);
	c.quadraticCurveTo(-0.55, -0.05, -0.46, -0.075);
	c.bezierCurveTo(-0.3, -0.13, -0.18, -0.2, -0.02, -0.2);
	c.bezierCurveTo(0.12, -0.2, 0.22, -0.18, 0.27, -0.24);
	c.bezierCurveTo(0.31, -0.3, 0.31, -0.36, 0.33, -0.4);
	c.bezierCurveTo(0.35, -0.46, 0.43, -0.47, 0.46, -0.42);
	c.lineTo(0.65, -0.395);
	c.lineTo(0.47, -0.375);
	c.bezierCurveTo(0.43, -0.36, 0.4, -0.34, 0.39, -0.3);
	c.bezierCurveTo(0.38, -0.22, 0.4, -0.14, 0.44, -0.07);
	c.bezierCurveTo(0.46, -0.03, 0.44, 0.0, 0.4, 0.0);
	c.bezierCurveTo(0.2, 0.025, -0.3, 0.025, -0.52, 0.0);
	c.closePath();
}
export function loon(S, o) {
	const lk = S.lake;
	if (!lk) return {};
	const dpr = Math.min(S.dpr, 1.5);
	const cv = mkCanvas("aa-loon", `left:0;top:${lk.wy}px;width:${lk.W}px;height:${lk.H}px;display:none`, lk.W * dpr, lk.H * dpr, 45);
	const x = cv.getContext("2d");
	S.add(cv);
	const L = clamp(S.w * 0.042, 40, 64);
	const r = mulberry(o.seed ?? 77);
	let st = null, wait = o.first ?? lerp(30, 55, r()), ripT = 0;
	const spawn = () => {
		const dir = r() < 0.5 ? 1 : -1;
		st = { dir, x: dir > 0 ? -L : lk.W + L, y: lk.H * lerp(0.3, 0.5, r()), t: 0, v: lerp(15, 20, r()) };
		cv.style.display = "block";
	};
	S.on(window, "aa-loon", () => {
		if (!st) spawn();
	});
	function draw(t) {
		x.setTransform(dpr, 0, 0, dpr, 0, 0);
		x.clearRect(0, 0, lk.W, lk.H);
		const { dir } = st;
		const y = st.y + Math.sin(t * 0.9) * 0.6;
		const body = S.dark ? "rgba(2,6,14,.96)" : "rgba(22,36,52,.92)";
		x.lineWidth = 1;
		for (const s of [-1, 1]) {
			const g = x.createLinearGradient(st.x - dir * L * 0.5, 0, st.x - dir * L * 2.4, 0);
			g.addColorStop(0, S.dark ? "rgba(180,215,235,.22)" : "rgba(255,255,255,.55)");
			g.addColorStop(1, "rgba(255,255,255,0)");
			x.strokeStyle = g;
			x.beginPath();
			x.moveTo(st.x - dir * L * 0.5, y + 1);
			x.lineTo(st.x - dir * L * 2.4, y + 1 + s * L * 0.2);
			x.stroke();
		}
		const rf = S.dark ? 0.34 : 0.3;
		const slices = 6, sh = (L * 0.34) / slices;
		for (let i = 0; i < slices; i++) {
			x.save();
			x.beginPath();
			x.rect(st.x - L, y + i * sh, L * 2, sh + 0.5);
			x.clip();
			x.translate(st.x + Math.sin(t * 1.6 + i * 1.3) * (0.4 + i * 0.35), y + 1);
			x.scale(dir * L, -L * 0.7);
			x.globalAlpha = rf * (1 - i / (slices + 1));
			loonPath(x);
			x.fillStyle = body;
			x.fill();
			x.restore();
		}
		x.globalAlpha = 1;
		x.save();
		x.translate(st.x, y);
		x.scale(dir * L, L);
		loonPath(x);
		x.fillStyle = body;
		x.fill();
		const c = S.aurora.colorAt(st.x / lk.W, t);
		x.lineWidth = 0.9 / L;
		x.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${S.dark ? 0.45 : 0.18})`;
		x.beginPath();
		x.moveTo(-0.46, -0.075);
		x.bezierCurveTo(-0.3, -0.13, -0.18, -0.2, -0.02, -0.2);
		x.bezierCurveTo(0.12, -0.2, 0.22, -0.18, 0.27, -0.24);
		x.bezierCurveTo(0.31, -0.3, 0.31, -0.36, 0.33, -0.4);
		x.bezierCurveTo(0.35, -0.46, 0.43, -0.47, 0.46, -0.42);
		x.stroke();
		x.fillStyle = S.dark ? "rgba(190,210,230,.55)" : "rgba(240,246,250,.6)";
		x.beginPath();
		x.arc(0.4, -0.415, 0.008, 0, TAU);
		x.fill();
		x.restore();
	}
	return {
		frame(dt) {
			if (!st) {
				wait -= dt;
				if (wait <= 0) spawn();
				return;
			}
			st.t += dt;
			st.x += st.dir * st.v * dt;
			ripT -= dt;
			if (ripT <= 0) {
				lk.add(st.x + st.dir * L * 0.2, lk.wy + st.y, 0.25, 0.55);
				ripT = 3.2;
			}
			draw(st.t);
			if ((st.dir > 0 && st.x > lk.W + L * 3) || (st.dir < 0 && st.x < -L * 3)) {
				st = null;
				wait = lerp(110, 220, r());
				cv.style.display = "none";
			}
		},
		still() {},
	};
}
