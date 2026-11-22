/**
 * @typedef {{ bg: string; fg: string; strong: string; muted: string; accent: string; squiggle: string; subtle: string }} Tokens
 * @typedef {[month: number, day: number]} MonthDay
 * @typedef {{
 *   id: "default" | "halloween" | "winter" | "release" | "hacktoberfest" | "squiggleconf";
 *   name: string;
 *   banner: string;
 *   from: MonthDay;
 *   to: MonthDay;
 *   priority: number;
 *   light: Tokens;
 *   dark: Tokens;
 * }} Season
 */

/** The calendar. Ranges are inclusive; a range with from > to wraps the new year. Higher priority wins overlaps. */
/** @type {Season[]} */
export const seasons = [
	{
		id: "default", name: "Default", banner: "", from: [1, 1], to: [12, 31], priority: 0,
		light: { bg: "#fdffff", fg: "#283556", strong: "#142842", muted: "#4f5f80", accent: "#0b5fb8", squiggle: "#00a3ff", subtle: "#d7e9ef" },
		dark: { bg: "#0b1220", fg: "#dae7f3", strong: "#f1f6fb", muted: "#93a5bf", accent: "#77bbff", squiggle: "#00a3ff", subtle: "#102a40" },
	},
	{
		// Hacktoberfest runs all of October; Halloween takes over for its last week.
		id: "hacktoberfest", name: "Hacktoberfest", banner: "\u{1F7E3} Hacktoberfest mode on: open source needs you", from: [10, 1], to: [10, 23], priority: 3,
		light: { bg: "#f8f4ff", fg: "#2a1a4d", strong: "#170a33", muted: "#5d4a8a", accent: "#6a2fd6", squiggle: "#9d6bff", subtle: "#e5d9fb" },
		dark: { bg: "#120b22", fg: "#e9defc", strong: "#ffffff", muted: "#b7a4e0", accent: "#b794ff", squiggle: "#8b5cf6", subtle: "#251745" },
	},
	{
		id: "halloween", name: "Halloween", banner: "\u{1F383} Spooky types mode on", from: [10, 24], to: [10, 31], priority: 5,
		light: { bg: "#fff3e3", fg: "#2d1b0e", strong: "#1c0f05", muted: "#6a4a2c", accent: "#b03e00", squiggle: "#7a2cc4", subtle: "#fbdcb4" },
		dark: { bg: "#130c1d", fg: "#f1e5ff", strong: "#ffffff", muted: "#bfa6df", accent: "#ff8a2b", squiggle: "#a86bff", subtle: "#2a1a40" },
	},
	{
		id: "winter", name: "Winter holidays", banner: "❄️ Winter holidays mode on", from: [12, 15], to: [1, 2], priority: 4,
		light: { bg: "#f3f9fd", fg: "#1d3248", strong: "#0d2236", muted: "#4c6580", accent: "#b3182f", squiggle: "#1f8f5a", subtle: "#d9eaf5" },
		dark: { bg: "#0a1622", fg: "#dcebf7", strong: "#f4fbff", muted: "#9fb7cc", accent: "#ff7a8c", squiggle: "#4fd08e", subtle: "#15293c" },
	},
	{
		// A plausible TypeScript major-release day (typically a Tuesday in spring).
		id: "release", name: "TypeScript release day", banner: "\u{1F537} TypeScript 7.0 release day mode on", from: [3, 17], to: [3, 17], priority: 6,
		light: { bg: "#f5f9ff", fg: "#1b2c48", strong: "#0b1a30", muted: "#4a5f80", accent: "#2060b4", squiggle: "#3178c6", subtle: "#dbe8f9" },
		dark: { bg: "#08121f", fg: "#d6e4f6", strong: "#f2f8ff", muted: "#92a9c8", accent: "#6db0ff", squiggle: "#3178c6", subtle: "#12253e" },
	},
	{
		id: "squiggleconf", name: "SquiggleConf week", banner: "〰️ SquiggleConf week mode on: come say hi", from: [9, 21], to: [9, 27], priority: 7,
		light: { bg: "#fff8ee", fg: "#2b2230", strong: "#170f1c", muted: "#66566e", accent: "#b4137a", squiggle: "#00a7b5", subtle: "#fde6c8" },
		dark: { bg: "#151019", fg: "#f3e9f5", strong: "#ffffff", muted: "#bfaec6", accent: "#ff6fc2", squiggle: "#2fd3e0", subtle: "#2c1f33" },
	},
];
export const palettes = seasons;

const KEYS = { bg: "--siteBg", fg: "--siteFg", strong: "--siteFgStrong", muted: "--siteMuted", accent: "--siteAccent", squiggle: "--siteSquiggle", subtle: "--siteSubtle" };
const ord = ([m, d]) => m * 100 + d;

/** @param {Date} date @returns {Season} */
export function seasonFor(date) {
	const now = ord([date.getMonth() + 1, date.getDate()]);
	const hits = seasons.filter((s) => {
		const a = ord(s.from), b = ord(s.to);
		return a <= b ? now >= a && now <= b : now >= a || now <= b;
	});
	return hits.sort((x, y) => y.priority - x.priority)[0] ?? seasons[0];
}

const JUMPS = [
	["Spooky", "2026-10-31"],
	["Winter", "2026-12-24"],
	["TS day", "2026-03-17"],
	["Hacktoberfest", "2026-10-10"],
	["SquiggleConf", "2026-09-24"],
	["Default", "2026-11-18"],
];

export function activate({ root, mode }) {
	const page = root.querySelector(".site-page");

	const banner = document.createElement("div");
	banner.className = "se-banner";
	banner.setAttribute("role", "status");
	banner.innerHTML = `<span class="se-banner-text"></span><button type="button" class="se-dismiss" aria-label="Dismiss banner">×</button>`;
	page.prepend(banner);

	const sim = document.createElement("div");
	sim.className = "se-sim";
	const today = new Date();
	const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	sim.innerHTML = `<label>Simulate date <input type="date" value="${iso(today)}" min="2026-01-01" max="2026-12-31" /></label>
		<span class="se-chips">${JUMPS.map(([n, d]) => `<button type="button" data-date="${d}">${n}</button>`).join("")}</span>
		<span class="se-active"></span>`;
	root.append(sim);
	const input = sim.querySelector("input");
	const active = sim.querySelector(".se-active");
	let dismissed = null;

	const apply = () => {
		const [y, m, d] = input.value.split("-").map(Number);
		const date = new Date(y || 2026, (m || 1) - 1, d || 1);
		const season = seasonFor(date);
		const t = season[mode];
		for (const [k, prop] of Object.entries(KEYS)) root.style.setProperty(prop, t[k]);
		root.dataset.season = season.id;
		active.textContent = `Active: ${season.name}`;
		banner.hidden = !season.banner || dismissed === season.id;
		banner.querySelector(".se-banner-text").textContent = season.banner;
	};
	input.addEventListener("input", apply);
	sim.querySelectorAll("[data-date]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.date; dismissed = null; apply(); }));
	banner.querySelector(".se-dismiss").addEventListener("click", () => { dismissed = root.dataset.season; banner.hidden = true; });
	apply();

	return () => {
		root.removeAttribute("data-season");
		for (const prop of Object.values(KEYS)) root.style.removeProperty(prop);
	};
}
