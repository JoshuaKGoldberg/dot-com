// 129 — Tall Grass: a meadow strip of spring-driven blades (2D canvas, batched paths) that bends away from the cursor.
import { createLoop, mountCanvas, trackPointer, rng } from "./kit-126-135/kit.js";

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".overlay-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { maxDpr: 1.5, type: "2d", opts: { alpha: true } });
	const ctx = view.ctx;
	let blades = [];
	let loop = null;
	let gust = 0;
	let gustT = 0;
	const palettes = dark
		? ["#1a3a3f", "#20474a", "#2a5a55", "#33695c", "#3d7a63", "#6aa88a"]
		: ["#9db98a", "#8fb07f", "#7fa673", "#6f9a68", "#a9c294", "#c3d4a3"];
	const GH = () => Math.min(view.cssH * 0.34, 300);
	const build = () => {
		const r = rng(11);
		const n = Math.round(view.cssW / 4.2);
		blades = [];
		for (let i = 0; i < n; i++) {
			const layerIdx = r() < 0.55 ? 0 : r() < 0.6 ? 1 : 2;
			const depth = [0.62, 0.82, 1][layerIdx];
			// heights fade toward the page centre so the prose stays clear
			const x = (i + r()) * (view.cssW / n);
			const edge = Math.abs(x - view.cssW / 2) / (view.cssW / 2);
			const hMul = 0.35 + 0.65 * Math.pow(edge, 0.8);
			blades.push({
				x,
				h: (40 + r() * 0.9 * GH()) * depth * hMul,
				w: 2.2 + r() * 2.2,
				a: (r() - 0.5) * 0.25, // rest lean
				th: 0,
				v: 0,
				ph: r() * 6.28,
				c: Math.min(5, Math.floor(r() * 6)),
				layer: layerIdx,
			});
		}
		blades.sort((a, b) => a.layer - b.layer);
	};
	const draw = () => {
		ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
		ctx.clearRect(0, 0, view.cssW, view.cssH);
		const base = view.cssH + 2;
		const buckets = new Map();
		for (const b of blades) {
			const key = b.layer * 6 + b.c;
			let path = buckets.get(key);
			if (!path) buckets.set(key, (path = new Path2D()));
			const ang = b.a + b.th;
			const tx = b.x + Math.sin(ang) * b.h;
			const ty = base - Math.cos(ang) * b.h;
			const mx = b.x + Math.sin(ang * 0.35) * b.h * 0.5;
			const my = base - b.h * 0.5;
			path.moveTo(b.x - b.w / 2, base);
			path.quadraticCurveTo(mx - b.w * 0.3, my, tx, ty);
			path.quadraticCurveTo(mx + b.w * 0.4, my, b.x + b.w / 2, base);
		}
		const keys = [...buckets.keys()].sort((a, b) => a - b);
		for (const k of keys) {
			ctx.globalAlpha = [0.55, 0.75, 0.95][Math.floor(k / 6)];
			ctx.fillStyle = palettes[k % 6];
			ctx.fill(buckets.get(k));
		}
		ctx.globalAlpha = 1;
	};
	view.onResize = () => {
		build();
		draw();
	};
	view.onResize();
	if (reducedMotion) {
		return () => view.destroy();
	}
	const ptr = { x: -999, y: -999, vx: 0, vy: 0, on: false };
	let lastActive = 0;
	const tracker = trackPointer(layer, {
		onMove(p) {
			ptr.x = p.x;
			ptr.y = p.y;
			ptr.vx = p.vx;
			ptr.on = true;
			lastActive = performance.now();
			loop.wake();
		},
		onLeave() {
			ptr.on = false;
		},
	});
	const gustTimer = setInterval(() => {
		if (document.hidden) return;
		gust = 0.0001;
		gustT = 0;
		lastActive = performance.now() - 8500;
		loop.wake();
	}, 11000);
	let t = 0;
	loop = createLoop((dt, now) => {
		t += dt;
		const base = view.cssH;
		let energy = 0;
		if (gust) {
			gustT += dt;
			if (gustT > 3) gust = 0;
		}
		for (const b of blades) {
			// target lean: wind gust plus cursor push
			let target = 0;
			if (gust) {
				const front = (gustT * 520 - b.x) / 380;
				if (front > 0 && front < 2) target += 0.12 * Math.sin(front * Math.PI * 0.5) * Math.max(0, 1 - front / 2);
			}
			if (ptr.on) {
				const dx = b.x - ptr.x;
				const dy = base - b.h * 0.6 - ptr.y;
				const d2 = dx * dx + dy * dy;
				const R = 150;
				if (d2 < R * R) {
					const f = 1 - Math.sqrt(d2) / R;
					target += Math.sign(dx || 1) * f * f * 0.9 + ptr.vx * 0.012 * f;
				}
			}
			const k = 38;
			const c = 5.2;
			b.v += (k * (target - b.th) - c * b.v) * dt;
			b.th += b.v * dt;
			energy += Math.abs(b.v) + Math.abs(b.th - 0) * 0.2;
		}
		draw();
		ptr.vx *= 0.8;
		return ptr.on ? true : energy > 0.08 || gust > 0;
	});
	return () => {
		loop.stop();
		clearInterval(gustTimer);
		tracker.destroy();
		view.destroy();
	};
}
