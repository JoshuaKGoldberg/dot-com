// #65 Marble Run: the page's real boxes become tilted static bodies (matter-js); glass marbles roll across them.
import { bindKeys, clamp, createLoop, createPill, dprCap, isInteractiveTarget, whenIdle } from "./physics-kit/kit.js";

const MATTER_URL = "https://esm.sh/matter-js@0.20.0";
const COLORS = [
	["#ff5a4a", "#ffd1c9"],
	["#2d9bff", "#cfe9ff"],
	["#ffc21a", "#fff0b5"],
	["#2fcf7a", "#c8f5db"],
	["#a35bff", "#e6d2ff"],
	["#ff7bc4", "#ffd6ec"],
];

export function activate({ root, reducedMotion }) {
	const overlay = root.querySelector(".overlay-a");
	if (!overlay) return undefined;
	let Matter;
	let engine;
	let running = false;
	let disposed = false;
	let marbles = [];
	let statics = [];
	let planks = [];
	let canvas;
	let ctx;
	let dpr = 1;
	let VW = 0;
	let VH = 0;
	let docH = 0;
	let sprites = [];
	let dropTimer = 0;
	let follow = false;
	let auto = !reducedMotion;
	let lastAuto = 0;
	let time = 0;
	let resizeTimer;
	let count = 0;

	const ui = createPill(root, {
		pos: "right",
		hint: "Click anywhere to drop a marble",
		items: [
			{ id: "drop", label: "Drop", key: "b", primary: true, title: "Drop a marble", onClick: () => drop() },
			{ id: "auto", label: "Stream", key: "s", pressed: auto, title: "Toggle the automatic stream", onClick: () => toggleAuto() },
			{ id: "follow", label: "Follow", key: "f", pressed: false, onClick: () => toggleFollow() },
			"sep",
			{ id: "flat", label: "Flatten", key: "p", title: "Back to the normal page", onClick: () => toggleRun() },
		],
	});

	const keys = bindKeys({ b: () => drop(), s: () => toggleAuto(), f: () => toggleFollow(), p: () => toggleRun() });

	function toggleAuto() {
		auto = !auto;
		ui.buttons.auto.setAttribute("aria-pressed", String(auto));
		if (auto) loop?.start();
	}

	function toggleFollow() {
		follow = !follow;
		ui.buttons.follow.setAttribute("aria-pressed", String(follow));
		loop?.start();
	}

	function toggleRun() {
		if (running) {
			teardown();
			ui.buttons.flat.labelNode.textContent = "Run";
			ui.buttons.flat.title = "Make it a marble run (P)";
			ui.hint("Normal page. Press P to build the run again.");
		} else {
			start();
			ui.buttons.flat.labelNode.textContent = "Flatten";
			ui.buttons.flat.title = "Back to the normal page (P)";
		}
	}

	const loop = createLoop({
		hz: 120,
		maxSteps: 3,
		step: (dt) => {
			if (!engine) return false;
			time += dt;
			Matter.Engine.update(engine, dt * 1000);
			if (auto && time - lastAuto > 1.15 && marbles.length < capCount()) {
				lastAuto = time;
				drop();
			}
			// Retire marbles that have come to rest at the bottom (or been around too long).
			for (let i = marbles.length - 1; i >= 0; i--) {
				const m = marbles[i];
				const sp = Math.hypot(m.body.velocity.x, m.body.velocity.y);
				m.rest = sp < 0.25 ? m.rest + dt : 0;
				m.age += dt;
				if (m.rest > 5 || m.age > 40 || m.body.position.y > docH + 200) m.dying = (m.dying ?? 0) + dt * 2.2;
				if (m.dying >= 1) {
					Matter.Composite.remove(engine.world, m.body);
					marbles.splice(i, 1);
				}
			}
			return marbles.length > 0 || auto;
		},
		render: draw,
	});

	function capCount() {
		return clamp(Math.floor((VW * VH) / 26000), 14, 42);
	}

	async function start() {
		if (running) return;
		running = true;
		root.classList.add("mr-on", "mr-flat");
		if (!Matter) {
			try {
				const mod = await import(/* @vite-ignore */ MATTER_URL);
				Matter = mod.default ?? mod;
			} catch {
				running = false;
				root.classList.remove("mr-on", "mr-flat");
				ui.hint("Couldn't load the physics engine (offline?).");
				return;
			}
		}
		if (disposed || !running) return;
		build();
	}

	function tiltFor(el, idx) {
		if (el.classList.contains("site-item")) {
			const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("site-item"));
			return siblings.indexOf(el) % 2 === 0 ? 4 : -4;
		}
		return (idx % 2 ? -1 : 1) * (el.matches(".site-title") ? 4 : el.matches(".site-nav-link") ? 7 : 3);
	}

	function build() {
		const { Engine, Bodies, Composite } = Matter;
		const rr = root.getBoundingClientRect();
		VW = rr.width;
		VH = rr.height;
		dpr = dprCap(1.5);
		canvas = document.createElement("canvas");
		canvas.className = "mr-canvas";
		canvas.setAttribute("aria-hidden", "true");
		canvas.width = Math.round(VW * dpr);
		canvas.height = Math.round(VH * dpr);
		overlay.append(canvas);
		ctx = canvas.getContext("2d");
		makeSprites();

		engine = Engine.create({ enableSleeping: false, positionIterations: 6, velocityIterations: 5 });
		engine.gravity.y = 1;
		engine.gravity.scale = 0.0017;
		time = 0;
		lastAuto = reducedMotion ? 0 : 0.6;

		// Measure the flat layout (tilt is disabled by .mr-flat), in content coordinates.
		const sc = root.scrollTop;
		docH = root.scrollHeight;
		const sel = [
			".site-logo",
			".site-nav-link",
			".site-title",
			".site-tagline",
			".site-socials a",
			".site-about p",
			".site-section-title",
			".site-item",
			".site-footer p",
		].join(",");
		planks = [];
		statics = [];
		let idx = 0;
		for (const el of root.querySelectorAll(sel)) {
			const r = el.getBoundingClientRect();
			if (r.width < 20 || r.height < 8) continue;
			const tilt = tiltFor(el, idx++);
			el.classList.add("mr-plank");
			el.style.setProperty("--mr-tilt", `${tilt}deg`);
			const cx = r.left - rr.left + r.width / 2;
			const cy = r.top - rr.top + sc + r.height / 2;
			// CSS margin stagger on list items is applied after .mr-flat is removed, so measure that too.
			planks.push({ el, cx, cy, w: r.width, h: r.height, tilt });
		}
		const portrait = root.querySelector(".site-portrait");
		// Re-measure after the stagger margins apply (flat, no transitions on layout besides gap/margins).
		root.classList.add("mr-measure");
		void root.offsetWidth;
		docH = root.scrollHeight;
		for (const p of planks) {
			const r = p.el.getBoundingClientRect();
			// rotate:none while flat, so the rect is the true box.
			p.cx = r.left - rr.left + r.width / 2;
			p.cy = r.top - rr.top + sc + r.height / 2;
			p.w = r.width;
			p.h = r.height;
		}
		const bodies = planks.map((p) =>
			Bodies.rectangle(p.cx, p.cy, p.w, Math.max(p.h, 10), {
				isStatic: true,
				angle: (p.tilt * Math.PI) / 180,
				friction: 0.04,
				restitution: 0.12,
				chamfer: { radius: Math.min(8, p.h / 3) },
			}),
		);
		if (portrait) {
			const r = portrait.getBoundingClientRect();
			bodies.push(
				Bodies.circle(r.left - rr.left + r.width / 2, r.top - rr.top + sc + r.height / 2, r.width / 2, {
					isStatic: true,
					restitution: 0.6,
					friction: 0.02,
				}),
			);
		}
		const W = VW;
		bodies.push(
			Bodies.rectangle(W / 2, docH + 40, W + 400, 100, { isStatic: true, friction: 0.2, restitution: 0.3 }),
			Bodies.rectangle(-30, docH / 2, 60, docH * 2, { isStatic: true }),
			Bodies.rectangle(W + 30, docH / 2, 60, docH * 2, { isStatic: true }),
		);
		statics = bodies;
		Composite.add(engine.world, bodies);
		root.classList.remove("mr-measure", "mr-flat"); // tilt springs in

		window.addEventListener("pointerdown", onDown);
		root.addEventListener("wheel", onUserScroll, { passive: true });
		root.addEventListener("touchmove", onUserScroll, { passive: true });
		root.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onResize);

		if (reducedMotion) {
			// A static frame: a few marbles parked mid-run, no motion until the user acts.
			for (let i = 0; i < 4; i++) drop(VW * (0.3 + 0.12 * i), root.scrollTop + 80 + i * 40);
			for (let s = 0; s < 120; s++) Matter.Engine.update(engine, 1000 / 120);
		}
		ui.hint("Click anywhere to drop a marble · F follows the newest one");
		setTimeout(() => loop.start(), reducedMotion ? 0 : 700);
		draw();
	}

	function makeSprites() {
		sprites = COLORS.map(([c, hi]) => {
			const R = 9;
			const size = Math.ceil((R * 2 + 6) * dpr);
			const mk = () => {
				const cv = document.createElement("canvas");
				cv.width = cv.height = size;
				return cv;
			};
			const body = mk();
			const g = body.getContext("2d");
			g.scale(dpr, dpr);
			const c0 = R + 3;
			// Glass body: tinted core, lighter rim.
			const grad = g.createRadialGradient(c0 - 2, c0 - 2, 1, c0, c0, R);
			grad.addColorStop(0, hi);
			grad.addColorStop(0.55, c);
			grad.addColorStop(1, shade(c, -0.45));
			g.fillStyle = grad;
			g.beginPath();
			g.arc(c0, c0, R, 0, Math.PI * 2);
			g.fill();
			// Swirl ribbon so rotation is visible.
			g.save();
			g.beginPath();
			g.arc(c0, c0, R - 0.5, 0, Math.PI * 2);
			g.clip();
			g.strokeStyle = "rgb(255 255 255 / 0.85)";
			g.lineWidth = 2.4;
			g.beginPath();
			g.moveTo(c0 - R, c0 + 2);
			g.bezierCurveTo(c0 - 3, c0 - 7, c0 + 3, c0 + 7, c0 + R, c0 - 2);
			g.stroke();
			g.strokeStyle = shade(c, -0.55);
			g.lineWidth = 1.6;
			g.beginPath();
			g.moveTo(c0 - R, c0 + 6);
			g.bezierCurveTo(c0 - 2, c0 - 3, c0 + 4, c0 + 11, c0 + R, c0 + 3);
			g.stroke();
			g.restore();
			const gloss = mk();
			const h = gloss.getContext("2d");
			h.scale(dpr, dpr);
			const hl = h.createRadialGradient(c0 - 3.4, c0 - 4, 0.2, c0 - 3.4, c0 - 4, 4.2);
			hl.addColorStop(0, "rgb(255 255 255 / 0.95)");
			hl.addColorStop(1, "rgb(255 255 255 / 0)");
			h.fillStyle = hl;
			h.beginPath();
			h.arc(c0 - 3.4, c0 - 4, 4.2, 0, Math.PI * 2);
			h.fill();
			h.strokeStyle = "rgb(0 0 0 / 0.3)";
			h.lineWidth = 1;
			h.beginPath();
			h.arc(c0, c0, R - 0.5, 0, Math.PI * 2);
			h.stroke();
			return { body, gloss, size, c0 };
		});
	}

	function shade(hex, amt) {
		const n = Number.parseInt(hex.slice(1), 16);
		const f = (v) => clamp(Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt)), 0, 255);
		return `rgb(${f((n >> 16) & 255)} ${f((n >> 8) & 255)} ${f(n & 255)})`;
	}

	function drop(x, y) {
		if (!engine) return;
		const { Bodies, Composite, Body } = Matter;
		if (marbles.length > capCount() + 12) {
			const old = marbles[0];
			old.dying = Math.max(old.dying ?? 0, 0.5);
		}
		const px = x ?? 40 + Math.random() * (VW - 80);
		const py = y ?? root.scrollTop - 12;
		const r = 9 + Math.random() * 3;
		const body = Bodies.circle(px, py, r, {
			restitution: 0.42,
			friction: 0.015,
			frictionStatic: 0,
			frictionAir: 0.0006,
			density: 0.004,
			slop: 0.04,
		});
		Body.setVelocity(body, { x: (Math.random() - 0.5) * 3, y: 2 });
		Composite.add(engine.world, body);
		marbles.push({ body, r, sprite: count++ % sprites.length, spin: Math.random() * 6, last: px, age: 0, rest: 0 });
		loop.start();
	}

	function onDown(e) {
		if (e.button !== 0 || isInteractiveTarget(e.target)) return;
		const rr = root.getBoundingClientRect();
		if (e.clientX < rr.left || e.clientX > rr.right || e.clientY < rr.top || e.clientY > rr.bottom) return;
		if (getSelection()?.toString()) return;
		drop(e.clientX - rr.left, e.clientY - rr.top + root.scrollTop);
	}

	function onUserScroll() {
		if (follow) toggleFollow();
	}

	function onScroll() {
		if (!loop.running) draw();
	}

	function onResize() {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			if (!running) return;
			teardown();
			start();
		}, 250);
	}

	function draw() {
		if (!ctx) return;
		if (follow && marbles.length) {
			const newest = marbles[marbles.length - 1].body.position.y;
			const target = clamp(newest - VH * 0.45, 0, docH - VH);
			const cur = root.scrollTop;
			root.scrollTop = cur + (target - cur) * 0.08;
		}
		const sc = root.scrollTop;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, VW, VH);
		for (const m of marbles) {
			const x = m.body.position.x;
			const y = m.body.position.y - sc;
			if (y < -20 || y > VH + 20) continue;
			// Rolling spin from horizontal travel.
			m.spin += (x - m.last) / m.r;
			m.last = x;
			const s = sprites[m.sprite];
			const k = m.r / 9;
			const fade = 1 - clamp(m.dying ?? 0, 0, 1);
			ctx.globalAlpha = fade;
			// Contact shadow.
			ctx.fillStyle = "rgb(0 0 0 / 0.18)";
			ctx.beginPath();
			ctx.ellipse(x + 2, y + m.r * 0.85, m.r * 0.9, m.r * 0.45, 0, 0, 7);
			ctx.fill();
			ctx.save();
			ctx.translate(x, y);
			ctx.scale(k * fade ** 0.3, k * fade ** 0.3);
			ctx.save();
			ctx.rotate(m.spin);
			ctx.drawImage(s.body, -s.c0, -s.c0, s.size / dpr, s.size / dpr);
			ctx.restore();
			ctx.drawImage(s.gloss, -s.c0, -s.c0, s.size / dpr, s.size / dpr);
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	}

	function teardown() {
		running = false;
		loop.stop();
		clearTimeout(resizeTimer);
		window.removeEventListener("pointerdown", onDown);
		root.removeEventListener("wheel", onUserScroll);
		root.removeEventListener("touchmove", onUserScroll);
		root.removeEventListener("scroll", onScroll);
		window.removeEventListener("resize", onResize);
		for (const p of planks) {
			p.el.classList.remove("mr-plank");
			p.el.style.removeProperty("--mr-tilt");
		}
		root.classList.remove("mr-on", "mr-flat", "mr-measure");
		canvas?.remove();
		canvas = ctx = undefined;
		engine = undefined;
		marbles = [];
		planks = [];
		statics = [];
	}

	const cancelIdle = whenIdle(() => {
		if (!disposed) start();
	}, 400);

	return () => {
		disposed = true;
		cancelIdle();
		keys();
		teardown();
	};
}
