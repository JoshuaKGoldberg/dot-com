/*
 * Squiggle delights. While a link is hovered its mask underline is swapped (crossfade) for a
 * small canvas that draws the same squiggle with a mode-specific effect, then removed again:
 *   pluck    - damped spring string; the cursor can hold it and let go, strum it along the text,
 *              and the hue follows the cursor and the vibration energy
 *   rainbow  - a rainbow front travels out from the cursor and then keeps travelling along it
 *   aurora   - a slowly flowing aurora gradient
 *   sparkle  - crests throw little four-point sparkles
 * Geometry matches assets/squiggle.svg (16x14 tile, 0.3em tall, stroke 7.5/14 of the height).
 */
import { clamp, reducedNow } from "./layer.js";
import { sleepyLoop } from "./layer.js";

const PAD = 22;
const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const AURORA = {
	dark: [[90, 255, 170], [60, 220, 215], [110, 150, 255], [190, 110, 255]],
	light: [[40, 185, 140], [40, 170, 205], [100, 130, 235], [165, 105, 220]],
};
const aur = (stops, f) => {
	const n = stops.length;
	f = ((f % 1) + 1) % 1 * n; // cyclic
	const k = Math.floor(f) % n, m = (k + 1) % n, u = f - Math.floor(f);
	const s = u * u * (3 - 2 * u);
	return stops[k].map((c, i) => Math.round(c + (stops[m][i] - c) * s));
};

function parseColor(str) {
	const c = document.createElement("canvas").getContext("2d");
	c.fillStyle = "#00a3ff";
	c.fillStyle = str || "#00a3ff";
	const v = c.fillStyle;
	if (v[0] === "#") return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
	const m = v.match(/[\d.]+/g) || [0, 163, 255];
	return [+m[0], +m[1], +m[2]];
}
function rgb2hue([r, g, b]) {
	r /= 255; g /= 255; b /= 255;
	const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn;
	if (!dd) return 200;
	const h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
	return h * 60;
}

export function squiggles(root, d, { mode, dark, reducedMotion }) {
	const reduced = reducedNow(reducedMotion);
	const links = [...root.querySelectorAll(".site-link")];
	const live = new Map(); // link -> state
	const ptr = { x: -999, y: -999, px: -999, py: -999, vx: 0, vy: 0, has: false };
	let hovered = null, pending = false;
	const stops = AURORA[dark ? "dark" : "light"];

	function make(link) {
		if (link.getClientRects().length !== 1) return null; // wrapped links keep the plain mask underline
		const r = link.getBoundingClientRect();
		if (r.width < 8) return null;
		const cs = getComputedStyle(link);
		const em = parseFloat(cs.fontSize) || 16;
		const hgt = em * 0.3, s = hgt / 14; // px per svg unit
		const base = parseColor(cs.getPropertyValue("--siteSquiggle") || "#00a3ff");
		const cvs = document.createElement("canvas");
		cvs.className = "dl-sq";
		cvs.setAttribute("aria-hidden", "true");
		const W = Math.round(r.width), H = Math.ceil(hgt + PAD * 2);
		const dpr = Math.min(2, devicePixelRatio || 1);
		cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
		Object.assign(cvs.style, { left: "0", top: `calc(100% - ${PAD}px)`, width: W + "px", height: H + "px", opacity: "0" });
		link.appendChild(cvs);
		const dx = 4, n = Math.ceil(W / dx) + 1;
		const st = {
			link, cvs, ctx: cvs.getContext("2d"), W, H, s, hgt, dpr, n, dx,
			y: new Float32Array(n), v: new Float32Array(n), // string displacement (px) and velocity
			a: 0, target: 1, hue: rgb2hue(base), baseRgb: base, t: Math.random() * 10, energy: 0, held: false,
			reveal: 0, rx: W / 2, spark: [], lastCrossY: 0, acc: 0, sparkClock: 0, hx: W / 2,
		};
		link.setAttribute("data-dl", "");
		live.set(link, st);
		return st;
	}
	function drop(st) {
		st.cvs.remove();
		st.link.removeAttribute("data-dl");
		live.delete(st.link);
	}

	function localPtr(st) {
		const r = st.link.getBoundingClientRect();
		return { x: ptr.x - r.left, y: ptr.y - r.bottom - st.hgt / 2, vx: ptr.vx, vy: ptr.vy, r };
	}

	/* ---- fixed-step physics (pluck string) ---- */
	function stepString(st, h, lp) {
		const { y, v, n, dx } = st;
		const c2 = (600 * 600) / (dx * dx), damp = 4;
		const inZone = lp && Math.abs(lp.y) < 18 && lp.x > -6 && lp.x < st.W + 6;
		if (inZone) {
			st.held = true;
			const target = clamp(lp.y, -15, 15);
			for (let i = 1; i < n - 1; i++) {
				const w = Math.exp(-Math.pow(i * dx - lp.x, 2) / (2 * 16 * 16));
				if (w < 0.01) continue;
				y[i] += (target * w - y[i]) * Math.min(1, 40 * h * w);
				v[i] *= 1 - Math.min(1, 30 * h * w);
			}
		} else if (st.held) {
			st.held = false; // let go: the string rings
		}
		for (let i = 1; i < n - 1; i++) v[i] += (c2 * (y[i - 1] - 2 * y[i] + y[i + 1]) - damp * v[i]) * h;
		let e = 0;
		for (let i = 1; i < n - 1; i++) { y[i] += v[i] * h; e += Math.abs(y[i]) + Math.abs(v[i]) * 0.01; }
		st.energy = e / n;
	}

	/* ---- drawing ---- */
	function path(st, fn) {
		// sample the svg's sine-ish path; fn(i, x, y) draws a segment
		const { n, dx, s } = st;
		let px = 0, py = 0;
		for (let i = 0; i < n; i++) {
			const x = Math.min(i * dx, st.W);
			const wave = 7 + 2.4 * Math.sin((x / (16 * s)) * 6.2832);
			const yy = PAD + wave * s - 7 * s + st.hgt / 2 + (mode === "pluck" ? st.y[i] : 0);
			if (i) fn(px, py, x, yy, i);
			px = x; py = yy;
		}
	}
	function color(st, x, i) {
		const u = x / st.W;
		const a = st.a;
		if (mode === "pluck") {
			const lp = st.lp;
			const near = lp ? Math.exp(-Math.pow(x - lp.x, 2) / (2 * 70 * 70)) : 0;
			const shift = (st.hueNear * 85 * near + clamp(Math.abs(st.y[i]) / 12) * 55 * clamp(st.energy / 1.2 + 0.3)) ;
			return [hsl(st.hue + shift, dark ? 100 : 95, dark ? 62 : 48), 1];
		}
		if (mode === "rainbow") {
			const R = st.reveal, front = clamp((R - Math.abs(x - st.rx)) / 36);
			const hh = ((x - st.rx) * 0.9 - st.t * 160) % 360;
			if (front <= 0) return [null, 0];
			return [hsl(hh, 100, dark ? 64 : 50), front];
		}
		if (mode === "aurora") {
			const [r, g, b] = aur(stops, u * 0.9 - st.t * 0.07);
			return [`rgb(${r},${g},${b})`, 1];
		}
		return [null, 0];
	}
	function draw(st) {
		const { ctx, dpr } = st;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, st.W, st.H);
		ctx.lineCap = "round"; ctx.lineJoin = "round";
		const w = 7.5 * st.s;
		const [br, bg, bb] = st.baseRgb;
		// plain squiggle underneath (so the swap never flashes)
		const needsBase = mode === "rainbow" || mode === "sparkle";
		ctx.save();
		ctx.beginPath(); ctx.rect(0, 0, st.W, st.H); ctx.clip();
		ctx.lineWidth = w;
		if (needsBase) {
			ctx.strokeStyle = `rgba(${br},${bg},${bb},0.9)`;
			ctx.beginPath();
			path(st, (x0, y0, x1, y1, i) => { if (i === 1) ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); });
			ctx.stroke();
		}
		if (mode === "sparkle") {
			// slight brightening glide along the squiggle
			const hx = st.hx;
			const g = ctx.createLinearGradient(0, 0, st.W, 0);
			const p = clamp(hx / st.W);
			const lo = clamp(p - 0.25), hi = clamp(p + 0.25);
			const hi1 = dark ? "rgba(190,240,255,0.95)" : "rgba(120,100,235,0.95)";
			g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(lo, "rgba(0,0,0,0)");
			g.addColorStop(p, hi1);
			g.addColorStop(hi, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0)");
			ctx.strokeStyle = g;
			ctx.beginPath();
			path(st, (x0, y0, x1, y1, i) => { if (i === 1) ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); });
			ctx.stroke();
		} else {
			path(st, (x0, y0, x1, y1, i) => {
				const [c, f] = color(st, (x0 + x1) / 2, i);
				if (!c) return;
				ctx.globalAlpha = f;
				ctx.strokeStyle = c;
				ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
			});
		}
		ctx.restore();
		ctx.globalAlpha = 1;
		if (mode === "sparkle") drawSparks(st);
		st.cvs.style.opacity = st.a.toFixed(3);
	}
	function drawSparks(st) {
		const { ctx } = st;
		ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
		for (const p of st.spark) {
			const k = p.life / p.max, e = Math.sin(Math.PI * Math.min(1, k * 1.15));
			const r = p.r * (0.4 + e);
			ctx.save();
			ctx.translate(p.x, p.y); ctx.rotate(p.rot + k * 1.2);
			ctx.globalAlpha = clamp(e);
			const col = dark ? `hsl(${p.hue},100%,82%)` : `hsl(${p.hue},95%,52%)`;
			ctx.fillStyle = col;
			ctx.beginPath();
			ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.14, -r * 0.14, r, 0);
			ctx.quadraticCurveTo(r * 0.14, r * 0.14, 0, r); ctx.quadraticCurveTo(-r * 0.14, r * 0.14, -r, 0);
			ctx.quadraticCurveTo(-r * 0.14, -r * 0.14, 0, -r); ctx.fill();
			ctx.globalAlpha = clamp(e) * 0.35;
			ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 6.2832); ctx.fill();
			ctx.restore();
		}
		ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
	}

	/* ---- the loop ---- */
	function trySpawn(st, dt, lp) {
		// sparkles at crests (svg crest = tile phase 0.75), more of them when the cursor is moving near
		const tile = 16 * st.s;
		const boost = lp ? clamp(Math.hypot(ptr.vx, ptr.vy) / 700) : 0;
		st.sparkClock += dt * (reduced ? 0 : 1.2 + boost * 9);
		while (st.sparkClock > 1) {
			st.sparkClock -= 1;
			let cx;
			if (lp && Math.random() < 0.8) cx = lp.x + (Math.random() - 0.5) * 120;
			else cx = Math.random() * st.W;
			const k = Math.round((cx / tile) - 0.75);
			const x = clamp((k + 0.75) * tile, 2, st.W - 2);
			st.spark.push({ x: x + (Math.random() - 0.5) * 3, y: PAD + st.hgt / 2 - 2.4 * st.s - 2, r: 3 + Math.random() * 5.5, life: 0, max: 0.55 + Math.random() * 0.6, rot: Math.random() * 3, hue: dark ? 170 + Math.random() * 120 : 230 + Math.random() * 90 });
			if (st.spark.length > 18) st.spark.shift();
		}
	}
	let acc = 0, tLast = 0;
	const lp = sleepyLoop((dt) => {
		acc += dt;
		let any = false;
		const H = 1 / 240;
		for (const st of [...live.values()]) {
			const isHot = st.link === hovered;
			st.target = isHot || (mode === "pluck" && st.energy > 0.3) ? 1 : 0;
			const p = isHot ? localPtr(st) : null;
			st.lp = p;
			st.a += (st.target - st.a) * (1 - Math.exp(-dt * (st.target ? 14 : 5)));
			st.t += reduced ? 0 : dt;
			if (mode === "pluck") {
				st.hueNear += ((p ? 1 : 0) - st.hueNear) * (1 - Math.exp(-dt * 6));
				if (p) {
					// strum: moving along the text gives the string small kicks
					const sp = ptr.vx;
					if (!reduced && Math.abs(p.y) >= 18 && Math.abs(sp) > 120) {
						const i = clamp(Math.round(p.x / st.dx), 1, st.n - 2);
						for (let j = -3; j <= 3; j++) if (i + j > 0 && i + j < st.n - 1) st.v[i + j] += clamp(Math.abs(sp) * 0.03, 0, 18) * Math.exp(-(j * j) / 4) * (dt * 60);
					}
				}
				let steps = Math.min(12, Math.floor(acc / H));
				const sub = Math.max(0, steps);
				for (let k = 0; k < sub; k++) stepString(st, H, p);
			} else if (mode === "rainbow") {
				if (p) { st.rx += (clamp(p.x, 0, st.W) - st.rx) * (1 - Math.exp(-dt * 3)); st.reveal += dt * 700; }
				else st.reveal -= dt * 520;
				st.reveal = clamp(st.reveal, 0, st.W * 1.2 + 80);
			} else if (mode === "sparkle") {
				if (p) st.hx += (clamp(p.x, 0, st.W) - st.hx) * (1 - Math.exp(-dt * 6));
				trySpawn(st, dt, p);
				for (const q of st.spark) q.life += dt;
				st.spark = st.spark.filter((q) => q.life < q.max);
			}
			draw(st);
			const settling = mode === "pluck" ? st.energy > 0.08 : mode === "rainbow" ? st.reveal > 0 : mode === "sparkle" ? st.spark.length > 0 : false;
			if (!isHot && st.a < 0.01 && !settling) drop(st);
			else any = true;
			if (mode === "aurora" && reduced && !isHot && st.a < 0.01) drop(st);
		}
		acc %= 1 / 240;
		if (acc > 1 / 240) acc = 0;
		return any;
	}, { fps: 60, d });

	/* ---- pointer plumbing ---- */
	function resolve() {
		pending = false;
		let hit = null;
		const em = 16;
		for (const a of links) {
			const r = a.getBoundingClientRect();
			if (r.bottom < 0 || r.top > innerHeight) continue;
			if (ptr.x >= r.left - 4 && ptr.x <= r.right + 4 && ptr.y >= r.top - 2 && ptr.y <= r.bottom + 30) { hit = a; break; }
		}
		if (!ptr.has) hit = null;
		hovered = hit;
		if (hit && !live.has(hit)) {
			const st = make(hit);
			if (st) { st.hueNear = 0; st.rx = clamp(ptr.x - hit.getBoundingClientRect().left, 0, st.W); }
			else hovered = null;
		}
		lp.wake();
	}
	let lt = 0;
	const move = (e) => {
		const now = performance.now();
		if (ptr.has && now > lt) {
			const dt = Math.max(0.008, (now - lt) / 1000);
			ptr.vx += ((e.clientX - ptr.x) / dt - ptr.vx) * 0.5; ptr.vy += ((e.clientY - ptr.y) / dt - ptr.vy) * 0.5;
		}
		lt = now; ptr.x = e.clientX; ptr.y = e.clientY; ptr.has = true;
		if (!pending) { pending = true; requestAnimationFrame(resolve); }
	};
	const leave = () => { ptr.has = false; ptr.vx = ptr.vy = 0; if (!pending) { pending = true; requestAnimationFrame(resolve); } };
	const decay = setInterval(() => { ptr.vx *= 0.6; ptr.vy *= 0.6; }, 80);
	d.on(window, "pointermove", move, { passive: true });
	d.on(document.documentElement, "pointerleave", leave);
	d.on(root, "scroll", () => { if (ptr.has && !pending) { pending = true; requestAnimationFrame(resolve); } }, { passive: true });
	d.add(() => {
		clearInterval(decay);
		for (const st of [...live.values()]) drop(st);
	});
}
