/*
 * A dark-sky star field for the side margins: hundreds of tiny dots of varied brightness,
 * mostly faint, a few brighter, with subtly different temperatures (blue-white, white, warm,
 * pale gold, faint orange). No flares, crosses, or big halos. Stars scintillate gently, and
 * the faintest ones come up a little as the cursor nears.
 *
 *   const stop = starrySky({ root, host, dark, reduced, seed, density, radius, constellation });
 *
 * Tuning: sizeScale and alphaScale shrink or dim every star; rest (0..1) is how visible stars
 * are until the cursor comes near; body: { density, alpha } lets a sparser, dimmer field continue
 * behind the content column instead of stopping (the blend is per-star, so there is no edge).
 */

const TEMPS = {
	dark: [
		[255, 255, 255],
		[214, 226, 255],
		[255, 245, 230],
		[255, 233, 200],
		[255, 214, 182],
	],
	light: [
		[72, 86, 120],
		[62, 92, 150],
		[104, 98, 92],
		[118, 102, 76],
		[128, 92, 82],
	],
};
const WEIGHTS = [0.4, 0.25, 0.2, 0.1, 0.05];

function mulberry(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const smooth = (a, b, v) => {
	const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

function pickTemp(r) {
	let u = r();
	for (let i = 0; i < WEIGHTS.length; i++) {
		if ((u -= WEIGHTS[i]) <= 0) return i;
	}
	return 0;
}

export function starrySky({
	root,
	host = root.querySelector(".scenery-c"),
	dark = document.documentElement.classList.contains("dark"),
	reduced = false,
	seed = 1,
	density = 1,
	maxY = 1,
	radius = 200,
	constellation = false,
	sizeScale = 1,
	alphaScale = 1,
	rest = 1,
	body = null,
} = {}) {
	if (!host) return () => {};
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	canvas.className = "sky-stars";
	canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block";
	host.append(canvas);
	const ctx = canvas.getContext("2d");
	const temps = TEMPS[dark ? "dark" : "light"];
	const page = root.querySelector(".site-page");

	let W = 0, H = 0, dpr = 1, ox = 0, oy = 0;
	let stars = [];
	let raf = 0, timer = 0, last = 0, alive = true;
	const P = { x: -1e4, y: -1e4, has: false };

	function build() {
		const r = host.getBoundingClientRect();
		W = r.width; H = r.height; ox = r.left; oy = r.top;
		dpr = Math.min(1.5, devicePixelRatio || 1);
		canvas.width = Math.max(1, Math.round(W * dpr));
		canvas.height = Math.max(1, Math.round(H * dpr));
		stars = [];
		// Margins come from the real content column so stars never sit behind text.
		const pr = page?.getBoundingClientRect();
		const colL = (pr ? pr.left - ox : W / 2 - 416) + 8;
		const colR = (pr ? pr.right - ox : W / 2 + 416) - 8;
		const rnd = mulberry(seed * 7919 + 17);
		const span = body ? [[0, W]] : [[0, colL], [colR, W]].filter(([a, b]) => b - a > 40);
		const bodyDensity = body?.density ?? 0, bodyAlpha = body?.alpha ?? 0;
		for (const [a, b] of span) {
			const n = Math.round(((b - a) * H * maxY) / 650 * density);
			for (let i = 0; i < n; i++) {
				const x = a + rnd() * (b - a);
				const mg = x < colL ? smooth(0, 70, colL - x) : x > colR ? smooth(0, 70, x - colR) : 0;
				const keep = body ? bodyDensity + (1 - bodyDensity) * mg : mg;
				if (rnd() > keep) continue;
				const m = Math.pow(rnd(), 2.6); // most stars are faint
				const dim = body ? bodyAlpha + (1 - bodyAlpha) * mg : 1;
				stars.push({
					x,
					y: rnd() * H * maxY,
					m,
					r: (0.35 + m * 1.0) * sizeScale,
					a: (dark ? 0.1 + m * 0.72 : 0.05 + m * 0.26) * alphaScale * dim,
					t: pickTemp(rnd),
					ph: rnd() * 6.283,
					f: 0.6 + rnd() * 1.6,
					amp: 0.05 + rnd() * 0.12 + m * 0.08,
					k: 0,
				});
			}
		}
		draw(performance.now() / 1000);
	}

	function draw(t) {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		const lit = constellation ? [] : null;
		for (const s of stars) {
			const tw = reduced ? 1 : 1 + s.amp * Math.sin(t * s.f + s.ph);
			// faint stars gain the most when the cursor nears; bright ones barely change
			const boost = rest + (1 - rest) * s.k + s.k * (1.8 - s.m * 1.4);
			const a = Math.min(0.95 * alphaScale, s.a * tw * boost);
			const c = temps[s.t];
			if (s.m > 0.82) {
				// the brightest few get a whisper of bloom, nothing more
				ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a * 0.1})`;
				ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.6, 0, 6.283); ctx.fill();
			}
			ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
			ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (1 + s.k * 0.15), 0, 6.283); ctx.fill();
			if (lit && s.k > 0.35 && s.m > 0.25) lit.push(s);
		}
		if (lit && lit.length > 1) {
			ctx.lineWidth = 0.6;
			for (const s of lit) {
				let best = null, bd = 95;
				for (const o of lit) {
					if (o === s) continue;
					const dd = Math.hypot(o.x - s.x, o.y - s.y);
					if (dd < bd) { bd = dd; best = o; }
				}
				if (best && best.y > s.y) continue; // draw each link once, roughly
				if (best) {
					const a = Math.min(s.k, best.k) * (dark ? 0.16 : 0.12);
					ctx.strokeStyle = dark ? `rgba(200,215,255,${a})` : `rgba(70,90,140,${a})`;
					ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(best.x, best.y); ctx.stroke();
				}
			}
		}
	}

	function step(dt) {
		let busy = false;
		for (const s of stars) {
			let target = 0;
			if (P.has) {
				const d = Math.hypot(s.x - P.x, s.y - P.y);
				if (d < radius) target = smooth(0, 1, 1 - d / radius);
			}
			s.k += (target - s.k) * (1 - Math.exp(-dt * (target > s.k ? 4 : 0.9)));
			if (Math.abs(target - s.k) > 0.004) busy = true;
			else s.k = target;
		}
		return busy;
	}

	function frame(now) {
		raf = 0;
		if (!alive || document.hidden) return;
		const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
		last = now;
		const busy = step(dt);
		draw(now / 1000);
		if (busy) raf = requestAnimationFrame(frame);
		else last = 0;
	}
	const wake = () => {
		if (!raf && alive && !document.hidden && stars.length) raf = requestAnimationFrame(frame);
	};
	const onMove = (e) => { P.x = e.clientX - ox; P.y = e.clientY - oy; P.has = true; wake(); };
	const onLeave = () => { P.has = false; wake(); };
	addEventListener("pointermove", onMove, { passive: true });
	document.documentElement.addEventListener("pointerleave", onLeave);
	// gentle scintillation on a slow tick while nothing else is animating
	if (!reduced) timer = setInterval(() => { if (!raf && !document.hidden && stars.length) draw(performance.now() / 1000); }, 125);
	const ro = new ResizeObserver(build);
	ro.observe(host);
	build();

	return () => {
		alive = false;
		clearInterval(timer);
		cancelAnimationFrame(raf);
		ro.disconnect();
		removeEventListener("pointermove", onMove);
		document.documentElement.removeEventListener("pointerleave", onLeave);
		canvas.remove();
	};
}
