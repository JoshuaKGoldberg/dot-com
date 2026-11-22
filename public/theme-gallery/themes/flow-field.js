// Curl-noise particles that steer around the page's content boxes.

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

const SELECTORS = [
	".site-header .site-logo",
	".site-nav",
	".site-portrait",
	".site-title",
	".site-tagline",
	".site-socials",
	".site-about p",
	".site-section-title",
	".site-item",
	".site-footer p",
].join(",");

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) {
		return;
	}

	const dark = mode === "dark";
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	layer.append(canvas);
	const ctx = canvas.getContext("2d");

	// Analytic stream function: a sum of travelling sinusoids; curl = (dψ/dy, -dψ/dx).
	const waves = [];
	let seed = 57;
	const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	for (let i = 0; i < 7; i++) {
		const angle = rnd() * Math.PI * 2;
		const k = 0.004 + rnd() * 0.01;
		waves.push({ kx: Math.cos(angle) * k, ky: Math.sin(angle) * k, phase: rnd() * 6.28, speed: (0.15 + rnd() * 0.2) * (rnd() < 0.5 ? -1 : 1), amp: 0.006 / k });
	}

	const BUCKETS = 6;
	const colors = [];
	for (let i = 0; i < BUCKETS; i++) {
		const t = i / (BUCKETS - 1);
		const [r, g, b] = dark ? oklchToRgb(0.62 + 0.3 * t, 0.13, 262) : oklchToRgb(0.62 - 0.32 * t, 0.15, 262);
		colors.push([r, g, b]);
	}

	let width = 0;
	let height = 0;
	let count = 0;
	let px, py, age, life, bucket, fadeNear;
	let rects = [];

	function refreshRects() {
		const out = [];
		for (const node of root.querySelectorAll(SELECTORS)) {
			const r = node.getBoundingClientRect();
			const top = root.getBoundingClientRect().top;
			if (r.width < 2 || r.height < 2) {
				continue;
			}
			out.push([r.left - 8, r.top - top - 8, r.right + 8, r.bottom - top + 8]);
		}
		rects = out;
	}

	function spawn(i) {
		px[i] = Math.random() * width;
		py[i] = Math.random() * height;
		age[i] = 0;
		life[i] = 240 + Math.random() * 420;
		bucket[i] = (Math.random() * BUCKETS) | 0;
	}

	function resize() {
		width = Math.max(2, layer.clientWidth);
		height = Math.max(2, layer.clientHeight);
		canvas.width = width;
		canvas.height = height;
		const wanted = Math.min(3600, Math.max(500, Math.round((width * height) / 400)));
		if (wanted !== count) {
			count = wanted;
			px = new Float32Array(count);
			py = new Float32Array(count);
			age = new Float32Array(count);
			life = new Float32Array(count);
			bucket = new Uint8Array(count);
			fadeNear = new Float32Array(count);
			for (let i = 0; i < count; i++) {
				spawn(i);
				age[i] = Math.random() * life[i];
			}
		}
		refreshRects();
	}

	let time = 0;
	const flow = [0, 0];
	function field(x, y) {
		let dx = 0;
		let dy = 0;
		for (const w of waves) {
			const c = Math.cos(w.kx * x + w.ky * y + w.phase + w.speed * time) * w.amp;
			dy += w.kx * c * 1; // dψ/dx contributes to -dy
			dx += w.ky * c;
		}
		// ψ derivatives: curl = (dψ/dy, -dψ/dx)
		flow[0] = dx;
		flow[1] = -dy;
	}

	function advance(i, speed) {
		field(px[i], py[i]);
		const mag = Math.hypot(flow[0], flow[1]) || 1;
		const boost = 0.6 + Math.min(1.6, mag * 140);
		px[i] += (flow[0] / mag) * speed * boost;
		py[i] += (flow[1] / mag) * speed * boost;
		let near = 1;
		const R = 34;
		for (const r of rects) {
			const cx = Math.min(Math.max(px[i], r[0]), r[2]);
			const cy = Math.min(Math.max(py[i], r[1]), r[3]);
			let ox = px[i] - cx;
			let oy = py[i] - cy;
			let d = Math.hypot(ox, oy);
			if (d >= R) {
				continue;
			}
			if (d < 0.001) {
				// Inside: leave through the nearest edge.
				const l = px[i] - r[0];
				const rr = r[2] - px[i];
				const t = py[i] - r[1];
				const b = r[3] - py[i];
				const m = Math.min(l, rr, t, b);
				ox = m === l ? -1 : m === rr ? 1 : 0;
				oy = m === t ? -1 : m === b ? 1 : 0;
				d = 0;
			} else {
				ox /= d;
				oy /= d;
			}
			const push = (1 - d / R) * speed * 3.2 + (d === 0 ? speed * 3 : 0);
			px[i] += ox * push;
			py[i] += oy * push;
			near = Math.min(near, d / R);
		}
		fadeNear[i] = near;
		age[i]++;
		if (age[i] > life[i] || px[i] < -5 || py[i] < -5 || px[i] > width + 5 || py[i] > height + 5) {
			spawn(i);
		}
	}

	let frame = 0;
	let last = 0;

	function drawFrame() {
		ctx.globalCompositeOperation = "destination-out";
		ctx.fillStyle = "rgba(0,0,0,0.17)";
		ctx.fillRect(0, 0, width, height);
		ctx.globalCompositeOperation = dark ? "lighter" : "source-over";

		const lists = Array.from({ length: BUCKETS }, () => []);
		for (let i = 0; i < count; i++) {
			advance(i, 0.4);
			const fade = Math.min(1, age[i] / 40, (life[i] - age[i]) / 40) * fadeNear[i];
			if (fade > 0.35) {
				lists[bucket[i]].push(px[i], py[i]);
			}
		}

		for (let b = 0; b < BUCKETS; b++) {
			const [r, g, bl] = colors[b];
			const pts = lists[b];
			if (dark) {
				ctx.fillStyle = `rgba(${r},${g},${bl},0.07)`;
				ctx.beginPath();
				for (let j = 0; j < pts.length; j += 2) {
					ctx.rect(pts[j] - 2.2, pts[j + 1] - 2.2, 4.4, 4.4);
				}
				ctx.fill();
			}
			ctx.fillStyle = `rgba(${r},${g},${bl},${dark ? 0.6 : 0.5})`;
			ctx.beginPath();
			for (let j = 0; j < pts.length; j += 2) {
				ctx.rect(pts[j] - 0.65, pts[j + 1] - 0.65, 1.3, 1.3);
			}
			ctx.fill();
		}
		time += 0.016;
	}

	function drawStatic() {
		// Pre-step each particle and draw its path as a faint streamline.
		ctx.clearRect(0, 0, width, height);
		ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
		ctx.lineWidth = 0.9;
		const steps = 90;
		for (let i = 0; i < count; i++) {
			age[i] = 0;
			life[i] = 1e9;
			const [r, g, b] = colors[bucket[i]];
			ctx.strokeStyle = `rgba(${r},${g},${b},${dark ? 0.4 : 0.3})`;
			ctx.beginPath();
			ctx.moveTo(px[i], py[i]);
			for (let s = 0; s < steps; s++) {
				const x0 = px[i];
				const y0 = py[i];
				advance(i, 2);
				if (fadeNear[i] < 0.55 || Math.hypot(px[i] - x0, py[i] - y0) > 8) {
					break;
				}
				ctx.lineTo(px[i], py[i]);
			}
			ctx.stroke();
		}
	}

	resize();

	if (reducedMotion) {
		time = 3;
		drawStatic();
		const observer = new ResizeObserver(() => {
			resize();
			time = 3;
			drawStatic();
		});
		observer.observe(layer);
		return () => {
			observer.disconnect();
			canvas.remove();
		};
	}

	// Warm up so streaks exist on first paint.
	for (let w = 0; w < 50; w++) {
		drawFrame();
	}

	function loop(now) {
		frame = requestAnimationFrame(loop);
		if (document.hidden || now - last < 33) {
			return;
		}
		last = now;
		drawFrame();
	}
	frame = requestAnimationFrame(loop);

	let rectTimer = 0;
	const onScroll = () => {
		if (!rectTimer) {
			rectTimer = requestAnimationFrame(() => {
				rectTimer = 0;
				refreshRects();
			});
		}
	};
	root.addEventListener("scroll", onScroll, { passive: true });
	const observer = new ResizeObserver(resize);
	observer.observe(layer);

	return () => {
		cancelAnimationFrame(frame);
		cancelAnimationFrame(rectTimer);
		root.removeEventListener("scroll", onScroll);
		observer.disconnect();
		canvas.remove();
	};
}
