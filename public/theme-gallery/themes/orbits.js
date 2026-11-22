// N-body moons around the hero portrait. Leapfrog (kick-drift-kick) integration at a fixed
// 120 Hz; moons attract the portrait and each other, merge on contact (momentum conserved),
// get swallowed by the portrait, and fade away if they escape. Drag to sling new ones.

const DT = 1 / 120;
const PALETTE = 6;

export function activate({ root, reducedMotion }) {
	const overlay = root.querySelector(".overlay-a");
	const overlayB = root.querySelector(".overlay-b");
	const portrait = root.querySelector(".site-portrait");
	const hero = root.querySelector(".site-hero");
	if (!overlay || !overlayB || !portrait || !hero) return undefined;
	const portraitImg = portrait.querySelector("img.site-portrait-light, img") ?? portrait;
	const portraitImgs = [...portrait.querySelectorAll("img")];

	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	overlay.append(canvas);
	const ctx = canvas.getContext("2d");
	const css = getComputedStyle(root);
	const inkRGB = css.getPropertyValue("--orbitInk").trim().split(/\s+/).join(",") || "40,42,80";
	const moonColors = Array.from({ length: PALETTE }, (_, i) => css.getPropertyValue(`--moon${i}`).trim() || "#888");
	const dark = document.documentElement.classList.contains("dark");

	let width = 0;
	let height = 0;
	let dpr = 1;
	let cx = 0;
	let cy = 0; // world coordinates (page content space)
	let Rp = 120;
	let GM = 7e6;
	let maxMoons = 20;

	function measure() {
		const rr = root.getBoundingClientRect();
		width = Math.round(rr.width);
		height = Math.round(rr.height);
		dpr = Math.min(1.5, window.devicePixelRatio || 1);
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		const p = portraitImg.getBoundingClientRect();
		// portrait may be hidden (display none) for the other colour scheme
		const visibleImg = portraitImgs.find((i) => i.getBoundingClientRect().width > 0) ?? portraitImg;
		const pr = visibleImg.getBoundingClientRect();
		void p;
		Rp = pr.width / 2 || 120;
		cx = pr.left - rr.left + pr.width / 2 + root.scrollLeft;
		cy = pr.top - rr.top + pr.height / 2 + root.scrollTop;
		const rOrbit = Rp * 1.9;
		GM = 0.62 * rOrbit ** 3;
		maxMoons = Math.max(8, Math.min(28, Math.round((width * height) / 45000)));
	}

	// ---- bodies ----
	let moons = [];
	const rings = [];
	const sparks = [];
	let thump = 0;
	let thumpV = 0;
	const EPS2 = (Rp * 0.18) ** 2;

	const MU_K = () => GM * 0.00055; // moon "mass" per px^2 of area

	function makeMoon(x, y, vx, vy, r, color, frozen = false) {
		return { x, y, vx, vy, ax: 0, ay: 0, r, color, trail: [], tick: 0, alpha: 1, fade: false, frozen, age: 0 };
	}

	function circularSpeed(dist) {
		return Math.sqrt((GM * dist * dist) / (dist * dist + EPS2) ** 1.5) * 1;
	}

	function seed() {
		moons = [];
		rings.length = 0;
		sparks.length = 0;
		const specs = [
			[1.7, 0.4, 5.5, 0, 1],
			[2.15, 2.3, 7.5, 1, 1],
			[2.7, 3.9, 4.5, 2, -1],
			[3.3, 5.4, 6.5, 3, 1],
			[2.45, 1.3, 4, 4, -1],
			[4.1, 0.2, 8, 5, 1],
		];
		const count = Math.min(specs.length, Math.max(3, maxMoons - 4));
		for (let i = 0; i < count; i++) {
			const [rr, ang, r, ci, dir] = specs[i];
			const dist = Rp * rr;
			const x = cx + Math.cos(ang) * dist;
			const y = cy + Math.sin(ang) * dist;
			const v = circularSpeed(dist) * (0.96 + (i % 3) * 0.03);
			moons.push(makeMoon(x, y, -Math.sin(ang) * v * dir, Math.cos(ang) * v * dir, r * 1.5, moonColors[ci], reducedMotion));
		}
	}

	// ---- physics ----
	function accel() {
		const k = MU_K();
		for (const m of moons) {
			m.ax = m.ay = 0;
		}
		for (let i = 0; i < moons.length; i++) {
			const a = moons[i];
			const dx = cx - a.x;
			const dy = cy - a.y;
			const d2 = dx * dx + dy * dy + EPS2;
			const inv = GM / (d2 * Math.sqrt(d2));
			a.ax += dx * inv;
			a.ay += dy * inv;
			if (a.frozen) continue;
			for (let j = i + 1; j < moons.length; j++) {
				const b = moons[j];
				if (b.frozen) continue;
				const ex = b.x - a.x;
				const ey = b.y - a.y;
				const e2 = ex * ex + ey * ey + 40;
				const f = 1 / (e2 * Math.sqrt(e2));
				a.ax += ex * f * k * b.r * b.r;
				a.ay += ey * f * k * b.r * b.r;
				b.ax -= ex * f * k * a.r * a.r;
				b.ay -= ey * f * k * a.r * a.r;
			}
		}
	}

	function merge(a, b) {
		const ma = a.r * a.r;
		const mb = b.r * b.r;
		const mt = ma + mb;
		const big = ma >= mb ? a : b;
		const x = (a.x * ma + b.x * mb) / mt;
		const y = (a.y * ma + b.y * mb) / mt;
		const vx = (a.vx * ma + b.vx * mb) / mt;
		const vy = (a.vy * ma + b.vy * mb) / mt;
		const merged = makeMoon(x, y, vx, vy, Math.min(22, Math.sqrt(mt)), big.color, false);
		merged.trail = big.trail;
		rings.push({ x, y, t: 0, color: big.color, size: merged.r });
		return merged;
	}

	function step() {
		// kick-drift-kick
		accel();
		for (const m of moons) {
			if (m.frozen) continue;
			m.vx += m.ax * DT * 0.5;
			m.vy += m.ay * DT * 0.5;
			m.x += m.vx * DT;
			m.y += m.vy * DT;
		}
		accel();
		for (const m of moons) {
			if (m.frozen) continue;
			m.vx += m.ax * DT * 0.5;
			m.vy += m.ay * DT * 0.5;
			m.age += DT;
			if (++m.tick % 3 === 0) {
				m.trail.push(m.x, m.y);
				if (m.trail.length > 2 * 56) m.trail.splice(0, 2);
			}
		}

		// collisions between moons
		for (let i = 0; i < moons.length; i++) {
			for (let j = i + 1; j < moons.length; j++) {
				const a = moons[i];
				const b = moons[j];
				if (!a || !b || a.frozen || b.frozen || a.fade || b.fade) continue;
				const dx = a.x - b.x;
				const dy = a.y - b.y;
				const rr = (a.r + b.r) * 0.9;
				if (dx * dx + dy * dy < rr * rr) {
					moons[i] = merge(a, b);
					moons.splice(j, 1);
					j--;
				}
			}
		}

		// portrait impact and escape
		const escape = Math.max(width, height) * 1.15;
		for (let i = moons.length - 1; i >= 0; i--) {
			const m = moons[i];
			if (m.frozen) continue;
			const d = Math.hypot(m.x - cx, m.y - cy);
			if (d < Rp * 0.95 && !m.fade) {
				const ux = (m.x - cx) / (d || 1);
				const uy = (m.y - cy) / (d || 1);
				for (let s = 0; s < 10; s++) {
					const a = Math.atan2(uy, ux) + (Math.random() - 0.5) * 2;
					const sp = 60 + Math.random() * 160;
					sparks.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.4, age: 0, color: m.color });
				}
				thumpV += 14 * Math.min(2, m.r / 6);
				moons.splice(i, 1);
				continue;
			}
			if (d > escape) m.fade = true;
			if (m.fade) {
				m.alpha -= DT * 0.9;
				if (m.alpha <= 0) moons.splice(i, 1);
			}
			// reduced motion: user flung moons live for a few seconds only
			if (reducedMotion && m.age > 7) m.fade = true;
		}

		// sparks, rings, portrait thump spring
		for (let i = sparks.length - 1; i >= 0; i--) {
			const s = sparks[i];
			s.age += DT;
			s.x += s.vx * DT;
			s.y += s.vy * DT;
			s.vx *= 0.97;
			s.vy *= 0.97;
			if (s.age > s.life) sparks.splice(i, 1);
		}
		for (let i = rings.length - 1; i >= 0; i--) {
			rings[i].t += DT;
			if (rings[i].t > 0.5) rings.splice(i, 1);
		}
		thumpV += (-180 * thump - 14 * thumpV) * DT;
		thump += thumpV * DT;
	}

	// ---- sprites ----
	const spriteCache = new Map();
	function sprite(color) {
		let s = spriteCache.get(color);
		if (s) return s;
		const size = 64;
		const c = document.createElement("canvas");
		c.width = c.height = size;
		const g = c.getContext("2d");
		const glow = g.createRadialGradient(32, 32, 6, 32, 32, 32);
		glow.addColorStop(0, `${color}66`);
		glow.addColorStop(1, `${color}00`);
		g.fillStyle = glow;
		g.fillRect(0, 0, size, size);
		const body = g.createRadialGradient(26, 25, 1, 32, 32, 15);
		body.addColorStop(0, "#ffffff");
		body.addColorStop(0.25, color);
		body.addColorStop(1, "#000000aa");
		g.fillStyle = body;
		g.beginPath();
		g.arc(32, 32, 15, 0, Math.PI * 2);
		g.fill();
		g.globalCompositeOperation = "destination-over";
		spriteCache.set(color, c);
		return c;
	}

	// ---- aiming ----
	let aim = null; // {x0,y0,x1,y1,fromPortrait,active}
	let slingMode = false;

	function toWorld(clientX, clientY) {
		const rr = root.getBoundingClientRect();
		return [clientX - rr.left + root.scrollLeft, clientY - rr.top + root.scrollTop];
	}

	function launchParams() {
		const [x0, y0] = toWorld(aim.x0, aim.y0);
		const [x1, y1] = toWorld(aim.x1, aim.y1);
		const fromPortrait = Math.hypot(x0 - cx, y0 - cy) < Rp * 1.02;
		if (fromPortrait) {
			const d = Math.hypot(x1 - cx, y1 - cy) || 1;
			const ux = (x1 - cx) / d;
			const uy = (y1 - cy) / d;
			const dist = Rp * 1.25;
			const factor = Math.max(0.55, Math.min(1.7, 0.55 + (d - Rp) / Rp * 0.5));
			const v = circularSpeed(dist) * factor;
			return { x: cx + ux * dist, y: cy + uy * dist, vx: -uy * v, vy: ux * v, ok: d > Rp * 1.05 };
		}
		let vx = (x0 - x1) * 3.2;
		let vy = (y0 - y1) * 3.2;
		const sp = Math.hypot(vx, vy);
		const cap = circularSpeed(Rp * 2) * 2.6;
		if (sp > cap) {
			vx *= cap / sp;
			vy *= cap / sp;
		}
		return { x: x0, y: y0, vx, vy, ok: sp > 25 };
	}

	function predict(p) {
		const pts = [];
		let x = p.x;
		let y = p.y;
		let vx = p.vx;
		let vy = p.vy;
		for (let i = 0; i < 520; i++) {
			const dx = cx - x;
			const dy = cy - y;
			const d2 = dx * dx + dy * dy + EPS2;
			const inv = GM / (d2 * Math.sqrt(d2));
			vx += dx * inv * DT * 0.5;
			vy += dy * inv * DT * 0.5;
			x += vx * DT;
			y += vy * DT;
			const d2b = (cx - x) ** 2 + (cy - y) ** 2 + EPS2;
			const invb = GM / (d2b * Math.sqrt(d2b));
			vx += (cx - x) * invb * DT * 0.5;
			vy += (cy - y) * invb * DT * 0.5;
			if (Math.hypot(x - cx, y - cy) < Rp * 0.95) break;
			if (i % 6 === 0) pts.push(x, y);
		}
		return pts;
	}

	// ---- pointer handling ----
	const blankTargets = "#site, .site-page, .site-main, .site-hero, .site-header, .site-section, .site-footer, .site-list, .site-portrait, .site-portrait img, .site-hero-text, .site-scenery, .site-scenery *";
	let nextColor = 0;
	let hintGone = false;

	function onDown(event) {
		if (event.button !== 0 || event.target.closest?.(".orb-controls")) return;
		const t = event.target;
		if (!slingMode && !(t.matches?.(blankTargets) && !t.closest?.("a, button, input, textarea"))) return;
		aim = { x0: event.clientX, y0: event.clientY, x1: event.clientX, y1: event.clientY, active: false, id: event.pointerId };
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onCancel);
	}

	function onMove(event) {
		if (!aim) return;
		aim.x1 = event.clientX;
		aim.y1 = event.clientY;
		if (!aim.active && Math.hypot(aim.x1 - aim.x0, aim.y1 - aim.y0) > 6) {
			aim.active = true;
			document.documentElement.classList.add("orb-aiming");
			root.style.userSelect = "none";
			window.getSelection?.()?.removeAllRanges();
		}
		if (aim.active) wake();
	}

	function endAim() {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onCancel);
		document.documentElement.classList.remove("orb-aiming");
		root.style.userSelect = "";
	}

	function onCancel() {
		endAim();
		aim = null;
		wake();
	}

	function onUp() {
		const was = aim;
		endAim();
		aim = null;
		if (!was?.active) return;
		aim = was;
		const p = launchParams();
		aim = null;
		if (p.ok) {
			const moon = makeMoon(p.x, p.y, p.vx, p.vy, 7 + Math.random() * 3, moonColors[nextColor++ % PALETTE]);
			moon.trail.push(p.x, p.y);
			moons.push(moon);
			rings.push({ x: p.x, y: p.y, t: 0, color: moon.color, size: moon.r });
			// cap by area: oldest faded
			const live = moons.filter((m) => !m.fade);
			if (live.length > maxMoons) live[0].fade = true;
			if (!hintGone) {
				hintGone = true;
				hint.classList.add("is-gone");
			}
		}
		wake();
	}

	// ---- controls ----
	const controls = document.createElement("div");
	controls.className = "orb-controls";
	const hint = document.createElement("span");
	hint.className = "orb-hint";
	hint.textContent = "Drag out of the portrait (or any empty space) to fling a moon";
	const bSling = document.createElement("button");
	bSling.type = "button";
	bSling.className = "orb-btn";
	bSling.textContent = "Sling anywhere";
	bSling.setAttribute("aria-pressed", "false");
	const bReset = document.createElement("button");
	bReset.type = "button";
	bReset.className = "orb-btn";
	bReset.textContent = "Reset system";
	controls.append(hint, bSling, bReset);
	overlayB.append(controls);
	bSling.addEventListener("click", () => {
		slingMode = !slingMode;
		bSling.setAttribute("aria-pressed", String(slingMode));
	});
	bReset.addEventListener("click", () => {
		seed();
		wake();
		render();
	});

	// ---- rendering ----
	function render() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);
		const ox = -root.scrollLeft;
		const oy = -root.scrollTop;
		ctx.save();
		ctx.translate(ox, oy);

		// orrery rings
		ctx.lineWidth = 1;
		ctx.strokeStyle = `rgba(${inkRGB},${dark ? 0.16 : 0.14})`;
		ctx.setLineDash([2, 7]);
		for (const k of [1.45, 2.1, 3, 4.2]) {
			ctx.beginPath();
			ctx.arc(cx, cy, Rp * k, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.setLineDash([]);

		// trails
		ctx.lineCap = "round";
		for (const m of moons) {
			const t = m.trail;
			const n = t.length / 2;
			if (n < 2) continue;
			ctx.strokeStyle = m.color;
			const parts = 4;
			for (let p = 0; p < parts; p++) {
				const from = Math.floor((n * p) / parts);
				const to = Math.min(n - 1, Math.floor((n * (p + 1)) / parts) + 1);
				ctx.globalAlpha = ((p + 1) / parts) * 0.55 * m.alpha;
				ctx.lineWidth = Math.max(1, m.r * 0.3 * ((p + 1) / parts));
				ctx.beginPath();
				ctx.moveTo(t[from * 2], t[from * 2 + 1]);
				for (let i = from + 1; i <= to; i++) ctx.lineTo(t[i * 2], t[i * 2 + 1]);
				ctx.stroke();
			}
		}
		ctx.globalAlpha = 1;

		for (const r of rings) {
			const p = r.t / 0.5;
			ctx.globalAlpha = (1 - p) * 0.9;
			ctx.strokeStyle = r.color;
			ctx.lineWidth = 2 * (1 - p) + 0.5;
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.size * (1.5 + p * 4), 0, Math.PI * 2);
			ctx.stroke();
		}
		for (const s of sparks) {
			ctx.globalAlpha = Math.max(0, 1 - s.age / s.life);
			ctx.fillStyle = s.color;
			ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
		}
		for (const m of moons) {
			ctx.globalAlpha = m.alpha;
			const size = m.r * 4.2;
			ctx.drawImage(sprite(m.color), m.x - size / 2, m.y - size / 2, size, size);
		}
		ctx.globalAlpha = 1;
		ctx.restore();

		// sling UI in screen space
		if (aim?.active) {
			const p = launchParams();
			const rr = root.getBoundingClientRect();
			ctx.save();
			ctx.translate(ox, oy);
			const pts = predict(p);
			ctx.fillStyle = p.ok ? `rgba(${inkRGB},0.7)` : "rgba(200,60,60,0.7)";
			for (let i = 0; i < pts.length; i += 2) {
				ctx.globalAlpha = 1 - i / pts.length;
				ctx.beginPath();
				ctx.arc(pts[i], pts[i + 1], 1.7, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
			ctx.restore();
			ctx.strokeStyle = `rgba(${inkRGB},0.55)`;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(aim.x0 - rr.left, aim.y0 - rr.top);
			ctx.lineTo(aim.x1 - rr.left, aim.y1 - rr.top);
			ctx.stroke();
			const col = moonColors[nextColor % PALETTE];
			const s = 8 * 4.2;
			const sx = p.x - root.scrollLeft;
			const sy = p.y - root.scrollTop;
			ctx.drawImage(sprite(col), sx - s / 2, sy - s / 2, s, s);
		}

		// portrait thump
		if (Math.abs(thump) > 0.0005 || Math.abs(thumpV) > 0.01) {
			const sc = 1 + thump * 0.0035;
			for (const img of portraitImgs) img.style.transform = `scale(${sc.toFixed(4)})`;
			thumping = true;
		} else if (thumping) {
			for (const img of portraitImgs) img.style.transform = "";
			thumping = false;
		}
	}
	let thumping = false;

	// ---- loop ----
	let raf = 0;
	let running = false;
	let last = 0;
	let acc = 0;
	let visible = true;

	function activeWork() {
		return (
			!reducedMotion ||
			aim?.active ||
			moons.some((m) => !m.frozen) ||
			rings.length > 0 ||
			sparks.length > 0 ||
			Math.abs(thump) > 0.001
		);
	}

	function frame(now) {
		raf = 0;
		if (!running) return;
		acc += Math.min(0.05, (now - last) / 1000);
		last = now;
		let steps = 0;
		while (acc >= DT && steps < 6) {
			step();
			acc -= DT;
			steps++;
		}
		render();
		if (!activeWork()) {
			running = false;
			return;
		}
		raf = requestAnimationFrame(frame);
	}

	function wake() {
		if (running || document.hidden || !visible) return;
		running = true;
		last = performance.now();
		acc = 0;
		raf = requestAnimationFrame(frame);
	}

	function stop() {
		running = false;
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	function onScroll() {
		if (!running) render();
	}

	measure();
	seed();
	render();
	wake();

	const intersection = new IntersectionObserver(
		([entry]) => {
			visible = entry.isIntersecting;
			if (visible) {
				wake();
				render();
			} else stop();
		},
		{ rootMargin: "300px 0px" },
	);
	intersection.observe(hero);

	const resizeObserver = new ResizeObserver(() => {
		measure();
		render();
	});
	resizeObserver.observe(root);

	const onVisibility = () => {
		if (document.hidden) stop();
		else wake();
	};
	window.addEventListener("pointerdown", onDown);
	root.addEventListener("scroll", onScroll, { passive: true });
	document.addEventListener("visibilitychange", onVisibility);

	return () => {
		stop();
		endAim();
		intersection.disconnect();
		resizeObserver.disconnect();
		window.removeEventListener("pointerdown", onDown);
		root.removeEventListener("scroll", onScroll);
		document.removeEventListener("visibilitychange", onVisibility);
	};
}
