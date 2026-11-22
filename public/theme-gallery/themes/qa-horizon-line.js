// #269 Horizon Line: one fine ridge line under the hero that draws itself in,
// with a sliver of aurora above it that leans toward the cursor.
import { rng, noise1, trackPointer, visibleLoop, sizeCanvas, AURORA, rgba, idle } from "./_quiet-c/kit.js";

const H = 84;

export function activate({ root, mode, reducedMotion }) {
	const hero = root.querySelector(".site-hero");
	if (!hero) return;
	const dark = mode === "dark";
	const pal = dark ? AURORA.dark : AURORA.light;

	const wrap = document.createElement("div");
	wrap.className = "qa-horizon";
	wrap.setAttribute("aria-hidden", "true");
	wrap.innerHTML = `<canvas class="qa-horizon-sky"></canvas><svg class="qa-horizon-svg" preserveAspectRatio="none" viewBox="0 0 1000 ${H}"><path class="qa-horizon-line" pathLength="1"/><path class="qa-horizon-line qa-horizon-echo" pathLength="1"/></svg>`;
	hero.after(wrap);
	const canvas = wrap.querySelector("canvas");
	const [main, echo] = wrap.querySelectorAll("path");

	// Ridge: low-frequency noise plus one gentle peak, kept in the lower 60% of the strip.
	const r = rng(269);
	const peakAt = 0.62 + r() * 0.1;
	const ridge = (x, seed, amp, base) => {
		const u = x / 1000;
		const bump = Math.exp(-Math.pow((u - peakAt) / 0.16, 2));
		return base - amp * (0.55 * noise1(u * 5, seed) + 0.25 * noise1(u * 13, seed + 7) + 0.9 * bump * (0.6 + 0.4 * noise1(u * 9, seed + 3)));
	};
	const pathFor = (seed, amp, base) => {
		let d = "";
		for (let x = 0; x <= 1000; x += 8) d += `${x ? "L" : "M"}${x} ${ridge(x, seed, amp, base).toFixed(1)}`;
		return d;
	};
	main.setAttribute("d", pathFor(3, 38, H - 6));
	echo.setAttribute("d", pathFor(11, 26, H - 2));

	let stopLoop = () => {};
	let stopPointer = () => {};
	let cancelIdle = () => {};
	let io;

	const reveal = () => wrap.classList.add("is-drawn");

	if (reducedMotion) {
		reveal();
	} else {
		io = new IntersectionObserver((es) => {
			if (es.some((e) => e.isIntersecting)) {
				setTimeout(reveal, 200);
				io.disconnect();
			}
		}, { threshold: 0.4 });
		io.observe(wrap);
	}

	cancelIdle = idle(() => {
		let w = wrap.clientWidth;
		const ph = 52;
		let ctx = sizeCanvas(canvas, w, ph, 0.5);
		const ptr = trackPointer();
		stopPointer = ptr.stop;
		let lean = 0;
		let lastT = 0;

		const paint = (t) => {
			ctx.clearRect(0, 0, w, ph);
			const rect = wrap.getBoundingClientRect();
			const target = ptr.seen ? Math.max(-1, Math.min(1, (ptr.x - (rect.left + w / 2)) / (window.innerWidth * 0.5))) : 0;
			lean += (target - lean) * 0.06;
			const e = 0.55 + ptr.energy * 0.45;
			const cols = Math.ceil(w / 6);
			for (let i = 0; i < cols; i++) {
				const u = i / cols;
				const x = i * 6 + 3;
				const band = noise1(u * 4 + t * 0.05, 5);
				const fade = Math.pow(Math.max(0, noise1(u * 6 - t * 0.03, 9) - 0.25) / 0.75, 1.2);
				// Curtain lean: columns shear toward the cursor and strengthen near it.
				const near = ptr.seen ? Math.exp(-Math.pow((rect.left + x - ptr.x) / 260, 2)) : 0;
				const hgt = ph * (0.3 + 0.55 * band) * (0.8 + 0.4 * near);
				const shear = lean * 10;
				const a = fade * (dark ? 0.2 : 0.16) * e * (1 + near * 0.8);
				if (a < 0.005) continue;
				const c = pal[Math.floor(band * 2.99)];
				const g = ctx.createLinearGradient(0, ph, 0, ph - hgt);
				g.addColorStop(0, rgba(c, 0));
				g.addColorStop(0.35, rgba(c, a));
				g.addColorStop(1, rgba(c, 0));
				ctx.strokeStyle = g;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(x, ph);
				ctx.lineTo(x + shear, ph - hgt);
				ctx.stroke();
			}
		};

		paint(0);
		if (reducedMotion) return;
		const loop = visibleLoop(wrap, {
			fps: 20,
			draw(dt, t) {
				ptr.decay(dt);
				paint(t);
				lastT = t;
			},
		});
		stopLoop = loop.stop;
		const onResize = () => {
			w = wrap.clientWidth;
			ctx = sizeCanvas(canvas, w, ph, 0.5);
			paint(lastT);
		};
		window.addEventListener("resize", onResize);
		const prevStop = stopLoop;
		stopLoop = () => {
			prevStop();
			window.removeEventListener("resize", onResize);
		};
	});

	return () => {
		cancelIdle();
		stopLoop();
		stopPointer();
		io?.disconnect();
		wrap.remove();
	};
}
