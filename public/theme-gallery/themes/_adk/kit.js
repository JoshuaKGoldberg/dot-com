// Shared kit for the "Adirondacks x code" themes (#196-205).
//
// Scene parameter object (every theme builds its whole scene from this):
//   {
//     seed:      integer, drives every random choice
//     date:      "YYYY-MM-DD" (sun and moon position, moon phase)
//     hour:      0..24 local clock hour, fractional ("17.5" = 5:30pm)
//     season:    "spring" | "summer" | "autumn" | "winter"
//     weather:   "clear" | "cloudy" | "rain" | "snow" | "fog"
//     wind:      0..1
//     latitude:  degrees north (default 43.4, Lake George)
//     longitude: degrees east (default: the visitor's time-zone meridian, so clock hour is solar hour)
//     tz:        hours offset from UTC (default: the visitor's)
//   }
// Defaults come from the visitor's clock. URL overrides: ?hour=22&weather=snow&season=winter&seed=7
// Generators are pure functions of (params, env); renderers only paint what generators return.

export const SEASONS = ["spring", "summer", "autumn", "winter"];
export const WEATHERS = ["clear", "cloudy", "rain", "snow", "fog"];

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
	const t = clamp((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};

export function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function hashStr(str) {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

export function makeNoise(seed) {
	const r = rng(seed);
	const N = 256;
	const v = Float32Array.from({ length: N }, r);
	const at = (i) => v[((i % N) + N) % N];
	const sm = (t) => t * t * (3 - 2 * t);
	const n1 = (x) => {
		const i = Math.floor(x);
		return lerp(at(i), at(i + 1), sm(x - i));
	};
	const n2 = (x, y) => {
		const i = Math.floor(x);
		const j = Math.floor(y);
		const fx = sm(x - i);
		const fy = sm(y - j);
		const h = (a, b) => at(a * 57 + b * 131 + ((a * b) % 17));
		return lerp(lerp(h(i, j), h(i + 1, j), fx), lerp(h(i, j + 1), h(i + 1, j + 1), fx), fy);
	};
	const fbm1 = (x, oct = 4) => {
		let s = 0;
		let a = 0.5;
		let f = 1;
		let n = 0;
		for (let o = 0; o < oct; o++) {
			s += n1(x * f + o * 17.3) * a;
			n += a;
			a *= 0.5;
			f *= 2.03;
		}
		return s / n;
	};
	const fbm2 = (x, y, oct = 4) => {
		let s = 0;
		let a = 0.5;
		let f = 1;
		let n = 0;
		for (let o = 0; o < oct; o++) {
			s += n2(x * f + o * 9.1, y * f - o * 4.7) * a;
			n += a;
			a *= 0.5;
			f *= 2.03;
		}
		return s / n;
	};
	return { n1, n2, fbm1, fbm2 };
}

// ---------- colour (arrays of [r,g,b]) ----------
export const hex = (s) => {
	let h = s.replace("#", "");
	if (h.length === 3) h = [...h].map((c) => c + c).join("");
	const n = parseInt(h, 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const mul = (c, k) => [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];
export const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${+a.toFixed(3)})`;

// ---------- parameters ----------
const pad = (n) => String(n).padStart(2, "0");

export function seasonFor(dateStr, latitude = 43.4) {
	const m = Number(dateStr.slice(5, 7));
	let i = m === 12 || m <= 2 ? 3 : m <= 5 ? 0 : m <= 8 ? 1 : 2;
	if (latitude < 0) i = (i + 2) % 4;
	return SEASONS[i];
}

export function defaultParams(over = {}) {
	const now = new Date();
	const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	const tz = -now.getTimezoneOffset() / 60;
	const latitude = over.latitude ?? 43.4;
	const p = {
		seed: now.getFullYear() * 372 + (now.getMonth() + 1) * 31 + now.getDate(),
		date,
		hour: now.getHours() + now.getMinutes() / 60,
		season: seasonFor(date, latitude),
		weather: "clear",
		wind: 0.3,
		latitude,
		longitude: tz * 15,
		tz,
	};
	return { ...p, ...over };
}

export function paramsFromQuery(search, p) {
	const q = new URLSearchParams(search);
	const out = { ...p };
	for (const k of ["seed", "hour", "wind", "latitude", "longitude", "tz"]) {
		if (q.has(k) && q.get(k) !== "" && !Number.isNaN(Number(q.get(k)))) out[k] = Number(q.get(k));
	}
	if (q.has("date") && /^\d{4}-\d{2}-\d{2}$/.test(q.get("date"))) {
		out.date = q.get("date");
		if (!q.has("season")) out.season = seasonFor(out.date, out.latitude);
	}
	if (SEASONS.includes(q.get("season"))) out.season = q.get("season");
	if (WEATHERS.includes(q.get("weather"))) out.weather = q.get("weather");
	return out;
}

export function normalizeParams(p) {
	const o = { ...p };
	o.seed = Math.floor(Number(o.seed) || 0);
	o.hour = ((Number(o.hour) % 24) + 24) % 24;
	o.wind = clamp(Number(o.wind) || 0);
	if (!SEASONS.includes(o.season)) o.season = "summer";
	if (!WEATHERS.includes(o.weather)) o.weather = "clear";
	return o;
}

// ---------- sun and moon ----------
const RAD = Math.PI / 180;

export function sunMoon(p) {
	const [y, m, d] = p.date.split("-").map(Number);
	const doy = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 864e5);
	const dec = -23.44 * RAD * Math.cos(((2 * Math.PI) / 365) * (doy + 10));
	const lat = p.latitude * RAD;
	const solar = p.hour - p.tz + p.longitude / 15;
	const H = (solar - 12) * 15 * RAD;
	const body = (H2, dec2) => {
		const sinAlt = Math.sin(lat) * Math.sin(dec2) + Math.cos(lat) * Math.cos(dec2) * Math.cos(H2);
		const alt = Math.asin(clamp(sinAlt, -1, 1));
		const az = Math.atan2(Math.sin(H2), Math.cos(H2) * Math.sin(lat) - Math.tan(dec2) * Math.cos(lat));
		return { alt: alt / RAD, az, x: 0.5 + 0.46 * clamp(az / 2.2, -1, 1) };
	};
	const sun = body(H, dec);
	const jd = Date.UTC(y, m - 1, d, 12) / 864e5 + 2440587.5;
	const phase = (((jd - 2451550.1) / 29.530588853) % 1 + 1) % 1;
	const moon = body(H - 2 * Math.PI * phase, dec * Math.cos(2 * Math.PI * phase));
	moon.phase = phase;
	moon.illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
	return { sun, moon, doy };
}

// ---------- environment (colours and light for a parameter set) ----------
const SKY = [
	[-18, "#050818", "#0a1030", "#141c40"],
	[-9, "#0b1236", "#1c2658", "#38407a"],
	[-4, "#22377a", "#68598f", "#e58d6d"],
	[0, "#3d6cb2", "#b698b0", "#f9b277"],
	[6, "#5689cc", "#a8bfdc", "#f6d3a4"],
	[18, "#6ba2de", "#a2c7e8", "#dbeaf3"],
	[50, "#5896e0", "#9cc5ee", "#d3e7f6"],
].map(([a, t, m, h]) => [a, hex(t), hex(m), hex(h)]);

function skyAt(alt) {
	let i = 0;
	while (i < SKY.length - 2 && alt > SKY[i + 1][0]) i++;
	const a = SKY[i];
	const b = SKY[i + 1];
	const t = clamp((alt - a[0]) / (b[0] - a[0]));
	return { top: mix(a[1], b[1], t), mid: mix(a[2], b[2], t), hor: mix(a[3], b[3], t) };
}

const COVER = { clear: 0.1, cloudy: 0.7, rain: 0.95, snow: 0.9, fog: 0.5 };

export const LAND = {
	spring: { leaf: ["#a9c96a", "#8fb85a", "#c5dc86", "#e8c7d2", "#7aa650"].map(hex), ground: hex("#7c9a58"), ridge: hex("#667f5e"), conifer: hex("#2f5a3c"), bark: hex("#5a4a3e") },
	summer: { leaf: ["#3f7a45", "#52913f", "#2f6a4a", "#68a04c", "#3b8a4f"].map(hex), ground: hex("#456f3d"), ridge: hex("#3b5a4b"), conifer: hex("#244d38"), bark: hex("#4a3a30") },
	autumn: { leaf: ["#d9822b", "#c2432a", "#e8b13a", "#a8561f", "#8b2f23"].map(hex), ground: hex("#7a5a30"), ridge: hex("#6a4a3a"), conifer: hex("#2b4a38"), bark: hex("#4a3a30") },
	winter: { leaf: ["#dfe5ec", "#c5cfdb", "#b0bccb"].map(hex), ground: hex("#e6ebf1"), ridge: hex("#a9b6c6"), conifer: hex("#33493f"), bark: hex("#3d3836") },
};

export function makeEnv(p) {
	const sm = sunMoon(p);
	const alt = sm.sun.alt;
	const cover = COVER[p.weather];
	const night = 1 - smooth(-14, -2, alt);
	const day = smooth(-2, 10, alt);
	const golden = smooth(-6, 0, alt) * (1 - smooth(5, 20, alt));
	const moonUp = clamp(sm.moon.alt / 12) * sm.moon.illum;
	const light = clamp(smooth(-10, 9, alt) * (1 - 0.3 * cover));
	const tone = alt > 1 ? "light" : "dark";
	let sky = skyAt(alt);
	const flat = { clear: 0, cloudy: 0.2, rain: 0.3, snow: 0.35, fog: 0.75 }[p.weather];
	const grey = { clear: 0, cloudy: 0.5, rain: 0.75, snow: 0.6, fog: 0.7 }[p.weather];
	const wz = (c) => {
		const g = luma(c);
		let o = mix(c, [g * 0.96, g, g * 1.07], grey);
		if (p.weather === "rain") o = mul(o, 0.84);
		if (p.weather === "snow") o = mix(o, [232, 238, 247], 0.14 * light);
		return o;
	};
	sky = { top: wz(mix(sky.top, sky.hor, flat)), mid: wz(mix(sky.mid, sky.hor, flat * 1.2)), hor: wz(sky.hor) };
	const fog = p.weather === "fog" ? 1 : p.weather === "rain" ? 0.45 : p.weather === "snow" ? 0.4 : p.weather === "cloudy" ? 0.12 : 0.05;
	const haze = mix(sky.hor, sky.mid, 0.25);
	const land = LAND[p.season];
	const snowAmt = p.season === "winter" ? 1 : p.weather === "snow" ? 0.35 : 0;
	const nightTint = [18, 26, 62];
	const warm = [255, 170, 110];
	const lit = (c, k = 1) => {
		let o = mix(c, mul(c, 0.3), night * k);
		o = mix(o, nightTint, night * 0.38 * k);
		o = mix(o, warm, golden * 0.2 * k);
		return mix(o, mul(o, 0.8), cover * 0.4 * k);
	};
	let cl = mix([88, 98, 134], [252, 250, 248], light);
	cl = mix(cl, [255, 196, 156], golden * 0.55);
	cl = mix(cl, mul([142, 148, 158], 0.4 + 0.6 * light), p.weather === "rain" ? 0.7 : p.weather === "cloudy" ? 0.25 : 0);
	const cloud = { lit: cl, shade: mix(mul(cl, 0.74), sky.top, 0.3) };
	const waterTop = mix(sky.hor, sky.mid, 0.35);
	const ice = p.season === "winter" ? 0.55 : 0;
	let waterBot = mix(mix(sky.mid, hex("#27475a"), 0.62), hex("#08102a"), night * 0.55);
	let wTop = waterTop;
	if (ice) {
		wTop = mix(wTop, [226, 234, 244], ice * (0.4 + 0.5 * light));
		waterBot = mix(waterBot, [150, 172, 196], ice * 0.5 * light);
	}
	// water/bank colours stay readable at night
	const lit2 = (c) => lit(mix(c, [110, 150, 220], night * 0.55), 0.3);
	return {
		lit2,
		p, sm, alt, cover, night, day, golden, moonUp, light, tone, sky, fog, haze, land, snowAmt, lit, cloud, ice,
		water: { top: wTop, bot: waterBot },
		wind: p.wind,
		rainy: p.weather === "rain",
		snowy: p.weather === "snow",
		foggy: p.weather === "fog",
		// sky-lit colour for ink/lines that must read on the sky
		ink: tone === "dark" ? [214, 226, 250] : [30, 44, 74],
	};
}

// ---------- canvas helpers ----------
export function offscreen(view, w = view.w, h = view.h) {
	const c = document.createElement("canvas");
	c.width = Math.max(1, Math.round(w * view.dpr));
	c.height = Math.max(1, Math.round(h * view.dpr));
	const ctx = c.getContext("2d");
	ctx.scale(view.dpr, view.dpr);
	return { c, ctx };
}

function blob(ctx, x, y, rx, ry, color, a) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(1, ry / rx);
	const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
	g.addColorStop(0, css(color, a));
	g.addColorStop(0.55, css(color, a * 0.55));
	g.addColorStop(1, css(color, 0));
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(0, 0, rx, 0, 6.2832);
	ctx.fill();
	ctx.restore();
}
export { blob };

export function drawMoon(ctx, x, y, r, phase, color = [244, 240, 226]) {
	ctx.fillStyle = css(color, 0.1);
	ctx.beginPath();
	ctx.arc(x, y, r, 0, 6.2832);
	ctx.fill();
	const k = Math.cos(phase * 2 * Math.PI);
	const waxing = phase < 0.5;
	ctx.fillStyle = css(color, 0.96);
	ctx.beginPath();
	ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing);
	ctx.ellipse(x, y, Math.max(0.01, r * Math.abs(k)), r, 0, Math.PI / 2, -Math.PI / 2, waxing === k > 0);
	ctx.closePath();
	ctx.fill();
}

export function skyPos(env, hy, view, body) {
	return { x: view.w * body.x, y: hy * (1 - (body.alt / 60) * 0.9) };
}

// Sky gradient, stars, Milky Way, sun, moon, clouds.
export function paintSky(ctx, view, env, hy, opts = {}) {
	const { w } = view;
	const rand = rng(env.p.seed * 7 + 1);
	const g = ctx.createLinearGradient(0, 0, 0, hy);
	g.addColorStop(0, css(env.sky.top));
	g.addColorStop(0.6, css(env.sky.mid));
	g.addColorStop(1, css(env.sky.hor));
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, w, hy + 2);

	const starA = env.night * (1 - 0.85 * env.cover);
	if (starA > 0.02 && !opts.noStars) {
		const n = Math.round((w * hy) / 2600);
		for (let i = 0; i < n; i++) {
			const x = rand() * w;
			const y = Math.pow(rand(), 0.9) * hy * 0.96;
			const big = rand() < 0.07;
			const a = (0.25 + rand() * 0.75) * starA * (0.5 + 0.5 * (1 - y / hy));
			ctx.fillStyle = css(rand() < 0.2 ? [255, 226, 200] : [226, 232, 255], a);
			ctx.beginPath();
			ctx.arc(x, y, big ? 1.3 : 0.5 + rand() * 0.6, 0, 6.2832);
			ctx.fill();
		}
		if (starA > 0.4 && env.moonUp < 0.5) {
			ctx.save();
			ctx.translate(w * 0.55, hy * 0.35);
			ctx.rotate(-0.42);
			for (let i = 0; i < 5; i++) blob(ctx, (i - 2) * w * 0.17, (rand() - 0.5) * 20, w * 0.22, hy * 0.07, [150, 150, 215], 0.09 * starA);
			ctx.restore();
		}
	}

	const sun = skyPos(env, hy, view, env.sm.sun);
	if (env.alt > -6 && !opts.noSun) {
		const warmth = clamp(1 - env.alt / 30);
		const sc = mix([255, 244, 214], [255, 150, 90], warmth);
		const a = (1 - 0.65 * env.cover) * (1 - 0.3 * (1 - env.golden));
		blob(ctx, sun.x, sun.y, hy * (0.55 + 0.3 * warmth), hy * (0.55 + 0.3 * warmth), sc, 0.5 * a * (env.alt > -3 ? 1 : 0.5));
		if (env.alt > -0.8 && env.cover < 0.8) {
			ctx.fillStyle = css(mix([255, 252, 238], sc, 0.35), 0.96 * (1 - env.cover));
			ctx.beginPath();
			ctx.arc(sun.x, sun.y, Math.min(34, hy * 0.05), 0, 6.2832);
			ctx.fill();
		}
	}
	const moon = skyPos(env, hy, view, env.sm.moon);
	const moonA = (1 - 0.9 * env.cover) * (1 - env.day * 0.85);
	if (env.sm.moon.alt > -2 && moonA > 0.04 && !opts.noMoon) {
		blob(ctx, moon.x, moon.y, hy * 0.22, hy * 0.22, [200, 215, 255], 0.28 * moonA * (0.4 + 0.6 * env.sm.moon.illum));
		ctx.globalAlpha = clamp(moonA * 1.3);
		drawMoon(ctx, moon.x, moon.y, Math.min(26, hy * 0.04), env.sm.moon.phase);
		ctx.globalAlpha = 1;
	}
	if (!opts.noClouds) paintClouds(ctx, view, env, hy, rand);
	return { sun, moon };
}

export function paintClouds(ctx, view, env, hy, rand) {
	const c = env.cover;
	const n = Math.round(lerp(3, 24, clamp((c - 0.1) / 0.85)) * (view.w / 1280 + 0.3));
	for (let i = 0; i < n; i++) {
		const cx = rand() * view.w * 1.2 - view.w * 0.1;
		const cy = hy * (0.08 + 0.75 * Math.pow(rand(), 1.3));
		const ww = (130 + rand() * 330) * (0.55 + c);
		const puffs = 7;
		const scale = 0.7 + (cy / hy) * 0.5;
		for (let k = 0; k < puffs; k++) {
			const ox = (rand() - 0.5) * ww;
			const rx = ww * (0.16 + rand() * 0.2) * scale;
			const a = (0.38 + rand() * 0.3) * (0.4 + c * 0.6);
			blob(ctx, cx + ox, cy + rx * 0.16, rx, rx * 0.4, env.cloud.shade, a * 0.7);
			blob(ctx, cx + ox, cy - rx * 0.05, rx * 0.9, rx * 0.34, env.cloud.lit, a);
		}
	}
	if (c > 0.6) {
		const g = ctx.createLinearGradient(0, 0, 0, hy);
		g.addColorStop(0, css(env.cloud.shade, 0.35 * c));
		g.addColorStop(1, css(env.cloud.shade, 0));
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, view.w, hy);
	}
}

// Rolling ridge heights, sampled every `step` px. Returns Float32Array of y values.
export function ridgeYs(noise, view, { base, amp, freq, oct = 4, off = 0, round = 1, step = 6 }) {
	const n = Math.ceil(view.w / step) + 2;
	const ys = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const v = noise.fbm1((i * step) / view.w * freq + off, oct);
		ys[i] = base - amp * Math.pow(clamp((v - 0.2) * 1.5), round);
	}
	return ys;
}

export function fillRidge(ctx, ys, step, bottom, top, bot) {
	let miny = Infinity;
	for (const y of ys) if (Number.isFinite(y)) miny = Math.min(miny, y);
	if (!Number.isFinite(miny)) miny = bottom - 1;
	const g = ctx.createLinearGradient(0, miny, 0, bottom);
	g.addColorStop(0, css(top));
	g.addColorStop(1, css(bot));
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.moveTo(0, bottom);
	for (let i = 0; i < ys.length; i++) ctx.lineTo(i * step, ys[i]);
	ctx.lineTo((ys.length - 1) * step, bottom);
	ctx.closePath();
	ctx.fill();
}

// Layered hazy Adirondack ridges. depth 1 = far. Returns array of ys arrays.
export function paintRidges(ctx, view, env, hy, noise, layers) {
	const out = [];
	for (const L of layers) {
		const ys = ridgeYs(noise, view, { ...L, base: hy - L.base * hy, amp: L.amp * hy });
		const near = env.lit(env.land.ridge);
		const far = mix(env.lit(mix(env.land.ridge, [150, 170, 190], 0.6)), env.haze, 0.5);
		let c = mix(near, far, L.depth);
		c = mix(c, env.haze, env.fog * (0.3 + 0.5 * L.depth));
		if (env.snowAmt) c = mix(c, env.lit([232, 238, 246], 0.85), env.snowAmt * 0.45);
		const bot = mix(c, env.haze, 0.35 + 0.45 * L.depth);
		fillRidge(ctx, ys, 6, hy + 2, mix(c, [255, 255, 255], env.snowAmt * 0.18 * env.light), bot);
		L.ys = ys;
		out.push(ys);
	}
	return out;
}

export function paintPine(ctx, x, baseY, h, color, snow = 0, snowColor = [240, 244, 250], lean = 0) {
	const tiers = Math.max(4, Math.round(h / 9));
	const w0 = h * 0.2;
	ctx.fillStyle = css(color);
	ctx.beginPath();
	ctx.moveTo(x + lean * h, baseY - h);
	for (let i = 1; i <= tiers; i++) {
		const t = i / tiers;
		const y = baseY - h * (1 - t);
		const hw = w0 * (0.25 + 0.75 * t) * (i % 2 ? 1 : 0.8);
		ctx.lineTo(x + lean * h * (1 - t) + hw, y - 2);
		ctx.lineTo(x + lean * h * (1 - t) + hw * 0.45, y - h / tiers * 0.35);
	}
	for (let i = tiers; i >= 1; i--) {
		const t = i / tiers;
		const y = baseY - h * (1 - t);
		const hw = w0 * (0.25 + 0.75 * t) * (i % 2 ? 1 : 0.8);
		ctx.lineTo(x + lean * h * (1 - t) - hw * 0.45, y - h / tiers * 0.35);
		ctx.lineTo(x + lean * h * (1 - t) - hw, y - 2);
	}
	ctx.closePath();
	ctx.fill();
	if (snow > 0.05) {
		ctx.fillStyle = css(snowColor, 0.75 * snow);
		ctx.beginPath();
		ctx.moveTo(x + lean * h, baseY - h);
		ctx.lineTo(x + w0 * 0.5, baseY - h * 0.55);
		ctx.lineTo(x - w0 * 0.5, baseY - h * 0.55);
		ctx.closePath();
		ctx.fill();
	}
}

// A band of pines along a shoreline segment [x0,x1].
export function paintPineBand(ctx, env, rand, { x0, x1, baseY, h, gap = [8, 15], depth = 0, jitter = 0 }) {
	const col = mix(env.lit(env.land.conifer), env.haze, depth * 0.6 + env.fog * 0.35);
	const snow = env.snowAmt;
	let x = x0;
	while (x < x1) {
		x += gap[0] + rand() * (gap[1] - gap[0]);
		const hh = h * (0.5 + rand() * 0.7) * (rand() < 0.06 ? 1.4 : 1);
		paintPine(ctx, x, baseY + (rand() - 0.5) * jitter, hh, mix(col, [8, 20, 18], rand() * 0.25), snow * 0.8, env.lit([240, 244, 250], 0.9), (rand() - 0.5) * 0.04);
	}
}

// Mirror the backdrop into the lake with gentle horizontal ripples.
export function paintLake(ctx, view, env, hy, back, { ripple = 1 } = {}) {
	const { w, h, dpr } = view;
	const g = ctx.createLinearGradient(0, hy, 0, h);
	g.addColorStop(0, css(env.water.top));
	g.addColorStop(1, css(env.water.bot));
	ctx.fillStyle = g;
	ctx.fillRect(0, hy, w, h - hy);
	const depthRange = Math.min(hy * 0.8, h - hy);
	const strip = 3;
	ctx.save();
	ctx.globalAlpha = (0.78 - env.ice * 0.4) * (1 - 0.25 * env.fog);
	for (let y = 0; y < h - hy; y += strip) {
		const sy = hy - y * 0.95 - strip;
		if (sy < 0) break;
		const k = y / (h - hy);
		const dx = Math.sin(y * 0.21 + env.p.seed) * (0.6 + k * 5) * ripple * (0.3 + env.wind * 1.4);
		ctx.drawImage(back, 0, sy * dpr, w * dpr, strip * dpr, dx, hy + y, w, strip);
	}
	ctx.restore();
	const v = ctx.createLinearGradient(0, hy, 0, h);
	v.addColorStop(0, css(env.water.top, 0.05));
	v.addColorStop(0.35, css(env.water.bot, 0.38));
	v.addColorStop(1, css(env.water.bot, 0.88));
	ctx.fillStyle = v;
	ctx.fillRect(0, hy, w, h - hy);
	void depthRange;
}

export function paintGlints(ctx, view, env, hy, sky) {
	const rand = rng(env.p.seed * 13 + 5);
	let src = null;
	if (env.alt > 0 && env.cover < 0.85) src = { x: sky.sun.x, c: mix([255, 238, 200], [255, 180, 110], env.golden), a: 0.7 * (1 - env.cover) };
	else if (env.sm.moon.alt > 3 && env.night > 0.4 && env.cover < 0.85) src = { x: sky.moon.x, c: [226, 232, 255], a: 0.5 * (1 - env.cover) * (0.3 + env.sm.moon.illum) };
	if (!src) return;
	const L = view.h - hy;
	for (let i = 0; i < 90; i++) {
		const k = Math.pow(rand(), 1.4);
		const y = hy + 3 + k * L;
		const spread = (6 + k * 60) * (0.5 + env.wind);
		const x = src.x + (rand() - 0.5) * 2 * spread * (1 + rand());
		const len = 6 + rand() * (14 + k * 50);
		ctx.strokeStyle = css(src.c, src.a * (0.2 + rand() * 0.8) * (1 - k * 0.4));
		ctx.lineWidth = 0.8 + k * 1.6;
		ctx.lineCap = "round";
		ctx.beginPath();
		ctx.moveTo(x - len / 2, y);
		ctx.lineTo(x + len / 2, y);
		ctx.stroke();
	}
}

export function paintFogBand(ctx, view, env, hy, amount = env.fog) {
	if (amount < 0.05) return;
	const { w, h } = view;
	const g = ctx.createLinearGradient(0, hy - h * 0.34, 0, hy + h * 0.12);
	g.addColorStop(0, css(env.haze, 0));
	g.addColorStop(0.7, css(env.haze, 0.8 * amount));
	g.addColorStop(1, css(env.haze, 0.35 * amount));
	ctx.fillStyle = g;
	ctx.fillRect(0, hy - h * 0.34, w, h * 0.46);
	ctx.fillStyle = css(env.haze, 0.22 * amount);
	ctx.fillRect(0, 0, w, hy);
}

// ---------- sprites that can sway ----------
export function makeSprite(view, w, h, draw) {
	const c = document.createElement("canvas");
	c.width = Math.ceil(w * view.dpr);
	c.height = Math.ceil(h * view.dpr);
	const ctx = c.getContext("2d");
	ctx.scale(view.dpr, view.dpr);
	draw(ctx);
	return { c, w, h };
}

export function blitSprite(ctx, s, x, y, ax, ay, rot = 0, scale = 1, alpha = 1) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.translate(x, y);
	if (rot) ctx.rotate(rot);
	ctx.scale(scale, scale);
	ctx.drawImage(s.c, -ax, -ay, s.w, s.h);
	ctx.restore();
}

// ---------- animated weather ----------
export function makeFx(view, env, { hy, intensity = 1, snowScale = 1 } = {}) {
	const rand = rng(env.p.seed * 31 + 9);
	const area = view.w * view.h;
	const dark = env.tone === "dark";
	const drops = [];
	const flakes = [];
	if (env.rainy) {
		const n = Math.round(clamp(area / 3600, 70, 380) * intensity);
		for (let i = 0; i < n; i++) drops.push({ x: rand() * view.w * 1.2, y: rand() * view.h, l: 8 + rand() * 14, v: 640 + rand() * 360, a: rand() });
	}
	if (env.snowy) {
		const n = Math.round(clamp(area / 5500, 70, 260) * intensity);
		for (let i = 0; i < n; i++) flakes.push({ x: rand() * view.w, y: rand() * view.h, r: 0.7 + rand() * 1.9, v: 22 + rand() * 40, ph: rand() * 6.28, d: 8 + rand() * 18 });
	}
	const rings = [];
	let fogSprite = null;
	if (env.fog > 0.3) {
		fogSprite = makeSprite(view, 1200, 220, (c) => {
			const r = rng(env.p.seed + 77);
			for (let i = 0; i < 20; i++) blob(c, r() * 1200, 70 + r() * 90, 150 + r() * 200, 40 + r() * 50, env.haze, 0.2 + r() * 0.18);
		});
	}
	const wind = env.wind;
	return {
		draw(ctx, t, dt, still = false) {
			if (drops.length) {
				ctx.strokeStyle = dark ? "rgba(190,205,240,0.30)" : "rgba(70,90,120,0.34)";
				ctx.lineWidth = 1;
				ctx.beginPath();
				const sl = 0.12 + wind * 0.4;
				for (const d of drops) {
					if (!still) {
						d.y += d.v * dt;
						d.x -= d.v * dt * sl;
						if (d.y > view.h) {
							d.y = -20;
							d.x = rand() * view.w * 1.2;
							if (hy && rings.length < 22 && rand() < 0.3) rings.push({ x: rand() * view.w, y: hy + 8 + rand() * (view.h - hy - 10), t: 0 });
						}
					}
					ctx.moveTo(d.x, d.y);
					ctx.lineTo(d.x + d.l * sl, d.y - d.l);
				}
				ctx.stroke();
				if (hy) {
					ctx.lineWidth = 1;
					for (let i = rings.length - 1; i >= 0; i--) {
						const r = rings[i];
						r.t += dt;
						const k = r.t / 1.1;
						if (k >= 1) {
							rings.splice(i, 1);
							continue;
						}
						const sc = (r.y - hy) / (view.h - hy);
						ctx.strokeStyle = dark ? `rgba(200,215,255,${0.35 * (1 - k)})` : `rgba(255,255,255,${0.55 * (1 - k)})`;
						ctx.beginPath();
						ctx.ellipse(r.x, r.y, (3 + k * 20) * (0.5 + sc), (3 + k * 20) * (0.5 + sc) * 0.28, 0, 0, 6.2832);
						ctx.stroke();
					}
				}
			}
			if (flakes.length) {
				ctx.fillStyle = dark ? "rgba(235,242,255,0.8)" : "rgba(255,255,255,0.95)";
				ctx.beginPath();
				for (const f of flakes) {
					if (!still) {
						f.y += f.v * dt * snowScale;
						f.x += (Math.sin(t * 0.8 + f.ph) * f.d * 0.6 + wind * 40) * dt;
						if (f.y > view.h + 4) {
							f.y = -4;
							f.x = rand() * view.w;
						}
						if (f.x > view.w + 4) f.x = -4;
					}
					ctx.moveTo(f.x + f.r, f.y);
					ctx.arc(f.x, f.y, f.r, 0, 6.2832);
				}
				ctx.fill();
				if (!dark) {
					ctx.strokeStyle = "rgba(90,110,140,0.25)";
					ctx.lineWidth = 0.7;
					ctx.beginPath();
					for (const f of flakes) {
						if (f.r > 1.6) {
							ctx.moveTo(f.x + f.r + 0.4, f.y);
							ctx.arc(f.x, f.y, f.r + 0.4, 0, 6.2832);
						}
					}
					ctx.stroke();
				}
			}
			if (fogSprite) {
				const off = still ? 0 : (t * (6 + wind * 14)) % 1200;
				const a = clamp(env.fog * 0.8);
				const y0 = (hy || view.h * 0.6) - 150;
				for (let x = -off; x < view.w; x += 1200) blitSprite(ctx, fogSprite, x, y0, 0, 0, 0, 1, a);
				for (let x = -off + 560; x < view.w; x += 1200) blitSprite(ctx, fogSprite, x, y0 + 60, 0, 0, 0, 1.2, a * 0.7);
			}
		},
		active: drops.length > 0 || flakes.length > 0 || !!fogSprite,
	};
}

// ---------- scene controller ----------
const DEFAULT_TONE_CSS = true;
void DEFAULT_TONE_CSS;

function selectEl(options, value, onChange) {
	const s = document.createElement("select");
	for (const o of options) {
		const op = document.createElement("option");
		op.value = o.value ?? o;
		op.textContent = o.label ?? o;
		s.appendChild(op);
	}
	s.value = value;
	s.addEventListener("change", () => onChange(s.value));
	return s;
}

function fmtHour(h) {
	const hh = Math.floor(h);
	const mm = Math.round((h - hh) * 60) % 60;
	return `${pad(hh)}:${pad(mm)}`;
}

/**
 * mountScene(root, { id, mode, reducedMotion, defaults, generate, paint, frame, controls, horizon, fx })
 *  generate(params, env)           -> scene   (pure)
 *  paint(ctx, scene, view, env)    -> void    (static layer, scenery-a; view = {w,h,dpr})
 *  frame(ctx, scene, view, env, t, dt) -> void (animated layer, scenery-b; optional)
 *  controls: extra [{key,label,type:"range"|"select",min,max,step,options}] stored on params
 *  horizon:  fraction of height used for fx ripples (default 0.64)
 */
export function mountScene(root, opts) {
	const { defaults = {}, generate, paint, frame, controls = [], horizon = 0.64, reducedMotion } = opts;
	const layerA = root.querySelector(".scenery-a");
	const layerB = root.querySelector(".scenery-b");
	const layerC = root.querySelector(".scenery-c");
	const overlay = root.querySelector(".overlay-b");
	layerC.classList.add("adk-veil");
	const motion = !reducedMotion && !matchMedia("(prefers-reduced-motion: reduce)").matches;

	let params = normalizeParams(paramsFromQuery(location.search, defaultParams(defaults)));
	const q = new URLSearchParams(location.search);
	// The gallery's light/dark toggle picks day vs. night unless the URL pins an hour.
	const wantTone = opts.mode === "dark" ? "dark" : "light";
	if (!q.has("hour") && makeEnv(params).tone !== wantTone) params.hour = wantTone === "dark" ? 22 : 11;
	for (const c of controls) if (q.has(c.key) && !Number.isNaN(Number(q.get(c.key)))) params[c.key] = Number(q.get(c.key));
	for (const c of controls) if (params[c.key] === undefined) params[c.key] = c.default;

	const mkCanvas = (layer, cls) => {
		const c = document.createElement("canvas");
		c.className = cls;
		c.setAttribute("aria-hidden", "true");
		layer.appendChild(c);
		return c;
	};
	const cvA = mkCanvas(layerA, "adk-canvas");
	const cvB = mkCanvas(layerB, "adk-canvas");
	const ctxA = cvA.getContext("2d");
	const ctxB = cvB.getContext("2d");

	let env;
	let scene;
	let view = { w: 1, h: 1, dpr: 1 };
	let fx = null;
	let raf = 0;
	let dead = false;
	let t0 = performance.now();
	let last = t0;
	let dirty = true;
	let pending = 0;

	function size() {
		const r = layerA.getBoundingClientRect();
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		view = { w: Math.max(2, Math.round(r.width)), h: Math.max(2, Math.round(r.height)), dpr };
		for (const c of [cvA, cvB]) {
			c.width = Math.round(view.w * dpr);
			c.height = Math.round(view.h * dpr);
		}
	}

	function applyCss() {
		root.dataset.tone = env.tone;
		root.dataset.weather = params.weather;
		root.style.setProperty("--siteBg", css(env.sky.mid));
		root.style.setProperty(
			"--adk-veil",
			env.tone === "light" ? css(mix(env.sky.hor, [255, 255, 255], 0.6), 0.34) : css(mix(env.sky.top, [0, 0, 6], 0.55), 0.38),
		);
		root.style.setProperty("--adk-halo", env.tone === "light" ? css(mix(env.sky.hor, [255, 255, 255], 0.6), 0.9) : css(mix(env.sky.top, [0, 0, 6], 0.5), 0.9));
	}

	function rebuild() {
		pending = 0;
		if (dead) return;
		env = makeEnv(params);
		scene = generate(params, env);
		applyCss();
		size();
		ctxA.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
		ctxA.clearRect(0, 0, view.w, view.h);
		paint(ctxA, scene, view, env);
		ctxB.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
		ctxB.clearRect(0, 0, view.w, view.h);
		fx = opts.fx === false ? null : makeFx(view, env, { hy: view.h * horizon, intensity: params.intensity ?? 1 });
		if (scene.onResize) scene.onResize(view, env);
		updateChip();
		dirty = false;
		start();
	}

	function schedule() {
		if (!pending) pending = requestAnimationFrame(rebuild);
	}

	function drawFrame(t, dt, still) {
		ctxB.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
		ctxB.clearRect(0, 0, view.w, view.h);
		if (frame) frame(ctxB, scene, view, env, t, dt, still);
		if (fx) fx.draw(ctxB, t, dt, still);
	}

	let lastT = 0;
	function loop(now) {
		raf = 0;
		if (dead) return;
		if (document.hidden) return;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		lastT = (now - t0) / 1000;
		drawFrame(lastT, dt, false);
		raf = requestAnimationFrame(loop);
	}

	function start() {
		cancelAnimationFrame(raf);
		raf = 0;
		const animated = !!frame || (fx && fx.active);
		if (!animated) return;
		if (!motion) {
			drawFrame(0, 0, true);
			return;
		}
		last = performance.now();
		raf = requestAnimationFrame(loop);
	}

	// ----- chip -----
	const chip = document.createElement("div");
	chip.className = "adk-chip";
	const toggle = document.createElement("button");
	toggle.type = "button";
	toggle.className = "adk-chip-toggle";
	toggle.setAttribute("aria-expanded", "false");
	const body = document.createElement("div");
	body.className = "adk-chip-body";
	body.hidden = true;
	chip.append(toggle, body);
	chip.addEventListener("keydown", (e) => e.stopPropagation());

	const set = (patch) => {
		params = normalizeParams({ ...params, ...patch });
		schedule();
	};
	const row = (label, input, out) => {
		const l = document.createElement("label");
		l.className = "adk-row";
		const s = document.createElement("span");
		s.textContent = label;
		l.append(s, input);
		if (out) l.append(out);
		body.appendChild(l);
		return l;
	};
	const readouts = {};
	const seedIn = document.createElement("input");
	seedIn.type = "number";
	seedIn.value = params.seed;
	seedIn.addEventListener("input", () => set({ seed: seedIn.value }));
	const dice = document.createElement("button");
	dice.type = "button";
	dice.textContent = "Reroll";
	dice.className = "adk-mini";
	dice.addEventListener("click", () => {
		const s = Math.floor(Math.random() * 99999);
		seedIn.value = s;
		set({ seed: s });
	});
	const seedRow = row("Seed", seedIn);
	seedRow.append(dice);

	const hourIn = document.createElement("input");
	hourIn.type = "range";
	hourIn.min = 0;
	hourIn.max = 24;
	hourIn.step = 0.25;
	hourIn.value = params.hour;
	readouts.hour = document.createElement("output");
	hourIn.addEventListener("input", () => set({ hour: Number(hourIn.value) }));
	row("Hour", hourIn, readouts.hour);

	const seasonSel = selectEl(SEASONS, params.season, (v) => set({ season: v }));
	row("Season", seasonSel);
	const weatherSel = selectEl(WEATHERS, params.weather, (v) => set({ weather: v }));
	row("Weather", weatherSel);
	const windIn = document.createElement("input");
	windIn.type = "range";
	windIn.min = 0;
	windIn.max = 1;
	windIn.step = 0.05;
	windIn.value = params.wind;
	windIn.addEventListener("input", () => set({ wind: Number(windIn.value) }));
	row("Wind", windIn);
	const extraInputs = {};
	for (const c of controls) {
		let input;
		if (c.type === "select") {
			input = selectEl(c.options, params[c.key], (v) => set({ [c.key]: v }));
		} else {
			input = document.createElement("input");
			input.type = "range";
			input.min = c.min;
			input.max = c.max;
			input.step = c.step ?? 1;
			input.value = params[c.key];
			input.addEventListener("input", () => set({ [c.key]: Number(input.value) }));
		}
		extraInputs[c.key] = input;
		row(c.label, input);
	}
	const foot = document.createElement("div");
	foot.className = "adk-foot";
	const nowBtn = document.createElement("button");
	nowBtn.type = "button";
	nowBtn.className = "adk-mini";
	nowBtn.textContent = "Use my clock";
	nowBtn.addEventListener("click", () => {
		const d = defaultParams(defaults);
		params = normalizeParams({ ...params, ...d, weather: defaults.weather ?? "clear" });
		hourIn.value = params.hour;
		seasonSel.value = params.season;
		weatherSel.value = params.weather;
		seedIn.value = params.seed;
		schedule();
	});
	foot.append(nowBtn);
	body.appendChild(foot);

	toggle.addEventListener("click", () => {
		const open = body.hidden;
		body.hidden = !open;
		toggle.setAttribute("aria-expanded", String(open));
		chip.classList.toggle("is-open", open);
	});
	function updateChip() {
		toggle.innerHTML = "";
		const a = document.createElement("span");
		a.className = "adk-dot";
		a.setAttribute("aria-hidden", "true");
		toggle.append(a, `Scene · ${fmtHour(params.hour)} · ${params.season} · ${params.weather}`);
		readouts.hour.textContent = fmtHour(params.hour);
		hourIn.value = params.hour;
		seasonSel.value = params.season;
		weatherSel.value = params.weather;
		windIn.value = params.wind;
	}
	overlay.appendChild(chip);

	// light/dark toggle in the gallery maps to day/night
	const mo = new MutationObserver(() => {
		const want = document.documentElement.classList.contains("dark") ? "dark" : "light";
		if (makeEnv(params).tone !== want) set({ hour: want === "dark" ? 22 : 11 });
	});
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	let rz = 0;
	const onResize = () => {
		clearTimeout(rz);
		rz = setTimeout(schedule, 120);
	};
	const onVis = () => {
		if (!document.hidden && !raf) start();
	};
	window.addEventListener("resize", onResize);
	document.addEventListener("visibilitychange", onVis);

	// Defer first paint to idle so activation stays cheap.
	schedule();
	void dirty;
	const api = { get params() { return params; }, set, get env() { return env; }, redraw: () => { if (!raf && scene) drawFrame(lastT, 0, true); } };
	root.__adk = api;
	return () => {
		dead = true;
		cancelAnimationFrame(raf);
		cancelAnimationFrame(pending);
		clearTimeout(rz);
		mo.disconnect();
		window.removeEventListener("resize", onResize);
		document.removeEventListener("visibilitychange", onVis);
		if (scene && scene.dispose) scene.dispose();
	};
}
