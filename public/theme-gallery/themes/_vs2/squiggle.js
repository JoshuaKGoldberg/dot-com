// _vs2/squiggle.js: every link rests in the site's blue; on hover a fixed hue map along its length (--vsRb) is revealed
// from the entry point. Colors never cycle: the map is static, only the reveal (a CSS transition) plays.
import { clamp, isDark } from "../_refined-e/kit.js";

const hsl = (h, s, l) => `hsl(${(((h % 360) + 360) % 360).toFixed(0)} ${s}% ${l}%)`;

// opts: { h0 base hue, span degrees along the link, perLink hue step between links, sat, light, sweep: "entry"|"left"|"center"|"right",
//         thick, glow, glints, dur }
export function vsSquiggle(root, opts = {}) {
	const o = { h0: 170, span: 300, perLink: 47, sat: 0, light: 0, sweep: "entry", thick: 1.35, glow: 0.5, glints: 0, dur: 1, stops: 9, ...opts };
	const dark = isDark();
	const S = o.sat || (dark ? 82 : 76), L = o.light || (dark ? 68 : 45);
	const links = [...root.querySelectorAll(".site-link")];
	links.forEach((a, i) => {
		const h = o.h0 + i * o.perLink;
		const cols = [];
		for (let k = 0; k < o.stops; k++) cols.push(hsl(h + (k / (o.stops - 1)) * o.span, S, L));
		a.style.setProperty("--vsRb", `linear-gradient(90deg, ${cols.join(", ")})`);
		a.style.setProperty("--vsThick", String(o.thick));
		a.style.setProperty("--vsGlow", String(o.glow));
		a.style.setProperty("--vsGlints", String(o.glints));
		a.style.setProperty("--vsDur", `${o.dur}s`);
		if (o.sweep !== "entry") a.style.setProperty("--vsx", o.sweep === "left" ? "0" : o.sweep === "right" ? "100" : "50");
	});
	// entry point: set only on the way in (not while hovering), so the colors hold still
	const enter = (e) => {
		if (o.sweep !== "entry") return;
		const a = e.target?.closest?.(".site-link");
		if (!a) return;
		const r = a.getBoundingClientRect();
		a.style.setProperty("--vsx", (clamp((e.clientX - r.left) / Math.max(1, r.width)) * 100).toFixed(1));
	};
	root.addEventListener("pointerover", enter, { passive: true });
	root.classList.add("vs-sq");
	return () => { root.removeEventListener("pointerover", enter); root.classList.remove("vs-sq"); };
}
