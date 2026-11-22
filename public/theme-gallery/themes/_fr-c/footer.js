/*
 * Aurora-descent footer for the Focus & Ribbon wave: a spruce treeline (plus a peak,
 * fire tower, snag or campfire) over a still lake that mirrors the live aurora.
 * No scrim: the footer text sits over calm water. Runs only while scrolled into view.
 */
import { rng } from "../forest-kit/kit.js";

const PAL = {
	dark: {
		sky: [[0, "#050a1c"], [0.55, "#14224a"], [1, "#3a4f80"]],
		tree: "#040813", tree2: "#0a1230", peak: "#101a3c", peakLit: "#26376a",
		lake: ["#1a2b52", "#0a1330"], refl: 0.62, glow: [255, 170, 90], star: true,
	},
	light: {
		sky: [[0, "#a9c9e6"], [0.55, "#d6e4ee"], [1, "#f6e6cf"]],
		tree: "#1d3f3c", tree2: "#3a6a68", peak: "#7596b0", peakLit: "#b4cadb",
		lake: ["#9cc0d2", "#5f90aa"], refl: 0.55, glow: [255, 150, 70], star: false,
	},
};
const BAND = 380, WY = 190;

export function spruce(c, x, base, hgt, rand) {
	const T = 6 + ((rand() * 3) | 0), wmax = hgt * (0.17 + rand() * 0.05);
	c.beginPath();
	c.moveTo(x, base - hgt);
	for (let k = 1; k <= T; k++) {
		const ry = base - hgt + (hgt * k) / T, hw = (wmax * k) / T * (0.92 + rand() * 0.16);
		c.lineTo(x + hw, ry);
		if (k < T) c.lineTo(x + hw * 0.45, ry - (hgt / T) * 0.38);
	}
	c.lineTo(x + 1.2, base + 2);
	c.lineTo(x - 1.2, base + 2);
	for (let k = T; k >= 1; k--) {
		const ry = base - hgt + (hgt * k) / T, hw = (wmax * k) / T * (0.92 + rand() * 0.16);
		if (k < T) c.lineTo(x - hw * 0.45, ry - (hgt / T) * 0.38);
		c.lineTo(x - hw, ry);
	}
	c.closePath();
	c.fill();
}

export function createFooter(root, { reducedMotion = false, variant = "peak", seed = 5 } = {}) {
	const foot = root.querySelector(".site-footer");
	if (!foot) return { setAurora() {}, setDark() {}, destroy() {} };
	const cleanups = [];
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	canvas.style.cssText = "position:absolute;z-index:-1;pointer-events:none;display:block;";
	foot.style.position = "relative";
	foot.style.isolation = "isolate";
	foot.style.opacity = "1";
	foot.style.paddingTop = "230px";
	foot.style.marginTop = "48px";
	foot.prepend(canvas);
	const ctx = canvas.getContext("2d");
	const scene = document.createElement("canvas");
	const sx = scene.getContext("2d");
	const skyBg = document.createElement("canvas");
	const fg = document.createElement("canvas");
	let W = 0, dark = document.documentElement.classList.contains("dark");
	let aur = null, visible = false, raf = 0, last = 0, t = 0, acc = 0, dead = false;
	let fire = null;
	const sparks = Array.from({ length: 16 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1 }));

	function layout() {
		const rr = root.getBoundingClientRect(), fr = foot.getBoundingClientRect();
		const w = root.clientWidth;
		const footBottom = fr.bottom - rr.top + root.scrollTop;
		const gap = Math.max(0, root.scrollHeight - footBottom);
		canvas.style.left = rr.left - fr.left + "px";
		canvas.style.bottom = -gap + "px";
		canvas.style.width = w + "px";
		canvas.style.height = BAND + "px";
		if (w !== W || !canvas.width) {
			W = w;
			canvas.width = scene.width = skyBg.width = fg.width = W;
			canvas.height = BAND; scene.height = skyBg.height = fg.height = WY;
			buildStatic();
		}
	}

	function buildStatic() {
		const p = PAL[dark ? "dark" : "light"];
		const rand = rng(seed);
		const b = skyBg.getContext("2d");
		const g = b.createLinearGradient(0, 0, 0, WY);
		p.sky.forEach(([s, c]) => g.addColorStop(s, c));
		b.fillStyle = g; b.fillRect(0, 0, W, WY);
		if (p.star) {
			b.fillStyle = "rgba(225,232,255,.7)";
			for (let i = 0; i < 40; i++) b.fillRect(rand() * W, rand() * WY * 0.7, 1, 1);
		}
		const f = fg.getContext("2d");
		f.clearRect(0, 0, W, WY);
		const peakX = W * (variant === "tower" ? 0.7 : 0.72), peakH = variant === "peak" || variant === "tower" ? 96 : 0;
		let summit = null;
		if (peakH) {
			const pts = [], half = Math.min(260, W * 0.3);
			f.beginPath(); f.moveTo(peakX - half, WY);
			for (let x = -half; x <= half; x += 6) {
				const k = 1 - Math.abs(x) / half;
				const yy = WY - peakH * Math.pow(k, 1.15) * (0.9 + 0.1 * Math.sin(x * 0.11)) - (k > 0.9 && variant === "tower" ? -2 : 0);
				f.lineTo(peakX + x, yy); pts.push([peakX + x, yy]);
			}
			f.lineTo(peakX + half, WY); f.closePath();
			const pg = f.createLinearGradient(0, WY - peakH, 0, WY);
			pg.addColorStop(0, p.peakLit); pg.addColorStop(0.7, p.peak); pg.addColorStop(1, p.peak);
			f.fillStyle = pg; f.fill();
			summit = pts.reduce((a, q) => (q[1] < a[1] ? q : a), pts[0]);
		}
		// back row of trees, then the near row
		f.fillStyle = p.tree2;
		for (let x = -8; x < W + 8; x += 7 + rand() * 9) {
			const clump = 0.5 + 0.5 * Math.sin(x * 0.011 + seed);
			spruce(f, x, WY - 4, 20 + clump * 22 + rand() * 12, rand);
		}
		fire = null;
		const gapLo = variant === "campfire" ? W * 0.14 : variant === "snag" ? W * 0.26 : -1;
		const gapHi = variant === "campfire" ? W * 0.3 : variant === "snag" ? W * 0.42 : -1;
		f.fillStyle = p.tree;
		f.beginPath(); f.moveTo(0, WY);
		for (let x = 0; x <= W; x += 8) f.lineTo(x, WY - 5 - 2 * Math.sin(x * 0.04 + seed) - (x > gapLo && x < gapHi && variant === "snag" ? 0 : 0));
		f.lineTo(W, WY); f.closePath(); f.fill();
		for (let x = -10; x < W + 10; x += 9 + rand() * 13) {
			const clump = 0.5 + 0.5 * Math.sin(x * 0.0083 + seed * 2);
			let hgt = 30 + clump * 30 + rand() * 16;
			if (x > gapLo && x < gapHi) {
				if (variant === "campfire") continue;
				hgt = 12 + rand() * 8; // a small island cluster
			}
			spruce(f, x, WY - 3, hgt, rand);
		}
		if (variant === "snag") {
			const sxp = W * 0.82;
			f.strokeStyle = p.tree; f.lineCap = "round";
			f.lineWidth = 4; f.beginPath(); f.moveTo(sxp, WY); f.lineTo(sxp + 2, WY - 100); f.stroke();
			f.lineWidth = 1.6;
			for (const [dy, dx, ex, ey] of [[30, 1, 20, -14], [46, 1, -22, -12], [62, 1, 15, -16], [78, 1, -13, -9], [92, 0, 6, -12]]) {
				f.beginPath(); f.moveTo(sxp + 1, WY - dy); f.lineTo(sxp + 1 + ex, WY - dy + ey); f.stroke();
			}
		}
		if (variant === "tower" && summit) {
			const [tx, ty] = summit;
			f.strokeStyle = p.tree; f.fillStyle = p.tree; f.lineWidth = 1.6;
			const hh = 36, bw = 13, tw = 7;
			f.beginPath();
			f.moveTo(tx - bw, ty + 4); f.lineTo(tx - tw, ty - hh);
			f.moveTo(tx + bw, ty + 4); f.lineTo(tx + tw, ty - hh);
			f.moveTo(tx - bw * 0.35, ty + 4); f.lineTo(tx - tw * 0.4, ty - hh);
			f.moveTo(tx + bw * 0.35, ty + 4); f.lineTo(tx + tw * 0.4, ty - hh);
			for (let k = 1; k < 4; k++) {
				const yy = ty - (hh * k) / 4, ww = bw + (tw - bw) * (k / 4);
				f.moveTo(tx - ww, yy); f.lineTo(tx + ww, yy);
				f.moveTo(tx - ww, yy); f.lineTo(tx + ww * 0.4, yy + hh / 4);
			}
			f.stroke();
			f.fillRect(tx - 8, ty - hh - 8, 16, 8);
			f.beginPath(); f.moveTo(tx - 11, ty - hh - 8); f.lineTo(tx, ty - hh - 16); f.lineTo(tx + 11, ty - hh - 8); f.closePath(); f.fill();
			f.fillStyle = dark ? "#ffd89a" : "rgba(255,210,150,.9)";
			f.fillRect(tx - 4, ty - hh - 6, 8, 3.5);
		}
		if (variant === "campfire") {
			const fx = W * 0.22;
			f.fillStyle = p.tree;
			f.beginPath(); f.moveTo(fx - 40, WY - 3); f.lineTo(fx - 26, WY - 30); f.lineTo(fx - 8, WY - 3); f.closePath(); f.fill();
			fire = { x: fx, y: WY - 6 };
		}
	}

	function drawFrame() {
		if (!W) return;
		const p = PAL[dark ? "dark" : "light"];
		sx.globalCompositeOperation = "source-over"; sx.globalAlpha = 1;
		sx.drawImage(skyBg, 0, 0);
		if (aur) {
			const low = aur.renderFull?.() || aur.low;
			sx.save();
			sx.imageSmoothingEnabled = true;
			sx.globalAlpha = dark ? 0.95 : 0.8;
			sx.globalCompositeOperation = dark ? "lighter" : "source-over";
			sx.drawImage(low, 0, 0, low.width, low.height * 0.86, 0, 0, W, WY);
			sx.restore();
		}
		sx.drawImage(fg, 0, 0);
		ctx.clearRect(0, 0, W, BAND);
		ctx.drawImage(scene, 0, 0);
		// lake
		const lh = BAND - WY;
		const g = ctx.createLinearGradient(0, WY, 0, BAND);
		g.addColorStop(0, p.lake[0]); g.addColorStop(1, p.lake[1]);
		ctx.fillStyle = g; ctx.fillRect(0, WY, W, lh);
		const strip = 3;
		for (let y = 0; y < lh; y += strip) {
			const k = y / lh;
			ctx.globalAlpha = p.refl * (1 - k * 0.85) * (k < 0.03 ? 0.6 : 1);
			const dx = Math.sin(y * 0.33 + t * 1.2) * (0.6 + k * 3.2) + Math.sin(y * 0.11 - t * 0.7) * 1.4;
			ctx.drawImage(scene, 0, Math.max(0, WY - 1 - y * 0.9 - strip), W, strip, dx, WY + y, W, strip);
		}
		ctx.globalAlpha = 1;
		// shoreline hairline
		ctx.fillStyle = dark ? "rgba(150,170,220,.18)" : "rgba(255,255,255,.35)";
		ctx.fillRect(0, WY, W, 1);
		if (fire) drawFire(p);
		// fade the top into the page
		ctx.globalCompositeOperation = "destination-in";
		const m = ctx.createLinearGradient(0, 0, 0, BAND);
		for (const [s, a] of [[0, 0], [0.12, 0.05], [0.25, 0.3], [0.4, 0.72], [0.55, 0.95], [0.65, 1], [1, 1]]) m.addColorStop(s, `rgba(0,0,0,${a})`);
		ctx.fillStyle = m; ctx.fillRect(0, 0, W, BAND);
		ctx.globalCompositeOperation = "source-over";
	}

	function drawFire(p) {
		const { x, y } = fire, [r, g, b] = p.glow;
		const gl = ctx.createRadialGradient(x, y - 6, 2, x, y - 6, 70);
		gl.addColorStop(0, `rgba(${r},${g},${b},${dark ? 0.4 : 0.22})`); gl.addColorStop(1, `rgba(${r},${g},${b},0)`);
		ctx.fillStyle = gl; ctx.fillRect(x - 80, y - 80, 160, 140);
		// reflection streak
		for (let i = 0; i < 9; i++) {
			ctx.fillStyle = `rgba(${r},${g},${b},${(0.3 - i * 0.03) * (dark ? 1 : 0.6)})`;
			const ww = 14 - i * 0.8 + Math.sin(t * 5 + i) * 2;
			ctx.fillRect(x - ww / 2 + Math.sin(t * 2 + i) * 2, WY + 6 + i * 7, ww, 2);
		}
		const fl = 0.85 + 0.15 * Math.sin(t * 17) + 0.1 * Math.sin(t * 29);
		ctx.fillStyle = `rgb(${r},${Math.round(g * 0.75)},${Math.round(b * 0.5)})`;
		ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x - 4, y - 9 * fl, x + Math.sin(t * 9) * 1.5, y - 15 * fl); ctx.quadraticCurveTo(x + 4, y - 8 * fl, x + 5, y); ctx.closePath(); ctx.fill();
		ctx.fillStyle = "rgba(255,230,160,.95)";
		ctx.beginPath(); ctx.moveTo(x - 2.5, y); ctx.quadraticCurveTo(x - 2, y - 5 * fl, x, y - 8 * fl); ctx.quadraticCurveTo(x + 2, y - 4 * fl, x + 2.5, y); ctx.closePath(); ctx.fill();
		ctx.fillStyle = p.tree; ctx.fillRect(x - 8, y - 1, 16, 2.5);
		for (const s of sparks) {
			if (s.life <= 0) continue;
			ctx.fillStyle = `rgba(255,${180 + (s.life / s.max) * 50 | 0},110,${Math.min(1, s.life / s.max * 1.4)})`;
			ctx.fillRect(s.x, s.y, 1.6, 1.6);
		}
	}
	function stepSparks(dt) {
		if (!fire) return;
		for (const s of sparks) {
			if (s.life <= 0) {
				if (Math.random() < dt * 2.2) { s.x = fire.x + (Math.random() - 0.5) * 6; s.y = fire.y - 10; s.vx = (Math.random() - 0.3) * 12; s.vy = -(22 + Math.random() * 28); s.max = s.life = 1.2 + Math.random() * 1.6; }
				continue;
			}
			s.life -= dt; s.x += s.vx * dt + Math.sin(t * 6 + s.max * 9) * 0.25; s.y += s.vy * dt; s.vx += 3 * dt;
		}
	}

	function frame(now) {
		raf = 0;
		if (!visible || dead || document.hidden) return;
		const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
		last = now; acc += dt;
		if (acc >= 1 / 24) {
			t += acc; stepSparks(acc); acc = 0;
			drawFrame();
		}
		raf = requestAnimationFrame(frame);
	}
	function start() {
		if (reducedMotion) { layout(); drawFrame(); return; }
		if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
	}
	const io = new IntersectionObserver((es) => {
		visible = es.some((e) => e.isIntersecting);
		if (visible) { layout(); drawFrame(); start(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
	}, { root: null, rootMargin: "80px" });
	io.observe(foot);
	const onVis = () => { if (!document.hidden) start(); };
	document.addEventListener("visibilitychange", onVis);
	cleanups.push(() => document.removeEventListener("visibilitychange", onVis));
	const ro = new ResizeObserver(() => { if (visible) { layout(); drawFrame(); } });
	ro.observe(root);
	// pre-layout once idle so the first reveal is instant
	const idle = (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(() => { if (!dead) layout(); });

	return {
		setAurora(a) { aur = a; if (visible) drawFrame(); },
		setDark(d) { dark = d; if (W) { buildStatic(); if (visible) drawFrame(); } },
		destroy() {
			dead = true; io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf);
			cleanups.forEach((f) => f());
			(window.cancelIdleCallback || clearTimeout)(idle);
			canvas.remove();
		},
	};
}
