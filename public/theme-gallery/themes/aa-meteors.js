import { createNight, onEmptyTap, rgba, addBirds } from "./_aurora-d/kit.js";

export function activate({ root, reducedMotion }) {
	const scene = createNight({
		root,
		reducedMotion,
		milky: 0.25,
		aurora: { y0: 0.36, gap: 0.045, hgt: 0.26, gain: 0.85 },
	});
	const stopBirds = addBirds(scene, { seed: 255 });
	const hint = scene.hint("Click empty sky to launch a meteor");
	let fx = null, fxx = null, meteors = [], raf = 0, last = 0, autoT = 0, dead = false;

	function ensureFx() {
		if (fx) return;
		fx = document.createElement("canvas");
		fx.style.cssText = "position:absolute;left:0;top:0;pointer-events:none";
		scene.el.insertBefore(fx, scene.el.querySelector(".ad-land"));
		size();
	}
	function size() {
		if (!fx) return;
		fx.width = scene.w; fx.height = scene.wy;
		fx.style.width = `${scene.w}px`; fx.style.height = `${scene.wy}px`;
		fxx = fx.getContext("2d");
	}
	const prevBuild = scene.afterBuild;
	scene.afterBuild = () => { prevBuild?.(); size(); };

	function launch(x, y, strength = 1) {
		ensureFx();
		const dirx = Math.random() < 0.5 ? -1 : 1;
		const ang = (0.35 + Math.random() * 0.35) * (Math.random() < 0.5 ? 1 : 1);
		const dx = Math.cos(ang) * dirx, dy = Math.sin(ang);
		const speed = 950 + Math.random() * 450, dur = 0.55 + Math.random() * 0.35;
		const m = { x: x - dx * speed * dur * 0.45, y: y - dy * speed * dur * 0.45, dx, dy, speed, dur, age: 0, len: 150 + Math.random() * 120 * strength };
		meteors.push(m);
		if (meteors.length > 6) meteors.shift();
		scene.flash(0.55 * strength);
		if (scene.reduced) { drawStatic(m); return; }
		if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
	}
	const col = () => (scene.dark ? [235, 245, 255] : [70, 55, 150]);
	function paint(m, age, alpha) {
		const hx = m.x + m.dx * m.speed * age, hy = m.y + m.dy * m.speed * age;
		const tl = m.len * Math.min(1, age / 0.12 + 0.2);
		const tx = hx - m.dx * tl, ty = hy - m.dy * tl;
		const g = fxx.createLinearGradient(tx, ty, hx, hy);
		g.addColorStop(0, rgba(col(), 0));
		g.addColorStop(1, rgba(col(), 0.95 * alpha));
		fxx.strokeStyle = g;
		fxx.lineWidth = 2;
		fxx.lineCap = "round";
		fxx.beginPath(); fxx.moveTo(tx, ty); fxx.lineTo(hx, hy); fxx.stroke();
		fxx.fillStyle = rgba(scene.dark ? [255, 255, 255] : [255, 230, 170], alpha);
		fxx.beginPath(); fxx.arc(hx, hy, 2.2, 0, Math.PI * 2); fxx.fill();
		fxx.fillStyle = rgba(scene.dark ? [200, 235, 255] : [255, 200, 140], 0.18 * alpha);
		fxx.beginPath(); fxx.arc(hx, hy, 9, 0, Math.PI * 2); fxx.fill();
	}
	function drawStatic(m) {
		fxx.clearRect(0, 0, fx.width, fx.height);
		paint(m, m.dur * 0.45, 1);
		setTimeout(() => { if (!dead) fxx.clearRect(0, 0, fx.width, fx.height); }, 1200);
	}
	function loop(now) {
		raf = 0;
		if (dead) return;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		fxx.clearRect(0, 0, fx.width, fx.height);
		meteors = meteors.filter((m) => (m.age += dt) < m.dur);
		for (const m of meteors) paint(m, m.age, Math.max(0, Math.sin((m.age / m.dur) * Math.PI)) ** 0.6);
		if (meteors.length && !document.hidden) raf = requestAnimationFrame(loop);
		else if (!meteors.length) fxx.clearRect(0, 0, fx.width, fx.height);
	}

	onEmptyTap(scene, (x, y) => {
		if (y > scene.wy) return;
		hint.hide();
		launch(x, y);
	});
	// occasional automatic meteors
	function auto() {
		autoT = setTimeout(() => {
			if (!document.hidden && scene.ready) launch(scene.w * (0.1 + Math.random() * 0.8), scene.wy * (0.08 + Math.random() * 0.35), 0.7);
			auto();
		}, 7000 + Math.random() * 9000);
	}
	if (!reducedMotion) {
		auto();
		autoT = setTimeout(() => scene.ready && launch(scene.w * 0.3, scene.wy * 0.2, 0.7), 2500);
	}
	return () => { dead = true; clearTimeout(autoT); cancelAnimationFrame(raf); stopBirds(); scene.destroy(); };
}
