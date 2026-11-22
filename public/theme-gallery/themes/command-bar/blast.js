// A tiny emoji burst (a nod to emoji-blast). One canvas, ~1.6s, removed afterwards.
const EMOJI = ["✨", "💙", "🎉", "🦾", "🧡", "⚡", "🌈", "🔷"];

export function blast(root, reducedMotion) {
	const host = root.querySelector(".overlay-b") ?? root;
	const c = document.createElement("canvas");
	c.className = "cb-blast";
	host.append(c);
	const dpr = Math.min(devicePixelRatio || 1, 1.25);
	const W = c.clientWidth, H = c.clientHeight;
	c.width = W * dpr;
	c.height = H * dpr;
	const ctx = c.getContext("2d");
	ctx.scale(dpr, dpr);
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	const ps = Array.from({ length: 42 }, (_, i) => {
		const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
		const s = 420 + Math.random() * 520;
		return { x: W / 2, y: H * 0.7, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, e: EMOJI[i % EMOJI.length], z: 18 + Math.random() * 20 };
	});
	const draw = (alpha) => {
		ctx.clearRect(0, 0, W, H);
		ctx.globalAlpha = alpha;
		for (const p of ps) {
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.r);
			ctx.font = `${p.z}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
			ctx.fillText(p.e, 0, 0);
			ctx.restore();
		}
	};
	if (reducedMotion) {
		for (const p of ps) { p.x += p.vx * 0.35; p.y += p.vy * 0.35; }
		draw(1);
		setTimeout(() => c.remove(), 1500);
		return;
	}
	let last = performance.now(), t = 0;
	const tick = (now) => {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		t += dt;
		for (const p of ps) {
			p.vy += 1100 * dt;
			p.vx *= 0.992;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.r += p.vr * dt;
		}
		draw(Math.max(0, Math.min(1, 2 - t * 1.25)));
		if (t < 1.6) requestAnimationFrame(tick);
		else c.remove();
	};
	requestAnimationFrame(tick);
}
