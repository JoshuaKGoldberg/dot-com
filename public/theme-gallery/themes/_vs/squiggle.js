// _vs/squiggle.js: every link gets its own resting squiggle color (scheme below); hover drifts that hue slowly,
// driven only by pointer movement (--vsx is a registered property, so the change is a slow transition, not a loop).
import { clamp, isDark } from "../_refined-e/kit.js";

const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;

// hue span used by the position schemes: cyan through violet and rose to amber
const span = (f) => 175 + 270 * clamp(f);

const SECTION = { "site-posts": 165, "site-projects": 262, "site-talks": 28 };

export function vsSquiggle(root, scheme) {
	const dark = isDark();
	const S = dark ? 80 : 74, L = dark ? 68 : 46;
	let alive = true, cancel = 0;
	const links = () => [...root.querySelectorAll(".site-link")];

	function paint() {
		cancel = 0;
		if (!alive) return;
		const rr = root.getBoundingClientRect(), total = Math.max(1, root.scrollHeight);
		const page = root.querySelector(".site-page")?.getBoundingClientRect();
		const col0 = page ? page.left : rr.left, colW = Math.max(1, page ? page.width : rr.width);
		links().forEach((a, i) => {
			const r = a.getBoundingClientRect();
			const y = r.top - rr.top + root.scrollTop;
			let stops, s = S, l = L;
			if (scheme === "vertical") {
				stops = [span(y / total)];
			} else if (scheme === "golden") {
				stops = [200 + i * 137.508];
			} else if (scheme === "horizontal") {
				// hue follows page x, so each squiggle itself drifts left to right
				const f = (x) => span((x - col0) / colW);
				stops = [f(r.left), f((r.left + r.right) / 2), f(r.right)];
			} else if (scheme === "pastel") {
				const h = 20 + i * 137.508;
				stops = [h, h + 55, h + 115];
				s = dark ? 78 : 64; l = dark ? 76 : 62;
			} else { // section
				const sec = Object.keys(SECTION).find((k) => a.closest("." + k));
				const idx = links().filter((b) => b.closest(sec ? "." + sec : ".site-header,.site-hero,.site-about,.site-footer") === a.closest(sec ? "." + sec : ".site-header,.site-hero,.site-about,.site-footer")).indexOf(a);
				stops = [(sec ? SECTION[sec] : 205) + (idx % 4) * 9];
			}
			const rest = stops.length === 1 ? hsl(stops[0], s, l) : `linear-gradient(90deg, ${stops.map((h) => hsl(h, s, l)).join(", ")})`;
			// hover list: the resting hues with a few neighbours either side, so a slow slide only drifts the hue
			const lo = stops[0], hi = stops[stops.length - 1];
			const hov = [lo - 90, lo - 60, lo - 30, ...stops, hi + 30, hi + 60, hi + 90];
			a.style.setProperty("--vsRest", stops.length === 1 ? `linear-gradient(90deg, ${rest}, ${rest})` : rest);
			a.style.setProperty("--vsHover", hov.map((h) => hsl(h, s, l)).join(", "));
		});
	}
	const queue = () => { if (!cancel) cancel = requestAnimationFrame(paint); };
	const ro = new ResizeObserver(queue);
	ro.observe(root);
	document.fonts?.ready.then(queue);
	paint();

	const set = (e) => {
		const a = e.target?.closest?.(".site-link");
		if (!a) return;
		const r = a.getBoundingClientRect();
		a.style.setProperty("--vsx", (clamp((e.clientX - r.left) / Math.max(1, r.width)) * 100).toFixed(1));
	};
	root.addEventListener("pointermove", set, { passive: true });
	root.classList.add("vs-sq");
	return () => {
		alive = false; cancelAnimationFrame(cancel); ro.disconnect();
		root.removeEventListener("pointermove", set); root.classList.remove("vs-sq");
	};
}
