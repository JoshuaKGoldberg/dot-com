// 99. Ridge Runner: page headings are platforms. Opt-in; costs nothing until you press Play.
import { buildScene, ambientBirds } from "./ridge-runner/scenery.js";
import { Hiker } from "./ridge-runner/hiker.js";
import { createPlayShell, createCam, textLineRects, readColors, PLATFORMER_TOUCH } from "./ridge-runner/shell.js";
import { rng } from "./two-skies-one-shore/lib.js";

export function activate({ root, mode, reducedMotion }) {
	const scene = buildScene(root, { seed: 99, lakeTop: 0.72 });
	const birds = ambientBirds(scene, { mode, reduced: reducedMotion, seed: 99 });
	const shell = createPlayShell({
		root,
		reducedMotion,
		label: "Play",
		hint: "← → / A D run   Space / ↑ jump   ↓ drop   Esc exit",
		touch: PLATFORMER_TOUCH,
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
	const cam = createCam(root, sh.reduced);
	const hiker = new Hiker({ P, reduced: sh.reduced });
	const colors = () => readColors(root, ["log", "logl", "logd", "logr", "moss", "mossd", "flag", "grass"]);
	let col = colors();
	const mo = new MutationObserver(() => (col = colors()));
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	let platforms = [], ledges = [], heads = [], world = null, docH = 0;
	const visited = new Set();

	function build() {
		const W = root.clientWidth;
		docH = root.scrollHeight;
		platforms = [];
		ledges = [];
		heads = [];
		const rr = rng(99);
		const els = [...root.querySelectorAll(".site-title, .site-section-title")];
		for (const el of els) {
			const lines = textLineRects(root, el);
			for (const l of lines) {
				const p = { x: l.x - 4, y: Math.round(l.y + l.h * 0.15), w: l.w + 8, oneWay: true, kind: "head", el, seed: rr() };
				heads.push(p);
				platforms.push(p);
			}
		}
		// Smaller waypoints: item titles and the portrait.
		for (const el of root.querySelectorAll(".site-item-title")) {
			for (const l of textLineRects(root, el)) platforms.push({ x: l.x - 2, y: Math.round(l.y + l.h * 0.15), w: l.w + 4, oneWay: true, kind: "item", seed: rr() });
		}
		const portrait = root.querySelector(".site-portrait img:not([style*='none'])");
		// Ladders of mossy logs up both margins, from the forest floor to the top of the page.
		const floor = docH - 18;
		const colX = root.querySelector(".site-page");
		const pr = colX.getBoundingClientRect();
		const rrt = root.getBoundingClientRect();
		const left = pr.left - rrt.left, right = pr.right - rrt.left;
		const lm = Math.max(120, left), rm = Math.max(120, W - right);
		for (const side of [0, 1]) {
			let y = floor - 70;
			let k = 0;
			while (y > 40) {
				const w = 70 + rr() * 44;
				const zig = k % 2 ? 0.58 : 0.1;
				const x = side === 0 ? Math.min(lm - w - 6, lm * zig + 12 + rr() * 16) : W - Math.min(rm - 6, rm * zig + 12 + rr() * 16) - w;
				const l = { x: Math.max(4, Math.min(W - w - 4, x)), y: Math.round(y), w, oneWay: true, kind: "log", seed: rr() };
				ledges.push(l);
				platforms.push(l);
				y -= 78 + rr() * 8;
				k++;
			}
		}
		void portrait;
		world = { platforms, solids: [], bounds: { left: 0, right: W, floor } };
	}
	build();

	// Spawn near the middle of the visible page.
	const view = root.clientHeight;
	const target = root.scrollTop + view * 0.45;
	let best = platforms[0];
	for (const p of platforms) if (Math.abs(p.y - target) < Math.abs(best.y - target) && p.kind !== "log") best = p;
	hiker.x = best.x + best.w / 2 - hiker.w / 2;
	hiker.y = best.y - hiker.h - 2;
	hiker.wave = 1.6;
	hiker.onEvent = (e) => {
		if (e === "land" && hiker.plat?.kind === "head" && !visited.has(hiker.plat.el)) {
			visited.add(hiker.plat.el);
			const total = new Set(heads.map((h) => h.el)).size;
			hiker.wave = 1.2;
			sh.toast(visited.size === total ? "Every peak bagged. Hi!" : "Summit!", 1600);
		}
	};
	const ro = new ResizeObserver(() => build());
	ro.observe(root.querySelector(".site-page"));

	function step(dt, inp) {
		hiker.update(dt, inp, world);
		// Landing counts even when you just walk onto a heading.
		const p = hiker.plat;
		if (p && p.kind === "head" && hiker.grounded && !visited.has(p.el)) hiker.onEvent("land");
	}

	const rect = (ctx, x, y, w, h, c) => {
		ctx.fillStyle = c;
		ctx.fillRect(Math.round(x), Math.round(y), w, h);
	};

	function drawLog(ctx, p, sy, vh) {
		const y0 = Math.round(p.y - sy);
		if (y0 < -20 || y0 > vh + 20) return;
		const x0 = Math.round(p.x), w = Math.round(p.w / P) * P;
		rect(ctx, x0, y0, w, P, col.moss);
		rect(ctx, x0, y0 + P, w, P * 2, col.log);
		rect(ctx, x0 + P, y0 + P, w - 2 * P, P, col.logl);
		rect(ctx, x0, y0 + P * 3, w, P, col.logd);
		rect(ctx, x0 - P, y0 + P, P, P * 3, col.logr);
		rect(ctx, x0 - P, y0 + P * 2, P, P, col.logd);
		for (let i = 0; i < 4; i++) {
			const t = Math.floor(((p.seed * 997 + i * 31) % 1) * (w / P - 2)) * P + P;
			rect(ctx, x0 + t, y0 - P, P, P, col.moss);
			if (i % 2) rect(ctx, x0 + t + P, y0 - P * 1, P, P, col.mossd);
			rect(ctx, x0 + t, y0 + P * 4, P, P * (1 + (i % 2)), col.logd);
		}
	}

	function drawHead(ctx, p, sy, vh) {
		const y0 = Math.round(p.y - sy);
		if (y0 < -30 || y0 > vh + 30) return;
		const x0 = Math.round(p.x), w = Math.round(p.w / P) * P;
		rect(ctx, x0, y0 - P * 2, w, P, col.moss);
		rect(ctx, x0, y0 - P, w, P, col.mossd);
		for (let x = P; x < w - P; x += P * 3) {
			const h = ((Math.sin(x * 12.9898 + p.seed * 78.2) * 43758.5453) % 1 + 1) % 1 > 0.5 ? P : 0;
			if (h) rect(ctx, x0 + x, y0 - P * 3, P, P, col.moss);
		}
		if (visited.has(p.el) && p === heads.find((h) => h.el === p.el)) {
			const fx = x0 + w - P * 2;
			rect(ctx, fx, y0 - P * 7, P, P * 7, col.logd);
			rect(ctx, fx + P, y0 - P * 7, P * 3, P, col.flag);
			rect(ctx, fx + P, y0 - P * 6, P * 3, P, col.flag);
			rect(ctx, fx + P, y0 - P * 5, P * 2, P, col.flag);
		}
	}

	function drawGround(ctx, sy, vw, vh) {
		const y = Math.round(docH - 18 - sy);
		if (y > vh) return;
		rect(ctx, 0, y, vw, P, col.moss);
		rect(ctx, 0, y + P, vw, vh - y, col.mossd);
		for (let x = 0; x < vw; x += P * 4) rect(ctx, x, y - P * ((x / P) % 3 === 0 ? 1 : 0), P, P, col.moss);
	}

	return {
		step,
		draw(ctx, dt) {
			const vh = sh.h, vw = sh.w;
			cam.follow(hiker.y + hiker.h / 2, vh, dt);
			const sy = Math.round(root.scrollTop);
			drawGround(ctx, sy, vw, vh);
			for (const p of ledges) drawLog(ctx, p, sy, vh);
			for (const p of heads) drawHead(ctx, p, sy, vh);
			hiker.draw(ctx, 0, sy);
		},
		hud: () => `Summits ${visited.size}/${new Set(heads.map((h) => h.el)).size}`,
		resize: build,
		destroy() {
			ro.disconnect();
			mo.disconnect();
			cam.destroy();
		},
	};
}
