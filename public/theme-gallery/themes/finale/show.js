const COLORS = [345, 28, 48, 150, 190, 215, 265, 300]; // hues
const GRAV = 160;

export function start({ root, reducedMotion, onEnd }) {
	const host = root.querySelector(".overlay-b") ?? root;
	const dark = document.documentElement.classList.contains("dark");
	const canvas = document.createElement("canvas");
	canvas.className = "fn-canvas";
	host.append(canvas);
	const ctx = canvas.getContext("2d");
	const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
	const W = canvas.clientWidth, H = canvas.clientHeight;
	canvas.width = Math.round(W * dpr);
	canvas.height = Math.round(H * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.lineCap = "round";
	const heart = root.querySelector(".site-heart");
	if (!reducedMotion) heart?.classList.add("fn-pulse");
	canvas.classList.add("is-on");

	/** @type {any[]} */
	let parts = [];
	const rockets = [];
	const cap = Math.round(Math.min(700, (W * H) / 1800));
	const light = dark ? 62 : 46;
	const sat = dark ? 100 : 92;

	function burst(x, y, kind, hue) {
		const n = kind === "willow" ? 46 : kind === "ring" ? 56 : 88;
		for (let i = 0; i < n && parts.length < cap; i++) {
			const a = (i / n) * Math.PI * 2 + (kind === "ring" ? 0 : Math.random() * 0.3);
			const sp = kind === "ring" ? 210 : (kind === "willow" ? 140 : 120) + Math.random() * (kind === "willow" ? 120 : 190);
			parts.push({
				x, y,
				vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (kind === "ring" ? 0.8 : 1),
				life: 0,
				max: kind === "willow" ? 2.4 + Math.random() * 0.6 : 1.1 + Math.random() * 0.7,
				drag: kind === "willow" ? 1.3 : 1.9,
				hue: kind === "willow" ? 42 : hue + (Math.random() - 0.5) * 24,
				w: kind === "willow" ? 1.6 : 2.2,
				crackle: kind === "peony" && Math.random() < 0.06,
			});
		}
	}
	const kinds = ["peony", "ring", "willow", "peony", "peony", "ring"];
	let n = 0;
	const sched = [0, 0.55, 1.15, 1.7, 2.35, 2.8, 3.5, 4.0, 4.7, 5.3, 5.9, 6.0, 6.1].map((t, i, a) => ({
		t,
		grand: i >= a.length - 3,
	}));

	function launch(grand) {
		const x = W * (0.12 + Math.random() * 0.76);
		const ty = H * (0.14 + Math.random() * 0.34);
		const kind = grand ? "peony" : kinds[n % kinds.length];
		rockets.push({ x, y: H + 10, sx: x, ty, t: 0, dur: 0.75 + Math.random() * 0.2, hue: COLORS[(n * 3) % COLORS.length], kind, wob: Math.random() * 6 });
		n++;
	}

	function step(dt) {
		for (const r of rockets) {
			r.t += dt;
			const k = Math.min(1, r.t / r.dur);
			r.y = H + 10 + (r.ty - H - 10) * (1 - (1 - k) * (1 - k));
			r.x = r.sx + Math.sin(r.t * 9 + r.wob) * 4;
			if (k >= 1) {
				r.done = true;
				burst(r.x, r.y, r.kind, r.hue);
			} else if (parts.length < cap) {
				parts.push({ x: r.x, y: r.y, vx: (Math.random() - 0.5) * 20, vy: 40, life: 0, max: 0.35, drag: 2, hue: 40, w: 1.4 });
			}
		}
		for (let i = rockets.length - 1; i >= 0; i--) if (rockets[i].done) rockets.splice(i, 1);
		for (const p of parts) {
			p.px = p.x;
			p.py = p.y;
			p.life += dt;
			const f = Math.exp(-p.drag * dt);
			p.vx *= f;
			p.vy = p.vy * f + GRAV * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			if (p.crackle && p.life > p.max * 0.7 && !p.popped) {
				p.popped = true;
				for (let j = 0; j < 5 && parts.length < cap; j++) {
					const a = Math.random() * 6.28;
					parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 0, max: 0.5, drag: 2.5, hue: 48, w: 1.4 });
				}
			}
		}
		parts = parts.filter((p) => p.life < p.max);
	}

	function draw() {
		ctx.globalCompositeOperation = "destination-out";
		ctx.fillStyle = "rgba(0,0,0,0.2)";
		ctx.fillRect(0, 0, W, H);
		ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
		for (const p of parts) {
			const a = 1 - p.life / p.max;
			ctx.strokeStyle = `hsl(${p.hue} ${sat}% ${light}% / ${Math.pow(a, 1.4).toFixed(3)})`;
			ctx.lineWidth = p.w;
			ctx.beginPath();
			ctx.moveTo(p.px ?? p.x, p.py ?? p.y);
			ctx.lineTo(p.x, p.y);
			ctx.stroke();
		}
	}

	let raf = 0, timer = 0, stopped = false;
	const finish = () => {
		if (stopped) return;
		stopped = true;
		cancelAnimationFrame(raf);
		clearTimeout(timer);
		heart?.classList.remove("fn-pulse");
		canvas.remove();
		onEnd?.();
	};

	if (reducedMotion) {
		// one static frame: three frozen bursts with their trails, then gone
		for (const [fx, fy, hue, kind] of [[0.22, 0.3, 345, "peony"], [0.5, 0.22, 48, "willow"], [0.78, 0.34, 215, "ring"]]) {
			burst(W * fx, H * fy, kind, hue);
		}
		for (let i = 0; i < 38; i++) {
			step(1 / 60);
			ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
			for (const p of parts) {
				const a = 1 - p.life / p.max;
				ctx.strokeStyle = `hsl(${p.hue} ${sat}% ${light}% / ${(a * 0.9).toFixed(3)})`;
				ctx.lineWidth = p.w;
				ctx.beginPath();
				ctx.moveTo(p.px ?? p.x, p.py ?? p.y);
				ctx.lineTo(p.x, p.y);
				ctx.stroke();
			}
		}
		timer = setTimeout(finish, 5000);
		return { stop: finish };
	}

	let clock = 0, last = performance.now(), acc = 0, si = 0;
	const loop = (now) => {
		raf = requestAnimationFrame(loop);
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		clock += dt;
		acc += dt;
		while (si < sched.length && clock >= sched[si].t) launch(sched[si++].grand);
		while (acc >= 1 / 60) {
			step(1 / 60);
			acc -= 1 / 60;
		}
		draw();
		if (si >= sched.length && !rockets.length && !parts.length) finish();
	};
	raf = requestAnimationFrame(loop);
	return { stop: finish };
}
