// #61 Rigid-Body Letters: every glyph in view becomes a matter-js rigid body driving its own span's transform.
import { bindKeys, createLoop, createPill, clamp } from "./physics-kit/kit.js";

const MATTER_URL = "https://esm.sh/matter-js@0.20.0";
const TEXT_SELECTOR = [
	".site-logo",
	".site-nav-link",
	".site-title",
	".site-tagline",
	".site-socials a",
	".site-about p",
	".site-section-title",
	".site-item-title",
	".site-item-description",
	".site-item-meta",
	".site-footer p",
	".site-footer a",
].join(",");
const STEP = 1000 / 60;

export function activate({ root, reducedMotion }) {
	let Matter;
	let engine;
	let on = false;
	let busy = false;
	let disposed = false;
	let letters = []; // {el, body, x0, y0, tx, ty, tr, written}
	let saved = []; // {el, html}
	let portrait;
	let drag;
	let scroll0 = 0;
	let rootRect;
	let restoring;
	let releaseTimers = [];

	const ui = createPill(root, {
		hint: "Every letter in view is a rigid body. Press G.",
		items: [
			{ id: "gravity", label: "Gravity", key: "g", primary: true, onClick: () => toggle(), title: "Let the letters fall" },
			{ id: "shake", label: "Shake", key: "s", onClick: () => shake() },
			{ id: "restore", label: "Restore", key: "r", onClick: () => restore() },
		],
	});
	ui.buttons.shake.disabled = true;
	ui.buttons.restore.disabled = true;

	const loop = createLoop({
		hz: 60,
		maxSteps: 2,
		step() {
			if (!engine) return false;
			Matter.Engine.update(engine, STEP);
			let awake = !!drag;
			for (const body of engine.world.bodies) {
				if (!body.isStatic && !body.isSleeping) {
					awake = true;
					break;
				}
			}
			return awake || releaseTimers.length > 0;
		},
		render: () => writeAll(),
	});

	const removeKeys = bindKeys({
		g: () => toggle(),
		r: () => restore(),
		s: () => shake(),
	});

	async function toggle() {
		if (on) {
			restore();
		} else {
			await enable();
		}
	}

	function setHint(text) {
		ui.hint(text);
	}

	async function enable() {
		if (on || busy || restoring) return;
		busy = true;
		ui.buttons.gravity.labelNode.textContent = "Loading…";
		try {
			if (!Matter) {
				const mod = await import(/* @vite-ignore */ MATTER_URL);
				Matter = mod.default ?? mod;
			}
		} catch {
			ui.buttons.gravity.labelNode.textContent = "Gravity";
			setHint("Couldn't load the physics engine (offline?).");
			busy = false;
			return;
		}
		busy = false;
		if (disposed) return;
		build();
	}

	function build() {
		const { Engine, Bodies, Composite, Body } = Matter;
		rootRect = root.getBoundingClientRect();
		scroll0 = root.scrollTop;
		const W = rootRect.width;
		const H = rootRect.height;

		engine = Engine.create({ enableSleeping: true, positionIterations: 8, velocityIterations: 5 });
		engine.gravity.y = 1;
		engine.gravity.scale = 0.0019;

		// 1. Split text in view into per-letter spans (inline first, so kerning is measured), then freeze widths.
		saved = [];
		const charSpans = [];
		for (const el of root.querySelectorAll(TEXT_SELECTOR)) {
			const r = el.getBoundingClientRect();
			if (r.bottom < rootRect.top - 4 || r.top > rootRect.bottom + 4 || r.width === 0) continue;
			saved.push({ el, html: el.innerHTML });
			splitText(el, charSpans);
		}
		const widths = charSpans.map((span) => span.getBoundingClientRect().width);
		charSpans.forEach((span, i) => {
			span.style.display = "inline-block";
			span.style.width = `${widths[i]}px`;
		});
		root.classList.add("ph-on");
		root.style.overflowY = "hidden";

		// 2. One rigid body per letter.
		letters = [];
		const bodies = [];
		const cap = Math.floor((W * H) / 700); // body cap scales with viewport area
		for (const span of charSpans) {
			if (letters.length >= cap) break;
			const r = span.getBoundingClientRect();
			if (r.width < 1 || r.bottom < rootRect.top || r.top > rootRect.bottom) continue;
			const fs = Number.parseFloat(getComputedStyle(span).fontSize) || 16;
			const w = Math.max(r.width * 0.96, 4);
			const h = clamp(fs * 0.74, 6, r.height);
			const x = r.left - rootRect.left + r.width / 2;
			const y = r.top - rootRect.top + r.height / 2;
			const body = Bodies.rectangle(x, y, w, h, {
				chamfer: { radius: Math.min(2, w / 3, h / 3) },
				density: 0.0016 + Math.min(fs, 60) * 0.00004,
				friction: 0.6,
				frictionStatic: 0.9,
				frictionAir: 0.006,
				restitution: 0.16,
				slop: 0.3,
				sleepThreshold: 45,
			});
			Body.setStatic(body, true);
			letters.push({ el: span, body, x0: x, y0: y, written: "" });
			bodies.push(body);
		}
		const portraitEl = root.querySelector(".site-portrait");
		portrait = undefined;
		if (portraitEl) {
			const r = portraitEl.getBoundingClientRect();
			if (r.bottom > rootRect.top && r.top < rootRect.bottom) {
				const x = r.left - rootRect.left + r.width / 2;
				const y = r.top - rootRect.top + r.height / 2;
				const body = Bodies.circle(x, y, (r.width / 2) * 0.97, {
					density: 0.0007,
					friction: 0.5,
					frictionAir: 0.004,
					restitution: 0.3,
					sleepThreshold: 45,
				});
				Body.setStatic(body, true);
				portrait = { el: portraitEl.firstElementChild?.tagName === "IMG" ? portraitEl : portraitEl, body, x0: x, y0: y, written: "" };
				letters.push(portrait);
				bodies.push(body);
			}
		}

		const wall = { isStatic: true, friction: 0.7, restitution: 0.1 };
		Composite.add(engine.world, [
			Bodies.rectangle(W / 2, H + 120, W + 600, 240, { ...wall, friction: 0.9 }),
			Bodies.rectangle(-120, H / 2, 240, H * 3, wall),
			Bodies.rectangle(W + 120, H / 2, 240, H * 3, wall),
			...bodies,
		]);

		// 3. Release in a cascade from the bottom of the page upward, like a shelf giving way.
		releaseTimers = letters.map((item) => {
			const delay = ((H - item.y0) / H) * 650 + Math.random() * 140;
			const id = setTimeout(() => {
				releaseTimers = releaseTimers.filter((t) => t !== id);
				if (!engine) return;
				Body.setStatic(item.body, false);
				Body.setAngularVelocity(item.body, (Math.random() - 0.5) * 0.08);
				Body.setVelocity(item.body, { x: (Math.random() - 0.5) * 1.2, y: 0 });
				loop.start();
			}, reducedMotion ? 0 : delay);
			return id;
		});

		on = true;
		ui.buttons.gravity.labelNode.textContent = "Gravity on";
		ui.buttons.gravity.setAttribute("aria-pressed", "true");
		ui.buttons.shake.disabled = false;
		ui.buttons.restore.disabled = false;
		setHint("Drag letters to toss them · click empty space for a shockwave · scroll is paused");
		window.addEventListener("pointerdown", onDown);
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		window.addEventListener("resize", onResize);
		loop.start();
	}

	function splitText(el, out) {
		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		const nodes = [];
		while (walker.nextNode()) nodes.push(walker.currentNode);
		for (const node of nodes) {
			if (!node.nodeValue.trim()) continue;
			const frag = document.createDocumentFragment();
			for (const token of node.nodeValue.split(/(\s+)/)) {
				if (!token) continue;
				if (/^\s+$/.test(token)) {
					frag.append(token);
					continue;
				}
				const word = document.createElement("span");
				word.className = "ph-w";
				word.style.whiteSpace = "nowrap";
				for (const ch of token) {
					const c = document.createElement("span");
					c.className = "ph-c";
					c.textContent = ch;
					word.append(c);
					out.push(c);
				}
				frag.append(word);
			}
			node.replaceWith(frag);
		}
	}

	function writeAll() {
		if (!on) return;
		const dScroll = 0; // scroll is locked while on
		for (const item of letters) {
			const { body } = item;
			if (body.isStatic) continue;
			const tx = body.position.x - item.x0 + dScroll;
			const ty = body.position.y - item.y0;
			const value = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) rotate(${body.angle.toFixed(3)}rad)`;
			if (value !== item.written) {
				item.written = value;
				item.el.style.transform = value;
			}
		}
	}

	function pointer(event) {
		return { x: event.clientX - rootRect.left, y: event.clientY - rootRect.top };
	}

	function pick(point) {
		const { Query } = Matter;
		const dynamic = letters.map((l) => l.body).filter((b) => !b.isStatic);
		const hit = Query.point(dynamic, point)[0];
		if (hit) return hit;
		let best;
		let bestD = 18 * 18;
		for (const body of dynamic) {
			const d = (body.position.x - point.x) ** 2 + (body.position.y - point.y) ** 2;
			if (d < bestD) {
				bestD = d;
				best = body;
			}
		}
		return best;
	}

	function onDown(event) {
		if (!on || event.button !== 0 || event.target.closest?.(".phys-pill")) return;
		const point = pointer(event);
		const body = pick(point);
		const { Constraint, Composite, Sleeping } = Matter;
		if (body) {
			event.preventDefault();
			Sleeping.set(body, false);
			const constraint = Constraint.create({
				pointA: point,
				bodyB: body,
				pointB: { x: point.x - body.position.x, y: point.y - body.position.y },
				stiffness: 0.14,
				damping: 0.06,
				length: 0.01,
			});
			Composite.add(engine.world, constraint);
			drag = { constraint, body };
			root.classList.add("ph-drag");
		} else {
			shockwave(point);
		}
		loop.start();
	}

	function onMove(event) {
		if (drag) {
			const point = pointer(event);
			drag.constraint.pointA = point;
			Matter.Sleeping.set(drag.body, false);
			loop.start();
		}
	}

	function onUp() {
		if (!drag) return;
		Matter.Composite.remove(engine.world, drag.constraint);
		const { body } = drag;
		const speed = Math.hypot(body.velocity.x, body.velocity.y);
		if (speed > 45) Matter.Body.setVelocity(body, { x: (body.velocity.x * 45) / speed, y: (body.velocity.y * 45) / speed });
		drag = undefined;
		root.classList.remove("ph-drag");
		loop.start();
	}

	function shockwave(point) {
		const { Body, Sleeping } = Matter;
		for (const { body } of letters) {
			if (body.isStatic) continue;
			const dx = body.position.x - point.x;
			const dy = body.position.y - point.y;
			const d = Math.hypot(dx, dy) || 1;
			if (d > 240) continue;
			const k = ((1 - d / 240) ** 1.5 * 0.0085 * body.mass * 60) / 6;
			Sleeping.set(body, false);
			Body.applyForce(body, body.position, { x: (dx / d) * k * 0.2, y: ((dy / d) * k - 0.35 * k) * 0.2 });
			Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.25);
		}
	}

	function shake() {
		if (!on) return;
		const { Body, Sleeping } = Matter;
		for (const { body } of letters) {
			if (body.isStatic) continue;
			Sleeping.set(body, false);
			Body.setVelocity(body, { x: (Math.random() - 0.5) * 12, y: -(7 + Math.random() * 13) });
			Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.4);
		}
		loop.start();
	}

	function onResize() {
		if (on) restore(true);
	}

	function restore(instant = false) {
		if (!on || restoring) return;
		on = false;
		releaseTimers.forEach(clearTimeout);
		releaseTimers = [];
		loop.stop();
		onUp();
		window.removeEventListener("pointerdown", onDown);
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		window.removeEventListener("resize", onResize);
		ui.buttons.shake.disabled = true;
		ui.buttons.restore.disabled = true;
		ui.buttons.gravity.setAttribute("aria-pressed", "false");

		const wrap = (a) => {
			let r = a % (Math.PI * 2);
			if (r > Math.PI) r -= Math.PI * 2;
			if (r < -Math.PI) r += Math.PI * 2;
			return r;
		};
		const homing = letters.map((item) => ({
			item,
			x: item.body.position.x - item.x0,
			y: item.body.position.y - item.y0,
			r: wrap(item.body.angle),
			vx: 0,
			vy: 0,
			vr: 0,
			delay: (item.y0 / rootRect.height) * 0.3 + Math.random() * 0.12,
		}));
		engine = undefined;

		const finish = () => {
			for (const { el, html } of saved) el.innerHTML = html;
			for (const { item } of homing) if (item === portrait) item.el.style.transform = "";
			saved = [];
			letters = [];
			portrait = undefined;
			root.classList.remove("ph-on");
			root.style.overflowY = "";
			restoring = undefined;
			ui.buttons.gravity.labelNode.textContent = "Gravity";
			setHint("Restored. Press G to drop it all again.");
		};

		if (instant || reducedMotion) {
			finish();
			return;
		}
		ui.buttons.gravity.labelNode.textContent = "Restoring…";
		setHint("Springing everything home…");
		let t = 0;
		let last = performance.now();
		const tick = (now) => {
			restoring = requestAnimationFrame(tick);
			const dt = Math.min(0.033, (now - last) / 1000);
			last = now;
			t += dt;
			let moving = false;
			for (const h of homing) {
				if (t < h.delay) {
					moving = true;
					continue;
				}
				// Underdamped spring with a little overshoot.
				for (const [p, v] of [["x", "vx"], ["y", "vy"], ["r", "vr"]]) {
					const k = p === "r" ? 120 : 140;
					const c = p === "r" ? 12 : 13;
					h[v] += (-k * h[p] - c * h[v]) * dt;
					h[p] += h[v] * dt;
					if (Math.abs(h[p]) > 0.2 || Math.abs(h[v]) > 0.3) moving = true;
				}
				h.item.el.style.transform = `translate(${h.x.toFixed(1)}px,${h.y.toFixed(1)}px) rotate(${h.r.toFixed(3)}rad)`;
			}
			if (!moving || t > 2.4) {
				cancelAnimationFrame(restoring);
				finish();
			}
		};
		restoring = requestAnimationFrame(tick);
	}

	return () => {
		disposed = true;
		on = false;
		loop.stop();
		releaseTimers.forEach(clearTimeout);
		if (typeof restoring === "number") cancelAnimationFrame(restoring);
		removeKeys();
		window.removeEventListener("pointerdown", onDown);
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		window.removeEventListener("resize", onResize);
	};
}
