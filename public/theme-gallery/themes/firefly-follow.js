// 135 — Firefly Follow: blinking fireflies wander; when the cursor rests they gather around it, when it moves they scatter.
import { createLoop, mountCanvas, trackPointer, rng } from "./kit-126-135/kit.js";

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".overlay-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { maxDpr: 1.5, type: "2d" });
	const ctx = view.ctx;
	const rgb = dark ? [214, 255, 120] : [232, 160, 20];
	const sprite = document.createElement("canvas");
	sprite.width = sprite.height = 64;
	{
		const s = sprite.getContext("2d");
		const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
		g.addColorStop(0, "rgba(255,255,235,1)");
		g.addColorStop(0.12, `rgba(${rgb},0.95)`);
		g.addColorStop(0.35, `rgba(${rgb},0.28)`);
		g.addColorStop(1, `rgba(${rgb},0)`);
		s.fillStyle = g;
		s.fillRect(0, 0, 64, 64);
	}
	let flies = [];
	let loop = null;
	const build = () => {
		const r = rng(31);
		const n = Math.max(14, Math.min(34, Math.round((view.cssW * view.cssH) / 30000)));
		flies = [];
		for (let i = 0; i < n; i++) {
			flies.push({ x: r() * view.cssW, y: view.cssH * (0.25 + 0.75 * r()), vx: 0, vy: 0, ph: r() * 6.28, bl: 0.35 + r() * 0.5, sz: 14 + r() * 14, a: r() * 6.28, orbit: 30 + r() * 70 });
		}
	};
	const draw = (t) => {
		ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
		ctx.clearRect(0, 0, view.cssW, view.cssH);
		for (const f of flies) {
			const b = reducedMotion ? 0.7 : Math.pow(Math.max(0, Math.sin(t * f.bl + f.ph)), 3) * 0.85 + 0.15;
			ctx.globalAlpha = (dark ? 0.9 : 0.75) * b;
			const s = f.sz * (0.7 + 0.3 * b);
			ctx.drawImage(sprite, f.x - s, f.y - s, s * 2, s * 2);
		}
		ctx.globalAlpha = 1;
	};
	view.onResize = () => {
		build();
		draw(2);
	};
	view.onResize();
	if (reducedMotion) return () => view.destroy();

	const ptr = { x: 0, y: 0, on: false, moved: 0, rest: 0 };
	const tracker = trackPointer(layer, {
		onMove(p) {
			ptr.x = p.x;
			ptr.y = p.y;
			ptr.on = true;
			ptr.moved = performance.now();
			ptr.v = Math.hypot(p.vx, p.vy);
			loop.wake();
		},
		onLeave() {
			ptr.on = false;
		},
	});
	let t = 2;
	loop = createLoop((dt, now) => {
		t += dt;
		const resting = ptr.on && now - ptr.moved > 700;
		const moving = ptr.on && now - ptr.moved < 250;
		for (const f of flies) {
			f.a += (Math.sin(t * 0.7 + f.ph) * 1.6) * dt;
			let ax = Math.cos(f.a) * 22 + Math.sin(t * 0.3 + f.ph * 2) * 8;
			let ay = Math.sin(f.a) * 22 - 4;
			if (resting) {
				const ang = t * 0.5 + f.ph;
				const tx = ptr.x + Math.cos(ang) * f.orbit;
				const ty = ptr.y + Math.sin(ang * 1.3) * f.orbit * 0.7;
				ax += (tx - f.x) * 1.1;
				ay += (ty - f.y) * 1.1;
			} else if (moving) {
				const dx = f.x - ptr.x;
				const dy = f.y - ptr.y;
				const d = Math.hypot(dx, dy) || 1;
				if (d < 220) {
					const k = (1 - d / 220) * 420;
					ax += (dx / d) * k;
					ay += (dy / d) * k;
				}
			}
			// stay on screen
			if (f.x < 10) ax += 60;
			if (f.x > view.cssW - 10) ax -= 60;
			if (f.y < 20) ay += 60;
			if (f.y > view.cssH - 10) ay -= 60;
			f.vx += (ax - f.vx * 2.2) * dt;
			f.vy += (ay - f.vy * 2.2) * dt;
			f.x += f.vx * dt;
			f.y += f.vy * dt;
		}
		draw(t);
		return true;
	});
	return () => {
		loop.stop();
		tracker.destroy();
		view.destroy();
	};
}
