import { createKit, mulberry } from "./cursor-kit/kit.js";

const TAU = Math.PI * 2;

export function activate({ root, reducedMotion }) {
	const style = getComputedStyle(root);
	const lo = style.getPropertyValue("--fiberLo").trim().split(",").map(Number);
	const hi = style.getPropertyValue("--fiberHi").trim().split(",").map(Number);
	const dark = document.documentElement.classList.contains("dark");
	const BUCKETS = 6;
	const colors = Array.from({ length: BUCKETS }, (_, i) => {
		const t = i / (BUCKETS - 1);
		const c = lo.map((l, n) => Math.round(l + (hi[n] - l) * t));
		return `rgba(${c.join(",")},${(dark ? 0.14 : 0.2) + t * (dark ? 0.3 : 0.3)})`;
	});
	const LIGHT = -2.3;
	const RC = 100;
	let fibers = [];
	let prevX = null;
	let prevY = null;

	function build(k) {
		const rnd = mulberry(5);
		const n = Math.round((k.w * k.h) / 150);
		fibers = [];
		for (let i = 0; i < n; i++) {
			const x = rnd() * k.w;
			const y = rnd() * k.h;
			const flow =
				-1.1 +
				Math.sin(x * 0.006 + y * 0.004) * 0.6 +
				Math.sin(y * 0.011 - x * 0.003 + 2) * 0.35;
			const rest = flow + (rnd() - 0.5) * 0.22;
			fibers.push({ x, y, len: 5.5 + rnd() * 4.5, rest, a: rest });
		}
		prevX = null;
	}

	const kit = createKit({
		root,
		reducedMotion,
		follow: 22,
		rest: [0.7, 0.35],
		onResize: build,
		step(k, dt) {
			let busy = false;
			const relax = reducedMotion ? 0 : 1 - Math.exp(-dt * 0.35);
			const moving = prevX !== null && k.active && k.speed > 30;
			let dir = 0;
			let amount = 0;
			if (moving) {
				dir = Math.atan2(k.vy, k.vx);
				amount = Math.min(1, k.speed / 600);
			}
			for (const f of fibers) {
				let d = f.rest - f.a;
				if (moving) {
					const dx = f.x - k.x;
					const dy = f.y - k.y;
					const r2 = (dx * dx + dy * dy) / (RC * RC);
					if (r2 < 1) {
						const w = (1 - r2) * (1 - r2) * amount;
						let e = dir - f.a;
						e = Math.atan2(Math.sin(e), Math.cos(e));
						f.a += e * Math.min(1, w * 14 * dt * 4);
						busy = true;
						continue;
					}
				}
				if (Math.abs(d) > 0.004) {
					d = Math.atan2(Math.sin(d), Math.cos(d));
					f.a += d * relax;
					busy = true;
				} else f.a = f.rest;
			}
			prevX = k.x;
			prevY = k.y;
			return busy;
		},
		draw(k) {
			const { ctx } = k;
			ctx.clearRect(0, 0, k.w, k.h);
			const paths = Array.from({ length: BUCKETS }, () => []);
			for (const f of fibers) {
				const sheen = 0.5 + 0.5 * Math.cos(f.a - LIGHT);
				const b = Math.min(BUCKETS - 1, Math.floor(sheen * BUCKETS));
				paths[b].push(f);
			}
			ctx.lineCap = "round";
			ctx.lineWidth = 1;
			for (let b = 0; b < BUCKETS; b++) {
				const arr = paths[b];
				if (!arr.length) continue;
				ctx.strokeStyle = colors[b];
				ctx.beginPath();
				for (const f of arr) {
					ctx.moveTo(f.x, f.y);
					ctx.lineTo(f.x + Math.cos(f.a) * f.len, f.y + Math.sin(f.a) * f.len);
				}
				ctx.stroke();
			}
		},
	});
	return () => kit.destroy();
}
