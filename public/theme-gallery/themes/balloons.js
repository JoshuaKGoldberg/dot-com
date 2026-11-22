// Helium balloons on verlet strings: position-based dynamics at a fixed 120 Hz step.
// The three social links are real <a> elements whose wrapper transforms follow the physics.

const STEP = 1 / 120;
const SEGMENTS = 9;
const R = 38; // collision radius
const W = 72;
const H = 86;
const ROD = H / 2; // knot -> centre
const LIFT = 760; // px/s^2 upward on the balloon
const GRAVITY = 380; // string nodes
const CONFETTI = ["#ff6b81", "#ffc233", "#3fd1a6", "#4a9bff", "#9a74f0", "#ff9ac4"];

const easeElastic = (x) => {
	if (x <= 0) return 0;
	if (x >= 1) return 1;
	return 1 + Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3));
};

export function activate({ root, reducedMotion }) {
	const hero = root.querySelector(".site-hero");
	const socials = root.querySelector(".site-socials");
	if (!hero || !socials) return undefined;

	const wrap = document.createElement("section");
	wrap.className = "bb-wrap";
	wrap.setAttribute("aria-label", "Balloon bay");
	const bay = document.createElement("div");
	bay.className = "bb-bay";
	const canvas = document.createElement("canvas");
	canvas.className = "bb-canvas";
	canvas.setAttribute("aria-hidden", "true");
	const ctx = canvas.getContext("2d");
	bay.append(canvas, socials);
	wrap.append(bay);
	hero.after(wrap);

	const hint = document.createElement("p");
	hint.className = "bb-hint";
	hint.textContent = "Wave your cursor for wind. Drag a balloon, click to pop it.";
	const resetButton = document.createElement("button");
	resetButton.className = "bb-reset";
	resetButton.type = "button";
	resetButton.textContent = "Re-inflate all";
	const bar = document.createElement("div");
	bar.className = "bb-bar";
	bar.append(hint, resetButton);
	wrap.append(bar);

	const style = getComputedStyle(bay);
	const stringColor = style.getPropertyValue("--bbString").trim() || "rgba(36,50,82,.55)";
	const groundColor = style.getPropertyValue("--bbGround").trim() || "rgba(36,50,82,.2)";

	let width = bay.clientWidth;
	let height = bay.clientHeight;
	let dpr = 1;

	// ---- balloons ----
	const links = [...socials.querySelectorAll("li")];
	const layout = [
		{ fx: 0.26, len: 168, color: 0 },
		{ fx: 0.5, len: 196, color: 1 },
		{ fx: 0.74, len: 160, color: 2 },
	];
	const decorLayout = [
		{ fx: 0.07, len: 140, color: 3 },
		{ fx: 0.38, len: 118, color: 4 },
		{ fx: 0.62, len: 124, color: 5 },
		{ fx: 0.93, len: 146, color: 3 },
		{ fx: 0.16, len: 190, color: 5 },
		{ fx: 0.85, len: 186, color: 4 },
	];
	const maxDecor = width < 520 ? 2 : width < 700 ? 4 : decorLayout.length;
	const balloons = [];

	function add(el, spec, kind, i) {
		const b = {
			el,
			kind,
			fx: spec.fx,
			len: spec.len,
			seg: spec.len / SEGMENTS,
			phase: i * 1.7 + Math.random() * 2,
			nodes: [],
			state: "inflating",
			t: -(0.15 + i * 0.16),
			grab: null,
			confettiColor: CONFETTI[spec.color % CONFETTI.length],
		};
		el.classList.add("bb-balloon", `bb-c${spec.color}`);
		if (kind === "link") el.classList.add("bb-link");
		for (let k = 0; k <= SEGMENTS + 1; k++) {
			b.nodes.push({ x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, w: k === 0 ? 0 : k === SEGMENTS + 1 ? 1 : 14 });
		}
		balloons.push(b);
		return b;
	}

	links.forEach((li, i) => {
		const face = li.querySelector("a");
		face.classList.add("bb-face");
		face.draggable = false;
		add(li, layout[i % layout.length], "link", i);
	});
	const decorLayer = document.createElement("div");
	decorLayer.setAttribute("aria-hidden", "true");
	decorLayer.className = "bb-decor-layer";
	bay.append(decorLayer);
	for (let i = 0; i < maxDecor; i++) {
		const el = document.createElement("div");
		el.className = "bb-decor";
		const face = document.createElement("span");
		face.className = "bb-face";
		el.append(face);
		decorLayer.append(el);
		add(el, decorLayout[i], "decor", i + links.length);
	}

	const confetti = [];
	const rings = [];

	function anchorX(b) {
		const margin = 26;
		return margin + b.fx * (width - margin * 2);
	}

	function resetBalloon(b, delay) {
		const ax = anchorX(b);
		const ay = height - 18;
		b.state = "inflating";
		b.t = delay;
		b.grab = null;
		b.nodes.forEach((n, k) => {
			n.x = n.px = ax + (Math.random() - 0.5) * 4;
			n.y = n.py = ay - Math.min(k, SEGMENTS) * 2;
			n.vx = n.vy = 0;
		});
		const c = b.nodes[SEGMENTS + 1];
		c.y = c.py = ay - ROD;
		b.el.classList.add("is-hidden");
	}

	// ---- pointer wind / dragging ----
	let pointerX = -999;
	let pointerY = -999;
	let awakeUntil = 0;
	let grabbed = null;
	let swallowClick = false;
	const sleepWindow = 3200;

	function wake() {
		awakeUntil = performance.now() + sleepWindow;
		start();
	}

	function toBay(event) {
		const rect = bay.getBoundingClientRect();
		return [event.clientX - rect.left, event.clientY - rect.top];
	}

	function blow(x, y, dx, dy) {
		const speed = Math.hypot(dx, dy);
		if (speed < 0.5) return;
		for (const b of balloons) {
			if (b.state === "popped") continue;
			for (let k = 1; k < b.nodes.length; k++) {
				const n = b.nodes[k];
				const d = Math.hypot(n.x - x, n.y - y);
				const reach = k === b.nodes.length - 1 ? 150 : 90;
				if (d > reach) continue;
				const falloff = (1 - d / reach) ** 1.5;
				const gain = k === b.nodes.length - 1 ? 7 : 5;
				let ix = dx * falloff * gain;
				let iy = dy * falloff * gain;
				const m = Math.hypot(ix, iy);
				if (m > 420) {
					ix *= 420 / m;
					iy *= 420 / m;
				}
				n.vx += ix;
				n.vy += iy;
			}
		}
	}

	let lastPX = null;
	let lastPY = null;
	function onPointerMove(event) {
		const [x, y] = toBay(event);
		const inside = x > -80 && x < width + 80 && y > -80 && y < height + 80;
		if (grabbed) {
			pointerX = x;
			pointerY = y;
			if (Math.hypot(event.clientX - grabbed.cx, event.clientY - grabbed.cy) > 5) grabbed.moved = true;
			wake();
		} else if (inside) {
			if (lastPX !== null) {
				blow(x, y, x - lastPX, y - lastPY);
				wake();
			}
		}
		lastPX = inside ? x : null;
		lastPY = y;
		pointerX = x;
		pointerY = y;
	}

	function onPointerDown(event) {
		if (event.button !== 0) return;
		const face = event.target.closest?.(".bb-face");
		if (!face || !bay.contains(face)) return;
		const el = face.closest(".bb-balloon");
		const b = balloons.find((item) => item.el === el);
		if (!b || b.state === "popped") return;
		const [x, y] = toBay(event);
		const c = b.nodes[SEGMENTS + 1];
		grabbed = { b, moved: false, cx: event.clientX, cy: event.clientY, ox: c.x - x, oy: c.y - y };
		b.grab = grabbed;
		pointerX = x;
		pointerY = y;
		wake();
	}

	function onPointerUp() {
		if (!grabbed) return;
		const { b, moved } = grabbed;
		b.grab = null;
		grabbed = null;
		if (moved) {
			swallowClick = true;
			setTimeout(() => (swallowClick = false), 0);
		} else {
			pop(b);
		}
		wake();
	}

	function onClickCapture(event) {
		if (swallowClick) {
			event.preventDefault();
			event.stopPropagation();
			swallowClick = false;
		}
	}

	function pop(b) {
		if (b.state === "popped") return;
		const c = b.nodes[SEGMENTS + 1];
		b.state = "popped";
		b.t = 0;
		b.el.classList.add("is-hidden");
		rings.push({ x: c.x, y: c.y, t: 0, color: b.confettiColor });
		const count = reducedMotion ? 10 : 26;
		for (let i = 0; i < count; i++) {
			const a = Math.random() * Math.PI * 2;
			const s = 120 + Math.random() * 360;
			confetti.push({
				x: c.x,
				y: c.y,
				vx: Math.cos(a) * s + c.vx * 0.3,
				vy: Math.sin(a) * s - 60 + c.vy * 0.3,
				rot: Math.random() * 6,
				vr: (Math.random() - 0.5) * 18,
				w: 4 + Math.random() * 5,
				h: 3 + Math.random() * 4,
				life: 1.4 + Math.random() * 0.8,
				age: 0,
				color: Math.random() < 0.55 ? b.confettiColor : CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
			});
		}
	}

	// ---- simulation ----
	let simTime = 0;

	function stepBalloon(b, dt) {
		const nodes = b.nodes;
		const last = SEGMENTS + 1;
		const alive = b.state === "alive" || b.state === "inflating";
		const lift = b.state === "alive" ? 1 : b.state === "inflating" ? Math.max(0, Math.min(1, b.t / 0.8)) : 0;
		const breeze = reducedMotion ? 0 : 1;
		const gust = Math.sin(simTime * 0.55 + b.phase) + 0.6 * Math.sin(simTime * 1.37 + b.phase * 2.1);

		for (let k = 1; k <= last; k++) {
			const n = nodes[k];
			const isCentre = k === last;
			let ay = GRAVITY;
			if (isCentre && alive) ay = -LIFT * lift;
			else if (isCentre) ay = GRAVITY;
			const ax = breeze * gust * (isCentre ? 46 : 14);
			if (isCentre && b.grab) {
				n.vx = Math.max(-1800, Math.min(1800, (pointerX + b.grab.ox - n.x) * 24));
				n.vy = Math.max(-1800, Math.min(1800, (pointerY + b.grab.oy - n.y) * 24));
			}
			const drag = Math.exp(-(isCentre ? 1.5 : 1.1) * dt);
			n.vx = (n.vx + ax * dt) * drag;
			n.vy = (n.vy + ay * dt) * drag;
			n.px = n.x;
			n.py = n.y;
			n.x += n.vx * dt;
			n.y += n.vy * dt;
		}
		// anchor stays put
		nodes[0].x = nodes[0].px = anchorX(b);
		nodes[0].y = nodes[0].py = height - 18;

		for (let iter = 0; iter < 10; iter++) {
			for (let i = 0; i <= SEGMENTS; i++) {
				const a = nodes[i];
				const c = nodes[i + 1];
				const rest = i < SEGMENTS ? b.seg : ROD;
				let dx = c.x - a.x;
				let dy = c.y - a.y;
				const dist = Math.hypot(dx, dy) || 0.0001;
				// strings only resist stretching; the knot rod is rigid
				if (i < SEGMENTS && dist < rest) continue;
				const diff = (dist - rest) / dist;
				const ws = a.w + c.w;
				a.x += (dx * diff * a.w) / ws;
				a.y += (dy * diff * a.w) / ws;
				c.x -= (dx * diff * c.w) / ws;
				c.y -= (dy * diff * c.w) / ws;
			}
			// bay bounds
			for (let k = 1; k <= last; k++) {
				const n = nodes[k];
				const pad = k === last ? R : 3;
				if (n.x < pad) n.x = pad;
				else if (n.x > width - pad) n.x = width - pad;
				if (n.y < pad) n.y = pad;
				else if (n.y > height - 4) n.y = height - 4;
			}
		}
		for (let k = 1; k <= last; k++) {
			const n = nodes[k];
			n.vx = (n.x - n.px) / dt;
			n.vy = (n.y - n.py) / dt;
		}
	}

	function collide() {
		for (let i = 0; i < balloons.length; i++) {
			const a = balloons[i];
			if (a.state !== "alive" && a.state !== "inflating") continue;
			if (a.t < 0) continue;
			const ca = a.nodes[SEGMENTS + 1];
			for (let j = i + 1; j < balloons.length; j++) {
				const b = balloons[j];
				if (b.state !== "alive" && b.state !== "inflating") continue;
				if (b.t < 0) continue;
				const cb = b.nodes[SEGMENTS + 1];
				let dx = cb.x - ca.x;
				let dy = cb.y - ca.y;
				const d = Math.hypot(dx, dy) || 0.0001;
				const min = R * 2 * 0.96;
				if (d >= min) continue;
				dx /= d;
				dy /= d;
				const push = (min - d) / 2;
				ca.x -= dx * push;
				ca.y -= dy * push;
				cb.x += dx * push;
				cb.y += dy * push;
				const vn = (cb.vx - ca.vx) * dx + (cb.vy - ca.vy) * dy;
				if (vn < 0) {
					const j2 = (-(1 + 0.82) * vn) / 2;
					ca.vx -= j2 * dx;
					ca.vy -= j2 * dy;
					cb.vx += j2 * dx;
					cb.vy += j2 * dy;
				}
			}
		}
	}

	function advance(dt) {
		simTime += dt;
		for (const b of balloons) {
			b.t += dt;
			if (b.state === "inflating" && b.t >= 0) {
				if (b.el.classList.contains("is-hidden") && b.t - dt < 0) {
					const knot = b.nodes[SEGMENTS];
					const c = b.nodes[SEGMENTS + 1];
					c.x = c.px = knot.x;
					c.y = c.py = knot.y - ROD;
					b.el.classList.remove("is-hidden");
				}
				if (b.t >= 0.9) b.state = "alive";
			} else if (b.state === "popped" && b.t > 1.5) {
				b.state = "inflating";
				b.t = 0;
				const knot = b.nodes[SEGMENTS];
				const c = b.nodes[SEGMENTS + 1];
				c.x = c.px = knot.x;
				c.y = c.py = knot.y - ROD;
				c.vx = c.vy = 0;
				b.el.classList.remove("is-hidden");
			}
			if (b.t >= 0 || b.state === "popped") stepBalloon(b, dt);
		}
		collide();
		for (let i = confetti.length - 1; i >= 0; i--) {
			const p = confetti[i];
			p.age += dt;
			p.vy += 520 * dt;
			p.vx *= Math.exp(-1.6 * dt);
			p.vy *= Math.exp(-0.9 * dt);
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.rot += p.vr * dt;
			if (p.age > p.life) confetti.splice(i, 1);
		}
		for (let i = rings.length - 1; i >= 0; i--) {
			rings[i].t += dt;
			if (rings[i].t > 0.4) rings.splice(i, 1);
		}
	}

	// ---- rendering ----
	function render() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);

		// ground
		ctx.strokeStyle = groundColor;
		ctx.lineWidth = 2;
		ctx.setLineDash([2, 9]);
		ctx.lineCap = "round";
		ctx.beginPath();
		ctx.moveTo(14, height - 10);
		ctx.lineTo(width - 14, height - 10);
		ctx.stroke();
		ctx.setLineDash([]);

		ctx.lineWidth = 1.5;
		ctx.lineJoin = "round";
		for (const b of balloons) {
			const n = b.nodes;
			// cleat
			ctx.fillStyle = stringColor;
			ctx.beginPath();
			ctx.roundRect(n[0].x - 7, height - 18, 14, 9, 3);
			ctx.fill();
			if (b.t < 0 && b.state === "inflating") continue;
			ctx.strokeStyle = stringColor;
			ctx.beginPath();
			ctx.moveTo(n[0].x, n[0].y);
			for (let k = 1; k < SEGMENTS; k++) {
				const mx = (n[k].x + n[k + 1].x) / 2;
				const my = (n[k].y + n[k + 1].y) / 2;
				ctx.quadraticCurveTo(n[k].x, n[k].y, mx, my);
			}
			ctx.lineTo(n[SEGMENTS].x, n[SEGMENTS].y);
			ctx.stroke();
			if (b.state === "popped") {
				// deflated rubber scrap at the end of the string
				ctx.fillStyle = b.confettiColor;
				ctx.beginPath();
				const k = n[SEGMENTS];
				ctx.moveTo(k.x, k.y);
				ctx.lineTo(k.x - 5, k.y + 9);
				ctx.lineTo(k.x + 4, k.y + 7);
				ctx.closePath();
				ctx.fill();
			}
		}

		for (const ring of rings) {
			const p = ring.t / 0.4;
			ctx.strokeStyle = ring.color;
			ctx.globalAlpha = 1 - p;
			ctx.lineWidth = 3 * (1 - p) + 0.5;
			ctx.beginPath();
			ctx.arc(ring.x, ring.y, R * (0.6 + p * 1.3), 0, Math.PI * 2);
			ctx.stroke();
		}
		for (const p of confetti) {
			ctx.globalAlpha = Math.min(1, (p.life - p.age) * 2);
			ctx.fillStyle = p.color;
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.rot);
			ctx.scale(1, Math.abs(Math.cos(p.rot * 1.7)) * 0.8 + 0.2);
			ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
			ctx.restore();
		}
		ctx.globalAlpha = 1;

		for (const b of balloons) {
			if (b.state === "popped" || b.t < 0) continue;
			const knot = b.nodes[SEGMENTS];
			const c = b.nodes[SEGMENTS + 1];
			const theta = Math.atan2(c.x - knot.x, -(c.y - knot.y));
			const s = b.state === "inflating" ? Math.max(0.05, easeElastic(b.t / 0.9)) : 1;
			b.el.style.transform = `translate3d(${(knot.x - W / 2).toFixed(2)}px, ${(knot.y - H).toFixed(2)}px, 0) rotate(${theta.toFixed(3)}rad) scale(${s.toFixed(3)})`;
		}
	}

	// ---- loop ----
	let raf = 0;
	let running = false;
	let last = 0;
	let acc = 0;
	let visible = true;

	function frame(now) {
		raf = 0;
		if (!running) return;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		acc += dt;
		let steps = 0;
		while (acc >= STEP && steps < 8) {
			advance(STEP);
			acc -= STEP;
			steps++;
		}
		render();
		const busy = confetti.length > 0 || rings.length > 0 || balloons.some((b) => b.state !== "alive");
		if (reducedMotion && !busy && now > awakeUntil) {
			running = false;
			return;
		}
		raf = requestAnimationFrame(frame);
	}

	function start() {
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

	function fit() {
		width = bay.clientWidth;
		height = bay.clientHeight;
		dpr = Math.min(1.5, window.devicePixelRatio || 1);
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
	}

	function resetAll() {
		confetti.length = 0;
		rings.length = 0;
		balloons.forEach((b, i) => resetBalloon(b, reducedMotion ? 0 : -(0.1 + i * 0.14)));
		simTime = 0;
		if (reducedMotion) {
			for (let i = 0; i < 480; i++) advance(STEP);
			balloons.forEach((b) => {
				b.state = "alive";
				b.el.classList.remove("is-hidden");
			});
			for (let i = 0; i < 240; i++) advance(STEP);
			render();
		} else {
			start();
		}
	}

	fit();
	resetAll();

	const resizeObserver = new ResizeObserver(() => {
		fit();
		render();
	});
	resizeObserver.observe(bay);

	const intersection = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (visible) {
			if (!reducedMotion) start();
		} else stop();
	});
	intersection.observe(bay);

	const onVisibility = () => {
		if (document.hidden) stop();
		else if (!reducedMotion) start();
	};

	resetButton.addEventListener("click", () => {
		resetAll();
		wake();
	});
	window.addEventListener("pointermove", onPointerMove, { passive: true });
	bay.addEventListener("pointerdown", onPointerDown);
	window.addEventListener("pointerup", onPointerUp);
	window.addEventListener("pointercancel", onPointerUp);
	bay.addEventListener("click", onClickCapture, true);
	document.addEventListener("visibilitychange", onVisibility);

	return () => {
		stop();
		resizeObserver.disconnect();
		intersection.disconnect();
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerUp);
		document.removeEventListener("visibilitychange", onVisibility);
	};
}
