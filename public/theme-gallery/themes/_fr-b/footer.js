/*
 * Footer band for the #324-331 ribbon themes: a spruce treeline over a still lake
 * that mirrors the live aurora. Drawn into one canvas that only runs while the
 * footer is on screen (IntersectionObserver). No scrim: the text sits over open sky.
 */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Rippled mirror of the aurora's low-res canvas into a water rect (flipped, strip by strip).
export function reflectAurora(ctx, aur, { x, y, w, depth, t, alpha = 1, srcTop, srcBot, amp = 3, strip = 2, dark }) {
	const span = srcBot - srcTop;
	const sh = (span / depth) * strip;
	for (let d = 0; d < depth; d += strip) {
		const f = d / depth;
		const sy = lerp(srcBot, srcTop, f) - sh;
		const dx = (Math.sin(d * 0.21 + t * 1.5) * (0.4 + f) + Math.sin(d * 0.07 - t * 0.8) * 0.9) * amp;
		const shimmer = 0.82 + 0.18 * Math.sin(d * 0.9 + t * 2.3);
		// brighter at the shore, thinning with distance
		if (sy < 0) continue;
		aur.draw(ctx, x + dx, y + d, w, strip + 0.7, alpha * shimmer * (1 - f * 0.45), Math.max(0, sy), sh);
	}
}

function spruce(c, x, baseY, h, w, r) {
	const n = 6 + ((r() * 3) | 0);
	c.beginPath();
	c.moveTo(x, baseY - h);
	const pts = [];
	for (let i = 1; i <= n; i++) {
		const t = i / n;
		const y = baseY - h + t * h * 0.97;
		const hw = w * (0.12 + 0.88 * Math.pow(t, 0.9)) * (0.9 + r() * 0.2);
		pts.push([y, hw]);
	}
	for (const [y, hw] of pts) { c.lineTo(x + hw * 0.42, y - h / n * 0.45); c.lineTo(x + hw, y); }
	c.lineTo(x + 1.5, baseY);
	c.lineTo(x - 1.5, baseY);
	for (let i = pts.length - 1; i >= 0; i--) { const [y, hw] = pts[i]; c.lineTo(x - hw, y); c.lineTo(x - hw * 0.42, y - h / n * 0.45); }
	c.closePath();
	c.fill();
}

// A short, sparse spruce stand anchored to the left edge of a w x h canvas: tallest at the
// edge, thinning and shrinking to nothing by x = w (no hard boundary anywhere).
export function spruceStand(c, w, h, { dark, seed = 3, density = 1 }) {
	const r = rng(seed);
	const cols = dark ? ["#0b1532", "#060b1f", "#02050f"] : ["#6f9a92", "#3d6c64", "#1d443d"];
	for (let row = 0; row < 3; row++) {
		c.fillStyle = cols[row];
		const step = (16 - row * 2) / density;
		for (let x = -4 + r() * 6; x < w; x += step * (0.7 + r() * 0.9)) {
			const e = Math.pow(1 - x / w, 1.35);
			if (r() > 0.25 + e * 0.9) continue;
			const hh = h * (0.18 + 0.82 * e) * (0.55 + row * 0.2) * (0.8 + r() * 0.35);
			if (hh < 14) continue;
			spruce(c, x, h + 6 + row * 2, hh, hh * 0.25, r);
		}
	}
}

const PAL = {
	dark: {
		skyTop: [8, 14, 38, 0], skyBot: [22, 36, 78, 0.78], horizon: [70, 96, 150, 0.5],
		trees: ["#0a1430", "#050a1a", "#02050f"], peak: "#0e1938", peakLit: "#2b3d6e",
		lakeTop: [26, 44, 88], lakeBot: [5, 10, 26], glow: [120, 220, 200],
	},
	light: {
		skyTop: [255, 238, 220, 0], skyBot: [250, 214, 200, 0.7], horizon: [255, 236, 214, 0.6],
		trees: ["#5c8a86", "#2f5d58", "#17352f"], peak: "#6f8fae", peakLit: "#e8eef2",
		lakeTop: [188, 214, 224], lakeBot: [88, 132, 160], glow: [255, 190, 170],
	},
};

export function createFooter(root, opt) {
	const foot = root.querySelector(".site-footer");
	if (!foot) return null;
	const kind = opt.kind || "peak";
	const BH = opt.height || 360;
	foot.classList.add("fr-footer");
	foot.style.setProperty("--fr-band", BH + "px");
	const canvas = document.createElement("canvas");
	canvas.className = "fr-footer-canvas";
	canvas.setAttribute("aria-hidden", "true");
	foot.insertBefore(canvas, foot.firstChild);
	const ctx = canvas.getContext("2d");
	let dark = opt.isDark();
	let W = 0, dpr = 1, scene = null, visible = false, raf = 0, last = 0, t = 0, dead = false, sparks = [];
	const reduced = !!opt.reducedMotion;
	const shoreY = Math.round(BH * 0.64);

	function build() {
		W = Math.max(320, Math.round(root.clientWidth));
		dpr = Math.min(1.5, window.devicePixelRatio || 1);
		canvas.style.width = W + "px";
		canvas.style.height = BH + "px";
		canvas.style.left = `calc(50% - ${W / 2}px)`;
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(BH * dpr);
		const p = { ...PAL[dark ? "dark" : "light"], ...(opt.pal?.[dark ? "dark" : "light"] || {}) };
		const lay = document.createElement("canvas");
		lay.width = canvas.width; lay.height = canvas.height;
		const c = lay.getContext("2d");
		c.scale(dpr, dpr);
		const r = rng(opt.seed || 5);
		const peakX = W * (opt.peakAt || 0.8);
		// features
		if (kind === "peak" || kind === "tower") {
			const ph = kind === "peak" ? 150 : 105;
			const pw = kind === "peak" ? 330 : 280;
			c.fillStyle = p.peak;
			c.beginPath();
			c.moveTo(peakX - pw, shoreY);
			let px = peakX - pw;
			const pts = 14;
			for (let i = 0; i <= pts; i++) {
				const u = i / pts;
				const prof = Math.pow(1 - Math.abs(u * 2 - 1), 1.35);
				c.lineTo(peakX - pw + u * pw * 2, shoreY - ph * prof * (0.9 + r() * 0.12));
			}
			c.lineTo(peakX + pw, shoreY);
			c.closePath(); c.fill();
			// lit flank
			c.fillStyle = p.peakLit; c.globalAlpha = dark ? 0.35 : 0.6;
			c.beginPath(); c.moveTo(peakX, shoreY - ph); c.lineTo(peakX + pw * 0.45, shoreY - ph * 0.28); c.lineTo(peakX + pw * 0.12, shoreY - ph * 0.5); c.closePath(); c.fill();
			c.globalAlpha = 1;
		}
		if (kind === "islands") {
			c.fillStyle = p.trees[0];
			for (const [fx, fw, fh] of [[0.62, 110, 26], [0.74, 70, 18], [0.3, 90, 20]]) {
				c.beginPath(); c.ellipse(W * fx, shoreY + 4, fw, fh * 0.5, 0, Math.PI, TAU); c.fill();
				for (let i = 0; i < 4; i++) spruce(c, W * fx + (i - 1.5) * fw * 0.35, shoreY + 4, fh * (1.6 + r()), fh * 0.5, r);
			}
		}
		// treeline: three rows, back to front, taller at the edges, a calm gap under the text
		const rows = [[p.trees[0], 0.9, 20, 46, 12, 0.45], [p.trees[1], 1, 24, 58, 15, 0.1], [p.trees[2], 1, 30, 70, 19, 0.0]];
		let towerX = 0;
		rows.forEach(([col, a, h0, h1, step, off], ri) => {
			c.fillStyle = col; c.globalAlpha = a;
			c.fillRect(0, shoreY - 3, W, 3);
			for (let x = -10; x < W + 10; x += step * (0.7 + r() * 0.7)) {
				const u = x / W;
				const edge = Math.pow(Math.abs(u - 0.5) * 2, 1.6);
				const hh = lerp(h0, h1, r()) * (0.45 + 0.9 * edge) * (kind === "snag" ? 1 : 1);
				spruce(c, x, shoreY - 1 + ri * 2, hh, hh * 0.24, r);
			}
		});
		c.globalAlpha = 1;
		// fire tower on a ridge of dark pines
		if (kind === "tower") {
			const tx = peakX - 40, ty = shoreY - 112;
			towerX = tx;
			c.strokeStyle = p.trees[2]; c.fillStyle = p.trees[2]; c.lineWidth = 2;
			c.beginPath();
			c.moveTo(tx - 9, ty + 36); c.lineTo(tx - 4, ty); c.moveTo(tx + 9, ty + 36); c.lineTo(tx + 4, ty);
			c.moveTo(tx - 7, ty + 24); c.lineTo(tx + 6, ty + 10); c.moveTo(tx + 7, ty + 24); c.lineTo(tx - 6, ty + 10);
			c.stroke();
			c.fillRect(tx - 8, ty - 9, 16, 9);
			c.beginPath(); c.moveTo(tx - 10, ty - 9); c.lineTo(tx, ty - 16); c.lineTo(tx + 10, ty - 9); c.closePath(); c.fill();
			if (dark) { c.fillStyle = "#ffd98a"; c.fillRect(tx - 3, ty - 7, 6, 4); }
			for (let i = 0; i < 6; i++) spruce(c, tx - 40 + i * 16, ty + 40, 28 + r() * 20, 7, r);
		}
		if (kind === "snag") {
			const sx = W * 0.22;
			c.strokeStyle = p.trees[2]; c.lineWidth = 3; c.lineCap = "round";
			c.beginPath(); c.moveTo(sx, shoreY); c.lineTo(sx + 2, shoreY - 118);
			for (const [by, dx, dy] of [[-40, -26, -18], [-62, 22, -22], [-84, -16, -14], [-100, 14, -12]]) { c.moveTo(sx + 1, shoreY + by); c.lineTo(sx + 1 + dx, shoreY + by + dy); }
			c.stroke();
		}
		let campX = 0;
		if (kind === "camp") {
			campX = W * 0.84;
			const cy = shoreY - 2;
			c.fillStyle = p.trees[2];
			c.beginPath(); c.moveTo(campX - 38, cy); c.lineTo(campX - 6, cy - 34); c.lineTo(campX + 26, cy); c.closePath(); c.fill();
			c.strokeStyle = p.trees[2]; c.lineWidth = 3;
			c.beginPath(); c.moveTo(campX + 34, cy); c.lineTo(campX + 44, cy - 3); c.moveTo(campX + 38, cy - 2); c.lineTo(campX + 52, cy - 1); c.stroke();
		}
		scene = { lay, p, campX: campX ? campX + 42 : 0, shoreY };
	}

	function draw() {
		if (!scene) return;
		const p = scene.p;
		const aur = opt.getAurora();
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, BH);
		// sky wash: transparent at the top (the page scenery shows through), warm/cool toward the horizon
		const g = ctx.createLinearGradient(0, 0, 0, shoreY);
		const rgba = (a) => `rgba(${a[0]},${a[1]},${a[2]},${a[3]})`;
		for (let k = 0; k <= 8; k++) { const q = k / 8, e = q * q * (3 - 2 * q); const A = p.skyBot, B = p.skyTop; g.addColorStop(q, `rgba(${lerp(B[0], A[0], e) | 0},${lerp(B[1], A[1], e) | 0},${lerp(B[2], A[2], e) | 0},${(lerp(0, A[3], e) * 0.9 + (q > 0.6 ? lerp(0, p.horizon[3] - A[3], (q - 0.6) / 0.4) * 0.5 : 0)).toFixed(3)})`); }
		ctx.fillStyle = g; ctx.fillRect(0, 0, W, shoreY);
		// lake
		const lg = ctx.createLinearGradient(0, shoreY, 0, BH);
		lg.addColorStop(0, `rgb(${p.lakeTop})`); lg.addColorStop(1, `rgb(${p.lakeBot})`);
		ctx.fillStyle = lg; ctx.fillRect(0, shoreY, W, BH - shoreY);
		const depth = BH - shoreY;
		// aurora mirror
		if (aur) reflectAurora(ctx, aur, { x: 0, y: shoreY, w: W, depth, t, alpha: dark ? opt.mirror ?? 1 : (opt.mirror ?? 1) * 1.15, srcTop: -160, srcBot: aur.height * 0.52, amp: 3, dark });
		// campfire glow in sky + water
		const flick = 0.8 + 0.2 * Math.sin(t * 9) * Math.sin(t * 5.3 + 1);
		if (scene.campX) {
			const fx = scene.campX, fy = shoreY - 4;
			const rg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 80 * flick);
			rg.addColorStop(0, "rgba(255,170,70,.55)"); rg.addColorStop(1, "rgba(255,120,40,0)");
			ctx.fillStyle = rg; ctx.fillRect(fx - 90, fy - 90, 180, 110);
		}
		// treeline + reflection strips
		ctx.drawImage(scene.lay, 0, 0, W, BH);
		const sc = dpr;
		const lay = scene.lay;
		for (let d = 0; d < depth; d += 2) {
			const f = d / depth;
			const dx = (Math.sin(d * 0.21 + t * 1.5) * (0.4 + f) + Math.sin(d * 0.07 - t * 0.8) * 0.9) * 2.6;
			ctx.globalAlpha = (dark ? 0.8 : 0.55) * (1 - f * 0.6);
			// mirror: lake row d shows the scene row (shoreY - d) (limited to the lower sky/trees)
			ctx.drawImage(lay, 0, (shoreY - d - 2) * sc, lay.width, 2 * sc, dx, shoreY + d, W, 2.6);
		}
		ctx.globalAlpha = 1;
		if (scene.campX) {
			const fx = scene.campX, fy = shoreY - 4;
			ctx.fillStyle = "rgba(255,190,100,.9)";
			ctx.beginPath(); ctx.ellipse(fx, fy - 1, 4 * flick, 7 * flick, 0, 0, TAU); ctx.fill();
			ctx.fillStyle = "rgba(255,240,200,.95)";
			ctx.beginPath(); ctx.ellipse(fx, fy, 1.8, 3.5 * flick, 0, 0, TAU); ctx.fill();
			// reflection column
			for (let d = 0; d < depth * 0.8; d += 3) {
				ctx.fillStyle = `rgba(255,170,80,${0.4 * (1 - d / (depth * 0.8)) * (0.6 + 0.4 * Math.sin(d * 0.8 + t * 6))})`;
				ctx.fillRect(fx - 5 + Math.sin(d * 0.3 + t * 2) * 2, shoreY + d, 10 - d * 0.05, 2);
			}
			if (!reduced) {
				if (Math.random() < 0.25) sparks.push({ x: fx, y: fy - 6, vx: (Math.random() - 0.5) * 14, vy: -22 - Math.random() * 22, a: 1 });
				ctx.fillStyle = "#ffc878";
				sparks = sparks.filter((s) => s.a > 0);
				for (const s of sparks) { s.x += s.vx * 0.04; s.y += s.vy * 0.04; s.vy += 0.3; s.a -= 0.025; ctx.globalAlpha = Math.max(0, s.a); ctx.fillRect(s.x, s.y, 1.5, 1.5); }
				ctx.globalAlpha = 1;
			}
		}
		// shoreline highlight
		ctx.fillStyle = dark ? "rgba(150,190,230,.16)" : "rgba(255,255,255,.35)";
		ctx.fillRect(0, shoreY, W, 1);
	}

	function loop(now) {
		raf = 0;
		if (!visible || dead || document.hidden) return;
		if (now - last >= 1000 / 24) { t += Math.min(0.1, (now - last) / 1000); last = now; draw(); }
		raf = requestAnimationFrame(loop);
	}
	function start() {
		if (dead || !visible) return;
		if (!scene) build();
		if (reduced) { requestAnimationFrame(() => requestAnimationFrame(draw)); return; }
		if (!raf) raf = requestAnimationFrame(loop);
	}
	const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); opt.onVisible?.(visible); if (visible) start(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }, { root });
	io.observe(foot);
	let rt = 0;
	const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { scene = null; if (visible) start(); }, 150); };
	window.addEventListener("resize", onResize);
	const onVis = () => { if (!document.hidden && visible) start(); };
	document.addEventListener("visibilitychange", onVis);
	return {
		setDark(d) { dark = d; scene = null; if (visible) start(); },
		destroy() {
			dead = true; io.disconnect(); cancelAnimationFrame(raf); clearTimeout(rt);
			window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVis);
			canvas.remove();
		},
	};
}
