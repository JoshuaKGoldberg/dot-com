// Ambient particles on one overlay canvas, ticked at ~30 fps and only drawn while something is visible.
import { Flock, rng, TAU, clamp, lerp, rgba } from "../forest-kit/kit.js";

export function createFx(root, { reduced, layer = ".scenery-c" }) {
	const host = root.querySelector(layer);
	const cv = document.createElement("canvas");
	cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block";
	host.append(cv);
	const ctx = cv.getContext("2d");
	const s = { w: 1, h: 1, t: 0, ptr: { x: -999, y: -999, vx: 0, vy: 0, speed: 0, moved: -99, active: false }, waterY: 0 };
	const systems = [];
	let timer = 0, raf = 0, last = 0, dead = false, wasDrawn = false;
	function resize() {
		const r = host.getBoundingClientRect();
		s.w = Math.max(1, r.width); s.h = Math.max(1, r.height);
		cv.width = Math.round(s.w); cv.height = Math.round(s.h);
		for (const q of systems) q.resize?.(s);
		if (reduced) drawFrame(0);
	}
	function onMove(e) {
		if (e.pointerType === "touch") return;
		const p = s.ptr, r = host.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		p.vx = x - p.x; p.vy = y - p.y;
		if (!p.active) { p.vx = p.vy = 0; }
		p.x = x; p.y = y; p.active = true; p.moved = s.t; p.speed = Math.hypot(p.vx, p.vy);
		for (const q of systems) q.onMove?.(s);
	}
	function drawFrame(dt) {
		let any = false;
		for (const q of systems) { q.update(dt, s); if (q.visible?.(s)) any = true; }
		if (any || wasDrawn) {
			ctx.clearRect(0, 0, s.w, s.h);
			for (const q of systems) if (q.visible?.(s)) q.draw(ctx, s);
		}
		wasDrawn = any;
	}
	function step(now) {
		raf = 0;
		if (dead || document.hidden) return;
		const dt = Math.min(0.1, (now - last) / 1000); last = now;
		s.t += dt;
		s.ptr.speed *= 0.9;
		drawFrame(dt);
		timer = setTimeout(kick, 22);
	}
	function kick() { timer = 0; if (!dead && !document.hidden && !raf) raf = requestAnimationFrame(step); }
	const onVis = () => { if (!document.hidden && !reduced && !raf && !timer) { last = performance.now(); kick(); } };
	window.addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	const ro = new ResizeObserver(resize); ro.observe(host);
	resize();
	return {
		s, canvas: cv,
		add(q) { systems.push(q); q.resize?.(s); return q; },
		start() { if (reduced) { for (let i = 0; i < 60; i++) { s.t += 0.1; for (const q of systems) q.update(0.1, s); } drawFrame(0); } else { last = performance.now(); kick(); } },
		redraw() { if (reduced) drawFrame(0); },
		destroy() { dead = true; cancelAnimationFrame(raf); clearTimeout(timer); ro.disconnect(); window.removeEventListener("pointermove", onMove); document.removeEventListener("visibilitychange", onVis); cv.remove(); },
	};
}

// ---- snow ----
export function snowSystem({ max = 160, color = [245, 249, 255], speed = 1, seed = 3 } = {}) {
	const r = rng(seed);
	let P = [], density = 0;
	const q = {
		get density() { return density; }, set density(v) { density = v; },
		resize(s) { const n = Math.min(max, Math.round((s.w * s.h) / 5500)); P = Array.from({ length: n }, () => ({ x: r() * s.w, y: r() * s.h, vy: 14 + r() * 22, z: r(), ph: r() * 6 })); },
		visible: () => density > 0.02,
		update(dt, s) {
			if (density <= 0.02) return;
			const wind = Math.sin(s.t * 0.2) * 6 + 5;
			for (const p of P) {
				p.y += p.vy * (0.5 + p.z * 0.7) * dt * speed;
				p.x += (Math.sin(s.t * 0.7 + p.ph) * 7 + wind) * dt;
				if (s.ptr.active && s.ptr.speed > 2) { const dx = p.x - s.ptr.x, dy = p.y - s.ptr.y, d2 = dx * dx + dy * dy; if (d2 < 6400) { p.x += (dx / (Math.sqrt(d2) + 1)) * 40 * dt * (s.ptr.speed / 30); } }
				if (p.y > s.h + 4) { p.y = -4; p.x = r() * s.w; }
				if (p.x > s.w + 4) p.x = -4; if (p.x < -4) p.x = s.w + 4;
			}
		},
		draw(ctx, s) {
			const n = Math.floor(P.length * density);
			for (const [lo, hi, rad, a] of [[0, 0.5, 1.3, 0.65], [0.5, 1.01, 2.1, 0.9]]) {
				ctx.fillStyle = rgba(color, a); ctx.beginPath();
				for (let i = 0; i < n; i++) { const p = P[i]; if (p.z < lo || p.z >= hi) continue; ctx.moveTo(p.x + rad, p.y); ctx.arc(p.x, p.y, rad * (0.8 + p.z * 0.4), 0, TAU); }
				ctx.fill();
			}
		},
	};
	return q;
}

// ---- leaves / petals ----
export function leafSystem({ colors, max = 110, kind = "leaf", seed = 9 } = {}) {
	const r = rng(seed);
	const P = [];
	let rate = 0, acc = 0;
	const q = {
		colors,
		set rate(v) { rate = v; }, get rate() { return rate; },
		spawn(x, y, vx = 0, vy = 0) {
			if (P.length >= max) return;
			P.push({ x, y, vx: vx + (r() - 0.3) * 14, vy: vy + 8 + r() * 14, s: kind === "leaf" ? 3 + r() * 2.6 : 2.2 + r() * 1.5, a: r() * TAU, va: (r() - 0.5) * 4, c: (r() * colors.length) | 0, ph: r() * 6, life: 0 });
		},
		visible: () => P.length > 0 || rate > 0,
		update(dt, s) {
			acc += rate * dt;
			while (acc > 1) { acc -= 1; q.spawn(r() * (s.w + 120) - 60, -8); }
			const lim = s.waterY || s.h;
			for (let i = P.length - 1; i >= 0; i--) {
				const p = P[i]; p.life += dt;
				p.vx += (6 - p.vx) * dt * 0.5; p.vy += (26 - p.vy) * dt * 0.8;
				p.x += (p.vx + Math.sin(s.t * 1.8 + p.ph) * 22) * dt; p.y += p.vy * dt * 0.8; p.a += p.va * dt;
				if (p.y > lim + (s.h - lim) * (0.15 + (p.ph / 6) * 0.7)) P.splice(i, 1);
			}
		},
		draw(ctx) {
			for (let c = 0; c < colors.length; c++) {
				ctx.fillStyle = rgba(colors[c], 0.95); ctx.beginPath();
				for (const p of P) { if (p.c !== c) continue; ctx.moveTo(p.x + p.s, p.y); ctx.ellipse(p.x, p.y, p.s, p.s * 0.55, p.a, 0, TAU); }
				ctx.fill();
			}
		},
		count: () => P.length,
	};
	return q;
}

// ---- fireflies: drift toward a resting cursor, scatter when it moves ----
export function fireflySystem({ rgb, dark, n = 26, seed = 31 } = {}) {
	const r = rng(seed);
	let F = [], amount = 0, sprite = null, spriteKey = "";
	const mk = (c) => { const k = c.join(); if (k === spriteKey) return; spriteKey = k; const e = document.createElement("canvas"); e.width = e.height = 64; const x = e.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,235,1)"); g.addColorStop(0.12, rgba(c, 0.95)); g.addColorStop(0.35, rgba(c, 0.28)); g.addColorStop(1, rgba(c, 0)); x.fillStyle = g; x.fillRect(0, 0, 64, 64); sprite = e; };
	const q = {
		set amount(v) { amount = v; }, get amount() { return amount; },
		setColor(c) { mk(c); },
		resize(s) { F = Array.from({ length: n }, () => ({ x: r() * s.w, y: s.h * (0.35 + 0.55 * r()), vx: 0, vy: 0, ph: r() * 6, bl: 0.35 + r() * 0.5, sz: 12 + r() * 12, a: r() * 6, orbit: 30 + r() * 70 })); },
		visible: () => amount > 0.03,
		update(dt, s) {
			if (amount <= 0.03) return;
			const still = s.t - s.ptr.moved > 0.9 && s.ptr.active;
			for (const f of F) {
				f.a += dt * (0.4 + (f.bl)); 
				let ax = Math.cos(f.a * 1.3 + f.ph) * 14, ay = Math.sin(f.a * 0.9 + f.ph * 2) * 10;
				if (still) { const tx = s.ptr.x + Math.cos(f.a + f.ph) * f.orbit, ty = s.ptr.y + Math.sin(f.a * 1.1 + f.ph) * f.orbit * 0.6; ax += (tx - f.x) * 0.9; ay += (ty - f.y) * 0.9; }
				else if (s.ptr.active && s.ptr.speed > 6) { const dx = f.x - s.ptr.x, dy = f.y - s.ptr.y, d = Math.hypot(dx, dy); if (d < 220) { ax += (dx / (d + 1)) * 260; ay += (dy / (d + 1)) * 260; } }
				f.vx += ax * dt; f.vy += ay * dt; const dm = Math.exp(-dt * 1.4); f.vx *= dm; f.vy *= dm;
				f.x += f.vx * dt; f.y += f.vy * dt;
				if (f.x < -20) f.x = s.w + 20; if (f.x > s.w + 20) f.x = -20; f.y = clamp(f.y, s.h * 0.3, s.h - 6);
			}
		},
		draw(ctx, s) {
			const m = Math.floor(F.length * amount);
			for (let i = 0; i < m; i++) { const f = F[i]; const b = reducedBlink(s, f); ctx.globalAlpha = (dark() ? 0.95 : 0.8) * b * Math.min(1, amount * 1.5); const z = f.sz * (0.7 + 0.3 * b); ctx.drawImage(sprite, f.x - z, f.y - z, z * 2, z * 2); }
			ctx.globalAlpha = 1;
		},
	};
	const reducedBlink = (s, f) => Math.pow(Math.max(0, Math.sin(s.t * f.bl * 2 + f.ph)), 3) * 0.85 + 0.15;
	mk(rgb);
	return q;
}

// ---- geese in a V (forest-kit Flock) ----
export function geeseSystem({ colors, seed = 21, respawn = [8, 18] } = {}) {
	const flock = new Flock({ seed, groups: 2, perGroup: [5, 7], size: [6.5, 8], band: [0.07, 0.24], speed: [34, 46], formation: "v", respawn, flap: [2.4, 3] });
	let rem = 0;
	return {
		flock, colors,
		resize(s) { flock.resize(s.w, s.h); },
		visible: () => flock.groups.some((g) => g.active),
		update(dt) { flock.update(dt, { wind: 0.6, perches: [], calm: 1 }); },
		draw(ctx) { flock.draw(ctx, this.colors); },
		prime(s) { flock.groups[0].wait = 0; flock.spawn(flock.groups[0], true); },
		scare: (x, y) => flock.scare(x, y, 120, 0.5),
	};
}
