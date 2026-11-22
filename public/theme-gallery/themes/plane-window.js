import { el, div, rng } from "./two-skies-one-shore/lib.js";

const W = 1600;
const H = 1000;

function drawCity(canvas, seed, { cities, scale, alpha, pulses }) {
	const r = rng(seed);
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d");
	ctx.clearRect(0, 0, W, H);

	// Water: a meandering river and two lakes, kept dark.
	const riverPhase = r() * 6;
	const riverX = (y) => W * 0.42 + Math.sin(y * 0.006 + riverPhase) * 190 + Math.sin(y * 0.017 + riverPhase * 2) * 40;
	const lakes = [
		{ x: W * (0.12 + r() * 0.12), y: H * (0.2 + r() * 0.2), rx: 130 + r() * 60, ry: 70 + r() * 40 },
		{ x: W * (0.72 + r() * 0.15), y: H * (0.6 + r() * 0.25), rx: 160 + r() * 70, ry: 90 + r() * 40 },
	];
	const isWater = (x, y) => {
		if (Math.abs(x - riverX(y)) < 22 + Math.sin(y * 0.01) * 8) return true;
		return lakes.some((l) => ((x - l.x) / l.rx) ** 2 + ((y - l.y) / l.ry) ** 2 < 1);
	};

	const pt = (x, y, a, size = 1) => {
		if (x < 0 || y < 0 || x > W || y > H || isWater(x, y)) return;
		const warm = r();
		ctx.fillStyle = warm < 0.7 ? `rgba(255,${205 + Math.floor(r() * 25)},${140 + Math.floor(r() * 40)},${a})` : `rgba(255,240,${210 + Math.floor(r() * 30)},${a})`;
		ctx.beginPath();
		ctx.arc(x, y, size, 0, 6.2832);
		ctx.fill();
	};

	const centers = [];
	for (let i = 0; i < cities; i++) {
		let x;
		let y;
		let tries = 0;
		do {
			x = 100 + r() * (W - 200);
			y = 80 + r() * (H - 160);
			tries++;
		} while (isWater(x, y) && tries < 20);
		centers.push({ x, y, R: (90 + r() * 170) * scale, th: r() * Math.PI, sp: 8 + r() * 6, p1: r() * 6.28, p2: r() * 6.28 });
	}

	for (const c of centers) {
		// soft glow under the core
		const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.R);
		g.addColorStop(0, `rgba(255,170,90,${0.09 * alpha})`);
		g.addColorStop(1, "rgba(255,170,90,0)");
		ctx.fillStyle = g;
		ctx.fillRect(c.x - c.R, c.y - c.R, c.R * 2, c.R * 2);
		// loose street grid at the city's own angle
		for (const dir of [0, 1]) {
			const ang = c.th + dir * (Math.PI / 2 + (r() - 0.5) * 0.12);
			const ux = Math.cos(ang);
			const uy = Math.sin(ang);
			for (let off = -c.R; off <= c.R; off += c.sp * (0.8 + r() * 0.7)) {
				const nx = -uy;
				const ny = ux;
				let skip = 0;
				for (let t = -c.R; t <= c.R; t += 3.4 + r() * 1.6) {
					const x = c.x + ux * t + nx * off;
					const y = c.y + uy * t + ny * off;
					const ang2 = Math.atan2(y - c.y, x - c.x);
					const rr = c.R * (0.62 + 0.28 * Math.sin(2 * ang2 + c.p1) + 0.2 * Math.sin(3 * ang2 + c.p2) + 0.12 * Math.sin(5 * ang2 + c.p1 * 2));
					const d = Math.hypot(x - c.x, y - c.y) / Math.max(rr, 8);
					if (d > 1) continue;
					if (skip > 0) {
						skip--;
						continue;
					}
					if (r() < 0.015) skip = 3 + Math.floor(r() * 9);
					if (r() > 1 - Math.pow(d, 1.4) * 0.9) continue;
					pt(x + (r() - 0.5) * 0.8, y + (r() - 0.5) * 0.8, (0.35 + r() * 0.5) * alpha, 0.6 + r() * 0.6);
				}
			}
		}
	}

	// Small towns
	for (let i = 0; i < 75 * scale; i++) {
		const x = r() * W;
		const y = r() * H;
		const n = 6 + Math.floor(r() * 24);
		for (let k = 0; k < n; k++) pt(x + (r() - 0.5) * 26, y + (r() - 0.5) * 26, (0.2 + r() * 0.4) * alpha, 0.5 + r() * 0.5);
	}

	// Highways: bent chains between neighbouring cities, brighter and evenly spaced.
	const sorted = [...centers].sort((a, b) => a.x - b.x);
	for (let i = 0; i < sorted.length - 1; i++) {
		const a = sorted[i];
		const b = sorted[i + 1];
		const mx = (a.x + b.x) / 2 + (r() - 0.5) * 160;
		const my = (a.y + b.y) / 2 + (r() - 0.5) * 160;
		for (let t = 0; t <= 1; t += 0.004) {
			const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * mx + t * t * b.x;
			const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * my + t * t * b.y;
			if (Math.floor(t / 0.004) % 2) continue;
			// highways bridge the water, so draw even over water
			ctx.fillStyle = `rgba(255,226,170,${0.5 * alpha})`;
			ctx.beginPath();
			ctx.arc(x, y, 0.8, 0, 6.2832);
			ctx.fill();
		}
	}
	
	return { centers: centers.slice(0, pulses) };
}

function dayScene(a, b, c) {
	const r = rng(404);
	// Field patchwork seen through the haze.
	const fields = el("svg", { class: "field-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid slice" });
	const palette = ["#9fbf9a", "#c9cf9a", "#b7c98f", "#d8cfa5", "#8fb3a6", "#a8c2b0", "#c7c0a0"];
	const g = el("g", { transform: "rotate(-8 800 500)" }, fields);
	for (let x = -300; x < W + 300; ) {
		const w = 70 + r() * 150;
		for (let y = -300; y < H + 300; ) {
			const h = 50 + r() * 120;
			el("rect", { x: x.toFixed(0), y: y.toFixed(0), width: (w - 3).toFixed(0), height: (h - 3).toFixed(0), fill: palette[Math.floor(r() * palette.length)], opacity: (0.1 + r() * 0.2).toFixed(2) }, g);
			y += h;
		}
		x += w;
	}
	const l1 = div("pl-layer", b);
	l1.appendChild(fields);

	const cloudLayer = (cls, wcls, seed, n, rxMin, rxMax, alpha) => {
		const rr = rng(seed);
		const wrap = div(`pl-layer cloud-wrap ${wcls}`, c);
		const svg = el("svg", { class: `cloud-layer ${cls}`, viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid slice" }, wrap);
		for (let i = 0; i < n; i++) {
			const cx = rr() * W;
			const cy = rr() * H;
			const rx = rxMin + rr() * (rxMax - rxMin);
			// clustered puffs
			for (let k = 0; k < 4; k++) {
				el("ellipse", { cx: (cx + (rr() - 0.5) * rx).toFixed(0), cy: (cy + (rr() - 0.5) * rx * 0.3).toFixed(0), rx: (rx * (0.4 + rr() * 0.5)).toFixed(0), ry: (rx * (0.12 + rr() * 0.12)).toFixed(0), opacity: (alpha * (0.5 + rr() * 0.5)).toFixed(2) }, svg);
			}
		}
	};
	cloudLayer("c1", "w1", 11, 14, 160, 340, 0.6);
	cloudLayer("c2", "w2", 29, 8, 220, 420, 0.5);
}

export function activate({ root, reducedMotion }) {
	const dark = document.documentElement.classList.contains("dark");
	const a = root.querySelector(".scenery-a");
	const b = root.querySelector(".scenery-b");
	const c = root.querySelector(".scenery-c");
	const still = reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;

	if (!dark) {
		dayScene(a, b, c);
		return;
	}

	const far = div("pl-layer pl-far", b);
	const farCanvas = document.createElement("canvas");
	far.appendChild(farCanvas);
	drawCity(farCanvas, 5150, { cities: 9, scale: 0.7, alpha: 0.55, pulses: 0 });

	const near = div("pl-layer pl-near", b);
	const canvas = document.createElement("canvas");
	near.appendChild(canvas);
	const { centers } = drawCity(canvas, 9071, { cities: 7, scale: 1, alpha: 1, pulses: 7 });

	// A few lights that pulse, as aircraft beacons or towers would from above.
	const r = rng(77);
	for (const ctr of centers) {
		for (let k = 0; k < 2; k++) {
			const p = div("pulse", near);
			p.style.left = `${(((ctr.x + (r() - 0.5) * ctr.R * 0.8) / W) * 100).toFixed(2)}%`;
			p.style.top = `${(((ctr.y + (r() - 0.5) * ctr.R * 0.8) / H) * 100).toFixed(2)}%`;
			p.style.setProperty("--pd", `${(3 + r() * 4).toFixed(1)}s`);
			p.style.setProperty("--pdl", `${(-r() * 6).toFixed(1)}s`);
			if (still) p.style.opacity = "0.5";
		}
	}
}
