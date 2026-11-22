import { createKit, mulberry } from "./cursor-kit/kit.js";

export function activate({ root, reducedMotion }) {
	const dark = document.documentElement.classList.contains("dark");
	const bands = dark
		? [
				[70, 255, 170],
				[60, 190, 255],
				[190, 110, 255],
			]
		: [
				[40, 190, 130],
				[50, 150, 220],
				[170, 100, 230],
			];
	const sprites = bands.map(([r, g, b]) => {
		const c = document.createElement("canvas");
		c.width = 1;
		c.height = 128;
		const x = c.getContext("2d");
		const gr = x.createLinearGradient(0, 0, 0, 128);
		const a = dark ? 0.62 : 0.55;
		gr.addColorStop(0, `rgba(${r},${g},${b},0)`);
		gr.addColorStop(0.55, `rgba(${r},${g},${b},${0.22 * a})`);
		gr.addColorStop(0.9, `rgba(${r},${g},${b},${0.6 * a})`);
		gr.addColorStop(0.97, `rgba(255,255,255,${0.12 * a})`);
		gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
		x.fillStyle = gr;
		x.fillRect(0, 0, 1, 128);
		return c;
	});
	const rnd = mulberry(4);
	const seeds = bands.map(() => [rnd() * 6, rnd() * 6, rnd() * 6]);
	let phase = 0.8;
	let energy = 0;
	const COL = 4;

	const kit = createKit({
		root,
		reducedMotion,
		follow: 5,
		rest: [0.66, 0.4],
		step(k, dt) {
			const target = reducedMotion ? 0 : Math.min(1, k.speed / 700);
			energy += (target - energy) * (1 - Math.exp(-dt * 3));
			if (energy < 0.01) energy = 0;
			phase += dt * energy * 1.4;
			return energy > 0;
		},
		draw(k) {
			const { ctx } = k;
			ctx.clearRect(0, 0, k.w, k.h);
			ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
			const cx = k.x;
			const cy = k.y;
			const sig = k.w * 0.17;
			const n = Math.ceil(k.w / COL) + 1;
			for (let b = 0; b < bands.length; b++) {
				const [s0, s1, s2] = seeds[b];
				const sprite = sprites[b];
				for (let i = 0; i < n; i++) {
					const x = i * COL;
					const u = x / k.w;
					const dxc = x - cx;
					const g = Math.exp(-(dxc * dxc) / (2 * sig * sig));
					let by =
						k.h * (0.2 + b * 0.055) +
						38 * Math.sin(u * 3.2 + s0 + phase * 0.55) +
						20 * Math.sin(u * 8.1 + s1 - phase * 0.8);
					by += (cy + 40 - by) * 0.4 * g;
					const hgt = 150 + 70 * Math.sin(u * 4.7 + s2 + phase * 0.4) + 190 * g;
					const px = x - dxc * 0.28 * g;
					const flick = 0.62 + 0.38 * Math.sin(u * 70 + s1 * 3 + phase * 1.7 + b);
					ctx.globalAlpha = Math.min(1, (0.5 + 0.5 * flick) * (0.55 + 0.7 * g) * (1 - 0.22 * b));
					ctx.drawImage(sprite, 0, 0, 1, 128, px, by - hgt, COL + 0.6, hgt);
				}
			}
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = "source-over";
		},
	});
	return () => kit.destroy();
}
