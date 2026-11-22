// 132 — Smoke Trail: a faint curl-noise wisp that follows the cursor, over a frozen incense wisp so a still page is never empty.
import { createLoop, mountCanvas, trackPointer, rng } from "./kit-126-135/kit.js";

const curl = (x, y, t) => {
	// analytic curl of a sum of sinusoid potentials
	const a = 0.011, b = 0.0063;
	const dx = Math.cos(x * a + t * 0.3) * Math.cos(y * a * 0.8 - t * 0.2) * a * 1.0 - Math.sin(x * b * 1.7 - t * 0.17) * Math.sin(y * b + 1.0) * b * 1.7;
	const dy = -Math.sin(x * a + t * 0.3) * Math.sin(y * a * 0.8 - t * 0.2) * a * 0.8 + Math.cos(x * b * 1.7 - t * 0.17) * Math.cos(y * b + 1.0) * b;
	return [dy * 1, -dx * 1];
};

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { maxDpr: 1.5, type: "2d" });
	const ctx = view.ctx;
	const tint = dark ? [200, 214, 236] : [86, 92, 104];
	const sprite = document.createElement("canvas");
	sprite.width = sprite.height = 64;
	{
		const s = sprite.getContext("2d");
		const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
		g.addColorStop(0, `rgba(${tint},1)`);
		g.addColorStop(0.4, `rgba(${tint},0.45)`);
		g.addColorStop(1, `rgba(${tint},0)`);
		s.fillStyle = g;
		s.fillRect(0, 0, 64, 64);
	}
	let parts = [];
	let ghost = [];
	let loop = null;
	const MAX = 360;
	const SCALE = 520; // curl field strength (px/s per unit)
	const step = (p, dt, t) => {
		const [cx, cy] = curl(p.x, p.y, t);
		p.vx += (cx * SCALE * 60 - p.vx) * dt * 1.2;
		p.vy += (cy * SCALE * 60 - p.vy - 16) * dt * 1.2;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		p.age += dt;
		p.r = p.r0 * (1 + p.age * 0.55);
	};
	const buildGhost = () => {
		const r = rng(5);
		ghost = [];
		const W = view.cssW;
		const H = view.cssH;
		const live = [];
		let t = 3;
		const ex = W > 900 ? W * 0.9 : W * 0.78;
		for (let i = 0; i < 600; i++) {
			t += 0.016;
			if (i % 2 === 0 && i < 440) live.push({ x: ex + (r() - 0.5) * 4, y: H - 6, vx: 0, vy: -60, age: 0, r0: 8 + r() * 5, r: 8, life: 9, a: 0.1 });
			for (const p of live) step(p, 0.016, t);
		}
		ghost = live.filter((p) => p.y > -40);
	};
	const draw = () => {
		ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
		ctx.clearRect(0, 0, view.cssW, view.cssH);
		for (const p of ghost) {
			const f = Math.min(1, p.age / 1.2) * Math.max(0.12, 1 - p.age / (p.life * 1.6));
			ctx.globalAlpha = (dark ? 0.2 : 0.16) * f;
			ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
		}
		for (const p of parts) {
			const f = Math.min(1, p.age / 0.5) * Math.max(0, 1 - p.age / p.life);
			ctx.globalAlpha = (dark ? 0.16 : 0.12) * f;
			ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
		}
		ctx.globalAlpha = 1;
	};
	view.onResize = () => {
		buildGhost();
		parts = [];
		draw();
	};
	view.onResize();
	if (reducedMotion) return () => view.destroy();

	let t = 3;
	let lastActive = 0;
	const emit = (x, y, vx, vy) => {
		if (parts.length >= MAX) parts.shift();
		parts.push({ x, y, vx: vx * 8, vy: vy * 8 - 10, age: 0, r0: 9 + Math.random() * 6, r: 9, life: 4.5 + Math.random() * 2 });
	};
	const tracker = trackPointer(layer, {
		onMove(p) {
			const n = Math.max(1, Math.min(12, Math.ceil(Math.hypot(p.vx, p.vy) / 3)));
			for (let i = 1; i <= n; i++) emit(p.px + (p.vx * i) / n, p.py + (p.vy * i) / n, p.vx * 0.3, p.vy * 0.3);
			lastActive = performance.now();
			loop.wake();
		},
	});
	loop = createLoop((dt) => {
		t += dt;
		for (let i = parts.length - 1; i >= 0; i--) {
			const p = parts[i];
			step(p, dt, t);
			if (p.age > p.life) parts.splice(i, 1);
		}
		draw();
		return parts.length > 0;
	});
	return () => {
		loop.stop();
		tracker.destroy();
		view.destroy();
	};
}
