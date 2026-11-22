import { createKit, mulberry } from "./cursor-kit/kit.js";

export function activate({ root, reducedMotion }) {
	const style = getComputedStyle(root);
	const cool = style.getPropertyValue("--starRgb").trim();
	const warm = style.getPropertyValue("--starWarm").trim();
	const dark = document.documentElement.classList.contains("dark");
	// depth: 0 far .. 1 near
	let stars = [];
	let streak = 0;

	function build(k) {
		const rnd = mulberry(11);
		const n = Math.min(420, Math.round((k.w * k.h) / 2800));
		stars = [];
		for (let i = 0; i < n; i++) {
			const z = Math.pow(rnd(), 1.8);
			stars.push({
				x: rnd() * (k.w + 240) - 120,
				y: rnd() * (k.h + 240) - 120,
				z,
				r: 0.4 + z * 1.5 + rnd() * 0.3,
				a: (dark ? 0.35 : 0.3) + z * 0.55,
				warm: rnd() < 0.18,
				tw: rnd() * 6.28,
			});
		}
	}

	const kit = createKit({
		root,
		reducedMotion,
		follow: 9,
		rest: [0.62, 0.4],
		onResize: build,
		step(k, dt) {
			const target = reducedMotion ? 0 : Math.min(1, k.speed / 1800);
			streak += (target - streak) * (1 - Math.exp(-dt * 10));
			if (streak < 0.003) streak = 0;
			return streak > 0;
		},
		draw(k) {
			const { ctx } = k;
			ctx.clearRect(0, 0, k.w, k.h);
			const ox = (k.x / k.w - 0.5) * -70;
			const oy = (k.y / k.h - 0.5) * -70;
			const sp = Math.hypot(k.vx, k.vy) || 1;
			const dx = k.vx / sp;
			const dy = k.vy / sp;
			ctx.lineCap = "round";
			for (const s of stars) {
				const px = s.x + ox * (0.15 + s.z * 1.6);
				const py = s.y + oy * (0.15 + s.z * 1.6);
				const x = ((((px + 120) % (k.w + 240)) + k.w + 240) % (k.w + 240)) - 120;
				const y = ((((py + 120) % (k.h + 240)) + k.h + 240) % (k.h + 240)) - 120;
				const col = s.warm ? warm : cool;
				ctx.fillStyle = `rgba(${col},${s.a})`;
				if (streak > 0.02 && s.z > 0.12) {
					const len = streak * (6 + s.z * 52);
					ctx.strokeStyle = `rgba(${col},${s.a * 0.6})`;
					ctx.lineWidth = s.r * 1.1;
					ctx.beginPath();
					ctx.moveTo(x, y);
					ctx.lineTo(x + dx * len, y + dy * len);
					ctx.stroke();
				}
				ctx.beginPath();
				ctx.arc(x, y, s.r, 0, 6.2832);
				ctx.fill();
				if (s.z > 0.8) {
					ctx.fillStyle = `rgba(${col},${s.a * 0.14})`;
					ctx.beginPath();
					ctx.arc(x, y, s.r * 3.2, 0, 6.2832);
					ctx.fill();
				}
			}
		},
	});
	return () => kit.destroy();
}
