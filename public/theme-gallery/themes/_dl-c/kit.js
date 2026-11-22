// _dl-c: shared helpers for wave-14 "delight" themes #347-349 and #358.
// - calmAurora: the calmer top aurora (hugs the top edge, short, dim, ~3x slower than _refined-e)
// - marginLayer: a fixed viewport canvas that paints only in the side margins (outside the 52rem column), fixed-step sim, sleeps at rest
// - squiggleFx: sets --x on a hovered .site-link so CSS can follow the cursor
// - sprites: pre-rendered glow sprites
export * from "../_refined-e/kit.js";
import { GL, GLSL, AURORA_FN, clamp, isDark } from "../_refined-e/kit.js";

/* ================= calm top aurora ================= */
const TOP_FS = GLSL + AURORA_FN + `
uniform float VH;
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 float vy=uv.y*VH;
 float arch=pow(abs(2.*uv.x-1.),1.6);
 float edge=1.-.3*smoothstep(.0,1.,arch);
 vec4 A=aurora(vec2(uv.x,vy-.012*arch),1.);
 // brightest right at the top edge; gone by ~13% of the viewport
 float fade=1.-smoothstep(.06,.13,vy+.006*(vn(vec2(uv.x*3.,T*.02))-.5));
 float k=AMP*edge*fade;
 gl_FragColor=dither(glow(A.rgb*k,A.a*k,1.2));
}`;

export function calmAurora(root, { reduced, host = root.querySelector(".scenery-b"), amp = 0.55 }) {
	const dark = isDark();
	const VH = 0.2;
	const wrap = document.createElement("div");
	wrap.className = "dl-top-aurora";
	wrap.setAttribute("aria-hidden", "true");
	wrap.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${VH * 100}%;pointer-events:none;will-change:transform,opacity;contain:paint`;
	host.appendChild(wrap);
	const gl = new GL(wrap, TOP_FS, { scale: 0.4 });
	const A = 0.3 * 0.46 * (dark ? 1 : 1.8) * amp;
	const s = { x: 0.5, y: 0.03, tx: 0.5, ty: 0.03, e: 0, eT: 0, t: 12, dead: false, vis: true };
	let raf = 0, last = 0, pend = 0, started = false;
	const size = () => { const r = host.getBoundingClientRect(); gl.resize(r.width, r.height * VH); draw(0.016); };
	const ro = new ResizeObserver(size);
	ro.observe(host);
	function draw(dt) {
		if (!gl.ok) return;
		const a = reduced ? 1 : 1 - Math.exp(-dt * 1.1);       // follow time constant ~0.9 s
		const ox = s.x, oy = s.y;
		s.x += (s.tx - s.x) * a; s.y += (s.ty - s.y) * a;
		const sp = Math.hypot(s.x - ox, (s.y - oy) * 0.6) / Math.max(dt, 0.001);
		const tgt = Math.min(1, sp / 0.5);
		s.e += (tgt - s.e) * (1 - Math.exp(-dt * (tgt > s.e ? 1.2 : 0.4))); // energy decays over ~2.5 s
		if (!reduced) s.t += dt * (0.2 + s.e * 0.6);
		gl.draw({ T: s.t, DK: dark ? 1 : 0, AMP: A, E: s.e, M: [s.x, s.y], VH,
			BASE: 0.012, HGT: 0.034, WOB: 0.03, LS: 0.007, RAYS: 0.4, WX: 3.0, WAVE: 0.03, PULL: 0.4, LOWF: 0.01 });
	}
	function frame(now) {
		raf = 0;
		if (s.dead || document.hidden || !s.vis) return;
		const gap = now - last;
		if (gap >= 1000 / 20 - 3) { last = now; draw(Math.min(0.1, gap / 1000)); }
		raf = requestAnimationFrame(frame);
	}
	const wake = () => {
		if (s.dead || !started || document.hidden || !s.vis) return;
		if (reduced) { draw(0.016); return; }
		if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
	};
	const apply = () => {
		pend = 0;
		const y = root.scrollTop;
		wrap.style.transform = y ? `translate3d(0,${(-y * 0.55).toFixed(1)}px,0)` : "";
		wrap.style.opacity = y ? String(clamp(1 - y / 400).toFixed(3)) : "";
		const vis = y < 410;
		if (vis !== s.vis) { s.vis = vis; if (vis) wake(); }
	};
	const onScroll = () => { if (!pend) pend = requestAnimationFrame(apply); };
	root.addEventListener("scroll", onScroll, { passive: true });
	const onMove = (e) => {
		if (e.pointerType === "touch") return;
		const r = host.getBoundingClientRect();
		s.tx = (e.clientX - r.left) / Math.max(1, r.width); s.ty = clamp((e.clientY - r.top) / Math.max(1, r.height), 0, 0.3);
		wake();
	};
	const onOut = (e) => { if (!e.relatedTarget) { s.tx = 0.5; s.ty = 0.03; } };
	addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerout", onOut, { passive: true });
	const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake(); };
	document.addEventListener("visibilitychange", onVis);
	started = true; apply(); size(); wake();
	return () => {
		s.dead = true; cancelAnimationFrame(raf); cancelAnimationFrame(pend); ro.disconnect();
		root.removeEventListener("scroll", onScroll);
		removeEventListener("pointermove", onMove);
		document.removeEventListener("pointerout", onOut);
		document.removeEventListener("visibilitychange", onVis);
		gl.destroy(); wrap.remove();
	};
}

/* ================= margin layer ================= */
// fx = { init?(L), step(dt, p, L) -> bool awake, draw(g, t, L, p), ambient?: bool, fps?: number | () => number, onResize?(L) }
// L = { W, H, zones: [[x0,x1],[x2,x3]], colL, colR, dark }; p = pointer { x, y, vx, vy, speed, has, still }
export function marginLayer(root, fx, { reduced, host = root.querySelector(".overlay-a"), dark = isDark(), dprMax = 1.5 } = {}) {
	const c = document.createElement("canvas");
	c.setAttribute("aria-hidden", "true");
	c.className = "dl-margin";
	c.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none";
	host.appendChild(c);
	const g = c.getContext("2d");
	const L = { W: 1, H: 1, zones: [[0, 0], [0, 0]], colL: 0, colR: 0, dark, on: false, dpr: 1 };
	const p = { x: -999, y: -999, vx: 0, vy: 0, speed: 0, has: false, still: 0, ev: 0 };
	let raf = 0, last = 0, acc = 0, t = 0, awake = false, dead = false, lastDraw = 0, resizeT = 0;
	const DT = 1 / 60;
	const layout = () => {
		const r = host.getBoundingClientRect();
		L.W = Math.round(r.width); L.H = Math.round(r.height); L.dpr = Math.min(devicePixelRatio || 1, dprMax);
		const half = 416 + 10, mw = L.W / 2 - half;
		L.on = mw >= 70;
		L.colL = L.W / 2 - half; L.colR = L.W / 2 + half;
		L.zones = [[0, Math.max(0, L.colL)], [Math.min(L.W, L.colR), L.W]];
		c.width = Math.max(2, Math.round(L.W * L.dpr)); c.height = Math.max(2, Math.round(L.H * L.dpr));
		if (L.on) { fx.init?.(L); }
		paint();
		if (L.on && (fx.ambient && !reduced)) wake();
	};
	const paint = () => {
		g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
		g.clearRect(0, 0, L.W, L.H);
		if (L.on) fx.draw(g, t, L, p);
	};
	const frame = (now) => {
		raf = 0;
		if (dead || document.hidden || !L.on) return;
		raf = requestAnimationFrame(frame);
		const fps = typeof fx.fps === "function" ? fx.fps() : fx.fps || 30;
		if (now - lastDraw < 1000 / fps - 3) return;
		const gap = Math.min(0.1, (now - last) / 1000); last = now; lastDraw = now;
		acc += gap;
		let moving = false;
		while (acc >= DT) {
			acc -= DT; t += DT;
			p.vx *= Math.exp(-DT * 7); p.vy *= Math.exp(-DT * 7); p.speed = Math.hypot(p.vx, p.vy);
			p.still += DT;
			moving = fx.step(DT, p, L) || moving;
		}
		paint();
		if (!moving && !(fx.ambient && !reduced)) { awake = false; cancelAnimationFrame(raf); raf = 0; }
	};
	function wake() {
		if (dead || !L.on || document.hidden) return;
		awake = true;
		if (!raf) { last = lastDraw = performance.now(); raf = requestAnimationFrame(frame); }
	}
	const onMove = (e) => {
		if (e.pointerType === "touch") return;
		const r = host.getBoundingClientRect();
		const nx = e.clientX - r.left, ny = e.clientY - r.top, now = performance.now();
		const dt = Math.max(8, now - (p.ev || now - 16));
		const ivx = (nx - p.x) / dt * 1000, ivy = (ny - p.y) / dt * 1000;
		if (p.has) { p.vx += (ivx - p.vx) * 0.5; p.vy += (ivy - p.vy) * 0.5; }
		p.x = nx; p.y = ny; p.has = true; p.ev = now; p.still = 0;
		p.speed = Math.hypot(p.vx, p.vy);
		fx.onPointer?.(p, L);
		wake();
	};
	const onOut = (e) => { if (!e.relatedTarget) { p.has = false; p.still = 99; fx.onLeave?.(p, L); wake(); } };
	const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (fx.ambient || awake) wake(); };
	addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerout", onOut, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	const ro = new ResizeObserver(() => { clearTimeout(resizeT); resizeT = setTimeout(layout, 80); });
	ro.observe(host);
	layout();
	return {
		wake, canvas: c, L, p, repaint: paint,
		destroy() {
			dead = true; cancelAnimationFrame(raf); clearTimeout(resizeT); ro.disconnect();
			removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerout", onOut);
			document.removeEventListener("visibilitychange", onVis);
			c.remove();
		},
	};
}
export const inZone = (L, x) => (x >= L.zones[0][0] && x <= L.zones[0][1]) || (x >= L.zones[1][0] && x <= L.zones[1][1]);
// nearest point in a margin zone to x
export const toZone = (L, x) => (x < L.W / 2 ? Math.min(x, L.zones[0][1]) : Math.max(x, L.zones[1][0]));

/* ================= sprites ================= */
// soft glow dot, pre-rendered once: rgb color, size in px (diameter)
export function glowSprite(rgb, size = 32, { cross = 0 } = {}) {
	const c = document.createElement("canvas"); c.width = c.height = size;
	const g = c.getContext("2d"), m = size / 2;
	const gr = g.createRadialGradient(m, m, 0, m, m, m);
	gr.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`);
	gr.addColorStop(0.18, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.55)`);
	gr.addColorStop(0.5, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.12)`);
	gr.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
	g.fillStyle = gr; g.fillRect(0, 0, size, size);
	if (cross) {
		g.globalCompositeOperation = "lighter";
		for (const [dx, dy] of [[1, 0], [0, 1]]) {
			const lg = g.createLinearGradient(m - dx * m, m - dy * m, m + dx * m, m + dy * m);
			lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, `rgba(255,255,255,${cross})`); lg.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = lg; g.fillRect(dx ? 0 : m - 0.6, dy ? 0 : m - 0.6, dx ? size : 1.2, dy ? size : 1.2);
		}
	}
	return c;
}

/* ================= squiggle: pointer position along the link as --x (0-100) ================= */
export function squiggleFx(root, kind) {
	root.classList.add(`dl-sq-${kind}`);
	let cur = null;
	const set = (e) => {
		const a = e.target?.closest?.(".site-link");
		cur = a || null;
		if (!a) return;
		const r = a.getBoundingClientRect();
		a.style.setProperty("--x", (clamp((e.clientX - r.left) / Math.max(1, r.width)) * 100).toFixed(1));
	};
	root.addEventListener("pointermove", set, { passive: true });
	return () => { root.removeEventListener("pointermove", set); root.classList.remove(`dl-sq-${kind}`); };
}
