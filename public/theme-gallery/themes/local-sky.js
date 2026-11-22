import { panel, h, clamp } from "./_sensor/kit.js";

const RAD = Math.PI / 180;
const SYNODIC = 29.530588853;
const NEW_MOON_JD = 2451550.1; // 2000-01-06 18:14 UTC

// Rough latitude for common IANA zones; the timezone cannot give a latitude on its own, so there is a slider too.
const ZONE_LAT = {
	"America/New_York": 41, "America/Toronto": 43.7, "America/Chicago": 41.9, "America/Denver": 39.7, "America/Phoenix": 33.4, "America/Los_Angeles": 36, "America/Vancouver": 49.3,
	"America/Anchorage": 61, "Pacific/Honolulu": 21.3, "America/Mexico_City": 19.4, "America/Bogota": 4.7, "America/Lima": -12, "America/Santiago": -33.4, "America/Sao_Paulo": -23.5, "America/Argentina/Buenos_Aires": -34.6,
	"Europe/London": 51.5, "Europe/Dublin": 53.3, "Europe/Lisbon": 38.7, "Europe/Madrid": 40.4, "Europe/Paris": 48.9, "Europe/Berlin": 52.5, "Europe/Amsterdam": 52.4, "Europe/Rome": 41.9, "Europe/Zurich": 47.4,
	"Europe/Stockholm": 59.3, "Europe/Oslo": 59.9, "Europe/Helsinki": 60.2, "Europe/Warsaw": 52.2, "Europe/Bucharest": 44.4, "Europe/Athens": 38, "Europe/Istanbul": 41, "Europe/Moscow": 55.8, "Europe/Kyiv": 50.4,
	"Africa/Cairo": 30, "Africa/Lagos": 6.5, "Africa/Nairobi": -1.3, "Africa/Johannesburg": -26.2, "Asia/Jerusalem": 31.8, "Asia/Dubai": 25.2, "Asia/Tehran": 35.7, "Asia/Karachi": 24.9, "Asia/Kolkata": 22.6,
	"Asia/Dhaka": 23.8, "Asia/Bangkok": 13.8, "Asia/Singapore": 1.3, "Asia/Jakarta": -6.2, "Asia/Hong_Kong": 22.3, "Asia/Shanghai": 31.2, "Asia/Seoul": 37.6, "Asia/Tokyo": 35.7, "Asia/Manila": 14.6,
	"Australia/Perth": -32, "Australia/Sydney": -33.9, "Australia/Melbourne": -37.8, "Australia/Brisbane": -27.5, "Pacific/Auckland": -36.9,
};

const toJD = (ms) => ms / 86400000 + 2440587.5;

export function sunTimes(y, m, d, latDeg, lonDeg) {
	// NOAA solar equations. Returns UTC minutes-of-day for solar noon, sunrise, sunset (null = polar).
	const n = Math.round((Date.UTC(y, m, d) - Date.UTC(y, 0, 0)) / 86400000);
	const B = ((2 * Math.PI) / 365) * (n - 1);
	const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(B) - 0.032077 * Math.sin(B) - 0.014615 * Math.cos(2 * B) - 0.040849 * Math.sin(2 * B));
	const decl = 0.006918 - 0.399912 * Math.cos(B) + 0.070257 * Math.sin(B) - 0.006758 * Math.cos(2 * B) + 0.000907 * Math.sin(2 * B) - 0.002697 * Math.cos(3 * B) + 0.00148 * Math.sin(3 * B);
	const noon = 720 - 4 * lonDeg - eot;
	const cosH = (Math.cos(90.833 * RAD) - Math.sin(latDeg * RAD) * Math.sin(decl)) / (Math.cos(latDeg * RAD) * Math.cos(decl));
	if (cosH > 1) return { noon, decl, polar: "night" };
	if (cosH < -1) return { noon, decl, polar: "day" };
	const ha = Math.acos(cosH) / RAD;
	return { noon, decl, rise: noon - 4 * ha, set: noon + 4 * ha, ha };
}

export function moonPhase(ms) {
	const age = (((toJD(ms) - NEW_MOON_JD) / SYNODIC) % 1 + 1) % 1; // 0 new, .5 full
	const illum = (1 - Math.cos(2 * Math.PI * age)) / 2;
	const a = age;
	const name = a < 0.03 || a > 0.97 ? "New moon" : a < 0.22 ? "Waxing crescent" : a < 0.28 ? "First quarter" : a < 0.47 ? "Waxing gibbous" : a < 0.53 ? "Full moon" : a < 0.72 ? "Waning gibbous" : a < 0.78 ? "Last quarter" : "Waning crescent";
	return { age, days: age * SYNODIC, illum, name };
}

function season(month, day, lat) {
	const doy = month * 31 + day; // coarse ordering is enough for boundaries
	const idx = (m, d) => m * 31 + d;
	let s;
	if (doy >= idx(11, 21) || doy < idx(2, 20)) s = "Winter";
	else if (doy < idx(5, 21)) s = "Spring";
	else if (doy < idx(8, 22)) s = "Summer";
	else s = "Autumn";
	if (lat < 0) s = { Winter: "Summer", Summer: "Winter", Spring: "Autumn", Autumn: "Spring" }[s];
	return s;
}

const NS = "http://www.w3.org/2000/svg";
function moonSvg(p, flip) {
	const R = 50;
	const c = Math.cos(2 * Math.PI * p.age);
	const rx = Math.abs(c) * R;
	const sweep = c > 0 ? 0 : 1;
	let lit = "";
	if (p.illum > 0.004) {
		lit = p.illum > 0.996
			? `<circle cx="60" cy="60" r="${R}" fill="url(#ls-lit)"/>`
			: `<path d="M60 ${60 - R} A${R} ${R} 0 0 1 60 ${60 + R} A${rx.toFixed(2)} ${R} 0 0 ${sweep} 60 ${60 - R}Z" fill="url(#ls-lit)" transform="${p.age > 0.5 ? "translate(120 0) scale(-1 1)" : ""}"/>`;
	}
	return `<svg viewBox="0 0 120 120" xmlns="${NS}" role="img" aria-label="Moon: ${p.name}, ${Math.round(p.illum * 100)}% lit"><defs>
		<radialGradient id="ls-lit" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#fffdf0"/><stop offset="1" stop-color="#ddd5bd"/></radialGradient>
		<clipPath id="ls-clip"><circle cx="60" cy="60" r="${R}"/></clipPath></defs>
		<g transform="${flip ? "translate(120 120) rotate(180)" : ""}">
		<circle cx="60" cy="60" r="${R}" fill="#1b2438" fill-opacity="0.62"/>
		${lit}
		<g clip-path="url(#ls-clip)" fill="#8d8571" fill-opacity="0.28"><circle cx="44" cy="46" r="9"/><circle cx="72" cy="40" r="6"/><circle cx="76" cy="72" r="11"/><circle cx="50" cy="78" r="7"/><circle cx="64" cy="58" r="4"/></g>
		<circle cx="60" cy="60" r="${R}" fill="none" stroke="currentColor" stroke-opacity="0.38" stroke-width="1.2"/></g></svg>`;
}

const lerp = (a, b, t) => a + (b - a) * t;
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
function stops(list, alt) {
	if (alt <= list[0][0]) return list[0].slice(1).map(hex);
	for (let i = 1; i < list.length; i++) {
		if (alt <= list[i][0]) {
			const t = (alt - list[i - 1][0]) / (list[i][0] - list[i - 1][0]);
			return [1, 2].map((k) => hex(list[i - 1][k]).map((v, j) => Math.round(lerp(v, hex(list[i][k])[j], t))));
		}
	}
	return list.at(-1).slice(1).map(hex);
}
const LIGHT = [[-18, "#cfd5ea", "#dde0f0"], [-6, "#d5d3ec", "#f3d7e0"], [0, "#cfdcf2", "#fbdcc2"], [8, "#c3e0fb", "#fbe8d2"], [25, "#bfe0fb", "#e9f5fc"]];
const DARK = [[-18, "#040916", "#0a1430"], [-6, "#12163a", "#2c2050"], [0, "#1d2a58", "#4a3050"], [8, "#1b3a66", "#3f4d72"], [25, "#1f4a7e", "#35557e"]];
const rgb = (a) => `rgb(${a.join(",")})`;

const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function activate({ root, reducedMotion }) {
	const dark = document.documentElement.classList.contains("dark");
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
	const jan = new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset();
	const jul = new Date(new Date().getFullYear(), 6, 1).getTimezoneOffset();
	const stdOffsetMin = -Math.max(jan, jul); // standard-time offset east of UTC, in minutes (ignores DST)
	const lon = clamp((stdOffsetMin / 60) * 15, -180, 180);
	const knownLat = ZONE_LAT[tz];
	let lat = knownLat ?? 40;
	let dayShift = 0; // simulated days from today
	let minuteSim = null; // simulated minute-of-day, or null = real clock

	const scenery = root.querySelector(".scenery-a");
	const sun = h("div", { class: "ls-sun", "aria-hidden": "true" });
	const moon = h("span", { class: "ls-moon" });
	const cap = h("div", { class: "ls-cap" });
	const wrap = h("div", { class: "ls-moonwrap" }, moon, cap);
	scenery.append(sun, wrap);

	const facts = h("dl", { class: "ls-facts" });

	function compute() {
		const now = new Date();
		const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayShift);
		const mins = minuteSim ?? (now.getHours() * 60 + now.getMinutes());
		const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, mins);
		const st = sunTimes(base.getFullYear(), base.getMonth(), base.getDate(), lat, lon);
		const utcMidnight = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
		const riseMs = st.rise != null ? utcMidnight + st.rise * 60000 : null;
		const setMs = st.set != null ? utcMidnight + st.set * 60000 : null;
		// solar altitude now (using this day's declination and solar time)
		const solarNoonMs = utcMidnight + st.noon * 60000;
		// nearest solar noon to the sim time (it can land on a neighbouring UTC date)
		let H = ((at.getTime() - solarNoonMs) / 60000 / 4); // degrees of hour angle
		H = ((H + 180) % 360 + 360) % 360 - 180;
		const alt = Math.asin(Math.sin(lat * RAD) * Math.sin(st.decl) + Math.cos(lat * RAD) * Math.cos(st.decl) * Math.cos(H * RAD)) / RAD;
		const phase = moonPhase(at.getTime());
		render({ at, st, riseMs, setMs, alt, H, phase, base });
	}

	function render({ at, st, riseMs, setMs, alt, H, phase, base }) {
		const [top, hor] = stops(dark ? DARK : LIGHT, alt);
		root.style.setProperty("--sky1", rgb(top));
		root.style.setProperty("--sky2", rgb(hor));
		root.style.setProperty("--starOp", clamp((-alt - 2) / 10, 0, 1).toFixed(2));
		// sun position: hour angle -> x, altitude -> y (below the horizon it is hidden)
		const x = 50 + (H / 100) * 46;
		const y = Math.max(4, 40 - (alt / 45) * 36);
		sun.style.transform = `translate3d(${(x / 100) * scenery.clientWidth}px, ${(y / 100) * scenery.clientHeight}px, 0)`;
		sun.style.opacity = alt > -4 ? "1" : "0";
		// moon
		const flip = lat < 0;
		moon.innerHTML = moonSvg(phase, flip);
		moon.style.color = dark ? "#cfd6e6" : "#283556";
		cap.replaceChildren(h("b", {}, phase.name), `${Math.round(phase.illum * 100)}% lit · day ${phase.days.toFixed(1)}`);
		const dayLen = riseMs != null ? (setMs - riseMs) / 60000 : null;
		const rows = [
			["Sunrise", riseMs != null ? fmtTime(riseMs) : st.polar === "day" ? "sun never sets" : "sun stays down"],
			["Sunset", setMs != null ? fmtTime(setMs) : "—"],
			["Daylight", dayLen != null ? `${Math.floor(dayLen / 60)}h ${Math.round(dayLen % 60)}m` : st.polar === "day" ? "24h" : "0h"],
			["Moon", `${phase.name}, ${Math.round(phase.illum * 100)}%`],
			["Season", season(base.getMonth(), base.getDate(), lat)],
			["Sky now", alt > 0 ? `sun ${Math.round(alt)}° up` : alt > -6 ? "civil twilight" : alt > -12 ? "nautical twilight" : alt > -18 ? "astronomical twilight" : "night"],
		];
		facts.replaceChildren(...rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));
		ui.status(`${at.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${dayShift || minuteSim != null ? " (simulated)" : ""}`);
	}

	const fmtMin = (v) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
	const nowMin = () => new Date().getHours() * 60 + new Date().getMinutes();
	const ui = panel(root, {
		title: "Local sky",
		statusIdle: "",
		privacy: `Computed on this device from the date, your timezone (${tz || "unknown"}) and a latitude guess. No location access, no network.`,
		simLabel: "Simulate",
		controls: [
			{ type: "range", id: "time", label: "Time of day", min: 0, max: 1439, step: 5, value: nowMin(), format: fmtMin, onInput: (v) => { minuteSim = v; compute(); } },
			{ type: "range", id: "day", label: "Date (days from today)", min: -182, max: 182, value: 0, format: (v) => (v === 0 ? "today" : `${v > 0 ? "+" : ""}${v}`), onInput: (v) => { dayShift = v; compute(); } },
			{ type: "range", id: "lat", label: `Latitude${knownLat == null ? " (guess)" : ""}`, min: -66, max: 66, value: Math.round(lat), format: (v) => `${Math.abs(v)}°${v < 0 ? "S" : "N"}`, onInput: (v) => { lat = v; compute(); } },
			{ type: "buttons", id: "now", label: "Jump to", value: "", options: [{ value: "now", label: "Now" }, { value: "sunrise", label: "Sunrise" }, { value: "noon", label: "Noon" }, { value: "sunset", label: "Sunset" }, { value: "night", label: "Midnight" }], onPick: jump },
		],
	});
	ui.el.querySelector(".sx-status").after(facts);

	function jump(which) {
		if (which === "now") {
			minuteSim = null;
			dayShift = 0;
			ui.set("time", nowMin());
			ui.set("day", 0);
			compute();
			return;
		}
		const now = new Date();
		const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayShift);
		const st = sunTimes(base.getFullYear(), base.getMonth(), base.getDate(), lat, lon);
		const local = (utcMin) => {
			const ms = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()) + utcMin * 60000;
			const d = new Date(ms);
			return d.getHours() * 60 + d.getMinutes();
		};
		const m = which === "sunrise" ? local(st.rise ?? st.noon - 360) : which === "sunset" ? local(st.set ?? st.noon + 360) : which === "noon" ? local(st.noon) : 0;
		minuteSim = clamp(Math.round(m / 5) * 5, 0, 1439);
		ui.set("time", minuteSim);
		compute();
	}

	compute();
	// refresh the real clock once a minute; the sim holds still
	const tick = setInterval(() => { if (minuteSim == null && !document.hidden) compute(); }, 60000);
	const ro = new ResizeObserver(() => compute());
	ro.observe(scenery);
	return () => {
		clearInterval(tick);
		ro.disconnect();
		root.style.removeProperty("--sky1");
		root.style.removeProperty("--sky2");
		root.style.removeProperty("--starOp");
		ui.destroy();
	};
}
