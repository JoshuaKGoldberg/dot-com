// 16 — Contour Survey: marching squares over drifting 3D Perlin noise.
const CELL = 8; // css px per grid cell
const LEVELS = 28;
const INDEX_EVERY = 5;
const PERIOD_SECONDS = 300;

function makePerlin(seed) {
	const p = new Uint8Array(512);
	const base = Array.from({ length: 256 }, (_, i) => i);
	let s = seed;
	for (let i = 255; i > 0; i--) {
		s = (s * 1664525 + 1013904223) >>> 0;
		const j = s % (i + 1);
		[base[i], base[j]] = [base[j], base[i]];
	}
	for (let i = 0; i < 512; i++) p[i] = base[i & 255];
	const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
	const lerp = (a, b, t) => a + (b - a) * t;
	const grad = (h, x, y, z) => {
		const u = (h & 15) < 8 ? x : y;
		const v = (h & 15) < 4 ? y : (h & 15) === 12 || (h & 15) === 14 ? x : z;
		return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
	};
	return (x, y, z) => {
		const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
		x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
		const u = fade(x), v = fade(y), w = fade(z);
		const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
		const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
		return lerp(
			lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
			lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
			w,
		);
	};
}

export function activate({ root, mode, reducedMotion }) {
	const scenery = root.querySelector(".scenery-a");
	if (!scenery) return;
	const canvas = document.createElement("canvas");
	canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
	scenery.append(canvas);
	const ctx = canvas.getContext("2d");
	const noise = makePerlin(1887);
	const dark = mode === "dark";
	const lineColor = dark ? "rgba(205, 222, 240, A)" : "rgba(72, 92, 62, A)";
	const color = (a) => lineColor.replace("A", a);

	let width = 0, height = 0, dpr = 1, cols = 0, rows = 0, grid = new Float32Array(0);
	let raf = 0, last = 0, startTime = performance.now();

	const resize = () => {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		cols = Math.ceil(width / CELL) + 2;
		rows = Math.ceil(height / CELL) + 2;
		grid = new Float32Array(cols * rows);
	};

	const draw = (seconds) => {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);
		const z = (seconds / PERIOD_SECONDS) * 1.4 + 3.1;
		const scale = 1 / 230;
		let min = Infinity, max = -Infinity;
		for (let j = 0; j < rows; j++) {
			for (let i = 0; i < cols; i++) {
				const x = i * CELL * scale, y = j * CELL * scale;
				const v = noise(x, y, z) * 0.62 + noise(x * 2.1 + 7, y * 2.1 + 3, z * 1.4) * 0.28 + noise(x * 4.3 + 1, y * 4.3 + 9, z * 2) * 0.1;
				grid[j * cols + i] = v;
				if (v < min) min = v;
				if (v > max) max = v;
			}
		}
		// Fixed range so lines don't rescale as the terrain breathes.
		min = -0.62; max = 0.62;
		const step = (max - min) / LEVELS;
		const labels = [];
		const binSize = 300;
		const anchors = new Map();

		for (let level = 1; level < LEVELS; level++) {
			const iso = min + level * step;
			const isIndex = level % INDEX_EVERY === 0;
			ctx.beginPath();
			for (let j = 0; j < rows - 1; j++) {
				for (let i = 0; i < cols - 1; i++) {
					const a = grid[j * cols + i], b = grid[j * cols + i + 1];
					const c = grid[(j + 1) * cols + i + 1], d = grid[(j + 1) * cols + i];
					let idx = 0;
					if (a > iso) idx |= 1;
					if (b > iso) idx |= 2;
					if (c > iso) idx |= 4;
					if (d > iso) idx |= 8;
					if (idx === 0 || idx === 15) continue;
					const x0 = i * CELL, y0 = j * CELL;
					const top = [x0 + CELL * ((iso - a) / (b - a)), y0];
					const right = [x0 + CELL, y0 + CELL * ((iso - b) / (c - b))];
					const bottom = [x0 + CELL * ((iso - d) / (c - d)), y0 + CELL];
					const left = [x0, y0 + CELL * ((iso - a) / (d - a))];
					const segs = {
						1: [[left, top]], 2: [[top, right]], 3: [[left, right]], 4: [[right, bottom]],
						5: [[left, top], [right, bottom]], 6: [[top, bottom]], 7: [[left, bottom]],
						8: [[left, bottom]], 9: [[top, bottom]], 10: [[top, right], [left, bottom]],
						11: [[right, bottom]], 12: [[left, right]], 13: [[top, right]], 14: [[left, top]],
					}[idx];
					for (const [p, q] of segs) {
						ctx.moveTo(p[0], p[1]);
						ctx.lineTo(q[0], q[1]);
						if (isIndex) {
							const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
							const bx = Math.floor(mx / binSize), by = Math.floor(my / binSize);
							const key = bx + "," + by;
							// Anchor sits at the bin's centre; keep the nearest index segment.
							const ax = (bx + 0.5) * binSize, ay = (by + 0.5) * binSize;
							const dist = (mx - ax) ** 2 + (my - ay) ** 2;
							const cur = anchors.get(key);
							if (!cur || dist < cur.dist) {
								anchors.set(key, { dist, x: mx, y: my, angle: Math.atan2(q[1] - p[1], q[0] - p[0]), level });
							}
						}
					}
				}
			}
			ctx.lineWidth = isIndex ? 1.25 : 0.7;
			ctx.strokeStyle = color(isIndex ? (dark ? 0.2 : 0.24) : dark ? 0.1 : 0.11);
			ctx.stroke();
		}

		ctx.font = '8px "IBM Plex Mono", ui-monospace, Menlo, monospace';
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		for (const { x, y, angle, level } of anchors.values()) {
			let a = angle;
			if (a > Math.PI / 2) a -= Math.PI;
			if (a < -Math.PI / 2) a += Math.PI;
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(a);
			const text = String(100 + level * 20);
			ctx.globalCompositeOperation = "destination-out";
			ctx.fillStyle = "#000";
			ctx.fillRect(-12, -5, 24, 10);
			ctx.globalCompositeOperation = "source-over";
			ctx.fillStyle = color(dark ? 0.42 : 0.55);
			ctx.fillText(text, 0, 0.5);
			ctx.restore();
		}
	};

	const frame = (now) => {
		raf = requestAnimationFrame(frame);
		if (document.hidden || now - last < 450) return;
		last = now;
		draw((now - startTime) / 1000);
	};

	resize();
	draw(0);
	if (!reducedMotion) raf = requestAnimationFrame(frame);
	let timer;
	const onResize = () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			resize();
			draw((performance.now() - startTime) / 1000);
		}, 120);
	};
	window.addEventListener("resize", onResize);
	return () => {
		cancelAnimationFrame(raf);
		clearTimeout(timer);
		window.removeEventListener("resize", onResize);
	};
}
