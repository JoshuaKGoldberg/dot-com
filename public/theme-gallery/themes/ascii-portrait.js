// The hero portrait as live ASCII, shaded with a point light that follows the cursor.
import { createLoop, siteColors, trackPointer } from "./_kit/kit.js";

const RAMP = " .:-=+*#%@";
const HUES = 12;
const SATS = 3;

function rgbToHsv(r, g, b) {
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	let h = 0;
	if (d > 0) {
		if (max === r) h = ((g - b) / d + 6) % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
	}
	return [h / 6, max === 0 ? 0 : d / max, max];
}

export function activate({ root, mode, reducedMotion }) {
	const portrait = root.querySelector(".site-portrait");
	if (!portrait) return;
	const dark = mode === "dark";
	const colors = siteColors(root);
	const css = (c) => `rgb(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0})`;
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	portrait.append(canvas);
	const ctx = canvas.getContext("2d");
	const hint = document.createElement("div");
	hint.className = "ascii-hint";
	hint.textContent = "move your cursor to relight";
	portrait.append(hint);

	let alive = true;
	let cols = 0;
	let rows = 0;
	let cw = 0;
	let ch = 0;
	let atlas = null;
	let albedo;
	let height;
	let hueBin;
	let loop = null;
	let size = 0;
	let dpr = 1;

	const img = new Image();
	img.src = dark ? "assets/josh-dark.webp" : "assets/josh-light.webp";

	function mixTint(hue, sat, L) {
		// photo hue, pulled 65% of the way toward the theme's ink so the page stays cohesive
		const c = document.createElement("canvas").getContext("2d");
		c.fillStyle = `hsl(${hue} ${Math.round(sat * 80)}% ${L}%)`;
		const hex = c.fillStyle;
		const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
		const ink = dark ? colors.strong : colors.strong;
		const accent = dark ? colors.accent : colors.fg;
		const base = [0, 1, 2].map((i) => (dark ? accent[i] * 0.85 : ink[i]) * 255);
		return `rgb(${rgb.map((v, i) => Math.round(v * 0.38 + base[i] * 0.62)).join(",")})`;
	}

	function buildAtlas() {
		const gw = Math.ceil(cw * dpr);
		const gh = Math.ceil(ch * dpr);
		atlas = document.createElement("canvas");
		atlas.width = gw * RAMP.length;
		atlas.height = gh * HUES * SATS;
		const a = atlas.getContext("2d");
		a.textBaseline = "middle";
		a.textAlign = "center";
		a.font = `500 ${Math.round(gh * 0.9)}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
		const base = dark ? colors.fg : colors.strongRef || colors.strong;
		for (let hb = 0; hb < HUES; hb++) {
			for (let sb = 0; sb < SATS; sb++) {
				const sat = (sb + 0.4) / SATS;
				const hue = (hb / HUES) * 360;
				const L = dark ? 66 : 32;
				a.fillStyle = mixTint(hue, sat, L);
				for (let i = 1; i < RAMP.length; i++) {
					a.fillText(RAMP[i], i * gw + gw / 2, (hb * SATS + sb) * gh + gh / 2 + gh * 0.04);
				}
			}
		}
		// extra row for pure accent highlights
		void base;
	}

	function sample() {
		const t = document.createElement("canvas");
		t.width = cols;
		t.height = rows;
		const c = t.getContext("2d", { willReadFrequently: true });
		c.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, cols, rows);
		const d = c.getImageData(0, 0, cols, rows).data;
		albedo = new Float32Array(cols * rows);
		height = new Float32Array(cols * rows);
		hueBin = new Uint8Array(cols * rows);
		let lo = 1;
		let hi = 0;
		for (let i = 0; i < cols * rows; i++) {
			const r = d[i * 4] / 255;
			const g = d[i * 4 + 1] / 255;
			const b = d[i * 4 + 2] / 255;
			const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
			albedo[i] = L;
			lo = Math.min(lo, L);
			hi = Math.max(hi, L);
			const [h, s] = rgbToHsv(r, g, b);
			hueBin[i] = Math.min(HUES - 1, Math.floor(h * HUES)) * SATS + Math.min(SATS - 1, Math.floor(s * SATS * 1.15));
		}
		for (let i = 0; i < albedo.length; i++) albedo[i] = Math.min(1, Math.max(0, (albedo[i] - lo) / (hi - lo + 1e-4)));
		// local contrast: subtract a wide blur so facial features pop out of the backdrop
		const wide = new Float32Array(albedo.length);
		const R = Math.max(3, Math.round(cols / 14));
		const rowAcc = new Float32Array(albedo.length);
		for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
			let sum = 0; let n = 0;
			for (let dx = -R; dx <= R; dx++) { const xx = x + dx; if (xx >= 0 && xx < cols) { sum += albedo[y * cols + xx]; n++; } }
			rowAcc[y * cols + x] = sum / n;
		}
		for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
			let sum = 0; let n = 0;
			for (let dy = -R; dy <= R; dy++) { const yy = y + dy; if (yy >= 0 && yy < rows) { sum += rowAcc[yy * cols + x]; n++; } }
			wide[y * cols + x] = sum / n;
		}
		for (let i = 0; i < albedo.length; i++) albedo[i] = Math.min(1, Math.max(0, 0.5 + (albedo[i] - wide[i]) * 2.6 + (albedo[i] - 0.5) * 0.45));
		// the photo's backdrop is blue while skin and hair are warm: calm the backdrop so the face reads
		for (let i = 0; i < albedo.length; i++) {
			const br = d[i * 4 + 2] / 255 - d[i * 4] / 255;
			const w = Math.min(1, Math.max(0, (br - 0.02) / 0.14));
			const target = dark ? 0.1 + albedo[i] * 0.18 : 0.88 - (1 - albedo[i]) * 0.12;
			albedo[i] = albedo[i] + (target - albedo[i]) * w * 0.9;
		}
		// height = blurred luminance (gives the face a bit of relief for the light to play on)
		const tmp = new Float32Array(albedo.length);
		for (let pass = 0; pass < 2; pass++) {
			const src = pass === 0 ? albedo : tmp;
			const dst = pass === 0 ? tmp : height;
			for (let y = 0; y < rows; y++) {
				for (let x = 0; x < cols; x++) {
					let s = 0;
					let n = 0;
					for (let dy = -1; dy <= 1; dy++) {
						for (let dx = -1; dx <= 1; dx++) {
							const xx = Math.min(cols - 1, Math.max(0, x + dx));
							const yy = Math.min(rows - 1, Math.max(0, y + dy));
							s += src[yy * cols + xx];
							n++;
						}
					}
					dst[y * cols + x] = s / n;
				}
			}
		}
	}

	function layout() {
		const r = portrait.getBoundingClientRect();
		size = Math.max(40, r.width);
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		cols = Math.max(36, Math.min(96, Math.round(size / 4.6)));
		cw = size / cols;
		ch = cw * 1.85;
		rows = Math.floor(size / ch);
		canvas.width = Math.round(size * dpr);
		canvas.height = Math.round(rows * ch * dpr);
		canvas.style.height = `${(rows * ch) / size * 100}%`;
		canvas.style.top = `${((size - rows * ch) / 2 / size) * 100}%`;
		buildAtlas();
		if (img.complete && img.naturalWidth) sample();
	}

	// light state in portrait-normalised space (-1..1, y down)
	const light = { x: -0.6, y: -0.55, z: 0.7, tx: -0.6, ty: -0.55, tz: 0.7 };
	let lastMove = -1e9;
	const pointer = trackPointer(portrait, {
		onMove(s) {
			const r = portrait.getBoundingClientRect();
			light.tx = ((s.x / r.width) * 2 - 1) * 1.15;
			light.ty = ((s.y / r.height) * 2 - 1) * 1.15;
			const d = Math.hypot(Math.max(0, Math.abs(light.tx) - 1), Math.max(0, Math.abs(light.ty) - 1));
			light.tz = 0.45 + 0.35 * Math.min(1, d);
			lastMove = performance.now();
			loop?.kick(reducedMotion ? 30 : 1);
		},
	});

	function render(dt, t) {
		if (!albedo) return;
		const active = performance.now() - lastMove < 3500;
		if (!active && !reducedMotion) {
			light.tx = Math.cos(t * 0.55) * 0.85;
			light.ty = Math.sin(t * 0.43) * 0.7 - 0.15;
			light.tz = 0.6;
		}
		const k = Math.min(1, dt * (active ? 12 : 3));
		light.x += (light.tx - light.x) * k;
		light.y += (light.ty - light.y) * k;
		light.z += (light.tz - light.z) * k;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		const gw = Math.ceil(cw * dpr);
		const gh = Math.ceil(ch * dpr);
		const sx = canvas.width / cols;
		const sy = canvas.height / rows;
		const S = 5.5;
		for (let y = 0; y < rows; y++) {
			const v = (((y + 0.5) / rows) * 2 - 1) * (rows * ch) / size;
			for (let x = 0; x < cols; x++) {
				const u = ((x + 0.5) / cols) * 2 - 1;
				const rr = Math.hypot(u, v);
				if (rr > 1.0) continue; // circular crop like the real portrait
				const i = y * cols + x;
				const xl = height[y * cols + Math.max(0, x - 1)];
				const xr = height[y * cols + Math.min(cols - 1, x + 1)];
				const yt = height[Math.max(0, y - 1) * cols + x];
				const yb = height[Math.min(rows - 1, y + 1) * cols + x];
				let nx = -(xr - xl) * S;
				let ny = -(yb - yt) * S;
				let nl = Math.hypot(nx, ny, 1);
				nx /= nl;
				ny /= nl;
				const nz = 1 / nl;
				let lx = light.x - u;
				let ly = light.y - v;
				let lz = light.z;
				const ll = Math.hypot(lx, ly, lz);
				lx /= ll;
				ly /= ll;
				lz /= ll;
				const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
				let hx = lx;
				let hy = ly;
				let hz = lz + 1;
				const hl = Math.hypot(hx, hy, hz);
				const spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hl), 22);
				const atten = 1 / (1 + 0.55 * ll * ll);
				const a = albedo[i];
				let lit = a * ((dark ? 0.16 : 0.5) + (dark ? 1.35 : 1.0) * diff * atten) + spec * 0.5 * atten;
				lit = Math.min(1, Math.max(0, lit));
				const ink = dark ? lit : Math.pow(1 - lit, 1.5);
				const ci = Math.min(RAMP.length - 1, Math.floor(ink * (RAMP.length - 0.01)));
				if (ci <= 0) continue;
				ctx.drawImage(atlas, ci * gw, hueBin[i] * gh, gw, gh, x * sx, y * sy, sx, sy);
				if (spec > 0.28 && ci > 2) {
					// accent glints on the brightest highlights
					ctx.globalAlpha = Math.min(1, spec * 0.9);
					ctx.fillStyle = css(colors.squiggle);
					ctx.fillRect(x * sx + sx * 0.3, y * sy + sy * 0.3, sx * 0.4, sy * 0.4);
					ctx.globalAlpha = 1;
				}
			}
		}
	}

	img.onload = () => {
		if (!alive) return;
		layout();
		loop = createLoop(render, { continuous: !reducedMotion, fps: 30 });
		loop.kick(reducedMotion ? 3 : 1);
		render(0.016, 0);
		portrait.closest(".site")?.classList.add("ascii-ready");
	};
	if (img.complete && img.naturalWidth) img.onload();

	let rt = 0;
	const ro = new ResizeObserver(() => {
		clearTimeout(rt);
		rt = setTimeout(() => {
			if (!img.naturalWidth) return;
			layout();
			loop?.kick(reducedMotion ? 3 : 2);
		}, 120);
	});
	ro.observe(portrait);

	return () => {
		alive = false;
		loop?.stop();
		ro.disconnect();
		clearTimeout(rt);
		pointer.destroy();
		canvas.remove();
		hint.remove();
	};
}
