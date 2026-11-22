/*
 * Drift seeds: a few tiny dandelion seeds resting in the margins. The cursor's wake blows them
 * (velocity-driven), they tumble, spring back to their perch with a soft overshoot, and the loop sleeps.
 * Fixed 120 Hz step. Margins only; reduced motion keeps them still until the pointer disturbs them.
 */
import { clamp, isDark, rng } from "./kit.js";

const DT = 1 / 120;

function seedSprite(dark) {
	const S = 3, W = 28, H = 40, c = document.createElement("canvas");
	c.width = W * S; c.height = H * S;
	const g = c.getContext("2d");
	g.scale(S, S); g.translate(W / 2, 12);
	const col = dark ? "226,236,255" : "88,106,150";
	// pappus: a fan of filaments with soft tips; origin at the tuft, stem hangs below
	g.lineCap = "round";
	for (let i = 0; i < 11; i++) {
		const t = (i / 10 - 0.5) * 2.5, len = 10.5 - Math.abs(t) * 1.4;
		const ex = Math.sin(t) * len, ey = -Math.cos(t) * len;
		g.strokeStyle = `rgba(${col},${0.5 + 0.2 * (1 - Math.abs(t) / 1.25)})`;
		g.lineWidth = 0.5;
		g.beginPath(); g.moveTo(0, 0); g.lineTo(ex, ey); g.stroke();
		g.fillStyle = `rgba(${col},0.9)`;
		g.beginPath(); g.arc(ex, ey, 0.7, 0, 6.3); g.fill();
	}
	// stem and seed
	g.strokeStyle = `rgba(${col},0.85)`; g.lineWidth = 0.7;
	g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 13); g.stroke();
	g.fillStyle = `rgba(${col},1)`;
	g.beginPath(); g.ellipse(0, 14.5, 1.1, 2.1, 0, 0, 6.3); g.fill();
	// soft halo
	const h = g.createRadialGradient(0, -4, 0, 0, -4, 12);
	h.addColorStop(0, `rgba(${col},${dark ? 0.16 : 0.1})`); h.addColorStop(1, `rgba(${col},0)`);
	g.fillStyle = h; g.fillRect(-14, -16, 28, 28);
	return c;
}

export function driftSeeds(root, d, { seed = 360, reducedMotion, count = 4, host = root.querySelector(".overlay-b") } = {}) {
	if (!host) return null;
	const dark = isDark();
	const cvs = document.createElement("canvas");
	cvs.className = "dl-seeds";
	cvs.setAttribute("aria-hidden", "true");
	cvs.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;display:block";
	host.append(cvs);
	const ctx = cvs.getContext("2d");
	const sprite = seedSprite(dark);
	const half = 26 * 16 + 28;
	let W = 0, H = 0, dpr = 1, seeds = [], raf = 0, alive = true, last = 0, acc = 0, still = 0, asleep = true, ox = 0, oy = 0;
	const P = { x: 0, y: 0, vx: 0, vy: 0, t: 0, has: false };

	const build = () => {
		const r = cvs.getBoundingClientRect();
		W = r.width; H = r.height; ox = r.left; oy = r.top;
		dpr = Math.min(1.5, devicePixelRatio || 1);
		cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
		seeds = [];
		const side = (W - half * 2) / 2;
		if (side >= 70) {
			const rnd = rng(seed);
			for (let i = 0; i < count * 2; i++) {
				const left = i % 2 === 0, row = Math.floor(i / 2);
				const x = left ? 40 + rnd() * (side - 80) : W - 40 - rnd() * (side - 80);
				const y = H * (0.2 + (row + rnd() * 0.6) * (0.68 / count));
				const rest = (rnd() - 0.5) * 0.5;
				seeds.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, a: rest, av: 0, rest, s: 0.85 + rnd() * 0.35, k: 0, al: 0.5 + rnd() * 0.15 });
			}
		}
		paint();
	};

	function stepOnce() {
		let energy = 0;
		for (const s of seeds) {
			// perch spring: soft, underdamped (about one overshoot)
			const ax = (s.hx - s.x) * 5.5 - s.vx * 1.9;
			const ay = (s.hy - s.y) * 5.5 - s.vy * 1.9 + 9; // a whisper of weight so they hang a little low
			s.vx += ax * DT; s.vy += ay * DT;
			s.x += s.vx * DT; s.y += s.vy * DT;
			// tumble: the seed hangs from its tuft, so its axis trails the motion
			const sp = Math.hypot(s.vx, s.vy);
			const tgt = sp > 14 ? Math.atan2(s.vx, -s.vy) * 0.55 * clamp(sp / 140, 0.2, 1) : s.rest;
			const aa = (tgt - s.a) * 14 - s.av * 3.2;
			s.av += aa * DT; s.a += s.av * DT;
			s.k += (clamp(sp / 260) - s.k) * 0.04;
			energy = Math.max(energy, sp + Math.hypot(s.hx - s.x, s.hy - s.y) * 3 + Math.abs(s.av) * 8 + Math.abs(s.a - s.rest) * 4);
		}
		still = energy < 1.2 ? still + DT : 0;
		if (still > 0.5) {
			asleep = true;
			for (const s of seeds) { s.x = s.hx; s.y = s.hy; s.vx = s.vy = s.av = 0; s.a = s.rest; s.k = 0; }
		}
	}
	function paint() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		for (const s of seeds) {
			ctx.save();
			ctx.translate(s.x, s.y); ctx.rotate(s.a); ctx.scale(s.s * 0.8, s.s * 0.8);
			ctx.globalAlpha = clamp(s.al * (dark ? 0.55 : 0.75) + s.k * 0.4);
			ctx.drawImage(sprite, -14, -12, 28, 40);
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	}
	function frame(now) {
		raf = 0;
		if (!alive || document.hidden) { last = 0; return; }
		acc += Math.min(0.05, last ? (now - last) / 1000 : DT);
		last = now;
		while (acc >= DT) { if (!asleep) stepOnce(); acc -= DT; }
		paint();
		if (!asleep) raf = requestAnimationFrame(frame); else last = 0;
	}
	const wake = () => { asleep = false; still = 0; if (!raf && alive && !document.hidden) raf = requestAnimationFrame(frame); };
	const onMove = (e) => {
		const now = performance.now(), dtm = Math.max(8, now - P.t) / 1000;
		const x = e.clientX - ox, y = e.clientY - oy;
		if (P.has && now - P.t < 120) { P.vx = (x - P.x) / dtm; P.vy = (y - P.y) / dtm; } else { P.vx = P.vy = 0; }
		P.x = x; P.y = y; P.t = now; P.has = true;
		const sp = Math.hypot(P.vx, P.vy);
		if (sp < 80) return;
		let hit = false;
		for (const s of seeds) {
			const dx = s.x - x, dy = s.y - y, dd = Math.hypot(dx, dy);
			if (dd > 150) continue;
			const f = (1 - dd / 150) ** 2;
			// the wake carries them along; a little sideways push away from the cursor path
			const k = clamp(sp / 1800) * f * 190;
			s.vx += (P.vx / sp) * k + (dx / (dd || 1)) * k * 0.25;
			s.vy += (P.vy / sp) * k * 0.8 + (dy / (dd || 1)) * k * 0.25 - k * 0.12;
			hit = true;
		}
		if (hit) wake();
	};
	addEventListener("pointermove", onMove, { passive: true });
	const ro = new ResizeObserver(build);
	ro.observe(cvs);
	const onVis = () => { if (!document.hidden && !asleep) { last = 0; wake(); } };
	document.addEventListener("visibilitychange", onVis);
	build();
	d.add(() => {
		alive = false; cancelAnimationFrame(raf); ro.disconnect();
		removeEventListener("pointermove", onMove);
		document.removeEventListener("visibilitychange", onVis);
		cvs.remove();
	});
	return cvs;
}
