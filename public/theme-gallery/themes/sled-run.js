// 102. Sled Run: a procedurally generated snowy slope, a real-physics sled (tangent-projected contact,
// ballistic air time, spring-to-slope), branches to duck and logs to hop. Opt-in.
import { buildScene, ambientBirds } from "./ridge-runner/scenery.js";
import { drawHiker } from "./ridge-runner/hiker.js";
import { createPlayShell, readColors } from "./ridge-runner/shell.js";

const SLED_TOUCH = [
	{ key: "left", text: "◀", aria: "Brake / tilt back", side: "l" },
	{ key: "right", text: "▶", aria: "Push / tilt forward", side: "l" },
	{ key: "down", text: "▼", aria: "Duck", side: "r" },
	{ key: "jump", text: "▲", aria: "Hop", side: "r" },
];

const hash = (n) => {
	const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return s - Math.floor(s);
};

// Terrain height (y grows downward). Smooth rolling slope plus occasional kickers.
function ground(x) {
	let y = x * 0.36 + 30 * Math.sin(x / 260) + 10 * Math.sin(x / 95 + 1.3) + 4 * Math.sin(x / 37);
	const cell = Math.floor(x / 760);
	for (const c of [cell - 1, cell]) {
		if (c < 1 || hash(c * 3.1) < 0.4) continue;
		const xk = c * 760 + 280 + hash(c * 7.7) * 300;
		const u = (x - xk) / 90;
		if (u > 0 && u < 1) y -= 34 * Math.pow(u, 1.7) * (0.6 + hash(c) * 0.6);
		else if (u >= 1 && u < 1.16) y -= 34 * (0.6 + hash(c) * 0.6) * (1 - (u - 1) / 0.16) * (1 - (u - 1) / 0.16);
	}
	return y;
}
const slopeAt = (x) => (ground(x + 4) - ground(x - 4)) / 8;

// Obstacles live in cells of 420px, deterministic from the cell index.
function obstacleAt(c) {
	if (c < 3) return null;
	const h = hash(c * 1.91);
	if (h < 0.3) return null;
	const x = c * 420 + 120 + hash(c * 5.3) * 180;
	// Keep obstacles off the kicker ramps.
	return { x, type: h < 0.65 ? "branch" : "log", c };
}

export function activate({ root, mode, reducedMotion }) {
	const scene = buildScene(root, { seed: 102, lakeTop: 0.74, snow: true });
	const birds = ambientBirds(scene, {
		mode,
		reduced: reducedMotion,
		seed: 102,
		kinds: mode === "dark" ? ["owl", "sawwhet", "chickadee"] : ["chickadee", "cardinal", "jay", "nuthatch"],
		loon: false,
	});
	const shell = createPlayShell({
		root,
		reducedMotion,
		label: "Sled",
		hint: "→ push   ← brake   ↓ duck   Space hop   in air: ← → tilt   Esc exit",
		touch: SLED_TOUCH,
		start: (sh) => startGame(sh),
	});
	return () => {
		birds.stop();
		shell.destroy();
	};
}

function startGame(sh) {
	const { root } = sh;
	const P = 3;
	const names = ["snow", "snow-d", "snow-s", "tree", "tree-d", "trunk", "sled", "sled-l", "runner"];
	let col = readColors(root, names);
	const mo = new MutationObserver(() => (col = readColors(root, names)));
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	const G = 1500;
	const s = { x: 40, y: ground(40), vx: 90, vy: 0, ang: 0, av: 0, grounded: true, duck: 0, invuln: 0, crash: 0, t: 0 };
	let camX = 0, camY = 0, best = 0, hits = 0, flips = 0, spin = 0;
	const spray = [];
	const off = document.createElement("canvas");
	off.width = 96;
	off.height = 80;
	const octx = off.getContext("2d");

	const angDiff = (a, b) => {
		let d = (a - b) % (Math.PI * 2);
		if (d > Math.PI) d -= Math.PI * 2;
		if (d < -Math.PI) d += Math.PI * 2;
		return d;
	};

	function puff(x, y, n, power = 1) {
		if (sh.reduced) return;
		for (let i = 0; i < n; i++) spray.push({ x, y, vx: (Math.random() - 0.5) * 160 * power - s.vx * 0.15, vy: -Math.random() * 150 * power, life: 0.4 + Math.random() * 0.3 });
	}

	function step(dt, inp) {
		s.t += dt;
		s.invuln = Math.max(0, s.invuln - dt);
		s.duck += ((inp.down ? 1 : 0) - s.duck) * Math.min(1, dt * 14);
		if (s.crash > 0) {
			s.crash -= dt;
			s.vx *= 1 - Math.min(1, 3.5 * dt);
			s.vy += G * dt;
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			s.ang += 11 * dt;
			const gy = ground(s.x);
			if (s.y > gy) {
				s.y = gy;
				s.vy = 0;
			}
			if (s.crash <= 0) {
				s.grounded = true;
				s.ang = Math.atan(slopeAt(s.x));
				s.vx = Math.max(s.vx, 140);
				s.invuln = 1.2;
			}
			return;
		}
		if (s.grounded) {
			const sl = slopeAt(s.x);
			const norm = Math.hypot(1, sl);
			const tx = 1 / norm, ty = sl / norm;
			let sp = s.vx * tx + s.vy * ty;
			const cos = tx;
			sp += G * ty * dt;
			let drag = 0.0009 * (1 - 0.35 * s.duck);
			sp -= Math.sign(sp) * (G * cos * 0.04 + drag * sp * sp) * dt;
			if (inp.right) sp += 120 * dt;
			if (inp.left) sp -= Math.sign(sp) * 520 * dt;
			if (sp < 25) sp = 25;
			s.vx = sp * tx;
			s.vy = sp * ty;
			s.x += s.vx * dt;
			let gy = ground(s.x);
			const gap = gy - (s.y + s.vy * dt);
			s.y += s.vy * dt;
			if (gap > 1.5 + sp * dt * 0.1 && -gap < 0) {
				// ground fell away faster than the sled can follow: leave the surface.
				s.grounded = false;
			} else {
				s.y = gy;
			}
			s.ang += angDiff(Math.atan(sl), s.ang) * Math.min(1, dt * 16);
			if (s.grounded && inp.jumpCount !== s.jc) {
				s.jc = inp.jumpCount;
				s.vx += (sl / norm) * 330;
				s.vy += (-1 / norm) * 330;
				s.grounded = false;
				puff(s.x, s.y, 5);
			}
			if (!sh.reduced && s.grounded && sp > 220 && Math.random() < dt * 40) puff(s.x - 22, s.y - 2, 1, 0.5);
		} else {
			s.jc = inp.jumpCount;
			s.vy += G * dt;
			const ctl = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
			s.av += ctl * 14 * dt;
			s.av -= s.av * Math.min(1, 1.1 * dt);
			if (!ctl) s.av += angDiff(Math.atan2(s.vy, s.vx) * 0.7, s.ang) * 2.2 * dt;
			s.ang += s.av * dt;
			spin += s.av * dt;
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			const gy = ground(s.x);
			if (s.y >= gy) {
				const sl = slopeAt(s.x);
				const norm = Math.hypot(1, sl);
				const tx = 1 / norm, ty = sl / norm;
				const vn = -s.vx * ty + s.vy * tx; // component into the ground
				const mis = Math.abs(angDiff(s.ang, Math.atan(sl)));
				s.y = gy;
				if (mis > 0.85 && vn > 140 && s.invuln <= 0) {
					s.crash = 0.9;
					s.vx *= 0.3;
					s.vy = -120;
					hits++;
					puff(s.x, s.y, 16, 1.4);
				} else {
					const sp = (s.vx * tx + s.vy * ty) * (1 - Math.min(0.3, Math.max(0, vn) / 2600 + mis * 0.2));
					s.vx = sp * tx;
					s.vy = sp * ty;
					s.grounded = true;
					s.av = 0;
					if (Math.abs(spin) > 5.5) flips++;
					spin = 0;
					puff(s.x, s.y, 6);
				}
			}
		}
		// obstacles
		if (s.invuln <= 0 && !s.crash) {
			const c0 = Math.floor((s.x - 60) / 420);
			for (let c = c0; c <= c0 + 1; c++) {
				const o = obstacleAt(c);
				if (!o) continue;
				const dx = Math.abs(s.x - o.x);
				if (o.type === "log" && dx < 20 && s.y > ground(o.x) - 13) bonk(o);
				if (o.type === "branch" && dx < 26) {
					const by = ground(o.x) - 40;
					const top = s.y - (s.grounded ? 41 - s.duck * 12 : 44);
					if (top < by + 8 && s.y > by) bonk(o);
				}
			}
		}
		s.x > best && (best = s.x);
		for (const p of spray) {
			p.life -= dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vy += 500 * dt;
		}
		while (spray.length && spray[0].life <= 0) spray.shift();
	}

	function bonk(o) {
		hits++;
		s.invuln = 1.3;
		s.vx *= 0.35;
		s.vy *= 0.35;
		puff(s.x, s.y - 20, 14, 1.2);
		sh.toast(o.type === "log" ? "Bonk! Hop the logs." : "Whump! Duck the branches.", 1100);
	}

	const R = (ctx, x, y, w, h, c) => {
		ctx.fillStyle = c;
		ctx.fillRect(Math.round(x), Math.round(y), w, h);
	};

	function tree(ctx, x, base, h, shade) {
		const rows = Math.round(h / P);
		const c = shade ? col["tree-d"] : col.tree;
		R(ctx, x - P, base - P * 3, P * 2, P * 3, col.trunk);
		for (let r = 0; r < rows; r++) {
			const t = r / rows;
			const tier = (r % 6) / 6;
			const hw = Math.round(1 + t * (h / 22) * (0.5 + tier * 0.9));
			R(ctx, x - hw * P, base - (rows - r) * P - P * 3, hw * 2 * P + P, P, c);
			if (tier < 0.17 && r > 1) R(ctx, x - hw * P, base - (rows - r) * P - P * 3, Math.round(hw * 1.2) * P, P, col.snow);
		}
	}

	function drawObstacle(ctx, o, ox, oy) {
		const gy = ground(o.x);
		const X = o.x - ox, Y = gy - oy;
		if (o.type === "log") {
			R(ctx, X - 18, Y - 12, 36, 12, col.trunk);
			R(ctx, X - 18, Y - 12, 36, P, "#7a5438");
			R(ctx, X - 21, Y - 9, P, P * 2, "#d8b78a");
			R(ctx, X - 14, Y - 15, 28, P, col.snow);
		} else {
			// trunk behind the track, limb across it
			R(ctx, X + 22, Y - 130, P * 3, 130, col.trunk);
			const ly = Y - 40;
			R(ctx, X - 24, ly, 49, P * 2, col.trunk);
			for (let i = 0; i < 8; i++) R(ctx, X - 24 + i * 6, ly + P * 2, P * 2, P * (1 + (i % 3)), col.tree);
			R(ctx, X - 24, ly - P, 49, P, col.snow);
			R(ctx, X + 4, ly - P * 2, 18, P, col.snow);
			tree(ctx, X + 23, Y - 100, 80, false);
		}
	}

	function drawSled(ctx, sx, sy, blink) {
		octx.clearRect(0, 0, off.width, off.height);
		const ox = 28, oy = 64; // sled contact point inside the offscreen sprite
		// sled: curled runner + deck
		const r = (x, y, w, h, c) => {
			octx.fillStyle = c;
			octx.fillRect(ox + x * P, oy + y * P, w * P, h * P);
		};
		r(-3, -3, 19, 1, col["sled-l"]);
		r(-3, -2, 19, 1, col.sled);
		r(-3, -1, 19, 1, "#7a3f1c");
		r(-1, -1, 1, 1, col.runner);
		r(13, -1, 1, 1, col.runner);
		r(-3, 0, 20, 1, col.runner);
		r(16, -1, 1, 1, col.runner);
		r(17, -2, 1, 1, col.runner);
		r(17, -3, 1, 1, col.runner);
		// rider
		const duck = s.duck > 0.5;
		const a = { pose: duck ? "duck" : "sled", b: duck ? 2 : 0, armF: duck ? [10, 13] : [10, 9], armB: [8, 10], blink, pomX: -Math.min(2, Math.round(Math.hypot(s.vx, s.vy) / 180)), mouth: !s.grounded };
		drawHiker(octx, ox + 1 * P, oy - 16 * P - (duck ? -0 : 0) + (duck ? 0 : -3 * P) + 3 * P, P, 1, a);
		ctx.save();
		ctx.translate(Math.round(sx), Math.round(sy));
		ctx.rotate(s.ang);
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(off, -ox - 4, -oy);
		ctx.restore();
	}

	return {
		step,
		draw(ctx, dt) {
			const W = sh.w, H = sh.h;
			const tx = s.x - W * 0.3, ty = s.y - H * 0.6;
			const k = sh.reduced ? 1 : Math.min(1, dt * 7);
			camX += (tx - camX) * k;
			camY += (ty - camY) * (sh.reduced ? 1 : Math.min(1, dt * 4));
			const ox = Math.round(camX), oy = Math.round(camY);
			// background trees (two depth rows)
			for (const [step, back, hgt, shade] of [[118, 90, 74, true], [86, 46, 100, false]]) {
				const i0 = Math.floor((ox - 60) / step), i1 = Math.ceil((ox + W + 60) / step);
				for (let i = i0; i <= i1; i++) {
					const x = i * step + hash(i * 1.3 + back) * 40;
					const h = hgt * (0.75 + hash(i + back) * 0.6);
					if (hash(i * 2.1 + back) < 0.5) continue;
					tree(ctx, x - ox, ground(x) - back - oy, h, shade);
				}
			}
			for (let c = Math.floor(ox / 420) - 1; c <= Math.ceil((ox + W) / 420); c++) {
				const o = obstacleAt(c);
				if (o) drawObstacle(ctx, o, ox, oy);
			}
			// slope: a snow ribbon whose lower layers fade out so the page stays readable below
			const strip = (a, b, c, al) => {
				ctx.globalAlpha = al;
				ctx.fillStyle = c;
				ctx.beginPath();
				for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, Math.round(ground(x + ox) - oy + a));
				for (let x = W + 8; x >= 0; x -= 8) ctx.lineTo(x, Math.round(ground(x + ox) - oy + b));
				ctx.closePath();
				ctx.fill();
			};
			strip(0, 30, col.snow, 1);
			strip(30, 58, col["snow-d"], 0.85);
			strip(58, 88, col["snow-s"], 0.5);
			strip(88, 124, col["snow-s"], 0.2);
			ctx.globalAlpha = 1;
			ctx.fillStyle = col.snow;
			for (let x = 0; x < W; x += 3) ctx.fillRect(x, Math.round(ground(x + ox) - oy), 3, P);
			// sled track
			ctx.fillStyle = col["snow-d"];
			const x0 = Math.max(0, Math.round(-ox)), x1 = Math.round(s.x - ox - 24);
			for (let x = x0 - (x0 % 3); x < x1; x += 3) ctx.fillRect(x, Math.round(ground(x + ox) - oy) + 1, 3, 2);
			// spray
			for (const p of spray) {
				ctx.globalAlpha = Math.min(1, p.life * 3);
				R(ctx, p.x - ox, p.y - oy, P, P, col.snow);
			}
			ctx.globalAlpha = 1;
			if (!(s.invuln > 0 && Math.floor(s.t * 14) % 2 && !s.crash)) {
				drawSled(ctx, s.x - ox, s.y - oy, !sh.reduced && s.t % 3.3 < 0.13);
			}
		},
		hud: () => `Distance ${Math.max(0, Math.round((s.x - 40) / 20))} m   Best ${Math.round((best - 40) / 20)} m\nHits ${hits}   Flips ${flips}`,
		destroy() {
			mo.disconnect();
		},
	};
}
