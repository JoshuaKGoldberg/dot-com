import { el, div, rng } from "./two-skies-one-shore/lib.js";

// Half outline of a simple maple leaf; mirrored for the other side.
const half = [[0, -10], [2.2, -4.8], [6.6, -7.6], [5, -1.2], [9.8, 0.4], [4.6, 3.6], [1.2, 3.2]];
const leafPath = () => {
	const right = half.map(([x, y]) => `${x},${y}`);
	const left = [...half].reverse().map(([x, y]) => `${-x},${y}`);
	return `M${right.join("L")}L0.9,10L-0.9,10L${left.join("L")}Z`;
};

export function activate({ root, reducedMotion }) {
	const dark = document.documentElement.classList.contains("dark");
	const b = root.querySelector(".scenery-b");
	const c = root.querySelector(".scenery-c");
	const r = rng(1999);

	const maple = dark
		? ["232 112 52", "206 78 46", "224 150 72", "176 64 60"]
		: ["226 162 59", "196 98 48", "201 153 58", "214 120 50"];
	for (let i = 0; i < 26; i++) {
		const s = 40 + Math.pow(r(), 1.5) * 190;
		const d = div("bokeh", b);
		d.style.setProperty("--s", `${s.toFixed(0)}px`);
		d.style.setProperty("--x", `${(r() * 105 - 5).toFixed(1)}%`);
		d.style.setProperty("--y", `${(r() * 100 - 4).toFixed(1)}%`);
		d.style.setProperty("--bk", maple[Math.floor(r() * maple.length)]);
		d.style.setProperty("--o", (dark ? 0.16 + r() * 0.24 : 0.3 + r() * 0.35).toFixed(2));
		d.style.setProperty("--dur", `${(40 + r() * 50).toFixed(0)}s`);
		d.style.setProperty("--dl", `${(-r() * 40).toFixed(0)}s`);
		d.style.setProperty("--dx", `${(r() * 50 - 25).toFixed(0)}px`);
		d.style.setProperty("--dy", `${(r() * 50 - 30).toFixed(0)}px`);
	}

	// A few leaves, only in the outer margins.
	const colors = dark ? ["#e0763a", "#c4503a", "#d59a50"] : ["#c9672c", "#b5522c", "#d79a2f"];
	const slots = [3, 8, 11, 90, 94, 97, 6, 92];
	slots.forEach((vw, i) => {
		const leaf = div("leaf", c);
		const size = 34 + r() * 22;
		leaf.style.setProperty("--lx", `${vw + (r() - 0.5) * 2}vw`);
		leaf.style.setProperty("--ls", `${size.toFixed(0)}px`);
		leaf.style.setProperty("--lc", colors[i % colors.length]);
		leaf.style.setProperty("--lr", `${(r() * 360).toFixed(0)}deg`);
		leaf.style.setProperty("--fall", `${(34 + r() * 30).toFixed(0)}s`);
		leaf.style.setProperty("--fdl", `${(-r() * 60).toFixed(0)}s`);
		leaf.style.setProperty("--sway-d", `${(4 + r() * 4).toFixed(1)}s`);
		leaf.style.setProperty("--drift", `${((r() - 0.5) * 60).toFixed(0)}px`);
		if (reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches) leaf.style.setProperty("--ly", `${(10 + r() * 80).toFixed(0)}vh`);
		const svg = el("svg", { viewBox: "-12 -12 24 24" }, leaf);
		el("path", { d: leafPath(), "stroke-linejoin": "round", "stroke-width": 1.2 }, svg);
	});
}
