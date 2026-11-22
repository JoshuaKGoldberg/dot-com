import { panel, h, clamp, loop } from "./_sensor/kit.js";

const DEAD = 0.18;
const SPEED = 650; // px/s at full deflection

export function activate({ root, reducedMotion }) {
	const cursor = h("div", { class: "gp-cursor", "aria-hidden": "true" });
	const overlay = root.querySelector(".overlay-b") ?? root;
	overlay.append(cursor);

	const cur = { x: innerWidth * 0.5, y: innerHeight * 0.5 };
	const sim = { x: 0, y: 0, scroll: 0, a: false };
	let realOn = false;
	let hovered = null;
	let pad = null; // last real gamepad index
	let prevBtn = {};
	let simActive = false;
	let rumbleTimer = 0;

	const scroller = root;
	const interactive = () =>
		[...root.querySelectorAll("a[href], button")].filter((el) => !el.closest(".sx-panel") && el.offsetParent !== null);
	const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

	function rumble() {
		rumbleLamp.classList.add("is-on");
		clearTimeout(rumbleTimer);
		rumbleTimer = setTimeout(() => rumbleLamp.classList.remove("is-on"), 140);
		const gp = pad != null && navigator.getGamepads?.()[pad];
		gp?.vibrationActuator?.playEffect?.("dual-rumble", { duration: 40, strongMagnitude: 0.15, weakMagnitude: 0.5 }).catch?.(() => {});
	}

	function setHover(el) {
		if (el === hovered) return;
		hovered?.classList.remove("gp-hover");
		hovered = el;
		if (el) {
			el.classList.add("gp-hover");
			rumble();
		}
	}
	function target() {
		const el = document.elementFromPoint(cur.x, cur.y);
		return el?.closest?.("a[href], button") ?? null;
	}
	function click() {
		const el = target();
		cursor.classList.add("is-press");
		setTimeout(() => cursor.classList.remove("is-press"), 140);
		el?.click();
	}
	function jump(dir) {
		const list = interactive();
		if (!list.length) return;
		let i = hovered ? list.indexOf(hovered) : -1;
		i = (i + dir + list.length) % list.length;
		const el = list[i];
		el.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
		const place = () => {
			const r = el.getBoundingClientRect();
			cur.x = clamp(r.left + Math.min(r.width / 2, 120), 8, innerWidth - 8);
			cur.y = clamp(r.top + r.height / 2, 8, innerHeight - 8);
			render();
			setHover(el);
		};
		place();
		setTimeout(place, reducedMotion ? 0 : 380);
	}
	function render() {
		cursor.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
	}

	function readReal() {
		if (!realOn) return null;
		const pads = navigator.getGamepads?.() ?? [];
		const gp = [...pads].find((p) => p?.connected);
		if (!gp) return null;
		pad = gp.index;
		if (!cursor.classList.contains("is-on")) {
			showCursor(true);
			ui.status(`Connected: ${gp.id.slice(0, 42)}. Left stick moves, A clicks, bumpers jump between links.`);
		}
		const b = (i) => !!gp.buttons[i]?.pressed;
		return {
			x: dz(gp.axes[0] ?? 0),
			y: dz(gp.axes[1] ?? 0),
			sy: dz(gp.axes[3] ?? 0) + (b(13) ? 1 : 0) - (b(12) ? 1 : 0),
			a: b(0),
			prev: b(4) || b(14),
			next: b(5) || b(15),
		};
	}

	const lp = loop((dt) => {
		const real = readReal();
		const x = (real?.x || 0) + sim.x;
		const y = (real?.y || 0) + sim.y;
		cur.x = clamp(cur.x + x * SPEED * dt, 0, innerWidth - 1);
		cur.y = clamp(cur.y + y * SPEED * dt, 0, innerHeight - 1);
		const sy = (real?.sy || 0) + sim.scroll;
		if (sy) scroller.scrollTop += sy * 900 * dt;
		render();
		// edge push scrolling: nudging the cursor against the top/bottom edge scrolls
		if (y && cur.y > innerHeight - 40) scroller.scrollTop += 500 * dt * y;
		if (y && cur.y < 60) scroller.scrollTop += 500 * dt * y;
		setHover(target());
		const now = { a: !!real?.a || sim.a, prev: !!real?.prev, next: !!real?.next };
		if (now.a && !prevBtn.a) click();
		if (now.prev && !prevBtn.prev) jump(-1);
		if (now.next && !prevBtn.next) jump(1);
		prevBtn = now;
		if (!realOn && !x && !y && !sy && !sim.a && !dragging) lp.stop();
	});

	function showCursor(on) {
		cursor.classList.toggle("is-on", on);
		if (!on) setHover(null);
	}

	// ---- panel ----
	const rumbleLamp = h("span", { class: "gp-rumble" });
	const knob = h("div", { class: "gp-knob", role: "slider", "aria-label": "Virtual stick", tabindex: "0", "aria-valuetext": "centered" });
	const padEl = h("div", { class: "gp-pad" }, knob);
	const ui = panel(root, {
		title: "Gamepad",
		statusIdle: "Off. Plug in a controller, then enable. Or use the virtual pad.",
		privacy: "Controller input is read locally and never stored or sent.",
		enable: { label: "Enable gamepad", run: enable },
		stopLabel: "Stop gamepad",
		onStop: stop,
		simLabel: "Virtual pad",
		controls: [],
	});
	const sims = ui.el.querySelector(".sx-sim") ?? (() => {
		const fs = h("fieldset", { class: "sx-sim" }, h("legend", {}, "Virtual pad"));
		ui.el.querySelector(".sx-body").insertBefore(fs, ui.el.querySelector(".sx-privacy"));
		return fs;
	})();
	const btn = (label, fn, title) => h("button", { class: "sx-chip", type: "button", title, onclick: fn }, label);
	const aBtn = h("button", { class: "sx-chip", type: "button", title: "A button: click under the cursor" }, "A: click");
	aBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); ensureSim(); sim.a = true; lp.start(); });
	const releaseA = () => (sim.a = false);
	aBtn.addEventListener("pointerup", releaseA);
	aBtn.addEventListener("pointerleave", releaseA);
	aBtn.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); ensureSim(); click(); } });
	sims.append(
		padEl,
		h("div", { class: "sx-seg" }, aBtn, btn("Prev link", () => { ensureSim(); jump(-1); }), btn("Next link", () => { ensureSim(); jump(1); })),
		h("div", { class: "sx-seg" }, btn("Scroll up", () => scroller.scrollBy({ top: -300, behavior: reducedMotion ? "auto" : "smooth" })), btn("Scroll down", () => scroller.scrollBy({ top: 300, behavior: reducedMotion ? "auto" : "smooth" }))),
		h("div", {}, rumbleLamp, "Rumble on focus (shown here when no controller)"),
	);

	function ensureSim() {
		simActive = true;
		showCursor(true);
		render();
		lp.start();
		if (!realOn) ui.status("Virtual pad: drag the stick, press A to click.");
	}

	// virtual stick: pointer drag, plus arrow keys when the knob is focused
	let dragging = false;
	const R = 36;
	const setStick = (dx, dy) => {
		const m = Math.hypot(dx, dy) || 1;
		const k = Math.min(1, m / R);
		sim.x = (dx / m) * k * (m < 6 ? 0 : 1);
		sim.y = (dy / m) * k * (m < 6 ? 0 : 1);
		knob.style.transform = `translate(${(dx / m) * k * R}px, ${(dy / m) * k * R}px)`;
		knob.setAttribute("aria-valuetext", sim.x || sim.y ? "deflected" : "centered");
	};
	knob.addEventListener("pointerdown", (e) => { dragging = true; knob.setPointerCapture(e.pointerId); ensureSim(); });
	knob.addEventListener("pointermove", (e) => {
		if (!dragging) return;
		const r = padEl.getBoundingClientRect();
		setStick(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
	});
	const end = () => { dragging = false; setStick(0, 0); sim.x = sim.y = 0; };
	knob.addEventListener("pointerup", end);
	knob.addEventListener("pointercancel", end);
	const keys = new Set();
	const keyStick = () => setStick((keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0), (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0));
	knob.addEventListener("keydown", (e) => { if (e.key.startsWith("Arrow")) { e.preventDefault(); e.stopPropagation(); keys.add(e.key); ensureSim(); keyStick(); } });
	knob.addEventListener("keyup", (e) => { keys.delete(e.key); keyStick(); });
	knob.addEventListener("blur", () => { keys.clear(); keyStick(); });

	// ---- real gamepad opt-in ----
	const onConnect = (e) => {
		pad = e.gamepad.index;
		ui.status(`Connected: ${e.gamepad.id.slice(0, 42)}. Left stick moves, A clicks, bumpers jump between links.`);
		showCursor(true);
		render();
		lp.start();
	};
	const onDisconnect = () => {
		pad = null;
		ui.status("Controller disconnected. Reconnect, or use the virtual pad.");
		if (!simActive) showCursor(false);
	};
	async function enable() {
		if (!navigator.getGamepads) {
			ui.status("This browser has no Gamepad API. Use the virtual pad.");
			return;
		}
		realOn = true;
		window.addEventListener("gamepadconnected", onConnect);
		window.addEventListener("gamepaddisconnected", onDisconnect);
		ui.setActive(true);
		const found = [...navigator.getGamepads()].find((p) => p?.connected);
		if (found) onConnect({ gamepad: found });
		else ui.status("Listening. Press any button on your controller…");
		lp.start();
	}
	function stop() {
		realOn = false;
		window.removeEventListener("gamepadconnected", onConnect);
		window.removeEventListener("gamepaddisconnected", onDisconnect);
		pad = null;
		ui.setActive(false);
		ui.status(simActive ? "Gamepad off. Virtual pad still active." : "Off. Plug in a controller, then enable.");
		if (!simActive) showCursor(false);
	}

	render();
	return () => {
		window.removeEventListener("gamepadconnected", onConnect);
		window.removeEventListener("gamepaddisconnected", onDisconnect);
		clearTimeout(rumbleTimer);
		hovered?.classList.remove("gp-hover");
		lp.destroy();
		ui.destroy();
		cursor.remove();
	};
}
