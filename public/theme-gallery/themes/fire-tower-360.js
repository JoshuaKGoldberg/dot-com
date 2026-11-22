import { createStage, makeNoise, fbm, Flock, glowSprite, cloudSprite, makeStars, isEmptyAt, onEmptyTap, addHint, addUI, isDark, watchDark, hex, mixC, rgba, clamp, lerp, smooth, rng, TAU } from "./forest-kit/kit.js";

const FOV = 1.75;
const LZOOM = 3.2;
const TABLE = 1440;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const H = (s) => hex(s);

const PAL = {
	light: {
		sky: [H("#7db3de"), H("#bcd7e6"), H("#eef1e8")],
		layers: ["#b7c8d8", "#97aebd", "#729489", "#4b7461"].map(H),
		haze: [238, 242, 234],
		lake: H("#8dbad0"), lakeHi: [255, 255, 255],
		canopy: ["#3d6c4d", "#2e5a41", "#4a7c57"].map(H),
		rail: "#4a3a2c", railHi: "#7b6249",
		sun: [255, 240, 205], ink: [255, 255, 255],
		bird: ["rgba(40,55,70,.7)", "rgba(28,40,56,.85)", "rgba(18,28,40,.95)"],
		star: 0,
	},
	dark: {
		sky: [H("#040916"), H("#162347"), H("#33456f")],
		layers: ["#33436e", "#28375f", "#1c284a", "#131d37"].map(H),
		haze: [60, 80, 130],
		lake: H("#26396a"), lakeHi: [190, 210, 255],
		canopy: ["#0d1a2a", "#0a1522", "#122236"].map(H),
		rail: "#150f0b", railHi: "#2d2218",
		sun: [225, 234, 255], ink: [220, 232, 255],
		bird: ["rgba(185,200,232,.5)", "rgba(200,214,240,.66)", "rgba(215,226,248,.82)"],
		star: 1,
	},
};

export function activate({ root, reducedMotion }) {
	let dark = isDark();
	const hint = addHint(root, reducedMotion ? "Drag to look around · click for binoculars" : "Drag the empty margins to look around · click for binoculars");
	const ui = addUI(root, `<span>Fire tower</span><button type="button" aria-pressed="false">Binoculars</button>`);
	const btn = ui.querySelector("button");
	const hawks = new Flock({ seed: 5, groups: 2, perGroup: [2, 4], size: [7, 10], band: [0.56, 0.78], speed: [18, 30], respawn: [2, 7], flap: [2.4, 3.6] });
	const small = new Flock({ seed: 12, groups: 2, perGroup: [5, 9], size: [3.6, 5.6], band: [0.3, 0.55], speed: [42, 66], respawn: [2, 8], flap: [6, 9] });
	let heading = 0.7, vel = 0, drag = null, zoomOn = false, zoom = 0, idle = 0;
	let L = null;
	let lens = { x: 0, y: 0 };

	const stage = createStage(root, { reducedMotion, build, draw, update });
	const unwatch = watchDark((d) => { dark = d; stage.invalidate(); });
	const pal = () => PAL[dark ? "dark" : "light"];

	function build(s) {
		const { w, h } = s;
		const mk = (seed, P, off, amp, pow) => {
			const n = makeNoise(seed, P);
			const tab = new Float32Array(TABLE + 1);
			for (let i = 0; i <= TABLE; i++) {
				const v = fbm(n, ((i % TABLE) / TABLE) * P, 5);
				tab[i] = 0.06 + 0.94 * Math.pow(1 - Math.exp(-2.1 * Math.max(0, (v - 0.18) / 0.5)), pow);
			}
			return { tab, off, amp };
		};
		L = {
			layers: [mk(3, 10, 0.02, 0.26, 1.3), mk(8, 16, 0.08, 0.17, 1.2), mk(15, 24, 0.15, 0.11, 1.1), mk(22, 36, 0.23, 0.07, 1.0)],
			lakes: [0.4, 1.6, 2.7, 3.7, 4.6, 5.6].map((a, i) => ({ a: a + (i % 2) * 0.1, wa: 0.1 + ((i * 37) % 10) / 70 })),
			stars: makeStars(rng(9), 220, TAU, 1),
			clouds: [0.3, 1.5, 2.6, 3.9, 5.2].map((a, i) => ({ a, y: 0.1 + ((i * 53) % 30) / 100, k: i })),
		};
		const r = rng(4);
		L.blobs = Array.from({ length: 3200 }, () => { const f = Math.pow(r(), 0.8); return { a: r() * TAU, f, c: (r() * 3) | 0 }; });
		L.sunSprite = glowSprite(256, pal().sun, [0.9, 0.22, 0]);
		L.cloud = [0, 1, 2].map((i) => cloudSprite(420, 90, 40 + i, [255, 255, 255], 0.5));
		L.cloudD = [0, 1, 2].map((i) => cloudSprite(420, 90, 40 + i, [110, 130, 190], 0.22));
		hawks.resize(w, h);
		small.resize(w, h);
		if (s.reduced) { hawks.settle({}, 5); small.settle({}, 5); }
	}

	const fovNow = (s) => FOV;
	const hAt = (lay, ang) => {
		const f = (((ang / TAU) % 1) + 1) % 1 * TABLE;
		const i = f | 0;
		return lay.tab[i] + (lay.tab[i + 1] - lay.tab[i]) * (f - i);
	};

	function shiftBirds(dh, w) {
		const dx = (dh / FOV) * w;
		for (const f of [hawks, small]) {
			for (const b of f.birds) b.x -= dx;
			for (const g of f.groups) g.ax -= dx;
		}
	}

	function update(dt, s) {
		if (s.reduced) return;
		idle += dt;
		if (!drag) {
			const dh = vel * dt + (idle > 5 && !zoomOn ? 0.012 * dt : 0);
			heading += dh;
			vel *= Math.exp(-dt * 2.4);
			if (Math.abs(vel) < 0.001) vel = 0;
			shiftBirds(dh, s.w);
		}
		zoom += ((zoomOn ? 1 : 0) - zoom) * (1 - Math.exp(-dt * 7));
		const e = { wind: 0.2 };
		hawks.update(dt, e);
		small.update(dt, e);
	}

	function pano(ctx, s) {
		const { w, h, t } = s;
		const p = pal();
		const hy = h * 0.46;
		const px = w / FOV; // pixels per radian
		const X = (a) => w / 2 + wrap(a - heading) * px;
		// sky
		const g = ctx.createLinearGradient(0, 0, 0, hy);
		g.addColorStop(0, rgba(p.sky[0]));
		g.addColorStop(0.6, rgba(p.sky[1]));
		g.addColorStop(1, rgba(p.sky[2]));
		ctx.fillStyle = g;
		ctx.fillRect(-40, -h, w + 80, h * 3);
		if (p.star) {
			ctx.fillStyle = "#fff";
			for (const st of L.stars) {
				const x = X(st.x);
				if (x < -3 || x > w + 3) continue;
				ctx.globalAlpha = st.o * (st.tw ? 0.65 + 0.35 * Math.sin(t * st.tw + st.ph) : 1);
				ctx.fillRect(x, st.y * hy * 0.95, st.s, st.s);
			}
			ctx.globalAlpha = 1;
		}
		// sun or moon
		const sa = dark ? 2.5 : 1.15;
		const sx = X(sa), sy = hy * (dark ? 0.4 : 0.52);
		if (sx > -200 && sx < w + 200) {
			ctx.drawImage(L.sunSprite, sx - 160, sy - 160, 320, 320);
			ctx.fillStyle = dark ? "rgba(236,241,255,.92)" : "rgba(255,248,226,.95)";
			ctx.beginPath();
			ctx.arc(sx, sy, dark ? 15 : 22, 0, TAU);
			ctx.fill();
		}
		// clouds
		for (const c of L.clouds) {
			const x = X(c.a + t * 0.004);
			if (x < -300 || x > w + 300) continue;
			ctx.drawImage((dark ? L.cloudD : L.cloud)[c.k % 3], x - 210, hy * c.y * 2.2, 420, 90);
		}
		// ridges + lakes
		const step = 2;
		p.layers.forEach((col, i) => {
			const lay = L.layers[i];
			const base = hy + lay.off * h;
			ctx.beginPath();
			ctx.moveTo(-10, h * 1.5);
			let minY = 1e9;
			for (let x = -10; x <= w + 10; x += step) {
				const y = base - lay.amp * h * hAt(lay, heading + (x - w / 2) / px);
				if (y < minY) minY = y;
				ctx.lineTo(x, y);
			}
			ctx.lineTo(w + 10, h * 1.5);
			ctx.closePath();
			const gg = ctx.createLinearGradient(0, minY, 0, base + h * 0.12);
			gg.addColorStop(0, rgba(col));
			gg.addColorStop(1, rgba(mixC(col, p.haze, i < 2 ? 0.5 : 0.22)));
			ctx.fillStyle = gg;
			ctx.fill();
			if (i === 1) {
				for (const lk of L.lakes) {
					const x = X(lk.a);
					const wd = lk.wa * px;
					if (x < -wd || x > w + wd) continue;
					const ly = hy + h * 0.115, lh = wd * 0.1;
					ctx.fillStyle = rgba(p.lake, 0.95);
					ctx.beginPath();
					ctx.ellipse(x, ly, wd, lh, 0, 0, TAU);
					ctx.fill();
					ctx.fillStyle = rgba(p.lakeHi, 0.28);
					for (let k = 0; k < 5; k++) {
						const sh = Math.max(0, Math.sin(t * 1.2 + k * 2 + lk.a * 5));
						ctx.globalAlpha = sh;
						ctx.fillRect(x - wd * 0.6 + k * wd * 0.28, ly - lh * 0.4 + (k % 2) * lh * 0.5, wd * 0.2, 1.2);
					}
					ctx.globalAlpha = 1;
				}
			}
		});
		// canopy below the tower
		const cTop = h * 0.74;
		const grd = ctx.createLinearGradient(0, cTop - 20, 0, h);
		grd.addColorStop(0, rgba(p.canopy[1]));
		grd.addColorStop(1, rgba(mixC(p.canopy[1], [0, 0, 0], 0.35)));
		ctx.fillStyle = grd;
		ctx.fillRect(-10, cTop, w + 20, h - cTop);
		const buckets = [[], [], []];
		for (const b of L.blobs) {
			const x = X(b.a);
			if (x < -30 || x > w + 30) continue;
			buckets[b.c].push([x, b.f]);
		}
		buckets.forEach((arr, ci) => {
			ctx.fillStyle = rgba(p.canopy[ci]);
			ctx.beginPath();
			for (const [x, f] of arr) {
				const y = cTop - 8 + f * (h - cTop + 8);
				const r = 2 + f * 8;
				const sw = Math.sin(t * 1.1 + x * 0.02 + f * 4) * 0.8 * f;
				ctx.moveTo(x + r + sw, y);
				ctx.arc(x + sw, y, r, 0, TAU);
			}
			ctx.fill();
		});
		small.draw(ctx, p.bird);
		hawks.draw(ctx, p.bird);
	}

	function draw(ctx, s) {
		const { w, h } = s;
		const p = pal();
		pano(ctx, s);
		if (zoom > 0.01) {
			const z = smooth(zoom);
			const ptr = s.pointer;
			const tx = ptr.active ? ptr.x : w / 2, ty = ptr.active ? ptr.y : h * 0.45;
			lens.x += (tx - lens.x) * 0.2 || 0;
			lens.y += (ty - lens.y) * 0.2 || 0;
			if (!lens.init) { lens.x = tx; lens.y = ty; lens.init = true; }
			const R = Math.min(w, h) * 0.3 * z;
			const gap = R * 0.62;
			ctx.fillStyle = `rgba(0,0,0,${0.38 * z})`;
			ctx.fillRect(0, 0, w, h);
			ctx.save();
			ctx.beginPath();
			ctx.arc(lens.x - gap, lens.y, R, 0, TAU);
			ctx.moveTo(lens.x + gap + R, lens.y);
			ctx.arc(lens.x + gap, lens.y, R, 0, TAU);
			ctx.clip();
			const k = 1 + (LZOOM - 1) * z;
			const tr = s.reduced ? 0 : 1;
			ctx.translate(lens.x + Math.sin(s.t * 2.3) * 1.2 * tr, lens.y + Math.cos(s.t * 1.9) * 1.2 * tr);
			ctx.scale(k, k);
			ctx.translate(-lens.x, -lens.y);
			pano(ctx, s);
			ctx.restore();
			ctx.lineWidth = 7;
			ctx.strokeStyle = "rgba(12,16,22,.92)";
			for (const sx of [-1, 1]) {
				ctx.beginPath();
				ctx.arc(lens.x + sx * gap, lens.y, R, 0, TAU);
				ctx.stroke();
			}
			ctx.lineWidth = 1;
			ctx.strokeStyle = "rgba(255,255,255,.35)";
			for (const sx of [-1, 1]) {
				ctx.beginPath();
				ctx.arc(lens.x + sx * gap, lens.y, R - 4, 0, TAU);
				ctx.stroke();
			}
			ctx.strokeStyle = "rgba(255,255,255,.4)";
			ctx.beginPath();
			ctx.moveTo(lens.x - gap - R * 0.5, lens.y); ctx.lineTo(lens.x - gap + R * 0.5, lens.y);
			ctx.moveTo(lens.x - gap, lens.y - R * 0.5); ctx.lineTo(lens.x - gap, lens.y + R * 0.5);
			ctx.stroke();
		}
		compass(ctx, s);
		rail(ctx, s);
	}

	function compass(ctx, s) {
		const { w } = s;
		const p = pal();
		const px = w / FOV;
		const hd = ((heading * 180) / Math.PI + 360 * 10) % 360;
		const half = (FOV * 90) / Math.PI + 5;
		ctx.font = "700 11px 'League Spartan', system-ui, sans-serif";
		ctx.textAlign = "center";
		ctx.fillStyle = rgba(p.ink, 0.0);
		const names = { 0: "N", 90: "E", 180: "S", 270: "W", 45: "NE", 135: "SE", 225: "SW", 315: "NW" };
		const top = 6;
		ctx.fillStyle = dark ? "rgba(6,10,22,.35)" : "rgba(20,40,60,.22)";
		ctx.fillRect(0, top - 4, w, 26);
		for (let d = Math.floor((hd - half) / 5) * 5; d <= hd + half; d += 5) {
			const dd = ((d % 360) + 360) % 360;
			const x = w / 2 + (d - hd) * (Math.PI / 180) * px;
			const major = dd % 15 === 0;
			ctx.strokeStyle = rgba(p.ink, major ? 0.9 : 0.5);
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(x, top);
			ctx.lineTo(x, top + (major ? 8 : 4));
			ctx.stroke();
			if (dd % 30 === 0 || names[dd]) {
				ctx.fillStyle = rgba(p.ink, names[dd] ? 1 : 0.8);
				ctx.fillText(names[dd] || String(dd), x, top + 19);
			}
		}
		ctx.fillStyle = rgba(p.ink, 0.95);
		ctx.beginPath();
		ctx.moveTo(w / 2 - 4, top - 4); ctx.lineTo(w / 2 + 4, top - 4); ctx.lineTo(w / 2, top + 2);
		ctx.fill();
	}

	function rail(ctx, s) {
		const { w, h } = s;
		const p = pal();
		ctx.fillStyle = p.rail;
		ctx.fillRect(0, h - 12, w, 12);
		ctx.fillStyle = p.railHi;
		ctx.fillRect(0, h - 12, w, 2);
		ctx.fillStyle = p.rail;
		ctx.fillRect(0, h - 44, w, 5);
		for (let x = 0; x < w; x += 140) ctx.fillRect(x + 66, h - 44, 6, 34);
		ctx.fillRect(0, 0, 9, h);
		ctx.fillRect(w - 9, 0, 9, h);
		ctx.fillStyle = p.railHi;
		ctx.fillRect(9, 0, 1.5, h);
		ctx.fillRect(w - 10.5, 0, 1.5, h);
	}

	function setZoom(on) {
		zoomOn = on;
		btn.setAttribute("aria-pressed", String(on));
		hint.hide();
		if (stage.reduced) { zoom = on ? 1 : 0; stage.invalidate(); }
	}
	btn.addEventListener("click", () => setZoom(!zoomOn));
	onEmptyTap(stage, () => setZoom(!zoomOn));
	stage.on(window, "keydown", (e) => {
		if (e.key === "Escape" && zoomOn) setZoom(false);
	});

	// drag to pan
	stage.on(window, "pointerdown", (e) => {
		if (e.button !== 0 || !isEmptyAt(root, e.clientX, e.clientY)) return;
		e.preventDefault();
		drag = { x: e.clientX, t: performance.now() };
		root.style.cursor = "grabbing";
		idle = 0;
	});
	stage.on(window, "pointermove", (e) => {
		if (drag) {
			const dx = e.clientX - drag.x;
			drag.x = e.clientX;
			const now = performance.now();
			const dt = Math.max(8, now - drag.t) / 1000;
			drag.t = now;
			const dh = (-dx / stage.w) * FOV * (zoomOn ? 0.5 : 1);
			heading += dh;
			vel = lerp(vel, dh / dt, 0.5);
			shiftBirds(dh, stage.w);
			hint.hide();
			if (stage.reduced) stage.invalidate();
		} else {
			root.style.cursor = isEmptyAt(root, e.clientX, e.clientY) ? "grab" : "";
		}
	}, { passive: true });
	const up = () => { if (drag) { drag = null; root.style.cursor = "grab"; if (stage.reduced) vel = 0; } };
	stage.on(window, "pointerup", up);
	stage.on(window, "pointercancel", up);

	return () => { root.style.cursor = ""; stage.destroy(); unwatch(); };
}
