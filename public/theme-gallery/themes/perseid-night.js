import { el, div, pineRidge, rng } from "./two-skies-one-shore/lib.js";

export function activate({ root, reducedMotion }) {
	if (!document.documentElement.classList.contains("dark")) return;
	const a = root.querySelector(".scenery-a");
	const b = root.querySelector(".scenery-b");
	const c = root.querySelector(".scenery-c");
	const HORIZON = 0.82;

	const canvas = document.createElement("canvas");
	canvas.className = "star-canvas";
	a.appendChild(canvas);

	// Seeded in unit space so the sky is identical on every load.
	const r = rng(8131);
	const stars = [];
	for (let i = 0; i < 1100; i++) {
		const bright = r() < 0.05;
		stars.push({
			x: r(),
			y: Math.pow(r(), 0.85) * HORIZON * 0.98,
			s: bright ? 1.3 + r() * 0.5 : 0.55 + r() * 0.6,
			o: bright ? 0.55 : 0.18 + r() * 0.37,
			t: r(),
		});
	}
	// Milky Way: extra faint stars clustered on a diagonal.
	for (let i = 0; i < 500; i++) {
		const u = r();
		const off = (r() + r() + r() - 1.5) * 0.09;
		stars.push({ x: u, y: Math.min(HORIZON * 0.98, Math.max(0, 0.62 - u * 0.5 + off)), s: 0.5 + r() * 0.4, o: 0.14 + r() * 0.26, t: r() });
	}

	function draw() {
		const w = Math.min(1600, canvas.clientWidth || 1280);
		const h = Math.round(w * ((canvas.clientHeight || 800) / (canvas.clientWidth || 1280)));
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");
		const hy = h * HORIZON;
		const lakeH = h - hy;
		ctx.clearRect(0, 0, w, h);
		for (const s of stars) {
			const x = s.x * w;
			const y = s.y * h;
			const tint = s.t < 0.2 ? "255,225,200" : s.t < 0.7 ? "225,232,255" : "200,215,255";
			const o = Math.min(0.55, s.o);
			ctx.fillStyle = `rgba(${tint},${o})`;
			ctx.beginPath();
			ctx.arc(x, y, s.s, 0, 6.2832);
			ctx.fill();
		}
		// Reflection: the sky squeezed into the lake, dragged vertically.
		for (const s of stars) {
			const x = s.x * w + Math.sin(s.y * 90 + s.t * 20) * 1.5;
			const ry = hy + (s.y * h) / hy * lakeH * 0.98;
			const o = Math.min(0.55, s.o) * 0.55;
			ctx.fillStyle = `rgba(190,205,255,${o})`;
			ctx.fillRect(x - 0.5, ry, 1 + s.s * 0.4, 1.2 + s.s * 2.2 * (0.4 + (ry - hy) / lakeH));
		}
	}
	draw();
	let resizeFrame = 0;
	const onResize = () => {
		cancelAnimationFrame(resizeFrame);
		resizeFrame = requestAnimationFrame(draw);
	};
	window.addEventListener("resize", onResize);

	div("milky", b);
	const W = 1600;
	const ridge = pineRidge({ w: W, h: 80, base: 62, amp: 4, treeH: 16, seed: 77, gap: [7, 14] });
	const svg = el("svg", { class: "tree-svg", viewBox: `0 0 ${W} 80`, preserveAspectRatio: "xMidYMax slice" }, c);
	el("path", { d: ridge.d }, svg);

	let timer = 0;
	function meteor() {
		if (!document.hidden) {
			const m = div("meteor", b);
			const x = 8 + Math.random() * 60;
			const y = 3 + Math.random() * 30;
			const ang = 20 + Math.random() * 20;
			m.style.left = `${x}%`;
			m.style.top = `${y}%`;
			const dist = 260 + Math.random() * 220;
			const dx = Math.cos((ang * Math.PI) / 180) * dist;
			const dy = Math.sin((ang * Math.PI) / 180) * dist;
			const anim = m.animate(
				[
					{ opacity: 0, transform: `translate(0,0) rotate(${ang}deg)` },
					{ opacity: 0.15, offset: 0.2, transform: `translate(${dx * 0.2}px,${dy * 0.2}px) rotate(${ang}deg)` },
					{ opacity: 0, transform: `translate(${dx}px,${dy}px) rotate(${ang}deg)` },
				],
				{ duration: 1100, easing: "ease-out" },
			);
			anim.onfinish = () => m.remove();
		}
		timer = setTimeout(meteor, 20000 + Math.random() * 20000);
	}
	if (!reducedMotion && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
		timer = setTimeout(meteor, 4000 + Math.random() * 6000);
	}
	return () => {
		clearTimeout(timer);
		window.removeEventListener("resize", onResize);
	};
}
