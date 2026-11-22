import { createKit, mulberry } from "./cursor-kit/kit.js";

export function activate({ root, reducedMotion }) {
	const dark = document.documentElement.classList.contains("dark");
	const S = 62;
	const GAP = 5;
	const RT = 105;
	const DUR = 0.5;
	const HOLD = 1.5;
	let tiles = [];
	let cols = 0;
	let rows = 0;
	let now = 0;

	function build(k) {
		const rnd = mulberry(3);
		cols = Math.ceil(k.w / S) + 1;
		rows = Math.ceil(k.h / S) + 1;
		tiles = [];
		for (let j = 0; j < rows; j++) {
			for (let i = 0; i < cols; i++) {
				const cx = i * S + S / 2;
				const cy = j * S + S / 2;
				const d = Math.hypot(cx - k.x, cy - k.y);
				const inBlob = d < 230 * (0.55 + rnd() * 0.5);
				tiles.push({
					cx,
					cy,
					p: inBlob ? 1 : 0,
					target: inBlob ? 1 : 0,
					near: inBlob ? 0 : -99,
					delay: rnd() * 0.1,
					hue: 205 + 130 * (cx / k.w) + 40 * (cy / k.h) + rnd() * 14,
					front: rnd(),
				});
			}
		}
	}

	const kit = createKit({
		root,
		reducedMotion,
		follow: 18,
		rest: [0.7, 0.36],
		onResize: build,
		step(k, dt) {
			now += dt;
			let busy = false;
			const speed = reducedMotion ? 99 : 1 / DUR;
			for (const t of tiles) {
				if (k.active) {
					const d = Math.hypot(t.cx - k.x, t.cy - k.y);
					if (d < RT) {
						t.near = now + t.delay;
						t.target = 1;
					} else if (t.target === 1 && now - t.near > HOLD + d * 0.0016 && t.near !== 0) {
						t.target = 0;
					} else if (t.target === 1 && t.near === 0 && now > HOLD) {
						t.target = 0;
					}
				}
				if (t.p !== t.target) {
					if (t.target === 1 && now < t.near) {
						busy = true;
						continue;
					}
					const step = dt * speed;
					t.p = t.target > t.p ? Math.min(1, t.p + step) : Math.max(0, t.p - step);
					busy = true;
				} else if (t.target === 1 && k.active) busy = true;
			}
			return busy;
		},
		draw(k) {
			const { ctx } = k;
			ctx.clearRect(0, 0, k.w, k.h);
			const half = (S - GAP) / 2;
			for (const t of tiles) {
				const e = t.p < 0.5 ? t.p * 2 : (t.p - 0.5) * 2;
				const flipping = t.p > 0 && t.p < 1;
				const sy = flipping ? Math.abs(Math.cos(t.p * Math.PI)) : 1;
				const back = t.p >= 0.5;
				const h = half * Math.max(0.02, sy);
				if (back) {
					const l = dark ? 42 + t.front * 6 : 84 + t.front * 4;
					const a = dark ? 0.55 : 0.7;
					ctx.fillStyle = `hsla(${t.hue},${dark ? 62 : 78}%,${l}%,${a})`;
				} else {
					ctx.fillStyle = dark
						? `rgba(190,200,255,${0.035 + t.front * 0.035})`
						: `rgba(90,90,160,${0.035 + t.front * 0.04})`;
				}
				ctx.beginPath();
				ctx.roundRect(t.cx - half, t.cy - h, half * 2, h * 2, 6 * Math.max(0.3, sy));
				ctx.fill();
				if (flipping) {
					ctx.fillStyle = `rgba(${dark ? "0,0,20" : "40,20,90"},${0.16 * (1 - sy)})`;
					ctx.fill();
				}
			}
		},
	});
	return () => kit.destroy();
}
