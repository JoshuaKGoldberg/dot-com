// #68 Falling Sand: a cellular-automaton engine (sand, water, stone, fire, steam, glass) over the viewport.
// Real glyphs of the page text are rasterised into an obstacle mask, so grains pile on letters and are
// carried along as the page scrolls. Pour in the margins by default; "Everywhere" lets you pour on the page.
import { bindKeys, clamp, createLoop, createPill, isInteractiveTarget } from "./physics-kit/kit.js";

const E = 0;
const SAND = 1;
const WATER = 2;
const STONE = 3;
const FIRE = 4;
const STEAM = 5;
const GLASS = 6;

const TOOLS = [
	{ id: "sand", type: SAND, label: "Sand", key: "1", swatch: "#d9b56a" },
	{ id: "water", type: WATER, label: "Water", key: "2", swatch: "#3b8fe0" },
	{ id: "stone", type: STONE, label: "Stone", key: "3", swatch: "#80848f" },
	{ id: "fire", type: FIRE, label: "Fire", key: "4", swatch: "#ff7a1a" },
	{ id: "erase", type: E, label: "Erase", key: "5", swatch: "#ffffff" },
];

export function activate({ root, reducedMotion, mode }) {
	const dark = mode === "dark";
	const overlay = root.querySelector(".overlay-a");
	const page = root.querySelector(".site-page");
	if (!overlay || !page) return undefined;

	const canvas = document.createElement("canvas");
	canvas.className = "sand-canvas";
	canvas.setAttribute("aria-hidden", "true");
	overlay.append(canvas);
	const ctx = canvas.getContext("2d");

	let C = 3; // css px per cell
	let VW = 0;
	let VH = 0;
	let gw = 0;
	let gh = 0;
	let t; // type
	let life;
	let tone;
	let stamp;
	let mask;
	let img;
	let chunkW = 0;
	let chunkH = 0;
	let awake;
	let parity = 0;
	let tool = TOOLS[0];
	let everywhere = false;
	let words = [];
	let maskDirty = true;
	let maskCtx;
	let maskCanvas;
	let pageRect = { left: 0, right: 0 };
	let frame = 0;
	let moves = 0;
	let calm = 0;
	let down = false;
	let big = false;
	let lastCell = null;
	let lastScroll = root.scrollTop;
	let hello = reducedMotion ? 0 : 4.2;
	let demoClock = 0;
	let hasStuff = false;
	const pointer = { x: 0, y: 0 };

	// ------------------------------------------------------------ setup

	function layout() {
		const rr = root.getBoundingClientRect();
		VW = rr.width;
		VH = rr.height;
		C = VW * VH > 1_600_000 ? 4 : 3;
		gw = Math.ceil(VW / C);
		gh = Math.ceil(VH / C);
		canvas.width = gw;
		canvas.height = gh;
		const n = gw * gh;
		t = new Uint8Array(n);
		life = new Uint8Array(n);
		tone = new Uint8Array(n);
		stamp = new Uint8Array(n);
		mask = new Uint8Array(n);
		img = ctx.createImageData(gw, gh);
		chunkW = Math.ceil(gw / 16);
		chunkH = Math.ceil(gh / 16);
		awake = new Uint8Array(chunkW * chunkH);
		maskCanvas = document.createElement("canvas");
		maskCanvas.width = gw;
		maskCanvas.height = gh;
		maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
		const pr = page.getBoundingClientRect();
		pageRect = { left: pr.left - rr.left + 24, right: pr.right - rr.left - 24 };
		collectWords();
		maskDirty = true;
		hasStuff = false;
	}

	function collectWords() {
		words = [];
		const rr = root.getBoundingClientRect();
		const sc = root.scrollTop;
		const range = document.createRange();
		const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
		const metricCache = new Map();
		const cv = document.createElement("canvas").getContext("2d");
		while (walker.nextNode()) {
			const node = walker.currentNode;
			const parent = node.parentElement;
			if (!node.nodeValue.trim() || !parent) continue;
			const s = getComputedStyle(parent);
			if (s.visibility === "hidden" || s.display === "none") continue;
			const font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
			let m = metricCache.get(font);
			if (!m) {
				cv.font = font;
				const mm = cv.measureText("Hg");
				m = { asc: mm.fontBoundingBoxAscent, desc: mm.fontBoundingBoxDescent };
				metricCache.set(font, m);
			}
			const text = node.nodeValue;
			const re = /\S+/g;
			let match;
			while ((match = re.exec(text))) {
				range.setStart(node, match.index);
				range.setEnd(node, match.index + match[0].length);
				const r = range.getBoundingClientRect();
				if (!r.width) continue;
				words.push({
					w: match[0],
					font,
					x: r.left - rr.left,
					y: r.top - rr.top + sc + (r.height - (m.asc + m.desc)) / 2 + m.asc,
					top: r.top - rr.top + sc,
					bottom: r.bottom - rr.top + sc,
				});
			}
		}
		const portrait = root.querySelector(".site-portrait img:not([style*='display: none'])");
		words.portrait = undefined;
		const pi = [...root.querySelectorAll(".site-portrait img")].find((i) => i.offsetParent);
		if (pi) {
			const r = pi.getBoundingClientRect();
			words.portrait = { x: r.left - rr.left + r.width / 2, y: r.top - rr.top + sc + r.height / 2, r: r.width / 2 };
		}
		void portrait;
	}

	function rebuildMask() {
		maskDirty = false;
		const sc = root.scrollTop;
		maskCtx.setTransform(1, 0, 0, 1, 0, 0);
		maskCtx.clearRect(0, 0, gw, gh);
		maskCtx.setTransform(1 / C, 0, 0, 1 / C, 0, 0);
		maskCtx.fillStyle = "#000";
		maskCtx.strokeStyle = "#000";
		maskCtx.lineWidth = 1.6;
		maskCtx.lineJoin = "round";
		maskCtx.textBaseline = "alphabetic";
		let lastFont = "";
		for (const w of words) {
			if (w.bottom - sc < -4 || w.top - sc > VH + 4) continue;
			if (w.font !== lastFont) {
				maskCtx.font = w.font;
				lastFont = w.font;
			}
			maskCtx.fillText(w.w, w.x, w.y - sc);
			maskCtx.strokeText(w.w, w.x, w.y - sc);
		}
		const p = words.portrait;
		if (p) {
			maskCtx.beginPath();
			maskCtx.arc(p.x, p.y - sc, p.r, 0, 7);
			maskCtx.fill();
		}
		const data = maskCtx.getImageData(0, 0, gw, gh).data;
		for (let i = 0, n = gw * gh; i < n; i++) mask[i] = data[i * 4 + 3] > 40 ? 1 : 0;
		if (hasStuff) pushOut();
	}

	// Grains that a moving glyph now overlaps are lifted onto its top, so sand rides on scrolling text.
	function pushOut() {
		for (let y = 0; y < gh; y++) {
			for (let x = 0; x < gw; x++) {
				const i = y * gw + x;
				if (!mask[i] || t[i] === E) continue;
				if (t[i] === STONE || t[i] === GLASS) continue;
				let placed = false;
				for (let k = 1; k <= 14 && y - k >= 0; k++) {
					const j = i - k * gw;
					if (t[j] === E && !mask[j]) {
						t[j] = t[i];
						life[j] = life[i];
						tone[j] = tone[i];
						t[i] = E;
						placed = true;
						break;
					}
				}
				if (!placed) t[i] = E;
			}
		}
		awake.fill(1);
	}

	// ------------------------------------------------------------ simulation

	const rnd = () => Math.random();

	function wake(x, y) {
		const cx = (x / 16) | 0;
		const cy = (y / 16) | 0;
		for (let oy = -1; oy <= 1; oy++) {
			for (let ox = -1; ox <= 1; ox++) {
				const ax = cx + ox;
				const ay = cy + oy;
				if (ax >= 0 && ay >= 0 && ax < chunkW && ay < chunkH) awake[ay * chunkW + ax] = 2;
			}
		}
	}

	function swap(i, j) {
		const tt = t[i];
		t[i] = t[j];
		t[j] = tt;
		const ll = life[i];
		life[i] = life[j];
		life[j] = ll;
		const nn = tone[i];
		tone[i] = tone[j];
		tone[j] = nn;
		stamp[i] = stamp[j] = parity;
		moves++;
	}

	const passSand = (i) => !mask[i] && (t[i] === E || t[i] === WATER || t[i] === STEAM);
	const passWater = (i) => !mask[i] && (t[i] === E || t[i] === STEAM);
	const empty = (i) => !mask[i] && t[i] === E;

	function stepCell(x, y, i) {
		const type = t[i];
		const dir = rnd() < 0.5 ? -1 : 1;
		if (type === SAND) {
			if (y >= gh - 1) return;
			const b = i + gw;
			if (passSand(b)) {
				swap(i, b);
				// Free fall: a second cell when open.
				if (y + 2 < gh && passSand(b + gw) && t[b + gw] === E) swap(b, b + gw);
				return;
			}
			const xl = x + dir;
			const xr = x - dir;
			if (xl >= 0 && xl < gw && passSand(b + dir) && !mask[i + dir]) swap(i, b + dir);
			else if (xr >= 0 && xr < gw && passSand(b - dir) && !mask[i - dir]) swap(i, b - dir);
		} else if (type === WATER) {
			if (y < gh - 1) {
				const b = i + gw;
				if (passWater(b)) {
					swap(i, b);
					if (y + 2 < gh && t[b + gw] === E && !mask[b + gw]) swap(b, b + gw);
					return;
				}
				if (x + dir >= 0 && x + dir < gw && passWater(b + dir) && !mask[i + dir]) {
					swap(i, b + dir);
					return;
				}
				if (x - dir >= 0 && x - dir < gw && passWater(b - dir) && !mask[i - dir]) {
					swap(i, b - dir);
					return;
				}
			}
			// Spread sideways a few cells.
			let target = -1;
			for (let d = 1; d <= 4; d++) {
				const nx = x + dir * d;
				if (nx < 0 || nx >= gw) break;
				if (empty(i + dir * d)) target = i + dir * d;
				else break;
			}
			if (target >= 0 && rnd() < 0.85) swap(i, target);
		} else if (type === FIRE) {
			stamp[i] = parity;
			wake(x, y);
			let l = life[i];
			if (l <= 1) {
				t[i] = E;
				return;
			}
			life[i] = l - 1;
			// Heat the neighbours.
			const nb = [i - 1, i + 1, i - gw, i + gw][(rnd() * 4) | 0];
			if (nb >= 0 && nb < t.length) {
				if (t[nb] === WATER) {
					t[nb] = STEAM;
					life[nb] = 90 + ((rnd() * 80) | 0);
					t[i] = E;
					return;
				}
				if (t[nb] === SAND && rnd() < 0.05) {
					t[nb] = GLASS;
					tone[nb] = (rnd() * 4) | 0;
				}
			}
			const dx = ((rnd() * 3) | 0) - 1;
			const up = i - gw + dx;
			if (y > 0 && x + dx >= 0 && x + dx < gw && empty(up) && rnd() < 0.8) swap(i, up);
			else if (rnd() < 0.08) t[i] = E;
		} else if (type === STEAM) {
			stamp[i] = parity;
			wake(x, y);
			if (life[i] <= 1) {
				t[i] = E;
				return;
			}
			life[i]--;
			const dx = ((rnd() * 3) | 0) - 1;
			if (y > 0 && x + dx >= 0 && x + dx < gw && empty(i - gw + dx)) swap(i, i - gw + dx);
			else if (x + dir >= 0 && x + dir < gw && empty(i + dir) && rnd() < 0.5) swap(i, i + dir);
			else if (rnd() < 0.02) {
				t[i] = WATER;
				life[i] = 0;
			}
		}
	}

	function stepWorld() {
		parity = parity ? 0 : 1;
		moves = 0;
		const ltr = (frame & 1) === 0;
		for (let cy = chunkH - 1; cy >= 0; cy--) {
			for (let cx = 0; cx < chunkW; cx++) {
				const ci = cy * chunkW + cx;
				if (!awake[ci]) continue;
				awake[ci] = awake[ci] > 1 ? 1 : 0; // decays unless re-woken by movement
				const y0 = cy * 16;
				const y1 = Math.min(gh - 1, y0 + 15);
				const x0 = cx * 16;
				const x1 = Math.min(gw - 1, x0 + 15);
				for (let y = y1; y >= y0; y--) {
					const row = y * gw;
					if (ltr) {
						for (let x = x0; x <= x1; x++) {
							const i = row + x;
							const type = t[i];
							if (type === E || type === STONE || type === GLASS || stamp[i] === parity) continue;
							const before = moves;
							stepCell(x, y, i);
							if (moves !== before) wake(x, y);
						}
					} else {
						for (let x = x1; x >= x0; x--) {
							const i = row + x;
							const type = t[i];
							if (type === E || type === STONE || type === GLASS || stamp[i] === parity) continue;
							const before = moves;
							stepCell(x, y, i);
							if (moves !== before) wake(x, y);
						}
					}
				}
			}
		}
		frame++;
	}

	// ------------------------------------------------------------ painting & render

	const PAL = {
		sand: dark ? [[232, 196, 120], [218, 178, 104], [244, 212, 140], [205, 164, 92]] : [[222, 184, 108], [211, 170, 94], [233, 198, 126], [198, 158, 84]],
		water: [[52, 140, 226], [44, 128, 214], [66, 156, 236], [36, 118, 204]],
		stone: dark ? [[132, 136, 150], [116, 120, 134], [148, 152, 164], [104, 108, 122]] : [[122, 126, 138], [108, 112, 124], [138, 142, 152], [96, 100, 112]],
		glass: [[170, 232, 228], [150, 220, 224], [190, 242, 236], [132, 206, 216]],
	};

	function render() {
		const d = img.data;
		for (let i = 0, n = gw * gh; i < n; i++) {
			const o = i * 4;
			const type = t[i];
			if (type === E) {
				d[o + 3] = 0;
				continue;
			}
			let c;
			let a = 255;
			if (type === SAND) c = PAL.sand[(i * 7 + (i >> 5)) & 3];
			else if (type === WATER) {
				c = PAL.water[(i * 5 + frame) & 3 ? ((i * 3) >> 2) & 3 : 0];
				a = 215;
			} else if (type === STONE) c = PAL.stone[(i * 11 + (i >> 4)) & 3];
			else if (type === GLASS) {
				c = PAL.glass[tone[i] & 3];
				a = 190;
			} else if (type === FIRE) {
				const l = life[i];
				c = l > 38 ? [255, 236, 150] : l > 22 ? [255, 168, 40] : l > 10 ? [235, 92, 24] : [150, 40, 20];
				a = l > 10 ? 255 : 160;
			} else {
				const l = life[i];
				c = dark ? [200, 210, 225] : [160, 170, 190];
				a = Math.min(130, l * 2);
			}
			d[o] = c[0];
			d[o + 1] = c[1];
			d[o + 2] = c[2];
			d[o + 3] = a;
		}
		ctx.putImageData(img, 0, 0);
	}

	function emit(cx, cy, r, type, density = 1) {
		const r2 = r * r;
		for (let y = -r; y <= r; y++) {
			const yy = cy + y;
			if (yy < 0 || yy >= gh) continue;
			for (let x = -r; x <= r; x++) {
				if (x * x + y * y > r2) continue;
				const xx = cx + x;
				if (xx < 0 || xx >= gw) continue;
				const i = yy * gw + xx;
				if (type === E) {
					if (t[i] !== E) {
						t[i] = E;
						wake(xx, yy);
					}
					continue;
				}
				if (t[i] !== E || mask[i] || rnd() > density) continue;
				t[i] = type;
				life[i] = type === FIRE ? 30 + ((rnd() * 40) | 0) : 0;
				tone[i] = (rnd() * 4) | 0;
				stamp[i] = parity;
				hasStuff = true;
				wake(xx, yy);
			}
		}
	}

	function toCell(clientX, clientY) {
		const rr = root.getBoundingClientRect();
		return [Math.floor((clientX - rr.left) / C), Math.floor((clientY - rr.top) / C)];
	}

	function pourAt(cx, cy) {
		const r = big ? 6 : 3;
		const type = tool.type;
		const density = type === SAND ? 0.55 : type === WATER ? 0.7 : type === FIRE ? 0.45 : 1;
		if (lastCell) {
			// Fill the gap since the last sample so fast strokes stay continuous.
			const dx = cx - lastCell[0];
			const dy = cy - lastCell[1];
			const steps = Math.max(1, Math.floor(Math.hypot(dx, dy) / Math.max(2, r - 1)));
			for (let s = 1; s <= steps; s++) emit(Math.round(lastCell[0] + (dx * s) / steps), Math.round(lastCell[1] + (dy * s) / steps), r, type, density);
		} else emit(cx, cy, r, type, density);
		lastCell = [cx, cy];
	}

	// ------------------------------------------------------------ loop

	const loop = createLoop({
		hz: 60,
		maxSteps: 2,
		step(dt) {
			if (hello > 0) {
				hello -= dt;
				demoClock += dt;
				const margin = Math.max(30, pageRect.left - 20);
				const lx = Math.round(margin / 2 / C);
				const rx = Math.round((VW - margin / 2) / C);
				emit(lx, 2, 2, SAND, 0.9);
				emit(rx, 2, 2, SAND, 0.9);
				if (demoClock > 2.2) emit(rx, 2, 1, WATER, 0.8);
			}
			if (down) {
				pourAt(...toCell(pointer.x + root.getBoundingClientRect().left, pointer.y + root.getBoundingClientRect().top));
			}
			if (maskDirty) rebuildMask();
			stepWorld();
			stepWorld();
			calm = moves < 2 && hello <= 0 && !down ? calm + 1 : 0;
			// Fire and steam keep chunks awake on their own; stop when nothing at all is happening.
			return calm < 40;
		},
		render,
		onStop: render,
	});

	// ------------------------------------------------------------ input

	function inMargin(x) {
		return x < pageRect.left || x > pageRect.right;
	}

	function onDown(e) {
		if (e.button !== 0 || isInteractiveTarget(e.target)) return;
		const rr = root.getBoundingClientRect();
		const x = e.clientX - rr.left;
		const y = e.clientY - rr.top;
		if (x < 0 || y < 0 || x > rr.width || y > rr.height) return;
		if (!everywhere && !inMargin(x)) return;
		e.preventDefault();
		down = true;
		big = e.shiftKey;
		lastCell = null;
		pointer.x = x;
		pointer.y = y;
		root.classList.add("sand-pouring");
		loop.start();
	}

	function onMove(e) {
		const rr = root.getBoundingClientRect();
		pointer.x = e.clientX - rr.left;
		pointer.y = e.clientY - rr.top;
		if (!down) {
			const show = everywhere || inMargin(pointer.x);
			root.style.cursor = show ? "crosshair" : "";
		}
	}

	function onUp() {
		down = false;
		lastCell = null;
		root.classList.remove("sand-pouring");
	}

	let scrollRaf = 0;
	function onScroll() {
		if (scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			if (root.scrollTop === lastScroll) return;
			lastScroll = root.scrollTop;
			maskDirty = true;
			if (hasStuff) {
				calm = 0;
				loop.start();
			}
		});
	}

	function selectTool(def) {
		tool = def;
		for (const [id, b] of Object.entries(ui.buttons)) if (b.dataset.tool) b.setAttribute("aria-pressed", String(id === def.id));
	}

	function clearAll() {
		t.fill(0);
		life.fill(0);
		hasStuff = false;
		render();
	}

	const ui = createPill(root, {
		pos: "center",
		hint: "Pour in the margins (click-drag) · shift = bigger brush · page text catches the sand",
		items: [
			...TOOLS.map((def) => ({ id: def.id, label: def.label, key: def.key, pressed: def.id === "sand", onClick: () => selectTool(def) })),
			"sep",
			{ id: "everywhere", label: "On page", key: "e", pressed: false, title: "Pour over the page text too (off: margins only)", onClick: (b) => { everywhere = !everywhere; b.setAttribute("aria-pressed", String(everywhere)); } },
			{ id: "clear", label: "Clear", key: "c", onClick: clearAll },
		],
	});
	for (const def of TOOLS) {
		const b = ui.buttons[def.id];
		b.dataset.tool = def.id;
		b.style.setProperty("--swatch", def.swatch);
	}
	const keyMap = { c: clearAll, e: () => ui.buttons.everywhere.click() };
	for (const def of TOOLS) keyMap[def.key] = () => selectTool(def);
	const removeKeys = bindKeys(keyMap);

	const ro = new ResizeObserver(() => {
		layout();
		render();
		if (hello > 0) loop.start();
	});

	let cancelled = false;
	(async () => {
		try {
			await document.fonts.ready;
		} catch {
			/* ignore */
		}
		if (cancelled) return;
		layout();
		rebuildMask();
		render();
		ro.observe(root);
		root.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("pointerdown", onDown);
		window.addEventListener("pointermove", onMove, { passive: true });
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		if (reducedMotion) {
			// Static frame: two settled dunes in the margins, no motion.
			const margin = Math.max(40, pageRect.left - 10);
			for (const [cx, dir] of [[margin / 2 / C, 1], [(VW - margin / 2) / C, -1]]) {
				for (let x = -Math.round(margin / 2 / C) + 2; x < margin / 2 / C - 2; x++) {
					const h = Math.round(18 * Math.max(0, 1 - (x / (margin / 2 / C)) ** 2) ** 1.2);
					for (let k = 0; k < h; k++) {
						const xx = Math.round(cx + x);
						const yy = gh - 2 - k;
						if (xx >= 0 && xx < gw && yy > 0) {
							t[yy * gw + xx] = SAND;
							tone[yy * gw + xx] = (Math.random() * 4) | 0;
						}
					}
				}
				void dir;
			}
			hasStuff = true;
			render();
		} else {
			loop.start();
		}
	})();

	return () => {
		cancelled = true;
		loop.stop();
		ro.disconnect();
		removeKeys();
		cancelAnimationFrame(scrollRaf);
		root.removeEventListener("scroll", onScroll);
		window.removeEventListener("pointerdown", onDown);
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		canvas.remove();
	};
}
