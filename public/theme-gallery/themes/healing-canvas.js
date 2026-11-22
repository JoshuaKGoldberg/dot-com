// 19 — Healing Canvas: ghosted gutter + code-rhythm bars; squiggles occasionally relax into straight lines.
const NS = "http://www.w3.org/2000/svg";
const LINE_H = 24;
const GUTTER_W = 46;

function mulberry(seed) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function activate({ root, reducedMotion }) {
	const scenery = root.querySelector(".scenery-a");
	if (!scenery) return;
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("class", "hc-svg");
	svg.setAttribute("aria-hidden", "true");
	scenery.append(svg);

	let squiggles = [];
	let bars = [];
	let raf = 0;
	let healTimer = 0;
	let width = 0;
	let height = 0;

	const make = (tag, attrs, parent = svg) => {
		const el = document.createElementNS(NS, tag);
		for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
		parent.append(el);
		return el;
	};

	const squigglePath = (x, y, len, amp) => {
		const wave = 9;
		const steps = Math.max(2, Math.round(len / 2));
		let d = "";
		for (let i = 0; i <= steps; i++) {
			const px = x + (len * i) / steps;
			const py = y + amp * Math.sin(((px - x) / wave) * Math.PI * 2);
			d += (i ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(2);
		}
		return d;
	};

	const build = () => {
		svg.replaceChildren();
		width = scenery.clientWidth;
		height = scenery.clientHeight;
		svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
		const rnd = mulberry(404);
		const rows = Math.ceil(height / LINE_H) + 1;

		const gutter = make("g", { class: "hc-gutter" });
		for (let i = 0; i < rows; i++) {
			const t = make("text", { x: GUTTER_W - 10, y: i * LINE_H + 17, "text-anchor": "end", class: "hc-num" }, gutter);
			t.textContent = String(i + 1);
		}
		make("line", { x1: GUTTER_W, x2: GUTTER_W, y1: 0, y2: height, class: "hc-gutter-rule" });

		bars = [];
		const barLayer = make("g", { class: "hc-bars" });
		let row = 1;
		let indent = 0;
		while (row < rows) {
			// a "block" of code lines, then blank space
			const blockLen = 2 + Math.floor(rnd() * 6);
			indent = 0;
			for (let b = 0; b < blockLen && row < rows; b++, row++) {
				const roll = rnd();
				if (roll < 0.18) indent = Math.min(4, indent + 1);
				else if (roll < 0.34) indent = Math.max(0, indent - 1);
				if (rnd() < 0.12) continue;
				let x = GUTTER_W + 26 + indent * 22;
				const segments = 1 + Math.floor(rnd() * 3);
				for (let s = 0; s < segments; s++) {
					const w = 36 + rnd() * (s === 0 ? 220 : 160);
					if (x + w > width - 20) break;
					make("rect", { x, y: row * LINE_H + 6, width: w, height: 9, rx: 4.5, class: "hc-bar" }, barLayer);
					bars.push({ x, y: row * LINE_H + 17, w });
					x += w + 12 + rnd() * 18;
				}
			}
			row += 1 + Math.floor(rnd() * 4);
		}

		squiggles = [];
		const layer = make("g", { class: "hc-squiggles" });
		const taken = new Set();
		const wanted = Math.min(7, Math.floor(bars.length / 5));
		for (let n = 0; n < wanted; n++) addSquiggle(layer, taken, rnd, false);
		svg.__layer = layer;
		svg.__taken = taken;
		svg.__rnd = rnd;
	};

	const addSquiggle = (layer, taken, rnd, grow) => {
		for (let tries = 0; tries < 30; tries++) {
			const index = Math.floor(rnd() * bars.length);
			if (taken.has(index)) continue;
			const bar = bars[index];
			if (bar.w < 50) continue;
			taken.add(index);
			const len = Math.min(bar.w, 60 + rnd() * 100);
			const x = bar.x + rnd() * (bar.w - len);
			const path = make("path", { class: "hc-squiggle", d: "", fill: "none" }, layer);
			const s = { path, x, y: bar.y + 2, len, amp: grow ? 0 : 2, index };
			path.setAttribute("d", squigglePath(s.x, s.y, s.len, s.amp));
			squiggles.push(s);
			return s;
		}
		return null;
	};

	const animateAmp = (s, from, to, duration, done) => {
		const start = performance.now();
		const step = (now) => {
			if (document.hidden) {
				raf = requestAnimationFrame(step);
				return;
			}
			const t = Math.min(1, (now - start) / duration);
			s.amp = from + (to - from) * ease(t);
			s.path.setAttribute("d", squigglePath(s.x, s.y, s.len, s.amp));
			if (t < 1) raf = requestAnimationFrame(step);
			else done?.();
		};
		raf = requestAnimationFrame(step);
	};

	const heal = () => {
		const candidates = squiggles.filter((s) => s.amp > 1);
		if (candidates.length) {
			const s = candidates[Math.floor(Math.random() * candidates.length)];
			s.path.classList.add("is-healing");
			animateAmp(s, s.amp, 0, 1800, () => {
				s.path.classList.add("is-healed");
				// the straight line lingers, then fades; a new squiggle grows elsewhere
				setTimeout(() => {
					s.path.remove();
					squiggles = squiggles.filter((x) => x !== s);
					svg.__taken.delete(s.index);
					const fresh = addSquiggle(svg.__layer, svg.__taken, svg.__rnd, true);
					if (fresh) animateAmp(fresh, 0, 2, 2400);
				}, 2600);
			});
		}
		healTimer = window.setTimeout(heal, 15000 + Math.random() * 15000);
	};

	build();
	if (!reducedMotion) {
		// first heal comes sooner so the effect is discoverable in a prototype
		healTimer = window.setTimeout(heal, 5000);
	} else if (squiggles[0]) {
		// static frame: one squiggle already healed
		squiggles[0].amp = 0;
		squiggles[0].path.setAttribute("d", squigglePath(squiggles[0].x, squiggles[0].y, squiggles[0].len, 0));
		squiggles[0].path.classList.add("is-healed");
	}

	let resizeTimer;
	const onResize = () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(build, 150);
	};
	window.addEventListener("resize", onResize);
	return () => {
		cancelAnimationFrame(raf);
		clearTimeout(healTimer);
		clearTimeout(resizeTimer);
		window.removeEventListener("resize", onResize);
	};
}
