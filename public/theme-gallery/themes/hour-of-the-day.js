import { el, div, pineRidge, shimmerSVG, starSVG } from "./two-skies-one-shore/lib.js";

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => {
	const x = hex(a);
	const y = hex(b);
	return toHex(x.map((v, i) => v + (y[i] - v) * t));
};

// Palette keyframes by hour. Day keys stay pale (dark text), night keys stay deep (light text).
const DAY = [
	{ h: 5.5, top: "#c9d3ee", mid: "#f1d9d6", hor: "#fbc8a8", glow: "255,196,150" },
	{ h: 9, top: "#bcd6f0", mid: "#dbe8f2", hor: "#f6ead9", glow: "255,236,200" },
	{ h: 12.5, top: "#a9cdf0", mid: "#cfe4f5", hor: "#e9f2f8", glow: "255,255,240" },
	{ h: 16, top: "#b6d0ee", mid: "#e6e6e2", hor: "#f6e2bd", glow: "255,226,160" },
	{ h: 18, top: "#c3d0ec", mid: "#f1e0cb", hor: "#f9cf94", glow: "255,190,110" },
	{ h: 19.5, top: "#c8c6e6", mid: "#ecd2d8", hor: "#f6bba8", glow: "255,170,140" },
];
const NIGHT = [
	{ h: 19.5, top: "#161940", mid: "#352c5c", hor: "#6e4262", glow: "230,130,120" },
	{ h: 22, top: "#0b0e2c", mid: "#181c4a", hor: "#3a3668", glow: "150,140,230" },
	{ h: 24, top: "#05071a", mid: "#0d1236", hor: "#222a5a", glow: "120,140,230" },
	{ h: 27.5, top: "#0a1032", mid: "#17265a", hor: "#34467c", glow: "130,160,240" },
	{ h: 29.5, top: "#141a45", mid: "#38396e", hor: "#765672", glow: "230,150,130" },
];

function sample(keys, h) {
	if (h <= keys[0].h) return { ...keys[0] };
	for (let i = 1; i < keys.length; i++) {
		if (h <= keys[i].h) {
			const a = keys[i - 1];
			const b = keys[i];
			const t = (h - a.h) / (b.h - a.h);
			const s = t * t * (3 - 2 * t);
			return {
				top: mix(a.top, b.top, s),
				mid: mix(a.mid, b.mid, s),
				hor: mix(a.hor, b.hor, s),
				glow: hex(mix(toHex(a.glow.split(",").map(Number)), toHex(b.glow.split(",").map(Number)), s)).join(","),
			};
		}
	}
	return { ...keys[keys.length - 1] };
}

function readHour() {
	const q = new URLSearchParams(location.search).get("hour");
	if (q !== null && q !== "") {
		const m = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i.exec(q.trim());
		if (m) {
			let h = Number(m[1]);
			const min = m[2] ? Number(m[2]) : 0;
			if (m[3]) h = (h % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0);
			return { h: (h + min / 60) % 24, fixed: true };
		}
		const n = parseFloat(q);
		if (!Number.isNaN(n)) return { h: ((n % 24) + 24) % 24, fixed: true };
	}
	const d = new Date();
	return { h: d.getHours() + d.getMinutes() / 60, fixed: false };
}

function format(h) {
	const hh = Math.floor(h);
	const mm = Math.floor((h - hh) * 60 + 1e-6);
	const ap = hh >= 12 ? "pm" : "am";
	return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, "0")} ${ap}`;
}

export function activate({ root }) {
	const dark = document.documentElement.classList.contains("dark");
	const a = root.querySelector(".scenery-a");
	const b = root.querySelector(".scenery-b");
	const c = root.querySelector(".scenery-c");
	const overlay = root.querySelector(".overlay-a");

	if (dark) a.appendChild(starSVG({ seed: 8, count: 160, maxY: 0.8, maxO: 0.55 }));
	const glow = div("horizon-glow", a);
	const orb = div("orb", a);
	div("orb-halo", orb);
	div("orb-disc", orb);

	const W = 1600;
	const H = 150;
	const far = pineRidge({ w: W, h: H, base: 104, amp: 12, treeH: 20, seed: 15, gap: [8, 15] });
	const near = pineRidge({ w: W, h: H, base: 128, amp: 7, treeH: 30, seed: 19, gap: [9, 17] });
	const svg = el("svg", { class: "ridge-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMax slice" }, c);
	el("path", { d: far.d, class: "far" }, svg);
	el("path", { d: near.d, class: "near" }, svg);
	const refl = el("svg", { class: "lake-reflection", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMin slice" }, b);
	el("path", { d: near.d }, refl);
	for (const [cls, seed] of [["shimmer", 41], ["shimmer shimmer-b", 67]]) {
		div(cls, b).appendChild(shimmerSVG({ seed, count: 36 }));
	}

	const caption = div("hour-caption", overlay);

	function apply() {
		const { h: hour, fixed } = readHour();
		let h = hour;
		let p;
		let pal;
		if (dark) {
			// Night shades only: daytime hours clamp to the nearest night key.
			if (h < 5.5) h += 24;
			else if (h < 12.5) h = 29.5;
			else if (h < 19.5) h = 19.5;
			pal = sample(NIGHT, h);
			p = Math.min(1, Math.max(0, (h - 19.5) / 10));
		} else {
			h = Math.min(19.5, Math.max(5.5, h));
			pal = sample(DAY, h);
			p = (h - 5.5) / 14;
		}
		const arc = Math.sin(Math.PI * p);
		const peak = dark ? 0.5 : 0.62;
		const s = root.style;
		s.setProperty("--sky-top", pal.top);
		s.setProperty("--sky-mid", pal.mid);
		s.setProperty("--sky-hor", pal.hor);
		const ridge = dark ? mix(pal.top, "#000000", 0.45) : mix(pal.mid, "#6f8c98", 0.55);
		s.setProperty("--ridge", ridge);
		s.setProperty("--ridge-far", mix(ridge, pal.mid, 0.45));
		s.setProperty("--lake-top", mix(pal.hor, pal.mid, 0.15));
		s.setProperty("--lake-bot", dark ? mix(pal.top, "#000000", 0.25) : mix(pal.top, pal.mid, 0.2));
		s.setProperty("--streak", dark ? mix(pal.hor, "#ffffff", 0.45) : "#ffffff");
		s.setProperty("--siteBg", pal.mid);
		s.setProperty("--glow", `rgba(${pal.glow}, 0.55)`);
		s.setProperty("--glow-o", (dark ? 0.2 + 0.3 * (1 - arc) : 0.3 + 0.5 * (1 - arc)).toFixed(2));
		s.setProperty("--orb", dark ? "#eef1ff" : "#fff8e6");
		s.setProperty("--orb-o", dark ? "0.6" : "0.7");
		s.setProperty("--orb-x", `${(12 + 76 * p).toFixed(1)}%`);
		s.setProperty("--orb-y", `${(98 - arc * peak * 100).toFixed(1)}%`);
		caption.textContent = `sky for ${format(hour)}`;
		return fixed;
	}

	const fixed = apply();
	const timer = fixed ? 0 : setInterval(apply, 60000);
	return () => clearInterval(timer);
}
