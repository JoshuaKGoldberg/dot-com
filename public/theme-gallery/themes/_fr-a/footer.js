/*
 * Footer scene for the Focus & Ribbon wave: spruce treeline over a still lake
 * that mirrors the live aurora. Static layers are cached once; per frame we
 * only blit the (tiny) aurora canvas and a few reflection strips. Runs only
 * while scrolled into view. No scrim: footer text sits over calm sky.
 */
const TAU = Math.PI * 2;
const H = 340, WY = 236; // band height, waterline

const PAL = {
	dark: {
		sky: [[0, "rgba(7,13,32,0)"], [0.5, "#0a1331"], [1, "#16264d"]],
		peak: "#0e1a3c", rim: "rgba(150,185,230,.5)", far: "#0c1632", near: "#040916", land: "#030710",
		water: ["#0f1d3c", "#050b1c"], star: [225, 232, 255], glow: [255, 170, 80],
	},
	light: {
		sky: [[0, "rgba(243,248,250,0)"], [0.5, "#e2ecf1"], [1, "#f4e8d6"]],
		peak: "#8fa6c0", rim: "rgba(255,255,255,.7)", far: "#6f93a8", near: "#1f3f3c", land: "#17302c",
		water: ["#9cc0d0", "#4a7b92"], star: [255, 255, 255], glow: [255, 150, 60],
	},
};

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function spruce(ctx, x, base, h, w) {
	const n = Math.max(3, Math.round(h / 8));
	const step = h / n;
	ctx.beginPath();
	ctx.moveTo(x, base - h);
	for (let k = 1; k <= n; k++) {
		const y = base - h + k * step, hw = w * (0.18 + 0.82 * (k / n));
		ctx.lineTo(x + hw, y - step * 0.25);
		ctx.lineTo(x + hw * 0.5, y - step * 0.22);
	}
	ctx.lineTo(x + w * 0.1, base);
	ctx.lineTo(x - w * 0.1, base);
	for (let k = n; k >= 1; k--) {
		const y = base - h + k * step, hw = w * (0.18 + 0.82 * (k / n));
		ctx.lineTo(x - hw * 0.5, y - step * 0.22);
		ctx.lineTo(x - hw, y - step * 0.25);
	}
	ctx.closePath();
	ctx.fill();
}

// Draws every scenery piece that sits on the shore (shared by sky and mirror).
function paintShore(ctx, W, P, kind, seed) {
	const r = rng(seed);
	const f = (x) => Math.abs(x / W - 0.5) * 2; // 0 centre, 1 edge
	const peakX = W * 0.84;
	if (kind === "peak") {
		ctx.fillStyle = P.peak;
		ctx.beginPath();
		ctx.moveTo(W * 0.58, WY);
		const pts = [[0.66, 120], [0.72, 98], [0.78, 150], [0.84, 178], [0.9, 120], [0.95, 138], [1.02, 80]];
		for (const [u, hh] of pts) ctx.lineTo(W * u, WY - hh);
		ctx.lineTo(W * 1.02, WY);
		ctx.fill();
		ctx.strokeStyle = P.rim; ctx.lineWidth = 1.2;
		ctx.beginPath(); ctx.moveTo(W * 0.78, WY - 150); ctx.lineTo(W * 0.84, WY - 178); ctx.lineTo(W * 0.9, WY - 120); ctx.stroke();
	}
	// far row
	ctx.fillStyle = P.far;
	for (let x = -10; x < W + 10; x += 7 + r() * 9) {
		const hh = 16 + (kind === "peak" && x > W * 0.6 ? 14 : 0) + (10 + 52 * Math.pow(f(x), 1.5)) * (0.6 + r() * 0.5);
		spruce(ctx, x, WY - 3, hh, hh * 0.22);
	}
	if (kind === "tower") {
		// low hill with a fire tower
		ctx.fillStyle = P.far;
		ctx.beginPath(); ctx.moveTo(W * 0.62, WY);
		for (let x = W * 0.62; x <= W * 1.02; x += 12) ctx.lineTo(x, WY - 46 * Math.exp(-Math.pow((x - W * 0.82) / (W * 0.11), 2)) - 4);
		ctx.lineTo(W * 1.02, WY); ctx.fill();
		const tx = W * 0.82, ty = WY - 48;
		ctx.fillStyle = P.near; ctx.strokeStyle = P.near; ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(tx - 12, ty); ctx.lineTo(tx - 5, ty - 70); ctx.moveTo(tx + 12, ty); ctx.lineTo(tx + 5, ty - 70);
		ctx.moveTo(tx - 10, ty - 24); ctx.lineTo(tx + 8, ty - 46); ctx.moveTo(tx + 10, ty - 24); ctx.lineTo(tx - 8, ty - 46);
		ctx.stroke();
		ctx.fillRect(tx - 9, ty - 84, 18, 14);
		ctx.beginPath(); ctx.moveTo(tx - 12, ty - 84); ctx.lineTo(tx, ty - 95); ctx.lineTo(tx + 12, ty - 84); ctx.fill();
	}
	// near row
	ctx.fillStyle = P.near;
	for (let x = -10; x < W + 10; x += 9 + r() * 14) {
		const hh = 14 + (6 + 70 * Math.pow(f(x), 1.4)) * (0.55 + r() * 0.6);
		spruce(ctx, x, WY + 1, hh, hh * 0.24);
	}
	if (kind === "islands") {
		for (const [u, s] of [[0.27, 1], [0.7, 0.8]]) {
			const ix = W * u;
			ctx.fillStyle = P.land;
			ctx.beginPath(); ctx.ellipse(ix, WY + 26, 46 * s, 5, 0, Math.PI, TAU); ctx.fill();
			ctx.fillStyle = P.near;
			for (let i = -2; i <= 2; i++) spruce(ctx, ix + i * 13 * s, WY + 27, (24 - Math.abs(i) * 4) * s + 6 * r(), 6 * s);
		}
		// dead snag on the shore
		ctx.strokeStyle = P.near; ctx.lineWidth = 2.5;
		const sx = W * 0.14;
		ctx.beginPath(); ctx.moveTo(sx, WY + 2); ctx.lineTo(sx + 2, WY - 92); ctx.moveTo(sx + 1, WY - 60); ctx.lineTo(sx + 14, WY - 76); ctx.moveTo(sx + 2, WY - 74); ctx.lineTo(sx - 11, WY - 88); ctx.moveTo(sx + 1, WY - 42); ctx.lineTo(sx - 10, WY - 54); ctx.stroke();
	}
	if (kind === "campfire") {
		// foreground promontory with a lean-to
		ctx.fillStyle = P.land;
		const lx = W * 0.2;
		ctx.beginPath(); ctx.moveTo(-10, WY + 30); ctx.quadraticCurveTo(lx * 0.9, WY - 4, lx + 70, WY + 14); ctx.lineTo(lx + 110, WY + 30); ctx.fill();
		ctx.fillStyle = P.near;
		ctx.beginPath(); ctx.moveTo(lx - 34, WY + 8); ctx.lineTo(lx + 2, WY - 30); ctx.lineTo(lx + 38, WY + 8); ctx.closePath(); ctx.fill();
	}
}

export function createFooter({ root, reducedMotion, kind = "peak", seed = 5, getAurora }) {
	const foot = root.querySelector(".site-footer");
	if (!foot) return () => {};
	foot.classList.add("fr-foot");
	const cv = document.createElement("canvas");
	cv.className = "fr-foot-canvas";
	cv.setAttribute("aria-hidden", "true");
	foot.prepend(cv);
	const ctx = cv.getContext("2d");
	let dark = document.documentElement.classList.contains("dark");
	let glow = null, gx = null, glowMask = null;
	let W = 0, dpr = 1, vis = false, raf = 0, last = 0, stat = null, refl = null, rx = null, spark = [], t = 0;

	function build() {
		const fr = foot.getBoundingClientRect(), sr = root.getBoundingClientRect();
		const w = Math.max(320, Math.round(sr.width));
		dpr = Math.min(1.5, window.devicePixelRatio || 1);
		W = w;
		cv.style.left = `${Math.round(sr.left - fr.left)}px`;
		cv.style.width = `${w}px`;
		cv.style.height = `${H}px`;
		cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr);
		const P = PAL[dark ? "dark" : "light"];
		// static layer: sky + stars + scenery + water base
		stat = document.createElement("canvas"); stat.width = cv.width; stat.height = cv.height;
		const s = stat.getContext("2d"); s.scale(dpr, dpr);
		const g = s.createLinearGradient(0, 0, 0, WY);
		P.sky.forEach(([o, c]) => g.addColorStop(o, c));
		s.fillStyle = g; s.fillRect(0, 0, w, WY + 1);
		const r = rng(seed * 7);
		s.fillStyle = `rgba(${P.star.join(",")},${dark ? 0.7 : 0.0})`;
		for (let i = 0; i < 40; i++) s.fillRect(r() * w, 30 + r() * (WY - 90), 1.2, 1.2);
		paintShore(s, w, P, kind, seed);
		const wg = s.createLinearGradient(0, WY, 0, H);
		wg.addColorStop(0, P.water[0]); wg.addColorStop(1, P.water[1]);
		s.fillStyle = wg; s.fillRect(0, WY, w, H - WY);
		// mirror source: the shore, flipped, drawn once at low alpha
		refl = document.createElement("canvas"); refl.width = Math.round(w / 2); refl.height = Math.round((H - WY) / 2);
		rx = refl.getContext("2d");
		const sc = document.createElement("canvas"); sc.width = cv.width; sc.height = cv.height;
		const sx = sc.getContext("2d"); sx.scale(dpr, dpr);
		const gg = sx.createLinearGradient(0, 0, 0, WY); P.sky.forEach(([o, c]) => gg.addColorStop(o, c)); gg.addColorStop(0, P.sky[1][1]);
		sx.fillStyle = gg; sx.fillRect(0, 0, w, WY + 1);
		paintShore(sx, w, P, kind, seed);
		stat.shoreMirror = sc;
		glow = document.createElement("canvas"); glow.width = Math.round(w / 4); glow.height = 48; gx = glow.getContext("2d");
		glowMask = document.createElement("canvas"); glowMask.width = glow.width; glowMask.height = glow.height;
		const gm = glowMask.getContext("2d"), gr = gm.createLinearGradient(0, 0, 0, glow.height);
		gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "#000"); gm.fillStyle = gr; gm.fillRect(0, 0, glow.width, glow.height);
		draw(true);
	}

	function drawStrips(aur) {
		const P = PAL[dark ? "dark" : "light"];
		const dh = H - WY;
		// flip: waterline row maps to refl top
		rx.setTransform(1, 0, 0, 1, 0, 0);
		rx.clearRect(0, 0, refl.width, refl.height);
		rx.save();
		rx.scale(0.5, -0.5);
		rx.translate(0, -WY);
		rx.drawImage(stat.shoreMirror, 0, 0, W, H);
		rx.restore();
		if (aur) {
			rx.save();
			rx.globalCompositeOperation = dark ? "lighter" : "source-over";
			rx.globalAlpha = dark ? 0.9 : 0.8;
			// aurora low canvas stretched over the sky height, then flipped
			rx.scale(0.5, -0.5);
			rx.translate(0, -WY);
			rx.drawImage(aur.low, 0, 0, aur.low.width, aur.low.height, 0, WY - 190, W, 190);
			rx.drawImage(aur.low, 0, 0, aur.low.width, aur.low.height, 0, WY - 190, W, 190);
			rx.restore();
		}
		const strip = 3, ts = t;
		for (let y = 0; y < dh; y += strip) {
			const k = y / dh;
			const off = Math.sin(y * 0.55 + ts * 1.3) * (1 + 2.2 * k) + Math.sin(y * 1.7 - ts * 0.8) * 0.8;
			ctx.globalAlpha = 0.9 - 0.45 * k;
			ctx.drawImage(refl, 0, (y / dh) * refl.height, refl.width, Math.max(1, (strip / dh) * refl.height), off, WY + y, W, strip);
		}
		ctx.globalAlpha = 1;
		void P;
	}

	function draw(first) {
		if (!stat) return;
		const P = PAL[dark ? "dark" : "light"];
		const aur = getAurora?.();
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		ctx.drawImage(stat, 0, 0, W, H);
		// aurora glow above the treeline: short and fading upward so footer text stays on calm sky
		if (aur) {
			const gh = 96;
			gx.globalCompositeOperation = "source-over"; gx.clearRect(0, 0, glow.width, glow.height);
			gx.fillStyle = dark ? "#000" : "rgba(0,0,0,0)"; gx.fillRect(0, 0, glow.width, glow.height);
			gx.globalCompositeOperation = dark ? "lighter" : "source-over";
			gx.drawImage(aur.low, 0, 0, aur.low.width, aur.low.height, 0, 0, glow.width, glow.height);
			gx.globalCompositeOperation = "destination-in";
			gx.drawImage(glowMask, 0, 0);
			ctx.save();
			ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
			ctx.globalAlpha = dark ? 1 : 0.7;
			ctx.drawImage(glow, 0, WY - gh, W, gh);
			ctx.restore();
		}
		drawStrips(aur);
		if (kind === "campfire") drawFire(P);
		void first;
	}

	function drawFire(P) {
		const fx = W * 0.2 + 64, fy = WY + 17;
		const fl = 0.8 + 0.2 * Math.sin(t * 9) + 0.1 * Math.sin(t * 23);
		const gr = ctx.createRadialGradient(fx, fy - 4, 1, fx, fy - 4, 54 * fl);
		gr.addColorStop(0, `rgba(${P.glow.join(",")},.65)`); gr.addColorStop(1, `rgba(${P.glow.join(",")},0)`);
		ctx.fillStyle = gr; ctx.fillRect(fx - 60, fy - 64, 120, 150);
		ctx.fillStyle = "rgba(255,196,96,.95)";
		ctx.beginPath(); ctx.ellipse(fx, fy - 4, 4 * fl, 8 * fl, 0, 0, TAU); ctx.fill();
		ctx.fillStyle = "rgba(255,240,190,.9)";
		ctx.beginPath(); ctx.ellipse(fx, fy - 2, 2, 4.5 * fl, 0, 0, TAU); ctx.fill();
		// water glint under the fire
		ctx.fillStyle = `rgba(${P.glow.join(",")},.25)`;
		for (let i = 0; i < 7; i++) ctx.fillRect(fx - 12 + Math.sin(t * 2 + i) * 6, WY + 24 + i * 9, 10 + i * 2, 1.5);
		ctx.fillStyle = "rgba(255,200,120,.9)";
		for (const p of spark) { ctx.globalAlpha = Math.max(0, p.l); ctx.fillRect(p.x, p.y, 1.6, 1.6); }
		ctx.globalAlpha = 1;
	}

	function tick(now) {
		raf = 0;
		if (!vis || document.hidden) return;
		raf = requestAnimationFrame(tick);
		if (now - last < 1000 / 24) return;
		const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
		if (kind === "campfire") {
			if (Math.random() < 0.35 && spark.length < 16) spark.push({ x: W * 0.2 + 64 + (Math.random() - 0.5) * 6, y: WY + 8, vx: (Math.random() - 0.3) * 12, vy: -(24 + Math.random() * 30), l: 1 });
			for (const p of spark) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt * 0.55; }
			spark = spark.filter((p) => p.l > 0);
		}
		draw();
	}
	function start() { if (!raf && !reducedMotion) { last = 0; raf = requestAnimationFrame(tick); } }

	const io = new IntersectionObserver((e) => {
		vis = e[0].isIntersecting;
		if (vis) { if (!stat) build(); else draw(); start(); }
		else if (raf) { cancelAnimationFrame(raf); raf = 0; }
	});
	io.observe(foot);
	const ro = new ResizeObserver(() => { if (vis) build(); else stat = null; });
	ro.observe(root);
	const onVis = () => { if (!document.hidden) start(); };
	document.addEventListener("visibilitychange", onVis);
	const mo = new MutationObserver(() => { dark = document.documentElement.classList.contains("dark"); if (vis) build(); else stat = null; });
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	return () => { io.disconnect(); ro.disconnect(); mo.disconnect(); document.removeEventListener("visibilitychange", onVis); if (raf) cancelAnimationFrame(raf); cv.remove(); foot.classList.remove("fr-foot"); };
}
