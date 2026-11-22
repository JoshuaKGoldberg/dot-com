import { rng, hex } from "./_scroll/lib.js";

const SCENES = {
	hero: { light: ["#7ec4e8", "#fde9c0", "#8fa9c4", "#6b9a86", "#2f6a4a", "#1f5039", "#ffd36a"], dark: ["#0a1030", "#3b3a6a", "#26356a", "#1f4a5a", "#0f3a33", "#0a2a26", "#eef2ff"], body: "sun" },
	about: { light: ["#f4b97e", "#fbe8c8", "#a98a96", "#7f9a7c", "#355f45", "#244733", "#fff0c0"], dark: ["#1a1038", "#5a3a6a", "#35305c", "#2a4a4e", "#143a30", "#0c2a22", "#f3efd8"], body: "sun", stars: true },
	posts: { light: ["#8fcaf0", "#f4f6e6", "#9bb5cc", "#79ae8a", "#3d7a55", "#2a5c40", "#fff6c8"], dark: ["#0c1838", "#304a7a", "#2d4070", "#245a5a", "#17463a", "#0e3228", "#e8eeff"], body: "sun", clouds: true },
	projects: { light: ["#9fc2e8", "#eef3f7", "#8a9fbb", "#67879c", "#386a58", "#24503f", "#fff"], dark: ["#101a40", "#3a4c7a", "#34436e", "#2a4a66", "#173f3c", "#0d2c2a", "#e8eeff"], body: "peaks" },
	talks: { light: ["#3b2a5e", "#8a5a96", "#5a3e7a", "#4a3366", "#2a1e44", "#1a1230", "#ffe9a8"], dark: ["#120a2a", "#4a2a64", "#2e1e50", "#241a44", "#170f30", "#0e0820", "#ffe9a8"], body: "stage" },
	footer: { light: ["#2f3f80", "#f0a070", "#4a4c88", "#3a3a70", "#22234e", "#161638", "#ffe0b0"], dark: ["#050818", "#222c5e", "#1b2250", "#161b40", "#0d1130", "#080a20", "#dfe8ff"], body: "aurora" },
};

function ridge(r, W, base, amp, color, scale = 1) {
	const ph = [r() * 9, r() * 9, r() * 9];
	let d = `M-20 ${base + amp + 600}`;
	for (let x = -20; x <= W + 20; x += 16) {
		const u = (x / W) * scale;
		const y = base - amp * (0.5 + 0.28 * Math.sin(u * 5 + ph[0]) + 0.16 * Math.sin(u * 13 + ph[1]) + 0.08 * Math.sin(u * 29 + ph[2]));
		d += `L${x} ${y.toFixed(1)}`;
	}
	return `<path d="${d}L${W + 20} ${base + amp + 600}Z" fill="${color}"/>`;
}
function pine(x, base, h, color) {
	const w = h * 0.34;
	let d = `M${x} ${base - h}`;
	const tiers = 5;
	for (let k = 1; k <= tiers; k++) {
		const y = base - h + (h * 0.92 * k) / tiers;
		const ww = (w * k) / tiers;
		d += `L${(x + ww / 2 + 2).toFixed(1)} ${y.toFixed(1)}L${(x + ww / 4).toFixed(1)} ${y.toFixed(1)}`;
	}
	d += `L${x + 3} ${base}L${x - 3} ${base}`;
	for (let k = tiers; k >= 1; k--) {
		const y = base - h + (h * 0.92 * k) / tiers;
		const ww = (w * k) / tiers;
		d += `L${(x - ww / 4).toFixed(1)} ${y.toFixed(1)}L${(x - ww / 2 - 2).toFixed(1)} ${y.toFixed(1)}`;
	}
	return `<path d="${d}Z" fill="${color}"/>`;
}

function layers(name, W, H, dark, seed) {
	const sp = SCENES[name][dark ? "dark" : "light"];
	const [skyT, skyB, far, mid, tree, front, body] = sp;
	const r = rng(seed);
	const svg = (inner) => `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${inner}</svg>`;
	const spec = SCENES[name];
	// L0 sky
	let sky = "";
	if (dark || spec.stars) for (let i = 0; i < 60; i++) sky += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * 120).toFixed(0)}" r="${(0.6 + r() * 1.4).toFixed(1)}" fill="#fff" opacity="${(dark ? 0.5 + r() * 0.5 : 0.35 * r()).toFixed(2)}"/>`;
	const bx = W * 0.74, by = 64;
	if (spec.body === "sun") sky += `<circle cx="${bx}" cy="${by}" r="70" fill="${body}" opacity=".22"/><circle cx="${bx}" cy="${by}" r="38" fill="${body}"/>`;
	if (spec.body === "peaks") sky += `<circle cx="${W * 0.2}" cy="48" r="26" fill="${dark ? "#e8eeff" : "#fff6c8"}"/>`;
	if (spec.body === "stage") for (let k = 0; k < 3; k++) sky += `<polygon points="${W * (0.25 + k * 0.25)},0 ${W * (0.25 + k * 0.25) - 90},${H * 0.9} ${W * (0.25 + k * 0.25) + 90},${H * 0.9}" fill="#ffe9a8" opacity=".07"/>`;
	if (spec.body === "aurora") sky += `<path d="M0 90 C ${W * 0.25} 20 ${W * 0.5} 150 ${W} 40 L${W} 120 C ${W * 0.6} 190 ${W * 0.3} 70 0 160Z" fill="${dark ? "#4be3b0" : "#ffd0a0"}" opacity=".28"/>`;
	if (spec.clouds) for (let i = 0; i < 4; i++) {
		const cx = r() * W, cy = 40 + r() * 80;
		sky += `<g fill="#fff" opacity="${dark ? 0.12 : 0.85}"><ellipse cx="${cx}" cy="${cy}" rx="56" ry="14"/><ellipse cx="${cx + 26}" cy="${cy - 10}" rx="34" ry="14"/><ellipse cx="${cx - 24}" cy="${cy - 6}" rx="28" ry="10"/></g>`;
	}
	const L0 = svg(sky);
	// L1 far
	let f = ridge(r, W, 150, 70, far);
	if (spec.body === "peaks") {
		for (let k = 0; k < 4; k++) {
			const px = W * (0.12 + k * 0.26) + r() * 30, ph = 90 + r() * 40;
			f += `<polygon points="${px - 120},260 ${px},${150 - ph + 40} ${px + 120},260" fill="${far}"/><polygon points="${px - 30},${150 - ph + 94} ${px},${150 - ph + 40} ${px + 30},${150 - ph + 94} ${px + 12},${150 - ph + 86} ${px},${150 - ph + 98} ${px - 14},${150 - ph + 88}" fill="${dark ? "#cfd9f5" : "#fff"}"/>`;
		}
	}
	const L1 = svg(f);
	// L2 mid
	let m = ridge(r, W, 205, 44, mid, 1.3);
	for (let i = 0; i < 14; i++) m += pine(r() * W, 215 + r() * 20, 28 + r() * 22, tree);
	const L2 = svg(m);
	// L3 side trees / curtains
	let t = "";
	if (spec.body === "stage") {
		for (const side of [0, 1]) {
			const x0 = side ? W - 70 : 0;
			t += `<rect x="${x0}" y="0" width="70" height="${H}" fill="${dark ? "#7a1f2c" : "#b4303d"}"/>`;
			for (let k = 0; k < 7; k++) t += `<rect x="${x0 + k * 10}" y="0" width="${4 + (k % 3)}" height="${H}" fill="#000" opacity="${0.1 + (k % 2) * 0.1}"/>`;
			t += `<path d="M${x0} 0h70v${40}c-20 20-50 20-70 0Z" fill="#e0b650" opacity=".9"/>`;
		}
	} else {
		for (const side of [0, 1])
			for (let i = 0; i < 5; i++) {
				const x = side ? W - 14 - r() * 80 : 14 + r() * 80;
				const h = H * (0.3 + r() * 0.34);
				t += pine(x, H + 10 - i * 4, h * (1 - i * 0.08), tree);
			}
	}
	const L3 = svg(t);
	// L4 front grass
	let g = `<path d="M-10 ${H + 10}`;
	for (let x = -10; x <= W + 10; x += 10) g += `L${x} ${(H - 10 - r() * 26).toFixed(1)}L${x + 5} ${(H - 2 - r() * 6).toFixed(1)}`;
	g += `L${W + 10} ${H + 10}Z" fill="${front}"/>`;
	for (const side of [0, 1]) for (let k = 0; k < 3; k++) {
		const x = side ? W - 20 - k * 22 : 20 + k * 22;
		g += `<path d="M${x} ${H}Q${x + (side ? -24 : 24)} ${H - 60 - k * 14} ${x + (side ? -50 : 50)} ${H - 36 - k * 6}Q${x + (side ? -20 : 20)} ${H - 36} ${x} ${H}Z" fill="${front}"/>`;
	}
	const L4 = svg(g);
	return { bg: `linear-gradient(${skyT}, ${skyB} 42%, ${mid} 42.2%, ${tree})`, L0, L1, L2, L3, L4 };
}

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const targets = [
		["hero", ".site-hero"],
		["about", ".site-about"],
		["posts", ".site-posts"],
		["projects", ".site-projects"],
		["talks", ".site-talks"],
		["footer", ".site-footer"],
	].map(([name, sel]) => [name, root.querySelector(sel)]).filter(([, el]) => el);
	const boxes = [];
	targets.forEach(([name, el], i) => {
		el.classList.add("dio");
		const scene = document.createElement("div");
		scene.className = "dio-scene";
		scene.setAttribute("aria-hidden", "true");
		const walls = document.createElement("div");
		walls.className = "dio-walls";
		walls.setAttribute("aria-hidden", "true");
		walls.innerHTML = "<i></i><i></i><i></i><i></i>";
		const card = document.createElement("div");
		card.className = "dio-card";
		while (el.firstChild) card.append(el.firstChild);
		el.append(scene, card, walls);
		boxes.push({ name, el, scene, i });
	});
	const depths = [0.04, 0.12, 0.3, 0.7, 1.15];
	function paint() {
		for (const b of boxes) {
			const W = Math.max(300, b.el.clientWidth), H = Math.max(240, b.el.clientHeight);
			const L = layers(b.name, W, H, dark, 11 + b.i * 17);
			b.scene.style.background = L.bg;
			b.scene.innerHTML = ["L0", "L1", "L2", "L3", "L4"].map((k, d) => `<div class="dio-l" style="--d:${depths[d]}">${L[k]}</div>`).join("");
		}
	}
	paint();
	let rt = 0;
	const ro = new ResizeObserver(() => {
		clearTimeout(rt);
		rt = setTimeout(paint, 120);
	});
	ro.observe(root);
	document.fonts?.ready.then(paint);

	// Pointer parallax (variables on the root; CSS does the rest)
	let raf = 0, px = 0, py = 0;
	const onMove = (e) => {
		px = (e.clientX / innerWidth - 0.5) * 2;
		py = (e.clientY / innerHeight - 0.5) * 2;
		if (!raf) raf = requestAnimationFrame(() => {
			raf = 0;
			root.style.setProperty("--px", px.toFixed(3));
			root.style.setProperty("--py", py.toFixed(3));
		});
	};
	if (!reducedMotion) window.addEventListener("pointermove", onMove, { passive: true });
	return () => {
		clearTimeout(rt);
		cancelAnimationFrame(raf);
		ro.disconnect();
		window.removeEventListener("pointermove", onMove);
	};
}
