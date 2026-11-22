// _dl-d: shared code for wave-14 delight themes #350-353.
// - calmTopAurora: the calmer header (hugs the top edge, shallow, dim, ~3x slower than _refined-e)
// - hiddenStars: nearly invisible margin stars that twinkle up near the cursor
// - cursorTrack / simLoop / stageCanvas: fixed-timestep physics plumbing that sleeps at rest
// - squiggleTrack: delegated pointer tracking on .site-link for squiggle effects
import { starrySky } from "../_sky/stars.js";
import { GL, GLSL, clamp, lerp, rng, isDark, rgba, TAU } from "../_refined-e/kit.js";
export * from "../_refined-e/kit.js";

/* ================= calm top aurora ================= */
const CALM_FS = GLSL + `
uniform float VH;
vec3 cpal(float t){
 vec3 g=vec3(.25,1.,.62),b=vec3(.22,.74,1.),v=vec3(.66,.46,1.);
 vec3 c=mix(g,b,smoothstep(0.,.45,t));return mix(c,v,smoothstep(.4,1.,t));}
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 float vy=uv.y*VH;                       // fraction of the viewport height
 float x=uv.x*3.2;
 float g=exp(-pow((uv.x-M.x)*2.6,2.))*(.4+E*.9);
 vec3 col=vec3(0.);float a=0.;
 for(int L=0;L<3;L++){
  float fl=float(L);
  float t=T*(.03+.008*fl);
  float y0=.002+.014*fbm3(vec2(x*.75+fl*3.1,t))+.004*fl;           // curtain top edge: 0-2% of the viewport
  y0+=clamp(M.y,0.,.1)*.22*g;                                      // bends gently down toward the cursor
  float xx=x-(uv.x-M.x)*.1*g*3.2;
  float ray=.38+.62*smoothstep(.15,.85,fbm3(vec2(xx*9.+fl*9.,t*3.)));
  float hg=.07*(.65+.7*fbm3(vec2(xx*1.6+fl*5.,t*2.)))*(1.+.45*g)*(1.-.12*fl)*(.75+.5*ray);
  float d=vy-y0;
  float v=exp(-max(d,0.)/hg*1.9)*mix(1.,ray,.55);
  v*=(.6+.7*g)*(1.-.2*fl);
  col+=cpal(clamp(d/(hg*2.6),0.,1.)+fl*.1)*v;a+=v;
 }
 float k=AMP*(1.-smoothstep(.075,.13,vy));                         // fully gone by 13%
 gl_FragColor=dither(glow(col*k,a*k,1.35));
}`;

export function calmTopAurora(root, { reduced, host = root.querySelector(".scenery-b") }) {
	const dark = isDark();
	const VH = 0.16;
	const wrap = document.createElement("div");
	wrap.className = "dl-top-aurora";
	wrap.setAttribute("aria-hidden", "true");
	wrap.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${VH * 100}%;pointer-events:none;will-change:transform,opacity;contain:paint`;
	host.appendChild(wrap);
	const gl = new GL(wrap, CALM_FS, { scale: 0.4 });
	const amp = dark ? 0.125 : 0.125;
	const s = { x: 0.5, y: 0.05, tx: 0.5, ty: 0.05, e: 0, t: 40, dead: false, vis: true };
	let raf = 0, last = 0, pend = 0, started = false;
	const size = () => { const r = host.getBoundingClientRect(); gl.resize(r.width, r.height * VH); draw(0.016); };
	const ro = new ResizeObserver(size);
	ro.observe(host);
	function draw(dt) {
		if (!gl.ok) return;
		const a = reduced ? 1 : 1 - Math.exp(-dt * 1.1);            // follow time constant ~0.9 s
		const ox = s.x, oy = s.y;
		s.x += (s.tx - s.x) * a; s.y += (s.ty - s.y) * a;
		const sp = Math.hypot(s.x - ox, (s.y - oy) * 0.6) / Math.max(dt, 0.001);
		s.e += (Math.min(1, sp / 0.5) - s.e) * (1 - Math.exp(-dt * 0.4)); // energy decays over ~2.5 s
		if (!reduced) s.t += dt * (0.2 + s.e * 0.5);                // 3x slower than _refined-e (0.6 + e*2)
		gl.draw({ T: s.t, DK: dark ? 1 : 0, AMP: amp, E: s.e, M: [s.x, s.y], VH });
	}
	function frame(now) {
		raf = 0;
		if (s.dead || document.hidden || !s.vis) return;
		const gap = now - last;
		if (gap >= 1000 / 24 - 3) { last = now; draw(Math.min(0.1, gap / 1000)); }
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
		s.tx = (e.clientX - r.left) / Math.max(1, r.width); s.ty = (e.clientY - r.top) / Math.max(1, r.height);
		wake();
	};
	const onOut = (e) => { if (!e.relatedTarget) { s.tx = 0.5; s.ty = 0.05; } };
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

/* ================= canvas stage ================= */
// A canvas sized to `host` (the fixed scenery layer). onSize(W, H, ctx, scale) fires on resize.
export function stageCanvas(host, onSize) {
	const c = document.createElement("canvas");
	c.setAttribute("aria-hidden", "true");
	c.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none";
	host.appendChild(c);
	const st = { c, ctx: c.getContext("2d"), W: 1, H: 1, scale: 1 };
	const ro = new ResizeObserver(() => {
		const r = host.getBoundingClientRect();
		st.W = Math.max(1, r.width); st.H = Math.max(1, r.height);
		st.scale = Math.min(devicePixelRatio || 1, 1.5);
		c.width = Math.round(st.W * st.scale); c.height = Math.round(st.H * st.scale);
		st.ctx.setTransform(st.scale, 0, 0, st.scale, 0, 0);
		onSize?.(st);
	});
	ro.observe(host);
	st.destroy = () => { ro.disconnect(); c.remove(); };
	return st;
}
// margin geometry: x ranges outside the 52rem column (+ gutter). Returns null when there is no real margin.
export function margins(W, { gutter = 20, min = 60 } = {}) {
	const mw = (W - 832) / 2 - gutter;
	return mw < min ? null : { mw, left: [8, mw], right: [W - mw, W - 8] };
}

/* ================= cursor + fixed-step loop ================= */
export function cursorTrack(host, onMove) {
	const c = { x: -9999, y: -9999, vx: 0, vy: 0, has: false, sx: 0, sy: 0, pending: false, t: 0 };
	const move = (e) => {
		if (e.pointerType === "touch") return;
		const r = host.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
		if (c.has) {
			const dt = Math.max(8, now - c.t);
			c.vx = lerp(c.vx, (x - c.x) / dt * 1000, 0.5); c.vy = lerp(c.vy, (y - c.y) / dt * 1000, 0.5);
		}
		if (!c.pending) { c.sx = c.has ? c.x : x; c.sy = c.has ? c.y : y; c.pending = true; }
		c.x = x; c.y = y; c.t = now; c.has = true;
		onMove?.(c);
	};
	const out = (e) => { if (!e.relatedTarget) { c.has = false; c.vx = c.vy = 0; c.pending = false; c.x = c.y = -9999; } };
	addEventListener("pointermove", move, { passive: true });
	document.addEventListener("pointerout", out, { passive: true });
	c.decay = (dt) => { const k = Math.exp(-dt * 5); c.vx *= k; c.vy *= k; if (Math.abs(c.vx) + Math.abs(c.vy) < 2) c.vx = c.vy = 0; };
	c.destroy = () => { removeEventListener("pointermove", move); document.removeEventListener("pointerout", out); };
	return c;
}
// step(h, t) -> true while anything is still moving. draw(t) paints. With `ambient`, resting scenes idle at ~20 fps; otherwise they sleep.
export function simLoop({ step, draw, reduced = false, ambient = false }) {
	const H = 1 / 60;
	let raf = 0, last = 0, acc = 0, t = 10, dead = false, rest = false;
	const frame = (now) => {
		raf = 0;
		if (dead || document.hidden) return;
		const gap = (now - last) / 1000;
		if (rest && gap < 0.045) { raf = requestAnimationFrame(frame); return; }
		last = now; const dt = Math.min(0.05, gap || 0.016);
		t += dt; acc += dt;
		let moving = false, n = 0;
		while (acc >= H && n < 5) { if (step(H, t)) moving = true; acc -= H; n++; }
		if (n === 5) acc = 0;
		draw(t);
		rest = !moving;
		if (moving || (ambient && !reduced)) raf = requestAnimationFrame(frame);
	};
	const wake = () => { if (dead || document.hidden) return; if (!raf) { rest = false; last = performance.now(); raf = requestAnimationFrame(frame); } };
	const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake(); };
	document.addEventListener("visibilitychange", onVis);
	return { wake, redraw: () => draw(t), destroy() { dead = true; cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); } };
}

/* ================= hidden margin stars ================= */
const TEMPS_DARK = [[190, 215, 255], [235, 240, 255], [255, 236, 205], [255, 214, 190], [175, 255, 228]];
const TEMPS_LIGHT = [[70, 100, 215], [115, 85, 205], [25, 140, 175], [205, 90, 145], [215, 140, 30]];
function starSprite(rgb, flare) {
	const S = 64, c = document.createElement("canvas"); c.width = c.height = S;
	const g = c.getContext("2d"), m = S / 2;
	if (!flare) {
		const gr = g.createRadialGradient(m, m, 0, m, m, m);
		gr.addColorStop(0, rgba(rgb, 1)); gr.addColorStop(0.12, rgba(rgb, 0.75)); gr.addColorStop(0.35, rgba(rgb, 0.16)); gr.addColorStop(1, rgba(rgb, 0));
		g.fillStyle = gr; g.fillRect(0, 0, S, S);
	} else {
		for (const [w, h] of [[S, 2.4], [2.4, S]]) {
			const hor = w > h;
			const l = g.createLinearGradient(hor ? 0 : m, hor ? m : 0, hor ? S : m, hor ? m : S);
			l.addColorStop(0, rgba(rgb, 0)); l.addColorStop(0.5, rgba(rgb, 0.95)); l.addColorStop(1, rgba(rgb, 0));
			g.fillStyle = l; g.fillRect(m - w / 2, m - h / 2, w, h);
		}
	}
	return c;
}

export function hiddenStars(root, { dark, seed = 353, density = 1, reduced, host = root.querySelector(".scenery-c") }) {
	// a dark-sky field of tiny dots (see _sky/stars.js); replaces the old flared sprites
	return starrySky({ root, host, dark, reduced, seed, density });
}

/* ================= squiggle pointer tracking ================= */
// Delegated: onMove(link, nx, ny, event) with nx/ny in 0..1 across the link; onLeave(link).
export function squiggleTrack(root, { onMove, onLeave }) {
	let cur = null;
	const move = (e) => {
		if (e.pointerType === "touch") return;
		const l = e.target.closest?.(".site-link");
		if (l !== cur) { if (cur) onLeave?.(cur); cur = l && root.contains(l) ? l : null; }
		if (!cur) return;
		const r = cur.getBoundingClientRect();
		onMove?.(cur, clamp((e.clientX - r.left) / Math.max(1, r.width)), clamp((e.clientY - r.top) / Math.max(1, r.height)), e);
	};
	const leave = () => { if (cur) { onLeave?.(cur); cur = null; } };
	root.addEventListener("pointermove", move, { passive: true });
	root.addEventListener("pointerleave", leave, { passive: true });
	return () => { root.removeEventListener("pointermove", move); root.removeEventListener("pointerleave", leave); leave(); };
}

/* ---- squiggle effects (the CSS lives in each theme) ---- */
// #350: pointer x phase-shifts the flowing rainbow
export function squiggleRainbow(root) {
	return squiggleTrack(root, { onMove: (l, nx) => l.style.setProperty("--dl-x", nx.toFixed(3)) });
}
// #351: hue follows the cursor along the link, eased (so it glides rather than snaps)
export function squiggleHue(root) {
	const live = new Map();
	let raf = 0;
	const tick = () => {
		raf = 0;
		for (const [l, s] of live) {
			s.h += (s.t - s.h) * 0.14;
			l.style.setProperty("--dl-h", s.h.toFixed(1));
			if (!s.on && Math.abs(s.t - s.h) < 0.5) live.delete(l);
		}
		if (live.size) raf = requestAnimationFrame(tick);
	};
	const off = squiggleTrack(root, {
		onMove: (l, nx) => {
			let s = live.get(l);
			if (!s) live.set(l, (s = { h: 200 + nx * 150, t: 0, on: true }));
			s.on = true; s.t = 200 + nx * 150;
			if (!raf) raf = requestAnimationFrame(tick);
		},
		onLeave: (l) => { const s = live.get(l); if (s) s.on = false; },
	});
	return () => { off(); cancelAnimationFrame(raf); for (const l of live.keys()) l.style.removeProperty("--dl-h"); };
}
// #353: the cursor leaves a soft, fading hue trail on the squiggle as it runs along
export function squiggleTrail(root, { dark }) {
	const live = new Map();
	let raf = 0;
	const L = dark ? 66 : 52;
	const LIFE = 1500;
	const paint = (now) => {
		raf = 0;
		for (const [l, s] of live) {
			s.d = s.d.filter((d) => now - d.t < LIFE);
			if (!s.d.length) { l.style.removeProperty("--dl-trail"); live.delete(l); continue; }
			l.style.setProperty("--dl-trail", s.d.map((d) => {
				const a = Math.pow(1 - (now - d.t) / LIFE, 1.5) * 0.95;
				const c = `hsla(${d.h.toFixed(0)},92%,${L}%,${a.toFixed(3)})`;
				return `radial-gradient(circle 1.5em at ${(d.x * 100).toFixed(1)}% 60%,${c},hsla(${d.h.toFixed(0)},92%,${L}%,0))`;
			}).join(","));
		}
		if (live.size) raf = requestAnimationFrame(paint);
	};
	const off = squiggleTrack(root, {
		onMove: (l, nx) => {
			const now = performance.now();
			let s = live.get(l);
			if (!s) live.set(l, (s = { d: [] }));
			const last = s.d[s.d.length - 1];
			if (!last || Math.abs(last.x - nx) * l.offsetWidth > 7) s.d.push({ x: nx, t: now, h: (nx * 330 + now * 0.04) % 360 });
			if (s.d.length > 18) s.d.shift();
			if (!raf) raf = requestAnimationFrame(paint);
		},
	});
	return () => { off(); cancelAnimationFrame(raf); for (const l of live.keys()) l.style.removeProperty("--dl-trail"); };
}
