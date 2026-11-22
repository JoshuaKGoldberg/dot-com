/*
 * Wave 14 calm header: a short, dim aurora hugging the very top edge.
 * Brightest at ~0-2% of the viewport height, hangs ~10% at most and is gone by 13%.
 * Roughly 3x slower than the #313 header (every time constant), ~55% of its peak alpha.
 * Canvas is only the top strip, 1/6 resolution; the browser's bilinear upscale is the blur.
 */
import { marginness, rays, smooth, clamp, lerp } from "../_medium-a/kit.js";

const STOPS = {
	dark: [[84, 250, 168], [58, 218, 214], [104, 150, 255], [184, 112, 255]],
	light: [[52, 196, 146], [58, 182, 214], [112, 136, 236], [172, 112, 224]],
};
function ramp(dark) {
	const s = STOPS[dark ? "dark" : "light"], n = 48, t = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const f = (i / (n - 1)) * (s.length - 1), k = Math.min(s.length - 2, Math.floor(f));
		for (let c = 0; c < 3; c++) t[i * 3 + c] = lerp(s[k][c], s[k + 1][c], f - k);
	}
	return t;
}
const SEEDS = [1.3, 4.1, 2.2, 5.7];
const isDarkNow = () => document.documentElement.classList.contains("dark");

export function calmAurora(root, d, { reducedMotion } = {}) {
	const host = root.querySelector(".scenery-b");
	if (!host) return null;
	const reduced = !!reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	Object.assign(canvas.style, { position: "absolute", left: "0", top: "0", width: "100%", pointerEvents: "none", willChange: "transform" });
	host.appendChild(canvas);
	const ctx = canvas.getContext("2d");
	const scale = 6;
	const S = { w: 1, h: 1, nx: 1, ny: 1, strip: 1, cx: 0, energy: 0, near: 0, phase: 0.8, dark: isDarkNow() };
	let img = null, tab = ramp(S.dark), tx = 0.5, raf = 0, last = 0, since = 1e9, dirty = true, alive = true, seen = false;
	let tNear = 0, col = null;
	const ptr = { x: 0, y: 0, has: false };
	const maxA = () => (S.dark ? 0.36 : 0.3);

	function resize() {
		const r = root.getBoundingClientRect();
		S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
		S.strip = Math.ceil(S.h * 0.14);
		S.nx = Math.max(8, Math.ceil(S.w / scale)); S.ny = Math.max(4, Math.ceil(S.strip / scale));
		canvas.width = S.nx; canvas.height = S.ny;
		canvas.style.height = S.strip + "px";
		img = ctx.createImageData(S.nx, S.ny);
		if (!seen) { S.cx = tx = S.w * 0.5; }
		col = new Float32Array(4 * S.nx * 3);
		dirty = true; wake();
	}

	function render() {
		since = 0; dirty = false;
		if (!img) return;
		const { w, h, nx, ny, phase: ph, energy } = S;
		const sig = w * 0.2;
		const hOf = (u, b, g) => h * (0.052 + 0.011 * b) * (0.85 + 0.25 * Math.sin(u * 4.1 + SEEDS[b] + ph * 0.4)) * (1 + 0.4 * g * (0.5 + energy) * (0.4 + 0.6 * S.near));
		for (let b = 0; b < 4; b++) {
			for (let i = 0; i < nx; i++) {
				const x = (i + 0.5) * scale, u = x / w, dx = x - S.cx;
				const g = Math.exp(-(dx * dx) / (2 * sig * sig));
				const ray = Math.max(0.1, 1 + (0.12 + 0.12 * energy) * rays(u, ph, b));
				const amp = (0.62 + 0.38 * Math.sin(u * 3 + SEEDS[b] * 2 + ph * 0.5)) * (0.55 + 0.75 * g * (0.4 + 0.6 * S.near) + 0.25 * energy) * (1 - 0.2 * b) * (0.72 + 0.4 * marginness(x, w, 400, 0.2)) * 0.875;
				const k = (b * nx + i) * 3;
				col[k] = hOf(u, b, g); col[k + 1] = ray * amp; col[k + 2] = g;
			}
		}
		const d8 = img.data, ma = maxA() * 255, hh = S.h;
		for (let j = 0; j < ny; j++) {
			const y = (j + 0.5) * scale;
			const fade = 1 - smooth(hh * 0.095, hh * 0.13, y);
			for (let i = 0; i < nx; i++) {
				const idx = (j * nx + i) * 4;
				let I = 0, T = 0;
				if (fade > 0) {
					for (let b = 0; b < 4; b++) {
						const k = (b * nx + i) * 3;
						const q = y / col[k];
						if (q > 2.6) continue;
						const v = Math.exp(-Math.pow(q, 1.4) * 2.0) * col[k + 1];
						I += v; T += clamp(q * 0.45 + b * 0.12) * v;
					}
				}
				I *= fade;
				if (I < 0.004) { d8[idx + 3] = 0; continue; }
				const t = clamp(T / I + 0.1 * Math.sin(i * 0.05 + ph * 0.3));
				const ti = Math.min(47, (t * 47) | 0) * 3;
				d8[idx] = tab[ti]; d8[idx + 1] = tab[ti + 1]; d8[idx + 2] = tab[ti + 2];
				d8[idx + 3] = ma * (1 - Math.exp(-I * 1.5));
			}
		}
		ctx.putImageData(img, 0, 0);
	}

	function step(dt) {
		const px = S.cx;
		if (ptr.has) { seen = true; tx = ptr.x; }
		const p = reduced ? 1 : 1 - Math.exp(-dt / 0.9); // follow tau 0.9 s
		S.cx += (tx - S.cx) * p;
		const sp = dt > 0 ? Math.abs(S.cx - px) / dt : 0;
		const tgt = reduced ? 0 : Math.min(1, sp / 160);
		S.energy += (tgt - S.energy) * (1 - Math.exp(-dt / (tgt > S.energy ? 0.6 : 2.6)));
		if (S.energy < 0.004) S.energy = 0;
		S.near += (tNear - S.near) * (1 - Math.exp(-dt / 0.9));
		if (!reduced) S.phase += dt * (0.033 + S.energy * 0.4);
		since += dt;
		const moving = Math.abs(tx - S.cx) > 0.5 || S.energy > 0.02 || Math.abs(tNear - S.near) > 0.01;
		if (reduced) { if (moving) dirty = true; }
		else if (since >= (moving ? 1 / 30 : 1 / 12)) dirty = true;
		return moving;
	}
	function frame(now) {
		raf = 0;
		if (!alive || document.hidden) return;
		const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
		last = now;
		const moving = step(dt);
		if (dirty) render();
		if (!reduced || moving) raf = requestAnimationFrame(frame);
	}
	function wake() { if (!raf && alive && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
	const onMove = (e) => {
		const r = root.getBoundingClientRect();
		ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
		ptr.has = ptr.x >= -20 && ptr.y >= -20 && ptr.x <= r.width + 20 && ptr.y <= r.height + 20;
		tNear = ptr.has ? 1 - smooth(S.h * 0.1, S.h * 0.7, ptr.y) : 0;
		wake();
	};
	const onVis = () => { if (!document.hidden) wake(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } };
	const mo = new MutationObserver(() => {
		const dk = isDarkNow();
		if (dk !== S.dark) { S.dark = dk; tab = ramp(dk); dirty = true; wake(); }
	});
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	const ro = new ResizeObserver(resize);
	ro.observe(root);
	let sraf = 0;
	const applyScroll = () => { sraf = 0; canvas.style.transform = `translate3d(0,${-root.scrollTop}px,0)`; };
	const onScroll = () => { if (!sraf) sraf = requestAnimationFrame(applyScroll); };
	root.addEventListener("scroll", onScroll, { passive: true });
	applyScroll();
	addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	resize();
	render();
	wake();
	d.add(() => {
		alive = false;
		cancelAnimationFrame(raf); cancelAnimationFrame(sraf);
		root.removeEventListener("scroll", onScroll);
		removeEventListener("pointermove", onMove);
		document.removeEventListener("visibilitychange", onVis);
		mo.disconnect(); ro.disconnect();
		canvas.remove();
	});
	return { S };
}
