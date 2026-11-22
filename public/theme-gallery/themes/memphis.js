const NS = "http://www.w3.org/2000/svg";
const COLORS = ["var(--pink)", "var(--teal)", "var(--yellow)", "var(--cobalt)"];

function rng(seed) {
	let s = seed;
	return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function shape(kind, color, size) {
	const g = document.createElementNS(NS, "g");
	const add = (tag, attrs) => {
		const el = document.createElementNS(NS, tag);
		for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
		g.append(el);
		return el;
	};
	const s = size / 2;
	switch (kind) {
		case "circle": add("circle", { r: s, fill: color, class: "m-fill" }); break;
		case "ring": add("circle", { r: s * 0.8, stroke: color, class: "m-line", "stroke-width": 9 }); add("circle", { r: s * 0.8, fill: "none", stroke: "var(--ink)", "stroke-width": 1.5, opacity: 0 }); break;
		case "triangle": add("path", { d: `M0 ${-s} L${s} ${s * 0.8} L${-s} ${s * 0.8} Z`, fill: color, class: "m-fill" }); break;
		case "half": add("path", { d: `M${-s} 0 A${s} ${s} 0 0 1 ${s} 0 Z`, fill: color, class: "m-fill" }); break;
		case "squiggle": {
			let d = `M${-s} 0`;
			for (let i = 0; i < 4; i++) d += ` q${s / 4} ${-s / 2} ${s / 2} 0 t${s / 2} 0`.replace("t" + s / 2 + " 0", `t${0} 0`);
			d = `M${-s} 0 q${s / 4} ${-s / 2.2} ${s / 2} 0 t${s / 2} 0 t${s / 2} 0 t${s / 2} 0`;
			add("path", { d, stroke: color, class: "m-line", "stroke-width": 8 });
			break;
		}
		case "plus": add("path", { d: `M0 ${-s} V${s} M${-s} 0 H${s}`, stroke: color, class: "m-line", "stroke-width": 9 }); break;
		case "zigzag": add("path", { d: `M${-s} ${s / 2} l${s / 2} ${-s} l${s / 2} ${s} l${s / 2} ${-s} l${s / 2} ${s}`, stroke: color, class: "m-line", "stroke-width": 7 }); break;
		case "square": add("rect", { x: -s * 0.8, y: -s * 0.8, width: s * 1.6, height: s * 1.6, rx: 4, fill: color, class: "m-fill" }); break;
		default: {
			for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) add("circle", { cx: i * s * 0.55, cy: j * s * 0.55, r: 3.4, fill: "var(--ink)" });
		}
	}
	return g;
}
const KINDS = ["circle", "triangle", "squiggle", "half", "plus", "zigzag", "ring", "square", "dots"];

export function activate({ root, reducedMotion }) {
	const scenery = root.querySelector(".scenery-a");
	const overlay = root.querySelector(".overlay-a");
	const reduced = () => reducedMotion || document.documentElement.classList.contains("reduce-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches;

	// margin confetti: 1600x900 virtual canvas, stretched to cover
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("class", "memphis-confetti");
	svg.setAttribute("viewBox", "0 0 1600 900");
	svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
	const rand = rng(43);
	const bands = [[30, 380], [1220, 1570]];
	// terrazzo flecks
	for (let i = 0; i < 70; i++) {
		const [a, b] = bands[i % 2];
		const x = a + rand() * (b - a), y = rand() * 900, r = 3 + rand() * 6;
		const p = document.createElementNS(NS, "path");
		const pts = Array.from({ length: 5 }, (_, k) => { const ang = (k / 5) * 6.28 + rand(); const rr = r * (0.6 + rand() * 0.8); return `${(x + Math.cos(ang) * rr).toFixed(1)} ${(y + Math.sin(ang) * rr * 0.7).toFixed(1)}`; });
		p.setAttribute("d", `M${pts.join("L")}Z`);
		p.setAttribute("fill", COLORS[Math.floor(rand() * 4)]);
		p.setAttribute("class", "m-fleck");
		svg.append(p);
	}
	// bigger shapes in a loose grid inside the bands
	let n = 0;
	for (const [a, b] of bands) {
		for (let row = 0; row < 6; row++) {
			const col = rand() > 0.5 ? 1 : 0;
			const count = 1 + (rand() > 0.6 ? 1 : 0);
			for (let c = 0; c < count; c++) {
				const x = a + 40 + ((b - a - 80) / 2) * (c === 0 ? rand() * 0.9 : 1 + rand() * 0.9);
				const y = 70 + row * 140 + rand() * 50;
				const kind = KINDS[(n * 4 + row + col) % KINDS.length];
				const g = document.createElementNS(NS, "g");
				g.setAttribute("class", "m-drift");
				const inner = shape(kind, COLORS[n % 4], 56 + rand() * 40);
				inner.setAttribute("transform", `translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${Math.round(rand() * 80 - 40)})`);
				g.append(inner);
				svg.append(g);
				n++;
			}
		}
	}
	scenery.append(svg);

	// click to drop
	const maxDrops = 36;
	const onClick = (event) => {
		if (event.target.closest("a, button, input, li, p, h1, h2, img, nav, .site-socials")) return;
		const rect = overlay.getBoundingClientRect();
		const x = event.clientX - rect.left, y = event.clientY - rect.top;
		const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
		const color = COLORS[Math.floor(Math.random() * 4)];
		const s = document.createElementNS(NS, "svg");
		s.setAttribute("class", "memphis-drop");
		s.setAttribute("viewBox", "-48 -48 96 96");
		s.style.left = `${x}px`; s.style.top = `${y}px`;
		s.style.overflow = "visible";
		const g = shape(kind, color, 56);
		g.setAttribute("class", "m-drop-shape");
		s.append(g);
		s.querySelectorAll(".m-fill").forEach((e) => { e.style.stroke = "var(--ink)"; e.style.strokeWidth = 3; });
		s.querySelectorAll(".m-line").forEach((e) => { e.style.fill = "none"; e.style.strokeLinecap = "round"; });
		overlay.append(s);
		while (overlay.children.length > maxDrops) overlay.firstElementChild.remove();
		const rot = Math.round(Math.random() * 90 - 45);
		if (reduced()) { s.style.transform = `rotate(${rot}deg)`; return; }
		s.animate(
			[
				{ transform: `translateY(-${Math.min(y, 320) + 40}px) rotate(${rot - 120}deg) scale(.6)`, opacity: 0, offset: 0 },
				{ opacity: 1, offset: 0.12 },
				{ transform: `translateY(0) rotate(${rot}deg) scale(1.15, .8)`, offset: 0.5, easing: "ease-out" },
				{ transform: `translateY(-34px) rotate(${rot + 8}deg) scale(.95, 1.08)`, offset: 0.68, easing: "ease-in" },
				{ transform: `translateY(0) rotate(${rot}deg) scale(1.06, .94)`, offset: 0.82, easing: "ease-out" },
				{ transform: `translateY(-8px) rotate(${rot}deg) scale(1)`, offset: 0.92, easing: "ease-in" },
				{ transform: `translateY(0) rotate(${rot}deg) scale(1)`, offset: 1 },
			],
			{ duration: 1100, fill: "forwards", easing: "cubic-bezier(.5,0,.9,.6)" },
		);
	};
	root.addEventListener("click", onClick);
	return () => root.removeEventListener("click", onClick);
}
