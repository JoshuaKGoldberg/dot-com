// #299 Contour Margins: topographic contour lines fill both margins; contours near the cursor
// glow in aurora colors. Static line canvases are drawn once; only a small glow canvas animates.
import { createRig, idle, clamp, smooth, heightField, contourSegments } from "./_medium-e/kit.js";

const AUR_D = [[70, 255, 170], [70, 205, 255], [170, 130, 255], [255, 120, 170]];
const AUR_L = [[20, 170, 120], [30, 140, 220], [130, 90, 220], [215, 80, 140]];
const LEVELS = Array.from({ length: 26 }, (_, i) => 0.07 + i * 0.045);

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const AUR = dark ? AUR_D : AUR_L;
	const host = root.querySelector(".scenery-b") ?? root;
	const wrap = document.createElement("div");
	wrap.className = "ma-contours";
	wrap.setAttribute("aria-hidden", "true");
	host.appendChild(wrap);
	const sides = [];
	let rig = null, ro = null, cancelBuild = () => {}, vw = 0, vh = 0, col = [0, 0];
	const line = dark ? "150,185,235" : "70,100,150";

	const mkCanvas = (cls, cssW, cssH, dpr) => {
		const c = document.createElement("canvas");
		c.className = cls;
		c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
		c.style.cssText = `position:absolute;top:0;width:${cssW}px;height:${cssH}px`;
		return c;
	};
	const build = () => {
		wrap.textContent = "";
		sides.length = 0;
		const r = wrap.getBoundingClientRect();
		vw = Math.round(r.width); vh = Math.round(r.height);
		const page = root.querySelector(".site-page");
		const pr = page?.getBoundingClientRect();
		const colW = pr ? Math.min(pr.width, 832 + 48) : vw;
		const innerL = Math.max(0, (vw - colW) / 2), innerR = Math.min(vw, (vw + colW) / 2);
		col = [innerL, innerR];
		const cw = Math.max(32, Math.round(innerL));
		const f = heightField(vw, vh, innerL, innerR);
		const dprS = Math.min(devicePixelRatio || 1, 2);
		for (const side of ["l", "r"]) {
			const x0 = side === "l" ? 0 : vw - cw;
			const segs = contourSegments(f, x0, x0 + cw, vh, 6, LEVELS);
			const base = mkCanvas("ma-c-base", cw, vh, dprS);
			const glowLines = document.createElement("canvas");
			glowLines.width = cw; glowLines.height = vh;
			const glow = mkCanvas("ma-c-glow", cw, vh, 1);
			base.style[side === "l" ? "left" : "right"] = "0";
			glow.style[side === "l" ? "left" : "right"] = "0";
			// horizontal fade toward the text column: strong at the viewport edge, gone at the column edge
			const fadeMask = (ctx, w, h) => {
				ctx.globalCompositeOperation = "destination-in";
				const g = ctx.createLinearGradient(0, 0, w, 0);
				const inner = Math.min(1, 70 / w);
				const stops = side === "l" ? [[0, 1], [1 - inner * 2.2, 1], [1, 0]] : [[0, 0], [inner * 2.2, 1], [1, 1]];
				for (const [p, a] of stops) g.addColorStop(clamp(p), `rgba(0,0,0,${a * (innerL < 40 ? 0.55 : 1)})`);
				ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
				ctx.globalCompositeOperation = "source-over";
			};
			const bctx = base.getContext("2d");
			bctx.scale(dprS, dprS);
			const gctx = glowLines.getContext("2d");
			const tracePath = (ctx, i) => { ctx.beginPath(); for (const [a, b, c, d] of segs[i]) { ctx.moveTo(a - x0, b); ctx.lineTo(c - x0, d); } };
			LEVELS.forEach((lv, i) => {
				const idx = i % 5 === 0;
				bctx.lineCap = "round";
				bctx.lineWidth = idx ? 1.1 : 0.7;
				bctx.strokeStyle = `rgba(${line},${idx ? (dark ? 0.3 : 0.34) : dark ? 0.17 : 0.2})`;
				tracePath(bctx, i); bctx.stroke();
				gctx.lineCap = "round"; gctx.lineWidth = idx ? 1.8 : 1.3; gctx.strokeStyle = "#fff";
				tracePath(gctx, i); gctx.stroke();
			});
			// colour the glow lines with a slow vertical aurora ramp
			gctx.globalCompositeOperation = "source-in";
			const gr = gctx.createLinearGradient(0, 0, 0, vh);
			AUR.forEach((c, k) => gr.addColorStop(k / (AUR.length - 1), `rgb(${c})`));
			gctx.fillStyle = gr; gctx.fillRect(0, 0, cw, vh);
			gctx.globalCompositeOperation = "source-over";
			fadeMask(bctx, cw, vh); // bctx is scaled; cw/vh are css units
			fadeMask(gctx, cw, vh);
			const mask = document.createElement("canvas"); mask.width = cw; mask.height = vh;
			const mctx = mask.getContext("2d"); mctx.fillRect(0, 0, cw, vh); fadeMask(mctx, cw, vh);
			// elevation labels on index contours, drawn after the mask so they stay crisp
			bctx.font = '500 9px "SF Mono", ui-monospace, Menlo, monospace';
			bctx.textAlign = "center"; bctx.textBaseline = "middle";
			bctx.lineJoin = "round";
			let n = 0;
			LEVELS.forEach((lv, i) => {
				if (i % 5 !== 0 || !segs[i].length) return;
				// choose a segment roughly a third of the way down the strong zone, varied per contour
				const want = vh * (0.2 + ((i * 0.37) % 0.6));
				let best = null, bd = 1e9;
				for (const s of segs[i]) {
					const lx = (s[0] + s[2]) / 2 - x0;
					if (lx < cw * 0.25 || lx > cw * 0.75 || lx < 24 || lx > cw - 24) continue;
					const d = Math.abs((s[1] + s[3]) / 2 - want);
					if (d < bd) { bd = d; best = s; }
				}
				if (!best || bd > vh * 0.3) return;
				const mx = (best[0] + best[2]) / 2 - x0, my = (best[1] + best[3]) / 2;
				const txt = String(Math.round(lv * 1000) + 120 * (side === "l" ? 1 : 2));
				bctx.strokeStyle = dark ? "#0a1020" : "#fdffff"; bctx.lineWidth = 5;
				bctx.strokeText(txt, mx, my);
				bctx.fillStyle = `rgba(${line},${dark ? 0.42 : 0.5})`;
				bctx.fillText(txt, mx, my);
				n++;
			});
			wrap.append(base, glow);
			sides.push({ side, x0, cw, glow, ctx: glow.getContext("2d"), lines: glowLines, mask, spot: { x: cw / 2, y: vh * 0.4 }, k: 0 });
		}
		rig?.redraw();
	};

	const paint = (s) => {
		const t = s.t;
		sides.forEach((sd, i) => {
			const { ctx, cw } = sd;
			// target spot in canvas coords: follow the cursor's y; x follows if the cursor is over the margin
			let tx, ty, k;
			if (s.has) {
				const ox = s.x - sd.x0;
				tx = clamp(ox, cw * 0.35, cw * 0.9 > cw ? cw : cw * 0.9);
				if (sd.side === "r") tx = clamp(ox, cw * 0.1, cw * 0.65);
				ty = s.y;
				const dist = Math.max(0, Math.abs(ox - cw / 2) - cw / 2);
				k = 0.4 + 0.6 / (1 + (dist / 420) ** 2);
			} else {
				tx = sd.side === "l" ? cw * 0.5 : cw * 0.5;
				ty = vh * (0.5 + 0.34 * Math.sin(t * 0.09 + i * 2.4 + 0.5));
				k = 0.5;
			}
			const f = reducedMotion ? 1 : 0.18;
			sd.spot.x += (tx - sd.spot.x) * f; sd.spot.y += (ty - sd.spot.y) * f;
			sd.k += (k - sd.k) * f;
			const rad = 150 + 70 * sd.k + 130 * s.energy;
			const { x, y } = sd.spot;
			ctx.clearRect(0, 0, cw, vh);
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = 1;
			ctx.drawImage(sd.lines, 0, 0);
			ctx.globalCompositeOperation = "destination-in";
			const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
			const a = clamp((dark ? 0.95 : 0.9) * (0.55 + 0.45 * sd.k) + 0.2 * s.energy);
			g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.5})`); g.addColorStop(1, "rgba(0,0,0,0)");
			ctx.fillStyle = g; ctx.fillRect(0, 0, cw, vh);
			// soft wash under the lines, so the glow reads as light and not only as lines
			ctx.globalCompositeOperation = "destination-over";
			const c = AUR[Math.floor((y / vh) * 2.99 + t * 0.03 + i) % 4];
			const w = ctx.createRadialGradient(x, y, 0, x, y, rad * 1.25);
			w.addColorStop(0, `rgba(${c},${dark ? 0.2 : 0.17})`); w.addColorStop(1, `rgba(${c},0)`);
			ctx.fillStyle = w; ctx.fillRect(0, 0, cw, vh);
			ctx.globalCompositeOperation = "destination-in";
			ctx.drawImage(sd.mask, 0, 0);
			ctx.globalCompositeOperation = "source-over";
		});
	};

	cancelBuild = idle(() => {
		rig = createRig({ reduced: reducedMotion, targets: [wrap], fps: 14, rest: [0.5, 0.4], follow: 6, onFrame: paint });
		build();
		ro = new ResizeObserver(() => build());
		ro.observe(wrap);
		rig.start();
	});
	return () => { cancelBuild(); ro?.disconnect(); rig?.destroy(); wrap.remove(); };
}
