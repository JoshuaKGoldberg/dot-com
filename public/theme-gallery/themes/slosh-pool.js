// #67 Slosh Pool: a double-density-relaxation particle fluid along the bottom of the viewport.
// Rendered as a smoothed density field (metaballs) with surface lighting. Scroll tilts the container,
// the pointer is a plunger, a click drops a stone.
import { bindKeys, clamp, createLoop, createPill, dprCap, isInteractiveTarget } from "./physics-kit/kit.js";
import { Fluid } from "./slosh-pool/sph.js";

const CELL = 3; // field cell size in css px
const SLEEP_SPEED = 0.012;

export function activate({ root, reducedMotion, mode }) {
	const dark = mode === "dark";
	const scenery = root.querySelector(".scenery-a");
	const overlay = root.querySelector(".overlay-a");
	if (!scenery || !overlay) return undefined;

	const water = document.createElement("canvas");
	water.className = "slosh-water";
	water.setAttribute("aria-hidden", "true");
	scenery.append(water);
	const wctx = water.getContext("2d");
	const stoneCanvas = document.createElement("canvas");
	stoneCanvas.className = "slosh-stones";
	stoneCanvas.setAttribute("aria-hidden", "true");
	overlay.append(stoneCanvas);
	const sctx = stoneCanvas.getContext("2d");

	let fluid;
	let VW = 0;
	let VH = 0;
	let poolH = 0;
	let hpx = 26; // px per h-unit
	let gw = 0;
	let gh = 0;
	let img;
	let field;
	let kernel;
	let kR = 0;
	let dpr = 1;
	let tilt = 0;
	let tiltV = 0;
	let stones = [];
	let lastScroll = root.scrollTop;
	let calm = 0;
	const pointer = { x: -999, y: -999, vx: 0, vy: 0, t: -1e9, on: false };
	let nowT = 0;

	function layout() {
		const rr = root.getBoundingClientRect();
		VW = rr.width;
		VH = rr.height;
		poolH = Math.round(clamp(VH * 0.62, 260, 560));
		const level = clamp(VH * 0.17, 90, 150);
		const s = clamp(Math.sqrt((VW * level) / (0.92 * 900)), 11, 19);
		hpx = s * 2;
		const n = Math.floor((VW * level) / (s * s * 0.92));
		fluid = new Fluid({ n, width: VW / hpx, height: poolH / hpx, spacing: 0.5, k: 0.1, kNear: 0.4, visc: 0.3 });
		fluid.fill();
		fluid.gy = 0.4167 / hpx;
		fluid.gx = 0;
		dpr = dprCap(1.5);
		gw = Math.ceil(VW / CELL);
		gh = Math.ceil(poolH / CELL);
		water.width = gw;
		water.height = gh;
		water.style.height = `${poolH}px`;
		stoneCanvas.width = Math.round(VW * dpr);
		stoneCanvas.height = Math.round(VH * dpr);
		img = wctx.createImageData(gw, gh);
		field = new Float32Array(gw * gh);
		// Splat kernel.
		const rk = hpx * 1.0;
		kR = Math.ceil(rk / CELL);
		const size = kR * 2 + 1;
		kernel = new Float32Array(size * size);
		for (let j = 0; j < size; j++) {
			for (let i = 0; i < size; i++) {
				const r2 = ((i - kR) ** 2 + (j - kR) ** 2) * (CELL / rk) ** 2;
				kernel[j * size + i] = r2 < 1 ? (1 - r2) ** 2 : 0;
			}
		}
	}

	// ---------------------------------------------------------------- simulate

	function step() {
		nowT += 1 / 60;
		// Container tilt: damped spring that sloshes back after scroll kicks.
		tiltV += -0.045 * tilt - 0.06 * tiltV;
		tilt += tiltV;
		tilt = clamp(tilt, -0.7, 0.7);
		const g = 0.4167 / hpx;
		fluid.gx = g * Math.sin(tilt) * 1.6;
		fluid.gy = g * Math.cos(tilt);
		// Pointer plunger: a moving circle plus velocity blending.
		const obstacles = [];
		const active = nowT - pointer.t < 1.2 && pointer.y > VH - poolH - 30;
		const py = pointer.y - (VH - poolH);
		if (active) obstacles.push({ x: pointer.x / hpx, y: py / hpx, r: 15 / hpx });
		// Stones.
		for (const st of stones) {
			const gyPx = 1500 / 3600;
			let sub = 0;
			const sy = st.y - (VH - poolH);
			if (sy + st.r > 0) {
				const f = clamp((sy + st.r) / (st.r * 2), 0, 1);
				sub = f;
			}
			st.vy += gyPx * (1 - 0.82 * sub);
			st.vx *= 1 - 0.04 * sub;
			st.vy *= 1 - 0.07 * sub;
			st.x += st.vx;
			st.y += st.vy;
			if (st.y + st.r > VH) {
				st.y = VH - st.r;
				st.vy *= -0.2;
				st.vx *= 0.9;
			}
			st.x = clamp(st.x, st.r, VW - st.r);
			st.age += 1 / 60;
			obstacles.push({ x: st.x / hpx, y: (st.y - (VH - poolH)) / hpx, r: st.r / hpx });
		}
		stones = stones.filter((s) => s.age < 7);
		fluid.obstacles = obstacles;
		if (active) {
			// Drag nearby water along with the plunger.
			const R = 70 / hpx;
			const px = pointer.x / hpx;
			const pyh = py / hpx;
			const vx = (pointer.vx / hpx) / 60;
			const vy = (pointer.vy / hpx) / 60;
			for (let i = 0; i < fluid.n; i++) {
				const dx = fluid.x[i * 2] - px;
				const dy = fluid.x[i * 2 + 1] - pyh;
				const d2 = dx * dx + dy * dy;
				if (d2 < R * R) {
					const w = (1 - Math.sqrt(d2) / R) ** 2 * 0.25;
					fluid.v[i * 2] += (vx - fluid.v[i * 2]) * w;
					fluid.v[i * 2 + 1] += (vy - fluid.v[i * 2 + 1]) * w;
				}
			}
			pointer.vx *= 0.85;
			pointer.vy *= 0.85;
		}
		fluid.step(1);
		const resting = fluid.speed < SLEEP_SPEED && Math.abs(tilt) < 0.004 && Math.abs(tiltV) < 0.0008 && !stones.length && !active;
		calm = resting ? calm + 1 : 0;
		return calm < 30;
	}

	// ---------------------------------------------------------------- render

	const LIGHT = dark
		? { shallow: [74, 214, 214], deep: [10, 62, 118], foam: [210, 255, 250], a: 0.9 }
		: { shallow: [110, 205, 240], deep: [26, 110, 196], foam: [255, 255, 255], a: 0.86 };

	function render() {
		field.fill(0);
		const { x, n } = fluid;
		const size = kR * 2 + 1;
		const inv = CELL / hpx; // not used for positions; px→cell below
		void inv;
		for (let i = 0; i < n; i++) {
			const cx = Math.round((x[i * 2] * hpx) / CELL);
			const cy = Math.round((x[i * 2 + 1] * hpx) / CELL);
			for (let j = 0; j < size; j++) {
				const yy = cy + j - kR;
				if (yy < 0 || yy >= gh) continue;
				const row = yy * gw;
				const krow = j * size;
				for (let k = 0; k < size; k++) {
					const xx = cx + k - kR;
					if (xx < 0 || xx >= gw) continue;
					field[row + xx] += kernel[krow + k];
				}
			}
		}
		const data = img.data;
		const THR = 1.35; // surface iso-level (kernel is wider now)
		const sh = LIGHT.shallow;
		const dp = LIGHT.deep;
		const fm = LIGHT.foam;
		const run = new Int16Array(gw).fill(-1);
		const deepCells = 55 / (CELL / 3);
		for (let yy = 0; yy < gh; yy++) {
			for (let xx = 0; xx < gw; xx++) {
				const idx = yy * gw + xx;
				const d = field[idx];
				const o = idx * 4;
				if (d < THR * 0.8) {
					data[o + 3] = 0;
					run[xx] = -1;
					continue;
				}
				run[xx] = run[xx] < 0 ? 0 : run[xx] + 1;
				const gx = (xx < gw - 1 ? field[idx + 1] : d) - (xx > 0 ? field[idx - 1] : d);
				const gy = (yy < gh - 1 ? field[idx + gw] : d) - (yy > 0 ? field[idx - gw] : d);
				const edge = clamp((d - THR * 0.8) / (THR * 0.3), 0, 1);
				const depth = clamp(run[xx] / deepCells, 0, 1);
				// Lighting only matters near the free surface.
				const near = clamp(1 - (d - THR) / 1.6, 0, 1);
				const lit = clamp(-(gx * -0.45 + gy * -0.9) * 0.45, -0.7, 1) * near;
				const topLine = run[xx] < 4 ? 0.55 - run[xx] * 0.12 : 0;
				let r = sh[0] + (dp[0] - sh[0]) * depth;
				let g = sh[1] + (dp[1] - sh[1]) * depth;
				let b = sh[2] + (dp[2] - sh[2]) * depth;
				const foam = clamp(Math.max(lit * 0.55, 0) + topLine * 0.75 + near * 0.16, 0, 0.85);
				r += (fm[0] - r) * foam;
				g += (fm[1] - g) * foam;
				b += (fm[2] - b) * foam;
				if (lit < 0) {
					const t = -lit * 0.3;
					r *= 1 - t;
					g *= 1 - t;
					b *= 1 - t;
				}
				data[o] = r;
				data[o + 1] = g;
				data[o + 2] = b;
				data[o + 3] = 255 * LIGHT.a * edge;
			}
		}
		wctx.putImageData(img, 0, 0);
		renderStones();
	}

	let stonesDrawn = false;
	function renderStones() {
		if (!stones.length) {
			if (stonesDrawn) {
				sctx.setTransform(1, 0, 0, 1, 0, 0);
				sctx.clearRect(0, 0, stoneCanvas.width, stoneCanvas.height);
				stonesDrawn = false;
			}
			return;
		}
		stonesDrawn = true;
		sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		sctx.clearRect(0, 0, VW, VH);
		for (const st of stones) {
			const fade = clamp((7 - st.age) / 1.2, 0, 1);
			sctx.globalAlpha = fade;
			const g = sctx.createRadialGradient(st.x - st.r * 0.35, st.y - st.r * 0.4, 1, st.x, st.y, st.r);
			g.addColorStop(0, `hsl(${st.hue} 55% 78%)`);
			g.addColorStop(0.6, `hsl(${st.hue} 45% 50%)`);
			g.addColorStop(1, `hsl(${st.hue} 50% 28%)`);
			sctx.fillStyle = g;
			sctx.beginPath();
			sctx.arc(st.x, st.y, st.r, 0, 7);
			sctx.fill();
		}
		sctx.globalAlpha = 1;
	}

	const loop = createLoop({
		hz: 60,
		maxSteps: 2,
		step,
		render,
		onStop: () => render(),
	});

	// ---------------------------------------------------------------- input

	function onScroll() {
		const d = root.scrollTop - lastScroll;
		lastScroll = root.scrollTop;
		if (reducedMotion || !d) return;
		tiltV += clamp(d * 0.0016, -0.06, 0.06);
		// A vertical shove too: the page "pushes" the water as it moves.
		const dv = clamp(-d * 0.0004, -0.04, 0.04);
		for (let i = 0; i < fluid.n; i++) fluid.v[i * 2 + 1] += dv * (0.5 + 0.5 * Math.sin(fluid.x[i * 2] * 0.7));
		calm = 0;
		loop.start();
	}

	function onMove(e) {
		const r = root.getBoundingClientRect();
		const x = e.clientX - r.left;
		const y = e.clientY - r.top;
		const dt = Math.max(1, nowT - pointer.t) ;
		void dt;
		pointer.vx = pointer.vx * 0.4 + (x - pointer.x) * 60 * 0.6;
		pointer.vy = pointer.vy * 0.4 + (y - pointer.y) * 60 * 0.6;
		pointer.x = x;
		pointer.y = y;
		if (y > VH - poolH - 30) {
			pointer.t = nowT + 0.001;
			calm = 0;
			loop.start();
		}
	}

	function dropStone(x, y) {
		stones.push({ x, y, vx: (Math.random() - 0.5) * 2, vy: 0, r: 13 + Math.random() * 8, hue: 190 + Math.random() * 60, age: 0 });
		if (stones.length > 8) stones.shift();
		calm = 0;
		loop.start();
	}

	function onDown(e) {
		if (e.button !== 0 || isInteractiveTarget(e.target) || getSelection()?.toString()) return;
		const r = root.getBoundingClientRect();
		if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
		dropStone(e.clientX - r.left, e.clientY - r.top);
	}

	function slosh() {
		tiltV += 0.05;
		calm = 0;
		loop.start();
	}

	function surge() {
		for (let i = 0; i < fluid.n; i++) fluid.v[i * 2 + 1] -= 0.07 * Math.random() + 0.03;
		calm = 0;
		loop.start();
	}

	createPill(root, {
		pos: "left",
		hint: "Scroll to slosh · stir with the pointer · click to drop a stone",
		items: [
			{ id: "slosh", label: "Slosh", key: "w", primary: true, title: "Tip the pool and let it roll", onClick: slosh },
			{ id: "surge", label: "Splash", key: "x", title: "Heave the water upward", onClick: surge },
		],
	});
	const removeKeys = bindKeys({ w: slosh, x: surge });

	const ro = new ResizeObserver(() => {
		layout();
		render();
	});

	layout();
	render();
	ro.observe(root);
	root.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("pointermove", onMove, { passive: true });
	window.addEventListener("pointerdown", onDown);
	if (!reducedMotion) {
		tiltV = 0.03; // a hello slosh
		loop.start();
	}

	return () => {
		loop.stop();
		ro.disconnect();
		removeKeys();
		root.removeEventListener("scroll", onScroll);
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerdown", onDown);
		water.remove();
		stoneCanvas.remove();
	};
}
