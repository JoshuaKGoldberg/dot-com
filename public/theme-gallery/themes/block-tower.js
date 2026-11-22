// Project Jenga: real project cards become planks in a Matter.js tower.
// Matter is imported dynamically only once the tower scrolls near the viewport, and it
// stays asleep (zero frames) until somebody pulls a block.

const STEP_MS = 1000 / 120;
const BEAM_LABELS = ["TypeScript", "ESLint", "Prettier", "AST", "Types", "Rules", "Flint", "Node", "Vitest", "CI", "Docs", "OSS"];
const PLANK_H = 74;
const BEAM_H = 46;
const FLOOR = 18;
const LAYERS = 8;

export function activate({ root, reducedMotion }) {
	const section = root.querySelector(".site-projects");
	const list = section?.querySelector(".site-list");
	if (!section || !list) return undefined;
	const projects = [...list.querySelectorAll(".site-item")];
	if (!projects.length) return undefined;

	const wrap = document.createElement("div");
	wrap.className = "jt-wrap";
	const stage = document.createElement("div");
	stage.className = "jt-stage";
	const table = document.createElement("div");
	table.className = "jt-table";
	table.setAttribute("aria-hidden", "true");
	const tower = document.createElement("ul");
	tower.className = "jt-tower";
	const beamLayer = document.createElement("div");
	beamLayer.setAttribute("aria-hidden", "true");
	beamLayer.className = "jt-tower";
	stage.append(table, beamLayer, tower);

	const bar = document.createElement("div");
	bar.className = "jt-bar";
	const status = document.createElement("span");
	status.className = "jt-status";
	status.setAttribute("role", "status");
	const hint = document.createElement("p");
	hint.className = "jt-hint";
	hint.textContent = "Drag a block out of the tower. Gently.";
	const resetButton = document.createElement("button");
	resetButton.className = "jt-reset";
	resetButton.type = "button";
	resetButton.textContent = "Rebuild tower";
	bar.append(status, hint, resetButton);
	wrap.append(stage, bar);
	list.replaceWith(wrap);

	const callout = document.createElement("span");
	callout.className = "jt-callout";
	callout.setAttribute("aria-hidden", "true");
	callout.textContent = "pull one out";
	stage.append(callout);

	// ---- blocks (DOM first, so the tower is visible before physics loads) ----
	const blocks = [];
	let beamIndex = 0;
	for (let layer = 0; layer < LAYERS; layer++) {
		if (layer % 2 === 0) {
			for (let k = 0; k < 3; k++) {
				const el = document.createElement("div");
				el.className = `jt-block jt-beam jt-w${(layer + k) % 3}`;
				el.textContent = BEAM_LABELS[beamIndex++ % BEAM_LABELS.length];
				beamLayer.append(el);
				blocks.push({ el, layer, slot: k, kind: "beam", body: null, written: "" });
			}
		} else {
			const el = projects[(layer - 1) / 2];
			if (!el) continue;
			el.classList.add("jt-block", "jt-plank");
			tower.append(el);
			blocks.push({ el, layer, slot: 0, kind: "plank", body: null, written: "" });
		}
	}
	for (const link of tower.querySelectorAll("a")) link.draggable = false;

	let stageW = 0;
	let stageH = 0;
	let towerW = 480;
	let floorTop = 0;

	function home(block) {
		let y = floorTop;
		for (let l = 0; l <= block.layer; l++) {
			const h = l % 2 === 0 ? BEAM_H : PLANK_H;
			y -= h + 0.6;
			if (l === block.layer) y += h / 2;
		}
		let x = stageW / 2;
		let w = towerW;
		if (block.kind === "beam") {
			w = towerW / 3 - 0.6;
			x = stageW / 2 - towerW / 2 + (block.slot + 0.5) * (towerW / 3);
		}
		return { x, y, w, h: block.kind === "beam" ? BEAM_H : PLANK_H };
	}

	function layout() {
		const rootRect = root.getBoundingClientRect();
		stage.style.width = "";
		stage.style.marginLeft = "";
		const natural = stage.getBoundingClientRect();
		stageW = Math.round(root.clientWidth);
		stage.style.width = `${stageW}px`;
		stage.style.marginLeft = `${Math.round(rootRect.left - natural.left)}px`;
		towerW = Math.max(300, Math.min(480, stageW - 28));
		stageH = LAYERS / 2 * (BEAM_H + PLANK_H) + 8 * 0.6 + FLOOR + 36;
		stage.style.height = `${stageH}px`;
		floorTop = stageH - FLOOR;
		for (const block of blocks) {
			const h = home(block);
			block.w = h.w;
			block.h = h.h;
			block.el.style.width = `${h.w}px`;
			block.el.style.height = `${h.h}px`;
			if (!block.body) place(block, h.x, h.y, 0);
		}
		// callout hangs off the right side of a middle beam
		const mid = blocks.find((b) => b.layer === 4 && b.slot === 2);
		if (mid) {
			const h = home(mid);
			callout.style.transform = `translate(${h.x + h.w / 2 + 10}px, ${h.y - 6}px)`;
		}
	}

	function place(block, x, y, angle) {
		const value = `translate3d(${(x - block.w / 2).toFixed(2)}px, ${(y - block.h / 2).toFixed(2)}px, 0) rotate(${angle.toFixed(4)}rad)`;
		if (value !== block.written) {
			block.written = value;
			block.el.style.transform = value;
		}
	}

	// ---- physics ----
	let Matter = null;
	let engine = null;
	let floorBody = null;
	let loading = false;
	let failed = false;
	let drag = null;
	let swallowClick = false;
	let raf = 0;
	let running = false;
	let last = 0;
	let acc = 0;
	let visible = false;
	let touched = false;
	let settledFrames = 0;
	let collapsed = false;
	let calmMs = 0;

	async function loadEngine() {
		if (Matter || loading || failed) return;
		loading = true;
		try {
			const module = await import("https://esm.sh/matter-js@0.20.0");
			Matter = module.default ?? module;
			buildWorld();
		} catch {
			failed = true;
			hint.textContent = "Physics engine could not load (offline?). The tower is standing, just stiff.";
		}
		loading = false;
	}

	function buildWorld() {
		const { Engine, Bodies, Composite, Sleeping } = Matter;
		if (engine) Composite.clear(engine.world, false);
		engine = Engine.create({
			enableSleeping: true,
			positionIterations: 12,
			velocityIterations: 10,
			constraintIterations: 4,
		});
		engine.gravity.y = 1;
		const w = stageW;
		const wallOpts = { isStatic: true, friction: 0.6, restitution: 0.1 };
		floorBody = Bodies.rectangle(w / 2, floorTop + 100, w + 400, 200, { ...wallOpts, friction: 0.9 });
		const left = Bodies.rectangle(-60, stageH / 2, 120, stageH * 3, wallOpts);
		const right = Bodies.rectangle(w + 60, stageH / 2, 120, stageH * 3, wallOpts);
		Composite.add(engine.world, [floorBody, left, right]);
		for (const block of blocks) {
			const h = home(block);
			block.w = h.w;
			block.h = h.h;
			const body = Bodies.rectangle(h.x, h.y, h.w, h.h, {
				friction: 0.85,
				frictionStatic: 2,
				frictionAir: 0.012,
				restitution: 0.04,
				density: block.kind === "plank" ? 0.0016 : 0.002,
				slop: 0.04,
				sleepThreshold: 45,
			});
			body.plugin = { block };
			block.body = body;
			block.home = h;
			Composite.add(engine.world, body);
			Sleeping.set(body, true);
			place(block, h.x, h.y, 0);
		}
		collapsed = false;
		updateStatus("standing");
	}

	function wakeAll() {
		for (const block of blocks) block.body && Matter.Sleeping.set(block.body, false);
	}

	function updateStatus(state, extra = "") {
		status.dataset.state = state;
		status.textContent =
			state === "down" ? "Timber! The tower fell." : state === "wobble" ? `Wobbling${extra}` : `Standing${extra}`;
	}

	function evaluate() {
		if (!Matter) return;
		let displaced = 0;
		let toppled = 0;
		let awake = 0;
		for (const block of blocks) {
			const b = block.body;
			const d = Math.hypot(b.position.x - block.home.x, b.position.y - block.home.y);
			if (d > 30 || Math.abs(b.angle) > 0.2) displaced++;
			if (b.position.y > block.home.y + 55 || Math.abs(b.angle) > 0.5) toppled++;
			if (!b.isSleeping) awake++;
		}
		const topPlank = blocks[blocks.length - 1];
		const topDrop = topPlank.body.position.y - topPlank.home.y;
		const fell = topDrop > 70 || toppled >= 6;
		if (fell && !collapsed) collapsed = true;
		if (collapsed) updateStatus("down");
		else if (awake > 0) updateStatus("wobble", ` · ${displaced} out of place`);
		else updateStatus("standing", displaced ? ` · ${displaced} out of place` : "");
		return awake;
	}

	function frame(now) {
		raf = 0;
		if (!running) return;
		acc += Math.min(100, now - last);
		last = now;
		let steps = 0;
		while (acc >= STEP_MS && steps < 6) {
			Matter.Engine.update(engine, STEP_MS);
			acc -= STEP_MS;
			steps++;
		}
		let awake = 0;
		let lively = false;
		for (const block of blocks) {
			const b = block.body;
			if (!b.isSleeping && (b.speed > 0.12 || Math.abs(b.angularSpeed) > 0.0025)) lively = true;
		}
		calmMs = lively || drag ? 0 : calmMs + steps * STEP_MS;
		if (calmMs > 450) {
			// resting contacts jitter forever in Matter; call it settled and put everything to sleep
			for (const block of blocks) {
				Matter.Body.setVelocity(block.body, { x: 0, y: 0 });
				Matter.Body.setAngularVelocity(block.body, 0);
				Matter.Sleeping.set(block.body, true);
			}
			calmMs = 0;
		}
		for (const block of blocks) {
			const b = block.body;
			if (!b.isSleeping || block === drag?.block) {
				place(block, b.position.x, b.position.y, b.angle);
				awake++;
			}
		}
		evaluate();
		settledFrames = awake === 0 && !drag ? settledFrames + 1 : 0;
		if (settledFrames > 10) {
			running = false;
			return;
		}
		raf = requestAnimationFrame(frame);
	}

	function wake() {
		if (!Matter || running || document.hidden) return;
		running = true;
		last = performance.now();
		acc = 0;
		settledFrames = 0;
		raf = requestAnimationFrame(frame);
	}

	function stop() {
		running = false;
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	// ---- dragging ----
	function stagePoint(event) {
		const rect = stage.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function onPointerDown(event) {
		if (event.button !== 0) return;
		const el = event.target.closest?.(".jt-block");
		if (!el || !stage.contains(el)) return;
		const block = blocks.find((b) => b.el === el);
		if (!block) return;
		if (!Matter || !block.body) {
			loadEngine();
			return;
		}
		const p = stagePoint(event);
		const { Constraint, Composite, Body } = Matter;
		const body = block.body;
		const cos = Math.cos(-body.angle);
		const sin = Math.sin(-body.angle);
		const dx = p.x - body.position.x;
		const dy = p.y - body.position.y;
		const local = { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
		wakeAll();
		const constraint = Constraint.create({
			pointA: { x: p.x, y: p.y },
			bodyB: body,
			pointB: local,
			stiffness: block.kind === "plank" ? 0.06 : 0.1,
			damping: 0.2,
			length: 0,
		});
		Composite.add(engine.world, constraint);
		void Body;
		drag = { block, constraint, startX: event.clientX, startY: event.clientY, moved: false, grab: { ...p } };
		touched = true;
		callout.classList.add("is-gone");
		block.el.classList.add("is-dragging");
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);
		wake();
	}

	function onPointerMove(event) {
		if (!drag) return;
		const p = stagePoint(event);
		if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
		// leash so a far-off cursor cannot yank the whole tower
		const body = drag.block.body;
		const gx = body.position.x;
		const gy = body.position.y;
		const dx = p.x - gx;
		const dy = p.y - gy;
		const d = Math.hypot(dx, dy);
		const max = 260;
		const k = d > max ? max / d : 1;
		drag.constraint.pointA.x = gx + dx * k;
		drag.constraint.pointA.y = gy + dy * k;
		wake();
	}

	function onPointerUp() {
		if (!drag) return;
		Matter.Composite.remove(engine.world, drag.constraint);
		drag.block.el.classList.remove("is-dragging");
		if (drag.moved) {
			swallowClick = true;
			setTimeout(() => (swallowClick = false), 0);
		}
		drag = null;
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerUp);
		wake();
	}

	function onClickCapture(event) {
		if (swallowClick) {
			event.preventDefault();
			event.stopPropagation();
			swallowClick = false;
		}
	}

	function onHover() {
		loadEngine();
	}

	function reset() {
		stop();
		drag = null;
		if (!Matter) {
			layout();
			return;
		}
		for (const block of blocks) {
			block.el.classList.remove("is-dragging");
			block.written = "";
		}
		layout();
		buildWorld();
		for (const block of blocks) block.el.style.transform = "";
		for (const block of blocks) place(block, block.home.x, block.home.y, 0);
		callout.classList.toggle("is-gone", touched);
		updateStatus("standing");
	}

	// ---- wiring ----
	updateStatus("standing");
	layout();
	const resizeObserver = new ResizeObserver(() => {
		const before = stageW;
		const w = Math.round(root.clientWidth);
		if (w === before) return;
		if (Matter && engine && touched) return; // do not rebuild a half-collapsed tower
		layout();
		if (Matter) {
			buildWorld();
			for (const block of blocks) place(block, block.home.x, block.home.y, 0);
		}
	});
	resizeObserver.observe(root);

	const intersection = new IntersectionObserver(
		([entry]) => {
			visible = entry.isIntersecting;
			if (visible) {
				("requestIdleCallback" in window ? requestIdleCallback : setTimeout)(() => loadEngine());
			} else stop();
		},
		{ root: null, rootMargin: "500px 0px" },
	);
	intersection.observe(stage);

	const onVisibility = () => {
		if (document.hidden) stop();
		else if (visible) wake();
	};

	stage.addEventListener("pointerdown", onPointerDown);
	stage.addEventListener("pointerenter", onHover);
	stage.addEventListener("click", onClickCapture, true);
	resetButton.addEventListener("click", reset);
	document.addEventListener("visibilitychange", onVisibility);
	if (reducedMotion) callout.classList.add("is-gone");

	return () => {
		stop();
		resizeObserver.disconnect();
		intersection.disconnect();
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerUp);
		document.removeEventListener("visibilitychange", onVisibility);
		if (Matter && engine) {
			Matter.Composite.clear(engine.world, false);
			Matter.Engine.clear(engine);
		}
	};
}
