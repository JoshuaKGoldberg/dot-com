// Wave function collapse circuit board. The tileset is every combination of four edge types
// (none / trace / bus) plus a chip tile, so propagation reduces to per-edge masks. The lowest-entropy
// cell is collapsed next, so traces keep following their neighbours. Click to re-collapse a patch
// around the pointer (a chip is seeded there) and send a signal pulse racing along the traces.
import { mountCanvas, trackPointer, createLoop, makeButton, observeSize } from "./_wild/kit.js";

// ---- tileset ---------------------------------------------------------------------------------
const DIRS = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
]; // N E S W
const TILES = [];
for (let n = 0; n < 3; n++)
	for (let e = 0; e < 3; e++)
		for (let s = 0; s < 3; s++)
			for (let w = 0; w < 3; w++) {
				const edges = [n, e, s, w];
				const nz = edges.filter(Boolean);
				const deg = nz.length;
				const types = new Set(nz);
				const mixed = types.size > 1;
				const straight = deg === 2 && ((n && s && !e && !w) || (e && w && !n && !s));
				let weight;
				if (deg === 0) weight = 5.5;
				else if (mixed) {
					const cross = deg === 4 && n === s && e === w;
					weight = cross ? 0.55 : 0.05;
				} else if (deg === 1) weight = 0.45;
				else if (deg === 2) weight = straight ? 3.2 : 2.1;
				else if (deg === 3) weight = 0.55;
				else weight = 0.3;
				if (!mixed && types.has(2)) weight *= 0.55;
				TILES.push({ e: edges, w: weight, deg, straight, mixed, chip: false });
			}
TILES.push({ e: [1, 1, 1, 1], w: 0.55, deg: 4, straight: false, mixed: false, chip: true });
const T = TILES.length;
const CHIP = T - 1;

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { context: "2d", maxDpr: 1.5 });
	const ctx = view.canvas.getContext("2d");

	const C = dark
		? { thin: "hsl(166 85% 56%)", bus: "hsl(196 90% 62%)", chip: "hsl(38 100% 62%)", pulse: "hsl(48 100% 76%)" }
		: { thin: "hsl(170 62% 27%)", bus: "hsl(205 62% 36%)", chip: "hsl(24 82% 46%)", pulse: "hsl(14 92% 52%)" };

	let W = 2;
	let H = 2;
	let cell = 30;
	let cols = 1;
	let rows = 1;
	let ox = 0;
	let oy = 0;
	let tile; // Int16Array, -1 = uncollapsed
	let mask; // Uint16Array: 4 dirs x 3 bits of allowed edge values
	let ent; // Float32Array entropy
	let bright; // Float32Array flash
	let dist; // Int16Array pulse distances
	let col = null;
	const FULL = 0b111_111_111_111;

	const idx = (x, y) => y * cols + x;

	function domainStats(c) {
		const m = mask[c];
		let sw = 0;
		let swl = 0;
		let count = 0;
		for (let t = 0; t < T; t++) {
			const e = TILES[t].e;
			if ((m >> (e[0])) & 1 && (m >> (3 + e[1])) & 1 && (m >> (6 + e[2])) & 1 && (m >> (9 + e[3])) & 1) {
				const w = TILES[t].w;
				sw += w;
				swl += w * Math.log(w);
				count++;
			}
		}
		return [sw, swl, count];
	}

	function refreshEntropy(c) {
		if (tile[c] >= 0) {
			ent[c] = 1e9;
			return;
		}
		const [sw, swl] = domainStats(c);
		ent[c] = Math.log(sw) - swl / sw + Math.random() * 0.02;
	}

	function collapseCell(c, forced = -1) {
		let pick = forced;
		if (pick < 0) {
			const m = mask[c];
			let total = 0;
			const ok = [];
			for (let t = 0; t < T; t++) {
				const e = TILES[t].e;
				if ((m >> e[0]) & 1 && (m >> (3 + e[1])) & 1 && (m >> (6 + e[2])) & 1 && (m >> (9 + e[3])) & 1) {
					ok.push(t);
					total += TILES[t].w;
				}
			}
			let r = Math.random() * total;
			pick = ok[ok.length - 1];
			for (const t of ok) {
				r -= TILES[t].w;
				if (r <= 0) {
					pick = t;
					break;
				}
			}
		}
		tile[c] = pick;
		bright[c] = 1;
		ent[c] = 1e9;
		const x = c % cols;
		const y = (c / cols) | 0;
		const e = TILES[pick].e;
		for (let d = 0; d < 4; d++) {
			const nx = x + DIRS[d][0];
			const ny = y + DIRS[d][1];
			if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
			const nc = idx(nx, ny);
			if (tile[nc] >= 0) continue;
			const back = (d + 2) % 4;
			// neighbour's facing edge must equal this tile's edge value
			mask[nc] = (mask[nc] & ~(0b111 << (back * 3))) | ((1 << e[d]) << (back * 3));
			refreshEntropy(nc);
		}
	}

	function seedConstraints(c) {
		// recompute a cell's mask from its collapsed neighbours (used after clearing a region)
		const x = c % cols;
		const y = (c / cols) | 0;
		let m = FULL;
		for (let d = 0; d < 4; d++) {
			const nx = x + DIRS[d][0];
			const ny = y + DIRS[d][1];
			if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
				// board edge: no traces leave the board
				m = (m & ~(0b111 << (d * 3))) | (1 << (d * 3));
				continue;
			}
			const nc = idx(nx, ny);
			if (tile[nc] >= 0) {
				const back = (d + 2) % 4;
				m = (m & ~(0b111 << (d * 3))) | ((1 << TILES[tile[nc]].e[back]) << (d * 3));
			}
		}
		mask[c] = m;
	}

	let remaining = 0;
	function pickNext() {
		let best = 1e9;
		let bi = -1;
		for (let c = 0; c < tile.length; c++) {
			if (tile[c] < 0 && ent[c] < best) {
				best = ent[c];
				bi = c;
			}
		}
		return bi;
	}

	function reset() {
		cols = Math.ceil(W / cell) + 1;
		rows = Math.ceil(H / cell) + 1;
		ox = (W - (cols - 1) * cell) / 2;
		oy = (H - (rows - 1) * cell) / 2;
		const n = cols * rows;
		tile = new Int16Array(n).fill(-1);
		mask = new Uint16Array(n).fill(FULL);
		ent = new Float32Array(n);
		bright = new Float32Array(n);
		dist = new Int16Array(n).fill(-1);
		for (let c = 0; c < n; c++) seedConstraints(c);
		for (let c = 0; c < n; c++) refreshEntropy(c);
		remaining = n;
	}

	function regenerate(px, py) {
		const cx = Math.round((px - ox) / cell);
		const cy = Math.round((py - oy) / cell);
		const R = 6.5;
		const touched = [];
		for (let y = Math.max(0, cy - 7); y <= Math.min(rows - 1, cy + 7); y++)
			for (let x = Math.max(0, cx - 7); x <= Math.min(cols - 1, cx + 7); x++) {
				if (Math.hypot(x - cx, y - cy) <= R) {
					const c = idx(x, y);
					tile[c] = -1;
					touched.push(c);
				}
			}
		for (const c of touched) seedConstraints(c);
		for (const c of touched) refreshEntropy(c);
		// neighbours of the patch keep their tile but it's already encoded in the masks above
		remaining = 0;
		for (let c = 0; c < tile.length; c++) if (tile[c] < 0) remaining++;
		// seed a chip in the middle
		const mc = idx(Math.min(cols - 1, Math.max(0, cx)), Math.min(rows - 1, Math.max(0, cy)));
		const m = mask[mc];
		if (((m >> 1) & 1 || (m & 0b10) !== 0) && true) {
			// chip needs all edges = 1 allowed; only force when compatible
			if ((m & 0b010) && (m & 0b010_000) && (m & 0b010_000_000) && (m & 0b010_000_000_000)) {
				collapseCell(mc, CHIP);
				remaining--;
			}
		}
	}

	// ---- pulse -------------------------------------------------------------------------------
	let pulse = null; // {t, max}
	function startPulse(px, py) {
		const cx = Math.round((px - ox) / cell);
		const cy = Math.round((py - oy) / cell);
		dist.fill(-1);
		// nearest traced cell
		let start = -1;
		let bestD = 1e9;
		for (let y = Math.max(0, cy - 5); y <= Math.min(rows - 1, cy + 5); y++)
			for (let x = Math.max(0, cx - 5); x <= Math.min(cols - 1, cx + 5); x++) {
				const c = idx(x, y);
				if (tile[c] >= 0 && TILES[tile[c]].deg > 0) {
					const d = Math.hypot(x - cx, y - cy);
					if (d < bestD) {
						bestD = d;
						start = c;
					}
				}
			}
		if (start < 0) return;
		const q = [start];
		dist[start] = 0;
		let max = 0;
		for (let h = 0; h < q.length; h++) {
			const c = q[h];
			const x = c % cols;
			const y = (c / cols) | 0;
			const e = TILES[tile[c]].e;
			for (let d = 0; d < 4; d++) {
				if (!e[d]) continue;
				const nx = x + DIRS[d][0];
				const ny = y + DIRS[d][1];
				if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
				const nc = idx(nx, ny);
				if (tile[nc] < 0 || dist[nc] >= 0) continue;
				if (!TILES[tile[nc]].e[(d + 2) % 4]) continue;
				dist[nc] = dist[c] + 1;
				max = Math.max(max, dist[nc]);
				q.push(nc);
			}
		}
		pulse = { t: 0, max };
	}

	// ---- drawing --------------------------------------------------------------------------------
	const mid = [
		[0, -0.5],
		[0.5, 0],
		[0, 0.5],
		[-0.5, 0],
	];

	function addGroup(g, t, x, y) {
		const tl = TILES[t];
		const e = tl.e;
		const s = cell;
		if (g === 0 || g === 1 || g === 2) {
			const want = g === 0 ? 1 : 2;
			// rounded corner when the whole tile is a single-type 2-edge bend
			if (tl.deg === 2 && !tl.straight && !tl.mixed && ((g === 0 && e.includes(1)) || (g > 0 && e.includes(2)))) {
				const ds = [];
				for (let d = 0; d < 4; d++) if (e[d]) ds.push(d);
				ctx.moveTo(x + mid[ds[0]][0] * s, y + mid[ds[0]][1] * s);
				ctx.quadraticCurveTo(x, y, x + mid[ds[1]][0] * s, y + mid[ds[1]][1] * s);
				return;
			}
			for (let d = 0; d < 4; d++) {
				if (e[d] !== want) continue;
				ctx.moveTo(x, y);
				ctx.lineTo(x + mid[d][0] * s, y + mid[d][1] * s);
			}
		} else if (g === 3) {
			// pads and junction dots
			if (tl.chip) return;
			const types = tl.e.filter(Boolean);
			if (tl.deg === 1) {
				const d = e.findIndex(Boolean);
				const px = x + mid[d][0] * s * 0.35;
				const py = y + mid[d][1] * s * 0.35;
				if (types[0] === 1) {
					ctx.moveTo(px + 3.6, py);
					ctx.arc(px, py, 3.6, 0, 6.283);
				} else ctx.rect(px - 4, py - 4, 8, 8);
			} else if (tl.deg >= 3 && !(tl.deg === 4 && !tl.mixed ? false : tl.mixed && tl.deg === 4 && e[0] === e[2] && e[1] === e[3])) {
				ctx.moveTo(x + 2.8, y);
				ctx.arc(x, y, 2.8, 0, 6.283);
			}
		} else if (tl.chip) {
			const h = s * 0.36;
			ctx.rect(x - h, y - h, h * 2, h * 2);
		}
	}

	function drawCell(c, alpha, glow, pulseColor) {
		const t = tile[c];
		if (t < 0) return;
		const x = ox + (c % cols) * cell;
		const y = oy + ((c / cols) | 0) * cell;
		const col0 = pulseColor ? C.pulse : C.thin;
		const col1 = pulseColor ? C.pulse : C.bus;
		ctx.lineCap = "round";
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = col0;
		ctx.lineWidth = 1.7 + glow * 0.8;
		ctx.beginPath();
		addGroup(0, t, x, y);
		ctx.stroke();
		ctx.strokeStyle = col1;
		ctx.globalAlpha = alpha * 0.32;
		ctx.lineWidth = 6 + glow * 1.5;
		ctx.beginPath();
		addGroup(1, t, x, y);
		ctx.stroke();
		ctx.globalAlpha = alpha;
		ctx.lineWidth = 1.3;
		ctx.beginPath();
		addGroup(2, t, x, y);
		ctx.stroke();
		ctx.strokeStyle = col0;
		ctx.fillStyle = col0;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		addGroup(3, t, x, y);
		ctx.stroke();
		if (TILES[t].chip) {
			ctx.fillStyle = pulseColor ? C.pulse : C.chip;
			ctx.globalAlpha = alpha * 0.45;
			ctx.beginPath();
			addGroup(4, t, x, y);
			ctx.fill();
			ctx.globalAlpha = alpha;
			ctx.strokeStyle = pulseColor ? C.pulse : C.chip;
			ctx.lineWidth = 1.6;
			ctx.stroke();
		}
	}

	const pointer = trackPointer(layer, {
		onDown: (p, e) => {
			if (e.target.closest?.("button, input")) return;
			click(p.x, p.y);
		},
		onMove: () => {
			activeUntil = performance.now() + 1500;
			if (reducedMotion) requestAnimationFrame(render);
		},
	});
	let activeUntil = 0;

	function click(px, py) {
		startPulse(px, py);
		regenerate(px, py);
		if (reducedMotion) {
			while (remaining > 0) stepCollapse(1);
			render();
		}
		activeUntil = performance.now() + 2500;
	}

	function render() {
		ctx.clearRect(0, 0, W, H);
		const baseA = dark ? 0.34 : 0.4;
		const lit = [];
		const hasPtr = pointer.seen && pointer.inside;
		const pf = pulse ? pulse.t * 24 : -1;
		// uncollapsed marks
		ctx.globalAlpha = 0.25;
		ctx.fillStyle = C.thin;
		ctx.beginPath();
		for (let c = 0; c < tile.length; c++) {
			if (tile[c] >= 0) continue;
			const x = ox + (c % cols) * cell;
			const y = oy + ((c / cols) | 0) * cell;
			ctx.rect(x - 1, y - 1, 2, 2);
		}
		ctx.fill();

		// base: batched by column-dimmed style
		const groupDraw = (inCol) => {
			ctx.lineCap = "round";
			ctx.globalAlpha = baseA * (inCol ? (col?.k ?? 0.45) : 1);
			ctx.strokeStyle = C.thin;
			ctx.lineWidth = 1.7;
			ctx.beginPath();
			iterate(inCol, (t, x, y) => addGroup(0, t, x, y));
			ctx.stroke();
			ctx.strokeStyle = C.bus;
			ctx.globalAlpha *= 0.32;
			ctx.lineWidth = 6;
			ctx.beginPath();
			iterate(inCol, (t, x, y) => addGroup(1, t, x, y));
			ctx.stroke();
			ctx.globalAlpha = baseA * (inCol ? (col?.k ?? 0.45) : 1);
			ctx.lineWidth = 1.3;
			ctx.beginPath();
			iterate(inCol, (t, x, y) => addGroup(2, t, x, y));
			ctx.stroke();
			ctx.strokeStyle = C.thin;
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			iterate(inCol, (t, x, y) => addGroup(3, t, x, y));
			ctx.stroke();
			ctx.fillStyle = C.chip;
			ctx.strokeStyle = C.chip;
			ctx.beginPath();
			iterate(inCol, (t, x, y) => TILES[t].chip && addGroup(4, t, x, y));
			ctx.globalAlpha *= 0.5;
			ctx.fill();
			ctx.globalAlpha = baseA * (inCol ? (col?.k ?? 0.45) : 1);
			ctx.stroke();
		};
		function iterate(inCol, fn) {
			for (let c = 0; c < tile.length; c++) {
				const t = tile[c];
				if (t < 0 || TILES[t].deg === 0 && !TILES[t].chip) continue;
				const x = ox + (c % cols) * cell;
				if (!!col && x > col.l && x < col.r !== inCol) continue;
				if (!col && inCol) continue;
				fn(t, x, oy + ((c / cols) | 0) * cell);
			}
		}
		groupDraw(false);
		if (col) groupDraw(true);

		// lit cells: hover, flash, pulse
		for (let c = 0; c < tile.length; c++) {
			const t = tile[c];
			if (t < 0) continue;
			let l = bright[c];
			let isPulse = false;
			if (hasPtr) {
				const x = ox + (c % cols) * cell;
				const y = oy + ((c / cols) | 0) * cell;
				const d = Math.hypot(x - pointer.x, y - pointer.y);
				if (d < 190) l = Math.max(l, (1 - d / 190) ** 1.4 * 0.95);
			}
			if (pf >= 0 && dist[c] >= 0) {
				const k = Math.exp(-(((dist[c] - pf) / 2.6) ** 2));
				const tail = dist[c] < pf ? Math.exp(-(pf - dist[c]) / 14) * 0.35 : 0;
				const v = Math.max(k, tail);
				if (v > 0.03) {
					l = Math.max(l, v);
					isPulse = true;
				}
			}
			if (l > 0.04 && (TILES[t].deg > 0 || TILES[t].chip)) lit.push(c, l, isPulse ? 1 : 0);
		}
		for (let i = 0; i < lit.length; i += 3) {
			drawCell(lit[i], Math.min(1, 0.25 + lit[i + 1] * 0.8), lit[i + 1], lit[i + 2] === 1 && lit[i + 1] > 0.3);
		}
		ctx.globalAlpha = 1;
	}

	function stepCollapse(n) {
		for (let k = 0; k < n && remaining > 0; k++) {
			const c = pickNext();
			if (c < 0) {
				remaining = 0;
				break;
			}
			collapseCell(c);
			remaining--;
		}
	}

	function measure() {
		const lr = layer.getBoundingClientRect();
		const page = root.querySelector(".site-page");
		if (page && W > 900) {
			const pr = page.getBoundingClientRect();
			col = { l: pr.left - lr.left + 30, r: pr.right - lr.left - 30, k: 0.3 };
		} else col = { l: 0, r: 0, k: 0 };
		if (!col.k) col = null;
	}

	function setup() {
		view.fit();
		W = view.cssW;
		H = view.cssH;
		ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
		cell = Math.max(22, Math.round(W / 44));
		measure();
		reset();
		if (reducedMotion) {
			while (remaining > 0) stepCollapse(50);
			render();
		}
	}

	setup();
	const button = makeButton(root, reducedMotion ? "re-collapse" : "click to re-collapse · hover to energise", {
		title: "Click the background to regenerate a patch of the board and send a signal pulse along the traces",
	});
	button.addEventListener("click", () => click(W * (0.1 + Math.random() * 0.8), H * (0.15 + Math.random() * 0.7)));

	let loop = null;
	if (!reducedMotion) {
		loop = createLoop((dt) => {
			const collapsing = remaining > 0;
			if (collapsing) stepCollapse(remaining > 400 ? 9 : 5);
			let anim = collapsing;
			for (let c = 0; c < bright.length; c++) {
				if (bright[c] > 0.01) {
					bright[c] *= 0.93;
					anim = true;
				} else bright[c] = 0;
			}
			if (pulse) {
				pulse.t += dt;
				anim = true;
				if (pulse.t * 24 > pulse.max + 40) pulse = null;
			}
			if (anim || performance.now() < activeUntil) render();
		});
	}

	const stopSize = observeSize(layer, () => {
		const w0 = W;
		const h0 = H;
		view.fit();
		if (Math.abs(view.cssW - w0) > 4 || Math.abs(view.cssH - h0) > 4) setup();
	});

	return () => {
		loop?.stop();
		stopSize();
		pointer.destroy();
		button.remove();
		view.destroy();
	};
}
