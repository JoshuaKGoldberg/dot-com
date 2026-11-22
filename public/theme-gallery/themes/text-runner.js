// 100. Text Runner: the hiker runs on the real text line boxes (Range.getClientRects) and collects
// the squiggle underlines from links. Opt-in; nothing runs until Play.
import { buildScene, ambientBirds } from "./ridge-runner/scenery.js";
import { Hiker } from "./ridge-runner/hiker.js";
import { createPlayShell, createCam, textLineRects, readColors, docRect, PLATFORMER_TOUCH } from "./ridge-runner/shell.js";

export function activate({ root, mode, reducedMotion }) {
	const scene = buildScene(root, { seed: 100, lakeTop: 0.74 });
	const birds = ambientBirds(scene, { mode, reduced: reducedMotion, seed: 100 });
	const got = new Set();
	const shell = createPlayShell({
		root,
		reducedMotion,
		label: "Run on text",
		hint: "← → / A D run   Space / ↑ jump   ↓ drop   Esc exit",
		touch: PLATFORMER_TOUCH,
		start: (sh) => startGame(sh, got),
		onExit: () => {
			root.querySelectorAll(".tr-got").forEach((n) => n.classList.remove("tr-got"));
			got.clear();
		},
	});
	return () => {
		birds.stop();
		shell.destroy();
	};
}

function startGame(sh, got) {
	const { root } = sh;
	const P = 2;
	const cam = createCam(root, sh.reduced);
	const hiker = new Hiker({ P, reduced: sh.reduced });
	hiker.setJumpHeight(50 * P);
	hiker.RUN = 112 * P;
	const names = ["sq", "sq-d"];
	let col = readColors(root, names);
	const mo = new MutationObserver(() => (col = readColors(root, names)));
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	let platforms = [], pickups = [], world, docH = 0;

	function build() {
		const W = root.clientWidth;
		docH = root.scrollHeight;
		const scope = root.querySelector(".site-page");
		platforms = textLineRects(root, scope).map((l) => ({ x: l.x, y: Math.round(l.y + l.h * 0.2), w: l.w, oneWay: true, el: l.el }));
		const links = [...root.querySelectorAll(".site-link")];
		pickups = links.map((a, i) => {
			const r = textLineRects(root, a)[0];
			const old = pickups.find((p) => p.a === a);
			return { a, x: r ? r.x + r.w / 2 : 0, y: r ? r.y + r.h * 0.2 - 15 : 0, got: old?.got || got.has(a), i };
		}).filter((p) => p.x);
		world = { platforms, solids: [], bounds: { left: 0, right: W, floor: docH - 10 } };
	}
	build();

	const target = root.scrollTop + root.clientHeight * 0.4;
	let best = platforms[0];
	for (const p of platforms) if (Math.abs(p.y - target) < Math.abs(best.y - target)) best = p;
	hiker.x = best.x + best.w / 2 - hiker.w / 2;
	hiker.y = best.y - hiker.h - 2;
	hiker.wave = 1.4;
	const ro = new ResizeObserver(build);
	ro.observe(root.querySelector(".site-page"));

	const flies = [];
	let t = 0;

	function step(dt, inp) {
		t += dt;
		hiker.update(dt, inp, world);
		for (const p of pickups) {
			if (p.got) continue;
			if (hiker.x < p.x + 14 && hiker.x + hiker.w > p.x - 14 && hiker.y < p.y + 14 && hiker.y + hiker.h > p.y - 6) {
				p.got = true;
				got.add(p.a);
				p.a.classList.add("tr-got");
				flies.push({ x: p.x, y: p.y, life: 0.5 });
				if (pickups.every((q) => q.got)) sh.toast("Every squiggle collected. Nicely lint-free.", 2600);
			}
		}
		for (const f of flies) f.life -= dt;
		while (flies.length && flies[0].life <= 0) flies.shift();
	}

	function squiggle(ctx, x, y, c, phase) {
		const pts = [0, -1, -1, 0, 1, 1, 0, -1];
		for (let i = 0; i < 8; i++) {
			ctx.fillStyle = i === 0 || i === 7 ? col["sq-d"] : c;
			ctx.fillRect(Math.round(x + (i - 4) * 2), Math.round(y + pts[(i + phase) % 8] * 2), 2, 2);
		}
	}

	return {
		step,
		draw(ctx, dt) {
			cam.follow(hiker.y + hiker.h / 2, sh.h, dt);
			const sy = Math.round(root.scrollTop);
			for (const p of pickups) {
				if (p.got) continue;
				const y = p.y - sy;
				if (y < -20 || y > sh.h + 20) continue;
				squiggle(ctx, p.x, y + Math.sin(t * 3 + p.i) * 2, col.sq, sh.reduced ? 0 : Math.floor(t * 8) % 8);
			}
			for (const f of flies) {
				const k = 1 - f.life / 0.5;
				ctx.globalAlpha = 1 - k;
				squiggle(ctx, f.x, f.y - sy - k * 30, col.sq, 0);
				ctx.globalAlpha = 1;
			}
			hiker.draw(ctx, 0, sy);
		},
		hud: () => `Squiggles ${pickups.filter((p) => p.got).length}/${pickups.length}`,
		resize: build,
		destroy() {
			ro.disconnect();
			mo.disconnect();
			cam.destroy();
		},
	};
}
