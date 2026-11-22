import { createEngine, idleChain, isDark, addCanvas, sizeCanvas, Parallax, ridgeCanvas, makePineVariants, RibbonAurora, canvasLayer, rng, hex, rgba, clamp, lerp, TAU, AURORA_DARK, AURORA_LIGHT } from "./_aurora-e/kit.js";

function discSprite(rgb, a, soft) {
	const S = 128, c = document.createElement("canvas");
	c.width = c.height = S;
	const x = c.getContext("2d"), r = S / 2;
	const g = x.createRadialGradient(r, r, 0, r, r, r);
	g.addColorStop(0, rgba(rgb, a * 0.5));
	g.addColorStop(0.72, rgba(rgb, a * 0.62));
	g.addColorStop(0.9, rgba(rgb, a * (soft ? 0.7 : 1)));  // brighter rim, like a real out-of-focus highlight
	g.addColorStop(0.97, rgba(rgb, a * (soft ? 0.3 : 0.5)));
	g.addColorStop(1, rgba(rgb, 0));
	x.fillStyle = g; x.fillRect(0, 0, S, S);
	return c;
}

// Paints spruce boughs radiating from a corner into a (low-res) canvas context. Shapes are drawn once.
function paintBoughs(ctx, W, H, dark, sc, mx) {
	const r = rng(58);
	const cols = dark ? ["#050a14", "#08101c", "#0b1626"] : ["#1d4a3f", "#173f37", "#245a4a"];
	const corners = [[0, 0, 1, 1, 1], [1, 0, -1, 1, 0.95], [0, 1, 1, -1, 0.55], [1, 1, -1, -1, 0.5]];
	for (const [cx0, cy0, dx, dy, size] of corners) {
		const ox = cx0 ? W - mx * sc * 0 : 0, oy = cy0 ? H : 0;
		const n = Math.round(4 * size) + 2;
		for (let b = 0; b < n; b++) {
			const ang = lerp(0.1, 1.45, (b + r()) / n); // radians away from the horizontal edge
			const len = (110 + r() * 130) * size * sc;
			const sx = ox + dx * (mx * sc), sy = oy + dy * (r() * 60 * sc);
			const bx = sx + dx * Math.cos(ang) * len, by = sy + dy * Math.sin(ang) * len * 0.9 + dy * len * 0.18;
			const mxp = (sx + bx) / 2 + dx * 10 * sc, myp = (sy + by) / 2 - dy * 40 * sc * (r() - 0.2);
			ctx.strokeStyle = cols[b % 3]; ctx.lineCap = "round";
			ctx.lineWidth = (14 + r() * 8) * sc * size;
			ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mxp, myp, bx, by); ctx.stroke();
			// needle fans along the branch
			const steps = Math.round(len / (9 * sc));
			for (let i = 0; i < steps; i++) {
				const t = i / steps;
				const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mxp + t * t * bx;
				const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * myp + t * t * by;
				const tx = 2 * (1 - t) * (mxp - sx) + 2 * t * (bx - mxp), ty = 2 * (1 - t) * (myp - sy) + 2 * t * (by - myp);
				const a0 = Math.atan2(ty, tx);
				const nl = (34 + r() * 26) * sc * size * (1 - t * 0.5);
				ctx.strokeStyle = cols[(i + b) % 3];
				ctx.lineWidth = (8 + r() * 4) * sc;
				for (const sd of [-1, 1]) {
					const a = a0 + sd * (0.7 + r() * 0.5);
					ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * nl, py + Math.sin(a) * nl); ctx.stroke();
				}
			}
		}
	}
}

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const sceneryB = root.querySelector(".scenery-b");
	const sceneryC = root.querySelector(".scenery-c");
	const overlay = root.querySelector(".overlay-a");
	const par = new Parallax();
	const cA = addCanvas(sceneryB, "left:0;top:0;width:100%;height:100%"); // faint, very soft aurora
	const cD = addCanvas(sceneryB, "left:0;top:0;width:100%;height:100%"); // bokeh discs
	let ctxA, ctxD;
	const SA = 0.12, SD = 0.5;
	const aur = new RibbonAurora({ dark, alpha: dark ? 0.32 : 0.3, rays: 0.05, bands: 3, hgt: 170, soft: true });
	const pal = (dark ? AURORA_DARK : AURORA_LIGHT);
	const sprites = pal.map((c) => [discSprite(c, dark ? 0.34 : 0.34, false), discSprite(c, dark ? 0.3 : 0.3, true)]);
	const r = rng(21);
	const N = 40;
	const discs = Array.from({ length: N }, (_, i) => ({
		u: r(), v: r(), band: (r() * 3) | 0, rad: 9 + Math.pow(r(), 2.2) * 66, soft: r() < 0.45, z: 0.3 + r() * 0.7,
		a: 0.35 + r() * 0.65, p: r() * TAU, sp: 0.05 + r() * 0.12, ox: 0, oy: 0,
	}));
	let built = false, cancel = () => {};
	const layersHost = document.createElement("div");
	layersHost.style.cssText = "position:absolute;inset:0;pointer-events:none";
	sceneryC.appendChild(layersHost);
	let boughHost = null;

	function draw(s) {
		const sc = SA;
		const W = cA.width, H = cA.height;
		const ph = s.phase + s.drift * 0.05;
		aur.draw(ctxA, W, H, { cx: s.x * sc, cy: s.y * sc, phase: ph, scale: sc });
		const D = ctxD, w = cD.width, h = cD.height, k = SD;
		D.clearRect(0, 0, w, h);
		D.globalCompositeOperation = dark ? "lighter" : "source-over";
		const sig = s.w * 0.2;
		const t = s.drift;
		for (const d of discs) {
			const u = d.u;
			const base = s.h * (0.2 + d.band * 0.06) + 36 * Math.sin(u * 3.2 + d.band * 2 + ph * 0.55) + 18 * Math.sin(u * 8.1 - ph * 0.8);
			let x = u * s.w * 1.04 - 0.02 * s.w + Math.sin(t * d.sp + d.p) * 14 * d.z - s.px * 36 * d.z;
			let y = base - d.v * (170 + 40 * Math.sin(u * 4.7 + d.band)) + Math.cos(t * d.sp * 0.8 + d.p) * 8;
			const dxc = x - s.x;
			const g = Math.exp(-(dxc * dxc) / (2 * sig * sig));
			x -= dxc * 0.32 * g * d.z; // drift toward the cursor
			y += (s.y + 30 - y) * 0.3 * g;
			const rad = d.rad * (1 + 0.28 * g) * (0.9 + 0.2 * Math.sin(t * d.sp * 2 + d.p));
			const fade = clamp(1 - Math.max(0, y - s.h * 0.5) / (s.h * 0.15), 0, 1) * clamp((y - 80) / 70, 0, 1);
			D.globalAlpha = clamp(d.a * (0.55 + 0.9 * g) * (dark ? 1 : 0.9) * fade * (0.65 + 0.35 * d.v), 0, 1);
			if (D.globalAlpha < 0.01) continue;
			D.drawImage(sprites[d.band][d.soft ? 1 : 0], (x - rad) * k, (y - rad) * k, rad * 2 * k, rad * 2 * k);
		}
		D.globalAlpha = 1; D.globalCompositeOperation = "source-over";
	}

	const eng = createEngine({
		root, reduced: reducedMotion, host: sceneryB, rest: [0.64, 0.3], follow: 4,
		onResize(s) {
			ctxA = sizeCanvas(cA, s.w, s.h, SA);
			ctxD = sizeCanvas(cD, s.w, s.h, SD);
			if (built) rebuild(s);
		},
		onFrame(s) {
			if (!s.busy && !s.force && s.tick % 2) { /* throttle idle drift */ } else draw(s);
			par.apply(s);
			return !reducedMotion;
		},
	});

	function rebuild(s) {
		cancel();
		layersHost.textContent = ""; boughHost?.remove(); par.items = [];
		const { w, h } = s;
		const variants = makePineVariants(258, 8);
		const cols = dark ? [[16, 32, 58], [18, 36, 64], [20, 40, 70]] : [[92, 140, 130], [84, 132, 124], [100, 150, 138]];
		const q = dark ? { top: [20, 38, 66], bottom: [30, 56, 88], shade: [12, 24, 48] } : { top: [140, 175, 182], bottom: [190, 214, 212], shade: [110, 150, 160] };
		cancel = idleChain([
			() => { // soft, defocused distant ridge + treeline below
				const el = ridgeCanvas({ w, h, dpr: 0.1, geo: { baseY: h * 0.76, amp: h * 0.14, scale: w * 0.22, seed: 61, power: 1.2 }, pal: q, variants, treeCols: cols, forest: { rows: 2, rowGap: 14, tree: [34, 52], gap: [14, 22], seed: 71 } });
				layersHost.appendChild(el); par.add(el, 14);
			},
			() => {
				const mx = 110, lw = w + mx * 2, lh = h + 100;
				const el = document.createElement("canvas");
				const sc = 0.4;
				const tmp = document.createElement("canvas");
				const tc = sizeCanvas(tmp, lw, lh, sc);
				paintBoughs(tc, tmp.width, tmp.height, dark, sc, mx);
				const c = sizeCanvas(el, lw, lh, sc);
				c.filter = "blur(5px)"; // one-time bake of the out-of-focus look
				c.drawImage(tmp, 0, 0);
				c.filter = "none";
				el.style.cssText = `position:absolute;left:${-mx}px;top:-50px;width:${lw}px;height:${lh}px;pointer-events:none`;
				boughHost = document.createElement("div");
				boughHost.style.cssText = "position:absolute;inset:0;pointer-events:none";
				boughHost.appendChild(el);
				overlay.appendChild(boughHost);
				par.add(el, 70, { scroll: 0.5 });
			},
			() => { built = true; eng.start(); },
		]);
	}
	const c1 = idleChain([() => rebuild(eng.s)]);
	eng.start();
	return () => { c1(); cancel(); eng.destroy(); cA.remove(); cD.remove(); layersHost.remove(); boughHost?.remove(); };
}
