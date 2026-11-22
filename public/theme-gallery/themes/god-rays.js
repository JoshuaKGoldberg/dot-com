import { createKit, mulberry } from "./cursor-kit/kit.js";

export function activate({ root, reducedMotion }) {
	const dark = document.documentElement.classList.contains("dark");
	const SEL = ".site-title, .site-tagline, .site-section-title, .site-item, .site-portrait img";
	let rects = [];
	const rnd = mulberry(21);
	const stops = [];
	{
		const N = 46;
		let a = 0;
		for (let i = 0; i < N; i++) {
			a += (1 / N) * (0.4 + rnd() * 1.2);
			stops.push([a % 1, 0.015 + rnd() * 0.018, 0.25 + rnd() * 0.75]);
		}
		stops.sort((p, q) => p[0] - q[0]);
	}
	const rayRgb = dark ? "255,200,120" : "255,184,90";
	const rayA = dark ? 0.2 : 0.3;

	function measureRects(k) {
		rects = [];
		for (const el of root.querySelectorAll(SEL)) {
			const r = el.getBoundingClientRect();
			if (r.bottom < k.oy - 50 || r.top > k.oy + k.h + 50 || r.width < 4) continue;
			const pad = el.matches(".site-item") ? 6 : 2;
			rects.push([r.left - k.ox - pad, r.top - k.oy - pad, r.right - k.ox + pad, r.bottom - k.oy + pad]);
		}
	}

	function hull(pts) {
		pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
		const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
		const lower = [];
		for (const p of pts) {
			while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
			lower.push(p);
		}
		const upper = [];
		for (let i = pts.length - 1; i >= 0; i--) {
			const p = pts[i];
			while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
			upper.push(p);
		}
		lower.pop();
		upper.pop();
		return lower.concat(upper);
	}

	function poly(ctx, pts) {
		ctx.beginPath();
		ctx.moveTo(pts[0][0], pts[0][1]);
		for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
		ctx.closePath();
	}

	const kit = createKit({
		root,
		reducedMotion,
		scale: 0.6,
		follow: 9,
		rest: [0.8, 0.14],
		onResize: measureRects,
		onScroll: measureRects,
		draw(k) {
			const { ctx } = k;
			const lx = k.x;
			const ly = k.y;
			const reach = Math.hypot(Math.max(lx, k.w - lx), Math.max(ly, k.h - ly)) * 1.05;
			ctx.globalCompositeOperation = "source-over";
			ctx.clearRect(0, 0, k.w, k.h);

			// rays
			const cg = ctx.createConicGradient(-0.35, lx, ly);
			cg.addColorStop(0, `rgba(${rayRgb},0)`);
			for (const [o, w, s] of stops) {
				cg.addColorStop(Math.max(0.0001, o - w), `rgba(${rayRgb},0)`);
				cg.addColorStop(o, `rgba(${rayRgb},${rayA * s})`);
				cg.addColorStop(Math.min(0.9999, o + w), `rgba(${rayRgb},0)`);
			}
			cg.addColorStop(1, `rgba(${rayRgb},0)`);
			ctx.fillStyle = cg;
			ctx.fillRect(0, 0, k.w, k.h);
			ctx.globalCompositeOperation = "destination-in";
			let g = ctx.createRadialGradient(lx, ly, 0, lx, ly, reach);
			g.addColorStop(0, "rgba(0,0,0,1)");
			g.addColorStop(0.5, "rgba(0,0,0,0.55)");
			g.addColorStop(1, "rgba(0,0,0,0)");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, k.w, k.h);
			ctx.globalCompositeOperation = "source-over";

			// glow
			g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 300);
			g.addColorStop(0, dark ? "rgba(255,214,150,0.5)" : "rgba(255,226,170,0.85)");
			g.addColorStop(0.25, dark ? "rgba(255,190,110,0.18)" : "rgba(255,210,140,0.35)");
			g.addColorStop(1, "rgba(255,190,110,0)");
			ctx.fillStyle = g;
			ctx.fillRect(lx - 300, ly - 300, 600, 600);

			// blockers: carve rays, then lay a soft (3-pass penumbra) shadow
			const passes = [
				[0, 0.34],
				[6, 0.24],
				[13, 0.18],
				[21, 0.14],
				[30, 0.1],
			];
			for (const [bx0, by0, bx1, by1] of rects) {
				if (lx > bx0 - 4 && lx < bx1 + 4 && ly > by0 - 4 && ly < by1 + 4) continue;
				const cx = (bx0 + bx1) / 2;
				const cy = (by0 + by1) / 2;
				const dx = cx - lx;
				const dy = cy - ly;
				const dist = Math.hypot(dx, dy) || 1;
				const len = 46 + Math.min(70, (bx1 - bx0) * 0.12) + Math.min(60, dist * 0.08);
				const ux = dx / dist;
				const uy = dy / dist;
				for (const [grow, wgt] of passes) {
					const x0 = bx0 - grow;
					const y0 = by0 - grow;
					const x1 = bx1 + grow;
					const y1 = by1 + grow;
					const corners = [
						[x0, y0],
						[x1, y0],
						[x1, y1],
						[x0, y1],
					];
					const pts = corners.slice();
					for (const [px, py] of corners) {
						const ddx = px - lx;
						const ddy = py - ly;
						const dd = Math.hypot(ddx, ddy) || 1;
						pts.push([px + (ddx / dd) * (len + grow), py + (ddy / dd) * (len + grow)]);
					}
					const h = hull(pts);
					const gx1 = cx + ux * (len + 40);
					const gy1 = cy + uy * (len + 40);

					ctx.globalCompositeOperation = "destination-out";
					const eg = ctx.createLinearGradient(cx, cy, gx1, gy1);
					eg.addColorStop(0, `rgba(0,0,0,${wgt * 1.1})`);
					eg.addColorStop(1, "rgba(0,0,0,0)");
					ctx.fillStyle = eg;
					poly(ctx, h);
					ctx.fill();

					ctx.globalCompositeOperation = "source-over";
					const sg = ctx.createLinearGradient(cx, cy, gx1, gy1);
					const sc = dark ? "0,0,6" : "40,50,80";
					const sa = (dark ? 0.16 : 0.1) * wgt * 1.6;
					sg.addColorStop(0, `rgba(${sc},${sa})`);
					sg.addColorStop(1, `rgba(${sc},0)`);
					ctx.fillStyle = sg;
					poly(ctx, h);
					ctx.fill();
				}
			}
		},
	});
	const timer = setTimeout(() => {
		measureRects(kit.k);
		kit.k.redraw();
	}, 500);
	return () => {
		clearTimeout(timer);
		kit.destroy();
	};
}
