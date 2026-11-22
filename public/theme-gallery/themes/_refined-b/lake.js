/*
 * Loon-lake style footer: a faint night sky with an aurora band over a tree line, mirrored in a lake
 * that runs a 2D wave equation. Clicks (and the cursor sweeping across the water) ripple the reflection.
 * Runs only while the footer is on screen, sleeps once the water is still.
 */
import { aurora, clamp, lerp, isDark } from "./sim.js";

const SC = 3; // css px per grid cell
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

export function createLake({ root, reducedMotion }) {
	const footer = root.querySelector(".site-footer");
	if (!footer) return () => {};
	const prevPos = footer.style.position;
	footer.style.position = "relative";
	footer.style.paddingTop = "3.2rem";
	const wrap = document.createElement("div");
	Object.assign(wrap.style, { position: "absolute", left: "50%", bottom: "-3rem", height: "230px", pointerEvents: "none", zIndex: "-1", contain: "paint" });
	footer.style.isolation = "isolate";
	footer.prepend(wrap);
	const canvas = document.createElement("canvas");
	Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
	wrap.appendChild(canvas);
	const hint = document.createElement("span");
	hint.textContent = "click the water";
	Object.assign(hint.style, { position: "absolute", bottom: "0.55rem", left: "0", right: "0", textAlign: "center", fontSize: "0.72rem", letterSpacing: "0.08em", color: "var(--siteMuted)", opacity: "0.75", fontWeight: "400" });
	wrap.appendChild(hint);
	const ctx = canvas.getContext("2d");
	const off = document.createElement("canvas");
	const octx = off.getContext("2d");

	let gw = 1, gh = 1, hz = 1, lh = 1, W = 1, H = 1, left = 0;
	let sky = null, hA = null, vA = null, img = null, dark = isDark();
	let raf = 0, alive = true, visible = false, calm = 0, last = 0, acc = 0, dirty = true;
	const ptr = { x: 0, y: 0, vx: 0, vy: 0, t: 0, has: false };

	function buildSky() {
		sky = new Float32Array(gw * hz * 4);
		const bands = [0.18, 0.43, 0.7].map((u, i) => ({ x: u * gw, w: gw * (0.13 + 0.03 * i), a: 0.8 - i * 0.12, ph: i * 2.1 }));
		for (let y = 0; y < hz; y++) {
			const v = y / hz;
			for (let x = 0; x < gw; x++) {
				const i = (y * gw + x) * 4;
				let I = 0;
				for (const b of bands) {
					const dx = (x - b.x) / b.w;
					const fold = 0.7 + 0.3 * Math.sin(x * 0.11 + b.ph);
					I += b.a * Math.exp(-dx * dx) * fold * (0.75 + 0.25 * Math.sin(x * 0.23 + b.ph * 3)) * smooth(0.02, 0.5, v) * (0.5 + 0.5 * v);
				}
				const c = aurora(0.1 + 0.7 * clamp(v * 1.1 + 0.2 * Math.sin(x * 0.03)), dark);
				// tree line on each flank
				const ex = Math.min(x, gw - 1 - x) / gw;
				const tree = ex < 0.16 ? (0.16 - ex) / 0.16 : 0;
				const tri = 1 - Math.abs(((x * 0.2) % 1) * 2 - 1);
				const th = tree * hz * (0.3 + 0.1 * Math.sin(x * 0.12)) * (0.8 + 0.2 * tri);
				const inTree = y > hz - th;
				const star = !inTree && ((x * 73 + y * 151) % 541 === 0) ? 0.35 : 0;
				const topFade = smooth(0, 0.35, v);
				let a = (I * (dark ? 0.5 : 0.5) + star * (dark ? 0.5 : 0) * topFade) * topFade;
				if (inTree) { a = dark ? 0.5 : 0.28; sky[i] = dark ? 6 : 70; sky[i + 1] = dark ? 18 : 110; sky[i + 2] = dark ? 28 : 120; sky[i + 3] = a; continue; }
				sky[i] = star ? 230 : c[0]; sky[i + 1] = star ? 240 : c[1]; sky[i + 2] = star ? 255 : c[2]; sky[i + 3] = a;
			}
		}
	}

	function resize() {
		const rr = root.getBoundingClientRect();
		W = Math.round(rr.width); H = 230;
		wrap.style.width = W + "px"; wrap.style.marginLeft = -W / 2 + "px";
		gw = Math.max(8, Math.ceil(W / SC)); gh = Math.ceil(H / SC);
		hz = Math.round(gh * 0.36); lh = gh - hz;
		canvas.width = gw; canvas.height = gh; // upscaled by css, which is the softening
		img = ctx.createImageData(gw, gh);
		hA = new Float32Array(gw * lh); vA = new Float32Array(gw * lh);
		buildSky(); dirty = true; wake();
	}

	const damp = (x, y) => 0.9965 - 0.05 * Math.max(smooth(0.9, 1, y / lh), smooth(0.93, 1, Math.max(x / gw, 1 - x / gw)));
	function stepWave() {
		let mx = 0;
		const c2 = 0.32;
		for (let y = 1; y < lh - 1; y++) {
			for (let x = 1; x < gw - 1; x++) {
				const i = y * gw + x;
				const lap = hA[i - 1] + hA[i + 1] + hA[i - gw] + hA[i + gw] - 4 * hA[i];
				let v = (vA[i] + c2 * lap) * damp(x, y);
				vA[i] = v;
				const a = Math.abs(v) + Math.abs(hA[i]);
				if (a > mx) mx = a;
			}
		}
		for (let i = gw; i < gw * (lh - 1); i++) hA[i] += vA[i];
		return mx;
	}
	function drop(x, y, amp, r = 2.6) {
		const ix = Math.round(x / SC), iy = Math.round(y / SC) - hz;
		if (iy < 1 || iy >= lh - 1) return;
		const R = Math.ceil(r * 2.5);
		for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
			const xx = ix + dx, yy = iy + dy;
			if (xx < 1 || xx >= gw - 1 || yy < 1 || yy >= lh - 1) continue;
			vA[yy * gw + xx] += amp * Math.exp(-(dx * dx + dy * dy) / (2 * r * r));
		}
	}

	function render() {
		const d = img.data;
		for (let y = 0; y < hz; y++) for (let x = 0; x < gw; x++) {
			const i = (y * gw + x) * 4;
			d[i] = sky[i]; d[i + 1] = sky[i + 1]; d[i + 2] = sky[i + 2]; d[i + 3] = sky[i + 3] * 255;
		}
		// lake: reflect the sky mirrored about the horizon, displaced by the water surface
		const edge = 0.05;
		for (let y = 0; y < lh; y++) {
			const depth = y / lh;
			const sy0 = hz - 1 - y * 0.85;
			for (let x = 0; x < gw; x++) {
				const hi = y * gw + x;
				const hx = x > 0 && x < gw - 1 ? hA[hi + 1] - hA[hi - 1] : 0;
				const hy = y > 0 && y < lh - 1 ? hA[hi + gw] - hA[hi - gw] : 0;
				let sx = Math.round(x + hx * 22), sy = Math.round(sy0 + hy * 14);
				const o = ((hz + y) * gw + x) * 4;
				let r = 0, g = 0, b = 0, a = 0;
				if (sy >= 0 && sy < hz) {
					sx = clamp(sx, 0, gw - 1);
					const si = (sy * gw + sx) * 4;
					r = sky[si]; g = sky[si + 1]; b = sky[si + 2]; a = sky[si + 3] * (0.8 - 0.6 * depth);
				}
				// the water itself: a faint tint plus slope glints
				const sl = Math.min(1, Math.abs(hx) * 2 + Math.abs(hy) * 2);
				const wa = (dark ? 0.1 : 0.12) * (1 - 0.6 * depth);
				const wc = dark ? [20, 60, 90] : [150, 200, 220];
				const ga = Math.min(0.28, sl) * (dark ? 0.7 : 0.6);
				const ta = a + wa * (1 - a);
				const k = ta > 0 ? 1 / ta : 0;
				r = (r * a + wc[0] * wa * (1 - a)) * k; g = (g * a + wc[1] * wa * (1 - a)) * k; b = (b * a + wc[2] * wa * (1 - a)) * k;
				const A = ta + ga * (1 - ta);
				const kk = A > 0 ? 1 / A : 0;
				const gc = dark ? [200, 255, 240] : [255, 255, 255];
				d[o] = (r * ta + gc[0] * ga * (1 - ta)) * kk; d[o + 1] = (g * ta + gc[1] * ga * (1 - ta)) * kk; d[o + 2] = (b * ta + gc[2] * ga * (1 - ta)) * kk;
				const fade = 1 - smooth(0.7, 1, depth) * 0.0;
				d[o + 3] = A * 255 * fade * (1 - smooth(0.82, 1, depth) * 0.9) * (1 - smooth(0.9, 1, Math.max(x / gw, 1 - x / gw)) * 0.0);
			}
		}
		ctx.putImageData(img, 0, 0);
		// reflection of the hint-free sky is enough; nothing else to draw
	}

	function frame(now) {
		raf = 0;
		if (!alive || !visible || document.hidden) return;
		const dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now; acc += dt;
		let mx = 0, n = 0;
		while (acc >= 1 / 60 && n < 3) { mx = Math.max(mx, stepWave(), stepWave()); acc -= 1 / 60; n++; }
		if (n === 3) acc = 0;
		if (n) calm = mx < 0.0015 ? calm + dt : 0;
		if (n || dirty) { render(); dirty = false; }
		if (calm < 0.5 || ptr.has) raf = requestAnimationFrame(frame);
	}
	function wake() { if (!raf && alive && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }

	const toLocal = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, r }; };
	const onClick = (e) => {
		const p = toLocal(e);
		if (p.x < 0 || p.y < hz * SC - 6 || p.x > p.r.width || p.y > p.r.height) return;
		drop(p.x, Math.max(p.y, hz * SC + 8), 0.3, 2.6);
		calm = 0; wake();
	};
	const onMove = (e) => {
		if (!visible) return;
		const p = toLocal(e), now = performance.now();
		const inLake = p.x >= 0 && p.x <= p.r.width && p.y > hz * SC && p.y < p.r.height;
		if (inLake && ptr.has) {
			const dt = Math.max(8, now - ptr.t) / 1000, vx = (p.x - ptr.x) / dt, vy = (p.y - ptr.y) / dt;
			const sp = Math.hypot(vx, vy);
			if (sp > 120) { drop(p.x, p.y, Math.min(0.12, sp / 12000), 1.8); calm = 0; wake(); }
		}
		ptr.has = inLake; ptr.x = p.x; ptr.y = p.y; ptr.t = now;
	};
	const io = new IntersectionObserver((es) => {
		visible = es[es.length - 1].isIntersecting;
		if (visible) { dirty = true; wake(); } else { cancelAnimationFrame(raf); raf = 0; }
	});
	io.observe(footer);
	const mo = new MutationObserver(() => { const d = isDark(); if (d !== dark) { dark = d; buildSky(); dirty = true; wake(); } });
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	const ro = new ResizeObserver(resize); ro.observe(root);
	const onVis = () => { if (!document.hidden) wake(); };
	document.addEventListener("visibilitychange", onVis);
	addEventListener("click", onClick, { passive: true });
	addEventListener("pointermove", onMove, { passive: true });
	resize();
	if (reducedMotion) { render(); }

	return () => {
		alive = false; cancelAnimationFrame(raf);
		io.disconnect(); mo.disconnect(); ro.disconnect();
		document.removeEventListener("visibilitychange", onVis);
		removeEventListener("click", onClick); removeEventListener("pointermove", onMove);
		wrap.remove(); footer.style.position = prevPos; footer.style.paddingTop = ""; footer.style.isolation = "";
	};
}
