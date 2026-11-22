// 155: every title is set in a procedurally generated stroke typeface derived from its own text (an original skeleton alphabet,
// restyled by a seeded set of parameters: weight, caps, slant, width, tracking, and one of several line treatments).
import { hash, rng } from "./post-covers/lib.js";

const G = {
	A: [4, "M0 6L2 0L4 6M.8 4H3.2"],
	B: [4, "M0 6V0H2.4Q3.6 0 3.6 1.5Q3.6 2.9 2.4 3H0M2.4 3Q4 3 4 4.5Q4 6 2.4 6H0"],
	C: [4, "M4 1Q3.2 0 2 0Q0 0 0 3Q0 6 2 6Q3.2 6 4 5"],
	D: [4, "M0 0H1.8Q4 0 4 3Q4 6 1.8 6H0Z"],
	E: [4, "M4 0H0V6H4M0 3H3"],
	F: [4, "M4 0H0V6M0 3H3"],
	G: [4, "M4 1Q3.2 0 2 0Q0 0 0 3Q0 6 2 6Q4 6 4 3.5H2.2"],
	H: [4, "M0 0V6M4 0V6M0 3H4"],
	I: [2, "M0 0H2M1 0V6M0 6H2"],
	J: [3.4, "M3 0V4Q3 6 1.5 6Q0 6 0 4.5"],
	K: [4, "M0 0V6M4 0L0 3.5M1.4 2.6L4 6"],
	L: [4, "M0 0V6H4"],
	M: [4.4, "M0 6V0L2.2 3.6L4.4 0V6"],
	N: [4, "M0 6V0L4 6V0"],
	O: [4, "M2 0Q0 0 0 3Q0 6 2 6Q4 6 4 3Q4 0 2 0Z"],
	P: [4, "M0 6V0H2.4Q4 0 4 1.7Q4 3.4 2.4 3.4H0"],
	Q: [4, "M2 0Q0 0 0 3Q0 6 2 6Q4 6 4 3Q4 0 2 0ZM2.5 4.5L4 6.4"],
	R: [4, "M0 6V0H2.4Q4 0 4 1.7Q4 3.4 2.4 3.4H0M2 3.4L4 6"],
	S: [4, "M3.8 1Q3.2 0 2 0Q.2 0 .2 1.5Q.2 2.8 2 3Q3.8 3.2 3.8 4.5Q3.8 6 2 6Q.8 6 .2 5"],
	T: [4, "M0 0H4M2 0V6"],
	U: [4, "M0 0V4Q0 6 2 6Q4 6 4 4V0"],
	V: [4, "M0 0L2 6L4 0"],
	W: [5, "M0 0L1.2 6L2.5 2.4L3.8 6L5 0"],
	X: [4, "M0 0L4 6M4 0L0 6"],
	Y: [4, "M0 0L2 3L4 0M2 3V6"],
	Z: [4, "M0 0H4L0 6H4"],
	"!": [2, "M1 0V4M1 5.6V6"],
	"'": [2, "M1 0V1.8"],
	".": [2, "M1 5.6V6"],
	"-": [3, "M0 3H3"],
	"&": [4.4, "M4 6L1 2Q.6 1 1.2.4Q2.4-.2 2.9 1Q3 2 .8 3.8Q-.2 5 .8 5.8Q2.2 6.4 4 3"],
};
const SPACE = 2.6;
const TREATMENTS = ["solid", "inline", "dashed", "dotted", "shadow", "twin", "rough"];

function style(seed) {
	const r = rng(hash(seed));
	return {
		weight: 0.55 + r() * 0.75,
		cap: ["round", "butt", "square"][Math.floor(r() * 3)],
		join: r() < 0.5 ? "round" : "miter",
		slant: (r() < 0.4 ? 0 : r() * 14) * (r() < 0.2 ? -1 : 1),
		width: 0.8 + r() * 0.55,
		track: 0.45 + r() * 1.1,
		treat: TREATMENTS[Math.floor(r() * TREATMENTS.length)],
		jitter: r() < 0.35 ? 0.9 + r() * 1.6 : 0,
		small: 0.62 + r() * 0.16,
		color: Math.floor(r() * 3),
		r: hash(seed),
	};
}

export function titleSvg(text, seed, colors, opts = {}) {
	const st = opts.style ?? style(seed);
	const r = rng(st.r);
	let x = 0.6;
	const parts = [];
	const H = 6, padY = 1.2;
	for (const ch of text) {
		if (ch === " ") { x += SPACE * st.width; continue; }
		const up = ch.toUpperCase();
		const g = G[up];
		if (!g) continue;
		const lower = ch !== up && /[a-z]/.test(ch);
		const sy = lower ? st.small : 1;
		const w = g[0] * st.width;
		const rot = st.jitter ? (r() - 0.5) * st.jitter * 5 : 0;
		const dy = st.jitter ? (r() - 0.5) * st.jitter : 0;
		const ty = padY + (H - H * sy) + dy;
		parts.push(`<path transform="translate(${x.toFixed(2)} ${ty.toFixed(2)}) rotate(${rot.toFixed(1)} ${(w / 2).toFixed(1)} ${(H * sy).toFixed(1)}) scale(${st.width} ${sy})" d="${g[1]}"/>`);
		x += w + st.track;
	}
	const width = x + 0.6 + Math.abs(st.slant) * 0.05 * 6;
	const sw = st.weight;
	const ink = [colors.strong, colors.accent, colors.squiggle][st.color % 3];
	const body = parts.join("");
	const common = `fill="none" stroke-linecap="${st.cap}" stroke-linejoin="${st.join}" vector-effect="non-scaling-stroke"`;
	// vector-effect keeps weight in px so we compute it from the svg scale instead
	let inner;
	const stroke = (w, color, extra = "") => `<g ${`fill="none" stroke-linecap="${st.cap}" stroke-linejoin="${st.join}" stroke="${color}" stroke-width="${(w / st.width).toFixed(2)}"`} ${extra}>${body}</g>`;
	switch (st.treat) {
		case "inline": inner = stroke(sw * 1.9, ink) + stroke(sw * 0.55, colors.bg); break;
		case "dashed": inner = stroke(sw * 1.15, ink, `stroke-dasharray="${(0.9 + sw).toFixed(1)} ${(0.6).toFixed(1)}"`); break;
		case "dotted": inner = stroke(sw * 1.05, ink, `stroke-dasharray="0.01 ${(sw * 1.5).toFixed(2)}" stroke-linecap="round"`); break;
		case "shadow": inner = `<g transform="translate(.5 .5)">${stroke(sw, colors.squiggle)}</g>` + stroke(sw, ink); break;
		case "twin": inner = `<g transform="translate(-.28 -.28)">${stroke(sw * 0.5, ink)}</g><g transform="translate(.28 .28)">${stroke(sw * 0.5, colors.accent)}</g>`; break;
		case "rough": inner = stroke(sw, ink, `stroke-dasharray="${(1.8 + sw).toFixed(1)} 0.12"`); break;
		default: inner = stroke(sw, ink);
	}
	const skew = Math.tan((st.slant * Math.PI) / 180);
	const total = H + padY * 2;
	return { st, html: `<svg class="tf-svg" viewBox="0 0 ${width.toFixed(2)} ${total}" aria-hidden="true" focusable="false"><g transform="matrix(1 0 ${(-skew).toFixed(3)} 1 ${(skew * total * 0.5).toFixed(2)} 0)">${inner}</g></svg>`, ratio: width / total };
}

export function activate({ root, reducedMotion }) {
	const cs = getComputedStyle(root);
	const get = (n) => cs.getPropertyValue(n).trim();
	const colors = { strong: get("--siteFgStrong"), accent: get("--siteAccent"), squiggle: get("--siteSquiggle"), bg: get("--siteBg") };
	const titles = [...root.querySelectorAll(".site-title, .site-section-title")];
	const rolls = new Map();
	const render = (el, text) => {
		const n = (rolls.get(el) ?? 0);
		const { html, st } = titleSvg(text, text + "#" + n, colors);
		let host = el.querySelector(".tf-host");
		if (!host) { host = document.createElement("span"); host.className = "tf-host"; el.append(host); }
		host.innerHTML = html;
		el.dataset.face = st.treat;
	};
	const onEnter = (e) => {
		const el = e.currentTarget;
		rolls.set(el, (rolls.get(el) ?? 0) + 1);
		render(el, el.dataset.text);
	};
	for (const el of titles) {
		const text = el.textContent.trim();
		el.dataset.text = text;
		el.textContent = "";
		const live = document.createElement("span");
		live.className = "tf-live";
		live.textContent = text;
		el.append(live);
		render(el, text);
		el.addEventListener("pointerenter", onEnter);
		el.setAttribute("title", "Hover to re-roll this typeface");
	}
	// wallpaper specimen: A-Z in each title's face, very faint
	const layer = root.querySelector(".scenery-a");
	const spec = document.createElement("div");
	spec.className = "tf-spec";
	const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	spec.innerHTML = titles.map((el, i) => `<div class="tf-row">${titleSvg(alpha.slice(i * 6, i * 6 + 14) + " " + alpha.slice(0, 6), el.dataset.text + "#0", colors).html}</div>`).join("");
	layer.append(spec);
	const hint = document.createElement("div");
	hint.className = "tf-hint";
	hint.textContent = "Every title is a generated typeface, hover one to re-roll it";
	root.querySelector(".overlay-a").append(hint);
	return () => { for (const el of titles) el.removeEventListener("pointerenter", onEnter); };
}
