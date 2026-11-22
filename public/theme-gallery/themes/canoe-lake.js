import { createStage, canvasLayer, ridgeGeo, paintRidge, forestGeo, paintForest, makePineVariants, Flock, Ripples, drawSheared, drawReflectionStrips, cloudSprite, glowSprite, makeStars, drawStars, onEmptyTap, addHint, isDark, watchDark, hex, rgba, clamp, lerp, rng, windAt, TAU } from "./forest-kit/kit.js";

const RAW = {
	light: {
		sky: [[0, "#a9c4e2"], [0.55, "#dfe0e2"], [1, "#f8e4c9"]],
		far: { top: "#8aa4c2", bottom: "#d2dde8", shade: "#5f7aa0", lit: "#f1f4f7" },
		mid: { top: "#7899ae", bottom: "#bed0d6", shade: "#52728d", lit: "#e8eef0" },
		midTrees: ["#668a98", "#5b8092", "#7098a2"],
		hills: { top: "#4f7a80", bottom: "#86adae", shade: "#385c68", lit: null },
		hillTrees: ["#3b6a66", "#315e5c", "#467670"],
		water: "#78a4b8", waterTop: "#a6c7d2", waterBot: "#33687f", mist: "#fff6e8",
		reed: "#1f3a36", ink: "#16232c",
		bird: ["rgba(50,68,90,.7)", "rgba(34,50,72,.82)", "rgba(20,32,48,.92)"],
		sun: [255, 238, 205],
	},
	dark: {
		sky: [[0, "#050a1c"], [0.55, "#14234a"], [1, "#31436f"]],
		far: { top: "#2a3a68", bottom: "#44577f", shade: "#16234a", lit: "#5f739e" },
		mid: { top: "#202e58", bottom: "#374b76", shade: "#111b3c", lit: null },
		midTrees: ["#18264b", "#142143", "#1c2c53"],
		hills: { top: "#17244a", bottom: "#27385f", shade: "#0d1630", lit: null },
		hillTrees: ["#101a3a", "#0d1632", "#141f42"],
		water: "#142543", waterTop: "#2b416f", waterBot: "#081330", mist: "#9aaede",
		reed: "#050a14", ink: "#050810",
		bird: ["rgba(190,205,235,.5)", "rgba(200,214,240,.66)", "rgba(215,226,248,.82)"],
		sun: [226, 236, 255],
	},
};
const conv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? hex(v) : Array.isArray(v) && typeof v[0] === "string" ? v.map(hex) : v && typeof v === "object" && !Array.isArray(v) && k !== "sky" ? conv(v) : v]));
const CP = { light: conv({ ...RAW.light, bird: undefined, sun: undefined, sky: undefined }), dark: conv({ ...RAW.dark, bird: undefined, sun: undefined, sky: undefined }) };

export function activate({ root, reducedMotion }) {
	let dark = isDark();
	const hint = addHint(root, reducedMotion ? "Click the water to paddle there" : "Click the water: ripples, and the canoe paddles over");
	const variants = makePineVariants(95, 8);
	const ripples = new Ripples(26);
	const skimmers = new Flock({ seed: 11, groups: 2, perGroup: [3, 5], size: [3.8, 5.5], band: [0.1, 0.2], speed: [55, 85], respawn: [3, 9], skim: true, flap: [7, 10] });
	const high = new Flock({ seed: 2, groups: 2, perGroup: [4, 8], size: [3.6, 5.8], band: [0.08, 0.3], speed: [40, 68], respawn: [2, 9], flap: [6, 9] });
	skimmers.onSkim = (x, y) => ripples.add(x, y, 0.3, 0.4);
	const canoe = { x: 0, y: 0, vx: 8, vy: 0, dir: 1, tx: 0, ty: 0, hold: 0, pp: 0, wake: [], wt: 0, manual: false, idle: 0 };
	const loon = { x: 0, y: 0, state: "float", p: 0, timer: 0, dir: -1 };
	let L = null, stars = [], sunSpr = null, mist1 = null, mist2 = null, reeds = [], tapped = false;
	const MX = 60;
	const stage = createStage(root, { reducedMotion, build, draw, update });
	const unwatch = watchDark((d) => { dark = d; if (stage.ready) { rebuildLayers(stage); stage.invalidate(); } });
	const pal = () => RAW[dark ? "dark" : "light"];
	const cp = () => CP[dark ? "dark" : "light"];

	function rebuildLayers(s) {
		const { w, h, dpr } = s;
		const p = pal(), q = cp(), lw = w + MX * 2;
		const mk = (geo, rp, tp, forest) => {
			const lay = canvasLayer(lw, h, dpr);
			paintRidge(lay.x, geo, { ...rp, depth: 70, light: 1 });
			if (forest) paintForest(lay.x, forest, variants, tp);
			return lay;
		};
		L.far = mk(L.farGeo, q.far);
		L.mid = mk(L.midGeo, q.mid, q.midTrees, L.midForest);
		L.hills = mk(L.hillGeo, q.hills, q.hillTrees, L.hillForest);
		const sky = canvasLayer(w, h, dpr);
		const g = sky.x.createLinearGradient(0, 0, 0, L.waterY);
		p.sky.forEach(([t, c]) => g.addColorStop(t, c));
		sky.x.fillStyle = g;
		sky.x.fillRect(0, 0, w, h);
		L.sky = sky;
		L.refl = canvasLayer(w, h - L.waterY + 40, dpr);
		stars = makeStars(rng(95), 170, w, h * 0.4);
		sunSpr = glowSprite(256, p.sun, [0.9, 0.22, 0]);
		mist1 = cloudSprite(620, 110, 4, [q.mist[0], q.mist[1], q.mist[2]], dark ? 0.2 : 0.42);
		mist2 = cloudSprite(760, 120, 12, [q.mist[0], q.mist[1], q.mist[2]], dark ? 0.16 : 0.34);
	}

	function build(s) {
		const { w, h } = s, lw = w + MX * 2;
		const waterY = Math.round(h * 0.46);
		L = { waterY, depth: h - waterY };
		L.farGeo = ridgeGeo({ w: lw, h, baseY: h * 0.44, amp: h * 0.25, scale: w * 0.25, seed: 62, power: 1.15, x0: 0.6 });
		L.midGeo = ridgeGeo({ w: lw, h, baseY: h * 0.47, amp: h * 0.085, scale: w * 0.15, seed: 12, power: 1.2 });
		L.midForest = forestGeo({ w: lw, h, ridge: L.midGeo, rows: 3, rowGap: 5, tree: [8, 14], gap: [4, 7], seed: 71, bottom: waterY });
		L.hillGeo = ridgeGeo({ w: lw, h, baseY: h * 0.455, amp: h * 0.02, scale: w * 0.12, seed: 3, power: 1.1 });
		L.hillForest = forestGeo({ w: lw, h, ridge: L.hillGeo, rows: 2, rowGap: 5, tree: [12, 22], gap: [4, 8], seed: 8, bottom: waterY });
		const r = rng(5);
		reeds = [];
		for (const [a, b] of [[-40, w * 0.2], [w * 0.82, w + 40]]) {
			for (let i = 0; i < 44; i++) {
				const x = lerp(a, b, Math.pow(r(), 0.9));
				const edge = Math.min(Math.abs(x - a), Math.abs(x - b));
				reeds.push({ x, hh: lerp(40, 120, r()) * (0.6 + 0.6 * Math.min(1, (Math.min(Math.abs(x), Math.abs(x - w)) < w * 0.1 ? 1 : 0.5))), ph: r() * 6, lean: (r() - 0.5) * 20, cat: r() < 0.22 });
			}
		}
		rebuildLayers(s);
		skimmers.resize(w, h); high.resize(w, h);
		canoe.x = w * 0.2; canoe.y = waterY + L.depth * 0.34; canoe.tx = w * 0.82; canoe.ty = canoe.y; canoe.vx = 8;
		loon.x = w * 0.72; loon.y = waterY + L.depth * 0.22;
		if (s.reduced) { skimmers.settle(env(s), 6); high.settle(env(s), 6); canoe.x = w * 0.28; canoe.dir = 1; }
	}
	const env = (s) => ({ wind: 0.3, waterY: L.waterY + L.depth * 0.3, pointer: s.pointer });
	const DEPTH = { far: 5, mid: 10, hills: 16, fg: 44 };
	const offs = (s) => { const o = {}; for (const k in DEPTH) o[k] = [-s.px * DEPTH[k], -s.scrollT * DEPTH[k] * 0.8 - s.py * DEPTH[k] * 0.1]; return o; };
	const scaleAt = (y) => 0.85 + 0.9 * clamp((y - L.waterY) / L.depth);
	const squashAt = (y) => 0.1 + 0.25 * clamp((y - L.waterY) / L.depth);

	function dive() {
		if (loon.state !== "float") return;
		loon.state = "dive"; loon.p = 0;
		ripples.add(loon.x, loon.y, 0.7, 0.9);
	}

	function update(dt, s) {
		if (s.reduced) return;
		const { w } = s;
		ripples.step(dt);
		skimmers.update(dt, env(s));
		high.update(dt, env(s));
		// canoe steering
		const c = canoe;
		const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
		if (d < 10) {
			c.idle += dt;
			if (c.idle > (c.manual ? 4 : 1)) {
				c.idle = 0; c.manual = false;
				c.tx = c.x > w * 0.5 ? lerp(w * 0.08, w * 0.35, Math.random()) : lerp(w * 0.65, w * 0.92, Math.random());
				c.ty = L.waterY + L.depth * lerp(0.2, 0.6, Math.random());
			}
		}
		const sp = d < 10 ? 0 : Math.min(c.manual ? 38 : 20, 6 + d * 0.35);
		c.vx += ((dx / (d + 0.01)) * sp - c.vx) * Math.min(1, dt * 0.9);
		c.vy += ((dy / (d + 0.01)) * sp * 0.5 - c.vy) * Math.min(1, dt * 0.9);
		c.x += c.vx * dt; c.y += c.vy * dt;
		if (Math.abs(c.vx) > 3) c.dir += (Math.sign(c.vx) - c.dir) * Math.min(1, dt * 2.5);
		const speed = Math.hypot(c.vx, c.vy);
		const prev = c.pp;
		c.pp += dt * (0.4 + speed * 0.045);
		if (Math.floor(c.pp) !== Math.floor(prev) && speed > 3) ripples.add(c.x + c.dir * (24 * scaleAt(c.y)), c.y + 2, 0.45, 0.45);
		c.wt -= dt;
		if (c.wt <= 0 && speed > 4) { c.wt = 0.16; c.wake.push({ x: c.x - c.dir * 40 * scaleAt(c.y), y: c.y, age: 0, s: scaleAt(c.y) }); }
		for (const q of c.wake) q.age += dt;
		c.wake = c.wake.filter((q) => q.age < 3.2);
		// loon
		const lo = loon;
		if (lo.state === "float") {
			if (Math.hypot(c.x - lo.x, (c.y - lo.y) * 2) < 110) dive();
		} else if (lo.state === "dive") {
			lo.p += dt / 0.8;
			if (lo.p >= 1) { lo.state = "under"; lo.timer = 4 + Math.random() * 4; }
		} else if (lo.state === "under") {
			if ((lo.timer -= dt) <= 0) {
				lo.x = lerp(w * 0.08, w * 0.92, Math.random()); lo.y = L.waterY + L.depth * lerp(0.12, 0.5, Math.random());
				lo.dir = Math.random() < 0.5 ? -1 : 1; lo.state = "rise"; lo.p = 0;
				ripples.add(lo.x, lo.y, 0.6, 0.8);
			}
		} else if (lo.state === "rise") { lo.p += dt / 0.9; if (lo.p >= 1) lo.state = "float"; }
	}

	function drawCanoe(ctx, flip, t) {
		const c = canoe, sc = scaleAt(c.y);
		const bob = Math.sin(t * 1.3) * 0.7;
		ctx.save();
		ctx.translate(c.x, c.y + bob * sc);
		ctx.scale(sc * c.dir, flip ? -sc : sc);
		ctx.translate(0, -4);
		ctx.rotate(Math.sin(t * 0.9) * 0.012);
		const ink = pal().reed === undefined ? "#000" : (dark ? "#04070f" : "#17222c");
		ctx.fillStyle = ink;
		ctx.strokeStyle = ink;
		ctx.beginPath();
		ctx.moveTo(-52, -10);
		ctx.quadraticCurveTo(-38, 3, -20, 4.2);
		ctx.lineTo(20, 4.2);
		ctx.quadraticCurveTo(38, 3, 54, -12);
		ctx.quadraticCurveTo(8, -3.5, -52, -10);
		ctx.fill();
		// pack in bow
		ctx.beginPath(); ctx.roundRect(24, -12, 15, 8, 3); ctx.fill();
		// paddler
		ctx.beginPath();
		ctx.moveTo(-13, -4);
		ctx.quadraticCurveTo(-14, -18, -8, -25);
		ctx.quadraticCurveTo(-2, -28, 3, -24);
		ctx.quadraticCurveTo(7, -14, 5, -4);
		ctx.fill();
		ctx.beginPath(); ctx.arc(-3, -32, 4.6, 0, TAU); ctx.fill();
		ctx.beginPath(); ctx.ellipse(-3, -35, 8, 1.8, 0, 0, TAU); ctx.fill(); // brim
		// paddle stroke
		const ph = (c.pp % 1) * TAU;
		const sw = Math.sin(ph);
		const bladeX = 20 + 12 * sw, bladeY = 1 + Math.max(0, Math.cos(ph)) * -5;
		ctx.lineWidth = 3; ctx.lineCap = "round";
		ctx.beginPath(); ctx.moveTo(-1, -22); ctx.lineTo(11, -16); ctx.stroke();
		ctx.lineWidth = 1.8;
		ctx.beginPath(); ctx.moveTo(10, -26); ctx.lineTo(bladeX, bladeY); ctx.stroke();
		ctx.beginPath(); ctx.ellipse(bladeX + 1, bladeY + 2, 2.6, 6, 0.25 * sw, 0, TAU); ctx.fill();
		ctx.restore();
	}

	function drawLoon(ctx, flip, a) {
		const lo = loon;
		let alpha = a, dy = 0;
		if (lo.state === "under") return;
		if (lo.state === "dive") { dy = lo.p * 9; alpha *= 1 - lo.p; }
		if (lo.state === "rise") { dy = (1 - lo.p) * 9; alpha *= lo.p; }
		const sc = scaleAt(lo.y) * 0.95;
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.translate(lo.x, lo.y + dy + Math.sin(performance.now() / 900) * 0.4);
		ctx.scale(sc * lo.dir, flip ? -sc : sc);
		ctx.fillStyle = dark ? "#050810" : "#15202a";
		ctx.beginPath(); ctx.ellipse(-2, -3, 13, 4.6, 0, 0, TAU); ctx.fill();
		ctx.beginPath();
		ctx.moveTo(6, -5); ctx.quadraticCurveTo(11, -9, 10, -14); ctx.lineTo(13, -14); ctx.quadraticCurveTo(14, -8, 11, -3); ctx.fill();
		ctx.beginPath(); ctx.ellipse(11.8, -14.5, 3.2, 2.6, 0, 0, TAU); ctx.fill();
		ctx.beginPath(); ctx.moveTo(14.5, -15.5); ctx.lineTo(20, -14.6); ctx.lineTo(14.5, -13.5); ctx.fill();
		if (!flip) {
			ctx.fillStyle = dark ? "rgba(190,205,235,.35)" : "rgba(235,240,245,.55)";
			for (let i = 0; i < 7; i++) ctx.fillRect(-9 + i * 2.6, -6.2 + (i % 2) * 1.8, 1.2, 1.2);
		}
		ctx.restore();
	}

	function draw(ctx, s) {
		const { w, h } = s, t = s.t, p = pal(), q = cp(), o = offs(s), wy = L.waterY + o.hills[1], depth = h - wy;
		ctx.drawImage(L.sky.c, 0, 0, w, h);
		drawStars(ctx, stars, t, dark ? 1 : 0, [225, 232, 255], o.far[0] * 0.3, o.far[1] * 0.3);
		const sx = dark ? w * 0.12 : w * 0.14, sy = h * 0.2;
		ctx.globalAlpha = dark ? 0.8 : 0.95;
		ctx.drawImage(sunSpr, sx - 170 + o.far[0] * 0.4, sy - 170, 340, 340);
		ctx.globalAlpha = 1;
		ctx.fillStyle = dark ? "rgba(236,241,255,.93)" : "rgba(255,248,226,.97)";
		ctx.beginPath(); ctx.arc(sx + o.far[0] * 0.4, sy, dark ? 16 : 22, 0, TAU); ctx.fill();
		ctx.drawImage(L.far.c, -MX + o.far[0], o.far[1], L.far.w, L.far.h);
		const drift = (t * 5) % 1500;
		ctx.drawImage(mist1, ((drift * 0.7 + 200) % (w + 700)) - 500, L.waterY - 90 + o.mid[1], 620, 110);
		drawSheared(ctx, L.mid, -MX + o.mid[0], o.mid[1], { bands: 8, amp: 1.2, t, phase: 1, wind: 0.4 });
		drawSheared(ctx, L.hills, -MX + o.hills[0], o.hills[1], { bands: 8, amp: 1.8, t, phase: 2, wind: 0.5 });
		// water
		ctx.fillStyle = p.water;
		ctx.fillRect(0, wy, w, h - wy);
		const R = L.refl, rx = R.x;
		rx.setTransform(s.dpr, 0, 0, -s.dpr, 0, s.dpr * L.waterY);
		rx.clearRect(0, -h, w, h * 3);
		rx.drawImage(L.sky.c, 0, 0, w, h);
		rx.drawImage(L.far.c, -MX + o.far[0], o.far[1] - o.hills[1], L.far.w, L.far.h);
		rx.drawImage(L.mid.c, -MX + o.mid[0], o.mid[1] - o.hills[1], L.mid.w, L.mid.h);
		rx.drawImage(L.hills.c, -MX + o.hills[0], 0, L.hills.w, L.hills.h);
		drawReflectionStrips(ctx, R, { y: wy, w, depth, t, amp: 1.5, strip: 3, alpha: 0.78, fadeTo: 0.3 });
		const g = ctx.createLinearGradient(0, wy, 0, h);
		g.addColorStop(0, rgba(q.waterTop, 0.2));
		g.addColorStop(1, rgba(q.waterBot, 0.7));
		ctx.fillStyle = g;
		ctx.fillRect(0, wy, w, depth);
		// glitter path
		ctx.fillStyle = dark ? "rgba(230,238,255,.8)" : "rgba(255,250,232,.85)";
		for (let i = 0; i < 50; i++) {
			const f = (i * 0.6180339) % 1;
			const yy = wy + 3 + f * (depth - 6), spread = 12 + f * 90;
			const xx = sx + o.far[0] * 0.4 + Math.sin(i * 12.9 + t * 0.4) * spread * 0.8;
			ctx.globalAlpha = Math.max(0, Math.sin(t * (1.4 + (i % 5) * 0.35) + i * 3.1)) * (1 - f * 0.55) * (dark ? 0.55 : 0.7);
			ctx.fillRect(xx, yy, 2 + f * 10 * (1 + (i % 3) * 0.4), 1 + f * 1.2);
		}
		ctx.globalAlpha = 1;
		// horizon mist band
		const mg = ctx.createLinearGradient(0, wy - 18, 0, wy + 40);
		const mc = q.mist;
		mg.addColorStop(0, rgba(mc, 0)); mg.addColorStop(0.35, rgba(mc, dark ? 0.1 : 0.28)); mg.addColorStop(1, rgba(mc, 0));
		ctx.fillStyle = mg; ctx.fillRect(0, wy - 18, w, 58);
		ctx.drawImage(mist2, ((drift * 1.1 + 900) % (w + 800)) - 500, wy - 30, 760, 120);
		// canoe wake
		ctx.lineWidth = 1;
		for (const k of canoe.wake) {
			const f = k.age / 3.2, rad = k.age * 15 * k.s + 4;
			ctx.strokeStyle = dark ? `rgba(190,210,245,${(1 - f) * 0.3})` : `rgba(255,255,255,${(1 - f) * 0.55})`;
			ctx.beginPath();
			ctx.ellipse(k.x, k.y + 4, rad * 1.6, rad * squashAt(k.y) * 1.3, 0, 0, TAU);
			ctx.stroke();
		}
		ripples.draw(ctx, { perspective: squashAt, color: dark ? [190, 210, 245] : [255, 255, 255], dark: [10, 30, 50] });
		// reflections of canoe & loon
		const cy = canoe.y, loY = loon.y;
		ctx.save();
		ctx.globalAlpha = 0.3;
		drawCanoe(ctx, true, t);
		ctx.restore();
		drawLoon(ctx, true, 0.3);
		skimmers.draw(ctx, p.bird, { reflectY: env(s).waterY + 2, reflectAlpha: 0.22 });
		high.draw(ctx, p.bird, { reflectY: wy, reflectAlpha: 0.15 });
		drawLoon(ctx, false, 1);
		drawCanoe(ctx, false, t);
		// reeds
		ctx.strokeStyle = p.reed ? (dark ? "#050a14" : "#1f3a36") : "#000";
		ctx.lineWidth = 1.7;
		ctx.lineCap = "round";
		ctx.beginPath();
		for (const r of reeds) {
			const sway = (windAt(t, r.x, 0.5) * 0.5 + Math.sin(t * 1.2 + r.ph) * 0.15) * 14;
			const x0 = r.x + o.fg[0], y0 = h + 6 + o.fg[1];
			ctx.moveTo(x0, y0);
			ctx.quadraticCurveTo(x0 + r.lean * 0.4, y0 - r.hh * 0.55, x0 + r.lean + sway, y0 - r.hh);
		}
		ctx.stroke();
		ctx.fillStyle = ctx.strokeStyle;
		ctx.beginPath();
		for (const r of reeds) {
			if (!r.cat) continue;
			const sway = (windAt(t, r.x, 0.5) * 0.5 + Math.sin(t * 1.2 + r.ph) * 0.15) * 14;
			const ex = r.x + o.fg[0] + r.lean + sway;
			ctx.moveTo(ex + 2.4, h + 6 + o.fg[1] - r.hh - 7);
			ctx.ellipse(ex, h + 6 + o.fg[1] - r.hh - 7, 2.4, 8, sway * 0.02, 0, TAU);
		}
		ctx.fill();
	}

	onEmptyTap(stage, (cx, cy) => {
		const [x, y] = stage.toLocal(cx, cy);
		const wy = L.waterY;
		if (!tapped) { tapped = true; hint.hide(); }
		if (y > wy + 8) {
			ripples.add(x, y, 1, 1.1);
			canoe.tx = x; canoe.ty = clamp(y, wy + L.depth * 0.14, wy + L.depth * 0.9); canoe.manual = true; canoe.idle = 0;
			if (stage.reduced) { canoe.x = canoe.tx; canoe.y = canoe.ty; canoe.dir = x > canoe.x ? 1 : -1; stage.invalidate(); }
			if (Math.hypot(x - loon.x, (y - loon.y) * 2) < 170) dive();
			skimmers.scare(x, y - 20, 70, 0.3);
		} else { high.scare(x, y, 110, 0.7); }
	});

	return () => { stage.destroy(); unwatch(); };
}
