import { panel, h, clamp, loop } from "./_sensor/kit.js";

// Depth multipliers (px of travel at full tilt). Foreground moves most, sky least.
const DEPTH = { ".scenery-a": 14, ".scenery-b": 30, ".scenery-c": 54, ".overlay-a": 90, ".site-portrait": -10 };

export function activate({ root, reducedMotion }) {
	const targets = Object.entries(DEPTH).map(([sel, d]) => ({ el: root.querySelector(sel), d })).filter((t) => t.el);
	const target = { x: 0, y: 0 };
	const cur = { x: 0, y: 0 };
	let source = "sim";
	let listening = false;
	let permissionTimer = 0;

	const paint = () => {
		for (const { el, d } of targets) {
			el.style.transform = `translate3d(${(-cur.x * d).toFixed(2)}px, ${(-cur.y * d * 0.6).toFixed(2)}px, 0)`;
		}
		dot.style.transform = `translate(${cur.x * 60}%, ${cur.y * 60}%)`;
		dot.style.left = "50%";
	};
	const lp = loop(() => {
		cur.x += (target.x - cur.x) * 0.14;
		cur.y += (target.y - cur.y) * 0.14;
		paint();
		if (Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) < 0.001) {
			cur.x = target.x;
			cur.y = target.y;
			paint();
			lp.stop();
		}
	});
	const setTarget = (x, y) => {
		target.x = clamp(x, -1, 1);
		target.y = clamp(y, -1, 1);
		if (reducedMotion) {
			cur.x = target.x;
			cur.y = target.y;
			paint();
		} else lp.start();
	};

	const dot = h("span", { class: "tp-dot" });
	const ui = panel(root, {
		title: "Tilt parallax",
		statusIdle: "Layers shift with your device tilt. Or simulate it.",
		privacy: "Motion data stays in your browser: it is never stored or sent.",
		enable: { label: "Use device tilt", run: enable },
		stopLabel: "Stop sensor",
		onStop: stop,
		simLabel: "Simulate tilt",
		controls: [
			{ type: "range", id: "x", label: "Left / right", min: -45, max: 45, value: 0, format: (v) => `${v}°`, onInput: (v) => simulate() },
			{ type: "range", id: "y", label: "Forward / back", min: -45, max: 45, value: 0, format: (v) => `${v}°`, onInput: (v) => simulate() },
			{ type: "buttons", id: "preset", label: "Presets", value: "", options: [{ value: "c", label: "Level" }, { value: "l", label: "Lean left" }, { value: "r", label: "Lean right" }, { value: "f", label: "Forward" }], onPick: preset },
		],
	});
	ui.el.querySelector(".sx-sim").prepend(h("div", { class: "tp-bubble", "aria-hidden": "true" }, dot));

	function simulate() {
		if (source === "device") stop();
		setTarget(ui.get("x") / 30, ui.get("y") / 30);
	}
	function preset(v) {
		const map = { c: [0, 0], l: [-30, 0], r: [30, 0], f: [0, 28] };
		const [x, y] = map[v];
		ui.set("x", x);
		ui.set("y", y);
		simulate();
	}

	function onOrient(e) {
		if (e.gamma == null && e.beta == null) return;
		clearTimeout(permissionTimer);
		source = "device";
		ui.status("Reading your device tilt.");
		ui.setActive(true);
		setTarget((e.gamma ?? 0) / 30, ((e.beta ?? 45) - 45) / 30);
		ui.set("x", Math.round(clamp(e.gamma ?? 0, -45, 45)));
		ui.set("y", Math.round(clamp((e.beta ?? 45) - 45, -45, 45)));
	}
	async function enable() {
		if (typeof DeviceOrientationEvent === "undefined") {
			ui.status("This browser has no orientation sensor. Use the simulator.");
			return;
		}
		if (typeof DeviceOrientationEvent.requestPermission === "function") {
			const answer = await DeviceOrientationEvent.requestPermission();
			if (answer !== "granted") {
				ui.status("Motion access was declined. The simulator still works.");
				return;
			}
		}
		window.addEventListener("deviceorientation", onOrient);
		listening = true;
		ui.status("Waiting for sensor data…");
		permissionTimer = setTimeout(() => {
			if (source !== "device") {
				ui.status("No tilt data arrived (a desktop?). Use the simulator.");
				stop();
			}
		}, 1500);
	}
	function stop() {
		clearTimeout(permissionTimer);
		if (listening) window.removeEventListener("deviceorientation", onOrient);
		listening = false;
		source = "sim";
		ui.setActive(false);
		ui.status("Sensor off. Layers shift with your device tilt, or simulate it.");
	}

	paint();
	return () => {
		clearTimeout(permissionTimer);
		window.removeEventListener("deviceorientation", onOrient);
		lp.destroy();
		ui.destroy();
	};
}
