import { createKit, cssColor } from "./cursor-kit/kit.js";

export function activate({ root, reducedMotion }) {
	const style = getComputedStyle(root);
	const base = style.getPropertyValue("--dotBase").trim();
	const hot = style.getPropertyValue("--dotColor").trim();
	const SP = 24;
	const R = 210;
	const MAG = 1.7;
	let cols = 0;
	let rows = 0;

	const kit = createKit({
		root,
		reducedMotion,
		follow: 14,
		onResize(k) {
			cols = Math.ceil(k.w / SP) + 3;
			rows = Math.ceil(k.h / SP) + 3;
		},
		draw(k) {
			const { ctx } = k;
			ctx.clearRect(0, 0, k.w, k.h);
			const cx = k.x;
			const cy = k.y;
			const buckets = [[], [], [], []];
			for (let j = -1; j < rows; j++) {
				const y0 = j * SP + SP / 2;
				for (let i = -1; i < cols; i++) {
					const x0 = i * SP + SP / 2;
					const dx = x0 - cx;
					const dy = y0 - cy;
					const r2 = (dx * dx + dy * dy) / (R * R);
					let x = x0;
					let y = y0;
					let rad = 1.25;
					let lens = 0;
					if (r2 < 1) {
						const f = 1 - r2;
						lens = f * f;
						const s = 1 + MAG * lens;
						x = cx + dx * s;
						y = cy + dy * s;
						rad = 1.25 + 2.6 * lens;
					}
					// bright ring where the lens bunches dots together
					const ring = r2 < 1.3 ? Math.exp(-Math.pow((Math.sqrt(r2) - 0.78) / 0.14, 2)) : 0;
					const level = Math.min(3, Math.floor(lens * 2.2 + ring * 1.2));
					buckets[level].push(x, y, rad + ring * 0.5);
				}
			}
			const alphas = [0.2, 0.34, 0.6, 0.85];
			for (let b = 0; b < 4; b++) {
				const arr = buckets[b];
				if (!arr.length) continue;
				ctx.fillStyle = `rgba(${b === 0 ? base : hot}, ${alphas[b]})`;
				ctx.beginPath();
				for (let n = 0; n < arr.length; n += 3) {
					ctx.moveTo(arr[n] + arr[n + 2], arr[n + 1]);
					ctx.arc(arr[n], arr[n + 1], arr[n + 2], 0, 6.2832);
				}
				ctx.fill();
			}
		},
	});
	return () => kit.destroy();
}
