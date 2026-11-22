/*
 * Squiggle delights. All three leave the link's text and layout alone.
 *  - spotlightSquiggles: a rainbow patch rides along the squiggle under the cursor (spring-lagged) and fades to blue.
 *  - rainbowSquiggles: the squiggle turns rainbow on hover; its colors only move when the cursor moves.
 *  - waveSquiggles: the squiggle becomes a live sine wave on a canvas: flowing phase, amplitude springs with cursor speed.
 */
import { clamp, isDark } from "./kit.js";

const linkOf = (t, root) => {
	const a = t && t.closest ? t.closest(".site-link") : null;
	return a && root.contains(a) ? a : null;
};

/** Shared driver: tracks the hovered link and calls update(link, st, dt, ctx) each frame until everything is idle. */
function driver(root, d, { make, update, cleanup, reducedMotion }) {
	const states = new Map();
	let hot = null, raf = 0, last = 0, alive = true;
	const P = { x: 0, y: 0, vx: 0, vy: 0, speed: 0, t: 0 };

	const ensure = (a) => {
		let st = states.get(a);
		if (!st) { st = make(a); states.set(a, st); }
		return st;
	};
	const frame = (now) => {
		raf = 0;
		if (!alive || document.hidden) { last = 0; return; }
		const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
		last = now;
		// the pointer's speed relaxes between events
		P.speed *= Math.exp(-dt * 6);
		let busy = false;
		for (const [a, st] of states) {
			const live = update(a, st, dt, { hot: a === hot, P, reducedMotion });
			if (live) busy = true;
			else { cleanup?.(a, st); states.delete(a); }
		}
		if (busy) raf = requestAnimationFrame(frame); else last = 0;
	};
	const wake = () => { if (!raf && alive && !document.hidden) raf = requestAnimationFrame(frame); };
	const onMove = (e) => {
		const t = performance.now();
		const dt = Math.max(8, t - P.t) / 1000;
		if (P.t) {
			const vx = (e.clientX - P.x) / dt, sp = Math.hypot(vx, (e.clientY - P.y) / dt);
			P.vx = vx; P.speed = Math.max(P.speed * 0.5, Math.min(sp, 4000));
		}
		P.x = e.clientX; P.y = e.clientY; P.t = t;
		const a = linkOf(e.target, root);
		if (a !== hot) {
			const prev = hot;
			hot = a;
			if (a) { const st = ensure(a); st.enter?.(e, a, P); }
			if (prev) states.get(prev)?.leave?.();
		}
		if (hot) wake();
	};
	const onLeave = () => { const prev = hot; hot = null; if (prev) states.get(prev)?.leave?.(); wake(); };
	const onFocus = (e) => {
		const a = linkOf(e.target, root);
		if (!a || !a.matches(":focus-visible")) return;
		hot = a;
		const st = ensure(a);
		st.focus?.(a);
		wake();
	};
	const onBlur = (e) => { const a = linkOf(e.target, root); if (a && a === hot) { hot = null; states.get(a)?.leave?.(); wake(); } };
	const onVis = () => { if (!document.hidden) wake(); };
	addEventListener("pointermove", onMove, { passive: true });
	document.documentElement.addEventListener("pointerleave", onLeave);
	root.addEventListener("focusin", onFocus);
	root.addEventListener("focusout", onBlur);
	document.addEventListener("visibilitychange", onVis);
	d.add(() => {
		alive = false; cancelAnimationFrame(raf);
		removeEventListener("pointermove", onMove);
		document.documentElement.removeEventListener("pointerleave", onLeave);
		root.removeEventListener("focusin", onFocus);
		root.removeEventListener("focusout", onBlur);
		document.removeEventListener("visibilitychange", onVis);
		for (const [a, st] of states) cleanup?.(a, st);
		states.clear();
	});
}

/* ------------------------------------------------------------ #354 rainbow spotlight */
export function spotlightSquiggles(root, d, { reducedMotion }) {
	driver(root, d, {
		reducedMotion,
		make: (a) => {
			const st = { x: 0, v: 0, tx: 0, p: 0, w: 110, hot: false, sweep: 0 };
			st.enter = (e) => { const r = a.getBoundingClientRect(); st.tx = e.clientX - r.left; if (!st.hot && st.p < 0.02) { st.x = st.tx; st.v = 0; } st.hot = true; st.sweep = 0; };
			st.leave = () => { st.hot = false; };
			st.focus = () => { st.hot = true; st.sweep = 1; st.x = 0; st.v = 0; };
			return st;
		},
		update: (a, st, dt, { hot, P }) => {
			if (hot && !st.sweep) { const r = a.getBoundingClientRect(); st.tx = P.x - r.left; }
			if (st.sweep) {
				// keyboard focus: the spotlight walks along the squiggle by itself
				st.sweep = Math.min(2, st.sweep + dt * 0.9);
				st.tx = a.offsetWidth * clamp(st.sweep - 0.4, 0, 1);
			}
			// underdamped spring: the spotlight trails the cursor and overshoots a hair
			const k = 190, c = 17;
			st.v += (st.tx - st.x) * k * dt - st.v * c * dt;
			st.x += st.v * dt;
			const tp = st.hot ? 1 : 0;
			st.p += (tp - st.p) * (1 - Math.exp(-dt * (tp ? 14 : 3.2)));
			const tw = 132 + clamp(P.speed / 1500) * 80 + (st.hot ? 0 : 0);
			st.w += (tw - st.w) * (1 - Math.exp(-dt * 6));
			if (st.sweep >= 2 && st.hot) st.hot = false;
			a.style.setProperty("--dl-x", st.x.toFixed(1));
			a.style.setProperty("--dl-w", st.w.toFixed(0));
			a.style.setProperty("--dl-p", st.p.toFixed(3));
			const busy = st.hot || st.p > 0.01 || Math.abs(st.v) > 1;
			return busy;
		},
		cleanup: (a) => { a.style.removeProperty("--dl-x"); a.style.removeProperty("--dl-w"); a.style.removeProperty("--dl-p"); },
	});
}

/* ------------------------------------------------------------ #360 flowing rainbow */
export function rainbowSquiggles(root, d, { reducedMotion }) {
	const dark = isDark();
	const S = dark ? 72 : 66, L = dark ? 68 : 56;
	d.add(() => root.style.removeProperty("--dl-g"));
	driver(root, d, {
		reducedMotion,
		make: (a) => {
			const st = { hue: 200, ph: 0, p: 0, f: 0, hot: false, fx: 0.5, w: 1 };
			st.enter = (e) => { const r = a.getBoundingClientRect(); st.fx = clamp((e.clientX - r.left) / Math.max(1, r.width)); st.hot = true; };
			st.leave = () => { st.hot = false; };
			st.focus = () => { st.hot = true; st.fx = 0.5; };
			return st;
		},
		update: (a, st, dt, { hot, P }) => {
			const r = a.getBoundingClientRect();
			if (hot) st.fx += (clamp((P.x - r.left) / Math.max(1, r.width)) - st.fx) * (1 - Math.exp(-dt * 8));
			const tp = st.hot ? 1 : 0;
			st.p += (tp - st.p) * (1 - Math.exp(-dt * (tp ? 9 : 2.6)));
			// colors only shift while the cursor moves: the hue advances with pointer travel, and holds still otherwise
			if (st.hot && !reducedMotion) st.ph += Math.min(P.speed, 3000) * dt * 0.09;
			const hue0 = 205 + st.fx * 150 + st.ph;
			const n = Math.max(3, Math.min(9, Math.round(r.width / 46)));
			const stops = [];
			for (let i = 0; i <= n; i++) stops.push(`hsl(${((hue0 + (i / n) * 165) % 360).toFixed(0)} ${S}% ${L}%) ${((i / n) * 100).toFixed(0)}%`);
			a.style.setProperty("--dl-g", `linear-gradient(90deg, ${stops.join(",")})`);
			a.style.setProperty("--dl-p", st.p.toFixed(3));
			return st.hot || st.p > 0.01;
		},
		cleanup: (a) => { a.style.removeProperty("--dl-g"); a.style.removeProperty("--dl-p"); },
	});
}

/* ------------------------------------------------------------ #355 live sine wave */
const REST_AMP = 0.157; // fraction of the squiggle's height; matches assets/squiggle.svg
const TAU = Math.PI * 2;

export function waveSquiggles(root, d, { reducedMotion }) {
	const dpr = Math.min(2, devicePixelRatio || 1);
	const dark = isDark();
	const base = [0, 163, 255], bright = dark ? [120, 225, 255] : [0, 130, 230];
	driver(root, d, {
		reducedMotion,
		make: (a) => {
			const cvs = document.createElement("canvas");
			cvs.className = "dl-wave";
			cvs.setAttribute("aria-hidden", "true");
			a.append(cvs);
			a.classList.add("dl-live");
			const em = parseFloat(getComputedStyle(a).fontSize) || 16;
			const h = em * 0.3, pad = em * 0.3;
			const w = a.offsetWidth + em * 0.4;
			cvs.style.width = `${w}px`; cvs.style.height = `${h + pad * 2}px`; cvs.style.bottom = `${-(h + pad)}px`;
			cvs.width = Math.ceil(w * dpr); cvs.height = Math.ceil((h + pad * 2) * dpr);
			const st = { cvs, ctx: cvs.getContext("2d"), w, h, pad, em, amp: REST_AMP, av: 0, phase: 0, pv: 0, hot: false, cx: w / 2, tcx: w / 2, ex: 0, t: 0, settle: 0 };
			st.enter = (e) => {
				const r = a.getBoundingClientRect();
				st.hot = true; st.tcx = e.clientX - r.left + em * 0.2;
				st.av += 2.4; // a little pluck as the cursor arrives
			};
			st.leave = () => { st.hot = false; };
			st.focus = () => { st.hot = true; st.av += 2.4; st.tcx = st.w / 2; };
			return st;
		},
		update: (a, st, dt, { hot, P }) => {
			const sp = clamp(P.speed / 1400);
			if (hot) { const r = a.getBoundingClientRect(); st.tcx = P.x - r.left + st.em * 0.2; }
			st.cx += (st.tcx - st.cx) * (1 - Math.exp(-dt * 9));
			// amplitude: damped spring toward a speed-driven target (units of the squiggle height)
			const target = st.hot ? REST_AMP + 0.18 + sp * 0.6 : REST_AMP;
			const k = 140, c = 8; // zeta ~0.34: springy
			st.av += ((target - st.amp) * k - st.av * c) * dt;
			st.amp += st.av * dt;
			st.amp = clamp(st.amp, 0.03, 0.7);
			// phase flows while hovered, faster with speed, then glides to rest on a whole period
			const wTarget = st.hot ? TAU * (0.9 + sp * 1.6) : 0;
			st.pv += (wTarget - st.pv) * (1 - Math.exp(-dt * (st.hot ? 4 : 5)));
			if (reducedMotion) st.pv = 0;
			st.phase += st.pv * dt;
			if (!st.hot) {
				// spring to the nearest whole period so the handoff to the static squiggle is seamless
				const goal = Math.round(st.phase / TAU) * TAU;
				st.phase += (goal - st.phase) * (1 - Math.exp(-dt * 6));
			}
			draw(st, sp);
			const settled = !st.hot && Math.abs(st.amp - REST_AMP) < 0.004 && Math.abs(st.av) < 0.05 && Math.abs(st.phase - Math.round(st.phase / TAU) * TAU) < 0.02 && st.pv < 0.05;
			return !settled;
		},
		cleanup: (a, st) => { st.cvs.remove(); a.classList.remove("dl-live"); },
	});

	function draw(st, sp) {
		const { ctx, w, h, pad } = st;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h + pad * 2);
		ctx.save();
		ctx.beginPath(); ctx.rect(st.em * 0.2, 0, w - st.em * 0.4, h + pad * 2); ctx.clip();
		const lam = (16 / 14) * h; // wavelength of the static squiggle
		const mid = pad + h / 2;
		const mix = clamp((st.amp - REST_AMP) * 2.2 + sp * 0.3);
		const col = base.map((v, i) => Math.round(v + (bright[i] - v) * mix));
		ctx.strokeStyle = `rgb(${col})`;
		ctx.globalAlpha = 0.9;
		ctx.lineWidth = (7.5 / 14) * h * (1 - 0.3 * mix);
		ctx.lineCap = "round"; ctx.lineJoin = "round";
		ctx.beginPath();
		const sigma = Math.max(40, w * 0.22);
		const extra = st.amp - REST_AMP;
		const x0 = -lam * 0.1;
		for (let x = x0; x <= w + 1; x += 1.5) {
			// the cursor's end of the string moves the most; the tails ease out
			const g = Math.exp(-((x - st.cx) ** 2) / (2 * sigma * sigma));
			const env = REST_AMP + extra * (0.3 + 0.7 * g);
			const y = mid + Math.sin((TAU * (x - st.em * 0.2)) / lam + st.phase) * env * h * 1.0;
			if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
		}
		ctx.stroke();
		ctx.restore();
	}
}
