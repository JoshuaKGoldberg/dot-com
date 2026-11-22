import { createPainter, createPointer, createLoop, mk, onSize, seeded, clamp } from "./_quiet-a/kit.js";

export function activate({ root, mode, reducedMotion }) {
	const page = root.querySelector(".site-page");
	const footer = root.querySelector(".site-footer");
	if (!page || !footer) return;
	const dark = mode === "dark" || document.documentElement.classList.contains("dark");
	const wrap = mk("div", "qa-valley");
	wrap.setAttribute("aria-hidden", "true");
	const canvas = mk("canvas", "", wrap);
	footer.before(wrap);
	const ctx = canvas.getContext("2d");

	const sky = document.createElement("canvas");
	const painter = createPainter(sky, {
		dark,
		profile: { c0: 0.3, amp: 0.1, sig: 0.2, fade: 0.6, gain: 0.95, reach: 520, pullX: 0.18, maxA: dark ? 0.5 : 0.3, seed: 3 },
	});
	const ridge = document.createElement("canvas");
	let W = 0;
	let H = 0;
	let dpr = 1;
	const C = dark
		? { back: "#13243a", mid: "#0f1e33", front: "#0b182a", pine: "#0a1626" }
		: { back: "#e4eef2", mid: "#d6e5ea", front: "#c9dce2", pine: "#bdd3da" };

	function buildRidges() {
		ridge.width = W * dpr;
		ridge.height = H * dpr;
		const g = ridge.getContext("2d");
		g.scale(dpr, dpr);
		const rnd = seeded(91);
		const line = (base, amp, f1, f2, ph, fill) => {
			g.beginPath();
			g.moveTo(0, H);
			for (let x = 0; x <= W; x += 6) {
				const y = base - amp * (0.6 * Math.sin(x * f1 + ph) + 0.4 * Math.sin(x * f2 + ph * 2.3) + 0.25 * Math.sin(x * f2 * 2.7 + ph));
				g.lineTo(x, y);
			}
			g.lineTo(W, H);
			g.closePath();
			g.fillStyle = fill;
			g.fill();
		};
		line(H * 0.6, 34, 0.006, 0.017, 1.2, C.back);
		line(H * 0.74, 26, 0.009, 0.022, 4.1, C.mid);
		line(H * 0.88, 14, 0.012, 0.03, 2.2, C.front);
		// A few small pines on the front ridge.
		g.fillStyle = C.pine;
		const n = Math.round(W / 70);
		for (let i = 0; i < n; i++) {
			const x = rnd() * W;
			const base = H * 0.9 + 4;
			const h = 16 + rnd() * 20;
			const wd = h * 0.3;
			g.beginPath();
			g.moveTo(x, base - h);
			for (let k = 1; k <= 3; k++) {
				const yy = base - h + (h * k) / 3;
				const ww = (wd * k) / 3;
				g.lineTo(x + ww, yy);
				g.lineTo(x + ww * 0.45, yy - 1);
			}
			g.lineTo(x - wd * 0.45, base - 1);
			for (let k = 3; k >= 1; k--) {
				const yy = base - h + (h * k) / 3;
				const ww = (wd * k) / 3;
				g.lineTo(x - ww * 0.45, yy - 1);
				g.lineTo(x - ww, yy);
			}
			g.closePath();
			g.fill();
		}
	}

	// A few small birds that drift slowly across the valley.
	const rb = seeded(7);
	const birds = Array.from({ length: 3 }, (_, i) => ({ x: rb() * 0.9 + 0.05, y: 0.2 + rb() * 0.22, v: 0.006 + rb() * 0.006, ph: rb() * 6, s: 8 + rb() * 3 + i*1.5 }));
	const ptr = createPointer(() => loop.wake());

	const drawBird = (b, t) => {
		const x = b.x * W;
		const y = b.y * H + Math.sin(t * 0.4 + b.ph) * 4;
		const flap = Math.sin(t * 3.2 + b.ph) * 0.6;
		const s = b.s;
		ctx.beginPath();
		ctx.moveTo(x - s, y - s * (0.2 + flap * 0.5));
		ctx.quadraticCurveTo(x - s * 0.4, y - s * (0.55 + flap * 0.4), x, y);
		ctx.quadraticCurveTo(x + s * 0.4, y - s * (0.55 + flap * 0.4), x + s, y - s * (0.2 + flap * 0.5));
		ctx.stroke();
	};

	const frame = (t, dt) => {
		const rect = wrap.getBoundingClientRect();
		painter.draw(t, rect, ptr);
		ctx.clearRect(0, 0, W, H);
		ctx.globalCompositeOperation = "source-over";
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(sky, 0, 0, W, H * 0.8);
		ctx.drawImage(ridge, 0, 0, W, H);
		ctx.strokeStyle = dark ? "rgba(200,225,255,0.7)" : "rgba(60,80,110,0.55)";
		ctx.lineWidth = 1.2;
		ctx.lineCap = "round";
		for (const b of birds) {
			b.x += b.v * dt * (1 + ptr.energy * 2);
			if (b.x > 1.04) b.x = -0.04;
			drawBird(b, t);
		}
	};
	const loop = createLoop(wrap, frame, { fps: 24, reduced: reducedMotion, ptr });

	const size = () => {
		wrap.style.marginLeft = "0px";
		const rr = root.getBoundingClientRect();
		W = Math.round(root.clientWidth);
		H = wrap.clientHeight || 190;
		wrap.style.marginLeft = `${rr.left - wrap.getBoundingClientRect().left}px`;
		wrap.style.width = `${W}px`;
		dpr = Math.min(1.5, devicePixelRatio || 1);
		canvas.width = W * dpr;
		canvas.height = H * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		painter.setSize(W, H * 0.8, 6);
		buildRidges();
		loop.once();
	};
	const off = onSize([root, page], size);
	size();
	return () => {
		off();
		loop.destroy();
		ptr.destroy();
		wrap.remove();
	};
}
