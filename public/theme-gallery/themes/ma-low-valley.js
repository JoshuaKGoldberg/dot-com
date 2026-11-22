import { createAuroraCanvas, curtain, marginness, smooth, isDark } from "./_medium-a/kit.js";

const PAL = {
	dark: {
		far: ["#1c2d58", "#101b3a"], mid: ["#152448", "#0e1932"], near: ["#0d1830", "#0a1224"],
		lake: ["#183060", "#0b1528"], rim: "rgba(150,180,255,.28)", pine: ["#060b17", "#0a1226"], tint: [0.2, 0.2],
	},
	light: {
		far: ["#cfdcf0", "#e2ebf6"], mid: ["#bccfe8", "#d6e3f2"], near: ["#a7bfdb", "#c9dbee"],
		lake: ["#cfe6f4", "#b3d2e8"], rim: "rgba(255,255,255,.7)", pine: ["#8aa7c2", "#a0b9d0"], tint: [0.18, 0.18],
	},
};

function mulberry(a) {
	return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function layerCanvas(w, h, dpr, css) {
	const c = document.createElement("canvas");
	c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
	c.style.width = `${w}px`; c.style.height = `${h}px`;
	c.className = "ma-layer";
	if (css) Object.assign(c.style, css);
	const x = c.getContext("2d");
	x.scale(dpr, dpr);
	return { c, x };
}

// Ridge heights: tall at the sides, low in the middle (the valley).
function ridgeH(u, amp, seed, rough) {
	const v = Math.pow(Math.abs(2 * u - 1), 1.5);
	const n = 0.5 + 0.28 * Math.sin(u * 9 + seed) + 0.17 * Math.sin(u * 21 + seed * 2.3) + 0.08 * Math.sin(u * 47 + seed * 4.1) * rough;
	return amp * (0.3 + 0.7 * v) * (0.55 + 0.7 * n);
}

function pine(x, base, hgt, ctx, col) {
	const wd = hgt * 0.3;
	ctx.fillStyle = col;
	ctx.fillRect(x - hgt * 0.012, base - hgt * 0.1, hgt * 0.024, hgt * 0.1);
	const tiers = 7;
	for (let t = 0; t < tiers; t++) {
		const f = t / tiers;
		const y1 = base - hgt * 0.08 - f * hgt * 0.9;
		const y0 = y1 - hgt * 0.26;
		const ww = wd * (1 - f * 0.82) * (0.9 + 0.2 * Math.sin(t * 5.3 + x));
		ctx.beginPath();
		ctx.moveTo(x, y0);
		ctx.lineTo(x + ww, y1);
		ctx.lineTo(x + ww * 0.45, y1 - hgt * 0.012);
		ctx.lineTo(x - ww * 0.45, y1 - hgt * 0.012);
		ctx.lineTo(x - ww, y1);
		ctx.closePath();
		ctx.fill();
	}
}

export function activate({ root, reducedMotion }) {
	const sa = root.querySelector(".scenery-a"), sb = root.querySelector(".scenery-b"), sc = root.querySelector(".scenery-c");
	const made = [];
	let aur = null, raf = 0, px = 0, py = 0, scroll = 0, lastKey = "", dead = false;
	const layers = [];
	const birds = [];

	function build() {
		for (const el of made) el.remove();
		made.length = 0; layers.length = 0; birds.length = 0;
		const r = root.getBoundingClientRect();
		const w = Math.round(r.width), h = Math.round(r.height);
		if (w < 50 || h < 50) return;
		const dark = isDark();
		const P = PAL[dark ? "dark" : "light"];
		const dpr = Math.min(devicePixelRatio || 1, 1.5);
		const MX = 40, pad = 26;
		const lw = w + MX * 2;
		const bandH = Math.round(h * 0.26);
		const rnd = mulberry(91);
		const mk = (name, depth, parent, w2, h2, css) => {
			const l = layerCanvas(w2, h2 + pad, dpr, { bottom: `${-pad}px`, ...css });
			parent.appendChild(l.c);
			made.push(l.c);
			layers.push({ el: l.c, depth, name });
			return l;
		};
		const ridge = (l, amp, seed, rough, pal, baseOffset, rim) => {
			const { x } = l;
			const g = x.createLinearGradient(0, bandH - amp * 1.1 - baseOffset, 0, bandH);
			g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
			x.fillStyle = g;
			x.beginPath();
			x.moveTo(0, bandH + pad);
			const pts = [];
			for (let i = 0; i <= lw; i += 6) { const y = bandH - baseOffset - ridgeH(i / lw, amp, seed, rough); pts.push([i, y]); x.lineTo(i, y); }
			x.lineTo(lw, bandH + pad); x.closePath(); x.fill();
			if (rim) { x.strokeStyle = P.rim; x.lineWidth = 1; x.beginPath(); pts.forEach(([i, y], k) => (k ? x.lineTo(i, y) : x.moveTo(i, y))); x.stroke(); }
		};
		const far = mk("far", 0.35, sa, lw, bandH, { left: `${-MX}px` });
		ridge(far, bandH * 0.9, 1.7, 1, P.far, bandH * 0.05, true);
		const mid = mk("mid", 0.7, sa, lw, bandH, { left: `${-MX}px` });
		ridge(mid, bandH * 0.62, 4.2, 1, P.mid, bandH * 0.02, false);
		const near = mk("near", 1.2, sa, lw, bandH, { left: `${-MX}px` });
		ridge(near, bandH * 0.36, 7.9, 0.6, P.near, 0, false);
		// the lake: a pale band at the bottom with a faint aurora tint
		const lakeH = Math.round(bandH * 0.3);
		const lk = mk("lake", 1.5, sa, lw, lakeH, { left: `${-MX}px` });
		const lg = lk.x.createLinearGradient(0, 0, 0, lakeH);
		lg.addColorStop(0, P.lake[0]); lg.addColorStop(1, P.lake[1]);
		lk.x.fillStyle = lg;
		lk.x.beginPath();
		lk.x.moveTo(0, lakeH + pad);
		for (let i = 0; i <= lw; i += 6) { const u = i / lw; lk.x.lineTo(i, lakeH * (0.08 + 0.55 * Math.pow(Math.abs(2 * u - 1), 2.4)) + 3 * Math.sin(u * 30)); }
		lk.x.lineTo(lw, lakeH + pad); lk.x.closePath(); lk.x.fill();
		const tint = lk.x.createLinearGradient(0, 0, lw, 0);
		tint.addColorStop(0.15, `rgba(90,240,170,${P.tint[0]})`); tint.addColorStop(0.5, `rgba(110,160,255,${P.tint[1]})`); tint.addColorStop(0.85, `rgba(190,120,255,${P.tint[0]})`);
		lk.x.globalCompositeOperation = "source-atop";
		lk.x.fillStyle = tint; lk.x.fillRect(0, 0, lw, lakeH + pad);
		lk.x.globalCompositeOperation = "source-over";
		lk.x.strokeStyle = dark ? "rgba(180,205,255,.22)" : "rgba(255,255,255,.7)";
		lk.x.lineWidth = 1;
		for (let k = 0; k < 14; k++) { const yy = lakeH * (0.62 + 0.34 * rnd()); const cx = lw * (0.25 + 0.5 * rnd()), len = 20 + rnd() * 60; lk.x.beginPath(); lk.x.moveTo(cx - len, yy); lk.x.lineTo(cx + len, yy); lk.x.stroke(); }
		// pines at both side edges
		const pw = Math.max(100, Math.round(w * 0.12)), ph = Math.round(h * 0.36);
		for (const side of ["l", "r"]) {
			const pl = mk("pines" + side, 2, sc, pw, ph, {});
			pl.c.classList.add("ma-pines");
			if (side === "r") pl.c.classList.add("is-right");
			pl.c.style.left = side === "l" ? "0" : "auto";
			pl.c.style.right = side === "r" ? "0" : "auto";
			if (!reducedMotion) pl.c.style.animation = `ma-sway ${side === "l" ? 9 : 11}s ease-in-out infinite alternate`;
			const n = 7;
			for (let i = 0; i < n; i++) {
				const t = i / (n - 1);
				const fromEdge = (side === "l" ? t : 1 - t) * 0;
				const x = side === "l" ? pw * (0.1 + 0.75 * Math.pow(t, 1.05)) : pw * (0.9 - 0.75 * Math.pow(t, 1.05));
				const hgt = ph * (0.95 - 0.62 * Math.pow(t, 0.75)) * (0.88 + 0.24 * rnd());
				pine(x, ph + 8 + rnd() * 10, hgt, pl.x, P.pine[i % 2]);
			}
		}
		// birds: DOM SVGs, flown by compositor-only CSS animation
		const specs = [[0.42, 70, 0, 30, 1], [0.48, 90, 14, 24, 1], [0.37, 64, 30, 22, 0], [0.5, 110, 47, 18, 0], [0.45, 80, 55, 26, 1]];
		specs.forEach(([y, dur, delay, size, fwd], i) => {
			const tr = document.createElement("div");
			tr.className = "ma-bird-track" + (fwd ? "" : " is-back");
			tr.style.cssText = `--y:${Math.round(y * 100)}%;--dur:${dur}s;--delay:-${delay}s;`;
			tr.innerHTML = `<svg class="ma-bird" style="--size:${size}px;--flap:${(0.7 + (i % 3) * 0.15).toFixed(2)}s" viewBox="0 0 18 8" fill="currentColor"><path d="M0 4.5 C3 .6 7 1 9 4.6 C11 1 15 .6 18 4.5 C14.5 3.6 11.5 4.6 10.3 7 L9 5.6 L7.7 7 C6.5 4.6 3.5 3.6 0 4.5Z"/></svg>`;
			sc.appendChild(tr); made.push(tr);
			if (reducedMotion) tr.style.transform = `translate3d(${20 + i * 17}%,0,0)`;
		});
		place();
	}
	function place() {
		raf = 0;
		for (const l of layers) {
			const x = reducedMotion ? 0 : -px * 14 * l.depth;
			const y = reducedMotion ? 0 : -Math.min(22, scroll * 0.03 * l.depth) - py * 2 * l.depth;
			l.el.style.transform = `translate3d(${x}px,${y}px,0)`;
		}
	}
	const schedule = () => { if (!raf && !dead) raf = requestAnimationFrame(place); };
	const onMove = (e) => { const r = root.getBoundingClientRect(); px = (e.clientX - r.left) / r.width - 0.5; py = (e.clientY - r.top) / r.height - 0.5; schedule(); };
	const onScroll = () => { scroll = root.scrollTop; schedule(); };
	const watch = new MutationObserver(() => { const k = isDark() ? "d" : "l"; if (k !== lastKey) { lastKey = k; build(); } });
	watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	let size = "";
	const ro = new ResizeObserver(() => { const r = root.getBoundingClientRect(); const k = `${Math.round(r.width)}x${Math.round(r.height)}`; if (k !== size) { size = k; build(); } });
	ro.observe(root);
	lastKey = isDark() ? "d" : "l";
	build();

	const field = curtain({
		bands: 3,
		base: (u, b, S) => S.h * (0.085 + 0.05 * Math.pow(Math.abs(2 * u - 1), 1.7) + b * 0.04),
		hgt: (u, S) => S.h * (0.09 + 0.05 * Math.abs(2 * u - 1)),
		mx: (x, S) => 0.3 + 0.9 * marginness(x, S.w, 400, 0.2),
		fade: (y, S) => 1 - smooth(S.h * 0.16, S.h * 0.28, y),
		rayAmp: (S) => 0.22 + 0.25 * S.energy,
		edge: (S) => S.h * 0.035,
		pull: 0.36,
		sig: 0.2,
		gain: 1.75,
	});
	aur = createAuroraCanvas({ root, reducedMotion, scrollAway: true, host: sb, field, rest: [0.5, 0.1], clampY: [0, 0.3] });
	if (!reducedMotion) { addEventListener("pointermove", onMove, { passive: true }); root.addEventListener("scroll", onScroll, { passive: true }); }
	return () => {
		dead = true;
		cancelAnimationFrame(raf);
		removeEventListener("pointermove", onMove);
		root.removeEventListener("scroll", onScroll);
		watch.disconnect(); ro.disconnect();
		aur.destroy();
		for (const el of made) el.remove();
	};
}
