// #271 Gutter Fireflies: a handful of fireflies live only in the side gutters (dark mode),
// and drift toward the cursor when it wanders out there.
import { rng, noise1, trackPointer, visibleLoop, sizeCanvas, idle } from "./_quiet-c/kit.js";

const COUNT = 6; // per gutter
const MIN_GUTTER = 90;

export function activate({ root, mode, reducedMotion }) {
	if (mode !== "dark") return; // light mode: the plain site, no fireflies by day.
	const page = root.querySelector(".site-page");
	const host = root.querySelector(".site-overlay") ?? root;
	const ptr = trackPointer();
	const r = rng(271);

	const wrap = document.createElement("div");
	wrap.className = "qa-gutters";
	wrap.setAttribute("aria-hidden", "true");
	host.append(wrap);

	let gutters = []; // {canvas, ctx, x0, w, h, flies}
	let loop;
	let t0 = 0;

	const build = () => {
		wrap.replaceChildren();
		gutters = [];
		const vw = root.clientWidth;
		const vh = root.clientHeight;
		const pr = page.getBoundingClientRect();
		const left = pr.left + 24; // page padding
		const right = vw - (pr.right - 24);
		const content = Math.min(vw, 832) ; void content;
		for (const side of ["l", "r"]) {
			const w = Math.floor(Math.max(0, side === "l" ? left : right) - 10);
			if (w < MIN_GUTTER) continue;
			const canvas = document.createElement("canvas");
			canvas.className = "qa-gutter";
			canvas.style[side === "l" ? "left" : "right"] = "0";
			wrap.append(canvas);
			const ctx = sizeCanvas(canvas, w, vh, 0.75);
			const flies = Array.from({ length: COUNT }, () => ({
				hx: r() * w,
				hy: r() * vh,
				x: 0, y: 0, vx: 0, vy: 0,
				ph: r() * 100,
				rate: 0.25 + r() * 0.35,
				seed: Math.floor(r() * 1000),
			}));
			for (const f of flies) { f.x = f.hx; f.y = f.hy; }
			gutters.push({ canvas, ctx, w, h: vh, side, flies, x0: side === "l" ? 0 : vw - w });
		}
	};

	const paint = (dt, t) => {
		ptr.decay(dt);
		for (const g of gutters) {
			const { ctx, w, h, flies } = g;
			ctx.clearRect(0, 0, w, h);
			const px = ptr.x - g.x0;
			const inside = ptr.seen && px > -40 && px < w + 40;
			for (const f of flies) {
				// Wander around a home point with slow noise; gather toward the cursor when it is in the gutter.
				const wx = (noise1(t * 0.12 * f.rate * 4 + f.seed, 1) - 0.5) * 120;
				const wy = (noise1(t * 0.1 * f.rate * 4 + f.seed, 2) - 0.5) * 160;
				let tx = f.hx + wx;
				let ty = f.hy + wy;
				let pull = 0.6;
				if (inside) {
					const d = Math.hypot(px - f.x, ptr.y - f.y);
					if (d < 340) {
						const k = 0.5 + 0.5 * (1 - d / 340);
						// Hover on a loose ring so they gather but never sit on the cursor.
						const ang = f.ph + t * 0.5;
						tx = tx * (1 - k) + (px + Math.cos(ang) * 26) * k;
						ty = ty * (1 - k) + (ptr.y + Math.sin(ang) * 26) * k;
						pull = 1.1;
					}
				}
				f.vx += (tx - f.x) * 0.9 * pull * dt;
				f.vy += (ty - f.y) * 0.9 * pull * dt;
				f.vx *= 0.94;
				f.vy *= 0.94;
				f.x = Math.max(-10, Math.min(w + 10, f.x + f.vx * dt * 2.2));
				f.y += f.vy * dt * 2.2;
				// Slow blink: mostly dim, a soft glow now and then.
				const b = Math.pow(Math.max(0, Math.sin(t * f.rate + f.ph)), 3);
				const a = 0.22 + b * 0.7;
				const rad = 11 + b * 6;
				const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
				grd.addColorStop(0, `rgba(214,255,140,${a})`);
				grd.addColorStop(0.25, `rgba(190,245,120,${a * 0.35})`);
				grd.addColorStop(1, "rgba(190,245,120,0)");
				ctx.fillStyle = grd;
				ctx.fillRect(f.x - rad, f.y - rad, rad * 2, rad * 2);
			}
		}
	};

	let cancel = () => {};
	const onResize = () => {
		build();
		paint(0.016, t0);
	};

	cancel = idle(() => {
		build();
		if (!gutters.length) {
			window.addEventListener("resize", onResize);
			return;
		}
		paint(0.016, 0);
		window.addEventListener("resize", onResize);
		if (reducedMotion) return;
		loop = visibleLoop(wrap, {
			fps: 24,
			draw(dt, t) {
				t0 = t;
				paint(dt, t);
			},
		});
		// wrap has no box (children are fixed-position canvases), so observe a canvas instead.
		loop.stop();
		loop = visibleLoop(gutters[0].canvas, {
			fps: 24,
			draw(dt, t) {
				t0 = t;
				paint(dt, t);
			},
		});
	});

	return () => {
		cancel();
		loop?.stop();
		ptr.stop();
		window.removeEventListener("resize", onResize);
		wrap.remove();
	};
}
