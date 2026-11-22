import { bytesOf, el, formatBytes, formatMs, mountCanvas2d, origin, shortName, state, subscribe, themeBoundary, typeOf } from "./_perf/kit.js";

// A squarified treemap of every resource this page has actually fetched (Resource Timing),
// sized by transfer bytes (falling back to encoded/decoded size) and coloured by type.
// Cross-origin responses without Timing-Allow-Origin report 0 bytes: they get a hatched minimum tile
// labelled "opaque" rather than an invented size.

const COLORS = {
	dark: { script: [255, 190, 60], style: [70, 200, 255], image: [255, 105, 175], font: [165, 135, 255], data: [90, 240, 190], other: [150, 170, 200] },
	light: { script: [214, 140, 0], style: [20, 130, 200], image: [215, 50, 125], font: [105, 70, 215], data: [20, 155, 120], other: [95, 110, 140] },
};

// Bruls/Huijsing/van Wijk squarify.
function squarify(items, x, y, w, h) {
	const out = [];
	const total = items.reduce((sum, item) => sum + item.value, 0);
	if (!total) return out;
	const scale = (w * h) / total;
	const queue = items.map((item) => ({ ...item, area: item.value * scale }));
	let rect = { x, y, w, h };

	const worst = (row, side) => {
		const sum = row.reduce((a, b) => a + b.area, 0);
		const max = Math.max(...row.map((r) => r.area));
		const min = Math.min(...row.map((r) => r.area));
		return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
	};

	function layoutRow(row) {
		const sum = row.reduce((a, b) => a + b.area, 0);
		if (rect.w >= rect.h) {
			const rw = sum / rect.h;
			let cy = rect.y;
			for (const r of row) {
				const rh = r.area / rw;
				out.push({ ...r, x: rect.x, y: cy, w: rw, h: rh });
				cy += rh;
			}
			rect = { x: rect.x + rw, y: rect.y, w: rect.w - rw, h: rect.h };
		} else {
			const rh = sum / rect.w;
			let cx = rect.x;
			for (const r of row) {
				const rw = r.area / rh;
				out.push({ ...r, x: cx, y: rect.y, w: rw, h: rh });
				cx += rw;
			}
			rect = { x: rect.x, y: rect.y + rh, w: rect.w, h: rect.h - rh };
		}
	}

	let row = [];
	while (queue.length) {
		const next = queue[0];
		const side = Math.min(rect.w, rect.h);
		if (!row.length || worst([...row, next], side) <= worst(row, side)) {
			row.push(queue.shift());
		} else {
			layoutRow(row);
			row = [];
		}
	}
	if (row.length) layoutRow(row);
	return out;
}

export function activate({ root, mode }) {
	const layer = root.querySelector(".scenery-a");
	const overlay = root.querySelector(".overlay-a");
	const scene = mountCanvas2d(layer);
	const palette = COLORS[mode] ?? COLORS.dark;
	const dark = mode === "dark";
	const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

	const summary = el("div", { class: "tm-summary", text: "Measuring..." });
	const detail = el("div", { class: "tm-detail", text: "Hover the mosaic" });
	const legend = el("div", { class: "tm-legend" });
	for (const [type, c] of Object.entries(palette)) {
		legend.append(el("span", { class: "tm-key", style: `--key:${rgba(c, 1)}`, text: type }));
	}
	const card = el("div", { class: "tm-card" }, el("div", { class: "tm-title", text: "Resource treemap" }), summary, legend, detail);
	overlay.append(card);

	let tiles = [];
	let hover = -1;
	let frame = 0;

	function layout() {
		const boundary = themeBoundary();
		const items = state.resources
			.map((entry, index) => {
				const bytes = bytesOf(entry);
				return { entry, index, bytes, value: Math.max(bytes, 1800), opaque: bytes === 0, type: typeOf(entry), from: origin(entry, boundary) };
			})
			.sort((a, b) => b.value - a.value);
		const pad = 10;
		tiles = squarify(items, pad, pad, scene.w - pad * 2, scene.h - pad * 2);
		const pageBytes = items.filter((i) => i.from === "page").reduce((a, b) => a + b.bytes, 0);
		const themeBytes = items.filter((i) => i.from === "theme").reduce((a, b) => a + b.bytes, 0);
		summary.textContent = `${items.length} resources · ${formatBytes(pageBytes)} page load + ${formatBytes(themeBytes)} theme load`;
	}

	function draw() {
		const { ctx, w, h } = scene;
		ctx.clearRect(0, 0, w, h);
		layout();
		ctx.textBaseline = "top";
		for (const tile of tiles) {
			const gap = 3;
			const x = tile.x + gap;
			const y = tile.y + gap;
			const tw = tile.w - gap * 2;
			const th = tile.h - gap * 2;
			if (tw < 2 || th < 2) continue;
			const c = palette[tile.type] ?? palette.other;
			const active = tile.index === hover;
			const grad = ctx.createLinearGradient(x, y, x + tw, y + th);
			grad.addColorStop(0, rgba(c, (dark ? 0.3 : 0.2) + (active ? 0.22 : 0)));
			grad.addColorStop(1, rgba(c, (dark ? 0.1 : 0.08) + (active ? 0.18 : 0)));
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.roundRect(x, y, tw, th, 8);
			ctx.fill();
			ctx.strokeStyle = rgba(c, active ? 0.95 : tile.from === "theme" ? 0.7 : 0.4);
			ctx.lineWidth = active ? 2 : 1;
			if (tile.from === "theme") ctx.setLineDash([5, 4]);
			ctx.stroke();
			ctx.setLineDash([]);

			if (tile.opaque) {
				ctx.save();
				ctx.clip();
				ctx.strokeStyle = rgba(c, 0.18);
				for (let i = -th; i < tw; i += 9) {
					ctx.beginPath();
					ctx.moveTo(x + i, y + th);
					ctx.lineTo(x + i + th, y);
					ctx.stroke();
				}
				ctx.restore();
			}

			if (tw > 70 && th > 34) {
				ctx.fillStyle = rgba(dark ? [235, 240, 255] : [30, 36, 60], 0.6);
				ctx.font = `700 ${tw > 180 && th > 90 ? 15 : 12}px "League Spartan", system-ui, sans-serif`;
				ctx.fillText(shortName(tile.entry).slice(0, Math.floor(tw / 8)), x + 10, y + 9);
				ctx.font = "500 10.5px ui-monospace, SFMono-Regular, Menlo, monospace";
				ctx.fillStyle = rgba(dark ? [200, 212, 240] : [60, 70, 100], 0.75);
				ctx.fillText(formatBytes(tile.bytes), x + 10, y + (tw > 180 && th > 90 ? 29 : 25));
			}
		}
	}

	function redraw() {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			scene.fit();
			draw();
		});
	}

	function onMove(event) {
		const rect = layer.getBoundingClientRect();
		const px = event.clientX - rect.left;
		const py = event.clientY - rect.top;
		const found = tiles.find((tile) => px >= tile.x && px <= tile.x + tile.w && py >= tile.y && py <= tile.y + tile.h);
		const next = found ? found.index : -1;
		if (next !== hover) {
			hover = next;
			detail.textContent = found
				? `${shortName(found.entry)} · ${found.type} · ${formatBytes(found.bytes)} · ${formatMs(found.entry.duration)} · ${found.from === "theme" ? "theme load (dashed)" : "page load"}`
				: "Hover the mosaic";
			redraw();
		}
	}

	const unsubscribe = subscribe(redraw);
	window.addEventListener("pointermove", onMove, { passive: true });
	const resize = new ResizeObserver(redraw);
	resize.observe(layer);

	return () => {
		unsubscribe();
		window.removeEventListener("pointermove", onMove);
		resize.disconnect();
		cancelAnimationFrame(frame);
	};
}
