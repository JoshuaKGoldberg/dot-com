// 105. Storm Over the Lake: drag clouds (merge them to build the storm), click empty sky or margin for
// lightning, rain falls from the clouds and rings the water. Canvas at half resolution, behind the text.
import { buildScene, ambientBirds } from "./ridge-runner/scenery.js";
import { el, div, rng } from "./two-skies-one-shore/lib.js";

const LAKE_TOP = 0.66;
const CLOUDS = [
	{ x: 0.2, y: 0.08, w: 380 },
	{ x: 0.58, y: 0.17, w: 440 },
	{ x: 0.82, y: 0.07, w: 340 },
];

function cloudSVG(w, seed, i) {
	const r = rng(seed);
	const svg = el("svg", { viewBox: "0 0 400 140" });
	const defs = el("defs", {}, svg);
	const g = el("linearGradient", { id: `st-g${i}`, gradientUnits: "userSpaceOnUse", x1: 0, y1: 20, x2: 0, y2: 135 }, defs);
	el("stop", { offset: "0", style: "stop-color: color-mix(in srgb, var(--cloud) 55%, white)" }, g);
	el("stop", { offset: "1", style: "stop-color: var(--cloud)" }, g);
	const puffs = [[62, 98, 44], [120, 72, 56], [196, 56, 64], [268, 74, 54], [334, 96, 44], [196, 100, 62], [130, 100, 48], [270, 102, 48]];
	for (const cls of ["c-base", "c-dark", "c-lit"]) {
		const grp = el("g", { class: cls, ...(cls === "c-base" ? { fill: `url(#st-g${i})` } : {}) }, svg);
		for (const [x, y, rad] of puffs) el("circle", { cx: x + (r() - 0.5) * 6, cy: y, r: rad * (0.94 + r() * 0.12) }, grp);
		el("ellipse", { cx: 198, cy: 118, rx: 170, ry: 24 }, grp);
	}
	void w;
	return svg;
}

export function activate({ root, mode, reducedMotion }) {
	const scene = buildScene(root, { seed: 105, lakeTop: LAKE_TOP, stars: false });
	const birds = ambientBirds(scene, { mode, reduced: reducedMotion, seed: 105, kinds: ["swallow", "swallow", "chickadee"], loon: true });
	const A = scene.A, C = scene.C;
	const overlay = root.querySelector(".overlay-b");
	const flash = div("st-flash", A);
	const cloudEls = CLOUDS.map((c, i) => {
		const e = div("st-cloud", A);
		e.appendChild(cloudSVG(c.w, 50 + i * 9, i));
		return e;
	});
	const canvas = document.createElement("canvas");
	canvas.className = "st-canvas";
	C.appendChild(canvas);
	const ctx = canvas.getContext("2d");
	const SC = 0.5;

	const hint = div("st-hint", overlay);
	hint.textContent = "Drag clouds in the margins · merge them for a storm · click the sky for lightning";
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "st-btn";
	btn.innerHTML = `<span aria-hidden="true">⚡</span> Strike`;
	btn.setAttribute("aria-label", "Call down a lightning strike");
	overlay.appendChild(btn);

	let W = 0, H = 0;
	const clouds = CLOUDS.map((c, i) => ({ el: cloudEls[i], x: 0, y: 0, w: c.w, h: 140, fx: c.x, fy: c.y, vx: 0, dark: 0.1, shown: -1, drag: false, base: c }));
	const MAXD = 420;
	const drops = [];
	const rings = [];
	let bolt = null;
	let alive = true, raf = 0, last = 0, sinceStrike = 0, autoT = 6, acc = 0;
	const R = rng(105);

	function resize() {
		W = root.clientWidth;
		H = root.clientHeight;
		canvas.width = Math.round(W * SC);
		canvas.height = Math.round(H * SC);
		for (const c of clouds) {
			if (!c.placed) {
				c.x = c.fx * W - c.w / 2;
				c.y = c.fy * H;
				c.placed = true;
			}
			c.x = Math.min(Math.max(c.x, -c.w * 0.6), W - c.w * 0.4);
			put(c);
		}
		if (reducedMotion) renderStatic();
	}
	const put = (c) => {
		const s = c.w / 400;
		c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0) scale(${s})`;
		c.el.style.transformOrigin = "0 0";
	};
	const cx = (c) => c.x + c.w / 2;
	const lakeTopY = () => H * LAKE_TOP;

	// ---- storm intensity: overlap darkens clouds, which strengthens rain and lightning
	function updateDark(dt) {
		for (const c of clouds) {
			let overlap = 0;
			for (const o of clouds) {
				if (o === c) continue;
				const ox = Math.max(0, Math.min(c.x + c.w, o.x + o.w) - Math.max(c.x, o.x));
				overlap += ox / Math.min(c.w, o.w);
			}
			const target = Math.min(1, 0.18 + overlap * 0.8);
			c.dark += (target - c.dark) * Math.min(1, dt * 1.6);
			if (Math.abs(c.dark - c.shown) > 0.03) {
				c.shown = c.dark;
				c.el.querySelector(".c-dark").style.opacity = (c.dark * (mode === "dark" ? 0.95 : 0.7)).toFixed(2);
			}
		}
	}
	const stormLevel = () => clouds.reduce((a, c) => a + c.dark, 0) / clouds.length;

	// ---- rain + rings
	function spawnDrop(c) {
		if (drops.length >= MAXD) return;
		const x = c.x + c.w * (0.14 + R() * 0.72);
		const y = c.y + c.h * 0.78;
		const ty = lakeTopY() + 10 + Math.pow(R(), 0.8) * (H - lakeTopY() - 40);
		drops.push({ x, y, ty, vy: 880 + R() * 260, len: 10 + R() * 8, vx: -70 });
	}
	function ring(x, y, big = 1) {
		if (rings.length > 150) rings.shift();
		const depth = 0.45 + 0.8 * Math.max(0, Math.min(1, (y - lakeTopY()) / (H - lakeTopY())));
		rings.push({ x, y, age: 0, max: (8 + R() * 8) * depth * big, life: 0.8 * (0.8 + big * 0.2) });
	}
	function stepRain(dt) {
		const lvl = stormLevel();
		for (const c of clouds) {
			if (c.x + c.w < 0 || c.x > W) continue;
			c.acc = (c.acc || 0) + dt * (60 + 260 * c.dark) * (0.5 + lvl);
			while (c.acc >= 1) {
				c.acc -= 1;
				spawnDrop(c);
			}
		}
		for (let i = drops.length - 1; i >= 0; i--) {
			const d = drops[i];
			d.y += d.vy * dt;
			d.x += d.vx * dt;
			if (d.y >= d.ty) {
				if (d.x > W * 0.1 && d.x < W * 0.9) ring(d.x, d.ty);
				drops.splice(i, 1);
			}
		}
		for (let i = rings.length - 1; i >= 0; i--) {
			rings[i].age += dt;
			if (rings[i].age > rings[i].life) rings.splice(i, 1);
		}
	}

	// ---- lightning
	function makeBolt(x0, y0, x1, y1) {
		const pts = [[x0, y0], [x1, y1]];
		let off = Math.hypot(x1 - x0, y1 - y0) * 0.16;
		for (let lvl = 0; lvl < 6; lvl++) {
			const next = [pts[0]];
			for (let i = 0; i < pts.length - 1; i++) {
				const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
				next.push([(ax + bx) / 2 + (R() - 0.5) * off, (ay + by) / 2 + (R() - 0.5) * off * 0.5], pts[i + 1]);
			}
			pts.length = 0;
			pts.push(...next);
			off *= 0.55;
		}
		const branches = [];
		for (let k = 0; k < 2; k++) {
			const i = 6 + Math.floor(R() * (pts.length - 14));
			const [sx, sy] = pts[i];
			branches.push(makeBoltSimple(sx, sy, sx + (R() - 0.5) * 220, sy + 80 + R() * 120));
		}
		return { pts, branches, age: 0, life: 0.42 };
	}
	function makeBoltSimple(x0, y0, x1, y1) {
		const pts = [[x0, y0]];
		const n = 7;
		for (let i = 1; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n + (R() - 0.5) * 22, y0 + ((y1 - y0) * i) / n]);
		return pts;
	}
	let lastStrike = 0;
	function strike(px, py) {
		const now = performance.now();
		if (now - lastStrike < 650) return;
		lastStrike = now;
		const tx = Math.max(W * 0.12, Math.min(W * 0.88, px ?? W * (0.3 + R() * 0.4)));
		const ty = Math.max(lakeTopY() + 12, Math.min(H - 70, py ?? lakeTopY() + 30 + R() * (H - lakeTopY() - 120)));
		let src = null, best = 1e9;
		for (const c of clouds) {
			const d = Math.abs(cx(c) - tx);
			if (d < best) (best = d), (src = c);
		}
		const sx = src ? Math.max(c0(src), Math.min(c1(src), tx)) + (R() - 0.5) * 40 : tx;
		const sy = src ? src.y + src.h * 0.8 : 0;
		bolt = makeBolt(sx, sy, tx, ty);
		ring(tx, ty, 2.4);
		setTimeout(() => ring(tx, ty, 1.8), 120);
		setTimeout(() => ring(tx, ty, 1.2), 240);
		if (src) {
			src.el.classList.add("lit");
			setTimeout(() => src.el.classList.remove("lit"), 160);
		}
		if (!reducedMotion) {
			flash.style.background = `radial-gradient(ellipse 80% 70% at ${((sx / W) * 100).toFixed(0)}% 18%, rgba(var(--bolt), 0.6), transparent 70%)`;
			flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.25, offset: 0.25 }, { opacity: 0.8, offset: 0.35 }, { opacity: 0 }], { duration: 480, easing: "ease-out" });
			birds.flock.scatter((b) => b.key === "swallow" || b.key === "chickadee");
		} else {
			bolt.life = 1.4;
			renderStatic();
			clearTimeout(strike.t);
			strike.t = setTimeout(() => {
				bolt = null;
				renderStatic();
			}, 1500);
		}
		sinceStrike = 0;
	}
	const c0 = (c) => c.x + c.w * 0.15;
	const c1 = (c) => c.x + c.w * 0.85;

	function draw() {
		ctx.setTransform(SC, 0, 0, SC, 0, 0);
		ctx.clearRect(0, 0, W, H);
		ctx.lineCap = "round";
		// rain
		ctx.strokeStyle = `rgba(var(--rain-c), 0.5)`;
		const rain = getComputedStyle(root).getPropertyValue("--rain").trim();
		ctx.strokeStyle = `rgba(${rain}, 0.55)`;
		ctx.lineWidth = 1.6;
		ctx.beginPath();
		for (const d of drops) {
			ctx.moveTo(d.x, d.y);
			ctx.lineTo(d.x - d.vx * 0.012, d.y - d.len);
		}
		ctx.stroke();
		// rings
		ctx.lineWidth = 1.4;
		for (const r of rings) {
			const k = r.age / r.life;
			ctx.strokeStyle = `rgba(${rain}, ${(0.6 * (1 - k)).toFixed(2)})`;
			ctx.beginPath();
			ctx.ellipse(r.x, r.y, 1 + r.max * k, (1 + r.max * k) * 0.28, 0, 0, 6.3);
			ctx.stroke();
		}
		// bolt
		if (bolt) {
			const k = bolt.age / bolt.life;
			const flick = k < 0.15 ? 1 : k < 0.28 ? 0.3 : k < 0.42 ? 0.9 : Math.max(0, 1 - k) * 0.9;
			const bc = getComputedStyle(root).getPropertyValue("--bolt").trim();
			const trace = (pts) => {
				ctx.beginPath();
				pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
				ctx.stroke();
			};
			for (const [w, a, col] of [[9, 0.18, bc], [4.5, 0.4, bc], [2, 1, "255,255,255"]]) {
				ctx.lineWidth = w;
				ctx.strokeStyle = `rgba(${col}, ${(a * flick).toFixed(2)})`;
				trace(bolt.pts);
				for (const b of bolt.branches) {
					ctx.lineWidth = w * 0.55;
					trace(b);
				}
			}
		}
	}

	function renderStatic() {
		drops.length = 0;
		rings.length = 0;
		const lvl = 0.5;
		for (const c of clouds) {
			if (c.x + c.w < 0 || c.x > W) continue;
			for (let i = 0; i < 55 * (0.5 + c.dark); i++) {
				const x = c.x + c.w * (0.14 + R() * 0.72), y0 = c.y + c.h * 0.78;
				const ty = lakeTopY() + 10 + R() * (H - lakeTopY() - 40);
				const y = y0 + R() * (ty - y0);
				drops.push({ x, y, ty, vy: 900, len: 12, vx: -70 });
			}
		}
		for (let i = 0; i < 22; i++) ring(W * (0.15 + R() * 0.7), lakeTopY() + 20 + R() * (H - lakeTopY() - 60));
		for (const r of rings) r.age = r.life * 0.3 * R();
		void lvl;
		if (bolt) bolt.age = 0.1;
		draw();
	}

	// ---- loop
	function frame(now) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		acc += dt;
		if (acc < 0.025) return; // ~40 fps is plenty for rain
		const step = acc;
		acc = 0;
		for (const c of clouds) {
			if (c.drag) continue;
			c.vx += (4 - c.vx) * Math.min(1, step * 0.7);
			c.x += c.vx * step;
			if (c.x > W + 20) c.x = -c.w - 10;
			if (c.x + c.w < -40 && c.vx < 0) c.x = W + 10;
			put(c);
		}
		updateDark(step);
		stepRain(step);
		if (bolt) {
			bolt.age += step;
			if (bolt.age > bolt.life) bolt = null;
		}
		sinceStrike += step;
		autoT -= step;
		if (autoT <= 0) {
			autoT = 4 + R() * 6;
			if (stormLevel() > 0.55) strike();
		}
		draw();
	}
	function run() {
		cancelAnimationFrame(raf);
		last = performance.now();
		raf = requestAnimationFrame(frame);
	}
	const onVis = () => {
		if (document.hidden) cancelAnimationFrame(raf);
		else if (!reducedMotion) run();
	};

	// ---- pointer: drag clouds, or strike
	let dragC = null, gx = 0, gy = 0, lastX = 0, lastT = 0;
	const hitCloud = (x, y) => {
		const rr = root.getBoundingClientRect();
		const px = x - rr.left, py = y - rr.top;
		for (const c of [...clouds].reverse()) {
			if (px > c.x + c.w * 0.04 && px < c.x + c.w * 0.96 && py > c.y + 8 && py < c.y + c.h * 0.92) return { c, px, py };
		}
		return { px, py };
	};
	const openArea = (t) => t === root || t === root.querySelector(".site-page");
	const onDown = (e) => {
		if (e.button !== 0 || !openArea(e.target)) return;
		const h = hitCloud(e.clientX, e.clientY);
		if (h.c) {
			dragC = h.c;
			dragC.drag = true;
			gx = h.px - h.c.x;
			gy = h.py - h.c.y;
			lastX = h.px;
			lastT = performance.now();
			root.style.cursor = "grabbing";
			e.preventDefault();
		} else {
			strike(h.px, h.py);
		}
	};
	const onMove = (e) => {
		const rr = root.getBoundingClientRect();
		if (dragC) {
			const px = e.clientX - rr.left, py = e.clientY - rr.top;
			dragC.x = Math.max(-dragC.w * 0.6, Math.min(W - dragC.w * 0.4, px - gx));
			dragC.y = Math.max(10, Math.min(H * LAKE_TOP - dragC.h * 0.9, py - gy));
			const now = performance.now();
			dragC.vx = Math.max(-400, Math.min(400, ((px - lastX) / Math.max(8, now - lastT)) * 1000));
			lastX = px;
			lastT = now;
			put(dragC);
			if (reducedMotion) renderStatic();
		} else {
			root.style.cursor = openArea(e.target) && hitCloud(e.clientX, e.clientY).c ? "grab" : "";
		}
	};
	const onUp = () => {
		if (dragC) {
			dragC.drag = false;
			dragC = null;
			root.style.cursor = "";
		}
	};
	root.addEventListener("pointerdown", onDown);
	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", onUp);
	window.addEventListener("pointercancel", onUp);
	btn.addEventListener("click", () => strike());
	document.addEventListener("visibilitychange", onVis);
	const ro = new ResizeObserver(resize);
	ro.observe(root);
	resize();
	if (reducedMotion) {
		for (const c of clouds) c.dark = c.shown = 0.35;
		for (const c of clouds) c.el.querySelector(".c-dark").style.opacity = "0.25";
		renderStatic();
	} else run();

	return () => {
		alive = false;
		cancelAnimationFrame(raf);
		clearTimeout(strike.t);
		ro.disconnect();
		root.removeEventListener("pointerdown", onDown);
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		document.removeEventListener("visibilitychange", onVis);
		root.style.cursor = "";
		birds.stop();
		btn.remove();
		hint.remove();
		canvas.remove();
		void alive;
	};
}
