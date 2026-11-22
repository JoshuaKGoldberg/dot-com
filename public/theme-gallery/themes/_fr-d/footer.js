/*
 * Footer band for the #330-338 themes: spruce treeline, an optional peak / fire tower /
 * campfire / snag / islands, and a still lake that mirrors the theme's live aurora.
 * Scenery is painted once into cached canvases; the lake mirrors them with rippled strips.
 * The loop only runs while the band is on screen (IntersectionObserver), at ~24fps.
 */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const PAL = {
	dark: {
		sky: "#050b1a", horizon: "#123a46", back: "#0c1c2e", mid: "#07111f", front: "#030710", peak: "#0d1d30", peakLit: "#3a5a78",
		lake: ["#0a1a2c", "#040a16"], snag: "#030710", glow: [90, 255, 190],
	},
	light: {
		sky: "#e6eef6", horizon: "#f6e2d6", back: "#8fb0b6", mid: "#587f86", front: "#2c4c52", peak: "#8aa6bb", peakLit: "#f4f7fb",
		lake: ["#c9dde6", "#8fb0c4"], snag: "#2c4c52", glow: [120, 200, 190],
	},
};
const SNOW = {
	dark: { back: "#16283f", mid: "#0f1d33", front: "#080f1e", horizon: "#1f4a5a", lake: ["#223a58", "#0c1a30"], peak: "#1a2d47", peakLit: "#a8c0dc" },
	light: { back: "#a6bccc", mid: "#7893a6", front: "#3d5a6a", horizon: "#f4e6e4", lake: ["#dbe8f0", "#b4cad8"], peak: "#b3c4d6", peakLit: "#ffffff" },
};

function spruce(c, x, base, h, w, snow) {
	const n = 6;
	c.beginPath();
	c.moveTo(x, base - h);
	for (let i = 1; i <= n; i++) {
		const y = base - h + (i / n) * h * 0.97;
		const hw = (w / 2) * (i / n);
		c.lineTo(x + hw * 0.5, y - (h / n) * 0.42);
		c.lineTo(x + hw, y);
	}
	c.lineTo(x + 1, base);
	c.lineTo(x - 1, base);
	for (let i = n; i >= 1; i--) {
		const y = base - h + (i / n) * h * 0.97;
		const hw = (w / 2) * (i / n);
		c.lineTo(x - hw, y);
		c.lineTo(x - hw * 0.5, y - (h / n) * 0.42);
	}
	c.closePath();
	c.fill();
	if (snow) {
		c.save();
		c.fillStyle = snow;
		for (let i = 2; i <= n; i += 1) {
			const y = base - h + (i / n) * h * 0.97;
			const hw = (w / 2) * (i / n);
			c.beginPath();
			c.moveTo(x - hw * 0.85, y - 0.5);
			c.quadraticCurveTo(x, y - (h / n) * 0.62, x + hw * 0.85, y - 0.5);
			c.lineTo(x + hw * 0.6, y - (h / n) * 0.2);
			c.lineTo(x - hw * 0.6, y - (h / n) * 0.2);
			c.closePath();
			c.globalAlpha = 0.55;
			c.fill();
		}
		c.restore();
	}
}

function ridge(c, W, y0, amp, seed, color, step = 6) {
	const r = rng(seed);
	const ph = [r() * 6, r() * 6, r() * 6];
	c.fillStyle = color;
	c.beginPath();
	c.moveTo(0, 9999);
	for (let x = 0; x <= W + step; x += step) c.lineTo(x, y0 - amp * (0.5 + 0.3 * Math.sin(x * 0.004 + ph[0]) + 0.2 * Math.sin(x * 0.011 + ph[1]) + 0.1 * Math.sin(x * 0.03 + ph[2])));
	c.lineTo(W + step, 9999);
	c.closePath();
	c.fill();
}

export { spruce, rng };
export function createFooter(root, opt) {
	const o = { band: 440, peak: false, tower: false, campfire: false, snag: false, islands: false, snow: false, ice: false, aurora: () => null, viewH: () => window.innerHeight, reduced: false, glowAlpha: 0.5, mirrorAlpha: 0.7, seed: 7, fireflies: false, src: [0, 0.6], ...opt };
	const page = root.querySelector(".site-page");
	if (!page) return () => {};
	const host = document.createElement("div");
	host.className = "fr-foot";
	host.setAttribute("aria-hidden", "true");
	host.style.setProperty("--fr-band", o.band + "px");
	const cv = document.createElement("canvas");
	host.append(cv);
	root.append(host);
	const ctx = cv.getContext("2d");
	let W = 0, H = 0, dpr = 1, dark = document.documentElement.classList.contains("dark");
	let C = null, visible = false, raf = 0, timer = 0, last = 0, t = 0, dead = false;
	const sparks = [];
	const flies = [];

	const pal = () => {
		const base = PAL[dark ? "dark" : "light"];
		return o.snow ? { ...base, ...SNOW[dark ? "dark" : "light"] } : base;
	};
	const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr)); const x = c.getContext("2d"); x.scale(dpr, dpr); return { c, x }; };

	function build() {
		const r0 = host.getBoundingClientRect();
		W = Math.max(320, Math.round(r0.width || root.clientWidth)); H = o.band;
		dpr = Math.min(1.5, window.devicePixelRatio || 1);
		cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
		dark = document.documentElement.classList.contains("dark");
		const p = { ...pal() };
		{ const m = getComputedStyle(root).getPropertyValue("--siteBg").trim(); if (/^#[0-9a-f]{6}$/i.test(m)) p.sky = m; }
		const shore = Math.round(H * 0.7);
		const r = rng(o.seed);
		// scenery layer (transparent sky, treeline + peak + shore), cached
		const S = mk(W, shore + 2);
		const x = S.x;
		const snowCol = o.snow ? (dark ? "#9db6d4" : "#ffffff") : null;
		// peak
		if (o.peak) {
			const px = W * 0.82, pw = W * 0.34, ph = shore * 0.62;
			x.fillStyle = p.peak;
			x.beginPath();
			x.moveTo(px - pw, shore);
			const pts = [[-0.9, 0.25], [-0.55, 0.5], [-0.3, 0.46], [-0.12, 0.82], [0, 1], [0.1, 0.9], [0.28, 0.58], [0.45, 0.62], [0.7, 0.3], [1, 0.12]];
			for (const [a, b] of pts) x.lineTo(px + a * pw, shore - b * ph);
			x.lineTo(px + pw * 1.2, shore);
			x.closePath(); x.fill();
			// lit flank / snow cap
			x.fillStyle = p.peakLit; x.globalAlpha = o.snow ? 0.8 : dark ? 0.35 : 0.7;
			x.beginPath();
			x.moveTo(px - pw * 0.12, shore - ph * 0.82); x.lineTo(px, shore - ph); x.lineTo(px + pw * 0.1, shore - ph * 0.9);
			x.lineTo(px + pw * 0.04, shore - ph * 0.8); x.lineTo(px - pw * 0.02, shore - ph * 0.86); x.lineTo(px - pw * 0.07, shore - ph * 0.76);
			x.closePath(); x.fill();
			x.globalAlpha = 1;
		}
		ridge(x, W, shore - 46, 56, o.seed + 1, p.back);
		// back spruces
		x.fillStyle = p.back;
		for (let X = -10; X < W + 10; X += 6 + r() * 9) { const h = 30 + r() * 38 + (Math.sin(X * 0.006) + 1) * 14; spruce(x, X, shore - 20 + r() * 6, h, h * 0.42, null); }
		ridge(x, W, shore - 10, 24, o.seed + 2, p.mid);
		x.fillStyle = p.mid;
		for (let X = -10; X < W + 10; X += 8 + r() * 12) { const h = 44 + r() * 46 + (Math.cos(X * 0.005) + 1) * 14; spruce(x, X, shore - 4 + r() * 4, h, h * 0.44, snowCol); }
		// islands
		if (o.islands) {
			for (const [ix, iw, ih] of [[0.36, 110, 26], [0.62, 70, 18]]) {
				x.fillStyle = p.front;
				x.beginPath(); x.ellipse(W * ix, shore, iw, 5, 0, Math.PI, TAU); x.fill();
				for (let k = -2; k <= 2; k++) spruce(x, W * ix + k * iw * 0.3, shore - 2, ih + (2 - Math.abs(k)) * 10, 14 + (2 - Math.abs(k)) * 2, snowCol);
			}
		}
		// front treeline: dense on both sides, open in the middle so text area stays calm
		x.fillStyle = p.front;
		for (let X = -20; X < W + 20; X += 9 + r() * 12) {
			const u = X / W;
			const edge = Math.pow(Math.abs(u - 0.5) * 2, 1.6);
			const h = 32 + edge * (110 + r() * 60) + r() * 24;
			if (o.peak && u > 0.7 && h > 140) continue;
			spruce(x, X, shore + 1 - r() * 3, h, h * 0.42, snowCol);
		}
		// shoreline ground
		x.fillStyle = p.front;
		x.fillRect(0, shore - 2, W, 4);
		if (o.snow) { x.fillStyle = snowCol; x.globalAlpha = 0.6; x.fillRect(0, shore - 2, W, 1.5); x.globalAlpha = 1; }
		// dead snag
		if (o.snag) {
			const sx = W * 0.2; x.strokeStyle = p.snag; x.lineWidth = 3; x.lineCap = "round";
			x.beginPath(); x.moveTo(sx, shore); x.lineTo(sx + 2, shore - 150); x.stroke();
			x.lineWidth = 1.6;
			for (const [yy, dx, dy] of [[0.4, 22, -14], [0.55, -20, -10], [0.7, 18, -8], [0.85, -14, -12], [0.25, -12, -16]]) { x.beginPath(); x.moveTo(sx + 1, shore - 150 * yy); x.lineTo(sx + dx, shore - 150 * yy + dy); x.stroke(); }
		}
		// fire tower on the peak's shoulder
		if (o.tower) {
			const tx = W * 0.86, ty = shore - shore * 0.35; x.strokeStyle = p.snag; x.fillStyle = p.snag; x.lineWidth = 2;
			x.beginPath(); x.moveTo(tx - 12, ty); x.lineTo(tx - 5, ty - 60); x.moveTo(tx + 12, ty); x.lineTo(tx + 5, ty - 60);
			x.moveTo(tx - 10, ty - 14); x.lineTo(tx + 8, ty - 40); x.moveTo(tx + 10, ty - 14); x.lineTo(tx - 8, ty - 40); x.stroke();
			x.fillRect(tx - 9, ty - 70, 18, 10); x.beginPath(); x.moveTo(tx - 12, ty - 70); x.lineTo(tx, ty - 80); x.lineTo(tx + 12, ty - 70); x.closePath(); x.fill();
			x.fillStyle = dark ? "rgba(255,208,120,.95)" : "rgba(255,200,110,.9)"; x.fillRect(tx - 5, ty - 68, 10, 5);
		}
		// campfire + lean-to
		if (o.campfire) {
			const fx = W * 0.27;
			x.fillStyle = p.snag;
			x.beginPath(); x.moveTo(fx - 62, shore); x.lineTo(fx - 40, shore - 44); x.lineTo(fx - 4, shore - 44); x.lineTo(fx - 4, shore); x.closePath(); x.fill();
			x.beginPath(); x.moveTo(fx - 8, shore - 2); x.lineTo(fx + 20, shore - 2); x.lineTo(fx + 14, shore - 6); x.lineTo(fx - 4, shore - 6); x.closePath(); x.fill();
		}
		// sky layer: fade in so footer text sits on a calm, opaque sky
		const K = mk(W, shore);
		const g = K.x.createLinearGradient(0, 0, 0, shore);
		const sk = p.sky;
		for (const [t, a] of [[0, 0], [0.1, 0.03], [0.22, 0.14], [0.36, 0.42], [0.5, 0.75], [0.62, 0.94], [0.72, 1]]) g.addColorStop(t, hexA(sk, a));
		g.addColorStop(0.85, hexA(sk, 1)); g.addColorStop(1, p.horizon);
		K.x.fillStyle = g; K.x.fillRect(0, 0, W, shore);
		// stars (dark) / none
		if (dark) { K.x.fillStyle = "#dbe7ff"; const rs = rng(o.seed + 9); for (let i = 0; i < 60; i++) { K.x.globalAlpha = 0.25 + rs() * 0.5; K.x.fillRect(rs() * W, 20 + rs() * (shore * 0.45), 1, 1); } K.x.globalAlpha = 1; }
		// lake reflection of the scenery (flipped, dimmed), cached at lake size
		const lakeH = H - shore;
		const M = mk(W, lakeH);
		M.x.save(); M.x.translate(0, 0); M.x.scale(1, -1);
		M.x.drawImage(K.c, 0, -shore, W, shore);
		M.x.drawImage(S.c, 0, -shore - 2, W, shore + 2);
		M.x.restore();
		C = { S, K, M, shore, lakeH, p };
		if (o.fireflies) {
			flies.length = 0;
			for (let i = 0; i < 16; i++) flies.push({ x: r() * W, y: shore * (0.4 + r() * 0.6), ph: r() * 6.28, sp: 0.3 + r() * 0.5, a: r() * 6.28 });
		}
		drawFrame(0);
	}
	function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

	const buf = document.createElement("canvas");
	function drawFrame(dt) {
		if (!C) return;
		const { S, K, M, shore, lakeH, p } = C;
		const aur = o.aurora();
		const st = aur?.state?.() || { energy: 0, crisp: 0 };
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		const vh = o.viewH();
		// sky
		ctx.drawImage(K.c, 0, 0, W, shore);
		// aurora hanging behind the trees (below the text)
		if (aur) {
			ctx.save();
			const al = o.glowAlpha * (dark ? 1 : 0.5);
			ctx.beginPath(); ctx.rect(0, shore * 0.36, W, shore * 0.64); ctx.clip();
			const gm = ctx.createLinearGradient(0, shore * 0.36, 0, shore * 0.62);
			// draw aurora to a half-res buffer so we can mask it by a vertical gradient
			const bw = Math.round(W / 2), bh = Math.round(shore * 0.64 / 2);
			if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }
			const bx = buf.getContext("2d");
			bx.setTransform(1, 0, 0, 1, 0, 0);
			bx.globalCompositeOperation = "source-over"; bx.clearRect(0, 0, bw, bh);
			aur.draw(bx, 0, 0, bw, bh, 1, vh * o.src[0], vh * (o.src[1] - o.src[0]));
			bx.globalCompositeOperation = "destination-in";
			const mg = bx.createLinearGradient(0, 0, 0, bh);
			mg.addColorStop(0, "rgba(0,0,0,0)"); mg.addColorStop(0.45, "rgba(0,0,0,1)"); mg.addColorStop(1, "rgba(0,0,0,.9)");
			bx.fillStyle = mg; bx.fillRect(0, 0, bw, bh);
			ctx.globalAlpha = al;
			ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
			ctx.drawImage(buf, 0, shore * 0.36, W, shore * 0.64);
			ctx.restore();
			void gm;
		}
		// campfire glow in sky layer
		ctx.drawImage(S.c, 0, 0, W, shore + 2);
		// lake
		const lg = ctx.createLinearGradient(0, shore, 0, H);
		lg.addColorStop(0, p.lake[0]); lg.addColorStop(1, p.lake[1]);
		ctx.fillStyle = lg; ctx.fillRect(0, shore, W, lakeH);
		// mirrored scenery + aurora, drawn in rippled strips
		const R = (C.R ||= document.createElement("canvas"));
		if (R.width !== Math.round(W * dpr) || R.height !== Math.round(lakeH * dpr)) { R.width = Math.round(W * dpr); R.height = Math.round(lakeH * dpr); }
		const rx = R.getContext("2d");
		rx.setTransform(dpr, 0, 0, dpr, 0, 0);
		rx.globalCompositeOperation = "source-over";
		rx.clearRect(0, 0, W, lakeH);
		rx.globalAlpha = dark ? 0.55 : 0.5;
		rx.drawImage(M.c, 0, 0, W, lakeH);
		rx.globalAlpha = 1;
		if (aur) {
			rx.globalCompositeOperation = dark ? "lighter" : "source-over";
			aur.draw(rx, 0, 0, W, lakeH, o.mirrorAlpha * (dark ? 1 : 0.6), vh * o.src[0], vh * (o.src[1] - o.src[0]));
			rx.globalCompositeOperation = "source-over";
		}
		const amp = o.ice ? 0.5 : 2.2, strip = 3;
		const ph = o.reduced ? 0 : t;
		for (let y = 0; y < lakeH; y += strip) {
			const dx = Math.sin(y * 0.55 + ph * 1.6) * amp * (0.4 + y / lakeH) + Math.sin(y * 0.21 - ph * 0.8) * amp * 0.6;
			ctx.globalAlpha = 0.95 * (1 - (y / lakeH) * 0.35);
			ctx.drawImage(R, 0, y * dpr, R.width, strip * dpr, dx, shore + y, W, strip);
		}
		ctx.globalAlpha = 1;
		// shimmer lines
		ctx.fillStyle = dark ? "rgba(210,230,255,.18)" : "rgba(255,255,255,.5)";
		for (let i = 0; i < 14; i++) { const f = (i * 0.618) % 1; const a = Math.max(0, Math.sin(ph * (0.7 + (i % 4) * 0.3) + i * 2.3)); ctx.globalAlpha = a * 0.7; ctx.fillRect(((i * 211.7) % W), shore + 6 + f * (lakeH - 12), 14 + f * 40, 1); }
		ctx.globalAlpha = 1;
		if (o.ice) {
			ctx.strokeStyle = dark ? "rgba(190,215,245,.16)" : "rgba(255,255,255,.7)"; ctx.lineWidth = 1;
			const rc = rng(o.seed + 40);
			ctx.beginPath();
			for (let i = 0; i < 7; i++) { let cx = rc() * W, cy = shore + 8 + rc() * (lakeH - 16); ctx.moveTo(cx, cy); for (let k = 0; k < 4; k++) { cx += (rc() - 0.4) * 70; cy += (rc() - 0.5) * 12; ctx.lineTo(cx, cy); } }
			ctx.stroke();
		}
		// campfire
		if (o.campfire) {
			const fx = W * 0.27, fy = shore - 3;
			const fl = o.reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3);
			const gl = ctx.createRadialGradient(fx, fy, 0, fx, fy, 70 * fl);
			gl.addColorStop(0, "rgba(255,190,90,.55)"); gl.addColorStop(1, "rgba(255,150,60,0)");
			ctx.fillStyle = gl; ctx.fillRect(fx - 80, fy - 80, 160, 100);
			ctx.fillStyle = "rgba(255,170,70,.95)"; ctx.beginPath(); ctx.moveTo(fx - 5, fy); ctx.quadraticCurveTo(fx - 3, fy - 12 * fl, fx, fy - 20 * fl); ctx.quadraticCurveTo(fx + 3, fy - 10 * fl, fx + 5, fy); ctx.fill();
			ctx.fillStyle = "rgba(255,235,170,.95)"; ctx.beginPath(); ctx.moveTo(fx - 2, fy); ctx.quadraticCurveTo(fx, fy - 11 * fl, fx + 2, fy); ctx.fill();
			// reflection of the glow
			const rg = ctx.createRadialGradient(fx, shore + 6, 0, fx, shore + 6, 60);
			rg.addColorStop(0, "rgba(255,170,80,.3)"); rg.addColorStop(1, "rgba(255,150,60,0)");
			ctx.fillStyle = rg; ctx.fillRect(fx - 60, shore, 120, 70);
			if (!o.reduced) {
				if (sparks.length < 14 && Math.random() < dt * 9) sparks.push({ x: fx + (Math.random() - 0.5) * 6, y: fy - 14, vx: (Math.random() - 0.5) * 12, vy: -(20 + Math.random() * 26), l: 0 });
				for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.l += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx += (Math.random() - 0.5) * 30 * dt; if (s.l > 2.2) { sparks.splice(i, 1); continue; } ctx.globalAlpha = 1 - s.l / 2.2; ctx.fillStyle = "#ffcf7a"; ctx.fillRect(s.x, s.y, 1.5, 1.5); }
				ctx.globalAlpha = 1;
			}
		}
		if (o.tower) { const tx = W * 0.86, ty = shore - shore * 0.35; const b = o.reduced ? 1 : 0.7 + 0.3 * Math.sin(t * 1.3); const g2 = ctx.createRadialGradient(tx, ty - 65, 0, tx, ty - 65, 26); g2.addColorStop(0, `rgba(255,205,120,${0.4 * b})`); g2.addColorStop(1, "rgba(255,205,120,0)"); ctx.fillStyle = g2; ctx.fillRect(tx - 30, ty - 95, 60, 60); }
		// fireflies in the footer
		if (o.fireflies && flies.length) {
			const calm = 1 - clamp(st.crisp * 1.6);
			for (const f of flies) {
				if (!o.reduced) { f.a += Math.sin(t * 0.7 + f.ph) * 1.4 * dt; f.x += Math.cos(f.a) * 14 * dt * (1 + st.crisp * 3); f.y += Math.sin(f.a) * 8 * dt; if (f.x < 0) f.x += W; if (f.x > W) f.x -= W; f.y = clamp(f.y, shore * 0.3, shore - 4); }
				const b = o.reduced ? 0.7 : Math.pow(Math.max(0, Math.sin(t * f.sp * 2 + f.ph)), 3) * 0.85 + 0.15;
				const al = b * (0.35 + 0.65 * calm) * (dark ? 0.95 : 0.8);
				const rr = 8 + 6 * b;
				const fg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr);
				const col = dark ? "214,255,120" : "232,160,20";
				fg.addColorStop(0, `rgba(255,255,230,${al})`); fg.addColorStop(0.25, `rgba(${col},${al * 0.6})`); fg.addColorStop(1, `rgba(${col},0)`);
				ctx.fillStyle = fg; ctx.fillRect(f.x - rr, f.y - rr, rr * 2, rr * 2);
			}
		}
	}

	function loop(now) {
		raf = 0;
		if (dead || !visible || document.hidden) return;
		const dt = Math.min(0.1, (now - last) / 1000);
		if (dt >= 1 / 24) { last = now; t += dt; drawFrame(dt); }
		raf = requestAnimationFrame(loop);
	}
	function kick() { if (!raf && !dead && visible && !document.hidden && !o.reduced) { last = performance.now(); raf = requestAnimationFrame(loop); } }
	const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) { if (!C) build(); else drawFrame(0); kick(); } }, { rootMargin: "100px" });
	io.observe(host);
	const ro = new ResizeObserver(() => { if (visible) build(); else C = null; });
	ro.observe(host);
	const onVis = () => kick();
	document.addEventListener("visibilitychange", onVis);
	const mo = new MutationObserver(() => { const d = document.documentElement.classList.contains("dark"); if (d !== dark && visible) build(); else if (d !== dark) C = null; });
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	return () => { dead = true; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); mo.disconnect(); document.removeEventListener("visibilitychange", onVis); host.remove(); };
}

export const footerCss = `
.site .site-page { z-index: 1; padding-bottom: 232px; }
.site .fr-foot { position: relative; z-index: 0; height: var(--fr-band, 340px); margin-top: calc(var(--fr-band, 340px) * -1); pointer-events: none; }
.site .fr-foot canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
`;
