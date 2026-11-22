import { createKit, mulberry } from "./cursor-kit/kit.js";

export function activate({ root, reducedMotion }) {
	const dark = document.documentElement.classList.contains("dark");
	const grainLayer = root.querySelector(".scenery-a");

	// baked paper grain: one small tile, reused
	const tile = document.createElement("canvas");
	tile.width = tile.height = 160;
	{
		const x = tile.getContext("2d");
		const img = x.createImageData(160, 160);
		const rnd = mulberry(8);
		for (let i = 0; i < img.data.length; i += 4) {
			const v = rnd() < 0.5 ? 0 : 255;
			img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
			img.data[i + 3] = rnd() * (dark ? 9 : 12);
		}
		x.putImageData(img, 0, 0);
	}
	const grain = document.createElement("div");
	grain.style.cssText = `position:absolute;inset:0;background:url(${tile.toDataURL()});`;
	grainLayer.append(grain);

	let flakes = [];
	function build(k) {
		const rnd = mulberry(17);
		const n = Math.min(1500, Math.round((k.w * k.h) / 800));
		flakes = Array.from({ length: n }, () => ({
			x: rnd() * k.w,
			y: rnd() * k.h,
			s: 1.4 + Math.pow(rnd(), 2.2) * 5.5,
			rot: rnd() * Math.PI,
			nx: (rnd() * 2 - 1) * 1.1,
			ny: (rnd() * 2 - 1) * 1.1,
			sq: 0.35 + rnd() * 0.5,
		}));
	}

	const kit = createKit({
		root,
		reducedMotion,
		follow: 10,
		rest: [0.7, 0.28],
		onResize: build,
		draw(k) {
			const { ctx } = k;
			ctx.clearRect(0, 0, k.w, k.h);
			const cx = k.x;
			const cy = k.y;

			// broad holographic sheen that slides with the cursor
			const a = (cx / k.w - 0.5) * 1.2 + (cy / k.h - 0.5) * 0.8;
			const L = Math.hypot(k.w, k.h) * 0.55;
			const sx = k.w / 2 + Math.cos(0.7 + a) * L;
			const sy = k.h / 2 + Math.sin(0.7 + a) * L;
			const lg = ctx.createLinearGradient(k.w - sx, k.h - sy, sx, sy);
			const alpha = dark ? 0.09 : 0.1;
			const hues = [190, 280, 330, 40, 120, 190];
			hues.forEach((h, i) => lg.addColorStop(i / (hues.length - 1), `hsla(${h},90%,${dark ? 62 : 72}%,${alpha})`));
			ctx.fillStyle = lg;
			ctx.fillRect(0, 0, k.w, k.h);

			const hs = Math.max(k.w, k.h) * 0.62;
			ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
			for (const f of flakes) {
				const hx = Math.max(-1.4, Math.min(1.4, (cx - f.x) / hs));
				const hy = Math.max(-1.4, Math.min(1.4, (cy - f.y) / hs));
				const d = (f.nx - hx) * (f.nx - hx) + (f.ny - hy) * (f.ny - hy);
				const m = Math.exp(-d / 0.11);
				const w = f.s;
				const hgt = f.s * f.sq;
				const cr = Math.cos(f.rot);
				const sr = Math.sin(f.rot);
				if (m < 0.06) {
					ctx.fillStyle = dark ? "rgba(200,190,255,0.07)" : "rgba(120,110,150,0.07)";
				} else {
					const hue = (Math.atan2(f.ny, f.nx) * 57.3 + cx * 0.18 + cy * 0.1 + 360) % 360;
					const l = dark ? 55 + m * 30 : 62 + m * 22;
					ctx.fillStyle = `hsla(${hue},95%,${l}%,${Math.min(1, 0.12 + m * 0.85)})`;
				}
				ctx.beginPath();
				ctx.moveTo(f.x + cr * w, f.y + sr * w);
				ctx.lineTo(f.x - sr * hgt, f.y + cr * hgt);
				ctx.lineTo(f.x - cr * w, f.y - sr * w);
				ctx.lineTo(f.x + sr * hgt, f.y - cr * hgt);
				ctx.closePath();
				ctx.fill();
				if (m > 0.55 && f.s > 3) {
					ctx.fillStyle = `rgba(255,255,255,${(m - 0.5) * (dark ? 0.18 : 0.3)})`;
					ctx.beginPath();
					ctx.arc(f.x, f.y, f.s * 1.6, 0, 6.2832);
					ctx.fill();
				}
			}
			ctx.globalCompositeOperation = "source-over";
		},
	});
	return () => {
		kit.destroy();
		grain.remove();
	};
}
