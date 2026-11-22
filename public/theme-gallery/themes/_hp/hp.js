// _hp/hp.js: shared engine for the hero-photo explorations (#480-499). Every theme is #479 sq-favorite with only the hero portrait replaced.
//  - the _vs4 canvas portrait and the <img>s are hidden (the imgs stay for layout); a role="img" stage with ONE overflow canvas replaces them.
//  - a theme is a small spec { pad, assets, field, fps, idle, setup(E) -> frame(g, t, h, P) }. See fx-*.js.
//  - the loop runs only while hovered (plus a short ease-out), or at a capped idle fps if a spec asks; it pauses on document.hidden, off screen,
//    the motion toggle and reduced motion, and then shows one static (rest) frame.
//  - the signed distance field of Josh's cutout is built once (EDT, a few ms per pass, yielding between passes) and cached across activations.
import { activate as sq } from "../sq-favorite.js";

const A = new URL("../../assets/", import.meta.url).href;
const FILES = { full: "headshot-512.webp", body: "headshot-body-512.webp", bg: "headshot-bg-512.webp" };
const imgCache = new Map();
const loadImg = (k) => {
	if (!imgCache.has(k)) imgCache.set(k, new Promise((res, rej) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = rej; i.src = A + FILES[k]; }));
	return imgCache.get(k);
};
const tick = () => new Promise((r) => setTimeout(r, 0));
const mk = (w, h = w) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

/* ---------- distance field ---------- */
function edt1(f, d, n, v, z) {
	let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
	for (let q = 1; q < n; q++) {
		let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
		while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
		k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
	}
	k = 0;
	for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const dx = q - v[k]; d[q] = dx * dx + f[v[k]]; }
}
async function edt2(f, w, h) { // in place, squared distances; async between the two passes
	const n = Math.max(w, h), a = new Float64Array(n), b = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
	for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) a[y] = f[y * w + x]; edt1(a, b, h, v, z); for (let y = 0; y < h; y++) f[y * w + x] = b[y]; }
	await tick();
	for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) a[x] = f[o + x]; edt1(a, b, w, v, z); for (let x = 0; x < w; x++) f[o + x] = b[x]; }
	await tick();
}
const fieldCache = new Map();
function buildField(body, K) {
	if (!fieldCache.has(K)) fieldCache.set(K, (async () => {
		const n = Math.round(256 * K), G = n * 2, o = (G - 512) / 2, INF = 1e10;
		const c = mk(G), g = c.getContext("2d", { willReadFrequently: true });
		g.drawImage(body, o, o, 512, 512);
		const px = g.getImageData(0, 0, G, G).data;
		const inside = new Uint8Array(G * G);
		for (let i = 0; i < G * G; i++) inside[i] = px[i * 4 + 3] > 127 ? 1 : 0;
		// the photo is cut off at the bottom: extrude its last row downward so no glow hugs the cut
		for (let y = o + 512; y < G; y++) for (let x = 0; x < G; x++) inside[y * G + x] = inside[(o + 511) * G + x];
		const dout = new Float32Array(G * G), din = new Float32Array(G * G);
		for (let i = 0; i < G * G; i++) { dout[i] = inside[i] ? 0 : INF; din[i] = inside[i] ? INF : 0; }
		await tick(); await edt2(dout, G, G); await edt2(din, G, G);
		const F = new Float32Array(n * n);
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
			let s = 0;
			for (let b = 0; b < 4; b++) {
				const k = (2 * j + (b >> 1)) * G + 2 * i + (b & 1);
				s += inside[k] ? -(Math.sqrt(din[k]) - 0.5) : Math.sqrt(dout[k]) - 0.5;
			}
			F[j * n + i] = s / 8; // average of 4 cells, half a du per cell
		}
		await tick();
		const nx = new Float32Array(n * n), ny = new Float32Array(n * n), m = new Float32Array(n * n), ang = new Float32Array(n * n);
		const ex = [], ey = [], enx = [], eny = [];
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
			const k = j * n + i, x = i + 0.5 - n / 2, y = j + 0.5 - n / 2;
			const gx = (F[j * n + Math.min(n - 1, i + 1)] - F[j * n + Math.max(0, i - 1)]) / 2, gy = (F[Math.min(n - 1, j + 1) * n + i] - F[Math.max(0, j - 1) * n + i]) / 2;
			const gl = Math.hypot(gx, gy) || 1; nx[k] = gx / gl; ny[k] = gy / gl;
			const rad = Math.hypot(x, y);
			const wy = Math.min(1, Math.max(0, y / 40)), cut = Math.min(1, Math.max(0, (130 - rad) / 16)); m[k] = 1 - wy * wy * (3 - 2 * wy) * (1 - cut); // glow fades out toward the circle's lower edge (the photo is cut there)
			ang[k] = (Math.atan2(y, x) / (Math.PI * 2) + 1) % 1;
			if (Math.abs(F[k]) < 0.5 && m[k] > 0.5 && (i + j) % 2 === 0) { ex.push(x); ey.push(y); enx.push(nx[k]); eny.push(ny[k]); }
		}
		return { n, F, nx, ny, m, ang, edge: { x: Float32Array.from(ex), y: Float32Array.from(ey), nx: Float32Array.from(enx), ny: Float32Array.from(eny), count: ex.length } };
	})());
	return fieldCache.get(K);
}

/* ---------- small kit ---------- */
export const hsl = (h, s, l) => { s /= 100; l /= 100; const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0) * 255, f(8) * 255, f(4) * 255]; };
export const lut = (stops) => { // [[r,g,b] ...] evenly spaced -> Uint8Array(256*3)
	const out = new Uint8Array(768);
	for (let i = 0; i < 256; i++) { const p = (i / 255) * (stops.length - 1), k = Math.min(stops.length - 2, p | 0), f = p - k; for (let c = 0; c < 3; c++) out[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f; }
	return out;
};
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296); }
export function makeNoise(seed = 7) { // tileable 64x64 value noise, bilinear + smooth
	const r = rng(seed), N = 64, T = new Float32Array(N * N); for (let i = 0; i < T.length; i++) T[i] = r();
	return (x, y) => {
		const xf = Math.floor(x), yf = Math.floor(y); let u = x - xf, v = y - yf; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
		const x0 = xf & 63, y0 = yf & 63, x1 = (x0 + 1) & 63, y1 = (y0 + 1) & 63;
		const a = T[y0 * N + x0], b = T[y0 * N + x1], c = T[y1 * N + x0], d = T[y1 * N + x1];
		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
	};
}
export const PAL = {
	dark: [[120, 255, 205], [110, 195, 255], [175, 140, 255], [255, 130, 215]],
	light: [[0, 165, 135], [25, 115, 225], [120, 70, 225], [215, 50, 165]],
};

/* ---------- engine ---------- */
export function makeHp(spec) {
	return function activate(ctx) {
		const cleanBase = sq(ctx);
		const root = ctx.root, pic = root.querySelector(".site-portrait");
		if (!pic) return cleanBase;
		const html = document.documentElement;
		let dead = false;
		const undo = [];
		const alt = root.querySelector(".site-portrait-light")?.getAttribute("alt") || "Josh";
		for (const im of pic.querySelectorAll("img")) im.setAttribute("alt", "");
		// the _vs4 canvas portrait lands here later: drop it (and its loop) as soon as it appears
		const mo = new MutationObserver(() => { for (const c of pic.querySelectorAll("canvas.vs-portrait")) c.remove(); });
		mo.observe(pic, { childList: true }); undo.push(() => mo.disconnect());

		const dark = html.classList.contains("dark");
		const isReduced = () => ctx.reducedMotion || html.classList.contains("reduce-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches;
		const isPaused = () => root.dataset.motion === "pause" || root.classList.contains("t2-paused");

		let textX = Infinity, cv = null, g = null, E = null, frame = null, raf = 0, visible = true, lastNow = 0, lastDraw = 0, t = 0, h = 0, ht = 0, W0 = 0;
		const P = { x: 0, y: 0, sx: 0, sy: 0 };
		const S = { ht: 0, h: 0, th: 0, enter: { x: 0, y: 0 }, dt: 0.016, still: false };
		let wasBusy = false;

		const canRun = () => !dead && !document.hidden && visible && !isPaused() && !isReduced();
		const render = (tt, hh) => { if (!frame) return false; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); S.h = hh; const busy = frame(g, tt, hh, P) || false;
			if (textX < 1e8) { // never draw behind the hero text: soft horizontal falloff, zero before the text column's left edge (the circle itself is untouched)
				const u = E.u, x1 = Math.max(textX - 8, 140), x0 = Math.min(Math.max(textX - 46, 131), x1 - 6), gr = g.createLinearGradient(E.c + x0 * u, 0, E.c + x1 * u, 0);
				gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
				g.save(); g.globalCompositeOperation = "destination-out"; g.fillStyle = gr; g.fillRect(E.c + x0 * u, 0, cv.width, cv.height); g.restore();
			}
			return busy; };
		const wake = () => { if (!raf && !dead && frame) raf = requestAnimationFrame(loop); };
		function loop(now) {
			raf = 0;
			if (dead || !frame) return;
			if (!canRun()) { h = 0; ht = 0; S.ht = 0; S.still = true; render(t, 0); S.still = false; wasBusy = false; lastNow = 0; return; }
			const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016; lastNow = now; S.dt = dt;
			h += (ht - h) * (1 - Math.exp(-dt * (ht > h ? 5 : 1.6)));
			if (Math.abs(ht - h) < 0.004) h = ht;
			P.sx += (P.x - P.sx) * (1 - Math.exp(-dt * 7)); P.sy += (P.y - P.sy) * (1 - Math.exp(-dt * 7));
			if (ht) S.th += dt; else if (h < 0.01) S.th = 0;
			t += dt;
			const hover = ht > 0 || h > 0;
			const fps = hover || wasBusy ? spec.fps || 60 : spec.idle || 0;
			if (!hover && !fps) { render(t, 0); lastNow = 0; return; }
			let busy = false;
			if (now - lastDraw >= 1000 / fps - 2) { lastDraw = now; busy = render(t, h); wasBusy = !!busy; } else busy = wasBusy;
			if (hover || spec.idle || busy) raf = requestAnimationFrame(loop);
			else { render(t, 0); lastNow = 0; }
		}
		function refresh() { if (!frame) return; if (!canRun()) { h = 0; ht = 0; S.ht = 0; S.still = true; render(t, 0); S.still = false; wasBusy = false; lastNow = 0; } else wake(); }

		async function init() {
			const [imgs] = await Promise.all([Promise.all((spec.assets || ["body"]).map(loadImg)), document.fonts?.ready]);
			if (dead) return;
			const img = {}; (spec.assets || ["body"]).forEach((k, i) => { img[k] = imgs[i]; });
			const K = 1 + (2 * (spec.pad || 0)) / 256;
			const W = pic.clientWidth || 256; W0 = W;
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			{ const pr = pic.getBoundingClientRect(), ls = [".site-title", ".site-tagline", ".site-socials"].map((q) => root.querySelector(q)?.getBoundingClientRect()).filter((r) => r && r.width && r.left > pr.left + pr.width * 0.6 && r.top < pr.bottom - 4);
				if (ls.length && pr.width) textX = (Math.min(...ls.map((r) => r.left)) - (pr.left + pr.width / 2)) * (256 / pr.width); }
			const C = Math.round(W * K * dpr), u = C / (256 * K);
			E = { C, u, K, c: C / 2, R: 128 * u, D: 256 * u, o: C / 2 - 128 * u, dark, img, mk, dpr, state: S, noise: makeNoise(11) };
			E.drawImg = (gg, im, s = 1, ox = 0, oy = 0) => gg.drawImage(im, E.c - 128 * u * s + ox * u, E.c - 128 * u * s + oy * u, 256 * u * s, 256 * u * s);
			E.circle = (gg, r = 128, cx = 0, cy = 0) => { gg.beginPath(); gg.arc(E.c + cx * u, E.c + cy * u, r * u, 0, Math.PI * 2); gg.closePath(); };
			E.dome = (gg, r = 128, wide = r) => { const c = E.c, rr = r * u, ww = wide * u; gg.beginPath(); gg.moveTo(c - ww, -50 * u); gg.lineTo(c + ww, -50 * u); gg.lineTo(c + ww, c); gg.lineTo(c + rr, c); gg.arc(c, c, rr, 0, Math.PI, false); gg.lineTo(c - ww, c); gg.closePath(); };
			// opaque background with Josh painted out (push-pull fill of the hole), drawn at asset size then used at any scale
			E.bgFull = () => {
				if (E._bgFull) return E._bgFull;
				const bg = img.bg, out = mk(512), og = out.getContext("2d");
				for (const s of [2, 4, 8, 16, 32, 64, 128, 256]) { const t1 = mk(s), tg = t1.getContext("2d"); tg.imageSmoothingQuality = "high"; tg.drawImage(bg, 0, 0, s, s); og.drawImage(t1, 0, 0, 512, 512); }
				og.drawImage(bg, 0, 0);
				return (E._bgFull = out);
			};
			if (spec.field) { E.fld = await buildField(img.body, K); if (dead) return; E.glow = makeGlow(E); }
			frame = await spec.setup(E);
			if (dead) return;
			cv = mk(C); g = cv.getContext("2d");
			cv.className = "hp-canvas"; cv.setAttribute("aria-hidden", "true");
			cv.style.cssText = `width:${K * 100}%;height:${K * 100}%;left:${(-(K - 1) / 2) * 100}%;top:${(-(K - 1) / 2) * 100}%`;
			const stage = document.createElement("div");
			stage.className = "hp-stage"; stage.setAttribute("role", "img"); stage.setAttribute("aria-label", alt);
			stage.appendChild(cv); pic.appendChild(stage);
			undo.push(() => { stage.remove(); pic.classList.remove("hp-on"); });
			render(spec.t0 ?? 0, 0);
			pic.classList.add("hp-on");
			if (canRun() && spec.idle) wake();
		}
		init().catch((e) => { console.error("[hp]", e); });

		/* pointer: window listeners only, nothing blocks the page */
		const onMove = (e) => {
			if (!frame) return;
			const r = pic.getBoundingClientRect(); if (!r.width) return;
			const k = 256 / r.width, x = (e.clientX - (r.left + r.width / 2)) * k, y = (e.clientY - (r.top + r.height / 2)) * k;
			let inside = Math.hypot(x, y) < (spec.hoverR || 134);
			if (!inside && E.fld) { const n = E.fld.n, i = Math.round(x + n / 2 - 0.5), j = Math.round(y + n / 2 - 0.5); inside = i >= 0 && j >= 0 && i < n && j < n && E.fld.F[j * n + i] < 14 && E.fld.m[j * n + i] > 0.5; }
			P.x = x; P.y = y;
			if (inside && !ht && canRun()) { ht = 1; S.ht = 1; S.enter = { x, y }; P.sx = x; P.sy = y; lastNow = 0; if (canRun()) wake(); }
			else if (!inside && ht) { ht = 0; S.ht = 0; wake(); }
		};
		const onLeave = () => { if (ht) { ht = 0; S.ht = 0; wake(); } };
		addEventListener("pointermove", onMove, { passive: true });
		document.documentElement.addEventListener("pointerleave", onLeave);
		addEventListener("blur", onLeave);
		undo.push(() => { removeEventListener("pointermove", onMove); document.documentElement.removeEventListener("pointerleave", onLeave); removeEventListener("blur", onLeave); });
		const onVis = () => refresh();
		document.addEventListener("visibilitychange", onVis); undo.push(() => document.removeEventListener("visibilitychange", onVis));
		const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; refresh(); });
		io.observe(pic); undo.push(() => io.disconnect());
		const mo2 = new MutationObserver(refresh);
		mo2.observe(root, { attributes: true, attributeFilter: ["data-motion", "class"] }); mo2.observe(html, { attributes: true, attributeFilter: ["class"] });
		undo.push(() => mo2.disconnect());
		const mq = matchMedia("(prefers-reduced-motion: reduce)"); mq.addEventListener?.("change", refresh); undo.push(() => mq.removeEventListener?.("change", refresh));

		return () => { dead = true; cancelAnimationFrame(raf); for (const f of undo) f(); cv = g = frame = E = null; cleanBase?.(); };
	};
}

/* ---------- field glow: a small RGBA buffer shaded per cell, then scaled up onto the main canvas ---------- */
function makeGlow(E) {
	const st = 2, n = E.fld.n;
	const make = (step) => {
		const gn = Math.round(n / step), c = mk(gn), x = c.getContext("2d"), id = x.createImageData(gn, gn);
		return { gn, step, c, x, id, data: id.data, clear() { this.data.fill(0); }, flush(g, comp = "source-over", alpha = 1) { x.putImageData(id, 0, 0); g.save(); g.globalCompositeOperation = comp; g.globalAlpha = alpha; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(c, 0, 0, E.C, E.C); g.restore(); } };
	};
	return { full: () => make(1), half: () => make(st), make };
}
