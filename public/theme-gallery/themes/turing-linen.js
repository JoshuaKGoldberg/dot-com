// Gray-Scott reaction-diffusion on a small CPU grid, tinted through an OKLCH ramp.

function oklchToRgb(L, C, hDeg) {
	const h = (hDeg * Math.PI) / 180;
	const a = C * Math.cos(h);
	const b = C * Math.sin(h);
	const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const lin = [
		4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
		-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
		-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
	];
	return lin.map((v) => {
		const c = Math.min(1, Math.max(0, v));
		return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
	});
}

function mulberry32(seed) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-b");
	if (!layer) {
		return;
	}

	const W = 320;
	const aspect = Math.min(1.2, Math.max(0.4, layer.clientHeight / Math.max(1, layer.clientWidth)));
	const H = Math.round(W * aspect);
	const N = W * H;

	let A = new Float32Array(N).fill(1);
	let B = new Float32Array(N);
	let A2 = new Float32Array(N);
	let B2 = new Float32Array(N);

	const rand = mulberry32(53);
	for (let i = 0; i < 260; i++) {
		const cx = Math.floor(rand() * W);
		const cy = Math.floor(rand() * H);
		const r = 2 + Math.floor(rand() * 3);
		for (let y = -r; y <= r; y++) {
			for (let x = -r; x <= r; x++) {
				if (x * x + y * y <= r * r) {
					const idx = ((cy + y + H) % H) * W + ((cx + x + W) % W);
					B[idx] = 1;
					A[idx] = 0.3;
				}
			}
		}
	}

	const baseFeed = 0.0545;
	let feed = baseFeed;
	const kill = 0.062;
	const dark = mode === "dark";

	function step() {
		const f = feed;
		const k = kill;
		for (let y = 0; y < H; y++) {
			const up = ((y + H - 1) % H) * W;
			const row = y * W;
			const down = ((y + 1) % H) * W;
			for (let x = 0; x < W; x++) {
				const l = (x + W - 1) % W;
				const r = (x + 1) % W;
				const i = row + x;
				const a = A[i];
				const b = B[i];
				const lapA = 0.2 * (A[row + l] + A[row + r] + A[up + x] + A[down + x]) + 0.05 * (A[up + l] + A[up + r] + A[down + l] + A[down + r]) - a;
				const lapB = 0.2 * (B[row + l] + B[row + r] + B[up + x] + B[down + x]) + 0.05 * (B[up + l] + B[up + r] + B[down + l] + B[down + r]) - b;
				const reaction = a * b * b;
				A2[i] = a + lapA - reaction + f * (1 - a);
				B2[i] = b + 0.5 * lapB + reaction - (k + f) * b;
			}
		}
		[A, A2] = [A2, A];
		[B, B2] = [B2, B];
	}

	// OKLCH ramp: low contrast, hue drifting sage to linen.
	const lut = [];
	for (let i = 0; i < 256; i++) {
		const t = i / 255;
		const L = dark ? 0.2 + 0.06 * t : 0.935 - 0.055 * t;
		const C = 0.008 + 0.022 * t;
		const hue = 95 + 70 * t;
		lut.push(oklchToRgb(L, C, hue));
	}

	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;
	canvas.setAttribute("aria-hidden", "true");
	const ctx = canvas.getContext("2d");
	const image = ctx.createImageData(W, H);
	layer.append(canvas);

	function draw() {
		const d = image.data;
		for (let i = 0; i < N; i++) {
			const v = Math.min(255, Math.max(0, Math.round(B[i] * 640)));
			const c = lut[v];
			const o = i * 4;
			d[o] = c[0];
			d[o + 1] = c[1];
			d[o + 2] = c[2];
			d[o + 3] = 255;
		}
		ctx.putImageData(image, 0, 0);
	}

	for (let i = 0; i < (reducedMotion ? 1500 : 800); i++) {
		step();
	}
	draw();

	if (reducedMotion) {
		return () => canvas.remove();
	}

	function onScroll() {
		const range = Math.max(1, root.scrollHeight - root.clientHeight);
		feed = baseFeed + 0.004 * Math.sin((root.scrollTop / range) * Math.PI * 2);
	}
	root.addEventListener("scroll", onScroll, { passive: true });

	let frame = 0;
	let last = 0;
	function loop(now) {
		frame = requestAnimationFrame(loop);
		if (document.hidden || now - last < 50) {
			return;
		}
		last = now;
		step();
		step();
		draw();
	}
	frame = requestAnimationFrame(loop);

	return () => {
		cancelAnimationFrame(frame);
		root.removeEventListener("scroll", onScroll);
		canvas.remove();
	};
}
