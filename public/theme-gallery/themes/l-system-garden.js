// L-system garden: stochastic bracketed L-systems rooted on the page edges. Segment angles are
// re-derived each frame from a wind field (ambient + scroll gusts + cursor wake), so branches bend
// as a chain. Click to plant, hold to coax blooms open.
import { mountCanvas, trackPointer, createLoop, makeButton, onScrollFrame, observeSize, hsl } from "./_wild/kit.js";

const RULESETS = [
	{ name: "bush", axiom: "F", rules: { F: ["FF-[-F+F+F]+[+F-F-F]"] }, angle: 22.5, iter: 3, taper: 0.8 },
	{ name: "weed", axiom: "X", rules: { X: ["F+[[X]-X]-F[-FX]+X"], F: ["FF"] }, angle: 25, iter: 4, taper: 0.78 },
	{
		name: "tree",
		axiom: "F",
		rules: { F: ["F[+F]F[-F]F", "F[+F]F", "F[-F]F", "FF[+F][-F]"] },
		angle: 24,
		iter: 4,
		taper: 0.84,
	},
	{ name: "reed", axiom: "F", rules: { F: ["F[+F]F[-F]", "FF[-F]", "F[+F]F"] }, angle: 11, iter: 4, taper: 0.9 },
];

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { context: "2d", maxDpr: 1.5 });
	const ctx = view.canvas.getContext("2d");
	let W = 2;
	let H = 2;
	let column = null;

	let seed = 90210 + ((Math.random() * 1e6) | 0);
	const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

	const stemColor = (h, d) => (dark ? `hsl(${h} 45% ${44 + d * 18}%)` : `hsl(${h} 32% ${26 + d * 20}%)`);
	const leafColor = (h) => (dark ? `hsl(${h} 70% 58%)` : `hsl(${h} 52% 40%)`);
	const FLOWERS = dark ? ["hsl(332 90% 72%)", "hsl(42 100% 68%)", "hsl(268 85% 78%)", "hsl(186 90% 66%)"] : ["hsl(346 80% 58%)", "hsl(34 96% 54%)", "hsl(268 56% 58%)", "hsl(200 82% 48%)"];

	// ---- L-system expansion -> segment arrays --------------------------------------------------
	function expand(rs) {
		let s = rs.axiom;
		for (let i = 0; i < rs.iter; i++) {
			let out = "";
			for (const ch of s) {
				const r = rs.rules[ch];
				out += r ? r[(rnd() * r.length) | 0] : ch;
			}
			if (out.length > 5200) break;
			s = out;
		}
		return s;
	}

	function buildPlant(rs, { x, y, angle0, size, hue, born, flower }) {
		const str = expand(rs);
		const ang = (rs.angle * Math.PI) / 180;
		const parent = [];
		const rel = [];
		const lenArr = [];
		const depth = [];
		const level = [];
		const stack = [];
		let node = -1;
		let rot = angle0;
		let lvl = 0;
		for (const ch of str) {
			if (ch === "F") {
				const i = parent.length;
				parent.push(node);
				rel.push(rot + (rnd() - 0.5) * 0.12);
				depth.push(node < 0 ? 0 : depth[node] + 1);
				level.push(lvl);
				lenArr.push(Math.pow(rs.taper, lvl * 0.6) * (0.85 + rnd() * 0.3));
				node = i;
				rot = 0;
			} else if (ch === "+") rot += ang * (0.8 + rnd() * 0.4);
			else if (ch === "-") rot -= ang * (0.8 + rnd() * 0.4);
			else if (ch === "[") {
				stack.push([node, rot]);
				lvl++;
			} else if (ch === "]") {
				const st = stack.pop();
				if (st) {
					node = st[0];
					rot = st[1];
				}
				lvl--;
			}
		}
		const n = parent.length;
		const sub = new Float32Array(n).fill(1);
		const kids = new Uint8Array(n);
		for (let i = n - 1; i > 0; i--) {
			if (parent[i] >= 0) {
				sub[parent[i]] += sub[i];
				kids[parent[i]]++;
			}
		}
		// rest geometry to find extent
		const ex = new Float32Array(n);
		const ey = new Float32Array(n);
		const ea = new Float32Array(n);
		let maxR = 1e-6;
		let maxDepth = 0;
		for (let i = 0; i < n; i++) {
			const p = parent[i];
			const a = (p < 0 ? 0 : ea[p]) + rel[i];
			const px = p < 0 ? 0 : ex[p];
			const py = p < 0 ? 0 : ey[p];
			ex[i] = px + Math.sin(a) * lenArr[i];
			ey[i] = py - Math.cos(a) * lenArr[i];
			ea[i] = a;
			maxR = Math.max(maxR, Math.hypot(ex[i], ey[i]));
			maxDepth = Math.max(maxDepth, depth[i]);
		}
		const k = size / maxR;
		const len = new Float32Array(n);
		const width = new Float32Array(n);
		const rootSub = sub[0];
		for (let i = 0; i < n; i++) {
			len[i] = lenArr[i] * k;
			width[i] = (0.8 + 4.2 * Math.sqrt(sub[i] / rootSub)) * Math.min(1.5, 0.6 + size / 300);
		}
		// leaves on tips and the thin twigs near them; flowers on a few tips
		const leaf = new Uint8Array(n);
		const bloom = new Uint8Array(n);
		for (let i = 0; i < n; i++) {
			if (kids[i] === 0) {
				leaf[i] = 1;
				if (flower && depth[i] > maxDepth * 0.45 && rnd() < 0.1) bloom[i] = 1;
			} else if (sub[i] < 9 && rnd() < 0.6) leaf[i] = 2;
		}
		return {
			x, y, n, parent: Int32Array.from(parent), rel: Float32Array.from(rel), len, width, depth: Int32Array.from(depth), maxDepth,
			leaf, bloom, ex: new Float32Array(n), ey: new Float32Array(n), ea: new Float32Array(n),
			hue, born, growth: 0, grow: true, awake: 0, bloomAmt: 0.55, flowerIdx: (rnd() * FLOWERS.length) | 0, size,
			phaseSeed: rnd() * 6.28, alive: 1, dying: false, user: false,
		};
	}

	// ---- layout -----------------------------------------------------------------------------
	let plants = [];
	function layout() {
		plants = [];
		seed = 90210;
		const S = Math.min(1.25, Math.max(0.55, H / 800));
		const page = root.querySelector(".site-page");
		const lr = layer.getBoundingClientRect();
		if (page && W > 980) {
			const pr = page.getBoundingClientRect();
			column = { l: pr.left - lr.left + 30, r: pr.right - lr.left - 30 };
		} else column = null;
		let order = 0;
		const add = (o) => plants.push(buildPlant(RULESETS[(rnd() * RULESETS.length) | 0], { ...o, born: order++ * 0.28, flower: true }));
		// bottom edge: spaced in the margins (or across, on narrow screens)
		const zones = column ? [[8, column.l - 10], [column.r + 10, W - 8]] : [[8, W - 8]];
		for (const [a, b] of zones) {
			const count = Math.max(2, Math.round((b - a) / 80));
			for (let i = 0; i < count; i++) {
				const px = a + ((i + 0.5 + (rnd() - 0.5) * 0.7) / count) * (b - a);
				add({ x: px, y: H + 6, angle0: (rnd() - 0.5) * 0.5, size: (150 + rnd() * 230) * S, hue: 120 + rnd() * 70 });
			}
		}
		// side edges: vines reaching inward
		const sideCount = Math.max(2, Math.round(H / 230));
		for (let i = 0; i < sideCount; i++) {
			const py = ((i + 0.4 + rnd() * 0.5) / sideCount) * H * 0.82;
			add({ x: -6, y: py, angle0: 1.15 + rnd() * 0.35, size: (120 + rnd() * 150) * S, hue: 135 + rnd() * 60 });
			add({ x: W + 6, y: py + 80 * rnd(), angle0: -1.15 - rnd() * 0.35, size: (120 + rnd() * 150) * S, hue: 135 + rnd() * 60 });
		}
		if (reducedMotion) for (const p of plants) p.growth = 1;
	}

	// ---- wind ---------------------------------------------------------------------------------
	let scrollGust = 0;
	let lastScroll = root.scrollTop;
	let ptrVx = 0;
	let ptrVy = 0;
	let held = false;
	const ptr = trackPointer(layer, {
		onDown: (p, e) => {
			if (reducedMotion || e.target.closest?.("button, input")) return;
			held = true;
		},
		onUp: (p, e) => {
			const wasHeld = held;
			held = false;
			if (wasHeld && !reducedMotion && p.inside && !ptr.dragged) plantAt(p.x, p.y);
			ptr.dragged = false;
		},
		onMove: (p) => {
			if (held && Math.hypot(p.dx, p.dy) > 6) ptr.dragged = true;
		},
	});

	const pollen = [];
	function plantAt(px, py) {
		const dl = px;
		const dr = W - px;
		const db = H - py;
		const m = Math.min(dl, dr, db);
		const S = Math.min(1.25, Math.max(0.55, H / 800));
		const o = { size: (120 + rnd() * 170) * S, hue: 110 + rnd() * 80, born: 0, flower: true };
		let p;
		if (m === db) p = buildPlant(RULESETS[(rnd() * 4) | 0], { ...o, x: px, y: H + 6, angle0: (rnd() - 0.5) * 0.4 });
		else if (m === dl) p = buildPlant(RULESETS[(rnd() * 4) | 0], { ...o, x: -6, y: py, angle0: 1.2 });
		else p = buildPlant(RULESETS[(rnd() * 4) | 0], { ...o, x: W + 6, y: py, angle0: -1.2 });
		p.user = true;
		p.awake = 1;
		p.growth = 0;
		p.bloomAmt = 0.9;
		plants.push(p);
		// cap user plants
		const users = plants.filter((q) => q.user);
		if (users.length > 6) users[0].dying = true;
		for (let i = 0; i < 26; i++) {
			const a = rnd() * 6.283;
			pollen.push({ x: p.x < 0 ? 0 : p.x > W ? W : p.x, y: Math.min(py, H), vx: Math.cos(a) * (0.4 + rnd() * 1.6), vy: Math.sin(a) * (0.4 + rnd() * 1.4) - 0.8, life: 1, hue: 40 + rnd() * 300 });
		}
		if (reducedMotion) {
			p.growth = 1;
			draw(2.4, 0);
		}
	}

	// ---- per-frame solve + draw -----------------------------------------------------------------
	function solve(p, t) {
		const { n, parent, rel, len, depth, ex, ey, ea } = p;
		const g = p.growth * (p.maxDepth + 3);
		const amp = (reducedMotion ? 0.5 : 0.78) + 0.25 * Math.sin(t * 0.17 + p.phaseSeed);
		const gust = Math.max(0, Math.sin(t * 0.37 + p.phaseSeed * 0.3)) ** 3 * 0.9 + scrollGust;
		const kill = p.dying ? p.alive : 1;
		for (let i = 0; i < n; i++) {
			const pi = parent[i];
			const sx = pi < 0 ? p.x : ex[pi];
			const sy = pi < 0 ? p.y : ey[pi];
			const a0 = pi < 0 ? 0 : ea[pi];
			const s = Math.min(1, Math.max(0, g - depth[i])) * kill;
			const d = depth[i] / (p.maxDepth + 1);
			// wind: travelling waves in x with slower swells in y
			let w = Math.sin(t * 0.85 + sx * 0.006 + sy * 0.003 + p.phaseSeed) * amp;
			w += Math.sin(t * 2.1 + sx * 0.013) * amp * 0.35 * d;
			w += (gust + Math.sin(t * 1.3 + sx * 0.004) * 0.15) * (1 + d);
			if (ptr.seen && !reducedMotion) {
				const dx = sx - ptr.x;
				const dy = sy - ptr.y;
				const d2 = dx * dx + dy * dy;
				if (d2 < 36000) w += Math.exp(-d2 / 9000) * (ptrVx * 0.9 + (dy > 0 ? ptrVy : -ptrVy) * 0.15) * 3.2;
			}
			const flex = 0.016 + 0.034 * d + (len[i] < 6 ? 0.01 : 0);
			const a = a0 + rel[i] + w * flex * (1 + len[i] * 0.01);
			ea[i] = a;
			ex[i] = sx + Math.sin(a) * len[i] * s;
			ey[i] = sy - Math.cos(a) * len[i] * s;
		}
		return g;
	}

	function drawPlant(p, t, g) {
		const { n, parent, depth, width, ex, ey, ea, leaf, bloom } = p;
		const alpha = (dark ? 0.5 : 0.55) + p.awake * 0.45;
		const kill = p.dying ? p.alive : 1;
		ctx.lineCap = "round";
		// stems by width bucket
		const BUCKETS = [1.3, 2.2, 3.4, 7];
		for (let b = 0; b < BUCKETS.length; b++) {
			const lo = b === 0 ? 0 : BUCKETS[b - 1];
			ctx.beginPath();
			let any = false;
			for (let i = 0; i < n; i++) {
				const w = width[i];
				if (w < lo || w >= BUCKETS[b]) continue;
				const s = g - depth[i];
				if (s <= 0) continue;
				const pi = parent[i];
				ctx.moveTo(pi < 0 ? p.x : ex[pi], pi < 0 ? p.y : ey[pi]);
				ctx.lineTo(ex[i], ey[i]);
				any = true;
			}
			if (!any) continue;
			ctx.lineWidth = Math.min(BUCKETS[b], (lo + BUCKETS[b]) / 2 + 0.1) * (0.6 + 0.4 * Math.min(1, p.growth * 2));
			ctx.strokeStyle = stemColor(p.hue, b / 3);
			ctx.globalAlpha = alpha * kill;
			ctx.stroke();
		}
		// leaves
		ctx.beginPath();
		const leafLen = Math.max(7, p.size / 15);
		let leaves = 0;
		for (let i = 0; i < n; i++) {
			if (!leaf[i] || bloom[i]) continue;
			const s = Math.min(1, Math.max(0, g - depth[i] - 0.4)) * kill;
			if (s <= 0) continue;
			const a = ea[i] + (leaf[i] === 2 ? 0.9 : 0);
			const x = ex[i];
			const y = ey[i];
			const L = leafLen * s * (leaf[i] === 2 ? 0.8 : 1);
			const wd = L * 0.42;
			const ux = Math.sin(a);
			const uy = -Math.cos(a);
			ctx.moveTo(x, y);
			ctx.quadraticCurveTo(x + ux * L * 0.5 - uy * wd, y + uy * L * 0.5 + ux * wd, x + ux * L, y + uy * L);
			ctx.quadraticCurveTo(x + ux * L * 0.5 + uy * wd, y + uy * L * 0.5 - ux * wd, x, y);
			leaves++;
		}
		if (leaves) {
			ctx.fillStyle = leafColor(p.hue + 8);
			ctx.globalAlpha = alpha * (dark ? 0.8 : 0.75);
			ctx.fill();
		}
		// flowers
		const bl = p.bloomAmt;
		for (let i = 0; i < n; i++) {
			if (!bloom[i]) continue;
			const s = Math.min(1, Math.max(0, g - depth[i] - 0.8)) * kill;
			if (s <= 0.02) continue;
			const r = (3.4 + p.size / 48) * s * (0.6 + bl * 0.9);
			const x = ex[i];
			const y = ey[i];
			const spin = t * 0.2 + i;
			ctx.fillStyle = FLOWERS[(p.flowerIdx + i) % FLOWERS.length];
			ctx.globalAlpha = Math.min(1, alpha * 0.95 + 0.1);
			ctx.beginPath();
			const petals = 5 + ((i % 3) | 0);
			for (let k = 0; k < petals; k++) {
				const a = spin + (k / petals) * 6.283;
				const cx = x + Math.cos(a) * r * 0.95;
				const cy = y + Math.sin(a) * r * 0.95;
				ctx.moveTo(cx + r * 0.62, cy);
				ctx.arc(cx, cy, r * 0.62, 0, 6.283);
			}
			ctx.fill();
			ctx.fillStyle = dark ? "hsl(48 100% 88%)" : "hsl(44 95% 62%)";
			ctx.beginPath();
			ctx.arc(x, y, r * 0.45, 0, 6.283);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	function draw(t, dt) {
		ctx.clearRect(0, 0, W, H);
		ctx.globalCompositeOperation = "source-over";
		for (const p of plants) {
			const g = solve(p, t);
			drawPlant(p, t, g);
		}
		// pollen
		if (pollen.length) {
			ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
			for (let i = pollen.length - 1; i >= 0; i--) {
				const q = pollen[i];
				q.x += q.vx;
				q.y += q.vy;
				q.vx *= 0.985;
				q.vy = q.vy * 0.985 - 0.012;
				q.life -= 0.01 * Math.max(0.3, dt * 60);
				if (q.life <= 0) {
					pollen.splice(i, 1);
					continue;
				}
				ctx.globalAlpha = q.life * 0.9;
				ctx.fillStyle = dark ? `hsl(${q.hue} 100% 72%)` : `hsl(${q.hue} 85% 52%)`;
				ctx.beginPath();
				ctx.arc(q.x, q.y, 1.4 + q.life * 1.6, 0, 6.283);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = "source-over";
		}
	}

	function resize() {
		view.fit();
		W = view.cssW;
		H = view.cssH;
		ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
		layout();
	}

	// ---- boot ---------------------------------------------------------------------------------
	resize();
	const button = makeButton(root, reducedMotion ? "plant a seedling" : "click to plant · move to stir", {
		title: "Click the margins to plant, hold near plants to open blooms, move the pointer to make wind",
	});
	button.addEventListener("click", () => {
		const edge = rnd();
		plantAt(edge < 0.5 ? 30 + rnd() * W * 0.3 : W - 30 - rnd() * W * 0.3, H - 10);
	});

	let loop = null;
	let stopScroll = () => {};
	if (reducedMotion) {
		draw(2.4, 0);
	} else {
		let prevPx = 0;
		let prevPy = 0;
		loop = createLoop(
			(dt, t) => {
				// wind inputs
				const sv = root.scrollTop - lastScroll;
				lastScroll = root.scrollTop;
				scrollGust += (Math.max(-1.2, Math.min(1.2, sv * 0.03)) - scrollGust) * 0.12;
				scrollGust *= 0.96;
				const mvx = ptr.seen ? ptr.x - prevPx : 0;
				const mvy = ptr.seen ? ptr.y - prevPy : 0;
				prevPx = ptr.x;
				prevPy = ptr.y;
				ptrVx += (Math.max(-40, Math.min(40, mvx)) * 0.07 - ptrVx) * 0.25;
				ptrVy += (Math.max(-40, Math.min(40, mvy)) * 0.07 - ptrVy) * 0.25;
				for (let i = plants.length - 1; i >= 0; i--) {
					const p = plants[i];
					const wait = p.born;
					if (p.grow && t > wait) p.growth = Math.min(1, p.growth + dt / (p.user ? 3.2 : 4.5));
					// awakening near the cursor
					let target = 0;
					if (ptr.seen && ptr.inside) {
						const d = Math.hypot(ptr.x - p.x, ptr.y - (p.y - p.size * 0.5));
						target = Math.max(0, 1 - d / (p.size * 1.4 + 120));
					}
					p.awake += (target - p.awake) * 0.07;
					p.bloomAmt += ((held && target > 0.2 ? 1.5 : 0.55 + p.awake * 0.5) - p.bloomAmt) * 0.06;
					if (p.dying) {
						p.alive -= dt * 0.7;
						if (p.alive <= 0) plants.splice(i, 1);
					}
				}
				draw(t, dt);
			},
			{ maxDt: 0.05 },
		);
		stopScroll = onScrollFrame(root, () => {});
	}
	const stopSize = observeSize(layer, () => {
		const w0 = W;
		const h0 = H;
		view.fit();
		if (Math.abs(view.cssW - w0) > 4 || Math.abs(view.cssH - h0) > 4) {
			W = view.cssW;
			H = view.cssH;
			ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
			const was = plants.map((p) => p.growth).reduce((a, b) => Math.min(a, b), 1);
			layout();
			if (was > 0.99) for (const p of plants) p.growth = 1;
			if (reducedMotion) draw(2.4, 0);
		}
	});

	return () => {
		loop?.stop();
		stopScroll();
		stopSize();
		ptr.destroy();
		view.destroy();
		button.remove();
	};
}
