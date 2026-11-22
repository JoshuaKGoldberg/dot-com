// _vs2/aurora.js (vs2: morphing hover physics + nav attenuation, still monotone in y)
// _vs/aurora.js: the header aurora, rebuilt so its brightness can only fall from the top edge downward.
//
// Why it is monotone by construction: every layer is  ray(x) * exp(-y / length(x))  -- a curtain whose hem is
// above the viewport, with only the rays hanging down from it visible. Ray noise, length, the cursor's
// brightness / saturation / hue response and the corner falloff all depend on x only; y enters only through the
// decaying envelope and a palette that walks green -> blue -> violet -> rose (each step has lower luminance).
// The cursor bends rays sideways by a small shear that is far gentler than the envelope's own decay.
import { GL, GLSL as GLSL0, clamp, isDark } from "../_refined-e/kit.js";

// vs4: the light-mode palette is data (golden by default); dark mode is #378's, byte for byte.
const GLSL = GLSL0
	.replace("vec3 pal(float t){", "vec3 palD(float t){")
	.replace("// glow accumulation", "uniform vec3 LP0,LP1,LP2,LP3,LP4,LTN;\nvec3 pal(float t){ if(DK>.5) return palD(t); vec3 c=mix(LP0,LP1,smoothstep(0.,.35,t)); c=mix(c,LP2,smoothstep(.3,.7,t)); c=mix(c,LP3,smoothstep(.65,1.,t)); return mix(c,LP4,smoothstep(.98,1.3,t)); }\n// glow accumulation")
	.replace("vec3(.5,.74,.8)", "LTN");
if (!GLSL.includes("LTN;")) throw new Error("vs4: GLSL patch failed");
export const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export const lightUniforms = (l) => ({ LP0: hex3(l.aurora[0]), LP1: hex3(l.aurora[1]), LP2: hex3(l.aurora[2]), LP3: hex3(l.aurora[3]), LP4: hex3(l.aurora[4] || l.aurora[3]), LTN: l.tint || [1, 1, 1] });

export const HPX = 300; // canvas height in css px

export const AURORA_FS = GLSL + `
uniform float HP,WP,CX,PR,AM,PH,WOB,FL,FX,LV,LR;
uniform vec3 WA,SD,NV;
uniform vec2 WB;
void main(){
 vec2 fc=gl_FragCoord.xy;
 float px=fc.x/R.x*WP;
 float py=(1.-fc.y/R.y)*HP;
 // every cursor / mode effect below depends on x only (plus the envelope in y), so brightness can only fall downward
 float d=px-CX;
 float g=PR*exp(-(d/300.)*(d/300.));
 // 1 stir: a soft sideways advection that follows the cursor's travel
 float px2=px+WA.x*g*34.*sin(d/95.+PH+SD.x*6.2832);
 // flow (footer, while hovering): x-only sway, ripples running out from the cursor and a slow sideways drift, so brightness stays monotone in y
 px2+=FL*(16.*sin(T*.33+px/210.+SD.y*6.)+g*26.*sin(abs(d)/68.-T*1.3+SD.z*6.));
 // 2 vortex: a slow twist of the lookup around the cursor, with a hue swirl
 float th=WA.y*g*(SD.y>.5?1.:-1.)*1.25*sin(T*.22+SD.z*6.2832);
 px2=CX+(px2-CX)*cos(th)+d*0.*sin(th);
 float swirl=WA.y*g*sin(d/85.+T*.35+SD.x*6.);
 // 3 breathing bloom: hang and brightness swell together
 float br=.5+.5*sin(T*.62+SD.x*6.2832);
 float bloomH=1.+WA.z*g*.85*br, bloomB=1.+WA.z*g*.55*br;
 // 4 spring lobes: damped spring state WOB wobbles alternating lobes of hang length
 float lobes=1.+WB.x*g*.5*WOB*cos(d/(62.+40.*SD.z)+SD.y*6.);
 lobes=max(.45,lobes);
 // 5 sparks: a few narrow, drifting columns of extra light and hang
 float sp=0.;
 for(int i=0;i<4;i++){
  float fi=float(i);
  float sx=fract(SD.x*5.+fi*.287+T*(.004+.0018*fi))*WP;
  float sg=exp(-pow((px-sx)/(13.+5.*fi),2.));
  sp+=sg*(.5+.5*sin(T*(.9+.3*fi)+fi*2.1+SD.y*6.));
 }
 sp*=WB.y*PR;
 // x-only nav attenuation: gentle, broad dip behind Book / Blog / Projects / Speaking
 float nc=.5*(NV.x+NV.y),hw=.5*(NV.y-NV.x);
 float nt=clamp(max(0.,abs(px-nc)-hw*.35)/(hw*.65+185.),0.,1.);
 float navg=1.-NV.z*(1.-nt*nt*(3.-2.*nt));
 // folds lean toward the cursor, gently (shear << envelope decay)
 float lean=clamp((CX-px)/220.,-1.,1.)*g*.06;
 float xs=(px2+lean*py)/WP+FX;
 float t=T*.25;
 float arch=pow(abs(2.*(px/WP)-1.),1.6);
 float edge=1.-.3*smoothstep(0.,1.,arch);
 float v=0.,ln0=0.;
 for(int L=0;L<3;L++){
  float fl=float(L);
  float u=xs*6.2832;
  float w1=sin(u*(1.1+.35*fl)+t*(1.6+.4*fl)+fl*2.3);
  float w2=sin(u*(2.3+.5*fl)-t*(1.2+.3*fl)+fl*4.1+1.7*w1);
  float w3=sin(u*.55+t*.9+fl*1.3);
  float bil=.5+.5*clamp(.7*w1+.45*w2+.3*w3,-1.,1.);
  float hl=(26.+150.*bil*bil)*(1.+.5*g)*(1.-.2*fl)*bloomH*lobes*(1.+.7*sp)*(.55+.45*navg);
  if(L==0)ln0=hl;
  float soft=.4+.6*(.5+.5*sin(u*(.8+.3*fl)-t*1.1+fl*3.));
  v+=exp(-pow(py/hl,1.5))*soft*(1.-.2*fl);
 }
 v*=exp(-py/150.)*(1.+1.7*g)*mix(edge,1.,.7*g)*(1.-smoothstep(.5*HP,HP,py));
 v*=bloomB*(1.+1.1*sp)*navg*(1.+FL*.26*sin(px/125.-T*.7+SD.x*6.));
 float tt=clamp(py/(ln0*2.4),0.,1.)+.24*g+.16*swirl+.12*sp+FL*.15*sin(px/190.+T*.42+SD.z*6.);
 vec3 col=pal(tt);
 float lum=dot(col,vec3(.2126,.7152,.0722));
 col=max(vec3(0.),mix(vec3(lum),col,1.+1.1*g+.4*sp));
 float a=v*AM;
 float dd=abs(px/WP-.5);
 float mm=dd<.08333?2.:(dd<.25?mix(2.,1.5,smoothstep(.08333,.25,dd)):mix(1.5,1.,smoothstep(.25,.5,dd)));
 float Dx=1.-pow(max(1.-LV,0.),1./mm);
 float fq=LR+(1.-LR)*Dx;
 if(DK>.5){gl_FragColor=dither(glow(col*a,a,1.))*fq;}
 else{
  // light: luminous ink on paper: deep jewel colour at normal alpha, never lightening
  vec3 h=clamp(col,0.,1.);
  float l=(1.-exp(-a*1.7))*.9;
  gl_FragColor=dither(vec4(h*l,l))*fq;
 }
}`;

// the footer is the same shader, flipped: py counts up from the bottom edge, so brightness can only fall upward
export const AURORA_FS_FOOT = AURORA_FS.replace("float py=(1.-fc.y/R.y)*HP;", "float py=(fc.y/R.y)*HP;");
if (AURORA_FS_FOOT === AURORA_FS) throw new Error("vs4: flip patch failed");

// the cursor / mode state machine shared by the header and the footer (morphing hover modes, spring-chased cursor)
export class Drape {
	constructor({ reduced, dark, am }) {
		this.reduced = reduced; this.dark = dark; this.am = am;
		this.s = { cx: 640, tcx: 640, cv: 0, pr: 0, tpr: 0, t: 12, e: 0, lx: 640, ph: 0, wob: 0, wv: 0, armed: true,
			sd: [0.3, 0.7, 0.2], order: [0, 1, 2], mi: 0, mt: 0, dur: 7, fade: 5, w: [0, 0, 0, 0, 0] };
		this.newSeed();
	}
	newSeed() {
		const s = this.s, rand = Math.random;
		s.sd = [rand(), rand(), rand()];
		const o = [0, 1, 2, 3, 4];
		for (let i = o.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [o[i], o[j]] = [o[j], o[i]]; }
		s.order = o.slice(0, 3); s.mi = 0; s.mt = 0; s.dur = 6 + rand() * 6; s.fade = 4 + rand() * 4;
	}
	aim(tcx, tpr) {
		const s = this.s;
		s.tcx = tcx; s.tpr = tpr;
		if (tpr < 0.03 && s.pr < 0.05) s.armed = true;
		else if (tpr > 0.12 && s.armed) { s.armed = false; this.newSeed(); }
	}
	step(dt) {
		const s = this.s, rand = Math.random, reduced = this.reduced;
		// while the cursor has no influence yet (pr ~ 0) the focus simply sits at its target, so the first hover starts from the cursor with no slide
		if (reduced || s.pr < 0.02) { s.cx = s.tcx; s.cv = 0; s.lx = s.cx; }
		else { s.cv += ((s.tcx - s.cx) * 26 - s.cv * 6.5) * dt; s.cx += s.cv * dt; }
		const k = s.tpr > s.pr ? 2.5 : 0.7;
		s.pr += (s.tpr - s.pr) * (reduced ? 1 : 1 - Math.exp(-dt * k));
		const vx = (s.cx - s.lx) / Math.max(dt, 0.001); s.lx = s.cx;
		s.e += (Math.min(1, Math.abs(vx) / 800) - s.e) * (1 - Math.exp(-dt * 0.8));
		s.ph += (s.cx - (s.cx - vx * dt)) / 150;
		s.wv += (-18 * s.wob - 2.2 * s.wv + clamp(vx / 900, -2, 2) * 18) * dt;
		s.wob = clamp(s.wob + s.wv * dt, -1.2, 1.2);
		if (!reduced) {
			s.t += dt * (0.2 + s.e * 0.4 + (this.flow || 0) * 0.5);
			if (s.pr > 0.02) s.mt += dt;
			if (s.mt > s.dur + s.fade) { s.mt = 0; s.mi = (s.mi + 1) % 3; s.dur = 6 + rand() * 6; s.fade = 4 + rand() * 4; if (s.mi === 0) { const o = [0, 1, 2, 3, 4].filter((m) => !s.order.includes(m)); s.order[(rand() * 3) | 0] = o[(rand() * o.length) | 0]; } }
		}
		const b = clamp((s.mt - s.dur) / s.fade), sb = b * b * (3 - 2 * b);
		s.w.fill(0); s.w[s.order[s.mi]] += 1 - sb; s.w[s.order[(s.mi + 1) % 3]] += sb;
	}
	uniforms(HP, WP, nav, cxScale = 1, light) {
		const s = this.s;
		return { LV: this.lv ?? 1, LR: this.lr ?? 1, FL: this.flow || 0, FX: this.fx || 0, T: s.t, DK: this.dark ? 1 : 0, AM: this.am, HP, WP, CX: s.cx / cxScale, PR: s.pr, PH: s.ph, WOB: s.wob,
			WA: [s.w[0], s.w[1], s.w[2]], WB: [s.w[3], s.w[4]], SD: s.sd, NV: nav, AMP: 0, E: 0, M: [0.5, 0.5], ...lightUniforms(light) };
	}
}

const smoothY = (y) => { const q = clamp((y - 140) / 170); return q * q * (3 - 2 * q); }; // 0 within 140px of the top, 1 by 310px
export function vsAurora(root, { reduced, host = root.querySelector(".scenery-b"), amp = 1, light }) {
	const dark = isDark();
	const wrap = document.createElement("div");
	wrap.className = "vs-top-aurora";
	wrap.setAttribute("aria-hidden", "true");
	wrap.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${HPX}px;pointer-events:none;will-change:transform,opacity;contain:paint`;
	host.appendChild(wrap);
	const gl = new GL(wrap, AURORA_FS, { scale: 0.2 });
	// the opacity is driven by the dwell controller (index.js): a plain opacity on the canvas, no filters, no transition
	const glow = wrap.firstElementChild;
	if (glow) glow.style.cssText += ";opacity:.75;will-change:opacity";
	const D = new Drape({ reduced, dark, am: (dark ? 0.4 : 0.7) * amp });
	const s = D.s;
	let nav = [0, 0, 0];
	const measureNav = () => {
		const n = root.querySelector(".site-nav"), hr = host.getBoundingClientRect();
		if (!n) return;
		const r = n.getBoundingClientRect();
		nav = r.width > 0 && r.left > 0 ? [r.left - hr.left, r.right - hr.left, 0.52] : [0, 0, 0];
	};
	let raf = 0, last = 0, pend = 0, started = false, W = 1280, vis = true, dead = false;
	const size = () => { const r = host.getBoundingClientRect(); W = r.width; measureNav(); gl.resize(W, HPX); s.cx = s.tcx = W / 2; draw(0.016); };
	const ro = new ResizeObserver(size);
	ro.observe(host);
	document.fonts?.ready.then(() => { measureNav(); });
	function draw(dt) {
		if (!gl.ok) return;
		D.step(dt);
		gl.draw(D.uniforms(HPX, W, nav, 1, light));
	}
	function frame(now) {
		raf = 0;
		if (dead || document.hidden || !vis) return;
		const gap = now - last;
		if (gap >= 1000 / 20 - 3) { last = now; draw(Math.min(0.1, gap / 1000)); }
		raf = requestAnimationFrame(frame);
	}
	const wake = () => {
		if (dead || !started || document.hidden || !vis) return;
		if (reduced) { draw(0.016); return; }
		if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
	};
	const apply = () => {
		pend = 0;
		const y = root.scrollTop;
		wrap.style.transform = y ? `translate3d(0,${(-y * 0.55).toFixed(1)}px,0)` : "";
		wrap.style.opacity = y ? String(clamp(1 - y / 400).toFixed(3)) : "";
		const v = y < 410;
		if (v !== vis) { vis = v; if (v) wake(); }
	};
	const onScroll = () => { if (!pend) pend = requestAnimationFrame(apply); };
	root.addEventListener("scroll", onScroll, { passive: true });
	const onMove = (e) => {
		if (e.pointerType === "touch") return;
		const r = host.getBoundingClientRect();
		const tp = 1 - smoothY(e.clientY - r.top);
		D.aim(tp > 0.03 ? e.clientX - r.left : D.s.tcx, tp);
		wake();
	};
	const onOut = (e) => { if (!e.relatedTarget) { s.tpr = 0; wake(); } };
	addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerout", onOut, { passive: true });
	const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake(); };
	document.addEventListener("visibilitychange", onVis);
	started = true; apply(); size(); wake();
	return {
		state: s, draw, gl, wrap,
		setLevel(v, rest, peak) { if (glow) glow.style.opacity = peak.toFixed(3); D.lv = v; D.lr = rest / peak; if (reduced) draw(0.016); },
		destroy() {
			dead = true; cancelAnimationFrame(raf); cancelAnimationFrame(pend); ro.disconnect();
			root.removeEventListener("scroll", onScroll);
			removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerout", onOut);
			document.removeEventListener("visibilitychange", onVis);
			gl.destroy(); wrap.remove();
		},
	};
}
