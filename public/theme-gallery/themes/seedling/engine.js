const NS = "http://www.w3.org/2000/svg";
const KEY = "seedling-visits";
const MAX = 10;
const NAMES = ["", "Seed", "Sprout", "Seedling", "Seedling", "Sapling", "Sapling", "Budding", "Budding", "Flowering", "In full bloom"];

// stem is one cubic bezier so leaves can be placed exactly on it
const P = [[120, 214], [96, 150], [148, 98], [120, 34]];
const at = (t) => {
	const u = 1 - t;
	const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
	const d = (i) => k[0] * P[0][i] + k[1] * P[1][i] + k[2] * P[2][i] + k[3] * P[3][i];
	const dt = (i) => 3 * u * u * (P[1][i] - P[0][i]) + 6 * u * t * (P[2][i] - P[1][i]) + 3 * t * t * (P[3][i] - P[2][i]);
	return { x: d(0), y: d(1), angle: (Math.atan2(dt(1), dt(0)) * 180) / Math.PI };
};

const el = (tag, attrs = {}, parent) => {
	const n = document.createElementNS(NS, tag);
	for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
	parent?.append(n);
	return n;
};

export function mount({ plot, reducedMotion }) {
	const stage = plot.querySelector(".seed-stage");
	const svg = el("svg", { viewBox: "0 0 240 240", class: "seed-svg", role: "img", "aria-label": "A small plant" }, stage);
	const defs = el("defs", {}, svg);
	const lg = el("linearGradient", { id: "seedLeaf", x1: "0", y1: "0", x2: "1", y2: "1" }, defs);
	el("stop", { offset: "0", class: "leaf-a" }, lg);
	el("stop", { offset: "1", class: "leaf-b" }, lg);
	el("ellipse", { cx: 120, cy: 218, rx: 58, ry: 11, class: "seed-soil" }, svg);
	const seed = el("ellipse", { cx: 120, cy: 211, rx: 5, ry: 3.4, class: "seed-seed" }, svg);
	const stem = el("path", { d: `M${P[0]} C${P[1]} ${P[2]} ${P[3]}`, pathLength: 1, class: "seed-stem" }, svg);

	const leaves = [0.2, 0.34, 0.48, 0.6, 0.72, 0.84].map((t, i) => {
		const { x, y } = at(t);
		const side = i % 2 ? -1 : 1;
		const g = el("g", { transform: `translate(${x} ${y}) scale(${side} 1) rotate(${-24 - i * 3})` }, svg);
		const inner = el("g", { class: "seed-leaf" }, g);
		el("path", { d: `M0 0 C10 -${14 + i} ${34 - i * 2} -${12 + i} ${46 - i * 3} -${2}  C${32 - i * 2} 10 ${12} 10 0 0Z`, fill: "url(#seedLeaf)" }, inner);
		el("path", { d: `M2 0 L${38 - i * 3} -2`, class: "seed-vein" }, inner);
		return { t, inner };
	});

	const top = at(1);
	const flower = el("g", { transform: `translate(${top.x} ${top.y})` }, svg);
	const bud = el("ellipse", { cx: 0, cy: -4, rx: 7, ry: 10, class: "seed-bud" }, flower);
	const petals = [];
	for (let i = 0; i < 10; i++) {
		const a = el("g", { transform: `rotate(${i * 36})` }, flower);
		const p = el("g", { class: "seed-petal" }, a);
		el("ellipse", { cx: 0, cy: -17, rx: 6.5, ry: 14, class: i % 2 ? "petal-b" : "petal-a" }, p);
		petals.push(p);
	}
	const core = el("circle", { r: 7, class: "seed-core" }, flower);
	const rain = el("g", { class: "seed-rain" }, svg);
	for (let i = 0; i < 9; i++) el("path", { d: `M${72 + i * 12 + (i % 3) * 3} 20v10`, style: `--d:${(i * 83) % 400}ms` }, rain);

	const ui = plot.querySelector(".seed-ui");
	ui.innerHTML =
		'<p class="seed-label" aria-live="polite"></p>' +
		'<div class="seed-dots" aria-hidden="true"></div>' +
		'<div class="seed-actions"><button class="seed-sim" type="button">Simulate a visit <span aria-hidden="true">☔</span></button><button class="seed-reset" type="button">Dig it up</button></div>';
	const label = ui.querySelector(".seed-label");
	const dots = ui.querySelector(".seed-dots");
	for (let i = 0; i < MAX; i++) dots.append(document.createElement("i"));

	let n = 0;
	const ease = (x) => 1 - (1 - x) * (1 - x);
	function set(visits, animate) {
		n = visits;
		const stemG = ease(Math.min(1, Math.max(0, (n - 1) / 7))) * (n >= 2 ? 1 : 0) + (n === 1 ? 0.06 : 0);
		plot.style.setProperty("--g", String(animate && !reducedMotion ? 1 : 0));
		stem.style.strokeDashoffset = String(1 - Math.min(1, stemG));
		stem.style.opacity = n >= 1 ? 1 : 0;
		seed.style.opacity = n >= 2 ? 0 : 1;
		leaves.forEach((l, i) => {
			const s = Math.min(1, Math.max(0, (stemG - l.t + 0.1) / 0.28));
			l.inner.style.transform = `scale(${s})`;
			l.inner.style.transitionDelay = reducedMotion ? "0s" : `${0.5 + i * 0.12}s`;
		});
		const budS = n >= 8 ? 1 : 0;
		bud.style.transform = `scale(${n >= 10 ? 0 : budS})`;
		const bloom = Math.min(1, Math.max(0, (n - 8) / 2));
		petals.forEach((p, i) => {
			p.style.transform = `scale(${bloom})`;
			p.style.transitionDelay = reducedMotion ? "0s" : `${0.9 + i * 0.05}s`;
		});
		core.style.transform = `scale(${n >= 9 ? 1 : 0})`;
		label.textContent = `Visit ${n} · ${NAMES[Math.min(n, MAX)]}`;
		[...dots.children].forEach((d, i) => d.classList.toggle("on", i < n));
		plot.classList.toggle("is-bloomed", n >= MAX);
		if (animate && !reducedMotion) {
			rain.classList.remove("go");
			void rain.getBoundingClientRect();
			rain.classList.add("go");
		}
	}

	const onClick = (e) => {
		const t = e.target.closest("button");
		if (!t) return;
		if (t.classList.contains("seed-sim")) {
			const next = Math.min(MAX + 2, n + 1);
			localStorage.setItem(KEY, String(next));
			set(next, true);
		} else if (t.classList.contains("seed-reset")) {
			localStorage.removeItem(KEY);
			localStorage.removeItem("seedling-day");
			plot.classList.remove("is-planted");
			set(0, false);
			plot.querySelector(".seed-plant").focus();
		}
	};
	ui.addEventListener("click", onClick);
	set(0, false);
	return { set, destroy() {} };
}
