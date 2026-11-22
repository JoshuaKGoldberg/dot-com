/* Little margin physics: dandelion seeds and fireflies. Fixed timestep, cursor-velocity driven, sleepy. */
import { clamp, makeLayer, pointerV, reducedNow, sleepyLoop, smoothstep } from "./layer.js";
import { rng } from "../_quiet-d/kit.js";

const H = 1 / 60;

/* ---------------- dandelion seeds ---------------- */
function pappus(dark) {
	const S = 40, c = document.createElement("canvas");
	c.width = c.height = S;
	const x = c.getContext("2d"), m = S / 2;
	const col = dark ? "232,240,255" : "88,104,150";
	x.translate(m, m);
	x.strokeStyle = `rgba(${col},0.95)`; x.lineWidth = 0.9; x.lineCap = "round";
	for (let i = 0; i < 13; i++) {
		const a = -Math.PI / 2 + (i / 12 - 0.5) * 3.7; // fan up from the achene
		x.beginPath(); x.moveTo(0, 6); x.lineTo(Math.cos(a) * 15, Math.sin(a) * 15 + 6); x.stroke();
		x.fillStyle = `rgba(${col},0.9)`;
		x.beginPath(); x.arc(Math.cos(a) * 15, Math.sin(a) * 15 + 6, 1, 0, 6.28); x.fill();
	}
	x.strokeStyle = `rgba(${col},0.95)`; x.lineWidth = 1.1;
	x.beginPath(); x.moveTo(0, 6); x.lineTo(0, 13); x.stroke();
	x.fillStyle = dark ? "rgba(255,226,180,0.95)" : "rgba(150,110,60,0.95)";
	x.beginPath(); x.ellipse(0, 14, 1.2, 2.6, 0, 0, 6.28); x.fill();
	return c;
}

export function dandelions(root, d, { dark, reducedMotion, count = 12, seed = 342 }) {
	const reduced = reducedNow(reducedMotion);
	const spr = pappus(dark);
	let seeds = [];
	const rnd = rng(seed);
	let L = null;
	const home = (s) => {
		const x = L.marginX(rnd);
		s.hx = x; s.hy = L.h * (0.12 + rnd() * 0.8);
	};
	const build = () => {
		seeds = [];
		if (!L || L.side < 60) return;
		for (let i = 0; i < count; i++) {
			const s = { x: 0, y: 0, vx: 0, vy: 0, rot: (rnd() - 0.5) * 0.7, w: 0, state: "rest", age: 0, life: 5 + rnd() * 5, a: 1, ph: rnd() * 6.28, sz: 0.8 + rnd() * 0.45, rest: 0 };
			home(s);
			s.x = s.hx; s.y = s.hy;
			seeds.push(s);
		}
		draw();
	};
	L = makeLayer(root, d, build);
	if (!L) return null;
	const draw = () => {
		L.clear();
		const ctx = L.ctx;
		for (const s of seeds) {
			if (s.a < 0.02) continue;
			ctx.globalAlpha = s.a * (dark ? 0.55 : 0.6) * (s.state === "rest" ? 0.8 : 1);
			ctx.save();
			ctx.translate(s.x, s.y); ctx.rotate(s.rot);
			const k = s.sz * 0.62;
			ctx.drawImage(spr, -20 * k, -20 * k, 40 * k, 40 * k);
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	};
	const pt = pointerV(d, () => lp.wake());
	let acc = 0, t = 0;
	const sub = () => {
		t += H;
		const px = pt.x - L.ox, py = pt.y - L.oy;
		for (const s of seeds) {
			const dxp = s.x - px, dyp = s.y - py, dist = Math.hypot(dxp, dyp);
			if (pt.has && dist < 110) {
				// the cursor's wake: velocity, falling off with distance
				const k = Math.pow(1 - dist / 110, 2);
				const sp = pt.speed;
				if (s.state === "rest") {
					if (sp > 260 && k > 0.12) { s.state = "air"; s.age = 0; s.vy -= 40; }
				}
				if (s.state === "air") {
					s.vx += pt.vx * k * 0.5 * H * 6;
					s.vy += pt.vy * k * 0.5 * H * 6 - 18 * k;
					s.w += (pt.vx * 0.0008) * k;
				}
			}
			if (s.state === "air") {
				s.age += H;
				s.vx += Math.sin(t * 1.7 + s.ph) * 14 * H; // drift
				s.vy += 11 * H; // light gravity: a seed sinks slowly
				const drag = Math.exp(-1.15 * H);
				s.vx *= drag; s.vy *= Math.exp(-1.6 * H);
				// soft wall: seeds stay out of the content column
				const left = L.side - 6, right = L.w - L.side + 6;
				if (s.x > left && s.x < right) { const mid = L.w / 2; s.vx += (s.x < mid ? -1 : 1) * 260 * H; }
				s.x += s.vx * H; s.y += s.vy * H;
				s.w += (-s.rot * 3 - s.w * 1.5) * H; s.rot += s.w * H + s.vx * 0.0006;
				if (s.age > s.life || s.y > L.h + 30 || s.y < -30) s.a -= H * 0.7;
				if (s.a <= 0) { home(s); s.x = s.hx; s.y = s.hy; s.vx = s.vy = s.w = 0; s.rot = (rnd() - 0.5) * 0.7; s.state = "regrow"; s.a = 0; }
			} else if (s.state === "regrow") {
				s.a += H * 0.25;
				if (s.a >= 1) { s.a = 1; s.state = "rest"; }
			}
		}
	};
	const lp = sleepyLoop((dt) => {
		acc = Math.min(acc + dt, 0.1);
		while (acc >= H) { sub(); acc -= H; }
		pt.settle(dt);
		draw();
		return seeds.some((s) => s.state !== "rest") || pt.speed > 30;
	}, { fps: 60, d });
	return { wake: lp.wake };
}

/* ---------------- fireflies ---------------- */
function glow(rgb, core) {
	const S = 64, c = document.createElement("canvas");
	c.width = c.height = S;
	const x = c.getContext("2d"), m = S / 2;
	const g = x.createRadialGradient(m, m, 0, m, m, m);
	g.addColorStop(0, `rgba(${core},1)`);
	g.addColorStop(0.12, `rgba(${rgb},0.85)`);
	g.addColorStop(0.35, `rgba(${rgb},0.22)`);
	g.addColorStop(1, `rgba(${rgb},0)`);
	x.fillStyle = g; x.fillRect(0, 0, S, S);
	return c;
}

export function fireflies(root, d, { dark, reducedMotion, count = 6, seed = 343 }) {
	const reduced = reducedNow(reducedMotion);
	const spr = dark ? glow("190,255,120", "255,255,225") : glow("240,170,40", "255,240,170");
	const rnd = rng(seed);
	let flies = [];
	let L = null;
	const build = () => {
		flies = [];
		if (!L || L.side < 60) return;
		for (let i = 0; i < count; i++) {
			const x = L.marginX(rnd, 20);
			const y = L.h * (0.15 + rnd() * 0.75);
			flies.push({ x, y, vx: 0, vy: 0, hx: x, hy: y, ph: rnd() * 6.28, per: 2.6 + rnd() * 2.4, wp: rnd() * 6.28, wr: 18 + rnd() * 24, trail: [], lure: 0 });
		}
		draw();
	};
	L = makeLayer(root, d, build);
	if (!L) return null;
	const ctx = L.ctx;
	let t = 0, acc = 0, lastMove = -99;
	const draw = () => {
		L.clear();
		ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
		for (const f of flies) {
			const blink = reduced ? 0.7 : Math.pow(0.5 + 0.5 * Math.sin(t * (6.2832 / f.per) + f.ph), 2.2);
			const b = 0.2 + 0.8 * blink;
			for (let i = 0; i < f.trail.length; i++) {
				const q = f.trail[i], k = 1 - i / f.trail.length;
				ctx.globalAlpha = k * 0.35 * b * f.lure;
				const sz = 14 * (0.4 + 0.6 * k);
				ctx.drawImage(spr, q.x - sz / 2, q.y - sz / 2, sz, sz);
			}
			ctx.globalAlpha = (dark ? 0.9 : 0.8) * b;
			const sz = 12 + 12 * blink;
			ctx.drawImage(spr, f.x - sz / 2, f.y - sz / 2, sz, sz);
		}
		ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
	};
	const pt = pointerV(d, () => { lastMove = t; lp.wake(); });
	let idleFor = 0;
	const sub = () => {
		t += H;
		const px = pt.x - L.ox, py = pt.y - L.oy;
		const recent = pt.has && t - lastMove < 1.6;
		// recruit the 3 nearest flies while the cursor is moving
		let order = [];
		if (recent) order = flies.map((f) => [Math.hypot(f.x - px, f.y - py), f]).sort((a, b) => a[0] - b[0]).slice(0, 3).filter((q) => q[0] < 560);
		const rec = new Set(order.map((q) => q[1]));
		const left = L.side - 22, right = L.w - L.side + 22;
		for (const f of flies) {
			let ax = 0, ay = 0;
			if (rec.has(f)) {
				f.lure += (1 - f.lure) * 0.05;
				// follow the cursor's height, held at the edge of the margin
				const tx = px < L.w / 2 ? clamp(px, 16, left) : clamp(px, right, L.w - 16);
				const ty = py + Math.sin(t * 3 + f.ph) * 14;
				ax += (tx - f.x) * 7; ay += (ty - f.y) * 7;
			} else {
				f.lure += (0 - f.lure) * 0.03;
				// wander around home
				const wx = f.hx + Math.cos(t * 0.35 + f.wp) * f.wr + Math.sin(t * 0.13 + f.ph) * f.wr * 0.6;
				const wy = f.hy + Math.sin(t * 0.42 + f.wp) * f.wr * 0.8;
				const k = reduced ? 3 : 1.4;
				ax += (wx - f.x) * k; ay += (wy - f.y) * k;
			}
			// the cursor's wake nudges any nearby fly
			const dd = Math.hypot(f.x - px, f.y - py);
			if (pt.has && dd < 120) { const k = Math.pow(1 - dd / 120, 2); ax += pt.vx * k * 2.5; ay += pt.vy * k * 2.5; }
			// soft wall away from the column
			if (f.x > left && f.x < right) ax += (f.x < L.w / 2 ? -1 : 1) * 700;
			f.vx += ax * H; f.vy += ay * H;
			const damp = Math.exp(-(rec.has(f) ? 3.2 : 2.2) * H);
			f.vx *= damp; f.vy *= damp;
			const sp = Math.hypot(f.vx, f.vy);
			if (sp > 520) { f.vx *= 520 / sp; f.vy *= 520 / sp; }
			f.x += f.vx * H; f.y += f.vy * H;
		}
		if (Math.floor(t * 30) !== Math.floor((t - H) * 30)) {
			for (const f of flies) {
				f.trail.unshift({ x: f.x, y: f.y });
				if (f.trail.length > 9) f.trail.pop();
			}
		}
	};
	const lp = sleepyLoop((dt) => {
		acc = Math.min(acc + dt, 0.1);
		while (acc >= H) { sub(); acc -= H; }
		pt.settle(dt);
		draw();
		if (!reduced) return true; // ambient blink + wander (20-30fps loop, paused when hidden)
		return flies.some((f) => Math.hypot(f.vx, f.vy) > 2 || f.lure > 0.02) || t - lastMove < 2;
	}, { fps: reduced ? 60 : 24, d });
	lp.wake();
	return { wake: lp.wake };
}
