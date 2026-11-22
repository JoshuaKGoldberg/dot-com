import { raisedAurora, sideSky, ticker, trackPointer, footerHost, whenVisible, isDark, clamp, lerp, rng, makeStars, STAR, TAU } from "./_refined-c/kit.js";

const CELL = 22;
const PIG = {
	dark: [[70, 230, 170], [80, 170, 250], [170, 120, 250], [240, 120, 170]],
	light: [[110, 200, 170], [120, 170, 225], [180, 150, 220], [235, 160, 180]],
};

function paperTile(dark) {
	const N = 160, c = document.createElement("canvas");
	c.width = c.height = N;
	const x = c.getContext("2d"), r = rng(12), img = x.createImageData(N, N);
	for (let i = 0; i < N * N; i++) {
		const v = r(), a = Math.abs(v - 0.5) * (dark ? 0.1 : 0.12) * 255;
		img.data.set(v > 0.5 ? (dark ? [200, 210, 255, a] : [255, 255, 255, a * 1.4]) : (dark ? [0, 0, 20, a] : [120, 95, 60, a]), i * 4);
	}
	x.putImageData(img, 0, 0);
	return c.toDataURL("image/png");
}
function blob(rgb, a, w, h) {
	const c = document.createElement("canvas");
	c.width = w; c.height = h;
	const x = c.getContext("2d");
	x.translate(w / 2, h / 2); x.scale(1, h / w);
	const g = x.createRadialGradient(0, 0, 0, 0, 0, w / 2);
	const s = `${rgb[0]},${rgb[1]},${rgb[2]}`;
	g.addColorStop(0, `rgba(${s},${a * 0.6})`); g.addColorStop(0.55, `rgba(${s},${a * 0.5})`); g.addColorStop(0.8, `rgba(${s},${a * 0.8})`); g.addColorStop(1, `rgba(${s},0)`);
	x.fillStyle = g; x.fillRect(-w / 2, -w / 2, w, w);
	return c;
}

// Watercolor footer: washes baked once; cursor drags pigment dabs that fade (only while visible).
function watercolorFooter(root, reducedMotion) {
	const dark = isDark(), pig = PIG[dark ? "dark" : "light"];
	const fh = footerHost(root, 170);
	const W = 480, H = 100;
	const wash = document.createElement("canvas");
	wash.className = "rac-wash"; wash.width = W; wash.height = H;
	const x = wash.getContext("2d"), r = rng(257);
	const A = dark ? 0.13 : 0.2;
	pig.forEach((c, b) => {
		const sp = blob(c, A, 64, 128);
		for (let i = 0; i < 20; i++) {
			const u = (i + r()) / 20, w = 70 + r() * 90, hh = 44 + r() * 50;
			x.globalAlpha = 0.45 + r() * 0.5;
			const cy = H * (0.62 + 0.1 * Math.sin(u * 5 + b * 1.7)) + (b - 1.5) * 5;
			x.drawImage(sp, u * W - w / 2, cy - hh * 0.6, w, hh);
		}
	});
	const trail = document.createElement("canvas");
	trail.className = "rac-trail"; trail.width = W; trail.height = H;
	const tx = trail.getContext("2d");
	const paper = document.createElement("div");
	paper.className = "rac-paper";
	paper.style.backgroundImage = `url(${paperTile(dark)})`;
	fh.box.append(wash, trail, paper);
	const dabs = pig.map((c) => blob(c, A * 1.8, 64, 128));
	let hue = 0, prev = null, pt = null, tk = null;
	const ptr = trackPointer((p) => { pt = p; if (tk && visible) tk.wake(); });
	let visible = false;
	let drift = 0, idleN = 0;
	tk = ticker({
		hz: 30, fps: 30,
		step() {
			const rect = fh.box.getBoundingClientRect();
			let live = false;
			if (pt && pt.y > rect.top - 30 && pt.y < rect.bottom + 30) {
				const px = (pt.x - rect.left) / rect.width * W, py = (pt.y - rect.top) / rect.height * H;
				const sp = Math.hypot(pt.vx, pt.vy);
				if (prev && sp > 40) {
					const d = Math.hypot(px - prev[0], py - prev[1]), k = clamp(Math.ceil(d / 8), 1, 6);
					for (let q = 1; q <= k; q++) {
						hue = (hue + 0.05) % dabs.length;
						const rr = 12 + Math.min(14, sp * 0.01);
						tx.globalAlpha = 0.5;
						tx.drawImage(dabs[hue | 0], lerp(prev[0], px, q / k) - rr, lerp(prev[1], py, q / k) - rr * 1.2, rr * 2, rr * 2.4);
					}
					live = true;
				}
				prev = [px, py];
				pt.vx *= 0.8; pt.vy *= 0.8;
			} else prev = null;
			tx.globalAlpha = 1; tx.globalCompositeOperation = "destination-out";
			tx.fillStyle = `rgba(0,0,0,${reducedMotion ? 0.5 : 0.03})`; tx.fillRect(0, 0, W, H);
			tx.globalCompositeOperation = "source-over";
			drift += 1 / 30;
			if (!reducedMotion) wash.style.transform = `translate3d(${Math.sin(drift * 0.12) * 14}px,0,0) scale(1.06)`;
			idleN = live ? 0 : idleN + 1;
			return !reducedMotion || idleN < 80;
		},
		render() {},
	});
	wash.style.cssText = "width:100%;height:100%;will-change:transform";
	const stopVis = whenVisible(fh.box, root, () => { visible = true; tk.wake(); return () => { visible = false; }; });
	return () => { stopVis(); tk.destroy(); ptr.destroy(); fh.destroy(); };
}

export function activate({ root, reducedMotion }) {
	const aur = raisedAurora({ root, reducedMotion, level: 1 });
	const host = root.querySelector(".scenery-c");
	let tk = null;
	const ptr = trackPointer(() => tk?.wake());
	let fields = [], particles = [], t = 0;

	function drift(x, y, t) { // curl of a stream function: divergence-free ambient currents
		const a = 0.011, e = 0.5;
		const psi = (X, Y) => Math.sin(X * a + t * 0.11) * Math.cos(Y * a * 1.3 - t * 0.08) + 0.5 * Math.sin(X * a * 2.3 + Y * a * 1.7 + t * 0.15);
		return [(psi(x, y + e) - psi(x, y - e)) / (2 * e), -(psi(x + e, y) - psi(x - e, y)) / (2 * e)];
	}
	function sample(f, x, y) {
		const fx = clamp(x / CELL - 0.5, 0, f.gw - 1.001), fy = clamp(y / CELL - 0.5, 0, f.gh - 1.001);
		const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, k = j * f.gw + i, g = f.gw;
		const w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
		return [f.vx[k] * w00 + f.vx[k + 1] * w10 + f.vx[k + g] * w01 + f.vx[k + g + 1] * w11, f.vy[k] * w00 + f.vy[k + 1] * w10 + f.vy[k + g] * w01 + f.vy[k + g + 1] * w11];
	}
	const sky = sideSky({
		root, host, seed: 306, galaxyDust: 180, galaxyAlpha: 0.9,
		onLayout(sides) {
			const r = rng(306);
			fields = sides.map((s) => {
				const gw = Math.ceil(s.w / CELL) + 1, gh = Math.ceil(s.h / CELL) + 1;
				return { gw, gh, vx: new Float32Array(gw * gh), vy: new Float32Array(gw * gh), energy: 0 };
			});
			particles = sides.map((s) => makeStars(r, Math.round(clamp(s.w * s.h / 5200, 30, 150)), s.w, s.h).map((p) => ({ ...p, vx: 0, vy: 0 })));
			tk?.wake();
		},
	});

	const step = (h) => {
		const rect = sky.hostRect;
		t += h;
		let awake = !reducedMotion;
		sky.sides.forEach((s, si) => {
			const f = fields[si];
			const [px, py] = sky.toLocal(s, ptr.p.x, ptr.p.y);
			const sp = Math.hypot(ptr.p.vx, ptr.p.vy);
			if (ptr.p.seen && sp > 8 && px > -140 && px < s.w + 140) {
				const R = 4, ci = Math.round(px / CELL), cj = Math.round(py / CELL);
				for (let j = Math.max(0, cj - R); j <= Math.min(f.gh - 1, cj + R); j++) {
					for (let i = Math.max(0, ci - R); i <= Math.min(f.gw - 1, ci + R); i++) {
						const dx = i * CELL - px, dy = j * CELL - py, d2 = dx * dx + dy * dy;
						const wgt = Math.exp(-d2 / (2 * 46 * 46)), k = j * f.gw + i;
						const inv = 1 / (Math.sqrt(d2) + 20);
						// cursor velocity injected, plus a swirl around it
						f.vx[k] += (ptr.p.vx * 0.045 - dy * inv * sp * 0.012) * wgt;
						f.vy[k] += (ptr.p.vy * 0.045 + dx * inv * sp * 0.012) * wgt;
					}
				}
			}
			let e = 0;
			const damp = Math.exp(-h * 1.1);
			for (let k = 0; k < f.vx.length; k++) {
				f.vx[k] *= damp; f.vy[k] *= damp;
				const m = Math.abs(f.vx[k]) + Math.abs(f.vy[k]);
				if (m < 0.2) { f.vx[k] = f.vy[k] = 0; } else e += m;
			}
			f.energy = e;
			if (e > 0) awake = true;
			for (const p of particles[si]) {
				const dr = reducedMotion ? [0, 0] : drift(p.x, p.y, t);
				const fv = f.energy > 0 ? sample(f, p.x, p.y) : [0, 0];
				p.vx = lerp(p.vx, dr[0] * 70 + fv[0], 1 - Math.exp(-h * 3));
				p.vy = lerp(p.vy, dr[1] * 70 + fv[1], 1 - Math.exp(-h * 3));
				p.x += p.vx * h; p.y += p.vy * h;
				if (p.x < -4) p.x += s.w + 8; else if (p.x > s.w + 4) p.x -= s.w + 8;
				if (p.y < -4) p.y += s.h + 8; else if (p.y > s.h + 4) p.y -= s.h + 8;
			}
		});
		ptr.p.vx *= Math.exp(-h * 9); ptr.p.vy *= Math.exp(-h * 9);
		return awake || Math.abs(ptr.p.vx) + Math.abs(ptr.p.vy) > 8;
	};
	const render = () => {
		const dark = isDark(), base = STAR[dark ? "dark" : "light"], hot = dark ? [120, 245, 200] : [40, 140, 150];
		sky.sides.forEach((s, si) => {
			const ctx = s.ctx;
			ctx.clearRect(0, 0, s.w, s.h);
			for (const p of particles[si]) {
				const sp = Math.hypot(p.vx, p.vy), m = clamp((sp - 12) / 90);
				const tw = reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(t * 0.7 + p.ph);
				const a = Math.min(1, (dark ? 0.75 : 0.6) * p.a * tw + m * 0.3);
				const c = [lerp(base[0], hot[0], m) | 0, lerp(base[1], hot[1], m) | 0, lerp(base[2], hot[2], m) | 0];
				const rr = p.r * (1 + m * 0.3);
				if (sp > 30) { // streak along the flow
					ctx.strokeStyle = `rgba(${c},${a * 0.7})`; ctx.lineWidth = rr * 0.8;
					ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
				}
				ctx.fillStyle = `rgba(${c},${a})`;
				if (rr <= 1.1) ctx.fillRect(p.x - 0.5, p.y - 0.5, 1.1, 1.1); else { ctx.beginPath(); ctx.arc(p.x, p.y, rr * 0.8, 0, TAU); ctx.fill(); }
			}
		});
	};
	tk = ticker({ step, render, hz: 60, fps: 24 });
	if (reducedMotion) render();
	tk.wake();
	const footerOff = watercolorFooter(root, reducedMotion);
	return () => { aur.destroy(); tk.destroy(); ptr.destroy(); sky.destroy(); footerOff(); };
}
