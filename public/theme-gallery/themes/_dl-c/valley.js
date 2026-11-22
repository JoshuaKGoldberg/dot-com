import { GL, GLSL, AURORA_FN, footerStage, createLoop, pointerTracker, mkCanvas, sizeCanvas, isDark, idle, rng, clamp, lerp, smooth, TAU, ridgeFn, spruce, Birds, drawLoon } from "./kit.js";

const YH = 0.5; // horizon, as a fraction of footer height
const NR = 6;

const FS = GLSL + AURORA_FN + `
uniform sampler2D S;uniform vec3 RP[${NR}];uniform float YH,WN;
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 float asp=R.x/R.y;
 bool dk=DK>.5;
 vec4 o=vec4(0.);
 if(uv.y<YH){
  vec4 A=aurora(uv,1.);
  float k=AMP*smoothstep(0.,.14,uv.y)*(1.-smoothstep(YH-.14,YH,uv.y));
  o=glow(A.rgb*k,A.a*k,1.3);
  float hz=exp(-(YH-uv.y)/.1)*(.55+.45*vn(vec2(uv.x*2.5,T*.02)));
  o=over(vec4((dk?vec3(.1,.3,.34):vec3(.7,.84,.88))*hz*(dk?.22:.3),hz*(dk?.12:.25)),o);
  o*=smoothstep(0.,.06,uv.y);
 }else{
  float d=uv.y-YH;
  float depth=smoothstep(0.,.5,d);
  // surface shimmer + click ripples displace the mirrored lookup
  vec2 off=vec2((vn(vec2(uv.x*26.,uv.y*60.+T*.5))-.5)*.0045*(.3+d*3.),(vn(vec2(uv.x*14.+4.,uv.y*90.-T*.4))-.5)*.004*(.2+d*3.));
  off*=1.-.9*WN;
  float hi=0.;
  for(int i=0;i<${NR};i++){
   vec3 r=RP[i];
   if(r.z<0.)continue;
   vec2 q=(uv-r.xy)*vec2(asp,1.)*vec2(1.,3.4);
   float rr=length(q);
   float R0=r.z*.13,w=.03+r.z*.02;
   float env=exp(-pow((rr-R0)/w,2.))*exp(-r.z*.5)*smoothstep(0.,.15,r.z);
   float wave=sin((rr-R0)*70.)*env;
   off+=q/max(rr,.001)*vec2(1./asp,1./3.4)*wave*.011*(1.-.9*WN);
   hi+=max(wave,0.)*.9+env*.15;
  }
  vec2 pr=vec2(uv.x+off.x,YH-d+off.y);
  float refl=mix(.85,.05,smoothstep(0.,.32,d))*(1.-.4*WN);
  vec4 A=aurora(pr,1.);
  float k=AMP*refl*(1.-smoothstep(YH-.14,YH,pr.y));
  o=glow(A.rgb*k*.9,A.a*k*.9,1.3);
  vec4 sl=texture2D(S,vec2(pr.x,pr.y));
  o=over(sl*(dk?.85:.55)*mix(1.,.5,depth),o);
  // faint sheen and ripple glints
  float sh=vn(vec2(uv.x*40.,uv.y*240.+T*.3))*(1.-depth)*.5;
  vec3 gl2=dk?vec3(.4,.8,.8):vec3(.45,.6,.7);
  float ga=(sh*.05+hi*.2)*(dk?1.:.7);
  o=over(vec4(gl2*ga,ga*(dk?.6:.5)),o);
  float ln=exp(-pow(d/.005,2.))*(dk?.18:.25);
  o=over(vec4((dk?vec3(.35,.6,.62):vec3(.55,.7,.78))*ln,ln),o);
  // water base tone so the lake reads against the page: faint in dark, pale in light
  float wa=(1.-depth)*(dk?.1:.18);
  o=over(vec4((dk?vec3(.05,.1,.17):vec3(.7,.82,.88))*wa,wa),o);
  if(WN>.5){
   // thin ice: pale body, long horizontal streaks and a soft sheen near the far shore
   float st=smoothstep(.62,.9,fbm3(vec2(uv.x*2.2+uv.y*.6,uv.y*26.)));
   float ia=(dk?.14:.34)*(1.-depth*.55);
   o=over(vec4((dk?vec3(.5,.66,.8):vec3(.86,.94,.98))*ia,ia),o);
   float sa=st*(dk?.12:.2)*(1.-depth*.6);
   o=over(vec4((dk?vec3(.8,.9,1.):vec3(1.))*sa,sa),o);
  }
 }
 gl_FragColor=dither(o);
}`;

const MIST_FS = GLSL + `
uniform float YH;
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 float x=uv.x*3.4;
 vec2 q=vec2(x*1.3+T*.012,uv.y*4.6-T*.003);
 q+=.6*vec2(fbm3(q*.8+2.),fbm3(q*.8+8.));
 float n=smoothstep(.34,.66,fbm3(q));
 float n2=smoothstep(.4,.7,fbm3(vec2(x*2.1-T*.02,uv.y*7.+3.)));
 float env=exp(-pow((uv.y-(YH+.01))/.11,2.))*(.55+.6*vn(vec2(x*.8,9.)));
 float a=(n*.8+n2*.35)*env;
 float g=.5+.5*sin(uv.x*5.+T*.03);
 vec3 mc=DK>.5?mix(vec3(.3,.5,.62),vec3(.28,.62,.55),g):vec3(1.,1.,1.);
 a*=DK>.5?.85:1.0;
 gl_FragColor=dither(vec4(mc*a*(DK>.5?.75:1.),a));
}`;

export function valleyFooter(root, { reducedMotion, winter = false, hooks = {} }) {
	const dark = isDark();
	const stage = footerStage(root, { height: 300 });
	if (!stage) return null;
	const { host } = stage;
	const gl = new GL(host, FS, { scale: 0.5 });
	const cS = mkCanvas(host);   // sharp silhouettes
	const cO = mkCanvas(host);   // overlay: stars, birds, loon
	const mist = new GL(host, MIST_FS, { scale: 0.3 });
	const hint = document.createElement("span");
	hint.className = "ra-valley-hint"; hint.textContent = winter ? "click the ice" : "click the water";
	host.appendChild(hint);

	let W = 1, H = 1, octx = null, birds = null, stars = [], surf = null, pile = null;
	const api = { get W() { return W; }, get H() { return H; }, YH, host, get surf() { return surf; }, get pile() { return pile; }, get loop() { return loop; }, dark, winter, stage };
	const cracks = [];
	const ripples = Array.from({ length: NR }, () => ({ x: 0, y: 0, age: -1 }));
	const RP = new Float32Array(NR * 3);
	let rippleN = 0, lastMoveRipple = 0, hintGone = false;
	const st = { x: 0.5, y: 0.25, tx: 0.5, ty: 0.25, e: 0 };
	const C = winter
		? (dark
			? { far: "#233a60", farTree: "#1b3052", near: "#0b1424", tree: "#070e1b", snow: "#b9cde8", snowFar: "#6f88ae" }
			: { far: "#c3d4e2", farTree: "#a9bfd0", near: "#8ea8bd", tree: "#718ca4", snow: "#ffffff", snowFar: "#f0f6fa" })
		: dark
			? { far: "#16294a", farTree: "#101f3a", near: "#070d1a", tree: "#050a14" }
			: { far: "#c9dae5", farTree: "#bcd1dd", near: "#a9c3cf", tree: "#9bb8c6" };

	function paintSil(g, sc, pass = -1) {
		// winter: pass 0 paints everything in snow, pass 1 repaints the bodies a little lower, so only the upward-facing edges stay white
		g.save(); g.scale(sc, sc);
		const yh = H * YH, r = rng(318);
		const colOf = (k, snowK) => (pass === 0 ? C[snowK] : C[k]);
		if (pass === 1) g.translate(0, 2.2);
		const far = ridgeFn(11, { amp: 15, f: 0.007 });
		g.fillStyle = colOf("far", "snowFar");
		g.beginPath(); g.moveTo(0, yh + 1);
		for (let x = 0; x <= W; x += 4) g.lineTo(x, yh - 6 - Math.max(0, far(x) + 8));
		g.lineTo(W, yh + 1); g.fill();
		g.fillStyle = colOf("farTree", "snowFar");
		for (let x = 0; x < W; x += 6 + r() * 8) spruce(g, x, yh - 6 - Math.max(0, far(x) + 8) + 2, 6 + r() * 6, 2.4 + r() * 1.4);
		// near shores: left hill high, right hill a little lower
		const shore = (side, reach, amp, seed) => {
			const f = ridgeFn(seed, { amp: amp * 0.18, f: 0.012 });
			const hgt = (x) => { const t = side < 0 ? x / reach : (W - x) / reach; return t >= 1 ? 0 : amp * Math.pow(1 - t, 1.5) + f(x) * (1 - t); };
			const x0 = side < 0 ? 0 : W - reach, x1 = side < 0 ? reach : W;
			g.fillStyle = colOf("near", "snow");
			g.beginPath(); g.moveTo(x0, yh + 1);
			for (let x = x0; x <= x1; x += 3) g.lineTo(x, yh - Math.max(0, hgt(x)) + (x === x0 ? 0 : 0));
			g.lineTo(x1, yh + 1); g.fill();
			g.fillStyle = colOf("tree", "snow");
			for (let x = x0; x < x1; x += 7 + r() * 8) {
				const h0 = hgt(x); if (h0 < 6) continue;
				const hh = 16 + r() * 30 * Math.min(1, h0 / 40);
				spruce(g, x, yh - h0 + 4, hh, hh * 0.3, (r() - 0.5) * 2);
			}
		};
		shore(-1, W * 0.3, 52, 21); shore(1, W * 0.28, 44, 33);
		g.restore();
	}
	function build() {
		const dpr = stage.dpr;
		const gS = sizeCanvas(cS, W, H, dpr); gS.setTransform(1, 0, 0, 1, 0, 0);
		gS.save(); gS.scale(dpr, dpr); gS.restore();
		// paint at dpr
		gS.clearRect(0, 0, cS.width, cS.height);
		gS.save(); gS.scale(dpr, dpr); paintSilNo(gS); gS.restore();
		const tex = document.createElement("canvas");
		const tg = sizeCanvas(tex, W, H, 0.5);
		if (winter) { paintSil(tg, 0.5, 0); paintSil(tg, 0.5, 1); } else paintSil(tg, 0.5);
		// treeline heights (footer px) per 2px column, from the silhouette alpha: where settling snow lands
		try {
			const id = tg.getImageData(0, 0, tex.width, Math.round(H * YH * 0.5) + 4).data, tw = tex.width, th = id.length / 4 / tw;
			surf = new Float32Array(Math.ceil(W / 2) + 2); pile = new Float32Array(surf.length);
			for (let i = 0; i < surf.length; i++) {
				const px = Math.min(tw - 1, i);
				let y = th;
				for (let yy = 0; yy < th; yy++) if (id[(yy * tw + px) * 4 + 3] > 40) { y = yy; break; }
				surf[i] = y * 2;
			}
		} catch { surf = null; }
		hooks.onBuild?.(api);
		gl.setTexture("S", tex, 0);
	}
	const paintSilNo = (g) => { if (winter) { paintSil(g, 1, 0); paintSil(g, 1, 1); } else paintSil(g, 1); };

	function spawnRipple(x, y, age = 0) {
		const r = ripples[rippleN++ % NR]; r.x = x / W; r.y = y / H; r.age = age;
		if (reducedMotion) kick();
	}
	let kickRaf = 0;
	function kick() { // reduced motion: animate only the ripples the user made
		if (kickRaf) return;
		const go = () => { kickRaf = 0; draw(7, 1 / 30); if (ripples.some((r) => r.age >= 0)) kickRaf = requestAnimationFrame(go); };
		kickRaf = requestAnimationFrame(go);
	}

	/* ---- loon ---- */
	const lr = rng(251);
	const loon = { on: false, x: 0, y: 0, age: 0, life: 0, v: 9, alpha: 0, next: 12, side: 1, ripT: 0, dive: 0 };
	function spawnLoon() {
		const left = lr() < 0.5;
		loon.on = true; loon.age = 0; loon.life = 34 + lr() * 14;
		loon.x = W * (left ? 0.1 + lr() * 0.18 : 0.66 + lr() * 0.18);
		loon.y = H * (YH + 0.15 + lr() * 0.04);
		loon.v = (left ? 1 : -1) * (6 + lr() * 4); loon.dir = loon.v >= 0 ? 1 : -1;
		loon.ripT = 0;
		spawnRipple(loon.x, loon.y, 0.6);
	}
	const onLoonEvt = () => { if (!loon.on && !winter) spawnLoon(); loop.wake(); };
	addEventListener("ra-valley-loon", onLoonEvt);
	function updateLoon(dt, t) {
		if (!loon.on) {
			loon.next -= dt;
			if (loon.next <= 0 && !reducedMotion && !winter) spawnLoon();
			return;
		}
		loon.age += dt;
		const diving = loon.age > loon.life - 2.4;
		loon.x += loon.v * dt * (diving ? 0.2 : 1);
		loon.ripT += dt;
		if (loon.ripT > 2.6 && !diving) { loon.ripT = 0; spawnRipple(loon.x - loon.dir * 18, loon.y, 0.8); }
		loon.alpha = smooth(0, 2.2, loon.age) * (1 - smooth(loon.life - 2.2, loon.life, loon.age));
		loon.dive = smooth(loon.life - 2.6, loon.life, loon.age);
		if (loon.age >= loon.life) { loon.on = false; loon.next = 55 + lr() * 60; spawnRipple(loon.x, loon.y, 0.4); }
	}
	function drawLoonScene(g, t) {
		if (!loon.on || loon.alpha <= 0.01) return;
		const y = loon.y + Math.sin(t * 1.1) * 0.5 + loon.dive * 5, sc = 0.9;
		const head = Math.sin(t * 0.35) * 0.5 + (loon.dive * 2 - 0.2);
		// wake: gentle V behind the stern
		g.save();
		g.globalAlpha = loon.alpha * (dark ? 0.35 : 0.4);
		g.strokeStyle = dark ? "rgba(150,210,215,.9)" : "rgba(90,120,150,.8)"; g.lineWidth = 0.7;
		const bx = loon.x - loon.dir * 22 * sc;
		for (const s of [-1, 1]) { g.beginPath(); g.moveTo(bx, y + 0.5); g.lineTo(bx - loon.dir * 46, y + s * 5.5); g.stroke(); }
		g.beginPath(); g.ellipse(loon.x, y + 0.6, 27 * sc, 2.4, 0, 0, TAU); g.stroke();
		g.restore();
		// reflection
		g.save(); g.globalAlpha = loon.alpha * (dark ? 0.28 : 0.2); g.translate(0, 2 * y + 1); g.scale(1, -1);
		drawLoon(g, loon.x, y, sc, { dark, head, dir: loon.dir });
		g.restore();
		g.save(); g.globalAlpha = loon.alpha;
		drawLoon(g, loon.x, y, sc, { dark, head, dir: loon.dir });
		g.restore();
	}

	function addCrack(x, y) {
		const r = rng((x * 7 + y * 13) | 0), lines = [];
		const n = 5 + ((r() * 3) | 0);
		for (let i = 0; i < n; i++) {
			const a = (i / n) * TAU + r() * 0.7; let px = 0, py = 0; const seg = [];
			const len = 14 + r() * 34, k = 3 + ((r() * 2) | 0);
			for (let j = 0; j < k; j++) { const aa = a + (r() - 0.5) * 0.7; px += Math.cos(aa) * len / k; py += Math.sin(aa) * len / k * 0.32; seg.push([px, py]); }
			lines.push(seg);
		}
		cracks.push({ x, y, lines, age: 0 }); if (cracks.length > 5) cracks.shift();
	}
	function drawCracks(g) {
		g.lineWidth = 0.7; g.lineCap = "round";
		for (const c of cracks) {
			c.age += 1 / 24;
			const grow = Math.min(1, c.age / 0.6);
			g.strokeStyle = dark ? "rgba(210,232,255,.4)" : "rgba(95,125,155,.5)";
			for (const seg of c.lines) {
				g.beginPath(); g.moveTo(c.x, c.y);
				const n = Math.max(1, Math.ceil(seg.length * grow));
				for (let i = 0; i < n; i++) g.lineTo(c.x + seg[i][0], c.y + seg[i][1]);
				g.stroke();
			}
		}
	}
	function drawOverlay(t, dt) {
		const g = octx, dpr = stage.dpr;
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, W, H);
		if (dark) {
			for (const s of stars) {
				const tw = 0.7 + 0.3 * Math.sin(t * s.f + s.p);
				g.fillStyle = `rgba(228,238,255,${(s.b * tw).toFixed(3)})`;
				g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
				g.fillStyle = `rgba(190,220,235,${(s.b * tw * 0.22).toFixed(3)})`;
				g.beginPath(); g.arc(s.x + Math.sin(t * 0.9 + s.p) * 0.8, H * YH * 2 - s.y, s.r * 0.9, 0, TAU); g.fill();
			}
		}
		if (birds && !winter) { birds.update(dt); birds.draw(g, dark ? "rgba(205,220,242,.72)" : "rgba(45,60,85,.6)"); }
		updateLoon(dt, t);
		drawLoonScene(g, t);
		if (winter) drawCracks(g);
		hooks.overlay?.(g, t, dt, api);
	}

	function draw(t, dt) {
		const a = reducedMotion ? 1 : 1 - Math.exp(-dt * 4);
		const ox = st.x, oy = st.y;
		st.x += (st.tx - st.x) * a; st.y += (st.ty - st.y) * a;
		st.e += (Math.min(1, Math.hypot(st.x - ox, st.y - oy) / Math.max(dt, 0.001) / 1.2) - st.e) * (1 - Math.exp(-dt * 2));
		for (let i = 0; i < NR; i++) {
			const r = ripples[i];
			if (r.age >= 0) { r.age += dt; if (r.age > 6) r.age = -1; }
			RP[i * 3] = r.x; RP[i * 3 + 1] = r.y; RP[i * 3 + 2] = r.age;
		}
		const T = t * (0.8 + st.e) + 80;
		gl.draw({ T, DK: dark ? 1 : 0, AMP: (dark ? 0.8 : 1.0) * (winter ? 0.8 : 1), WN: winter ? 1 : 0, E: st.e, M: [st.x, clamp(st.y, 0.05, YH - 0.1)], YH, RP,
			BASE: 0.24, HGT: 0.13, WOB: 0.55, LS: 0.06, RAYS: 0.75, WX: 3.2, WAVE: 0.4, PULL: 0.35, LOWF: 0.03 });
		mist.draw({ T, DK: dark ? 1 : 0, YH, AMP: 1, E: 0, M: [0.5, 0.5] });
		if (octx) drawOverlay(t, dt);
	}
	const loop = createLoop({ host, fps: 24, reduced: reducedMotion, draw });
	const ptr = pointerTracker(host, (s, kind) => {
		if (kind === "out") { st.tx = 0.5; st.ty = 0.25; }
		else if (kind === "move") {
			st.tx = clamp(s.x / W, -0.2, 1.2); st.ty = clamp(s.y / H, -0.3, 1.3);
			const now = performance.now();
			if (loop.visible && s.speed > 700 && s.y > H * (YH + 0.04) && s.y < H && s.x > 0 && s.x < W && now - lastMoveRipple > 260) { lastMoveRipple = now; spawnRipple(s.x, s.y, 0.7); }
		} else if (kind === "down") {
			const e = arguments[2];
		}
		loop.wake();
	});
	// click on the water: ripple (window listener; never blocks the page)
	const onDown = (e) => {
		if (e.button !== 0 || !loop.visible) return;
		const r = host.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		if (x < 0 || x > W || y < H * (YH + 0.03) || y > H) return;
		spawnRipple(x, y, 0);
		if (winter) addCrack(x, y);
		if (!hintGone) { hintGone = true; hint.classList.add("is-gone"); }
		loop.wake();
	};
	addEventListener("pointerdown", onDown, { passive: true });

	let cancel = () => {};
	stage.onSize = (s) => {
		W = s.w; H = s.h;
		gl.resize(W, H); mist.resize(W, H);
		octx = sizeCanvas(cO, W, H, stage.dpr);
		const r = rng(77); stars = [];
		for (let i = 0; i < Math.round(W / 14); i++) stars.push({ x: r() * W, y: Math.pow(r(), 1.4) * H * 0.4, r: r() < 0.07 ? 1.15 : 0.5 + r() * 0.4, b: 0.25 + r() * 0.55, f: 0.4 + r() * 1.2, p: r() * TAU });
		birds = new Birds({ seed: 318, W, H, band: [0.1, 0.34], speed: [12, 20], gap: [9, 22], size: [3.6, 5.6] });
		cancel(); cancel = idle(() => { build(); loop.start(); loop.redraw(); });
	};
	stage.layout();
	api.destroy = () => {
		cancel(); loop.destroy(); ptr.destroy(); cancelAnimationFrame(kickRaf);
		removeEventListener("pointerdown", onDown); removeEventListener("ra-valley-loon", onLoonEvt);
		gl.destroy(); mist.destroy(); hint.remove(); stage.destroy(); hooks.destroy?.();
	};
	return api;
}
