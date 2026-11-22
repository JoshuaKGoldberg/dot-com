// #270 Contour Corner: fine topographic contour lines of a mountain in the bottom-right
// corner, with the aurora as faint hatching strokes that lean toward the cursor.
import { rng, trackPointer, visibleLoop, sizeCanvas, AURORA, rgba, idle } from "./_quiet-c/kit.js";

const S = 230; // CSS px square
const N = 64; // grid resolution

// Height field: a main peak, a shoulder and a small knoll, in [0,1] units.
function field() {
	const r = rng(270);
	const bumps = [
		[0.62, 0.66, 0.3, 1.0],
		[0.4, 0.82, 0.22, 0.55],
		[0.86, 0.45, 0.17, 0.4],
		[0.2, 0.6, 0.14, 0.25],
	].map(([x, y, s, a]) => [x + (r() - 0.5) * 0.03, y + (r() - 0.5) * 0.03, s, a]);
	const g = new Float32Array((N + 1) * (N + 1));
	for (let j = 0; j <= N; j++)
		for (let i = 0; i <= N; i++) {
			const x = i / N;
			const y = j / N;
			let h = 0;
			for (const [bx, by, s, a] of bumps) {
				// Slightly anisotropic so contours aren't perfect circles.
				const dx = (x - bx) / s;
				const dy = (y - by) / (s * 0.85);
				h += a * Math.exp(-(dx * dx + dy * dy));
			}
			h += 0.03 * Math.sin(x * 9 + y * 5) + 0.02 * Math.sin(x * 21 - y * 13);
			g[j * (N + 1) + i] = h;
		}
	return g;
}

// Marching squares -> list of segments for one level.
function contour(g, level) {
	let d = "";
	const W = N + 1;
	const k = S / N;
	const lerp = (a, b) => (level - a) / (b - a);
	for (let j = 0; j < N; j++)
		for (let i = 0; i < N; i++) {
			const a = g[j * W + i];
			const b = g[j * W + i + 1];
			const c = g[(j + 1) * W + i + 1];
			const e = g[(j + 1) * W + i];
			const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (e > level ? 1 : 0);
			if (idx === 0 || idx === 15) continue;
			const top = [(i + lerp(a, b)) * k, j * k];
			const right = [(i + 1) * k, (j + lerp(b, c)) * k];
			const bottom = [(i + lerp(e, c)) * k, (j + 1) * k];
			const left = [i * k, (j + lerp(a, e)) * k];
			const segs = {
				1: [left, bottom], 2: [bottom, right], 3: [left, right], 4: [top, right],
				5: [top, left, bottom, right], 6: [top, bottom], 7: [top, left],
				8: [top, left], 9: [top, bottom], 10: [top, right, left, bottom],
				11: [top, right], 12: [left, right], 13: [bottom, right], 14: [left, bottom],
			}[idx];
			for (let s = 0; s < segs.length; s += 2)
				d += `M${segs[s][0].toFixed(1)} ${segs[s][1].toFixed(1)}L${segs[s + 1][0].toFixed(1)} ${segs[s + 1][1].toFixed(1)}`;
		}
	return d;
}

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const pal = dark ? AURORA.dark : AURORA.light;
	const host = root.querySelector(".scenery-b") ?? root;

	const wrap = document.createElement("div");
	wrap.className = "qa-contour";
	wrap.setAttribute("aria-hidden", "true");
	const g = field();
	let paths = "";
	for (let l = 0; l < 11; l++) {
		const level = 0.1 + l * 0.095;
		const idx = l % 5 === 4 ? " qa-contour-index" : "";
		paths += `<path class="qa-contour-line${idx}" style="--i:${l}" d="${contour(g, level)}"/>`;
	}
	wrap.innerHTML = `<canvas class="qa-contour-sky"></canvas><svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${paths}</svg>`;
	host.append(wrap);
	const canvas = wrap.querySelector("canvas");
	requestAnimationFrame(() => wrap.classList.add("is-in"));

	let stop = () => {};
	const cancelIdle = idle(() => {
		const ctx = sizeCanvas(canvas, S, S * 0.62, 0.75);
		const ptr = trackPointer();
		const W = S;
		const Hh = S * 0.62;
		const r = rng(7);
		// A fixed set of short hatch strokes in the sky above the summit.
		const strokes = Array.from({ length: 46 }, (_, i) => ({
			x: 14 + r() * (W - 28),
			y: 10 + r() * (Hh - 14),
			len: 10 + r() * 18,
			ph: r() * 6.28,
			c: pal[i % 3],
		}));
		let lean = 0.35;
		const paint = (t) => {
			ctx.clearRect(0, 0, W, Hh);
			const rect = wrap.getBoundingClientRect();
			let target = 0.35; // default: slightly slanted
			if (ptr.seen) {
				const dx = ptr.x - (rect.left + W / 2);
				const dy = ptr.y - (rect.top + Hh);
				target = Math.max(-1.2, Math.min(1.2, dx / 500)) * 0.9 + 0.15;
				void dy;
			}
			lean += (target - lean) * 0.07;
			const e = 0.6 + ptr.energy * 0.6;
			ctx.lineWidth = 0.9;
			ctx.lineCap = "round";
			for (const s of strokes) {
				const breathe = 0.5 + 0.5 * Math.sin(t * 0.35 + s.ph);
				const fall = 1 - s.y / Hh * 0.5; // a little stronger higher up
				const a = (dark ? 0.34 : 0.3) * breathe * e * fall;
				ctx.strokeStyle = rgba(s.c, a);
				const dx = lean * s.len * 0.9;
				ctx.beginPath();
				ctx.moveTo(s.x - dx / 2, s.y + s.len / 2);
				ctx.lineTo(s.x + dx / 2, s.y - s.len / 2);
				ctx.stroke();
			}
		};
		paint(0);
		if (reducedMotion) {
			stop = ptr.stop;
			return;
		}
		const loop = visibleLoop(wrap, {
			fps: 20,
			draw(dt, t) {
				ptr.decay(dt);
				paint(t);
			},
		});
		stop = () => {
			loop.stop();
			ptr.stop();
		};
	});

	return () => {
		cancelIdle();
		stop();
		wrap.remove();
	};
}
