// 17 — Halftone: one-colour 45° dot screen; dots swell toward the top-right and vanish before the text column.
const SPACING = 11; // distance between dots along the 45° lattice
const DRIFT_SECONDS = 180;

export function activate({ root, mode, reducedMotion }) {
	const scenery = root.querySelector(".scenery-a");
	if (!scenery) return;
	const canvas = document.createElement("canvas");
	canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
	scenery.append(canvas);
	const ctx = canvas.getContext("2d");
	const dark = mode === "dark";
	const fill = dark ? "rgba(236, 232, 222, 0.26)" : "rgba(30, 36, 60, 0.2)";

	let width = 0, height = 0, dpr = 1, raf = 0, last = 0;
	const t0 = performance.now();

	const resize = () => {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
	};

	const draw = (seconds) => {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = fill;
		const phase = (seconds / DRIFT_SECONDS) * Math.PI * 2;
		// the mask centre wanders in a slow Lissajous around the top-right corner
		const cx = width * (1.02 + 0.05 * Math.sin(phase)) + 0;
		const cy = height * (-0.04 + 0.08 * Math.sin(phase * 2 + 1));
		const reach = Math.min(width * 0.52, 640) * (1 + 0.06 * Math.sin(phase + 2));
		const maxR = SPACING * 0.46;
		const diag = Math.hypot(width, height);
		const n = Math.ceil(diag / SPACING) + 2;
		const c = Math.SQRT1_2;
		ctx.beginPath();
		// lattice rotated by 45°: points = origin + i*(s,s)/√2... expressed as a diamond grid
		const step = SPACING * Math.SQRT2 * c * Math.SQRT2; // = SPACING * SQRT2
		for (let j = -1; j <= Math.ceil(height / (step / 2)) + 1; j++) {
			const y = j * (step / 2);
			const offset = j % 2 ? step / 2 : 0;
			for (let x = offset; x <= width + step; x += step) {
				const d = Math.hypot(x - cx, y - cy);
				const t = 1 - d / reach;
				if (t <= 0) continue;
				const s = t * t * (3 - 2 * t);
				const r = maxR * s;
				if (r < 0.45) continue;
				ctx.moveTo(x + r, y);
				ctx.arc(x, y, r, 0, Math.PI * 2);
			}
		}
		ctx.fill();
	};

	const frame = (now) => {
		raf = requestAnimationFrame(frame);
		if (document.hidden || now - last < 120) return;
		last = now;
		draw((now - t0) / 1000);
	};

	resize();
	draw(0);
	if (!reducedMotion) raf = requestAnimationFrame(frame);
	let timer;
	const onResize = () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			resize();
			draw((performance.now() - t0) / 1000);
		}, 120);
	};
	window.addEventListener("resize", onResize);
	return () => {
		cancelAnimationFrame(raf);
		clearTimeout(timer);
		window.removeEventListener("resize", onResize);
	};
}
