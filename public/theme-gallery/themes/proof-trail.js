// #199 Proof Trail. A topographic trail map up a peak: waypoints are the steps of a proof, blazes mark the
// lemmas, contour lines are the terrain, and the fire tower at the summit is QED. Scrolling the page walks
// the hiker up the proof.
//
// Parameters (see _adk/kit.js): { seed, date, hour, season, weather, wind, latitude, longitude, tz }
//   seed shapes the terrain and the switchbacks; hour/date move the light; season tints the land.
// generate(params) is pure: a height field (Float32Array), the trail polyline and the waypoints.
import { mountScene, rng, makeNoise, css, mix, mul, clamp, lerp, smooth, blob } from "./_adk/kit.js";

const NX = 160;
const NY = 100;
const ASPECT = 1.6;
const STEPS = [
	["Given", "a trailhead"],
	["Lemma 1", "the pines"],
	["Lemma 2", "the brook"],
	["Claim", "a ridge exists"],
	["By induction", "n → n+1"],
	["Corollary", "the col"],
	["∎", "Q.E.D."],
];

export function generate(p) {
	const rand = rng(p.seed * 71 + 5);
	const noise = makeNoise(p.seed * 7 + 1);
	const sx = 0.64 + rand() * 0.14;
	const sy = 0.3 + rand() * 0.1;
	const h = new Float32Array(NX * NY);
	for (let j = 0; j < NY; j++) {
		for (let i = 0; i < NX; i++) {
			const x = i / (NX - 1);
			const y = j / (NY - 1);
			const d = Math.hypot((x - sx) * ASPECT, y - sy);
			const cone = Math.pow(Math.max(0, 1 - d / 0.62), 1.5);
			const n = noise.fbm2(x * 5.2, y * 5.2, 5);
			const ridge = noise.fbm2(x * 2.1 + 40, y * 2.1, 3);
			h[j * NX + i] = clamp(0.22 + cone * 0.6 + (n - 0.5) * 0.34 * (0.4 + cone) + (ridge - 0.5) * 0.28 + (y < 0.55 ? 0 : 0));
		}
	}
	// trail: serpentine from the trailhead to the summit
	const t0 = [0.2 + rand() * 0.06, 0.9];
	const phase = rand() * 6.28;
	const pts = [];
	for (let i = 0; i <= 160; i++) {
		const t = i / 160;
		const e = t * t * (3 - 2 * t) * 0.5 + t * 0.5;
		const win = Math.min(1, t * 8, (1 - t) * 10);
		const off = Math.sin(t * Math.PI * 6 + phase) * 0.06 * win * (1 - 0.4 * t);
		const bx = lerp(t0[0], sx, e);
		const by = lerp(t0[1], sy + 0.02, e);
		const dx = sx - t0[0];
		const dy = sy - t0[1];
		const L = Math.hypot(dx * ASPECT, dy);
		pts.push([bx + (-dy / L) * off / ASPECT * 1, by + (dx * ASPECT / L) * off]);
	}
	const len = [0];
	for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot((pts[i][0] - pts[i - 1][0]) * ASPECT, pts[i][1] - pts[i - 1][1]));
	const total = len[len.length - 1];
	const wp = STEPS.map((s, i) => {
		const f = i / (STEPS.length - 1);
		const target = f * total;
		let k = 0;
		while (k < len.length - 1 && len[k] < target) k++;
		return { x: pts[k][0], y: pts[k][1], f, title: s[0], note: s[1], idx: k };
	});
	return { h, trail: pts, wp, summit: [sx, sy] };
}

function terrainImage(scene, env, view) {
	const c = document.createElement("canvas");
	c.width = Math.round(NX * 1.4);
	c.height = Math.round(NY * 1.4);
	const x = c.getContext("2d");
	const img = x.createImageData(c.width, c.height);
	const W = c.width;
	const H = c.height;
	const { h } = scene;
	const at = (i, j) => h[clamp(j, 0, NY - 1) * NX + clamp(i, 0, NX - 1)];
	const L0 = [(env.sm.sun.x - 0.5) * 1.6 - 0.35, -0.8];
	const Lz = Math.sin((clamp(env.alt, 14, 50) * Math.PI) / 180);
	const Ln = Math.hypot(L0[0], L0[1], Lz * 1.3);
	const Lx = L0[0] / Ln;
	const Ly = L0[1] / Ln;
	const Lzn = (Lz * 1.3) / Ln;
	const land = env.p.season;
	const pal = {
		spring: [[190, 206, 154], [146, 176, 120], [176, 164, 130], [216, 214, 206]],
		summer: [[172, 192, 144], [124, 160, 116], [172, 160, 132], [216, 212, 202]],
		autumn: [[196, 174, 110], [190, 124, 70], [160, 130, 100], [214, 208, 198]],
		winter: [[226, 232, 238], [206, 216, 226], [214, 220, 228], [248, 250, 252]],
	}[land].map((a) => a);
	const water = [150, 190, 210];
	const nightTint = [22, 36, 78];
	for (let j = 0; j < H; j++) {
		for (let i = 0; i < W; i++) {
			const u = (i / (W - 1)) * (NX - 1);
			const v = (j / (H - 1)) * (NY - 1);
			const i0 = Math.floor(u);
			const j0 = Math.floor(v);
			const fx = u - i0;
			const fy = v - j0;
			const e = lerp(lerp(at(i0, j0), at(i0 + 1, j0), fx), lerp(at(i0, j0 + 1), at(i0 + 1, j0 + 1), fx), fy);
			const dzdx = (at(i0 + 1, j0) - at(i0 - 1, j0)) * 9;
			const dzdy = (at(i0, j0 + 1) - at(i0, j0 - 1)) * 9 * ASPECT * 0.6;
			const nl = Math.hypot(dzdx, dzdy, 1);
			const shade = clamp((-dzdx * Lx - dzdy * Ly + Lzn) / nl, 0, 1);
			let col;
			if (e < 0.17) col = mix(water, [96, 148, 180], clamp((0.17 - e) * 8));
			else if (e < 0.34) col = mix(pal[0], pal[1], smooth(0.17, 0.34, e));
			else if (e < 0.62) col = mix(pal[1], pal[2], smooth(0.34, 0.62, e));
			else col = mix(pal[2], pal[3], smooth(0.62, 0.9, e));
			if (env.snowAmt && e >= 0.17) col = mix(col, [250, 252, 255], clamp(env.snowAmt * smooth(0.2 + (1 - env.snowAmt) * 0.45, 0.5, e + 0.1)));
			const sh = e < 0.17 ? 1 : 0.5 + shade * 0.85;
			col = mul(col, sh);
			col = mix(col, [255, 190, 130], env.golden * 0.16);
			col = mix(col, mix(mul(col, 0.4), nightTint, 0.55), env.night);
			const k = (j * W + i) * 4;
			img.data[k] = col[0];
			img.data[k + 1] = col[1];
			img.data[k + 2] = col[2];
			img.data[k + 3] = 255;
		}
	}
	x.putImageData(img, 0, 0);
	return c;
}

function contours(ctx, scene, view, env) {
	const { h } = scene;
	const sxs = view.w / (NX - 1);
	const sys = view.h / (NY - 1);
	const levels = [];
	for (let l = 0.12; l < 0.95; l += 0.045) levels.push(l);
	const ink = env.tone === "dark" ? [150, 190, 235] : [110, 72, 44];
	for (const index of [false, true]) {
		ctx.beginPath();
		levels.forEach((lv, li) => {
			if ((li % 5 === 0) !== index) return;
			for (let j = 0; j < NY - 1; j++) {
				for (let i = 0; i < NX - 1; i++) {
					const a = h[j * NX + i];
					const b = h[j * NX + i + 1];
					const c = h[(j + 1) * NX + i + 1];
					const d = h[(j + 1) * NX + i];
					const m = (a > lv ? 1 : 0) | (b > lv ? 2 : 0) | (c > lv ? 4 : 0) | (d > lv ? 8 : 0);
					if (m === 0 || m === 15) continue;
					const x0 = i * sxs;
					const y0 = j * sys;
					const T = [x0 + ((lv - a) / (b - a)) * sxs, y0];
					const R = [x0 + sxs, y0 + ((lv - b) / (c - b)) * sys];
					const B = [x0 + ((lv - d) / (c - d)) * sxs, y0 + sys];
					const Lf = [x0, y0 + ((lv - a) / (d - a)) * sys];
					const seg = (p, q) => {
						ctx.moveTo(p[0], p[1]);
						ctx.lineTo(q[0], q[1]);
					};
					switch (m) {
						case 1: case 14: seg(Lf, T); break;
						case 2: case 13: seg(T, R); break;
						case 3: case 12: seg(Lf, R); break;
						case 4: case 11: seg(R, B); break;
						case 5: seg(Lf, T); seg(R, B); break;
						case 10: seg(T, R); seg(Lf, B); break;
						case 6: case 9: seg(T, B); break;
						case 7: case 8: seg(Lf, B); break;
						default:
					}
				}
			}
		});
		ctx.strokeStyle = css(ink, index ? 0.62 : 0.34);
		ctx.lineWidth = index ? 1.1 : 0.7;
		ctx.stroke();
	}
}

function trailPx(scene, view) {
	return scene.trail.map(([x, y]) => [x * view.w, y * view.h]);
}

function tower(ctx, x, y, env, s = 1) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);
	ctx.strokeStyle = css(env.tone === "dark" ? [230, 238, 255] : [50, 38, 30], 0.95);
	ctx.lineWidth = 1.6;
	ctx.beginPath();
	ctx.moveTo(-7, 0);
	ctx.lineTo(-3, -22);
	ctx.moveTo(7, 0);
	ctx.lineTo(3, -22);
	for (let i = 0; i < 3; i++) {
		ctx.moveTo(-7 + i * 1.3, -i * 7.3);
		ctx.lineTo(3 - i * 0.3 - 0, -(i + 1) * 7.3);
		ctx.moveTo(7 - i * 1.3, -i * 7.3);
		ctx.lineTo(-3 + i * 0.3, -(i + 1) * 7.3);
	}
	ctx.stroke();
	ctx.fillStyle = css(env.tone === "dark" ? [255, 214, 140] : [196, 60, 40], 1);
	ctx.fillRect(-5, -29, 10, 7);
	ctx.beginPath();
	ctx.moveTo(-6.5, -29);
	ctx.lineTo(0, -34);
	ctx.lineTo(6.5, -29);
	ctx.fill();
	ctx.restore();
	if (env.night > 0.3) {
		const g = ctx.createRadialGradient(x, y - 25 * s, 0, x, y - 25 * s, 34);
		g.addColorStop(0, "rgba(255,210,130,0.55)");
		g.addColorStop(1, "rgba(255,210,130,0)");
		ctx.fillStyle = g;
		ctx.fillRect(x - 40, y - 70, 80, 80);
	}
}

function compass(ctx, x, y, r, env) {
	const ink = env.tone === "dark" ? [214, 228, 252] : [80, 52, 34];
	ctx.save();
	ctx.translate(x, y);
	ctx.strokeStyle = css(ink, 0.6);
	ctx.fillStyle = css(ink, 0.55);
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, 6.2832);
	ctx.arc(0, 0, r * 0.72, 0, 6.2832);
	ctx.stroke();
	for (let i = 0; i < 4; i++) {
		ctx.save();
		ctx.rotate((i * Math.PI) / 2);
		ctx.beginPath();
		ctx.moveTo(0, -r * 1.15);
		ctx.lineTo(r * 0.16, 0);
		ctx.lineTo(-r * 0.16, 0);
		ctx.closePath();
		if (i === 0) ctx.fill();
		else ctx.stroke();
		ctx.restore();
	}
	ctx.font = "italic 12px Georgia, serif";
	ctx.textAlign = "center";
	ctx.fillText("N", 0, -r * 1.3);
	ctx.restore();
}

export function activate({ root, mode, reducedMotion }) {
	const site = root;
	let progress = 0;
	let api;
	const onScroll = () => {
		const m = site.scrollHeight - site.clientHeight;
		progress = m > 0 ? clamp(site.scrollTop / m) : 0;
		if (api && api.redraw) api.redraw();
	};
	site.addEventListener("scroll", onScroll, { passive: true });
	const stop = mountScene(root, {
		id: "proof-trail",
		mode,
		reducedMotion,
		generate,
		horizon: 1,
		paint(ctx, scene, view, env) {
			api = root.__adk;
			ctx.imageSmoothingQuality = "high";
			ctx.drawImage(terrainImage(scene, env, view), 0, 0, view.w, view.h);
			contours(ctx, scene, view, env);
			// vignette, like an old sheet
			const v = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.4, view.w / 2, view.h / 2, view.w * 0.75);
			v.addColorStop(0, "rgba(0,0,0,0)");
			v.addColorStop(1, env.tone === "dark" ? "rgba(2,6,24,0.5)" : "rgba(90,60,30,0.2)");
			ctx.fillStyle = v;
			ctx.fillRect(0, 0, view.w, view.h);
			// map margin with ticks
			const ink = env.tone === "dark" ? [200, 220, 250] : [90, 60, 38];
			ctx.strokeStyle = css(ink, 0.5);
			ctx.lineWidth = 1;
			ctx.strokeRect(8.5, 8.5, view.w - 17, view.h - 17);
			ctx.beginPath();
			for (let x = 8; x < view.w - 8; x += 40) {
				ctx.moveTo(x + 0.5, 8);
				ctx.lineTo(x + 0.5, x % 200 === 8 ? 18 : 13);
				ctx.moveTo(x + 0.5, view.h - 8);
				ctx.lineTo(x + 0.5, view.h - (x % 200 === 8 ? 18 : 13));
			}
			for (let y = 8; y < view.h - 8; y += 40) {
				ctx.moveTo(8, y + 0.5);
				ctx.lineTo(y % 200 === 8 ? 18 : 13, y + 0.5);
				ctx.moveTo(view.w - 8, y + 0.5);
				ctx.lineTo(view.w - (y % 200 === 8 ? 18 : 13), y + 0.5);
			}
			ctx.stroke();
			// trail
			const px = trailPx(scene, view);
			ctx.lineJoin = "round";
			ctx.strokeStyle = css(env.tone === "dark" ? [255, 190, 130] : [150, 40, 30], 0.85);
			ctx.lineWidth = 2;
			ctx.setLineDash([7, 4]);
			ctx.beginPath();
			px.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
			ctx.stroke();
			ctx.setLineDash([]);
			// blazes
			let acc = 0;
			let flip = 1;
			ctx.fillStyle = css(env.tone === "dark" ? [255, 226, 150] : [200, 150, 30], 0.95);
			for (let i = 1; i < px.length; i++) {
				const dx = px[i][0] - px[i - 1][0];
				const dy = px[i][1] - px[i - 1][1];
				acc += Math.hypot(dx, dy);
				if (acc > 46) {
					acc = 0;
					flip = -flip;
					ctx.save();
					ctx.translate(px[i][0] - (dy * flip * 6) / Math.hypot(dx, dy), px[i][1] + (dx * flip * 6) / Math.hypot(dx, dy));
					ctx.rotate(Math.atan2(dy, dx));
					ctx.fillRect(-1.5, -3.5, 3, 7);
					ctx.restore();
				}
			}
			// waypoints
			ctx.textBaseline = "middle";
			scene.wp.forEach((w, i) => {
				const x = w.x * view.w;
				const y = w.y * view.h;
				if (i === scene.wp.length - 1) {
					tower(ctx, x, y + 4, env, 1.1);
					ctx.font = "italic 700 26px Georgia, serif";
					ctx.fillStyle = css(env.tone === "dark" ? [255, 240, 210] : [60, 30, 20], 0.95);
					ctx.fillText("∎", x + 18, y - 14);
					return;
				}
				ctx.fillStyle = css(env.tone === "dark" ? [255, 226, 150] : [250, 244, 230], 1);
				ctx.strokeStyle = css(env.tone === "dark" ? [255, 190, 130] : [150, 40, 30], 1);
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.rect(x - 5, y - 5, 10, 10);
				ctx.fill();
				ctx.stroke();
				ctx.font = "italic 600 14px Georgia, serif";
				ctx.fillStyle = css(env.tone === "dark" ? [248, 240, 224] : [70, 36, 24], 0.95);
				const left = i % 2 === 0;
				ctx.textAlign = left ? "left" : "right";
				ctx.fillText(w.title, x + (left ? 12 : -12), y - 5);
				ctx.font = "11px Georgia, serif";
				ctx.fillStyle = css(env.tone === "dark" ? [200, 214, 240] : [100, 70, 50], 0.85);
				ctx.fillText(w.note, x + (left ? 12 : -12), y + 9);
				ctx.textAlign = "left";
			});
			compass(ctx, 70, view.h - 82, 24, env);
			ctx.font = "italic 13px Georgia, serif";
			ctx.fillStyle = css(ink, 0.75);
			ctx.fillText("The Ascent — a proof, in seven steps", 28, view.h - 34);
			ctx.textBaseline = "alphabetic";
		},
		frame(ctx, scene, view, env, t, dt, still) {
			// cloud shadows
			const n = Math.round(env.cover * 7);
			for (let i = 0; i < n; i++) {
				const x = ((i * 0.37 + (still ? 0 : t * 0.004 * (0.6 + env.wind))) % 1.4) * view.w * 1.2 - view.w * 0.2;
				const y = ((i * 0.61) % 1) * view.h;
				blob(ctx, x, y, 230 + (i % 3) * 60, 110, env.tone === "dark" ? [0, 0, 10] : [20, 30, 50], 0.16);
			}
			// the hiker: progress along the proof
			const px = trailPx(scene, view);
			const end = Math.max(1, Math.round(progress_() * (px.length - 1)));
			ctx.strokeStyle = css(env.tone === "dark" ? [255, 230, 160] : [255, 120, 40], 0.95);
			ctx.lineWidth = 3.4;
			ctx.lineCap = "round";
			ctx.beginPath();
			for (let i = 0; i <= end; i++) (i ? ctx.lineTo(px[i][0], px[i][1]) : ctx.moveTo(px[i][0], px[i][1]));
			ctx.stroke();
			const [hx, hy2] = px[end];
			const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3);
			const g = ctx.createRadialGradient(hx, hy2, 0, hx, hy2, 16 + pulse * 6);
			g.addColorStop(0, "rgba(255,170,70,0.7)");
			g.addColorStop(1, "rgba(255,170,70,0)");
			ctx.fillStyle = g;
			ctx.fillRect(hx - 24, hy2 - 24, 48, 48);
			ctx.fillStyle = css([255, 250, 240], 1);
			ctx.beginPath();
			ctx.arc(hx, hy2, 3.5, 0, 6.2832);
			ctx.fill();
		},
	});
	function progress_() {
		return progress;
	}
	onScroll();
	return () => {
		site.removeEventListener("scroll", onScroll);
		stop();
	};
}
