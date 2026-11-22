// Shared helpers for the scenery themes (seeded RNG, ridge paths, shimmer tiles).
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

export const NS = "http://www.w3.org/2000/svg";

export function el(tag, attrs = {}, parent) {
	const node = document.createElementNS(NS, tag);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
	if (parent) parent.appendChild(node);
	return node;
}

export function div(className, parent, style) {
	const node = document.createElement("div");
	if (className) node.className = className;
	if (style) node.style.cssText = style;
	if (parent) parent.appendChild(node);
	return node;
}

const f = (n) => Math.round(n * 10) / 10;

// Smooth rolling ridge via summed sines. Returns { d, y(x) }.
export function hills({ w, h, base, amp, seed, waves = 4, step = 8 }) {
	const r = rng(seed);
	const parts = Array.from({ length: waves }, (_, i) => ({
		k: ((i + 1) * 1.7 + r()) * ((Math.PI * 2) / w),
		p: r() * 6.28,
		a: amp / (i * 0.9 + 1),
	}));
	const y = (x) => base + parts.reduce((s, q) => s + Math.sin(x * q.k + q.p) * q.a, 0);
	let d = `M0 ${h}`;
	for (let x = 0; x <= w + step; x += step) d += `L${f(x)} ${f(y(x))}`;
	d += `L${w + step} ${h}Z`;
	return { d, y };
}

// Rounded Adirondack-style pine ridge: a rolling baseline with overlapping spruce tops.
export function pineRidge({ w, h, base, amp, treeH, seed, gap = [7, 14], waves = 3 }) {
	const r = rng(seed);
	const { y } = hills({ w, h, base, amp, seed: seed + 11, waves });
	let d = `M-20 ${h}L-20 ${f(y(0))}`;
	let x = -10;
	let vx = x;
	let vy = y(x);
	d += `L${f(vx)} ${f(vy)}`;
	while (x < w + 30) {
		x += gap[0] + r() * (gap[1] - gap[0]);
		const ht = treeH * (0.45 + r() * 0.75) * (r() < 0.06 ? 1.5 : 1);
		const hw = ht * (0.2 + r() * 0.08) + 2;
		const gy = y(x);
		const top = gy - ht;
		const nvx = x + hw * (0.9 + r() * 0.5);
		const nvy = y(nvx) - ht * (0.18 + r() * 0.25);
		d += `C${f(vx + 1)} ${f(vy - ht * 0.45)} ${f(x - hw * 0.45)} ${f(top + ht * 0.2)} ${f(x - 1)} ${f(top + 2)}`;
		d += `Q${f(x)} ${f(top - 1.5)} ${f(x + 1)} ${f(top + 2)}`;
		d += `C${f(x + hw * 0.45)} ${f(top + ht * 0.2)} ${f(nvx - 1)} ${f(nvy - ht * 0.45)} ${f(nvx)} ${f(nvy)}`;
		vx = nvx;
		vy = nvy;
		x = Math.max(x, nvx - 3);
	}
	d += `L${w + 30} ${h}Z`;
	return { d, y };
}

// A double-width tile of horizontal shimmer streaks that loops seamlessly with translateX(-50%).
export function shimmerSVG({ seed, count = 40, width = 1600, height = 120, cls = "streak" }) {
	const r = rng(seed);
	const items = [];
	for (let i = 0; i < count; i++) {
		const yy = Math.pow(r(), 1.3) * height;
		const len = 30 + r() * 150 * (0.4 + yy / height);
		const xx = r() * width;
		const sw = 0.8 + r() * 1.6;
		const o = (0.25 + r() * 0.75).toFixed(2);
		items.push({ xx, yy, len, sw, o });
	}
	const svg = el("svg", {
		viewBox: `0 0 ${width * 2} ${height}`,
		preserveAspectRatio: "none",
		class: "shimmer-svg",
	});
	for (const copy of [0, 1]) {
		for (const s of items) {
			el("line", {
				x1: f(s.xx + copy * width),
				x2: f(s.xx + copy * width + s.len),
				y1: f(s.yy),
				y2: f(s.yy),
				"stroke-width": f(s.sw),
				"stroke-linecap": "round",
				opacity: s.o,
				class: cls,
			}, svg);
		}
	}
	return svg;
}

// Seeded star field as SVG circles. Each star gets CSS vars for twinkle timing.
export function starSVG({ seed, count, minY = 0, maxY = 1, twinkle = [8, 12], twinkleShare = 0.35, maxO = 0.7 }) {
	const r = rng(seed);
	const svg = el("svg", { class: "stars-svg", width: "100%", height: "100%" });
	for (let i = 0; i < count; i++) {
		const sx = (r() * 100).toFixed(2) + "%";
		const sy = ((minY + (maxY - minY) * r()) * 100).toFixed(2) + "%";
		const big = r() < 0.08;
		const c = el("ellipse", {
			cx: sx, cy: sy, rx: big ? 1.1 : 0.6 + r() * 0.5, ry: big ? 1.7 : 0.9 + r() * 0.7,
			opacity: ((0.2 + r() * 0.8) * maxO).toFixed(2),
		}, svg);
		if (r() < twinkleShare) {
			c.setAttribute("class", "twinkle");
			c.style.setProperty("--tw-d", `${(twinkle[0] + r() * (twinkle[1] - twinkle[0])).toFixed(1)}s`);
			c.style.setProperty("--tw-delay", `${(-r() * 12).toFixed(1)}s`);
		}
	}
	return svg;
}

export function prefersMotion(reducedMotion) {
	return !reducedMotion && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}
