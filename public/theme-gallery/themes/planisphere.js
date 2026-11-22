const NS = "http://www.w3.org/2000/svg";
const D2R = Math.PI / 180;

function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// [name, RA hours, Dec degrees, magnitude]
const S = {
	// Big Dipper
	dubhe: [11.062, 61.75, 1.8], merak: [11.031, 56.38, 2.4], phecda: [11.897, 53.69, 2.4],
	megrez: [12.257, 57.03, 3.3], alioth: [12.9, 55.96, 1.8], mizar: [13.399, 54.93, 2.2], alkaid: [13.792, 49.31, 1.9],
	// Orion
	betelgeuse: [5.919, 7.41, 0.5], rigel: [5.242, -8.2, 0.2], bellatrix: [5.419, 6.35, 1.6], saiph: [5.796, -9.67, 2.1],
	alnitak: [5.679, -1.94, 1.8], alnilam: [5.603, -1.2, 1.7], mintaka: [5.533, -0.3, 2.2], meissa: [5.585, 9.93, 3.4],
	// Cassiopeia
	caph: [0.153, 59.15, 2.3], schedar: [0.675, 56.54, 2.2], navi: [0.945, 60.72, 2.5], ruchbah: [1.43, 60.24, 2.7], segin: [1.907, 63.67, 3.4],
	// others
	polaris: [2.53, 89.26, 2.0], sirius: [6.752, -16.72, -1.4], procyon: [7.655, 5.22, 0.4], capella: [5.278, 46.0, 0.1],
	vega: [18.616, 38.78, 0.0], deneb: [20.69, 45.28, 1.3], arcturus: [14.261, 19.18, -0.05], aldebaran: [4.599, 16.51, 0.9],
	altair: [19.846, 8.87, 0.8], regulus: [10.14, 11.97, 1.4], pollux: [7.755, 28.03, 1.1], castor: [7.577, 31.89, 1.6],
	spica: [13.42, -11.16, 1.0], deneb2: [11.818, 14.57, 2.1],
};

const LINES = [
	["dubhe", "merak", "phecda", "megrez", "alioth", "mizar", "alkaid"],
	["megrez", "dubhe"],
	["meissa", "betelgeuse", "alnitak", "saiph"],
	["meissa", "bellatrix", "mintaka", "rigel"],
	["alnitak", "alnilam", "mintaka"],
	["caph", "schedar", "navi", "ruchbah", "segin"],
];

function el(name, attrs, parent) {
	const n = document.createElementNS(NS, name);
	for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
	parent?.appendChild(n);
	return n;
}

// Local sidereal time in degrees, using the timezone offset as a stand-in for longitude.
function localSiderealDegrees(now = Date.now()) {
	const jd = now / 86400000 + 2440587.5;
	const gmst = (((280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360) + 360) % 360;
	const longitude = -new Date(now).getTimezoneOffset() * 0.25; // 15 deg per hour east of UTC
	return (((gmst + longitude) % 360) + 360) % 360;
}

function clock(now = new Date()) {
	return now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?(AM|PM)/, (_, p) => ` ${p.toLowerCase()}`);
}

export function activate({ root }) {
	const layer = root.querySelector(".site-scenery .scenery-b");
	const W = layer.clientWidth || 1280;
	const H = layer.clientHeight || 760;
	const R = Math.min(460, Math.max(300, H * 0.6));
	const cx = W - Math.min(190, W * 0.15);
	const cy = H * 0.5;
	const k = R / Math.tan(60 * D2R); // stereographic, edge at dec -30
	const proj = (raH, dec) => {
		const r = k * Math.tan(((90 - dec) / 2) * D2R);
		const a = raH * 15 * D2R;
		return [-r * Math.sin(a), -r * Math.cos(a)];
	};

	const svg = el("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMinYMin slice" }, layer);
	const g0 = el("g", { transform: `translate(${cx} ${cy})` }, svg);
	const g = el("g", {}, g0);

	// declination rings (stereographic circles centred on the pole)
	for (let dec = 75; dec >= -30; dec -= 15) {
		const r = k * Math.tan(((90 - dec) / 2) * D2R);
		el("circle", { class: dec === 0 ? "ring strong" : "ring", r: r.toFixed(1) }, g);
	}
	el("circle", { class: "ring strong", r: (R + 10).toFixed(1) }, g);
	el("circle", { class: "ring strong", r: (R + 34).toFixed(1) }, g);
	// hour meridians
	for (let h = 0; h < 24; h++) {
		const [x1, y1] = proj(h, 86);
		const [x2, y2] = proj(h, -30);
		el("line", { class: "merid", x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1) }, g);
		const a = -h * 15 * D2R;
		const rl = R + 22;
		const label = el("text", { class: "hour", x: (rl * Math.sin(a)).toFixed(1), y: (-rl * Math.cos(a) + 4).toFixed(1), "text-anchor": "middle" }, g);
		label.textContent = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII"][h];
	}
	// degree ticks on the outer band
	for (let d = 0; d < 360; d += 1) {
		const a = -d * D2R;
		const len = d % 15 === 0 ? 10 : d % 5 === 0 ? 6 : 3;
		const r1 = R + 10;
		el("line", { class: "tick", x1: (r1 * Math.sin(a)).toFixed(1), y1: (-r1 * Math.cos(a)).toFixed(1), x2: ((r1 + len) * Math.sin(a)).toFixed(1), y2: (-(r1 + len) * Math.cos(a)).toFixed(1) }, g);
	}
	// ecliptic as a sampled great circle (obliquity 23.44 deg)
	const eps = 23.44 * D2R;
	const pts = [];
	for (let l = 0; l <= 360; l += 2) {
		const lam = l * D2R;
		const ra = Math.atan2(Math.sin(lam) * Math.cos(eps), Math.cos(lam));
		const dec = Math.asin(Math.sin(eps) * Math.sin(lam)) / D2R;
		const [x, y] = proj((((ra / D2R) % 360) + 360) % 360 / 15, dec);
		pts.push(`${pts.length ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
	}
	el("path", { class: "ecliptic", d: pts.join("") }, g);

	// faint background stars, seeded
	const rand = rng(1976);
	for (let i = 0; i < 170; i++) {
		const ra = rand() * 24;
		const dec = Math.asin(rand() * 1.5 - 0.5) / D2R; // biased north, to -30
		if (dec < -30) continue;
		const [x, y] = proj(ra, dec);
		el("circle", { class: "star faint", cx: x.toFixed(1), cy: y.toFixed(1), r: (0.5 + rand() * 0.8).toFixed(2) }, g);
	}
	// named stars
	const xy = {};
	for (const [name, [ra, dec, mag]] of Object.entries(S)) {
		const [x, y] = proj(ra, dec);
		xy[name] = [x, y];
		el("circle", { class: "star", cx: x.toFixed(1), cy: y.toFixed(1), r: Math.max(1.3, 2.9 - mag * 0.5).toFixed(2) }, g);
	}
	for (const line of LINES) {
		el("path", { class: "lines", d: line.map((n, i) => `${i ? "L" : "M"}${xy[n][0].toFixed(1)} ${xy[n][1].toFixed(1)}`).join("") }, g);
	}
	// constellation names, kept tiny
	for (const [name, star, dx, dy] of [["URSA MAJOR", "alioth", 6, -14], ["ORION", "alnilam", 16, 22], ["CASSIOPEIA", "navi", 10, -16]]) {
		const t = el("text", { class: "cname", x: (xy[star][0] + dx).toFixed(1), y: (xy[star][1] + dy).toFixed(1) }, g);
		t.textContent = name;
	}

	const note = document.createElement("div");
	note.className = "chart-note";
	layer.parentElement.parentElement.querySelector(".site-overlay .overlay-b").appendChild(note);
	layer.parentElement.parentElement.querySelector(".site-overlay .overlay-b").style.inset = "0";

	const update = () => {
		const lst = localSiderealDegrees();
		g.setAttribute("transform", `rotate(${lst.toFixed(3)})`);
		note.textContent = `chart set to the sky over you at ${clock()}`;
	};
	update();
	const timer = setInterval(() => !document.hidden && update(), 60000);
	const onVisible = () => !document.hidden && update();
	document.addEventListener("visibilitychange", onVisible);
	return () => {
		clearInterval(timer);
		document.removeEventListener("visibilitychange", onVisible);
	};
}
