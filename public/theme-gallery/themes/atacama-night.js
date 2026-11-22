import { el, div, hills, rng, starSVG } from "./two-skies-one-shore/lib.js";

export function activate({ root, reducedMotion }) {
	const dark = document.documentElement.classList.contains("dark");
	const a = root.querySelector(".scenery-a");
	const c = root.querySelector(".scenery-c");

	const mw = div("mw", a);
	div("mw-glow", mw);
	div("mw-dust", mw);

	const field = starSVG({ seed: 7300, count: 170, maxY: 0.86, twinkle: [9, 16], twinkleShare: 0.4, maxO: 0.75 });
	// Extra stars concentrated along the band.
	const r = rng(7301);
	for (let i = 0; i < 160; i++) {
		const u = r();
		const off = (r() + r() + r() - 1.5) * 0.11;
		const x = u * 100;
		const y = (0.78 - u * 0.62 + off) * 100;
		if (y < 0 || y > 86) continue;
		el("ellipse", { cx: `${x.toFixed(2)}%`, cy: `${y.toFixed(2)}%`, rx: 0.55, ry: 0.55, opacity: (0.2 + r() * 0.5).toFixed(2) }, field);
	}
	a.appendChild(field);

	const W = 1600;
	const H = 220;
	const far = hills({ w: W, h: H, base: 120, amp: 36, seed: 4, waves: 5, step: 8 });
	const near = hills({ w: W, h: H, base: 170, amp: 22, seed: 9, waves: 4, step: 8 });
	const svg = el("svg", { class: "dune-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMax slice" }, c);
	el("path", { d: far.d, class: "far" }, svg);
	// Slim rim light along the far crest.
	let rim = "";
	for (let x = 0; x <= W; x += 8) rim += `${x ? "L" : "M"}${x} ${far.y(x).toFixed(1)}`;
	el("path", { d: rim, class: "rim" }, svg);
	el("path", { d: near.d, class: "near" }, svg);

	if (!dark || reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	const sky = root.querySelector(".scenery-a");
	let timer = 0;
	function shoot() {
		if (!document.hidden) {
			const m = div("shooting", sky);
			const ang = 18 + Math.random() * 25;
			m.style.left = `${15 + Math.random() * 55}%`;
			m.style.top = `${5 + Math.random() * 35}%`;
			const dist = 300 + Math.random() * 200;
			const dx = Math.cos((ang * Math.PI) / 180) * dist;
			const dy = Math.sin((ang * Math.PI) / 180) * dist;
			m.animate(
				[
					{ opacity: 0, transform: `translate(0,0) rotate(${ang}deg)` },
					{ opacity: 0.8, offset: 0.15, transform: `translate(${dx * 0.15}px,${dy * 0.15}px) rotate(${ang}deg)` },
					{ opacity: 0, transform: `translate(${dx}px,${dy}px) rotate(${ang}deg)` },
				],
				{ duration: 900, easing: "ease-out" },
			).onfinish = () => m.remove();
		}
		timer = setTimeout(shoot, 45000 + Math.random() * 45000);
	}
	timer = setTimeout(shoot, 12000 + Math.random() * 10000);
	return () => clearTimeout(timer);
}
