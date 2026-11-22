import { bytesOf, el, formatBytes, formatMs, mountCanvas2d, origin, shortName, state, subscribe, themeBoundary, typeOf } from "./_perf/kit.js";

// Real Resource Timing (buffered) drawn as a skyline:
//   x = startTime, height = duration, width = transfer size, colour = resource type.
// Resources requested by this theme (after the page was already loaded) get a rooftop beacon.

const COLORS = {
	dark: { script: "#ffc247", style: "#4fd1ff", image: "#ff6fb5", font: "#a98bff", data: "#5cf2c1", other: "#9fb4d0" },
	light: { script: "#c98a00", style: "#0b86c4", image: "#d4357f", font: "#6a47d6", data: "#0f9c76", other: "#5b6b8c" },
};

function hash(n) {
	n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
	n ^= n >>> 13;
	n = Math.imul(n, 0xc2b2ae35);
	return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const overlay = root.querySelector(".overlay-a");
	const scene = mountCanvas2d(layer);
	const palette = COLORS[mode] ?? COLORS.dark;

	const title = el("div", { class: "sky-title", text: "Request skyline" });
	const summary = el("div", { class: "sky-summary", text: "Measuring..." });
	const readout = el("div", { class: "sky-readout", text: "Hover the skyline" });
	const legend = el("div", { class: "sky-legend" });
	for (const [type, color] of Object.entries(palette)) {
		legend.append(el("span", { class: "sky-key", style: `--key:${color}`, text: type }));
	}
	const card = el("div", { class: "sky-card" }, title, summary, legend, readout);
	overlay.append(card);

	let buildings = [];
	let hover = -1;

	function layout() {
		const entries = state.resources.filter((entry) => entry.duration >= 0).sort((a, b) => a.startTime - b.startTime);
		const boundary = themeBoundary();
		const w = scene.w;
		const groundY = scene.h - 34;
		const maxH = Math.min(scene.h * 0.46, 360);
		const end = Math.max(1, ...entries.map((entry) => entry.responseEnd));
		const maxDur = Math.max(1, ...entries.map((entry) => entry.duration));
		const maxBytes = Math.max(1, ...entries.map(bytesOf));
		const rowEnds = [];
		buildings = entries.map((entry, index) => {
			const bytes = bytesOf(entry);
			const bw = 20 + Math.sqrt(bytes / maxBytes) * 56;
			const x = 24 + (entry.startTime / end) * (w - 48 - bw);
			let row = rowEnds.findIndex((rowEnd) => x >= rowEnd + 4);
			if (row === -1) row = rowEnds.push(0) - 1;
			rowEnds[row] = x + bw;
			const bh = 60 + Math.pow(entry.duration / maxDur, 0.45) * maxH * 0.8 + hash(index + 7) * 18;
			return { entry, index, x, w: bw, h: bh, row: Math.min(row, 3), type: typeOf(entry), from: origin(entry, boundary) };
		});
		return { groundY, end };
	}

	function draw() {
		const { ctx, w, h } = scene;
		ctx.clearRect(0, 0, w, h);
		const { groundY, end } = layout();
		const dark = mode === "dark";
		const order = [...buildings].sort((a, b) => b.row - a.row);
		for (const b of order) {
			const color = palette[b.type] ?? palette.other;
			const depth = 1 - b.row * 0.22;
			const x = b.x + b.row * 5;
			const top = groundY - b.h * (1 - b.row * 0.08);
			const bh = groundY - top;
			const active = b.index === hover;
			const grad = ctx.createLinearGradient(0, top, 0, groundY);
			grad.addColorStop(0, hexA(color, (dark ? 0.9 : 0.6) * depth + (active ? 0.25 : 0)));
			grad.addColorStop(1, hexA(color, 0.06 * depth));
			ctx.fillStyle = grad;
			ctx.beginPath();
			roofPath(ctx, b.type, x, top, b.w, bh);
			ctx.fill();
			ctx.strokeStyle = hexA(color, (active ? 0.95 : 0.5) * depth);
			ctx.lineWidth = active ? 1.6 : 1;
			ctx.stroke();

			// Windows: lit with probability tied to a hash, so the same resource always looks the same.
			ctx.fillStyle = hexA(dark ? "#fff0b8" : "#ffffff", dark ? 0.7 : 0.8);
			const cols = Math.max(2, Math.floor(b.w / 7));
			for (let r = 0; r < Math.floor(bh / 10) - 1; r++) {
				for (let c = 0; c < cols; c++) {
					if (hash(b.index * 977 + r * 31 + c) > 0.4 * depth + 0.1) continue;
					ctx.fillRect(x + 4 + c * ((b.w - 8) / cols), top + 14 + r * 10, 2.5, 3.5);
				}
			}

			if (b.from === "theme") {
				// Rooftop beacon: this resource was requested by the theme, after the page loaded.
				ctx.fillStyle = hexA(dark ? "#ffffff" : color, 0.95);
				ctx.beginPath();
				ctx.arc(x + b.w / 2, top - 7, 2.4, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = hexA(color, 0.18);
				ctx.beginPath();
				ctx.arc(x + b.w / 2, top - 7, 7, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		// Ground and timeline axis: the skyline's x axis IS the page's timeline.
		ctx.strokeStyle = hexA(dark ? "#9fb4d0" : "#5b6b8c", 0.45);
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, groundY + 0.5);
		ctx.lineTo(w, groundY + 0.5);
		ctx.stroke();
		ctx.fillStyle = hexA(dark ? "#9fb4d0" : "#5b6b8c", 0.8);
		ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
		ctx.textAlign = "left";
		const ticks = 5;
		for (let i = 0; i <= ticks; i++) {
			const tx = 24 + (i / ticks) * (w - 48);
			ctx.fillRect(tx, groundY, 1, 4);
			ctx.textAlign = i === ticks ? "right" : i === 0 ? "left" : "center";
			ctx.fillText(formatMs((i / ticks) * end), tx, groundY + 17);
		}
		const pageCount = buildings.filter((b) => b.from === "page").length;
		summary.textContent = `${buildings.length} requests: ${pageCount} during page load, ${buildings.length - pageCount} from this theme`;
	}

	function roofPath(ctx, type, x, top, bw, bh) {
		const bottom = top + bh;
		if (type === "script") {
			// Spire.
			ctx.moveTo(x, bottom);
			ctx.lineTo(x, top + 10);
			ctx.lineTo(x + bw / 2 - 1.5, top + 10);
			ctx.lineTo(x + bw / 2, top - 8);
			ctx.lineTo(x + bw / 2 + 1.5, top + 10);
			ctx.lineTo(x + bw, top + 10);
			ctx.lineTo(x + bw, bottom);
		} else if (type === "image") {
			// Gable.
			ctx.moveTo(x, bottom);
			ctx.lineTo(x, top + 8);
			ctx.lineTo(x + bw / 2, top - 4);
			ctx.lineTo(x + bw, top + 8);
			ctx.lineTo(x + bw, bottom);
		} else if (type === "font") {
			// Arched.
			ctx.moveTo(x, bottom);
			ctx.lineTo(x, top + bw / 2);
			ctx.arc(x + bw / 2, top + bw / 2, bw / 2, Math.PI, 0);
			ctx.lineTo(x + bw, bottom);
		} else if (type === "style") {
			// Stepped ledge.
			ctx.moveTo(x, bottom);
			ctx.lineTo(x, top + 6);
			ctx.lineTo(x + bw * 0.3, top + 6);
			ctx.lineTo(x + bw * 0.3, top);
			ctx.lineTo(x + bw * 0.7, top);
			ctx.lineTo(x + bw * 0.7, top + 6);
			ctx.lineTo(x + bw, top + 6);
			ctx.lineTo(x + bw, bottom);
		} else {
			ctx.rect(x, top, bw, bh);
		}
		ctx.closePath();
	}

	function hexA(hex, alpha) {
		const n = Number.parseInt(hex.slice(1), 16);
		return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, alpha))})`;
	}

	let frame = 0;
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
		let found = -1;
		const groundY = scene.h - 34;
		for (const b of buildings) {
			const x = b.x + b.row * 5;
			if (px >= x && px <= x + b.w && py >= groundY - b.h && py <= groundY && (found === -1 || b.row < buildings[found].row)) {
				found = buildings.indexOf(b);
			}
		}
		const next = found === -1 ? -1 : buildings[found].index;
		if (next !== hover) {
			hover = next;
			const b = buildings.find((item) => item.index === hover);
			readout.textContent = b
				? `${shortName(b.entry)} · ${b.type} · ${formatBytes(bytesOf(b.entry))} · starts ${formatMs(b.entry.startTime)} · ${formatMs(b.entry.duration)} · ${b.from === "theme" ? "theme load" : "page load"}`
				: "Hover the skyline";
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
