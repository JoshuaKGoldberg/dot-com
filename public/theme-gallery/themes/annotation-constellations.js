// 20 — Annotation Constellations: stars joined by nearest-neighbour "inference" edges.
const NS = "http://www.w3.org/2000/svg";
const LABELS = ["string", "T", "readonly", "Array<T>", "never", "number", "unknown", "K extends keyof T", "Promise<T>", "boolean"];

function mulberry(seed) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function activate({ root, mode, reducedMotion }) {
	const scenery = root.querySelector(".scenery-a");
	if (!scenery) return;
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("class", "ac-svg");
	svg.setAttribute("aria-hidden", "true");
	scenery.append(svg);

	const make = (tag, attrs, parent = svg) => {
		const el = document.createElementNS(NS, tag);
		for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
		parent.append(el);
		return el;
	};

	let stars = [];
	let edgeKeys = new Set();
	let layers = {};
	let timer = 0;
	let timers = [];

	const key = (i, j) => (i < j ? `${i}-${j}` : `${j}-${i}`);

	const build = () => {
		svg.replaceChildren();
		timers.forEach(clearTimeout);
		timers = [];
		const w = scenery.clientWidth;
		const h = scenery.clientHeight;
		svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
		const rnd = mulberry(2024);

		// Poisson-ish scatter with a minimum spacing.
		stars = [];
		const count = Math.round((w * h) / 9500);
		const minDist = 46;
		for (let tries = 0; tries < count * 25 && stars.length < count; tries++) {
			const x = rnd() * w, y = rnd() * h;
			if (stars.every((s) => (s.x - x) ** 2 + (s.y - y) ** 2 > minDist * minDist)) {
				stars.push({ x, y, mag: Math.pow(rnd(), 2.2) });
			}
		}

		layers.plate = make("g", { class: "ac-plate" });
		// graticule rings, like a star-chart plate
		const cx = w * 0.72, cy = h * 0.3;
		for (const r of [h * 0.35, h * 0.62, h * 0.95]) make("circle", { cx, cy, r, class: "ac-ring" }, layers.plate);
		make("line", { x1: cx, x2: cx, y1: 0, y2: h, class: "ac-ring" }, layers.plate);
		make("line", { x1: 0, x2: w, y1: cy, y2: cy, class: "ac-ring" }, layers.plate);

		layers.edges = make("g", { class: "ac-edges" });
		layers.stars = make("g", { class: "ac-stars" });
		layers.labels = make("g", { class: "ac-labels" });
		layers.inferred = make("g", { class: "ac-inferred" });

		edgeKeys = new Set();
		stars.forEach((s, i) => {
			const sorted = stars
				.map((o, j) => ({ j, d: (o.x - s.x) ** 2 + (o.y - s.y) ** 2 }))
				.filter((o) => o.j !== i)
				.sort((a, b) => a.d - b.d);
			const links = [sorted[0], rnd() < 0.35 ? sorted[1] : null].filter(Boolean);
			for (const { j, d } of links) {
				const k = key(i, j);
				if (edgeKeys.has(k) || d > 150 * 150) continue;
				edgeKeys.add(k);
				make("line", { x1: s.x, y1: s.y, x2: stars[j].x, y2: stars[j].y, class: "ac-edge" }, layers.edges);
			}
		});

		stars.forEach((s, i) => {
			const r = 0.9 + s.mag * 2.2;
			const star = make("circle", { cx: s.x, cy: s.y, r, class: "ac-star" }, layers.stars);
			if (!reducedMotion && rnd() < 0.3) {
				star.style.animation = `ac-twinkle ${5 + rnd() * 6}s ease-in-out ${-rnd() * 10}s infinite`;
			}
		});

		// a handful of tiny type labels, preferring stars away from the text column
		const column = [w / 2 - 440, w / 2 + 440];
		const candidates = stars
			.map((s, i) => ({ s, i }))
			.filter(({ s }) => s.x < column[0] + 40 || s.x > column[1] - 40 || s.y < 40)
			.sort(() => rnd() - 0.5)
			.slice(0, 10);
		candidates.forEach(({ s }, n) => {
			const t = make("text", { x: s.x + 7, y: s.y + 3, class: "ac-label" }, layers.labels);
			t.textContent = LABELS[n % LABELS.length];
		});
	};

	const inferEdge = () => {
		timer = window.setTimeout(inferEdge, 9000 + Math.random() * 9000);
		if (document.hidden) return;
		for (let tries = 0; tries < 40; tries++) {
			const i = Math.floor(Math.random() * stars.length);
			const a = stars[i];
			const near = stars
				.map((o, j) => ({ j, d: Math.hypot(o.x - a.x, o.y - a.y) }))
				.filter((o) => o.j !== i && o.d > 70 && o.d < 210 && !edgeKeys.has(key(i, o.j)));
			if (!near.length) continue;
			const { j, d } = near[Math.floor(Math.random() * near.length)];
			const b = stars[j];
			const line = make("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "ac-infer" }, layers.inferred);
			line.style.strokeDasharray = String(d);
			line.style.strokeDashoffset = String(d);
			const draw = line.animate(
				[{ strokeDashoffset: d, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, offset: 0.3 }, { strokeDashoffset: 0, opacity: 1, offset: 0.7 }, { strokeDashoffset: 0, opacity: 0 }],
				{ duration: 14000, easing: "ease-in-out" },
			);
			const tag = make("text", { x: (a.x + b.x) / 2 + 4, y: (a.y + b.y) / 2 - 4, class: "ac-label ac-infer-label" }, layers.inferred);
			tag.textContent = LABELS[Math.floor(Math.random() * LABELS.length)];
			tag.animate([{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 14000 });
			timers.push(
				window.setTimeout(() => {
					line.remove();
					tag.remove();
				}, 14100),
			);
			return;
		}
	};

	build();
	if (!reducedMotion) timer = window.setTimeout(inferEdge, 3500);

	let resizeTimer;
	const onResize = () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(build, 200);
	};
	window.addEventListener("resize", onResize);
	return () => {
		clearTimeout(timer);
		clearTimeout(resizeTimer);
		timers.forEach(clearTimeout);
		window.removeEventListener("resize", onResize);
	};
}
