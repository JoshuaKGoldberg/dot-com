/*
 * Refined-aurora kit (#301-303, #320).
 *   raisedAurora(level)   top aurora, brightest at ~4-10% of the viewport height, level 1/2/3 = 30/55/80% of #282
 *   marginSky(kind)       baked margin stars / galaxy wisps + a little cursor constellation
 *   sideCurtains(style)   verlet strands in the margins: "magnetic" ribbons or "fieldline" lines
 *   paperBottom()         #276 grain + soft pastel washes along the bottom
 *   footerValley / footerFog   compact footer pieces, run only while on screen
 * Everything is optional per theme; see refined(). Style lives in ra.css.
 */
import { createAuroraCanvas, curtain, marginness, smooth, clamp, lerp } from "../_medium-a/kit.js";
import { grainTile, rng } from "../_quiet-d/kit.js";

const isDark = () => document.documentElement.classList.contains("dark");
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 60));
const unidle = (id) => (window.cancelIdleCallback ? cancelIdleCallback(id) : clearTimeout(id));
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));

/* ---------- shared plumbing ---------- */

function disposer() {
	const fns = [];
	return {
		add: (fn) => (fns.push(fn), fn),
		on(t, type, h, o) { t.addEventListener(type, h, o); fns.push(() => t.removeEventListener(type, h, o)); },
		run() { while (fns.length) try { fns.pop()(); } catch {} },
	};
}

function layer(host, cls) {
	const el = document.createElement("div");
	el.className = `ra-layer ${cls}`;
	host.appendChild(el);
	return el;
}

/** Page geometry relative to #site: the margins either side of the ~52rem column. */
function geometry(root) {
	const rr = root.getBoundingClientRect();
	const page = root.querySelector(".site-page").getBoundingClientRect();
	const left = page.left - rr.left + 24 - 20;
	const right = page.right - rr.left - 24 + 20;
	return { w: rr.width, h: rr.height, ox: rr.left, oy: rr.top, left, right, lm: left, rm: rr.width - right, ok: left >= 84 && rr.width - right >= 84 };
}

/** Window-level pointer with an eased velocity (px/s). */
function pointer(d, onMove) {
	const p = { x: -1e4, y: -1e4, vx: 0, vy: 0, has: false, energy: 0 };
	let t0 = 0;
	d.on(window, "pointermove", (e) => {
		const dt = Math.max(4, e.timeStamp - t0) / 1000;
		if (p.has && t0) {
			const k = Math.min(1, dt * 14);
			p.vx += ((e.clientX - p.x) / dt - p.vx) * k;
			p.vy += ((e.clientY - p.y) / dt - p.vy) * k;
			p.energy = clamp(p.energy + Math.hypot(e.clientX - p.x, e.clientY - p.y) / 700);
		}
		t0 = e.timeStamp; p.x = e.clientX; p.y = e.clientY; p.has = true;
		onMove?.(p);
	}, { passive: true });
	d.on(document, "pointerleave", () => { p.has = false; p.x = p.y = -1e4; onMove?.(p); });
	p.decay = (dt) => {
		const k = Math.exp(-dt * 5);
		p.vx *= k; p.vy *= k; p.energy *= Math.exp(-dt / 1.4);
		if (Math.abs(p.vx) + Math.abs(p.vy) < 4) p.vx = p.vy = 0;
		if (p.energy < 0.004) p.energy = 0;
	};
	return p;
}

/** Sleeping rAF loop: step(dt,t) returns true to keep going. Pauses when hidden or `el` is off-screen. */
function loop(d, step, { fps = 24, el = null } = {}) {
	let raf = 0, want = false, vis = !el, last = 0;
	const minDt = 1000 / fps;
	const frame = (now) => {
		raf = 0;
		if (!want || document.hidden || !vis) return;
		if (now - last >= minDt - 2) {
			const dt = Math.min(0.1, (now - (last || now - minDt)) / 1000);
			last = now;
			want = !!step(dt, now / 1000);
			if (!want) return;
		}
		raf = requestAnimationFrame(frame);
	};
	const start = () => { if (!raf && want && vis && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
	const api = {
		wake() { want = true; start(); },
		stop() { want = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
		get visible() { return vis; },
	};
	d.on(document, "visibilitychange", () => (document.hidden ? raf && (cancelAnimationFrame(raf), (raf = 0)) : start()));
	if (el) {
		const io = new IntersectionObserver((es) => { vis = es[es.length - 1].isIntersecting; if (vis) start(); api.onVisible?.(vis); });
		io.observe(el);
		d.add(() => io.disconnect());
	}
	d.add(() => api.stop());
	return api;
}

function onResize(d, root, fn) {
	let t = 0;
	const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(fn, 60); });
	ro.observe(root);
	d.add(() => { clearTimeout(t); ro.disconnect(); });
}

const STOPS = {
	dark: [[84, 250, 168], [58, 218, 214], [104, 150, 255], [184, 112, 255]],
	light: [[52, 196, 146], [58, 182, 214], [112, 136, 236], [172, 112, 224]],
};
function colorAt(dark, t) {
	const s = STOPS[dark ? "dark" : "light"];
	const f = clamp(t) * (s.length - 1), k = Math.min(s.length - 2, Math.floor(f));
	return s[k].map((c, i) => Math.round(lerp(c, s[k + 1][i], f - k)));
}
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/* ---------- raised top aurora ---------- */

// Gain is relative to #282 (gain 1.75); calibrated by comparing summed canvas alpha.
const LEVEL = { 1: { gain: 0.46 }, 2: { gain: 0.82 }, 3: { gain: 1.18 } };

export function raisedAurora(root, { level = 2, reducedMotion }) {
	const L = LEVEL[level];
	const field = curtain({
		bands: 3,
		// centre at ~7% of the height, corners a little lower; folds wobble a few percent
		base: (u, b, S) => S.h * (0.062 + 0.06 * Math.pow(Math.abs(2 * u - 1), 1.7) + b * 0.018),
		hgt: (u, S) => S.h * (0.075 + 0.025 * Math.abs(2 * u - 1)),
		mx: (x, S) => 0.5 + 0.7 * marginness(x, S.w, 400, 0.2),
		fade: (y, S) => 1 - smooth(S.h * 0.15, S.h * 0.235, y),
		rayAmp: (S) => 0.22 + 0.25 * S.energy,
		edge: (S) => S.h * 0.05,
		pull: 0.3,
		sig: 0.2,
		gain: L.gain,
	});
	const a = createAuroraCanvas({
		root, reducedMotion, scrollAway: true, host: root.querySelector(".scenery-b"), field,
		rest: [0.5, 0.07], clampY: [0, 0.2], iGain: { dark: 1, light: 1.3 },
	});
	return () => a.destroy();
}

/* ---------- margin stars / galaxy ---------- */

export function marginSky(root, { kind = "stars", density = 1, galaxy = 1, reducedMotion, d }) {
	const dark = isDark();
	const host = layer(root.querySelector(".scenery-a"), "ra-sky");
	const base = document.createElement("canvas");
	const live = document.createElement("canvas");
	host.append(base, live);
	const tw = layer(host, "ra-twinkles");
	let M = null, stars = [], edges = new Map();
	const ink = dark ? [214, 228, 252] : [78, 96, 150];
	const tints = dark ? [[214, 228, 252], [190, 214, 255], [255, 238, 214], [196, 255, 232]] : [[80, 100, 160], [112, 96, 190], [60, 140, 150], [120, 110, 170]];

	function build() {
		M = geometry(root);
		const show = M.ok && (kind !== "none");
		host.style.display = show ? "" : "none";
		stars = [];
		if (!show) return;
		const dpr = Math.min(1.5, devicePixelRatio || 1);
		for (const c of [base, live]) {
			c.width = Math.round(M.w * (c === base ? dpr : 1)); c.height = Math.round(M.h * (c === base ? dpr : 1));
		}
		const g = base.getContext("2d");
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, M.w, M.h);
		const sides = [{ x0: 0, m: M.lm, dir: 1 }, { x0: M.w, m: M.rm, dir: -1 }];
		const R = rng(kind === "galaxy" ? 291 : 277);

		if (kind !== "stars" && galaxy > 0) {
			sides.forEach((s, si) => {
				const cols = dark ? [[110, 140, 255], [150, 110, 255], [90, 210, 220], [220, 190, 255]] : [[150, 170, 245], [200, 160, 240], [140, 216, 214], [246, 190, 220]];
				for (let i = 0; i < 64; i++) {
					const t = i / 63;
					const along = Math.pow(t, 0.92);
					const bx = s.m * (0.03 + 0.8 * along) + (R() - 0.5) * s.m * 0.34;
					const by = M.h * (-0.02 + (si ? 0.5 : 0.6) * along) + (R() - 0.5) * 70 + Math.sin(t * 5 + si) * 24;
					const r = 46 + R() * 70;
					const a = (dark ? 0.05 : 0.07) * galaxy * (0.5 + 0.5 * Math.sin(t * Math.PI)) * (0.45 + R() * 0.55) * (1.2 - t * 0.5);
					const x = s.x0 + s.dir * bx;
					const c = cols[(R() * cols.length) | 0];
					const gr = g.createRadialGradient(x, by, 0, x, by, r);
					gr.addColorStop(0, rgba(c, a)); gr.addColorStop(0.55, rgba(c, a * 0.4)); gr.addColorStop(1, rgba(c, 0));
					g.fillStyle = gr;
					g.fillRect(x - r, by - r, r * 2, r * 2);
				}
				// dust: a tight band of faint pin-pricks along the same arc
				for (let i = 0; i < 90; i++) {
					const t = R();
					const x = s.x0 + s.dir * (s.m * (0.03 + 0.8 * t) + (R() - 0.5) * s.m * 0.2);
					const y = M.h * (-0.02 + (si ? 0.5 : 0.6) * t) + (R() - 0.5) * 46 + Math.sin(t * 5 + si) * 24;
					g.fillStyle = rgba(ink, (dark ? 0.35 : 0.3) * galaxy * R());
					g.fillRect(x, y, 1, 1);
				}
			});
			// feather the inner edge so nothing ever meets the text column
			g.globalCompositeOperation = "destination-out";
			for (const s of sides) {
				const gr = g.createLinearGradient(s.x0 + s.dir * s.m * 0.55, 0, s.x0 + s.dir * s.m * 1.02, 0);
				gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
				g.fillStyle = gr;
				g.fillRect(Math.min(s.x0 + s.dir * s.m * 0.55, s.x0 + s.dir * M.w), 0, M.w, M.h);
			}
			g.globalCompositeOperation = "source-over";
		}

		if (kind !== "galaxy") {
			const R2 = rng(kind === "both" ? 253 : 277);
			sides.forEach((s) => {
				const n = Math.round((s.m * M.h) / (dark ? 5600 : 9000) * density);
				for (let tries = 0, got = 0; got < n && tries < n * 12; tries++) {
					const u = R2(), v = R2();
					const accept = (0.3 + 0.7 * Math.pow(1 - v, 1.5)) * (1 - smooth(0.5, 0.98, u));
					if (R2() > accept) continue;
					got++;
					const top = 1 - v;
					stars.push({
						x: s.x0 + s.dir * (8 + u * (s.m - 20)), y: v * M.h,
						r: 0.55 + R2() * (0.7 + top * 0.7) + (R2() > 0.93 ? 0.6 : 0),
						a: (0.35 + R2() * 0.6) * (dark ? 0.8 : 0.6), c: tints[(R2() * tints.length) | 0], ph: R2() * 6.3, side: s.dir,
					});
				}
			});
		}
		for (const st of stars) {
			if (st.r > 1.35) {
				const gr = g.createRadialGradient(st.x, st.y, 0, st.x, st.y, st.r * 5);
				gr.addColorStop(0, rgba(st.c, st.a * 0.28)); gr.addColorStop(1, rgba(st.c, 0));
				g.fillStyle = gr; g.fillRect(st.x - st.r * 5, st.y - st.r * 5, st.r * 10, st.r * 10);
			}
			g.fillStyle = rgba(st.c, st.a);
			g.beginPath(); g.arc(st.x, st.y, st.r, 0, 6.283); g.fill();
		}
		// a few CSS-twinkling beacons (opacity-only animation, no JS)
		tw.textContent = "";
		stars.filter((s) => s.r > 1.1).slice(0, 9).forEach((s, i) => {
			const e = document.createElement("i");
			e.style.cssText = `left:${s.x - 2}px;top:${s.y - 2}px;animation-delay:${-(i * 1.7).toFixed(1)}s;animation-duration:${(4 + (i % 4) * 1.3).toFixed(1)}s;background:${rgba(s.c, 1)};box-shadow:0 0 6px 1px ${rgba(s.c, 0.5)}`;
			tw.appendChild(e);
		});
		wake();
	}

	// Cursor constellation (#277): nearby stars brighten and the closest few join up.
	const ptr = pointer(d, () => wake());
	const R = 160;
	function draw() {
		const g = live.getContext("2d");
		g.clearRect(0, 0, live.width, live.height);
		if (!M || !stars.length) return false;
		const px = ptr.x - M.ox, py = ptr.y - M.oy;
		const near = [];
		for (let i = 0; i < stars.length; i++) {
			const s = stars[i];
			const dd = Math.hypot(px - s.x, py - s.y);
			if (dd > R) { s.prox = 0; continue; }
			s.prox = 1 - dd / R;
			near.push([dd, i]);
			const c = colorAt(dark, 0.15 + 0.6 * (1 - s.prox));
			g.fillStyle = rgba(c, Math.min(1, s.a * 0.4 + s.prox * (dark ? 0.7 : 0.8)));
			g.beginPath(); g.arc(s.x, s.y, s.r + s.prox * 1.1 + ptr.energy * s.prox * 0.5, 0, 6.283); g.fill();
		}
		near.sort((a, b) => a[0] - b[0]);
		const pick = near.slice(0, 4).map((n) => n[1]).sort((a, b) => stars[a].y - stars[b].y);
		const liveKeys = new Set();
		for (let k = 0; k < pick.length - 1; k++) liveKeys.add(pick[k] + "-" + pick[k + 1]);
		for (const k of liveKeys) if (!edges.has(k)) edges.set(k, 0);
		for (const [k, a] of edges) {
			const na = liveKeys.has(k) ? Math.min(a + 0.1, 1) : a - 0.04;
			if (na <= 0) { edges.delete(k); continue; }
			edges.set(k, na);
			const [i, j] = k.split("-").map(Number);
			g.strokeStyle = rgba(colorAt(dark, 0.35), na * 0.42);
			g.lineWidth = 0.8;
			g.beginPath(); g.moveTo(stars[i].x, stars[i].y); g.lineTo(stars[j].x, stars[j].y); g.stroke();
		}
		return near.length > 0 || edges.size > 0;
	}
	const lp = loop(d, (dt) => { ptr.decay(dt); const more = draw(); return more; }, { fps: 30 });
	const wake = () => lp.wake();
	onResize(d, root, build);
	const job = idle(build);
	d.add(() => { unidle(job); host.remove(); });
}

/* ---------- side curtains: verlet strands in the margins ---------- */

export function sideCurtains(root, { style = "magnetic", reducedMotion, d }) {
	const dark = isDark();
	const host = layer(root.querySelector(".scenery-b"), "ra-curtains");
	const N = style === "magnetic" ? 7 : 9;
	const DT = 1 / 60, SP = 26;
	let M = null, sides = [];
	const ptr = pointer(d, () => lp.wake());
	let time = 0, rest = 0;

	function build() {
		M = geometry(root);
		host.textContent = "";
		sides = [];
		host.style.display = M.ok ? "" : "none";
		if (!M.ok) return;
		const dpr = Math.min(1.25, devicePixelRatio || 1);
		[0, 1].forEach((si) => {
			const m = Math.min(300, si ? M.rm : M.lm) - 6;
			const c = document.createElement("canvas");
			c.width = Math.round(m * dpr); c.height = Math.round(M.h * dpr);
			c.style.cssText = `position:absolute;top:0;${si ? "right" : "left"}:0;width:${m}px;height:${M.h}px`;
			host.appendChild(c);
			const g = c.getContext("2d");
			g.setTransform(dpr, 0, 0, dpr, 0, 0);
			const np = Math.ceil(M.h / SP) + 1;
			const xs = Array.from({ length: N }, (_, s) => m * (0.04 + 0.7 * Math.pow(s / (N - 1), 1.15)));
			// vertical colour ramp (green high, violet low) with a soft envelope baked into the alpha
			const grad = g.createLinearGradient(0, 0, 0, M.h);
			const env = [[0, 0], [0.12, 0.7], [0.45, 1], [0.8, 0.7], [1, 0]];
			env.forEach(([o, a]) => grad.addColorStop(o, rgba(colorAt(dark, 0.1 + 0.85 * o), a)));
			sides.push({ si, c, g, m, np, xs, grad, u: new Float32Array(N * np), v: new Float32Array(N * np), ox: M.ox + (si ? M.w - m : 0), oy: M.oy });
		});
		lp.wake();
	}

	const C2 = 420, K = 10, DAMP = 1.9, R = 120;
	function step(s) {
		const { u, v, np, xs, m } = s;
		const px = ptr.x - s.ox, py = ptr.y - s.oy;
		const near = ptr.has && px > -R * 2 && px < m + R * 2;
		const sx = s.si ? -1 : 1; // inward direction
		let moving = false;
		for (let k = 0; k < N; k++) {
			const o = k * np;
			for (let i = 1; i < np - 1; i++) {
				const j = o + i;
				let f = C2 * (u[j - 1] - 2 * u[j] + u[j + 1]) - K * u[j] - DAMP * v[j];
				if (near) {
					const cxl = s.si ? m - px : px; // cursor x in the side's own outer-anchored frame
					const dx = cxl - (xs[k] + u[j]), dy = py - i * SP;
					const gs = gauss(Math.hypot(dx, dy), R);
					if (gs > 0.01) {
						const vxl = s.si ? -ptr.vx : ptr.vx;
						if (style === "magnetic") f += 520 * gs * (dx / R) + 0.9 * vxl * gs + 0.18 * ptr.vy * gs * Math.tanh(dx / 60);
						else f += -380 * gs * (dx / (Math.abs(dx) + 34)) * (0.4 + 0.6 * Math.exp(-(dy * dy) / (R * R * 3))) + 0.7 * vxl * gs;
					}
				}
				v[j] += f * DT;
				if (v[j] > 900) v[j] = 900; else if (v[j] < -900) v[j] = -900;
			}
			for (let i = 1; i < np - 1; i++) {
				const j = o + i;
				u[j] = clamp(u[j] + v[j] * DT, -m * 0.55, m * 0.5);
				if (Math.abs(v[j]) > 0.4 || Math.abs(u[j]) > 0.3) moving = true;
			}
		}
		void sx;
		return moving;
	}

	function draw(s, t, e) {
		const { g, m, np, xs, u } = s;
		const flip = s.si;
		g.clearRect(0, 0, m, M.h);
		const A = reducedMotion ? 0 : 1;
		const X = (k, i) => {
			const y = i * SP;
			const sway = A * m * 0.045 * (0.6 * Math.sin(y * 0.006 + t * 0.32 + k * 1.1 + s.si * 2) + 0.4 * Math.sin(y * 0.014 - t * 0.47 + k * 0.7));
			const x = xs[k] + u[k * np + i] + sway;
			return flip ? m - x : x;
		};
		const near = ptr.has ? gauss(Math.min(Math.abs(ptr.x - s.ox), Math.abs(ptr.x - s.ox - m)), 160) : 0;
		const boost = 1 + 0.9 * clamp(near * (0.3 + ptr.energy * 2));
		if (style === "magnetic") {
			g.fillStyle = s.grad;
			for (let k = 0; k < N - 1; k++) {
				const a = (dark ? 0.075 : 0.09) * boost * (0.55 + 0.45 * Math.sin(k * 1.7 + s.si * 2 + (reducedMotion ? 0 : t * 0.25))) * (1 - 0.7 * (k / N));
				g.globalAlpha = a;
				g.beginPath();
				for (let i = 0; i < np; i++) { const x = X(k, i); i ? g.lineTo(x, i * SP) : g.moveTo(x, 0); }
				for (let i = np - 1; i >= 0; i--) g.lineTo(X(k + 1, i), i * SP);
				g.closePath(); g.fill();
			}
		}
		g.lineJoin = "round";
		g.strokeStyle = s.grad;
		for (let k = 0; k < N; k++) {
			const inner = 1 - 0.75 * (k / (N - 1));
			g.beginPath();
			for (let i = 0; i < np; i++) { const x = X(k, i); i ? g.lineTo(x, i * SP) : g.moveTo(x, 0); }
			if (style === "fieldline") {
				g.globalAlpha = (dark ? 0.1 : 0.12) * inner * boost; g.lineWidth = 5; g.stroke();
				g.globalAlpha = (dark ? 0.42 : 0.5) * inner * boost; g.lineWidth = 0.9; g.stroke();
			} else {
				g.globalAlpha = (dark ? 0.3 : 0.38) * inner * boost; g.lineWidth = 0.8; g.stroke();
			}
		}
		g.globalAlpha = 1;
	}

	let acc = 0;
	const lp = loop(d, (dt) => {
		if (!M || !sides.length) return false;
		time += dt;
		ptr.decay(dt);
		acc += dt;
		let moving = false, n = 0;
		while (acc >= DT && n++ < 6) { acc -= DT; for (const s of sides) moving = step(s) || moving; }
		if (n >= 6) acc = 0;
		for (const s of sides) draw(s, time, ptr.energy);
		rest = moving || ptr.energy > 0 ? 0 : rest + dt;
		return !reducedMotion || moving || ptr.energy > 0;
	}, { fps: 30 });
	onResize(d, root, build);
	const job = idle(() => { build(); });
	d.add(() => { unidle(job); host.remove(); });
}

/* ---------- #276 paper texture along the bottom ---------- */

export function paperBottom(root, { strength = 1, d }) {
	const dark = isDark();
	const html = '<div class="ra-wash"><i class="w1"></i><i class="w2"></i><i class="w3"></i></div><div class="ra-grain"></div>';
	// side margins (masked out of the text column in CSS) ...
	const wrap = layer(root.querySelector(".scenery-a"), "ra-paper");
	wrap.innerHTML = html;
	wrap.style.setProperty("--ra-paper", strength);
	// ... and a second copy behind the footer, where it is allowed to run full width.
	const footer = root.querySelector(".site-footer");
	const fp = document.createElement("div");
	fp.className = "ra-footpaper";
	fp.innerHTML = html;
	fp.style.setProperty("--ra-paper", strength);
	footer.classList.add("ra-footer");
	footer.prepend(fp);
	const grains = [wrap, fp].map((e) => e.querySelector(".ra-grain"));
	const job = idle(() => {
		const url = `url(${grainTile(96, 276, dark, dark ? 10 : 11)})`;
		grains.forEach((g) => (g.style.backgroundImage = url));
		wrap.classList.add("is-ready"); fp.classList.add("is-ready");
	});
	d.add(() => { unidle(job); wrap.remove(); fp.remove(); });
}

/* ---------- footer pieces ---------- */

function footerStage(root, { height, d }) {
	const footer = root.querySelector(".site-footer");
	footer.classList.add("ra-footer");
	const wrap = document.createElement("div");
	wrap.className = "ra-foot";
	wrap.style.height = height + "px";
	wrap.setAttribute("aria-hidden", "true");
	const canvas = document.createElement("canvas");
	wrap.appendChild(canvas);
	footer.prepend(wrap);
	const st = { wrap, canvas, g: canvas.getContext("2d"), W: 0, H: height, dpr: 1 };
	st.size = () => {
		const rr = root.getBoundingClientRect(), fr = footer.getBoundingClientRect();
		st.W = Math.round(rr.width);
		wrap.style.left = rr.left - fr.left + "px";
		wrap.style.width = st.W + "px";
		st.dpr = Math.min(1.5, devicePixelRatio || 1);
		canvas.width = Math.round(st.W * st.dpr); canvas.height = Math.round(height * st.dpr);
		st.g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
		st.ox = rr.left; st.oy = fr.bottom + 48 - height;
	};
	d.add(() => { wrap.remove(); footer.classList.remove("ra-footer"); });
	return st;
}

/** Low-res aurora glow painted into a small canvas, then upscaled (the upscale is the blur). */
function skyPainter(dark) {
	const c = document.createElement("canvas");
	const g = c.getContext("2d");
	let img = null, nx = 0, ny = 0, S = 6;
	const tab = Array.from({ length: 32 }, (_, i) => colorAt(dark, i / 31));
	return {
		canvas: c,
		size(W, H) { nx = Math.ceil(W / S); ny = Math.ceil(H / S); c.width = nx; c.height = ny; img = g.createImageData(nx, ny); this.W = W; this.H = H; },
		paint(t, cx, energy, o) {
			const { W, H } = this, d = img.data;
			for (let j = 0; j < ny; j++) {
				const y = (j + 0.5) * S;
				for (let i = 0; i < nx; i++) {
					const x = (i + 0.5) * S, u = x / W;
					const gx = gauss(x - cx, W * 0.2);
					let I = 0, T = 0;
					for (let b = 0; b < 2; b++) {
						const yb = H * (o.y + b * 0.1) + 9 * Math.sin(u * 5 + t * 0.25 + b * 2) + 5 * Math.sin(u * 11 - t * 0.4 + b);
						const dy = yb - y; // >0 above the base
						const q = dy >= 0 ? dy / (H * o.hgt) : dy / (H * 0.05);
						const prof = dy >= 0 ? Math.exp(-q * 1.8) : Math.exp(-q * q * 0.8);
						const ray = 1 + 0.25 * Math.sin(u * 90 + t * 0.3 + b) * Math.sin(u * 31 - t * 0.2);
						const v = prof * ray * (0.5 + 0.6 * gx + 0.3 * energy) * (0.65 + 0.35 * Math.sin(u * 4 + b * 2 + t * 0.2)) * (1 - 0.35 * b);
						I += v; T += (dy >= 0 ? clamp(q / 2.5) : 0) * v;
					}
					const k = (j * nx + i) * 4;
					if (I < 0.01) { d[k + 3] = 0; continue; }
					const col = tab[Math.min(31, (clamp(T / I) * 31) | 0)];
					d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2];
					d[k + 3] = 255 * o.alpha * (1 - Math.exp(-I * 1.4));
				}
			}
			g.putImageData(img, 0, 0);
		},
	};
}

/** Footer piece shared driver: lazy (first view), IO-gated, eases toward the pointer. */
function footerDriver(root, st, d, { reducedMotion, draw, init, fps = 20 }) {
	let built = false, cx = 0.5, energy = 0;
	const ptr = pointer(d, () => lp.wake());
	const lp = loop(d, (dt, t) => {
		if (!built) return false;
		ptr.decay(dt);
		const tx = ptr.has ? clamp((ptr.x - st.ox) / st.W, -0.2, 1.2) : cx;
		const near = ptr.has && ptr.y - st.oy > -140 && ptr.y - st.oy < st.H + 140;
		cx += ((near ? tx : cx) - cx) * Math.min(1, dt * 3);
		energy += ((near ? ptr.energy : 0) - energy) * Math.min(1, dt * 4);
		draw(dt, t, cx * st.W, energy, ptr, near);
		return !reducedMotion || energy > 0.01;
	}, { fps, el: st.wrap });
	lp.onVisible = (v) => {
		if (v && !built) { st.size(); init(); built = true; lp.wake(); }
		else if (v) lp.wake();
	};
	onResize(d, root, () => { if (built) { st.size(); init(); lp.wake(); } });
	return lp;
}

const RIDGE = {
	dark: { back: "#101c30", mid: "#0c1728", front: "#09121f", rim: [110, 220, 200] },
	light: { back: "#e7f1f5", mid: "#dbe9ef", front: "#cfe0e8", rim: [90, 170, 190] },
};

export function footerValley(root, { height = 220, strength = 0.8, reducedMotion, d }) {
	const dark = isDark();
	const st = footerStage(root, { height, d });
	const sky = skyPainter(dark);
	const ridge = document.createElement("canvas");
	const C = RIDGE[dark ? "dark" : "light"];
	let ph = 0;
	function buildRidge() {
		const { W, H, dpr } = st;
		ridge.width = Math.round(W * dpr); ridge.height = Math.round(H * dpr);
		const g = ridge.getContext("2d");
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		const R = rng(263);
		const line = (b, amp, f1, f2, p, fill, rim) => {
			g.beginPath(); g.moveTo(0, H);
			const pts = [];
			for (let x = 0; x <= W + 6; x += 6) {
				const y = H * b - amp * (0.6 * Math.sin(x * f1 + p) + 0.4 * Math.sin(x * f2 + p * 2.3) + 0.2 * Math.sin(x * f2 * 2.9 + p));
				// the valley dips at the centre so the aurora can be seen between the hills
				const dip = 1 - 0.35 * gauss(x - W / 2, W * 0.22);
				pts.push([x, y * 1 + (1 - dip) * 14]);
			}
			for (const [x, y] of pts) g.lineTo(x, y);
			g.lineTo(W + 6, H); g.closePath(); g.fillStyle = fill; g.fill();
			if (rim) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokeStyle = rgba(C.rim, rim); g.lineWidth = 1; g.stroke(); }
		};
		line(0.66, 26, 0.006, 0.017, 1.2, C.back, dark ? 0.16 : 0.2);
		line(0.8, 18, 0.009, 0.022, 4.1, C.mid, 0);
		line(0.93, 10, 0.012, 0.03, 2.2, C.front, 0);
		// a handful of small pines on the front ridge
		g.fillStyle = dark ? "#070f1a" : "#c2d6df";
		const n = Math.round(W / 90);
		for (let i = 0; i < n; i++) {
			const x = R() * W, base = H * 0.95 + 2, h = 14 + R() * 14, w = h * 0.3;
			g.beginPath(); g.moveTo(x, base - h);
			for (let k = 1; k <= 3; k++) { g.lineTo(x + (w * k) / 3, base - h + (h * k) / 3); g.lineTo(x + (w * k) / 6, base - h + (h * k) / 3 - 1); }
			g.lineTo(x - w / 6, base - 1);
			for (let k = 3; k >= 1; k--) { g.lineTo(x - (w * k) / 6, base - h + (h * k) / 3 - 1); g.lineTo(x - (w * k) / 3, base - h + (h * k) / 3); }
			g.closePath(); g.fill();
		}
		if (dark) { // sparse stars above the hills
			for (let i = 0; i < Math.round(W / 22); i++) { g.fillStyle = `rgba(214,228,252,${0.15 + R() * 0.4})`; g.fillRect(R() * W, R() * H * 0.45, 1, 1); }
		}
	}
	footerDriver(root, st, d, {
		reducedMotion,
		init() { buildRidge(); sky.size(st.W, st.H * 0.85); },
		draw(dt, t, cx, energy) {
			if (!reducedMotion) ph += dt * (0.4 + energy * 3);
			sky.paint(ph, cx, energy, { y: 0.47, hgt: 0.13, alpha: (dark ? 0.55 : 0.4) * strength });
			const g = st.g;
			g.clearRect(0, 0, st.W, st.H);
			g.imageSmoothingEnabled = true;
			g.drawImage(sky.canvas, 0, 0, st.W, st.H * 0.85);
			g.drawImage(ridge, 0, 0, st.W, st.H);
		},
	});
}

export function footerFog(root, { height = 230, strength = 1, reducedMotion, d }) {
	const dark = isDark();
	const st = footerStage(root, { height, d });
	const sky = skyPainter(dark);
	const tile = document.createElement("canvas");
	let ph = 0, wind = 0;
	const offs = [0, 0, 0];
	const SPD = [5, 9, 14];
	function buildTile() {
		const TW = 900, TH = 240;
		tile.width = TW; tile.height = TH;
		const g = tile.getContext("2d");
		const R = rng(259);
		const col = dark ? [150, 182, 232] : [168, 214, 222];
		for (let i = 0; i < 26; i++) {
			const x = R() * TW, y = TH * (0.4 + R() * 0.25), r = 50 + R() * 55, a = (dark ? 0.085 : 0.22) * (0.5 + R() * 0.5);
			for (const dx of [-TW, 0, TW]) {
				const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
				gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.5, rgba(col, a * 0.45)); gr.addColorStop(1, rgba(col, 0));
				g.fillStyle = gr; g.fillRect(x + dx - r, y - r, r * 2, r * 2);
			}
		}
	}
	footerDriver(root, st, d, {
		reducedMotion,
		init() { buildTile(); sky.size(st.W, st.H); },
		draw(dt, t, cx, energy, ptr, near) {
			if (!reducedMotion) ph += dt * (0.35 + energy * 2.5);
			// the cursor wafts the fog: a flick adds wind that bleeds off
			if (near) wind += clamp(ptr.vx / 1800, -1, 1) * 40;
			wind *= Math.exp(-dt * 1.3);
			wind = clamp(wind, -90, 90);
			sky.paint(ph, cx, energy, { y: 0.5, hgt: 0.14, alpha: (dark ? 0.5 : 0.38) * strength });
			const g = st.g, W = st.W, H = st.H;
			g.clearRect(0, 0, W, H);
			g.drawImage(sky.canvas, 0, 0, W, H);
			const TW = tile.width;
			for (let k = 0; k < 3; k++) {
				if (!reducedMotion) offs[k] = (offs[k] + (SPD[k] + wind * (0.5 + k * 0.4)) * dt + TW * 4) % TW;
				const sc = 1 + k * 0.25, w = TW * sc, h = tile.height * sc;
				const y = H * (0.5 + k * 0.12) - h * 0.5;
				g.globalAlpha = (0.6 + k * 0.2) * strength;
				for (let x = -offs[k] * sc; x < W; x += w) g.drawImage(tile, x, y, w, h);
			}
			g.globalAlpha = 1;
		},
	});
}

/* ---------- assemble ---------- */

/**
 * refined(ctx, { aurora, sky, curtains, paper, footer })
 *   aurora: 1|2|3     sky: "stars"|"galaxy"|"both"     curtains: "magnetic"|"fieldline"
 *   paper: strength   footer: { kind: "valley"|"fog", ... }
 */
export function refined({ root, reducedMotion }, o) {
	const d = disposer();
	if (o.paper) paperBottom(root, { strength: o.paper, d });
	if (o.sky) marginSky(root, { kind: o.sky, density: o.skyDensity ?? 1, galaxy: o.galaxy ?? 1, reducedMotion, d });
	if (o.curtains) sideCurtains(root, { style: o.curtains, reducedMotion, d });
	if (o.aurora) d.add(raisedAurora(root, { level: o.aurora, reducedMotion }));
	if (o.footer) {
		const f = o.footer;
		(f.kind === "fog" ? footerFog : footerValley)(root, { ...f, reducedMotion, d });
	}
	return () => d.run();
}
