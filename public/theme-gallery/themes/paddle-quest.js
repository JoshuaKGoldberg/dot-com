// 101. Paddle Quest: steer a canoe around a lake of pine islands and gather water lilies.
import { buildScene, ambientBirds, islandSVG } from "./ridge-runner/scenery.js";
import { drawHiker } from "./ridge-runner/hiker.js";
import { createPlayShell, readColors } from "./ridge-runner/shell.js";
import { rng, div } from "./two-skies-one-shore/lib.js";

const LAKE_TOP = 0.5;

const PADDLE_TOUCH = [
	{ key: "left", text: "◀", aria: "Paddle left", side: "l" },
	{ key: "right", text: "▶", aria: "Paddle right", side: "l" },
	{ key: "up", text: "▲", aria: "Paddle away", side: "r" },
	{ key: "down", text: "▼", aria: "Paddle toward you", side: "r" },
];

function makeIslands() {
	const r = rng(1011);
	const out = [];
	let guard = 0;
	while (out.length < 7 && guard++ < 400) {
		const rx = 46 + r() * 62;
		const fx = 0.07 + r() * 0.86;
		const fy = LAKE_TOP + 0.11 + r() * (0.78 - LAKE_TOP);
		const bad = out.some((o) => Math.abs(o.fx - fx) * 1000 < (o.rx + rx) * 1.05 && Math.abs(o.fy - fy) < 0.09);
		const spawn = Math.abs(fx - 0.5) < 0.12 && fy > 0.7;
		if (!bad && !spawn) out.push({ fx, fy, rx, seed: 200 + out.length * 7 });
	}
	return out;
}

export function activate({ root, mode, reducedMotion }) {
	const scene = buildScene(root, { seed: 101, lakeTop: LAKE_TOP });
	const islands = makeIslands();
	const nodes = islands.map((o) => {
		const wrap = div("island", scene.B);
		const svg = islandSVG({ rx: o.rx, seed: o.seed });
		const th = o.rx * 1.05;
		wrap.style.left = `${o.fx * 100}%`;
		wrap.style.top = `${o.fy * 100}%`;
		wrap.style.transform = `translate(-50%, ${-(th + 10)}px)`;
		wrap.appendChild(svg);
		o.trees = svg._trees;
		o.th = th;
		return wrap;
	});
	void nodes;
	const water = [[0.3, 0.57], [0.72, 0.56], [0.5, 0.6]].map(([x, y]) => ({ x, y, face: 1, water: true }));
	const birds = ambientBirds(scene, {
		mode,
		reduced: reducedMotion,
		seed: 101,
		kinds: mode === "dark" ? ["owl", "swallow", "chickadee", "loon"] : ["swallow", "swallow", "jay", "goldfinch", "loon"],
		loon: false,
		extraPerches: water,
	});
	const shell = createPlayShell({
		root,
		reducedMotion,
		label: "Paddle",
		hint: "Arrows / WASD paddle   Space power stroke   Esc exit",
		touch: PADDLE_TOUCH,
		start: (sh) => startGame(sh, islands, scene),
	});
	return () => {
		birds.stop();
		shell.destroy();
	};
}

function startGame(sh, islands, scene) {
	const { root } = sh;
	const P = 3;
	const names = ["lily", "lily-c", "pad", "wake", "hull", "hull-l", "hull-d", "stripe"];
	let col = readColors(root, names);
	const mo = new MutationObserver(() => (col = readColors(root, names)));
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	const geo = islands.map((o) => {
		const p = new Path2D();
		p.ellipse(0, 0, o.rx, o.rx * 0.24, 0, 0, Math.PI * 2);
		for (const d of o.trees) p.addPath(new Path2D(d));
		return { o, path: p, cx: 0, cy: 0, rx: o.rx * 1.02 + 16, ry: o.rx * 0.24 + 12 };
	});
	const c = { x: 0, y: 0, vx: 0, vy: 0, face: 1, phase: 0, thrust: 0, t: 0 };
	let lilies = [];
	const wake = [];
	const petals = [];
	let got = 0;

	function layout() {
		const W = sh.w, H = sh.h;
		for (const g of geo) {
			g.cx = g.o.fx * W;
			g.cy = g.o.fy * H;
		}
		const r = rng(77);
		lilies = lilies.length ? lilies.map((l) => ({ ...l, x: l.fx * W, y: l.fy * H })) : [];
		if (!lilies.length) {
			let guard = 0;
			while (lilies.length < 8 && guard++ < 500) {
				const fx = 0.06 + r() * 0.88, fy = LAKE_TOP + 0.08 + r() * 0.38;
				const x = fx * W, y = fy * H;
				if (geo.some((g) => ((x - g.cx) / (g.rx + 14)) ** 2 + ((y - g.cy) / (g.ry + 10)) ** 2 < 1)) continue;
				if (lilies.some((l) => Math.hypot(l.x - x, l.y - y) < 120)) continue;
				lilies.push({ fx, fy, x, y, got: false, ph: r() * 6 });
			}
		}
	}
	layout();
	c.x = sh.w * 0.5;
	c.y = sh.h * 0.88;

	function step(dt, inp) {
		const W = sh.w, H = sh.h;
		c.t += dt;
		const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
		const dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
		const power = inp.space ? 1.9 : 1;
		const len = Math.hypot(dx, dy) || 1;
		const acc = 210 * power;
		c.thrust = dx || dy ? 1 : 0;
		if (dx || dy) {
			c.vx += (dx / len) * acc * dt;
			c.vy += (dy / len) * acc * 0.62 * dt;
			if (dx) c.face = dx;
		}
		const drag = 1.25;
		c.vx -= c.vx * drag * dt;
		c.vy -= c.vy * drag * 1.3 * dt;
		const max = 150 * (inp.space ? 1.35 : 1);
		const sp = Math.hypot(c.vx, c.vy / 0.62);
		if (sp > max) {
			c.vx *= max / sp;
			c.vy *= max / sp;
		}
		c.x += c.vx * dt;
		c.y += c.vy * dt;
		const lakeTopY = H * LAKE_TOP + 40;
		if (c.x < 40) (c.x = 40), (c.vx = Math.max(0, c.vx));
		if (c.x > W - 40) (c.x = W - 40), (c.vx = Math.min(0, c.vx));
		if (c.y < lakeTopY) (c.y = lakeTopY), (c.vy = Math.max(0, c.vy));
		if (c.y > H - 22) (c.y = H - 22), (c.vy = Math.min(0, c.vy));
		for (const g of geo) {
			const nx = (c.x - g.cx) / g.rx, ny = (c.y - g.cy) / g.ry;
			const d = nx * nx + ny * ny;
			if (d < 1) {
				const dd = Math.sqrt(d) || 0.001;
				const ux = nx / dd, uy = ny / dd;
				c.x = g.cx + ux * g.rx * 1.001;
				c.y = g.cy + uy * g.ry * 1.001;
				const vn = c.vx * ux + (c.vy * uy) / 0.62 / 0.62 * 0.62;
				if (vn < 0) {
					c.vx -= vn * ux * 1.2;
					c.vy -= vn * uy * 1.2;
				}
			}
		}
		const speed = Math.hypot(c.vx, c.vy);
		c.phase += dt * (c.thrust ? 0.9 + speed / 90 : speed > 20 ? 0.35 : 0.15);
		if (c.phase > 1) c.phase -= 1;
		if (!sh.reduced && speed > 25 && Math.random() < dt * 11) wake.push({ x: c.x - c.face * 30, y: c.y - 2, age: 0 });
		for (const w of wake) w.age += dt;
		while (wake.length && wake[0].age > 1.6) wake.shift();
		for (const l of lilies) {
			if (!l.got && Math.hypot(l.x - c.x, (l.y - c.y) * 1.6) < 36) {
				l.got = true;
				got++;
				wake.push({ x: l.x, y: l.y, age: 0, big: true });
				if (!sh.reduced) for (let i = 0; i < 9; i++) petals.push({ x: l.x, y: l.y - 4, vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 60, life: 0.9 });
				if (got === lilies.length) sh.toast("Every lily gathered. The loons approve.", 2800);
				else sh.toast(`Water lily ${got}/${lilies.length}`, 900);
			}
		}
		for (const p of petals) {
			p.life -= dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vy += 160 * dt;
		}
		while (petals.length && petals[0].life <= 0) petals.shift();
	}

	const R = (ctx, x, y, w, h, color) => {
		ctx.fillStyle = color;
		ctx.fillRect(Math.round(x), Math.round(y), w, h);
	};

	function drawCanoe(ctx, flip) {
		// Draws at origin c.x,c.y (waterline). flip=-1 draws the reflection below.
		const bob = sh.reduced ? 0 : Math.round(Math.sin(c.t * 2.2));
		const f = c.face;
		const X = (dx, w) => Math.round(c.x + (f > 0 ? dx : -dx - w) * P);
		const Y = (dy, h) => Math.round(c.y + bob + (flip > 0 ? dy : -dy - h) * P);
		const rr = (dx, dy, w, h, color) => {
			ctx.fillStyle = color;
			ctx.fillRect(X(dx, w), Y(dy, h), w * P, h * P);
		};
		rr(-13, -5, 1, 2, col["hull-l"]);
		rr(12, -5, 1, 2, col["hull-l"]);
		rr(-12, -3, 24, 1, col["hull-l"]);
		rr(-12, -2, 24, 1, col.stripe);
		rr(-13, -1, 26, 1, col.hull);
		rr(-10, 0, 20, 1, col["hull-d"]);
		// paddle + hiker (hiker only drawn upright)
		const ph = c.phase;
		const stroke = ph < 0.5;
		const k = stroke ? ph / 0.5 : (ph - 0.5) / 0.5;
		const th = (stroke ? 0.8 - 1.4 * k : -0.6 + 1.4 * k) * (c.thrust || Math.hypot(c.vx, c.vy) > 20 ? 1 : 0.35) + (c.thrust ? 0 : 0.25);
		const hx = 3, hy = -10;
		const lift = stroke ? 0 : 5 * Math.sin(Math.PI * k);
		const len = 15;
		if (flip > 0) {
			const ox = Math.round(c.x + (f > 0 ? -6 : -6) * P), oy = Math.round(c.y + bob - 16 * P + 0 * P);
			drawHiker(ctx, ox, oy, P, f, { pose: "sit", armF: [8, 9], armB: [6, 10], blink: Math.floor(c.t * 1.3) % 5 === 0 && (c.t % 1) < 0.15, pomX: -Math.min(2, Math.round(Math.hypot(c.vx, c.vy) / 60)), mouth: false });
		}
		const steps = Math.round(len);
		for (let i = 0; i <= steps; i++) {
			const px = hx + Math.sin(th) * i, py = hy + Math.cos(th) * i - lift * (i / steps);
			const blade = i > steps - 4;
			ctx.fillStyle = blade ? "#d8402c" : col["hull-l"];
			const w = blade ? 2 : 1;
			ctx.fillRect(X(Math.round(px), w), Y(Math.round(py), 1), w * P, P);
		}
		// bow splash
		return;
	}

	function lily(ctx, x, y, ph) {
		const s = Math.round(Math.sin(ph) * 1);
		R(ctx, x - 9, y + s - 1, 18, 3, col.pad);
		R(ctx, x - 6, y + s - 3, 12, 3, col.pad);
		R(ctx, x - 3, y + s - 6, 6, P, col.lily);
		R(ctx, x - 6, y + s - 3, 3, P, col.lily);
		R(ctx, x + 3, y + s - 3, 3, P, col.lily);
		R(ctx, x - 3, y + s - 3, 6, P, col["lily-c"]);
	}

	return {
		step,
		draw(ctx) {
			const t = c.t;
			// wake rings
			ctx.lineWidth = 2;
			for (const w of wake) {
				const k = w.age / (w.big ? 1 : 1.6);
				ctx.strokeStyle = col.wake;
				ctx.globalAlpha = Math.max(0, 0.55 * (1 - k));
				ctx.beginPath();
				ctx.ellipse(Math.round(w.x), Math.round(w.y), (w.big ? 34 : 14) * (0.3 + k), (w.big ? 10 : 4) * (0.3 + k), 0, 0, 7);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
			for (const l of lilies) if (!l.got) lily(ctx, Math.round(l.x), Math.round(l.y), sh.reduced ? 0 : t * 1.5 + l.ph);
			// reflection
			ctx.globalAlpha = 0.22;
			drawCanoe(ctx, -1);
			ctx.globalAlpha = 1;
			drawCanoe(ctx, 1);
			// islands in front of the canoe hide it
			ctx.globalCompositeOperation = "destination-out";
			for (const g of geo) {
				if (g.cy <= c.y) continue;
				ctx.save();
				ctx.translate(g.cx, g.cy);
				ctx.fill(g.path);
				ctx.restore();
			}
			ctx.globalCompositeOperation = "source-over";
			for (const p of petals) {
				ctx.globalAlpha = Math.max(0, p.life);
				R(ctx, p.x, p.y, P, P, col.lily);
			}
			ctx.globalAlpha = 1;
		},
		hud: () => `Lilies ${got}/${lilies.length}`,
		resize: layout,
		destroy() {
			mo.disconnect();
		},
	};
}
