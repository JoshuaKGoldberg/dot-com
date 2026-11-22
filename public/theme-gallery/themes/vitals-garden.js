import { el, formatMs, rate, state, subscribe, svg, THRESHOLDS } from "./_perf/kit.js";

// Three plants grown from this page's measured Core Web Vitals (PerformanceObserver, buffered):
//   LCP  -> sunflower: taller and brighter when LCP is quick, droops past the thresholds
//   CLS  -> fern: sways in proportion to the measured layout shift (0 = perfectly still)
//   INP  -> tulip: only a seedling until you interact; then it blooms according to the slowest interaction
// Health is continuous: 1 at 0, ~0.8 at the "good" threshold, ~0.35 at "poor", and falling to 0 beyond.

function health(metric, value) {
	const [good, poor] = THRESHOLDS[metric];
	if (value <= good) return 1 - 0.2 * (value / good);
	if (value <= poor) return 0.8 - 0.45 * ((value - good) / (poor - good));
	return Math.max(0.05, 0.35 - 0.3 * Math.min(1, (value - poor) / poor));
}

export function activate({ root, mode }) {
	const layer = root.querySelector(".scenery-a");
	const overlay = root.querySelector(".overlay-a");
	const dark = mode === "dark";

	const leaf = (h) => `hsl(${Math.round(48 + h * 80)} ${Math.round(25 + h * 35)}% ${dark ? 26 + h * 12 : 30 + h * 10}%)`;
	const bloom = (h, hue) => `hsl(${hue} ${Math.round(30 + h * 65)}% ${dark ? 48 + h * 10 : 45 + h * 12}%)`;

	function plant(name) {
		const node = svg("svg", { class: `vg-plant vg-${name}`, viewBox: "-110 -330 220 340", "aria-hidden": "true" });
		layer.append(node);
		return node;
	}
	const sunflower = plant("lcp");
	const fern = plant("cls");
	const tulip = plant("inp");

	function tag(label, left) {
		const value = el("b", { class: "vg-value" });
		const note = el("span", { class: "vg-note" });
		const node = el("div", { class: "vg-tag", style: `left:${left}` }, el("span", { class: "vg-metric", text: label }), value, note);
		overlay.append(node);
		return { node, value, note };
	}
	const lcpTag = tag("LCP", "var(--x-lcp)");
	const clsTag = tag("CLS", "var(--x-cls)");
	const inpTag = tag("INP", "var(--x-inp)");

	function drawSunflower(h, pending) {
		const stemH = 120 + h * 150;
		const droop = (1 - h) * 55;
		const petals = [];
		for (let i = 0; i < 16; i++) {
			petals.push(svg("ellipse", { cx: 0, cy: -34 * (0.8 + h * 0.2), rx: 9, ry: 22 * (0.7 + h * 0.3), fill: bloom(h, 46), transform: `rotate(${(i * 360) / 16})` }));
		}
		const head = svg(
			"g",
			{ transform: `translate(0 ${-stemH}) rotate(${droop})`, class: "vg-head" },
			...petals,
			svg("circle", { r: 24, fill: dark ? "#4a2c14" : "#5b3519" }),
			svg("circle", { r: 15, fill: dark ? "#6b4020" : "#7a4a24", opacity: 0.8 }),
		);
		sunflower.replaceChildren(
			svg("path", { d: `M0 0 C ${-8 - droop * 0.1} ${-stemH * 0.4} ${4} ${-stemH * 0.7} 0 ${-stemH}`, stroke: leaf(h), "stroke-width": 7, fill: "none", "stroke-linecap": "round" }),
			svg("ellipse", { cx: -26, cy: -stemH * 0.35, rx: 28, ry: 9, fill: leaf(h), transform: `rotate(${-28 + (1 - h) * 40} -8 ${-stemH * 0.35})` }),
			svg("ellipse", { cx: 26, cy: -stemH * 0.5, rx: 28, ry: 9, fill: leaf(h), transform: `rotate(${28 - (1 - h) * 40} 8 ${-stemH * 0.5})` }),
			head,
		);
	}

	function drawFern(shift) {
		const h = health("cls", shift);
		const amp = Math.min(14, shift * 70); // degrees of sway: 0.1 CLS -> 7 deg, 0.2 -> 14 deg
		fern.style.setProperty("--amp", `${amp}deg`);
		const leaves = [];
		for (let i = 0; i < 11; i++) {
			const y = -24 - i * 21;
			const len = 46 - i * 3.2;
			const tilt = 62 - i * 3;
			leaves.push(svg("ellipse", { cx: -len / 2, cy: y, rx: len / 2, ry: 5, fill: leaf(h), transform: `rotate(${-tilt + 90 - 90} 0 ${y}) rotate(${-16} ${0} ${y})` }));
			leaves.push(svg("ellipse", { cx: len / 2, cy: y - 6, rx: len / 2, ry: 5, fill: leaf(h), transform: `rotate(16 0 ${y - 6})` }));
		}
		leaves.push(svg("ellipse", { cx: 0, cy: -270, rx: 5, ry: 16, fill: leaf(h) }));
		fern.replaceChildren(svg("g", { class: "vg-sway" }, svg("path", { d: "M0 0 C 4 -90 -4 -170 0 -262", stroke: leaf(h), "stroke-width": 4, fill: "none", "stroke-linecap": "round" }), ...leaves));
		return h;
	}

	function drawTulip(inp) {
		if (inp == null) {
			// Seedling: waiting for the first interaction.
			tulip.replaceChildren(
				svg("path", { d: "M0 0 C 0 -16 2 -26 0 -36", stroke: leaf(0.8), "stroke-width": 4, fill: "none", "stroke-linecap": "round" }),
				svg("ellipse", { cx: -10, cy: -38, rx: 11, ry: 5, fill: leaf(0.9), transform: "rotate(-25 0 -36)" }),
				svg("ellipse", { cx: 10, cy: -40, rx: 11, ry: 5, fill: leaf(0.9), transform: "rotate(25 0 -36)" }),
			);
			return;
		}
		const h = health("inp", inp);
		const stemH = 90 + h * 70;
		const open = 8 + h * 40;
		const cup = [-1, 0, 1].map((k) => svg("ellipse", { cx: 0, cy: -20, rx: 12, ry: 28, fill: bloom(h, 335), transform: `rotate(${k * open})`, opacity: k === 0 ? 1 : 0.9 }));
		tulip.replaceChildren(
			svg("path", { d: `M0 0 C 4 ${-stemH * 0.4} -3 ${-stemH * 0.7} 0 ${-stemH}`, stroke: leaf(h), "stroke-width": 5, fill: "none", "stroke-linecap": "round" }),
			svg("ellipse", { cx: -18, cy: -stemH * 0.3, rx: 22, ry: 7, fill: leaf(h), transform: `rotate(-35 -6 ${-stemH * 0.3})` }),
			svg("g", { transform: `translate(0 ${-stemH})` }, ...cup),
		);
	}

	function update() {
		const { lcp, cls, inp, interactions } = state;
		// LCP
		if (lcp) {
			const h = health("lcp", lcp.time);
			drawSunflower(h);
			lcpTag.value.textContent = formatMs(lcp.time);
			lcpTag.note.textContent = `${rate("lcp", lcp.time).replace("-", " ")}`;
		} else {
			drawSunflower(0.7);
			lcpTag.value.textContent = "...";
			lcpTag.note.textContent = "awaiting largest paint";
		}
		// CLS (0 is a real, measured value once the observer exists; layout-shift is unsupported if no PerformanceObserver)
		drawFern(cls);
		clsTag.value.textContent = cls.toFixed(3);
		clsTag.note.textContent = `${rate("cls", cls).replace("-", " ")} · ${state.shifts.length} shift${state.shifts.length === 1 ? "" : "s"} measured`;
		// INP
		drawTulip(inp);
		if (inp == null) {
			inpTag.value.textContent = "pending";
			inpTag.note.textContent = "interact to grow it";
		} else {
			inpTag.value.textContent = formatMs(inp);
			inpTag.note.textContent = `${rate("inp", inp).replace("-", " ")} · ${interactions} interaction${interactions === 1 ? "" : "s"}`;
		}
		for (const [t, key] of [[lcpTag, lcp ? rate("lcp", lcp.time) : "pending"], [clsTag, rate("cls", cls)], [inpTag, rate("inp", inp)]]) {
			t.node.dataset.rating = key;
		}
	}

	const unsubscribe = subscribe(update);
	update();
	return unsubscribe;
}
