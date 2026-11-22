// _vs/aurora.js: the header aurora, rebuilt so its brightness can only fall from the top edge downward.
//
// Why it is monotone by construction: every layer is  ray(x) * exp(-y / length(x))  -- a curtain whose hem is
// above the viewport, with only the rays hanging down from it visible. Ray noise, length, the cursor's
// brightness / saturation / hue response and the corner falloff all depend on x only; y enters only through the
// decaying envelope and a palette that walks green -> blue -> violet -> rose (each step has lower luminance).
// The cursor bends rays sideways by a small shear that is far gentler than the envelope's own decay.
import { GL, GLSL, clamp, isDark } from "../_refined-e/kit.js";

const HPX = 300; // canvas height in css px

const FS = GLSL + `
uniform float HP,WP,CX,PR,AM;
void main(){
 vec2 fc=gl_FragCoord.xy;
 float px=fc.x/R.x*WP;
 float py=(1.-fc.y/R.y)*HP;
 // cursor: x-only, so it can never raise brightness lower in a column than higher in it
 float dxc=(px-CX)/300.;
 float g=PR*exp(-dxc*dxc);
 // folds lean toward the cursor, gently (shear << envelope decay)
 float lean=clamp((CX-px)/220.,-1.,1.)*g*.06;
 float xs=(px+lean*py)/WP;
 float t=T*.25;
 float arch=pow(abs(2.*(px/WP)-1.),1.6);
 float edge=1.-.3*smoothstep(0.,1.,arch);
 float v=0.,ln0=0.;
 for(int L=0;L<3;L++){
  float fl=float(L);
  // broad, soft x-variation only: rounded lobes along the lower boundary (sinuous sums), no fine striations
  float u=xs*6.2832;
  float w1=sin(u*(1.1+.35*fl)+t*(1.6+.4*fl)+fl*2.3);
  float w2=sin(u*(2.3+.5*fl)-t*(1.2+.3*fl)+fl*4.1+1.7*w1);
  float w3=sin(u*.55+t*.9+fl*1.3);
  float bil=.5+.5*clamp(.7*w1+.45*w2+.3*w3,-1.,1.);
  float hl=(26.+150.*bil*bil)*(1.+.5*g)*(1.-.2*fl);
  if(L==0)ln0=hl;
  float soft=.4+.6*(.5+.5*sin(u*(.8+.3*fl)-t*1.1+fl*3.));
  v+=exp(-pow(py/hl,1.5))*soft*(1.-.2*fl);
 }
 v*=exp(-py/150.)*(1.+1.7*g)*mix(edge,1.,.7*g)*(1.-smoothstep(.5*HP,HP,py));
 // palette: green at the top, then blue, violet, rose at the tips; the cursor slides it toward teal / violet / rose
 float tt=clamp(py/(ln0*2.4),0.,1.)+.24*g;
 vec3 col=pal(tt);
 float lum=dot(col,vec3(.2126,.7152,.0722));
 col=max(vec3(0.),mix(vec3(lum),col,1.+1.1*g));
 float a=v*AM;
 if(DK>.5){gl_FragColor=dither(glow(col*a,a,1.));}
 else{
  // light mode: pastel tint at constant luminance, so the page only ever darkens in proportion to the (falling) intensity
  vec3 h=mix(vec3(lum),col,1.2)*vec3(.5,.74,.8);
  h*=.58/max(dot(h,vec3(.2126,.7152,.0722)),.01);
  float l=(1.-exp(-a))*.62;
  gl_FragColor=dither(vec4(h*l,l));
 }
}`;

export function vsAurora(root, { reduced, host = root.querySelector(".scenery-b"), amp = 1 } = {}) {
	const dark = isDark();
	const wrap = document.createElement("div");
	wrap.className = "vs-top-aurora";
	wrap.setAttribute("aria-hidden", "true");
	wrap.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${HPX}px;pointer-events:none;will-change:transform,opacity;contain:paint`;
	host.appendChild(wrap);
	const gl = new GL(wrap, FS, { scale: 0.2 });
	const AM = (dark ? 0.4 : 0.7) * amp;
	const s = { cx: 640, tcx: 640, pr: 0, tpr: 0, t: 12, e: 0, dead: false, vis: true, lx: 640 };
	let raf = 0, last = 0, pend = 0, started = false, W = 1280;
	const size = () => { const r = host.getBoundingClientRect(); W = r.width; gl.resize(W, HPX); s.cx = s.tcx = W / 2; draw(0.016); };
	const ro = new ResizeObserver(size);
	ro.observe(host);
	function draw(dt) {
		if (!gl.ok) return;
		const fast = reduced ? 1 : 1 - Math.exp(-dt * 3);
		s.cx += (s.tcx - s.cx) * fast;
		const k = s.tpr > s.pr ? 2.5 : 0.7; // rises quickly, decays gently once the cursor leaves
		s.pr += (s.tpr - s.pr) * (reduced ? 1 : 1 - Math.exp(-dt * k));
		const sp = Math.abs(s.cx - s.lx) / Math.max(dt, 0.001) / 800; s.lx = s.cx;
		s.e += (Math.min(1, sp) - s.e) * (1 - Math.exp(-dt * 0.8));
		if (!reduced) s.t += dt * (0.2 + s.e * 0.4); // calm base motion; the cursor only quickens it a little
		gl.draw({ T: s.t, DK: dark ? 1 : 0, AM, HP: HPX, WP: W, CX: s.cx, PR: s.pr, AMP: 0, E: 0, M: [0.5, 0.5] });
	}
	const settled = () => Math.abs(s.tpr - s.pr) < 0.004 && Math.abs(s.tcx - s.cx) < 0.5;
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
		s.tcx = e.clientX - r.left;
		// the response fades as the cursor moves away from the top of the page
		s.tpr = 1 - clamp((e.clientY - 220) / 320);
		wake();
	};
	const onOut = (e) => { if (!e.relatedTarget) { s.tpr = 0; wake(); } };
	addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerout", onOut, { passive: true });
	const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake(); };
	document.addEventListener("visibilitychange", onVis);
	started = true; apply(); size(); wake();
	return {
		// test hook: pin the cursor state so a measurement can run without a live pointer
		state: s, draw,
		destroy() {
			s.dead = true; cancelAnimationFrame(raf); cancelAnimationFrame(pend); ro.disconnect();
			root.removeEventListener("scroll", onScroll);
			removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerout", onOut);
			document.removeEventListener("visibilitychange", onVis);
			gl.destroy(); wrap.remove();
		},
	};
}
