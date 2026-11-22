/*
 * #345: pigment droplets in the side margins, simulated as spring blobs and rendered as metaballs.
 * Beads of pigment sit on "wells". Brushing past feeds a well until surface tension gives way: the bead
 * stretches a neck, pinches off and runs down the paper, wobbling on a damped spring, merging with whatever
 * it meets (volume and momentum conserved, pigment mixed), shedding volume as it goes until it dries in place.
 */
import { clamp, marginStrips, mountCanvas, onResize, pointerV, simLoop, smooth } from "./util.js";

const PIG = {
	dark: [[84, 255, 182], [84, 196, 255], [190, 130, 255], [255, 124, 170]],
	light: [[34, 176, 138], [64, 140, 222], [150, 104, 210], [226, 104, 146]],
};
const K = 1.9; // field influence radius / blob radius
const PEAK = 0.9, T = PEAK * (1 - 1 / (K * K)) ** 2; // threshold: a lone blob renders at exactly its radius
const V0 = 40, VCRIT = 98, RC = 3.6, G = 640;

function sprite(rgb) {
	const S = 64, c = document.createElement("canvas");
	c.width = c.height = S;
	const x = c.getContext("2d"), im = x.createImageData(S, S);
	for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
		const rx = (i + 0.5) / S * 2 - 1, ry = (j + 0.5) / S * 2 - 1, r2 = rx * rx + ry * ry;
		const f = r2 >= 1 ? 0 : (1 - r2) ** 2;
		const a = f * PEAK, o = (j * S + i) * 4;
		im.data[o] = rgb[0]; im.data[o + 1] = rgb[1]; im.data[o + 2] = rgb[2]; im.data[o + 3] = Math.round(a * 255);
	}
	x.putImageData(im, 0, 0);
	return c;
}

const blob = (x, y, V, col) => ({ x, y, V, col, vx: 0, vy: 0, s: 0, sv: 0, ax: 0, ay: 1, rest: 0 });
const rad = (b) => Math.sqrt(Math.max(0, b.V));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function ink(root, d, { dark, reducedMotion }) {
	const host = root.querySelector(".scenery-c");
	if (!host) return;
	const pal = PIG[dark ? "dark" : "light"];
	const sprites = new Map();
	const spr = (col) => {
		const key = col.map(Math.round).join();
		let s = sprites.get(key);
		if (!s) { s = sprite(col.map(Math.round)); sprites.set(key, s); if (sprites.size > 60) sprites.delete(sprites.keys().next().value); }
		return s;
	};
	const pt = pointerV(d, () => { if (nearAny()) loop.wake(); });
	const S = Math.min(1.25, Math.max(1, devicePixelRatio || 1)); // field resolution (canvas px per CSS px)
	let worlds = [], H = 0, hostRect = { left: 0, top: 0 };
	let clock = 0, seed = 345;
	const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

	const build = () => {
		for (const w of worlds) w.cv.remove();
		worlds = [];
		const m = marginStrips(host, 230);
		H = m.H;
		let ci = 0;
		for (const s of m.strips) {
			const cv = mountCanvas(host, "dl-ink", d);
			cv.style.left = `${s.x0}px`; cv.style.top = "0px"; cv.style.width = `${s.w}px`; cv.style.height = `${H}px`;
			cv.width = Math.max(1, Math.round(s.w * S)); cv.height = Math.max(1, Math.round(H * S));
			const ctx = cv.getContext("2d", { willReadFrequently: true });
			const wells = [], n = clamp(Math.round(H / 230), 2, 4);
			let x = s.w * (0.35 + rnd() * 0.3);
			for (let i = 0; i < n; i++) {
				x = clamp(x + (rnd() - 0.5) * 46, 26, s.w - 26);
				const y = H * (0.16 + 0.7 * (i + rnd() * 0.5) / n);
				const w = blob(x, y, V0 * (0.9 + rnd() * 0.25), pal[ci++ % pal.length]);
				w.base = w.V; w.attached = null; w.pinned = true;
				wells.push(w);
			}
			worlds.push({ s, cv, ctx, wells, drops: [], bridges: [], fed: 0, first: 1.1 + rnd() * 1.2 });
		}
		if (!reducedMotion) for (const w of worlds) { w.wells[0].V = VCRIT * 0.985; w.wells[0].tease = true; }
		render();
		if (!reducedMotion) loop.wake();
	};
	const nearAny = () => {
		if (!pt.has) return false;
		const r = host.getBoundingClientRect(), x = pt.x - r.left;
		return worlds.some((w) => x > w.s.x0 - 130 && x < w.s.x0 + w.s.w + 130);
	};

	const kick = (b, dx, dy, mag) => {
		const l = Math.hypot(dx, dy) || 1;
		b.ax = dx / l; b.ay = dy / l; b.sv += mag;
	};

	const pinch = (w, wd) => {
		const Vd = Math.max(14, w.V - w.base * 0.82);
		const drop = blob(w.x + (Math.random() - 0.5) * 2, w.y + rad(w) * 0.6, Vd, w.col);
		drop.neck = { well: w, V0: w.V, Vd }; drop.vy = 6;
		kick(drop, 0, 1, 40);
		wd.drops.push(drop);
		w.V -= 0; // drained gradually while the neck stretches
		w.pinching = drop;
	};

	const stepWorld = (wd, h, px, py, pvx, pvy, pS) => {
		let busy = false;
		const { wells, drops } = wd;
		// cursor feeds and jostles wells, and shoves drops along
		for (const w of wells) {
			const dx = w.x + wd.s.x0 - px, dy = w.y - py, dl = Math.hypot(dx, dy);
			if (pt.has && dl < 120 && pS > 8) {
				const f = (1 - dl / 120) ** 2;
				if (!w.pinching) w.V = Math.min(VCRIT * 1.12, w.V + pS * f * 0.011 * h * 60 * 0.6);
				kick(w, pvx, pvy, pS * f * 0.02);
			}
			// spring wobble
			w.sv += (-w.s * 220 - w.sv * 7) * h; w.s += w.sv * h; w.s = clamp(w.s, -0.9 * rad(w), 1.4 * rad(w));
			if (!w.pinching) {
				if (w.V > VCRIT) { w.tease = false; pinch(w, wd); }
				else if (w.V > w.base * 1.002 && !w.tease) { w.V -= (w.V - w.base) * h / 9; if (w.V - w.base < 0.15) w.V = w.base; }
			}
			if (Math.abs(w.s) > 0.02 || Math.abs(w.sv) > 0.05 || w.pinching || w.V > w.base * 1.002 || w.tease) busy = true;
		}
		for (let i = drops.length - 1; i >= 0; i--) {
			const b = drops[i];
			const r = rad(b);
			const nk = b.neck;
			if (nk) {
				// attached: drips under gravity against the well's pull; the neck thins and finally snaps
				const w = nk.well, dx = b.x - w.x, dy = b.y - w.y, L = Math.hypot(dx, dy);
				const Lmax = 3.2 * (rad(w) + r) + 8;
				b.vy += (G * 0.5 - (L / Lmax) ** 2 * 520) * h; b.vx += (-dx * 6 - b.vx * 3) * h;
				b.x += b.vx * h; b.y += b.vy * h;
				const stretch = clamp(L / Lmax);
				w.V = nk.V0 - nk.Vd * smooth(0.1, 0.95, stretch) * 0.98;
				kick(w, 0, 1, 0); w.s = clamp(w.s + stretch * 0.04, -9, 9);
				if (L >= Lmax * 0.98) {
					w.pinching = null; b.neck = null; w.sv -= 90; kick(w, 0, -1, 0); // recoil
					b.sv += 120; w.V = Math.max(w.base * 0.8, w.V); w.tease = false;
					w.V = Math.max(w.V, w.base * 0.82);
				}
				busy = true;
				continue;
			}
			// pinned on paper: only drops above the pinning radius slide
			const run = Math.max(0, 1 - RC / Math.max(r, 0.01));
			b.vy += G * run * h;
			b.vx += (Math.sin(b.y * 0.045 + b.x * 0.03) * 24 * run) * h;
			const drag = Math.exp(-h * (r < RC * 1.15 ? 9 : 2.1));
			b.vx *= drag * (1 - 0.6 * h * 60 / 60); b.vy *= drag;
			// cursor wake
			if (pt.has) {
				const dx = b.x + wd.s.x0 - px, dy = b.y - py, dl = Math.hypot(dx, dy);
				if (dl < 110) {
					const f = (1 - dl / 110) ** 2;
					b.vx += pvx * f * 0.9 * h * 3; b.vy += pvy * f * 0.9 * h * 3;
					b.vx += (dx / (dl + 1)) * f * 160 * h * 8 * (pS > 30 ? 1 : 0.2);
					if (pS > 40) kick(b, pvx, pvy, pS * f * 0.02);
					b.rest = 0;
				}
			}
			// surface tension: nearby drops and wells pull together, and merge once their edges overlap
			let merged = false;
			const others = [...wells, ...drops.filter((o) => o !== b && !o.neck)];
			for (const o of others) {
				if (o === b || o.dead) continue;
				const dx = o.x - b.x, dy = o.y - b.y, dl = Math.hypot(dx, dy), ro = rad(o), reach = (r + ro) * 1.9;
				if (dl < reach && dl > 0.01) {
					if (dl < (r + ro) * 0.6 || (dl < (r + ro) * 0.8 && Math.abs(b.vy - (o.vy || 0)) < 20)) {
						// coalesce
						const Vt = b.V + o.V, tb = b.V / Vt;
						if (wells.includes(o)) {
							if (o.pinching) continue;
							o.col = mix(o.col, b.col, tb * 0.5);
							o.V += b.V * 0.9; o.sv += 110 + Math.hypot(b.vx, b.vy) * 0.25; kick(o, b.vx, b.vy, 0);
							if (o.V > VCRIT * 1.25) o.V = VCRIT * 1.25;
							b.dead = true; merged = true; break;
						}
						const dvx = b.vx - o.vx, dvy = b.vy - o.vy;
						o.x += (b.x - o.x) * tb; o.y += (b.y - o.y) * tb;
						o.vx = o.vx * (1 - tb) + b.vx * tb; o.vy = o.vy * (1 - tb) + b.vy * tb;
						o.col = mix(o.col, b.col, tb); o.V = Vt;
						o.sv += 140 + Math.hypot(dvx, dvy) * 0.5; kick(o, dx, dy, 0);
						b.dead = true; merged = true; break;
					}
					const pull = (1 - dl / reach) ** 2 * 380 * (wells.includes(o) ? 0.4 : 1);
					b.vx += (dx / dl) * pull * h; b.vy += (dy / dl) * pull * h;
				}
			}
			if (merged) { drops.splice(i, 1); busy = true; continue; }
			b.x += b.vx * h; b.y += b.vy * h;
			const sp = Math.hypot(b.vx, b.vy);
			// shed volume as it runs; dry once it stops
			if (sp > 6) { b.V -= sp * h * 0.016 * r; b.rest = 0; } else b.rest += h;
			if (b.rest > 0.4) b.V -= h * (r < RC ? 4.2 : 1.6);
			if (sp > 14) { b.ax += (b.vx / sp - b.ax) * 0.25; b.ay += (b.vy / sp - b.ay) * 0.25; const al = Math.hypot(b.ax, b.ay) || 1; b.ax /= al; b.ay /= al; }
			// stretch along travel target + damped wobble spring
			const target = clamp(sp / 420) * r * 0.9;
			b.sv += ((target - b.s) * 190 - b.sv * 8.5) * h; b.s += b.sv * h; b.s = clamp(b.s, -0.7 * r, 1.3 * r);
			const hw = wd.s.w;
			if (b.V < 1.6 || b.y > H + 20 || b.x < -30 || b.x > hw + 30) { drops.splice(i, 1); continue; }
			if (sp > 1 || b.V > 1.6) busy = true;
		}
		for (let i = drops.length - 1; i >= 0; i--) if (drops[i].dead) drops.splice(i, 1);
		return busy;
	};

	const step = (h) => {
		pt.relax(h);
		clock += h;
		const r = host.getBoundingClientRect();
		hostRect = r;
		let busy = false;
		for (const wd of worlds) {
			if (!reducedMotion && wd.first > 0) { wd.first -= h; if (wd.first <= 0) { const w = wd.wells[0]; if (w.tease && !w.pinching) w.V = VCRIT + 0.5; } busy = true; }
			const lx = pt.x - r.left - wd.s.x0;
			busy = stepWorld(wd, h, lx + wd.s.x0, pt.y - r.top, pt.vx, pt.vy, pt.speed) || busy;
		}
		return busy;
	};

	/** Metaball pass: accumulate blob kernels additively, then threshold with a pooled rim. */
	const render = () => {
		for (const wd of worlds) {
			const { ctx, cv } = wd, w = cv.width, hh = cv.height;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalCompositeOperation = "source-over";
			ctx.clearRect(0, 0, w, hh);
			ctx.globalCompositeOperation = "lighter";
			let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
			const lobe = (b, ox, oy, r) => {
				const R = r * K * 2 * S, im = spr(b.col), cx = (b.x + ox) * S, cy = (b.y + oy) * S;
				ctx.drawImage(im, cx - R / 2, cy - R / 2, R, R);
				x0 = Math.min(x0, cx - R / 2); y0 = Math.min(y0, cy - R / 2); x1 = Math.max(x1, cx + R / 2); y1 = Math.max(y1, cy + R / 2);
			};
			const draw = (b) => {
				const r = rad(b);
				if (r < 0.4) return;
				// two lobes along the stretch axis: area is conserved, the wobble is the lobe separation
				const sep = b.s * 0.5, rr = r * Math.sqrt(1 / (1 + Math.abs(b.s) / (r * 2.2)));
				lobe(b, b.ax * sep, b.ay * sep, rr);
				lobe(b, -b.ax * sep, -b.ay * sep, rr);
			};
			for (const b of wd.wells) {
				draw(b);
			}
			for (const b of wd.drops) {
				draw(b);
				if (b.neck) {
					const wl = b.neck.well, dx = b.x - wl.x, dy = b.y - wl.y, L = Math.hypot(dx, dy);
					const rw = rad(wl), rd = rad(b);
					const nr = Math.min(rw, rd) * Math.max(0, 1 - L / (3.2 * (rw + rd) + 8)) ** 0.9 * 0.85;
					if (nr > 0.5) for (let k = 1; k <= 3; k++) {
						const tt = k / 4;
						lobe({ x: wl.x + dx * tt, y: wl.y + dy * tt, col: mix(wl.col, b.col, tt) }, 0, 0, nr * (1 - 0.25 * Math.abs(tt - 0.5)));
					}
				}
			}
			ctx.globalCompositeOperation = "source-over";
			x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(w, Math.ceil(x1)); y1 = Math.min(hh, Math.ceil(y1));
			if (x1 <= x0 || y1 <= y0) continue;
			const im = ctx.getImageData(x0, y0, x1 - x0, y1 - y0), px = im.data;
			const out = dark ? 0.78 : 0.7;
			for (let i = 0; i < px.length; i += 4) {
				const a = px[i + 3];
				if (a < 90) { px[i + 3] = 0; continue; }
				const f = a / 255, c = smooth(T - 0.045, T + 0.045, f);
				if (c <= 0) { px[i + 3] = 0; continue; }
				const e = 1 - smooth(T, T + 0.2, f); // 1 at the rim, 0 inside
				const hl = smooth(T + 0.25, PEAK + 0.3, f);
				if (dark) { px[i] = Math.min(255, px[i] * (1 + 0.28 * e) + 9 * hl); px[i + 1] = Math.min(255, px[i + 1] * (1 + 0.28 * e) + 9 * hl); px[i + 2] = Math.min(255, px[i + 2] * (1 + 0.28 * e) + 9 * hl); }
				else { px[i] = px[i] * (1 - 0.3 * e) + 14 * hl; px[i + 1] = px[i + 1] * (1 - 0.3 * e) + 14 * hl; px[i + 2] = px[i + 2] * (1 - 0.3 * e) + 14 * hl; }
				px[i + 3] = Math.round(255 * c * out * (0.82 + 0.18 * e));
			}
			ctx.putImageData(im, x0, y0);
		}
	};

	const loop = simLoop(d, { step, draw: render, fps: 30 });
	build();
	onResize(host, build, d);
	void hostRect; void clock;
}
