// 130 — Dandelions: seed heads in the margins. Brushing one releases its seeds, which drift on a slow breeze; heads slowly regrow.
import { createLoop, mountCanvas, trackPointer, rng } from "./kit-126-135/kit.js";

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".overlay-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { maxDpr: 1.5, type: "2d" });
	const ctx = view.ctx;
	const col = dark
		? { stem: "rgba(120,170,140,0.55)", seed: "rgba(225,236,255,", core: "rgba(200,215,240,0.55)", glow: "rgba(170,200,255,0.10)" }
		: { stem: "rgba(92,128,84,0.7)", seed: "rgba(96,110,128,", core: "rgba(120,130,140,0.55)", glow: "rgba(255,255,255,0)" };
	let heads = [];
	let flying = [];
	let loop = null;
	const SEEDS = 46;
	const build = () => {
		const r = rng(77);
		const W = view.cssW;
		const H = view.cssH;
		const wide = W > 900;
		const spots = wide
			? [[0.07, 0.62, 44], [0.13, 0.78, 32], [0.2, 0.9, 26], [0.93, 0.58, 46], [0.87, 0.75, 33], [0.8, 0.88, 26]]
			: [[0.08, 0.86, 30], [0.92, 0.82, 34]];
		heads = spots.map(([fx, fy, rad], i) => {
			const seeds = [];
			for (let k = 0; k < SEEDS; k++) {
				// fibonacci-ish distribution over a sphere projected to 2D
				const a = k * 2.399 + r() * 0.3;
				const z = 1 - (2 * (k + 0.5)) / SEEDS;
				const rr = Math.sqrt(1 - z * z);
				seeds.push({ ux: Math.cos(a) * rr, uy: Math.sin(a) * rr, uz: z, gone: false, grow: 1, ang: Math.atan2(Math.sin(a) * rr, Math.cos(a) * rr) });
			}
			const bx = fx * W + (fx < 0.5 ? -10 : 10);
			return { x: fx * W, y: fy * H, r: rad, bx, by: H + 10, seeds, bend: (fx < 0.5 ? 1 : -1) * (0.15 + r() * 0.15), sway: 0, sv: 0, ph: r() * 6, regrow: 0, i };
		});
	};
	const seedPath = (path, x, y, ang, len, fl) => {
		// filament + fluffy umbrella of fine bristles
		const ex = x + Math.cos(ang) * len;
		const ey = y + Math.sin(ang) * len;
		path.moveTo(x, y);
		path.lineTo(ex, ey);
		for (let k = 0; k < 7; k++) {
			const a2 = ang + (k - 3) * 0.42;
			path.moveTo(ex, ey);
			path.lineTo(ex + Math.cos(a2) * fl, ey + Math.sin(a2) * fl);
		}
	};
	const headPos = (h) => {
		const lean = h.bend + h.sway;
		const h0 = h.by - h.y;
		return { x: h.bx + Math.sin(lean) * h0, y: h.by - Math.cos(lean) * h0, lean };
	};
	const draw = (now) => {
		ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
		ctx.clearRect(0, 0, view.cssW, view.cssH);
		const stems = new Path2D();
		const fluff = new Path2D();
		const cores = new Path2D();
		for (const h of heads) {
			const hp = headPos(h);
			stems.moveTo(h.bx, h.by);
			stems.quadraticCurveTo(h.bx + Math.sin(hp.lean * 0.3) * (h.by - hp.y) * 0.5, (h.by + hp.y) / 2, hp.x, hp.y);
			let any = false;
			for (const s of h.seeds) {
				if (s.gone) continue;
				any = true;
				const len = h.r * (0.35 + 0.65 * s.grow) * 0.55;
				const x = hp.x + s.ux * h.r * 0.12;
				const y = hp.y + s.uy * h.r * 0.12;
				seedPath(fluff, x, y, s.ang, h.r * (0.55 + 0.45 * Math.hypot(s.ux, s.uy)) * s.grow, h.r * 0.2 * s.grow);
			}
			cores.moveTo(hp.x + 3, hp.y);
			cores.arc(hp.x, hp.y, 3.2, 0, 6.3);
			if (!any) continue;
		}
		ctx.lineCap = "round";
		ctx.strokeStyle = col.stem;
		ctx.lineWidth = 1.6;
		ctx.stroke(stems);
		ctx.strokeStyle = col.seed + "0.38)";
		ctx.lineWidth = 0.7;
		ctx.stroke(fluff);
		ctx.fillStyle = col.core;
		ctx.fill(cores);
		// flying seeds
		const fp = new Path2D();
		for (const s of flying) {
			ctx.globalAlpha = Math.min(1, s.life * 0.6);
			const p = new Path2D();
			seedPath(p, s.x, s.y, s.ang, s.len, s.len * 0.38);
			ctx.strokeStyle = col.seed + "0.6)";
			ctx.lineWidth = 0.8;
			ctx.stroke(p);
		}
		ctx.globalAlpha = 1;
	};
	view.onResize = () => {
		build();
		draw(0);
	};
	view.onResize();
	if (reducedMotion) return () => view.destroy();

	const ptr = { x: -999, y: -999, on: false };
	let lastActive = 0;
	const release = (h, hp, p, strength) => {
		const rng2 = Math.random;
		for (const s of h.seeds) {
			if (s.gone) continue;
			const sx = hp.x + s.ux * h.r * 0.5;
			const sy = hp.y + s.uy * h.r * 0.5;
			if (Math.hypot(sx - p.x, sy - p.y) < h.r * 0.9 && rng2() < strength) {
				s.gone = true;
				s.grow = 0;
				const dx = sx - p.x;
				const dy = sy - p.y;
				const d = Math.hypot(dx, dy) || 1;
				flying.push({ x: sx, y: sy, vx: (dx / d) * (20 + rng2() * 30) + 18 + p.vx * 3, vy: (dy / d) * 10 - 14 - rng2() * 16, ang: s.ang + (rng2() - 0.5), spin: (rng2() - 0.5) * 0.8, len: h.r * 0.3, life: 9 + rng2() * 6, ph: rng2() * 6 });
				if (flying.length > 260) flying.shift();
			}
		}
	};
	const tracker = trackPointer(layer, {
		onMove(p) {
			ptr.x = p.x;
			ptr.y = p.y;
			ptr.vx = p.vx;
			ptr.on = true;
			lastActive = performance.now();
			for (const h of heads) {
				const hp = headPos(h);
				const d = Math.hypot(hp.x - p.x, hp.y - p.y);
				if (d < h.r * 1.5) {
					h.sv += (hp.x > p.x ? 1 : -1) * 0.02 * Math.min(1, Math.hypot(p.vx, p.vy) / 8);
					release(h, hp, p, 0.25);
				}
			}
			loop.wake();
		},
		onLeave() {
			ptr.on = false;
		},
	});
	let t = 0;
	loop = createLoop((dt, now) => {
		t += dt;
		let busy = flying.length > 0;
		for (const h of heads) {
			h.sv += (-26 * h.sway - 2.4 * h.sv) * dt;
			h.sway += h.sv * dt;
			if (Math.abs(h.sv) > 0.002 || Math.abs(h.sway) > 0.002) busy = true;
			for (const s of h.seeds) {
				if (s.gone) {
					h.regrow += dt;
					if (h.regrow > 0.9 + Math.random() * 0.1) {
						// seeds grow back one at a time, slowly
					}
				} else if (s.grow < 1) {
					s.grow = Math.min(1, s.grow + dt * 0.5);
					busy = true;
				}
			}
			if (h.seeds.some((s) => s.gone)) {
				busy = true;
				h.regrow += dt;
				if (h.regrow > 0.35) {
					h.regrow = 0;
					if (now - lastActive > 14000) {
						const s = h.seeds.find((q) => q.gone);
						if (s) {
							s.gone = false;
							s.grow = 0.01;
						}
					}
				}
			}
		}
		for (let i = flying.length - 1; i >= 0; i--) {
			const s = flying[i];
			s.ph += dt * 1.4;
			s.vx += (24 + Math.sin(s.ph) * 8 - s.vx) * dt * 0.4;
			s.vy += (-6 + Math.cos(s.ph * 0.8) * 10 - s.vy) * dt * 0.4;
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			s.ang += s.spin * dt;
			s.life -= dt;
			if (s.life <= 0 || s.x > view.cssW + 40 || s.y < -40) flying.splice(i, 1);
		}
		draw(now);
		return busy;
	});
	return () => {
		loop.stop();
		tracker.destroy();
		view.destroy();
	};
}
