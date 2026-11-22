// #285 Season Edges: #93 seasons in the side margins. Scroll turns trees through winter, spring,
// summer and autumn (pre-painted sprites crossfaded by opacity); winter brings a soft aurora.
import { makePineVariants } from "./forest-kit/kit.js";
import { addAurora, canvasAt, clamp, disposer, el, glowSprite, hex, lerp, mix, pointer, rgba, rng, scrollT, ticker, TAU } from "./_medium-b/kit.js";

const SEASONS = [
	{ name: "winter", pine: "#6f8a9c", crown: ["#7a8494", "#6b7686", "#8a93a2"], ground: "#e8f0f8", snow: true },
	{ name: "spring", pine: "#4a8a6c", crown: ["#9fd08a", "#b9e09e", "#f2bdd4"], ground: "#a8d498" },
	{ name: "summer", pine: "#2d6a52", crown: ["#4c9858", "#3b864c", "#66ab66"], ground: "#6fae74" },
	{ name: "autumn", pine: "#3a6a56", crown: ["#e08a2e", "#c8532c", "#e8b83e"], ground: "#c8a468" },
];

export function activate({ root, mode, reducedMotion }) {
	const d = disposer();
	const dark = mode === "dark";
	const sceneryA = root.querySelector(".scenery-a");
	const overlay = root.querySelector(".overlay-a");
	if (!sceneryA || !overlay) return;
	const layer = el(sceneryA, "inset:0;overflow:hidden");
	const winterAur = addAurora(d, root, { dark, reduced: reducedMotion, height: "56%", intensity: dark ? 1.05 : 1.1, top: 0.96, opacity: 1 });

	let sides = [], parts = [], W = 0, H = 0, EW = 0, y = 0, kind = 0;
	const r = rng(285);

	function treeSprite(x, s, side, w, h, seed) {
		const R = rng(seed);
		const night = (c) => (dark ? mix(c, [10, 22, 48], 0.5) : mix(c, [255, 255, 255], 0.1));
		const col = (hx, depth) => rgba(mix(night(hex(hx)), dark ? [14, 24, 48] : [226, 236, 244], depth * 0.35 + (dark ? 0 : 0.18)));
		const VARS = makePineVariants(285 + seed % 5, 6);
		const flip = (px) => (side ? w - px : px);
		const groundC = night(hex(s.ground));
		// ground mound
		const gy = h - h * 0.05;
		x.fillStyle = rgba(groundC, s.snow ? 0.9 : 0.78);
		x.beginPath(); x.moveTo(0, h);
		for (let i = 0; i <= w; i += 6) x.lineTo(i, gy + Math.sin((i + seed) * 0.05) * 6 + (flip(i) / w) * h * 0.04);
		x.lineTo(w, h); x.fill();
		const trees = [];
		const n = 6;
		for (let i = 0; i < n; i++) {
			const u = i / (n - 1); // 0 outer edge .. 1 inner
			trees.push({ v: i + seed, px: lerp(w * 0.04, w * 0.86, Math.pow(u, 1.1)) + (R() - 0.5) * 20, h: h * lerp(0.5, 0.2, Math.pow(u, 0.8)) * (0.85 + R() * 0.3), depth: u, decid: i % 2 === 1 });
		}
		trees.sort((a, b) => b.depth - a.depth);
		for (const t of trees) {
			const px = flip(t.px), by = h - h * 0.015 - t.depth * h * 0.025 - R() * 8;
			
			if (!t.decid) {
				const poly = VARS[(t.v) % VARS.length], sw = t.h * 0.62;
				const trace = (dy) => { x.beginPath(); x.moveTo(px + poly[0] * sw, by + poly[1] * t.h + dy); for (let k = 2; k < poly.length; k += 2) x.lineTo(px + poly[k] * sw, by + poly[k + 1] * t.h + dy); x.closePath(); x.fill(); };
				if (s.snow) { x.fillStyle = rgba(dark ? [190, 208, 232] : [252, 253, 255], 1); trace(-t.h * 0.045); }
				x.fillStyle = col(s.pine, t.depth); trace(0);
			} else if (s.snow) {
				// bare branching tree
				x.strokeStyle = col(s.crown[0], t.depth); x.lineCap = "round";
				const grow = (x0, y0, a, len, wd, dd) => {
					const x1 = x0 + Math.sin(a) * len, y1 = y0 - Math.cos(a) * len;
					x.lineWidth = wd; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
					if (dd >= 4) return;
					const kids = dd === 0 ? 3 : 2;
					for (let k = 0; k < kids; k++) grow(x1, y1, a + (k - (kids - 1) / 2) * (0.7 + R() * 0.4), len * 0.7, wd * 0.66, dd + 1);
				};
				grow(px, by, (R() - 0.5) * 0.1, t.h * 0.34, Math.max(2, t.h * 0.03), 0);
			} else {
				x.fillStyle = rgba(night(hex("#6a5a4a")), 1);
				x.fillRect(px - t.h * 0.02, by - t.h * 0.45, t.h * 0.04, t.h * 0.45);
				const cy = by - t.h * 0.6, rr = t.h * 0.2;
				for (let k = 0; k < 9; k++) {
					const a = R() * TAU, dd = Math.sqrt(R()) * rr;
					x.fillStyle = col(s.crown[k % 3 === 2 && R() < 0.5 ? 2 : k % 2], t.depth);
					x.beginPath(); x.arc(px + Math.cos(a) * dd, cy + Math.sin(a) * dd * 0.9, rr * (0.45 + R() * 0.25), 0, TAU); x.fill();
				}
			}
		}
		x.globalAlpha = 1;
	}

	function build() {
		W = root.clientWidth; H = root.clientHeight;
		if (!W || !H) return;
		EW = Math.round(clamp((W - 832) / 2 + 36, 56, 300));
		layer.textContent = ""; overlay.querySelectorAll(".mse").forEach((n) => n.remove());
		sides = [];
		for (let side = 0; side < 2; side++) {
			const pos = side ? "right:0" : "left:0";
			const wrap = el(layer, `${pos};top:0;width:${EW}px;height:100%;will-change:opacity`);
			const cvs = SEASONS.map((s, i) => {
				const c = canvasAt(wrap, "left:0;top:0;opacity:0;will-change:opacity", EW, H);
				c.i = i; c.painted = false; c.side = side; return c;
			});
			const pc = canvasAt(overlay, `${pos};top:0;`, EW, H, 0.75);
			pc.c.classList.add("mse");
			sides.push({ cvs, pc });
		}
		paint(0);
		const rest = () => { for (const sd of sides) for (const c of sd.cvs) paint(c.i, sd); };
		(window.requestIdleCallback || ((f) => setTimeout(f, 60)))(rest);
		parts = [];
		const count = clamp(Math.round(H / 20), 20, 44);
		for (let i = 0; i < count * 2; i++) parts.push(spawn(i % 2, true));
		update();
	}
	function paint(i, only) {
		for (const sd of only ? [only] : sides) {
			const c = sd.cvs[i];
			if (c.painted) continue;
			c.painted = true;
			c.x.clearRect(0, 0, EW, H);
			treeSprite(c.x, SEASONS[i], c.side, EW, H, 285 + c.side * 31 + i * 7);
		}
	}
	function spawn(side, first) {
		return { side, x: r() * EW, y: first ? r() * H : -10, vy: 0, vx: 0, ph: r() * 6.28, s: 0.6 + r() * 1, k: r() };
	}

	const flySprite = glowSprite(dark ? [214, 255, 120] : [232, 160, 20]);
	function drawParts(t) {
		for (const sd of sides) { sd.pc.x.clearRect(0, 0, EW, H); }
		for (const p of parts) {
			const x = sides[p.side].pc.x;
			if (kind === 0) { // snow
				x.fillStyle = dark ? "rgba(225,236,255,.85)" : "rgba(160,184,214,.85)";
				x.beginPath(); x.arc(p.x, p.y, 1 + p.s * 0.9, 0, TAU); x.fill();
			} else if (kind === 1) { // blossom petals
				x.fillStyle = dark ? "rgba(246,190,214,.85)" : "rgba(238,150,186,.9)";
				x.beginPath(); x.ellipse(p.x, p.y, 2.6 * p.s, 1.4 * p.s, p.ph + t * 1.5, 0, TAU); x.fill();
			} else if (kind === 2) { // fireflies
				const b = reducedMotion ? 0.7 : Math.pow(Math.max(0, Math.sin(t * (0.5 + p.k * 0.6) + p.ph)), 3) * 0.85 + 0.15;
				x.globalAlpha = (dark ? 0.9 : 0.8) * b;
				const sz = 9 + p.s * 7; x.drawImage(flySprite, p.x - sz, p.y - sz, sz * 2, sz * 2); x.globalAlpha = 1;
			} else { // leaves
				x.fillStyle = ["#e08a2e", "#c8532c", "#e8b83e"][(p.k * 3) | 0];
				x.beginPath(); x.ellipse(p.x, p.y, 3.4 * p.s, 1.8 * p.s, p.ph + t * 2, 0, TAU); x.fill();
			}
		}
	}
	function stepParts(dt, t) {
		for (const p of parts) {
			if (kind === 2) { // fireflies hang around the lower margin
				p.vx += (Math.cos(t * 0.6 + p.ph) * 14 - p.vx) * dt; p.vy += (Math.sin(t * 0.5 + p.ph * 1.7) * 12 - p.vy) * dt;
				p.x += p.vx * dt; p.y += p.vy * dt - 2 * dt;
				if (p.y < H * 0.35) p.y = H * 0.95; if (p.y > H) p.y = H * 0.45;
				if (p.x < 0) p.x = EW; if (p.x > EW) p.x = 0;
			} else {
				const fall = kind === 0 ? 22 + p.s * 14 : kind === 1 ? 20 + p.s * 10 : 26 + p.s * 12;
				p.y += fall * dt; p.x += (Math.sin(t * 0.9 + p.ph) * 14 + 6) * dt;
				if (p.y > H + 8) { p.y = -8; p.x = r() * EW; }
				if (p.x > EW + 8) p.x = -8;
			}
		}
	}

	function update() {
		if (!sides.length) return;
		const yy = y * 4, a = Math.floor(yy) % 4, b = (a + 1) % 4, f = yy - Math.floor(yy);
		for (const sd of sides) sd.cvs.forEach((c, i) => {
			const on = i === a ? 1 : i === b ? f : 0;
			c.c.style.opacity = on; c.c.style.zIndex = i === b ? 2 : 1;
			if (on > 0 && !c.painted) paint(i, sd);
		});
		const nearest = f > 0.5 ? b : a;
		// winter weight: 0 = winter(0/4), peaks at top and bottom of the page
		const wint = Math.max(0, 1 - Math.abs(yy)) + Math.max(0, 1 - Math.abs(yy - 4));
		winterAur.setOpacity(clamp(0.12 + wint * 0.95, 0, 1));
		// SEASONS order is winter, spring, summer, autumn
		const nk = [0, 1, 2, 3][nearest];
		if (nk !== kind) { kind = nk; if (reducedMotion) drawParts(2); else loop.wake(); }
	}
	let loop = { wake() {} };
	scrollT(d, root, (v) => { y = v; update(); });
	if (!reducedMotion) {
		loop = ticker(d, (dt, t) => { stepParts(dt, t); drawParts(t); return true; }, { fps: 30, el: layer });
	}
	const ro = new ResizeObserver(() => { clearTimeout(ro.t); ro.t = setTimeout(build, 120); });
	ro.observe(root);
	d.add(() => { ro.disconnect(); clearTimeout(ro.t); layer.remove(); overlay.querySelectorAll(".mse").forEach((n) => n.remove()); });
	build();
	if (reducedMotion) drawParts(2); else loop.wake();
	return () => d.run();
}
