import { bytesOf, el, formatBytes, formatMs, origin, state, subscribe, themeBoundary } from "./_perf/kit.js";

// The page "develops" like a print in a darkroom. The development curve is built from the real
// page-load measurements: each page resource (Resource Timing, responseEnd, weighted by bytes) and the
// Paint Timing / LCP milestones advance the exposure. Real time is stretched so you can watch it.
// Only page-load entries (requested before the theme's own assets) count; theme-load entries are ignored.

const PLAY_MS = 4200;

function grainTile() {
	const size = 96;
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext("2d");
	const image = ctx.createImageData(size, size);
	let seed = 12345;
	for (let i = 0; i < image.data.length; i += 4) {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		const v = seed >>> 24;
		image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
		image.data[i + 3] = 40;
	}
	ctx.putImageData(image, 0, 0);
	return canvas.toDataURL();
}

export function activate({ root, reducedMotion }) {
	const veilLayer = root.querySelector(".overlay-a");
	const topLayer = root.querySelector(".overlay-b");

	const veil = el("div", { class: "dev-veil" });
	veil.style.backgroundImage = `url(${grainTile()})`;
	const vignette = el("div", { class: "dev-vignette" });
	veilLayer.append(veil);
	topLayer.append(vignette);

	const status = el("div", { class: "dev-status", text: "Waiting for measurements..." });
	const tray = el("div", { class: "dev-tray", "aria-hidden": "true" });
	const playhead = el("i", { class: "dev-playhead" });
	const button = el("button", { class: "dev-replay", type: "button" }, "Replay development");
	const card = el("div", { class: "dev-card" }, el("div", { class: "dev-title", text: "Darkroom" }), tray, status, button);
	topLayer.append(card);

	let plan; // { keyframes, total, stretch, events }
	let animations = [];
	let raf = 0;
	let step = 4; // reduced-motion exposure stage (0..4)

	function buildPlan() {
		const boundary = themeBoundary();
		const resources = state.resources.filter((entry) => origin(entry, boundary) === "page" && entry.responseEnd > 0);
		if (!resources.length && state.paints["first-paint"] == null) return undefined;
		const fp = state.paints["first-paint"];
		const fcp = state.paints["first-contentful-paint"];
		const lcp = state.lcp?.time;
		const total = Math.max(1, ...resources.map((entry) => entry.responseEnd), fp ?? 0, fcp ?? 0, lcp ?? 0);
		const weights = resources.map((entry) => entry.encodedBodySize ? bytesOf(entry) + 4096 : 4096);
		const sum = weights.reduce((a, b) => a + b, 0) || 1;
		const events = resources.map((entry, i) => ({ t: entry.responseEnd, w: (weights[i] / sum) * 0.6, entry }));
		if (fp != null) events.push({ t: fp, w: 0.1, label: "FP", time: fp });
		if (fcp != null && fcp !== fp) events.push({ t: fcp, w: 0.12, label: "FCP", time: fcp });
		if (lcp != null) events.push({ t: lcp, w: 0.18, label: "LCP", time: lcp });
		events.sort((a, b) => a.t - b.t);
		const wTotal = events.reduce((a, b) => a + b.w, 0);
		let acc = 0;
		const points = [{ offset: 0, p: 0 }];
		for (const event of events) {
			acc += event.w / wTotal;
			points.push({ offset: event.t / total, p: Math.min(1, acc) });
		}
		points.push({ offset: 1, p: 1 });
		// Keyframe offsets must be non-decreasing.
		for (let i = 1; i < points.length; i++) points[i].offset = Math.max(points[i].offset, points[i - 1].offset);
		const bytes = resources.reduce((a, entry) => a + bytesOf(entry), 0);
		return { points, total, stretch: PLAY_MS / total, events, count: resources.length, bytes };
	}

	function renderTray() {
		tray.replaceChildren(playhead);
		const maxW = Math.max(...plan.events.map((event) => event.w));
		for (const event of plan.events) {
			const mark = el("b", { class: event.label ? "dev-flag" : "dev-tick", style: `left:${(event.t / plan.total) * 100}%;--h:${0.35 + 0.65 * (event.w / maxW)}` });
			if (event.label) mark.dataset.label = event.label;
			tray.append(mark);
		}
		const flags = plan.events.filter((event) => event.label).map((event) => `${event.label} ${formatMs(event.time)}`).join(" · ");
		status.textContent = `${plan.count} page resources, ${formatBytes(plan.bytes)} · ${flags || "no paint entries"} · real ${formatMs(plan.total)} stretched ×${Math.max(1, Math.round(plan.stretch))}`;
	}

	function setStatic(p) {
		veil.style.opacity = String(Math.max(0, 1 - p));
		vignette.style.opacity = String(Math.max(0.1, (1 - p) * 0.9 + 0.1));
	}

	function stopAnimations() {
		for (const animation of animations) animation.cancel();
		animations = [];
		cancelAnimationFrame(raf);
	}

	function play() {
		if (!plan) return;
		stopAnimations();
		card.classList.add("busy");
		const veilFrames = plan.points.map((point) => ({ offset: point.offset, opacity: 1 - point.p }));
		const vignetteFrames = plan.points.map((point) => ({ offset: point.offset, opacity: Math.max(0.1, 1 - Math.pow(point.p, 1.6) * 0.9) }));
		const options = { duration: PLAY_MS, easing: "linear", fill: "both" };
		const a = veil.animate(veilFrames, options);
		const b = vignette.animate(vignetteFrames, options);
		const c = playhead.animate([{ left: "0%" }, { left: "100%" }], options);
		animations = [a, b, c];
		const tick = () => {
			const t = Number(a.currentTime) / PLAY_MS;
			status.textContent = `Developing ${Math.min(100, Math.round(t * 100))}% · ${formatMs(t * plan.total)} of ${formatMs(plan.total)} real`;
			if (a.playState === "running") raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		a.finished.then(
			() => {
				card.classList.remove("busy");
				// Commit the final state without leaving a running animation behind.
				setStatic(1);
				stopAnimations();
				renderTray();
			},
			() => {},
		);
	}

	function replay() {
		if (reducedMotion) {
			// User-driven only: each press exposes one more stage of the print, no animation at all.
			step = (step + 1) % 5;
			setStatic(step / 4);
			status.textContent = `Exposure stage ${step}/4 (press again to advance)`;
			return;
		}
		play();
	}

	button.addEventListener("click", replay);

	let started = false;
	const unsubscribe = subscribe(() => {
		const next = buildPlan();
		if (!next) return;
		const first = !plan;
		plan = next;
		if (!animations.length) renderTray();
		if (first && !started) {
			started = true;
			if (reducedMotion) {
				setStatic(1);
			} else {
				play();
			}
		}
	});

	return () => {
		unsubscribe();
		stopAnimations();
		button.removeEventListener("click", replay);
	};
}
