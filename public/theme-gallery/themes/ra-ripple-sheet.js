// 310 Ripple Sheet: each margin is a faint aurora sheet that runs a 2D wave equation; the cursor's velocity
// drags ripples through it. Footer: a loon-lake style reflection that ripples on click.
import { topAurora } from "./_refined-b/top.js";
import { createLake } from "./_refined-b/lake.js";
import { createStage, aurora, clamp } from "./_refined-b/sim.js";

const CELL = 5;

export function activate({ root, reducedMotion }) {
	const killTop = topAurora({ root, reducedMotion, level: 1 });
	let G = [null, null];
	let calm = 0;

	function make(sd, dark) {
		const gw = Math.max(4, Math.ceil(sd.w / CELL)), gh = Math.ceil(sd.h / CELL);
		const off = document.createElement("canvas"); off.width = gw; off.height = gh;
		const ctx = off.getContext("2d");
		const base = new Float32Array(gw * gh), col = new Uint8Array(gw * gh * 3);
		return { gw, gh, off, ctx, img: ctx.createImageData(gw, gh), h: new Float32Array(gw * gh), v: new Float32Array(gw * gh), base, col, dark: null };
	}
	function bake(g, st, sd) {
		for (let y = 0; y < g.gh; y++) for (let x = 0; x < g.gw; x++) {
			const u = x / (g.gw - 1), i = y * g.gw + x, yy = y / g.gh;
			const env = Math.pow(1 - u, 0.9) * (0.25 + 0.75 * Math.pow(Math.sin(Math.PI * clamp(yy * 0.95 + 0.04)), 0.7));
			const fold = 0.7 + 0.3 * Math.sin(y * 0.035 + (sd.side === "l" ? 0 : 2));
			const ray = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(x * 0.95 + Math.sin(y * 0.02) * 2.2)) * (0.6 + 0.4 * Math.sin(x * 2.3 + 1));
			g.base[i] = env * fold * ray;
			const c = aurora(0.08 + 0.85 * yy, st.dark);
			g.col[i * 3] = c[0]; g.col[i * 3 + 1] = c[1]; g.col[i * 3 + 2] = c[2];
		}
		g.dark = st.dark;
	}
	const resize = (st) => { G = st.sides.map((sd) => (sd.w ? make(sd) : null)); calm = 0; };

	function step(st, dt) {
		const p = st.ptr, near = p.moved && st.nearMargin();
		let mx = 0;
		for (let si = 0; si < 2; si++) {
			const sd = st.sides[si], g = G[si];
			if (!g) continue;
			if (near && p.speed > 25) {
				const lp = st.local(sd), vx = sd.side === "l" ? p.vx : -p.vx, vy = p.vy, sp = p.speed;
				// a moving source: bump ahead, dip behind (so flicks leave a wake, slow passes a soft swell)
				const amp = Math.min(1, sp / 1100) * 0.09 + 0.01, ux = vx / sp, uy = vy / sp;
				const sig = 2.2 + Math.min(2, sp / 900);
				for (const [s, a] of [[0.9, amp], [-0.9, -amp * 0.7]]) {
					const cx = (lp.x + ux * s * sig * CELL) / CELL, cy = (lp.y + uy * s * sig * CELL) / CELL;
					const R = Math.ceil(sig * 2.5);
					for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
						const x = Math.round(cx) + dx, y = Math.round(cy) + dy;
						if (x < 1 || y < 1 || x >= g.gw - 1 || y >= g.gh - 1) continue;
						const ex = x - cx, ey = y - cy;
						g.v[y * g.gw + x] += a * Math.exp(-(ex * ex + ey * ey) / (2 * sig * sig));
					}
				}
			}
			const { gw, gh, h, v } = g, c2 = 0.34;
			for (let k = 0; k < 2; k++) {
				for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
					const i = y * gw + x;
					const lap = h[i - 1] + h[i + 1] + h[i - gw] + h[i + gw] - 4 * h[i];
					const e = Math.max(x / gw, 1 - x / gw, 0);
					const dmp = 0.9972 - 0.06 * Math.max(0, (e - 0.78) / 0.22) - 0.02 * Math.max(0, (y > gh - 8 ? 1 : 0));
					const nv = (v[i] + c2 * lap) * dmp;
					v[i] = nv; const a = Math.abs(nv) + Math.abs(h[i]); if (a > mx) mx = a;
				}
				for (let i = gw; i < gw * (gh - 1); i++) h[i] += v[i];
			}
		}
		calm = mx < 0.002 ? calm + dt : 0;
		return calm < 0.4;
	}

	function draw(st) {
		for (let si = 0; si < 2; si++) {
			const sd = st.sides[si], g = G[si], ctx = sd.ctx;
			ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
			ctx.clearRect(0, 0, sd.w, sd.h);
			if (!g) continue;
			if (g.dark !== st.dark) bake(g, st, sd);
			const d = g.img.data, { gw, gh, h, base, col } = g;
			const A0 = st.dark ? 0.24 : 0.3;
			for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
				const i = y * gw + x, o = i * 4;
				const hx = x < gw - 1 && x > 0 ? h[i + 1] - h[i - 1] : 0, hy = y < gh - 1 && y > 0 ? h[i + gw] - h[i - gw] : 0;
				const env = base[i];
				// surface height brightens the sheet; slope catches light (ripple crests)
				const lit = Math.min(1, Math.abs(hx) * 2.2 + Math.abs(hy) * 2.2);
				const hh = h[i] * 1.8;
				let a = A0 * env * (1 + 3 * hh) + lit * 0.35 * Math.sqrt(env + 0.05) * (st.dark ? 1 : 0.8);
				a = Math.max(0, Math.min(0.7, a));
				d[o] = col[i * 3] + lit * 25; d[o + 1] = col[i * 3 + 1] + lit * 25; d[o + 2] = col[i * 3 + 2] + lit * 25; d[o + 3] = a * 255;
			}
			g.ctx.putImageData(g.img, 0, 0);
			ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
			if (sd.side === "r") { ctx.translate(sd.w, 0); ctx.scale(-1, 1); }
			ctx.drawImage(g.off, 0, 0, sd.w, sd.h);
		}
	}
	const stage = createStage({ root, host: root.querySelector(".scenery-c"), reducedMotion, reach: 170, step, draw, resize });
	const killLake = createLake({ root, reducedMotion });
	return () => { killLake(); stage.destroy(); killTop(); };
}
