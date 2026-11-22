import { el, formatMs, state, subscribe, svg } from "./_perf/kit.js";

// A metronome whose pendulum is advanced by real requestAnimationFrame callbacks.
// The arm's angle is a function of wall-clock time, sampled only when a frame actually renders,
// so any dropped frame is visible as the arm freezing then jumping. Nothing is faked.
// Long tasks come from a PerformanceObserver (via the shared kit).

const BEAT_MS = 1000; // one full swing (left -> right) per second
const SWING = 28; // degrees each side
const HISTORY = 90;

export function activate({ root, reducedMotion }) {
	const overlay = root.querySelector(".overlay-a");

	const arm = svg("g", { class: "mm-arm" }, svg("line", { x1: 60, y1: 112, x2: 60, y2: 20, class: "mm-rod" }), svg("rect", { x: 53, y: 38, width: 14, height: 14, rx: 2, class: "mm-weight" }));
	const dial = svg(
		"svg",
		{ class: "mm-dial", viewBox: "0 0 120 140", "aria-hidden": "true" },
		svg("path", { d: "M60 6 L108 128 H12 Z", class: "mm-body" }),
		svg("path", { d: "M60 6 L108 128 H12 Z", class: "mm-sheen" }),
		svg("circle", { cx: 60, cy: 112, r: 5, class: "mm-pivot" }),
		arm,
		svg("rect", { x: 6, y: 124, width: 108, height: 10, rx: 3, class: "mm-base" }),
	);
	const tick = el("span", { class: "mm-tick" });
	const bars = el("div", { class: "mm-bars", "aria-hidden": "true" });
	const barNodes = Array.from({ length: HISTORY }, () => bars.appendChild(el("i")));
	const fps = el("b", { text: "--" });
	const worst = el("b", { text: "--" });
	const long = el("b", { text: "0" });
	const jank = el("button", { class: "mm-jank", type: "button", title: "Run three 30 ms busy loops, one per frame, to see what jank looks like" }, "Induce jank");
	const readout = el(
		"div",
		{ class: "mm-readout", "aria-live": "off" },
		el("span", {}, "fps ", fps),
		el("span", {}, "worst ", worst),
		el("span", {}, "long ", long),
	);
	const label = el("div", { class: "mm-label" }, tick, "Frame metronome");
	const card = el("div", { class: "mm-card" }, label, dial, bars, readout, jank);
	overlay.append(card);

	const deltas = [];
	let rafId = 0;
	let last = 0;
	let t0 = 0;
	let lastText = 0;
	let jankFrames = 0;
	let running = false;
	let beatIndex = -1;

	function paintBars() {
		const max = Math.max(50, ...deltas);
		barNodes.forEach((node, i) => {
			const d = deltas[deltas.length - HISTORY + i];
			if (d == null) {
				node.style.transform = "scaleY(0.04)";
				node.className = "";
				return;
			}
			node.style.transform = `scaleY(${Math.min(1, d / max)})`;
			node.className = d > 50 ? "bad" : d > 20 ? "warn" : "";
		});
	}

	function updateText(now) {
		const recent = deltas.slice(-60);
		if (recent.length) {
			const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
			fps.textContent = Math.round(1000 / avg);
			worst.textContent = formatMs(Math.max(...recent));
		}
		long.textContent = String(state.longTasks.length);
		paintBars();
		lastText = now;
	}

	function frame(now) {
		if (!running) return;
		if (last) {
			deltas.push(now - last);
			if (deltas.length > 600) deltas.shift();
		}
		last = now;
		if (!t0) t0 = now;

		if (jankFrames > 0) {
			jankFrames--;
			const until = performance.now() + 30;
			while (performance.now() < until) {
				// Deliberate, bounded 30 ms busy loop (opt-in via the button).
			}
		}

		const phase = ((now - t0) / BEAT_MS) * Math.PI; // sin(phase): one swing per BEAT_MS
		const s = Math.sin(phase);
		arm.style.transform = `rotate(${s * SWING}deg)`;
		const beat = Math.floor((now - t0) / BEAT_MS + 0.5);
		if (beat !== beatIndex) {
			beatIndex = beat;
			tick.classList.remove("on");
			void tick.offsetWidth;
			tick.classList.add("on");
		}
		if (now - lastText > 250) updateText(now);
		rafId = requestAnimationFrame(frame);
	}

	function begin() {
		if (running) return;
		running = true;
		last = 0;
		rafId = requestAnimationFrame(frame);
	}

	function end() {
		running = false;
		cancelAnimationFrame(rafId);
	}

	function onVisibility() {
		if (document.hidden) end();
		else if (!reducedMotion) begin();
	}

	// Reduced motion: no continuous loop. Sample ~1.5 s of real frames once, then settle on a still arm.
	function sampleOnce() {
		deltas.length = 0;
		begin();
		setTimeout(() => {
			end();
			arm.style.transform = "rotate(0deg)";
			updateText(performance.now());
		}, 1500);
	}

	jank.addEventListener("click", () => {
		jankFrames = 3;
		if (reducedMotion) sampleOnce();
	});

	const unsubscribe = subscribe(() => {
		long.textContent = String(state.longTasks.length);
	});

	if (reducedMotion) {
		card.classList.add("still");
		jank.textContent = "Sample frames";
		sampleOnce();
	} else {
		begin();
		document.addEventListener("visibilitychange", onVisibility);
	}

	return () => {
		end();
		unsubscribe();
		document.removeEventListener("visibilitychange", onVisibility);
	};
}
