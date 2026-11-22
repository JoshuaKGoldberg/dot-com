// Footer scene for the Focus & Ribbon wave: spruce treeline over a still lake that mirrors the live aurora.
// One cached scene canvas (sky + silhouettes) plus one visible canvas redrawn at ~24 fps only while on screen.
import { rng, lerp, clamp } from "../forest-kit/kit.js";
import { createAurora } from "./aurora.js";

const PAL = {
	dark: {
		sky: [[0, "rgba(11,19,41,0)"], [0.2, "rgba(11,19,41,.1)"], [0.4, "rgba(11,19,41,.4)"], [0.6, "rgba(12,24,52,.8)"], [0.82, "rgba(14,28,62,1)"], [1, "rgba(18,40,74,1)"]],
		glow: [60, 200, 170], far: "#0f1c38", near: "#050a17", mid: "#0a1429", ground: "#04070f",
		peak: "#142446", rim: [150, 225, 235], water: ["#0e1d3c", "#050a18"], refl: "rgba(4,8,20,.88)", fire: [255, 170, 80], star: [225, 232, 255],
	},
	light: {
		sky: [[0, "rgba(234,242,245,0)"], [0.2, "rgba(234,242,245,.1)"], [0.4, "rgba(234,242,245,.4)"], [0.6, "rgba(236,236,230,.8)"], [0.82, "rgba(236,232,222,1)"], [1, "rgba(246,233,210,1)"]],
		glow: [255, 232, 196], far: "#6f94a4", near: "#27493f", mid: "#456f72", ground: "#1d3a34",
		peak: "#93adc4", rim: [255, 255, 255], water: ["#a6cad7", "#6f9db2"], refl: "rgba(30,62,56,.7)", fire: [255, 150, 70], star: [255, 255, 255],
	},
};

export function spruce(x, by, hgt, wid, r) {
	const tiers = 6 + ((r() * 3) | 0);
	const R = [];
	for (let i = 0; i < tiers; i++) {
		const top = by - hgt + (hgt * 0.94 * i) / tiers;
		const bot = top + (hgt * 1.12) / tiers;
		const half = (wid * (i + 1)) / tiers / 2;
		R.push([half * 0.4, top], [half * (0.9 + r() * 0.2), Math.min(bot, by)]);
	}
	const p = new Path2D();
	p.moveTo(x, by - hgt);
	for (const [dx, y] of R) p.lineTo(x + dx, y);
	p.lineTo(x + wid * 0.04, by + 2);
	p.lineTo(x - wid * 0.04, by + 2);
	for (let i = R.length - 1; i >= 0; i--) p.lineTo(x - R[i][0], R[i][1]);
	p.closePath();
	return p;
}

function paintSil(ctx, W, shoreY, P, kind, seed, big) {
	const r = rng(seed);
	const mid = (a, b) => a + (b - a) * r();
	// optional peak behind the trees
	if (kind.peak) {
		const px = W * kind.peak, ph = shoreY * 0.62, pw = W * 0.26;
		ctx.fillStyle = P.peak;
		ctx.beginPath();
		ctx.moveTo(px - pw, shoreY);
		const n = 26;
		for (let i = 0; i <= n; i++) {
			const t = i / n, x = px - pw + t * pw * 2;
			const tri = 1 - Math.abs(t - 0.42) / (t < 0.42 ? 0.42 : 0.58);
			ctx.lineTo(x, shoreY - Math.pow(Math.max(0, tri), 0.9) * ph - (Math.sin(i * 2.3) + Math.sin(i * 5.1)) * 3 * tri);
		}
		ctx.lineTo(px + pw, shoreY);
		ctx.closePath();
		ctx.fill();
		// lit rim on the left slope
		ctx.strokeStyle = `rgba(${P.rim},.28)`;
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		for (let i = 0; i <= 11; i++) {
			const t = i / 26, x = px - pw + t * pw * 2;
			const tri = 1 - Math.abs(t - 0.42) / 0.42;
			const y = shoreY - Math.pow(Math.max(0, tri), 0.9) * ph - (Math.sin(i * 2.3) + Math.sin(i * 5.1)) * 3 * tri;
			i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
		}
		ctx.stroke();
	}
	// far treeline: low, dense, lighter
	ctx.fillStyle = P.far;
	ctx.beginPath();
	ctx.moveTo(0, shoreY);
	for (let x = 0; x <= W; x += 5) ctx.lineTo(x, shoreY - 22 - 10 * Math.sin(x * 0.011 + seed) - 6 * Math.sin(x * 0.037));
	ctx.lineTo(W, shoreY);
	ctx.fill();
	for (let x = -10; x < W + 10; x += mid(6, 11)) ctx.fill(spruce(x, shoreY - 4, mid(26, 48) * (big ? 1.1 : 1), mid(10, 16), r));
	// fire tower
	if (kind.tower) {
		const tx = W * kind.tower, by = shoreY - 24, hh = 84;
		ctx.fillStyle = P.mid;
		ctx.fillRect(tx - 70, by + 4, 140, shoreY - by);
		ctx.strokeStyle = P.near;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(tx - 14, by); ctx.lineTo(tx - 8, by - hh); ctx.moveTo(tx + 14, by); ctx.lineTo(tx + 8, by - hh);
		for (let i = 0; i < 4; i++) {
			const y0 = by - (hh * i) / 4, y1 = by - (hh * (i + 1)) / 4, a = 14 - (6 * i) / 4, b = 14 - (6 * (i + 1)) / 4;
			ctx.moveTo(tx - a, y0); ctx.lineTo(tx + b, y1); ctx.moveTo(tx + a, y0); ctx.lineTo(tx - b, y1);
		}
		ctx.stroke();
		ctx.fillStyle = P.near;
		ctx.fillRect(tx - 12, by - hh - 13, 24, 13);
		ctx.beginPath(); ctx.moveTo(tx - 16, by - hh - 13); ctx.lineTo(tx, by - hh - 24); ctx.lineTo(tx + 16, by - hh - 13); ctx.fill();
	}
	// near treeline: clustered on the shores, open in the middle
	ctx.fillStyle = P.near;
	ctx.beginPath();
	ctx.moveTo(-5, shoreY + 3);
	for (let x = -5; x <= W + 5; x += 6) ctx.lineTo(x, shoreY - 3 + 2 * Math.sin(x * 0.02 + 1));
	ctx.lineTo(W + 5, shoreY + 3);
	ctx.fill();
	for (let x = -20; x < W + 20; x += mid(7, 15)) {
		const u = x / W, edge = Math.pow(Math.abs(u * 2 - 1), 1.3);
		const hgt = (30 + 95 * edge * (0.65 + 0.5 * r()) + 14 * r()) * (big ? 1.08 : 1);
		if (u > 0.3 && u < 0.7 && r() < 0.55) continue;
		ctx.fill(spruce(x, shoreY + 2, hgt, hgt * 0.34 + 6, r));
	}
	// a dead snag
	if (kind.snag) {
		const sx = W * kind.snag, sh = 120;
		ctx.strokeStyle = P.near; ctx.lineCap = "round";
		ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(sx, shoreY + 2); ctx.lineTo(sx + 2, shoreY - sh); ctx.stroke();
		ctx.lineWidth = 1.5; ctx.beginPath();
		for (let i = 0; i < 7; i++) { const y = shoreY - sh * (0.3 + i * 0.1), d = i % 2 ? 1 : -1, l = 12 + r() * 16; ctx.moveTo(sx + 1, y); ctx.lineTo(sx + 1 + d * l, y - 6 - r() * 6); }
		ctx.stroke();
	}
	// campfire logs and a lean-to
	if (kind.fire) {
		const fx = W * kind.fire;
		ctx.fillStyle = P.near;
		ctx.fillRect(fx - 40, shoreY - 4, 90, 8);
		ctx.strokeStyle = P.near; ctx.lineWidth = 3; ctx.lineCap = "round";
		ctx.beginPath(); ctx.moveTo(fx - 9, shoreY + 1); ctx.lineTo(fx + 8, shoreY - 4); ctx.moveTo(fx + 9, shoreY + 1); ctx.lineTo(fx - 8, shoreY - 4); ctx.stroke();
	}
}

export function createFooter(root, o) {
	const foot = root.querySelector(".site-footer");
	if (!foot) return { destroy() {} };
	const kind = o.kind || {};
	const seed = o.seed || 7;
	const H = o.height || 340;
	const shoreY = Math.round(H * 0.64);
	let dark = document.documentElement.classList.contains("dark");
	const cv = document.createElement("canvas");
	cv.className = "fr-footer-cv";
	cv.setAttribute("aria-hidden", "true");
	foot.prepend(cv);
	foot.classList.add("fr-footer");
	foot.style.minHeight = `${H - 48}px`;
	const ctx = cv.getContext("2d");
	let aurF = null, ptrX = -1, dummy = document.createElement("canvas").getContext("2d");
	let W = 0, dpr = 1, scene = null, sil = null, over = null, visible = false, raf = 0, last = 0, t = 0, dead = false, built = false;
	const ripples = [];
	const sparks = [];
	const rnd = rng(seed + 99);

	function layer(w, h, d = dpr) { const c = document.createElement("canvas"); c.width = Math.ceil(w * d); c.height = Math.ceil(h * d); const x = c.getContext("2d"); x.scale(d, d); return { c, x }; }

	function build() {
		W = root.clientWidth;
		if (!W) return;
		built = true;
		aurF = createAurora({ style: "ribbon", scale: 8, bottom: 0.5, gain: o.gain || 1.1, ribbonY: 0.2, focus: !!o.focus, rays: o.rays || 0.8, dark });
		aurF.resize(W, 520);
		dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		const P = PAL[dark ? "dark" : "light"];
		const pr = foot.getBoundingClientRect(), rr = root.getBoundingClientRect();
		cv.style.cssText = `left:${(rr.left - pr.left).toFixed(1)}px;width:${W}px;height:${H}px`;
		cv.width = Math.ceil(W * dpr); cv.height = Math.ceil(H * dpr);
		const s = layer(W, H);
		const g = s.x.createLinearGradient(0, 0, 0, shoreY);
		P.sky.forEach(([k, c]) => g.addColorStop(k, c));
		s.x.fillStyle = g; s.x.fillRect(0, 0, W, shoreY + 1);
		// horizon glow, tinted like the aurora
		const gx = W * (kind.peak ? 0.62 : 0.45);
		const rg = s.x.createRadialGradient(gx, shoreY, 0, gx, shoreY, W * 0.5);
		rg.addColorStop(0, `rgba(${P.glow},${dark ? 0.3 : 0.5})`); rg.addColorStop(1, `rgba(${P.glow},0)`);
		s.x.save(); s.x.translate(0, shoreY); s.x.scale(1, (shoreY * 0.8) / (W * 0.5)); s.x.translate(0, -shoreY); s.x.fillStyle = rg; s.x.fillRect(0, shoreY - W, W, W); s.x.restore();
		if (o.stars && dark) {
			const r = rng(seed + 5);
			for (let i = 0; i < 70; i++) { const y = Math.pow(r(), 1.4) * shoreY * 0.7; s.x.fillStyle = `rgba(${P.star},${(0.2 + r() * 0.6) * clamp(y / 40)})`; s.x.fillRect(r() * W, y, r() < 0.1 ? 1.6 : 1, r() < 0.1 ? 1.6 : 1); }
		}
		paintSil(s.x, W, shoreY, P, kind, seed, o.big);
		scene = s;
		const sl = layer(W, shoreY);
		paintSil(sl.x, W, shoreY, P, { ...kind, peak: kind.peak, tower: kind.tower }, seed, o.big);
		sil = sl;
		// islands live in the water, with their own little reflections
		over = null;
		if (kind.islands) {
			const ov = layer(W, H - shoreY);
			const r = rng(seed + 31);
			kind.islands.forEach(([u, dy, sz]) => {
				const x = W * u, y = dy;
				for (const flip of [0, 1]) {
					ov.x.save();
					if (flip) { ov.x.translate(0, y * 2 + 1); ov.x.scale(1, -0.7); ov.x.translate(0, y * 0.43); ov.x.globalAlpha = 0.45; }
					ov.x.fillStyle = P.near;
					ov.x.beginPath(); ov.x.ellipse(x, y, 34 * sz, 4 * sz, 0, Math.PI, 0); ov.x.fill();
					for (let i = 0; i < 5; i++) ov.x.fill(spruce(x + (i - 2) * 11 * sz + r() * 6, y, (16 + r() * 22) * sz * (1 - Math.abs(i - 2) * 0.12), 9 * sz, r));
					ov.x.restore();
				}
			});
			over = ov;
		}
		draw(0);
	}

	function draw(dt) {
		if (!scene) return;
		const P = PAL[dark ? "dark" : "light"];
		const lakeH = H - shoreY;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		ctx.drawImage(scene.c, 0, 0, W, H);
		// water
		const wg = ctx.createLinearGradient(0, shoreY, 0, H);
		wg.addColorStop(0, P.water[0]); wg.addColorStop(1, P.water[1]);
		ctx.fillStyle = wg;
		ctx.fillRect(0, shoreY, W, lakeH);
		// aurora mirrored from the live low-res canvas (same colours, same state)
		if (aurF) { const rr = cv.getBoundingClientRect(); aurF.update(dt, { reduced: !!o.reduced, pointer: { active: ptrX > -1, x: ptrX - rr.left, y: 90 } }); aurF.draw(dummy, 0, 0, 1, 1); }
		const aur = aurF;
		if (aur?.low && aur.low.width > 1) {
			const lw = aur.low.width, lh = aur.low.height;
			ctx.save();
			ctx.beginPath(); ctx.rect(0, shoreY, W, lakeH); ctx.clip();
			ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
			ctx.globalAlpha = (dark ? 0.62 : 0.5) * (o.mirror ?? 1);
			ctx.imageSmoothingQuality = "low";
			ctx.translate(0, shoreY + lakeH); ctx.scale(1, -1);
			ctx.drawImage(aur.low, 0, lh * 0.2, lw, lh * 0.5, 0, 0, W, lakeH);
			ctx.restore();
		}
		// silhouettes reflected in rippling strips
		const amp = 1.6 + (o.ripple ? 0 : 0);
		const sc = dpr;
		ctx.save();
		ctx.beginPath(); ctx.rect(0, shoreY, W, lakeH); ctx.clip();
		for (let d = 0; d < lakeH; d += 3) {
			const f = d / lakeH;
			const dx = (Math.sin(d * 0.15 + t * 1.3) * (0.4 + f) + Math.sin(d * 0.06 - t * 0.7) * 0.8) * amp;
			ctx.globalAlpha = lerp(0.9, 0.3, f);
			ctx.drawImage(sil.c, 0, (shoreY - d - 3) * sc, W * sc, 3 * sc, dx, shoreY + d, W, 3.6);
		}
		ctx.restore();
		ctx.globalAlpha = 1;
		if (over) ctx.drawImage(over.c, 0, shoreY, W, lakeH);
		// ripples
		for (let i = ripples.length - 1; i >= 0; i--) {
			const rp = ripples[i];
			rp.age += dt;
			if (rp.age > 3) { ripples.splice(i, 1); continue; }
			for (let k = 0; k < 3; k++) {
				const rad = rp.age * 36 - k * 9;
				if (rad <= 0) continue;
				ctx.strokeStyle = `rgba(${dark ? "190,215,245" : "255,255,255"},${(1 - rp.age / 3) * (1 - k * 0.3) * 0.6})`;
				ctx.lineWidth = 1.1;
				ctx.beginPath(); ctx.ellipse(rp.x, rp.y, rad, rad * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
			}
		}
		// campfire
		if (kind.fire) {
			const fx = W * kind.fire, fl = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3 + 1);
			ctx.save();
			ctx.globalCompositeOperation = "lighter";
			const fg = ctx.createRadialGradient(fx, shoreY - 8, 0, fx, shoreY - 8, 70);
			fg.addColorStop(0, `rgba(${P.fire},${0.5 * fl})`); fg.addColorStop(1, `rgba(${P.fire},0)`);
			ctx.fillStyle = fg; ctx.fillRect(fx - 70, shoreY - 78, 140, 100);
			const rg = ctx.createLinearGradient(0, shoreY, 0, H);
			rg.addColorStop(0, `rgba(${P.fire},${0.4 * fl})`); rg.addColorStop(1, `rgba(${P.fire},0)`);
			ctx.fillStyle = rg;
			for (let d = 0; d < lakeH * 0.8; d += 3) { const w2 = (10 + d * 0.2) * (1 - d / lakeH); ctx.globalAlpha = 0.8 * (1 - d / (lakeH * 0.8)) * fl; ctx.fillRect(fx - w2 / 2 + Math.sin(d * 0.2 + t * 2) * 2, shoreY + d, w2, 3); }
			ctx.globalAlpha = 1;
			ctx.fillStyle = `rgba(255,${180 + 40 * fl | 0},90,${0.9})`;
			ctx.beginPath(); ctx.moveTo(fx - 5, shoreY - 3); ctx.quadraticCurveTo(fx - 4, shoreY - 12 * fl - 6, fx + Math.sin(t * 7) * 1.5, shoreY - 18 * fl - 6); ctx.quadraticCurveTo(fx + 5, shoreY - 12, fx + 5, shoreY - 3); ctx.fill();
			ctx.restore();
			if (dt > 0 && sparks.length < 12 && rnd() < dt * 5) sparks.push({ x: fx + (rnd() - 0.5) * 8, y: shoreY - 14, vx: (rnd() - 0.3) * 12, vy: -(24 + rnd() * 30), age: 0, life: 1.6 + rnd() * 1.4 });
			ctx.fillStyle = `rgb(${P.fire})`;
			for (let i = sparks.length - 1; i >= 0; i--) {
				const sp = sparks[i];
				sp.age += dt; sp.x += (sp.vx + Math.sin(sp.age * 4 + i) * 8) * dt; sp.y += sp.vy * dt;
				if (sp.age > sp.life) { sparks.splice(i, 1); continue; }
				ctx.globalAlpha = (1 - sp.age / sp.life) * 0.9;
				ctx.fillRect(sp.x, sp.y, 1.8, 1.8);
			}
			ctx.globalAlpha = 1;
		}
	}

	function loop(now) {
		raf = 0;
		if (dead || !visible || document.hidden) return;
		if (now - last >= 41) {
			const dt = Math.min(0.1, (now - last) / 1000);
			last = now; t += dt;
			draw(dt);
		}
		raf = requestAnimationFrame(loop);
	}
	function run() { if (!raf && visible && !o.reduced && !document.hidden && built) { last = performance.now(); raf = requestAnimationFrame(loop); } }

	const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) { if (!built) build(); if (o.reduced) draw(0); else run(); } });
	io.observe(foot);
	const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else run(); };
	document.addEventListener("visibilitychange", onVis);
	const onClick = (e) => {
		if (o.reduced || !o.clickRipples) return;
		const r = cv.getBoundingClientRect();
		const y = e.clientY - r.top;
		if (y < shoreY || e.target.closest("a,button")) return;
		ripples.push({ x: e.clientX - r.left, y, age: 0 });
		if (ripples.length > 6) ripples.shift();
	};
	foot.addEventListener("pointerdown", onClick);
	const onMove = (e) => { ptrX = e.clientX; };
	window.addEventListener("pointermove", onMove, { passive: true });
	let rzT = 0;
	const ro = new ResizeObserver(() => { if (dead || !built) return; if (root.clientWidth === W) return; clearTimeout(rzT); rzT = setTimeout(() => { build(); }, 160); });
	ro.observe(root);
	const unDark = (() => { const mo = new MutationObserver(() => { const d = document.documentElement.classList.contains("dark"); if (d !== dark) { dark = d; if (built) build(); } }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); return () => mo.disconnect(); })();

	return {
		destroy() {
			dead = true; cancelAnimationFrame(raf); clearTimeout(rzT);
			io.disconnect(); ro.disconnect(); unDark();
			document.removeEventListener("visibilitychange", onVis);
			foot.removeEventListener("pointerdown", onClick);
			window.removeEventListener("pointermove", onMove);
			cv.remove();
		},
	};
}
