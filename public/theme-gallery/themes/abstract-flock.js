// Abstract flock: three interwoven boid species drawn as triangles, dots, ticks and chevrons.
// They steer around text boxes, flee the cursor, gather while pressed and burst on release.
import { mountCanvas, trackPointer, createLoop, makeButton, textRects, onScrollFrame, observeSize } from "./_wild/kit.js";

const PALETTES = {
	light: ["hsl(214 82% 46%)", "hsl(188 88% 38%)", "hsl(16 88% 54%)"],
	dark: ["hsl(208 100% 72%)", "hsl(168 80% 62%)", "hsl(30 100% 68%)"],
};

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const palette = PALETTES[dark ? "dark" : "light"];

	const view = mountCanvas(layer, { context: "2d", maxDpr: 1.5, scale: 1 });
	const ctx = view.canvas.getContext("2d");

	let W = 2;
	let H = 2;
	let rects = [];
	let column = null; // soft "keep out" for the main text column on wide screens

	// ---- boid state (struct of arrays) --------------------------------------------------
	let N = 0;
	let x, y, vx, vy, species, kind, size, phase, glow;
	const CELL = 56;
	let gridW = 1;
	let gridH = 1;
	let head, next;

	function seedFlock(spread = false) {
		N = Math.round(Math.min(280, Math.max(70, (W * H) / 4200)));
		x = new Float32Array(N);
		y = new Float32Array(N);
		vx = new Float32Array(N);
		vy = new Float32Array(N);
		glow = new Float32Array(N);
		phase = new Float32Array(N);
		species = new Uint8Array(N);
		kind = new Uint8Array(N);
		size = new Float32Array(N);
		next = new Int32Array(N);
		for (let i = 0; i < N; i++) {
			species[i] = i % 3;
			kind[i] = (i * 7 + (i >> 2)) % 4;
			size[i] = 4.5 + Math.random() * 4.5;
			phase[i] = Math.random() * 6.283;
			// start in margins
			const left = Math.random() < 0.5;
			const m = column ? (left ? column.l : W - column.r) : W * 0.5;
			x[i] = spread || !column ? Math.random() * W : left ? Math.random() * Math.max(30, column.l) : column.r + Math.random() * Math.max(30, W - column.r);
			void m;
			y[i] = Math.random() * H;
			const a = Math.random() * 6.283;
			vx[i] = Math.cos(a) * 1.2;
			vy[i] = Math.sin(a) * 1.2;
		}
	}

	function measure() {
		const lr = layer.getBoundingClientRect();
		const page = root.querySelector(".site-page");
		if (page && W > 980) {
			const pr = page.getBoundingClientRect();
			column = { l: pr.left - lr.left + 40, r: pr.right - lr.left - 40 };
		} else column = null;
		rects = textRects(root, layer, 10);
	}

	function resize() {
		view.fit();
		W = view.cssW;
		H = view.cssH;
		gridW = Math.ceil(W / CELL) + 1;
		gridH = Math.ceil(H / CELL) + 1;
		head = new Int32Array(gridW * gridH);
		ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
		measure();
		const want = Math.round(Math.min(280, Math.max(70, (W * H) / 4200)));
		if (want !== N) seedFlock();
	}

	// ---- pointer ------------------------------------------------------------------------
	let held = 0; // 0..1 gather strength
	let burst = null; // {x,y,t}
	const ptr = trackPointer(layer, {
		onDown: (p, e) => {
			if (reducedMotion || e.target.closest?.("button, input")) return;
			p.holding = true;
		},
		onUp: (p) => {
			if (reducedMotion || !p.holding) return;
			p.holding = false;
			doBurst(p.x, p.y, 1);
		},
	});

	function doBurst(bx, by, power) {
		burst = { x: bx, y: by, t: 0, power };
		for (let i = 0; i < N; i++) {
			const dx = x[i] - bx;
			const dy = y[i] - by;
			const d = Math.hypot(dx, dy) + 0.001;
			if (d < 420) {
				const k = ((1 - d / 420) * 7.5 * power) / d;
				vx[i] += dx * k;
				vy[i] += dy * k;
				glow[i] = 1;
			}
		}
	}

	// ---- simulation -------------------------------------------------------------------
	const MAX_SPEED = 2.1;
	const MIN_SPEED = 0.75;
	const links = []; // [i, j] pairs for cursor-reveal links

	function step(time) {
		head.fill(-1);
		for (let i = 0; i < N; i++) {
			const cx = Math.min(gridW - 1, Math.max(0, (x[i] / CELL) | 0));
			const cy = Math.min(gridH - 1, Math.max(0, (y[i] / CELL) | 0));
			const c = cy * gridW + cx;
			next[i] = head[c];
			head[c] = i;
		}
		const hasPtr = ptr.seen && ptr.inside;
		const recent = performance.now() - ptr.lastMove < 1800;
		links.length = 0;
		for (let i = 0; i < N; i++) {
			let sx = 0, sy = 0, ax = 0, ay = 0, cxm = 0, cym = 0, na = 0, nc = 0;
			const gx = Math.min(gridW - 1, Math.max(0, (x[i] / CELL) | 0));
			const gy = Math.min(gridH - 1, Math.max(0, (y[i] / CELL) | 0));
			for (let oy = -1; oy <= 1; oy++) {
				const yy = gy + oy;
				if (yy < 0 || yy >= gridH) continue;
				for (let ox = -1; ox <= 1; ox++) {
					const xx = gx + ox;
					if (xx < 0 || xx >= gridW) continue;
					for (let j = head[yy * gridW + xx]; j !== -1; j = next[j]) {
						if (j === i) continue;
						const dx = x[j] - x[i];
						const dy = y[j] - y[i];
						const d2 = dx * dx + dy * dy;
						if (d2 > CELL * CELL) continue;
						const same = species[j] === species[i];
						if (d2 < 22 * 22) {
							const inv = 1 / (d2 + 18);
							sx -= dx * inv * (same ? 1 : 1.6);
							sy -= dy * inv * (same ? 1 : 1.6);
						}
						if (same) {
							ax += vx[j];
							ay += vy[j];
							cxm += dx;
							cym += dy;
							na++;
						}
						if (hasPtr && j > i && d2 < 48 * 48) links.push(i, j);
					}
				}
			}
			let fx = sx * 26;
			let fy = sy * 26;
			if (na) {
				fx += (ax / na - vx[i]) * 0.055 + (cxm / na) * 0.0016;
				fy += (ay / na - vy[i]) * 0.055 + (cym / na) * 0.0016;
			}
			// gentle meander so the flock never freezes into a lattice
			const w = time * 0.35 + phase[i];
			fx += Math.cos(w + y[i] * 0.004) * 0.018;
			fy += Math.sin(w * 1.1 + x[i] * 0.004) * 0.018;

			// avoid text
			for (let r = 0; r < rects.length; r++) {
				const rc = rects[r];
				const px = Math.min(Math.max(x[i], rc[0]), rc[2]);
				const py = Math.min(Math.max(y[i], rc[1]), rc[3]);
				let ox = x[i] - px;
				let oy = y[i] - py;
				const d = Math.hypot(ox, oy);
				if (d > 46) continue;
				if (d < 0.001) {
					const l = x[i] - rc[0], rr = rc[2] - x[i], t = y[i] - rc[1], b = rc[3] - y[i];
					const m = Math.min(l, rr, t, b);
					ox = m === l ? -1 : m === rr ? 1 : 0;
					oy = m === t ? -1 : m === b ? 1 : 0;
					fx += ox * 0.9;
					fy += oy * 0.9;
				} else {
					const k = (1 - d / 46) ** 2 * 0.34;
					fx += (ox / d) * k;
					fy += (oy / d) * k;
				}
			}
			if (column) {
				// soft lean toward the margins
				const mid = (column.l + column.r) / 2;
				const inside = x[i] > column.l && x[i] < column.r;
				if (inside) fx += (x[i] < mid ? -1 : 1) * 0.02;
			}

			// cursor
			if (hasPtr) {
				const dx = x[i] - ptr.x;
				const dy = y[i] - ptr.y;
				const d = Math.hypot(dx, dy) + 0.001;
				if (ptr.holding) {
					if (d < 520) {
						// gather into a swirling ring around the cursor
						const ring = 70 + (i % 5) * 16;
						const radial = (d - ring) / d;
						fx += -dx * radial * 0.0075 + (-dy / d) * 0.22;
						fy += -dy * radial * 0.0075 + (dx / d) * 0.22;
						glow[i] = Math.max(glow[i], 0.5);
					}
				} else if (d < 130) {
					const k = (1 - d / 130) ** 2 * 0.9;
					fx += (dx / d) * k;
					fy += (dy / d) * k;
				}
				void recent;
			}

			vx[i] += fx;
			vy[i] += fy;
			let sp = Math.hypot(vx[i], vy[i]) + 1e-6;
			const hi = ptr.holding ? MAX_SPEED * 1.9 : MAX_SPEED + glow[i] * 3;
			const lo = MIN_SPEED;
			const target = Math.min(hi, Math.max(lo, sp));
			vx[i] *= target / sp;
			vy[i] *= target / sp;
			x[i] += vx[i];
			y[i] += vy[i];
			if (x[i] < -12) x[i] += W + 24;
			else if (x[i] > W + 12) x[i] -= W + 24;
			if (y[i] < -12) y[i] += H + 24;
			else if (y[i] > H + 12) y[i] -= H + 24;
			glow[i] *= 0.965;
		}
	}

	// ---- drawing --------------------------------------------------------------------------
	const fadeAlpha = dark ? 0.16 : 0.2;

	function shapePath(i, s) {
		const sp = Math.hypot(vx[i], vy[i]) + 1e-6;
		const ux = vx[i] / sp;
		const uy = vy[i] / sp;
		const nx = -uy;
		const ny = ux;
		const px = x[i];
		const py = y[i];
		switch (kind[i]) {
			case 0: // triangle
				ctx.moveTo(px + ux * s * 1.25, py + uy * s * 1.25);
				ctx.lineTo(px - ux * s * 0.8 + nx * s * 0.75, py - uy * s * 0.8 + ny * s * 0.75);
				ctx.lineTo(px - ux * s * 0.8 - nx * s * 0.75, py - uy * s * 0.8 - ny * s * 0.75);
				ctx.closePath();
				break;
			case 1: // dot
				ctx.moveTo(px + s * 0.38, py);
				ctx.arc(px, py, s * 0.38, 0, 6.283);
				break;
			case 2: // tick
				ctx.moveTo(px - ux * s, py - uy * s);
				ctx.lineTo(px + ux * s, py + uy * s);
				break;
			default: // chevron
				ctx.moveTo(px - ux * s * 0.7 + nx * s * 0.8, py - uy * s * 0.7 + ny * s * 0.8);
				ctx.lineTo(px + ux * s * 0.7, py + uy * s * 0.7);
				ctx.lineTo(px - ux * s * 0.7 - nx * s * 0.8, py - uy * s * 0.7 - ny * s * 0.8);
		}
	}

	function drawBoids(baseAlpha, reveal) {
		for (let sp = 0; sp < 3; sp++) {
			const color = palette[sp];
			for (const pass of [0, 1, 2]) {
				// pass 0: filled triangles, 1: dots (fill), 2: strokes (ticks + chevrons)
				ctx.beginPath();
				let any = false;
				for (let i = sp; i < N; i += 3) {
					const k = kind[i];
					if ((pass === 0 && k !== 0) || (pass === 1 && k !== 1) || (pass === 2 && k < 2)) continue;
					const s = size[i] * (1 + glow[i] * 0.5 + reveal(i) * 0.35);
					shapePath(i, s);
					any = true;
				}
				if (!any) continue;
				ctx.globalAlpha = baseAlpha;
				if (pass === 2) {
					ctx.strokeStyle = color;
					ctx.lineWidth = 1.4;
					ctx.lineCap = "round";
					ctx.lineJoin = "round";
					ctx.stroke();
				} else {
					ctx.fillStyle = color;
					ctx.fill();
				}
			}
		}
		ctx.globalAlpha = 1;
	}

	let revealR = 0;
	function render() {
		// fade trails
		ctx.globalCompositeOperation = "destination-out";
		ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
		ctx.fillRect(0, 0, W, H);
		ctx.globalCompositeOperation = dark ? "lighter" : "source-over";

		const hasPtr = ptr.seen && ptr.inside;
		const target = ptr.holding ? 1 : hasPtr && performance.now() - ptr.lastMove < 2500 ? 0.7 : 0;
		revealR += (target - revealR) * 0.06;

		const reveal = (i) => {
			if (revealR < 0.02) return 0;
			const d = Math.hypot(x[i] - ptr.x, y[i] - ptr.y);
			return revealR * Math.max(0, 1 - d / 280);
		};

		// links: constellation threads near the cursor
		if (revealR > 0.03 && links.length) {
			ctx.lineWidth = 0.8;
			for (let s = 0; s < 3; s++) {
				ctx.strokeStyle = palette[s];
				ctx.beginPath();
				for (let k = 0; k < links.length; k += 2) {
					const i = links[k];
					const j = links[k + 1];
					if (species[i] !== s || species[j] !== s) continue;
					const d = Math.hypot((x[i] + x[j]) / 2 - ptr.x, (y[i] + y[j]) / 2 - ptr.y);
					if (d > 280) continue;
					ctx.moveTo(x[i], y[i]);
					ctx.lineTo(x[j], y[j]);
				}
				ctx.globalAlpha = Math.min(0.75, revealR * (dark ? 0.7 : 0.55));
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
		}

		// base layer is subtle; shapes near the cursor are drawn a second time at full strength
		drawBoids(dark ? 0.34 : 0.4, reveal);
		if (revealR > 0.05) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(ptr.x, ptr.y, 280, 0, 6.283);
			ctx.clip();
			drawBoids(Math.min(1, revealR * 0.75), reveal);
			ctx.restore();
		}

		if (burst) {
			burst.t += 1;
			const k = burst.t / 40;
			if (k >= 1) burst = null;
			else {
				ctx.globalCompositeOperation = "source-over";
				ctx.lineWidth = 1.5;
				ctx.strokeStyle = palette[0];
				ctx.globalAlpha = (1 - k) * 0.6;
				ctx.beginPath();
				ctx.arc(burst.x, burst.y, 14 + k * 360 * burst.power, 0, 6.283);
				ctx.stroke();
				ctx.globalAlpha = 1;
			}
		}
		ctx.globalCompositeOperation = "source-over";
	}

	// ---- static (reduced motion) --------------------------------------------------------
	function renderStatic() {
		ctx.clearRect(0, 0, W, H);
		seedFlock(true);
		for (let s = 0; s < 260; s++) step(s * 0.016);
		// trails: re-run recording the last stretch
		ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
		const trail = [];
		for (let s = 0; s < 22; s++) {
			step(5 + s * 0.016);
			trail.push([Array.from(x), Array.from(y)]);
		}
		for (let sp = 0; sp < 3; sp++) {
			ctx.strokeStyle = palette[sp];
			ctx.lineWidth = 1;
			ctx.globalAlpha = 0.3;
			ctx.beginPath();
			for (let i = sp; i < N; i += 3) {
				ctx.moveTo(trail[0][0][i], trail[0][1][i]);
				for (let s = 1; s < trail.length; s++) ctx.lineTo(trail[s][0][i], trail[s][1][i]);
			}
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
		drawBoids(dark ? 0.55 : 0.6, () => 0);
		ctx.globalCompositeOperation = "source-over";
	}

	// ---- boot ---------------------------------------------------------------------------
	resize();
	seedFlock();

	const button = makeButton(root, reducedMotion ? "reshuffle flock" : "scatter · or hold anywhere to gather", { title: "Hold the pointer to gather the flock, release to burst it apart" });
	let loop = null;
	if (reducedMotion) {
		renderStatic();
		button.addEventListener("click", renderStatic);
	} else {
		for (let s = 0; s < 120; s++) step(s * 0.016);
		button.addEventListener("click", () => doBurst(W * 0.5, H * 0.5, 1.6));
		let acc = 0;
		loop = createLoop(
			(dt, t) => {
				acc += Math.min(dt, 0.05);
				let n = 0;
				while (acc >= 1 / 60 && n < 3) {
					step(t);
					acc -= 1 / 60;
					n++;
				}
				render();
			},
			{ maxDt: 0.05 },
		);
	}

	const stopScroll = onScrollFrame(root, measure);
	const stopSize = observeSize(layer, () => {
		resize();
		if (reducedMotion) renderStatic();
	});

	return () => {
		loop?.stop();
		stopScroll();
		stopSize();
		ptr.destroy();
		view.destroy();
		button.remove();
	};
}
