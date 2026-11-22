// #298 Horizon Scroll: a low, soft horizon of ridges and lake fixed along the bottom of the window.
// The ridge layers are cached canvases moved only by transform on scroll; the aurora sits above.
import { createRig, GLCanvas, BAND_FS, idle, rng, clamp, scrollAway } from "./_medium-e/kit.js";

const PAL = {
	light: {
		ridges: [
			{ rgb: [140, 170, 198], a: 0.2, k: 0.14, base: 0.52, amp: 0.3, sc: 0.3, seed: 3 },
			{ rgb: [112, 150, 180], a: 0.24, k: 0.3, base: 0.66, amp: 0.22, sc: 0.2, seed: 11 },
			{ rgb: [96, 136, 164], a: 0.28, k: 0.55, base: 0.8, amp: 0.14, sc: 0.13, seed: 23 },
		],
		mist: [255, 255, 255, 0.5], lake: [[150, 190, 214, 0.22], [190, 214, 228, 0.14]], glint: [255, 255, 255, 0.8], reflect: 0.6,
	},
	dark: {
		ridges: [
			{ rgb: [44, 66, 112], a: 0.5, k: 0.14, base: 0.52, amp: 0.3, sc: 0.3, seed: 3 },
			{ rgb: [32, 50, 92], a: 0.62, k: 0.3, base: 0.66, amp: 0.22, sc: 0.2, seed: 11 },
			{ rgb: [20, 34, 70], a: 0.78, k: 0.55, base: 0.8, amp: 0.14, sc: 0.13, seed: 23 },
		],
		mist: [90, 130, 190, 0.2], lake: [[22, 38, 76, 0.75], [14, 24, 52, 0.4]], glint: [150, 200, 230, 0.22], reflect: 0.45,
	},
};

function ridgeY(x, o, w, h) {
	const r = o.seed;
	const u = x / (w * o.sc);
	const n = Math.sin(u * 2.1 + r) * 0.5 + Math.sin(u * 4.7 + r * 1.7) * 0.28 + Math.sin(u * 9.3 + r * 2.9) * 0.1;
	return h * (o.base - o.amp * (0.5 + 0.5 * n) * 0.9);
}

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const P = dark ? PAL.dark : PAL.light;
	const host = root.querySelector(".scenery-b") ?? root;
	const sky = document.createElement("div");
	sky.className = "ma-hz-sky";
	sky.setAttribute("aria-hidden", "true");
	const strip = document.createElement("div");
	strip.className = "ma-hz-strip";
	strip.setAttribute("aria-hidden", "true");
	host.append(sky, strip);
	const gl = new GLCanvas(sky, BAND_FS, { scale: 0.32 });
	const layers = [];
	let rig = null, ro = null, rect = null, pending = 0, cleanup = () => {};

	const build = () => {
		const vw = host.clientWidth || innerWidth;
		const vh = strip.clientHeight;
		const dpr = Math.min(devicePixelRatio || 1, 1.25);
		strip.textContent = "";
		layers.length = 0;
		const mk = (wCss, cls) => {
			const c = document.createElement("canvas");
			c.width = Math.round(wCss * dpr); c.height = Math.round(vh * dpr);
			c.style.cssText = `position:absolute;left:0;top:0;width:${wCss}px;height:${vh}px;will-change:transform`;
			c.className = cls;
			strip.appendChild(c);
			return c;
		};
		const lakeTop = vh * 0.7;
		P.ridges.forEach((o, i) => {
			const extra = vw * o.k;
			const W = vw + extra;
			const c = mk(W, "ma-hz-ridge");
			const x = c.getContext("2d");
			x.scale(dpr, dpr);
			const [r, g, b] = o.rgb;
			const path = (flip) => {
				x.beginPath();
				x.moveTo(0, lakeTop);
				for (let px = 0; px <= W; px += 6) {
					const y = Math.min(ridgeY(px, o, W, vh), lakeTop);
					x.lineTo(px, flip ? lakeTop + (lakeTop - y) * 0.6 : y);
				}
				x.lineTo(W, lakeTop); x.closePath();
			};
			// Ridge above the waterline, soft vertical fade toward the base so the strip stays gentle.
			const gr = x.createLinearGradient(0, vh * (o.base - o.amp), 0, lakeTop);
			gr.addColorStop(0, `rgba(${r},${g},${b},${o.a})`);
			gr.addColorStop(1, `rgba(${r},${g},${b},${o.a * 0.3})`);
			x.fillStyle = gr;
			path(false); x.fill();
			// Reflection in the lake, fainter.
			x.save();
			x.beginPath(); x.rect(0, lakeTop, W, vh - lakeTop); x.clip();
			const gr2 = x.createLinearGradient(0, lakeTop, 0, vh);
			gr2.addColorStop(0, `rgba(${r},${g},${b},${o.a * P.reflect})`);
			gr2.addColorStop(1, `rgba(${r},${g},${b},0)`);
			x.fillStyle = gr2;
			path(true); x.fill();
			x.restore();
			layers.push({ el: c, extra });
		});
		// Lake sheet and mist, behind/above the ridges via z-order of a static canvas.
		const lake = document.createElement("canvas");
		lake.width = Math.round(vw * dpr * 0.5); lake.height = Math.round(vh * dpr * 0.5);
		const lx = lake.getContext("2d");
		lx.scale(dpr * 0.5, dpr * 0.5);
		const lg = lx.createLinearGradient(0, lakeTop, 0, vh);
		lg.addColorStop(0, `rgba(${P.lake[0].slice(0, 3)},${P.lake[0][3]})`);
		lg.addColorStop(1, `rgba(${P.lake[1].slice(0, 3)},${P.lake[1][3]})`);
		lx.fillStyle = lg; lx.fillRect(0, lakeTop, vw, vh - lakeTop);
		const mg = lx.createLinearGradient(0, vh * 0.35, 0, lakeTop + 4);
		mg.addColorStop(0, `rgba(${P.mist[0]},${P.mist[1]},${P.mist[2]},0)`);
		mg.addColorStop(1, `rgba(${P.mist[0]},${P.mist[1]},${P.mist[2]},${P.mist[3]})`);
		lx.fillStyle = mg; lx.fillRect(0, vh * 0.35, vw, lakeTop - vh * 0.35 + 4);
		const rr = rng(5);
		lx.fillStyle = `rgba(${P.glint[0]},${P.glint[1]},${P.glint[2]},${P.glint[3]})`;
		for (let i = 0; i < 28; i++) { const y = lakeTop + 6 + rr() * (vh - lakeTop - 8), w = 20 + rr() * 80; lx.fillRect(rr() * vw, y, w, 0.9); }
		lake.style.cssText = `position:absolute;left:0;top:0;width:${vw}px;height:${vh}px`;
		strip.insertBefore(lake, strip.firstChild);
		apply();
	};
	const apply = () => {
		pending = 0;
		const f = clamp(root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight));
		for (const l of layers) l.el.style.transform = `translate3d(${(-f * l.extra).toFixed(1)}px,0,0)`;
	};
	const onScroll = () => { if (!pending) pending = requestAnimationFrame(apply); };
	root.addEventListener("scroll", onScroll, { passive: true });
	const unscroll = scrollAway(root, sky, { rate: 0.6, fade: 420 });

	const size = () => { rect = sky.getBoundingClientRect(); gl.resize(rect.width, rect.height); };
	const cancelIdle = idle(() => {
		build();
		if (gl.ok) {
			size();
			rig = createRig({
				reduced: reducedMotion, targets: [sky], fps: 22, rest: [0.36, 0.1],
				onFrame(s) {
					const mx = (s.x - rect.left) / rect.width, my = (s.y - rect.top) / rect.height;
					gl.draw({ T: s.t + 12, E: s.energy, DK: dark ? 1 : 0, AMP: dark ? 0.8 : 1.0, FOG: 0.35, RAYS: 0.8, HGT: 0.3, WX: rect.width / 900, M: [mx, my] });
				},
			});
			rig.start();
		} else sky.classList.add("is-fallback");
		ro = new ResizeObserver(() => { build(); if (gl.ok) { size(); rig?.redraw(); } });
		ro.observe(host);
	});
	return () => {
		cancelIdle(); unscroll(); cancelAnimationFrame(pending);
		root.removeEventListener("scroll", onScroll);
		ro?.disconnect(); rig?.destroy(); gl.destroy(); sky.remove(); strip.remove(); cleanup();
	};
}
