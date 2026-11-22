// 103. Tower Climb: scale cliff ledges, then a fire tower, to the summit where the view opens up.
import { buildScene, ambientBirds } from "./ridge-runner/scenery.js";
import { Hiker } from "./ridge-runner/hiker.js";
import { createPlayShell, createCam, readColors, PLATFORMER_TOUCH } from "./ridge-runner/shell.js";
import { rng } from "./two-skies-one-shore/lib.js";

export function activate({ root, mode, reducedMotion }) {
	const scene = buildScene(root, { seed: 103, lakeTop: 0.74 });
	const birds = ambientBirds(scene, { mode, reduced: reducedMotion, seed: 103 });
	const shell = createPlayShell({
		root,
		reducedMotion,
		label: "Climb",
		hint: "← → / A D move   Space / ↑ jump   ↓ drop   Esc exit",
		touch: PLATFORMER_TOUCH,
		start: (sh) => startGame(sh, birds),
		onExit: () => root.classList.remove("tc-summit"),
	});
	return () => {
		birds.stop();
		shell.destroy();
	};
}

function startGame(sh, birds) {
	const { root } = sh;
	const P = 3;
	const cam = createCam(root, sh.reduced);
	const hiker = new Hiker({ P, reduced: sh.reduced });
	const names = ["rock", "rock-l", "rock-d", "moss", "wood", "wood-d", "steel", "roof", "glass", "siteAccent"];
	let col = readColors(root, names);
	const mo = new MutationObserver(() => (col = readColors(root, names)));
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	let L = null, world = null, summit = false, bubble = 0, t = 0, maxH = 0;

	function build() {
		const W = root.clientWidth, docH = root.scrollHeight;
		const rr = rng(103);
		const page = root.querySelector(".site-page").getBoundingClientRect();
		const left = page.left - root.getBoundingClientRect().left;
		const lm = Math.max(190, Math.min(left, 420));
		const floor = docH - 18;
		const story = 78;
		const towerTop = 230;
		const stories = Math.max(5, Math.min(10, Math.round((floor - towerTop) * 0.3 / story)));
		const plateauY = towerTop + stories * story;
		const tcx = Math.round(lm * 0.52);
		const platforms = [];
		const decks = [];
		for (let i = 1; i <= stories; i++) {
			const y = plateauY - i * story;
			const d = { x: tcx - 52, y, w: 104, oneWay: true, kind: "deck", i };
			decks.push(d);
			platforms.push(d);
		}
		const cab = decks[decks.length - 1];
		cab.kind = "cab";
		platforms.push({ x: 4, y: plateauY, w: lm - 4, oneWay: true, kind: "plateau" });
		const ledges = [];
		let y = plateauY + 78, k = 0;
		while (y < floor - 40) {
			const w = 74 + rr() * 40;
			const x = k % 2 ? lm * 0.5 - w * 0.2 + rr() * 16 : 10 + rr() * 22;
			const l = { x: Math.min(x, lm - w - 4), y: Math.round(y), w, oneWay: true, kind: "ledge", seed: rr() };
			ledges.push(l);
			platforms.push(l);
			y += 78 + rr() * 8;
			k++;
		}
		const face = [];
		for (let yy = plateauY; yy < docH + 10; yy += 6) face.push(lm * 0.82 + Math.sin(yy * 0.021) * 14 + Math.sin(yy * 0.07 + 2) * 7 + (rr() - 0.5) * 6);
		L = { W, docH, lm, floor, tcx, stories, plateauY, towerTop, story, decks, cab, ledges, face, platforms };
		world = { platforms, solids: [], bounds: { left: 0, right: W, floor } };
	}
	build();

	hiker.x = Math.min(L.W - 60, L.lm + 40);
	hiker.y = L.floor - hiker.h - 2;
	hiker.wave = 1.6;
	cam.scrollTo(L.docH);
	hiker.onEvent = () => {};
	sh.toast("Climb the cliff, then the fire tower. Hi is waiting at the top.", 3200);
	const ro = new ResizeObserver(build);
	ro.observe(root.querySelector(".site-page"));

	function step(dt, inp) {
		t += dt;
		hiker.update(dt, inp, world);
		maxH = Math.max(maxH, L.floor - hiker.y);
		if (!summit && hiker.grounded && hiker.plat === L.cab) {
			summit = true;
			bubble = 5;
			hiker.wave = 4;
			root.classList.add("tc-summit");
			birds.flock.scatter();
			sh.toast("Summit. The whole lake says hi.", 3200);
		}
		bubble = Math.max(0, bubble - dt);
	}

	const R = (ctx, x, y, w, h, c) => {
		ctx.fillStyle = c;
		ctx.fillRect(Math.round(x), Math.round(y), w, h);
	};
	const line = (ctx, x0, y0, x1, y1, c, th = P) => {
		const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / P;
		for (let i = 0; i <= n; i++) {
			const k = n ? i / n : 0;
			R(ctx, Math.round((x0 + (x1 - x0) * k) / P) * P, Math.round((y0 + (y1 - y0) * k) / P) * P, th, th, c);
		}
	};

	function drawCliff(ctx, sy, vh) {
		const { lm, plateauY, face } = L;
		const i0 = Math.max(0, Math.floor((sy - plateauY) / 6)), i1 = Math.min(face.length - 1, Math.ceil((sy + vh - plateauY) / 6));
		for (let i = i0; i <= i1; i++) {
			const y = plateauY + i * 6 - sy;
			const e = Math.round(face[i] / P) * P;
			const band = Math.floor((i + 3) / 7) % 3;
			R(ctx, 0, y, e, 6, band === 0 ? col["rock-d"] : col.rock);
			if (i % 7 === 0) R(ctx, 0, y, e, 2, col["rock-l"]);
			R(ctx, e - P * 2, y, P * 2, 6, col["rock-d"]);
			if ((i * 37) % 11 === 0) R(ctx, e - P * 5, y, P * 2, P, col.moss);
		}
		R(ctx, 0, plateauY - sy, Math.round(lm * 0.92 / P) * P, P, col.moss);
		R(ctx, 0, plateauY - sy + P, Math.round(lm * 0.92 / P) * P, P, col["rock-l"]);
		for (const l of L.ledges) {
			const y = Math.round(l.y - sy);
			if (y < -20 || y > vh + 20) continue;
			const w = Math.round(l.w / P) * P;
			R(ctx, l.x, y, w, P, col.moss);
			R(ctx, l.x, y + P, w, P * 2, col["rock-l"]);
			R(ctx, l.x + P, y + P * 3, w - P * 2, P, col["rock-d"]);
			R(ctx, l.x + P * 2, y + P * 4, w - P * 5, P, col["rock-d"]);
			R(ctx, l.x + P, y + P, P * 2, P, col.rock);
		}
	}

	function drawTower(ctx, sy, vh) {
		const { tcx, plateauY, towerTop, story, decks, stories } = L;
		const wAt = (y) => 100 - 34 * ((plateauY - y) / (plateauY - towerTop));
		const yTop = towerTop - 70 - sy, yBot = plateauY - sy;
		if (yTop > vh || yBot < -10) return;
		// legs + braces
		for (let i = 0; i < stories; i++) {
			const y0 = plateauY - i * story - sy, y1 = y0 - story;
			if (y1 > vh + 20 || y0 < -20) continue;
			const w0 = wAt(y0 + sy) / 2, w1 = wAt(y1 + sy) / 2;
			line(ctx, tcx - w0, y0, tcx - w1, y1, col.wood);
			line(ctx, tcx + w0, y0, tcx + w1, y1, col.wood);
			line(ctx, tcx - w0, y0, tcx + w1, y1, col.steel, 3);
			line(ctx, tcx + w0, y0, tcx - w1, y1, col.steel, 3);
			// stairs
			for (let s = 1; s < 6; s++) R(ctx, tcx - w0 + 6 + (s * (w0 * 2 - 12)) / 6 * (i % 2 ? -1 : 1) + (i % 2 ? w0 * 2 - 12 : 0), y0 - (s * story) / 6, P * 3, P, col["wood-d"]);
		}
		for (const d of decks) {
			const y = Math.round(d.y - sy);
			if (y < -20 || y > vh + 20) continue;
			const hw = Math.round(wAt(d.y) / 2) + 8;
			R(ctx, tcx - hw, y, hw * 2, P, col.wood);
			R(ctx, tcx - hw, y + P, hw * 2, P, col["wood-d"]);
			if (d !== L.cab) {
				R(ctx, tcx - hw, y - P * 4, P, P * 4, col["wood-d"]);
				R(ctx, tcx + hw - P, y - P * 4, P, P * 4, col["wood-d"]);
				R(ctx, tcx - hw, y - P * 4, hw * 2, P, col.wood);
			}
		}
		// cab
		const c = L.cab, cy = Math.round(c.y - sy);
		if (cy > -120 && cy < vh + 80) {
			const hw = 66;
			R(ctx, tcx - hw, cy - P * 14, hw * 2, P * 14, col.wood);
			R(ctx, tcx - hw, cy - P * 14, hw * 2, P, col["wood-d"]);
			for (const dx of [-48, -12, 24]) {
				R(ctx, tcx + dx, cy - P * 11, P * 8, P * 6, col["wood-d"]);
				R(ctx, tcx + dx + P, cy - P * 10, P * 6, P * 4, col.glass);
				R(ctx, tcx + dx + P * 3, cy - P * 10, P, P * 4, col["wood-d"]);
			}
			for (let i = 0; i < 9; i++) R(ctx, tcx - hw - P * 3 + i * P * 2, cy - P * 14 - i * P, hw * 2 + P * 6 - i * P * 4, P, col.roof);
			R(ctx, tcx - 2, cy - P * 25, P, P * 11, col.steel);
			R(ctx, tcx + 1, cy - P * 25, P * 4, P * 2, col.roof);
		}
	}

	function drawBubble(ctx, sy) {
		if (bubble <= 0) return;
		const x = Math.round(hiker.x + hiker.w / 2), y = Math.round(hiker.y - sy - 18);
		const msg = "Hi! I'm Josh.";
		ctx.font = "700 15px 'League Spartan', system-ui, sans-serif";
		const w = Math.ceil(ctx.measureText(msg).width) + 18;
		ctx.globalAlpha = Math.min(1, bubble);
		R(ctx, x - w / 2 - 2, y - 26, w + 4, 28, "#1a2447");
		R(ctx, x - w / 2, y - 24, w, 24, "#fffdf6");
		R(ctx, x - 4, y, 8, 4, "#1a2447");
		R(ctx, x - 2, y - 2, 4, 4, "#fffdf6");
		ctx.fillStyle = "#1a2447";
		ctx.textBaseline = "middle";
		ctx.fillText(msg, x - w / 2 + 9, y - 11);
		ctx.globalAlpha = 1;
	}

	return {
		step,
		draw(ctx, dt) {
			cam.follow(hiker.y + hiker.h / 2, sh.h, dt, 0.18, 0.55);
			const sy = Math.round(root.scrollTop);
			// forest floor
			const fy = Math.round(L.floor - sy);
			if (fy < sh.h) {
				R(ctx, 0, fy, sh.w, P, col.moss);
				R(ctx, 0, fy + P, sh.w, sh.h, col["rock-d"]);
			}
			drawCliff(ctx, sy, sh.h);
			drawTower(ctx, sy, sh.h);
			hiker.draw(ctx, 0, sy);
			drawBubble(ctx, sy);
		},
		hud: () => (summit ? "Summit reached" : `Climb ${Math.min(99, Math.round((maxH / (L.floor - L.cab.y)) * 100))}%`),
		resize: build,
		destroy() {
			ro.disconnect();
			mo.disconnect();
			cam.destroy();
		},
	};
}
