import { isDark, trackPointer, createLoop, pixelCanvas, rampTable, clamp } from "./_quiet-b/kit.js";

const EXTENT = 1.4; // canvas half-size in portrait radii

export function activate({ root, reducedMotion }) {
	const portrait = root.querySelector(".site-portrait");
	if (!portrait) return;
	const dark = isDark();
	const color = rampTable(dark);
	const alpha = dark ? 0.5 : 0.24;
	const px = pixelCanvas(portrait, { scale: 4, style: "z-index:0;left:0;top:0;" });
	px.canvas.className = "qa-halo";
	const ptr = trackPointer(() => loop.wake());
	let bright = 0;

	const draw = (t) => {
		const r = portrait.getBoundingClientRect();
		const rad = r.width / 2;
		const css = rad * EXTENT * 2;
		px.canvas.style.width = px.canvas.style.height = css + "px";
		px.canvas.style.left = r.width / 2 - css / 2 + "px";
		px.canvas.style.top = r.height / 2 - css / 2 + "px";
		px.size(css, css);
		const n = px.w;
		let tx = 0, ty = 0, near = 0.35;
		if (ptr.has) {
			const dx = ptr.sx - (r.left + r.width / 2), dy = ptr.sy - (r.top + r.height / 2);
			const d = Math.hypot(dx, dy) || 1;
			tx = dx / d; ty = dy / d;
			near = clamp(1 - d / 900) * 0.8 + 0.2;
		}
		const e = ptr.energy;
		const lean = 0.05 * (0.4 + near) * (ptr.has ? 1 : 0);
		const ox = tx * lean, oy = ty * lean;
		const thetaC = Math.atan2(ty, tx);
		const amp = ptr.has ? 0.3 + 0.9 * near + 1.2 * e : 0.35;
		px.paint((x, y, out) => {
			const u = ((x + 0.5) / n * 2 - 1) * EXTENT - ox;
			const v = ((y + 0.5) / n * 2 - 1) * EXTENT - oy;
			const rr = Math.hypot(u, v);
			const th = Math.atan2(v, u);
			const lobe = ptr.has ? Math.max(0, Math.cos(th - thetaC)) ** 2 : 0;
			const peak = 1.05 + 0.04 * lobe * amp;
			const wd = 0.075 + 0.04 * lobe * amp;
			const ring = Math.exp(-(((rr - peak) / wd) ** 2));
			const mod = 0.5 + 0.28 * Math.sin(th * 2 + t * 0.35) + 0.22 * Math.sin(th * 3 - t * 0.5);
			color(0.5 + 0.5 * Math.sin(th + t * 0.18 + lobe * 0.8) * 0.9 + 0.0, out);
			const edge = clamp((EXTENT - rr) / 0.3);
			return ring * (0.3 + mod * 0.55 + lobe * amp * 0.9) * edge * alpha;
		});
	};

	const loop = createLoop({
		fps: 20,
		watch: [portrait],
		frame(dt, t) {
			ptr.step(dt);
			draw(reducedMotion ? 2 : t);
			return !reducedMotion || ptr.busy();
		},
	});
	draw(2);
	loop.wake();
	const ro = new ResizeObserver(() => draw(loop.t || 2));
	ro.observe(portrait);
	root.addEventListener("scroll", () => { if (ptr.has) loop.wake(); }, { passive: true });

	return () => {
		ro.disconnect();
		loop.destroy();
		ptr.destroy();
		px.remove();
	};
}
