// _vs2/footer.js: the Lake Stars footer, halfway between #362 and #363. A glassy low horizon, background-toned ridges that
// rise toward the sides, the aurora mirrored in a still lake, and per-theme weather (mist / fog bank / shimmer / snow / drizzle / dusk).
// Optional dock (themes/_dock/dock.js) and water sim (themes/_water/water.js) are loaded dynamically and skipped if missing.
import { GL, GLSL as GLSL0, AURORA_FN, footerStage, createLoop, pointerTracker, mkCanvas, sizeCanvas, isDark, idle, rng, clamp, TAU, ridgeFn } from "../_refined-e/kit.js";

// vs3: light-mode palette is data. pal() and glow() read per-theme uniforms; dark mode is byte-for-byte #374's.
const GLSL = GLSL0
	.replace("vec3 pal(float t){", "vec3 palD(float t){")
	.replace("// glow accumulation", "uniform vec3 LP0,LP1,LP2,LP3,LTN;\nvec3 pal(float t){ if(DK>.5) return palD(t); vec3 c=mix(LP0,LP1,smoothstep(0.,.4,t)); c=mix(c,LP2,smoothstep(.35,.85,t)); return mix(c,LP3,smoothstep(.8,1.1,t)); }\n// glow accumulation")
	.replace("vec3(.5,.74,.8)", "LTN");
if (!GLSL.includes("LTN;")) throw new Error("vs3: GLSL patch failed");
const H0 = 300;        // #347's footer height; the aurora keeps its pixel scale
const SPD = 0.04;      // clock speed vs #347's ~0.8: about 20x slower (Josh: lake far too fast)
const FPS = 15;

const FS = GLSL + AURORA_FN + `
uniform sampler2D S;uniform float YH,HF,OFF,SC,RAMP,NEAR,DIST,REFL,WARM,DIM;
uniform vec3 LS0,LS1,LS2,LW0,LW1;
vec3 skyc(float y){float t=clamp(y/YH,0.,1.);return t<.55?mix(LS0,LS1,t/.55):mix(LS1,LS2,(t-.55)/.45);}
vec2 ap(vec2 p){return vec2(p.x,(p.y*HF-OFF)/(H0*SC));}
float ramp(float y){float t=clamp(y*HF/RAMP,0.,1.);return t*t*(3.-2.*t);}
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 bool dk=DK>.5;
 vec4 o=vec4(0.);
 float yhp=YH*HF;
 vec3 warmc=dk?vec3(.95,.45,.4):vec3(1.,.7,.55);
 if(uv.y<YH){
  vec4 A=aurora(ap(uv),1.);
  float k=AMP*ramp(uv.y)*(1.-smoothstep(yhp-NEAR,yhp,uv.y*HF));
  o=glow(A.rgb*k,A.a*k,1.3);
  float hz=exp(-(YH-uv.y)*HF/(.1*H0*SC))*(.55+.45*vn(vec2(uv.x*2.5,T*.02)));
  o=over(vec4((dk?vec3(.1,.3,.34):vec3(.7,.84,.88))*hz*(dk?.22:.3),hz*(dk?.12:.25)),o);
  float wz=exp(-(YH-uv.y)*HF/(.22*H0*SC))*WARM;
  o=over(vec4(warmc*wz*(dk?.2:.3),wz*(dk?.16:.26)),o);
  o*=ramp(uv.y);
  if(!dk){float sa=ramp(uv.y)*.96;o=over(o,vec4(skyc(uv.y)*sa,sa));}
 }else{
  float d=uv.y-YH;
  float dp=d*HF;
  float depth=smoothstep(0.,.5,d/(1.-YH));
  vec2 off=vec2((vn(vec2(uv.x*62.,uv.y*HF/2.1+T*.5))-.5)*.0022*DIST*(.3+dp/H0*3.),(vn(vec2(uv.x*33.+4.,uv.y*HF/1.5-T*.4))-.5)*.002*DIST/(HF/H0)*(.2+dp/H0*3.));
  // wind streaks: long, thin, slow bands stretch the mirror sideways
  off.x+=(vn(vec2(uv.x*11.+T*.2,uv.y*HF/.8))-.5)*.003*max(0.,DIST-1.)*(.2+dp/H0*2.);
  vec2 pr=vec2(uv.x+off.x,YH-d+off.y);
  float refl=mix(.85,.05,smoothstep(0.,.32*H0*SC,dp))*ramp(pr.y)*REFL;
  vec4 A=aurora(ap(pr),1.);
  float k=AMP*refl*(1.-smoothstep(yhp-NEAR,yhp,pr.y*HF));
  o=glow(A.rgb*k*.9,A.a*k*.9,1.3);
  vec4 sl=texture2D(S,vec2(pr.x,pr.y));
  o=over(sl*(dk?.85:.55)*mix(1.,.5,depth)*mix(1.,REFL,.6),o);
  float wz=exp(-(YH-pr.y)*HF/(.22*H0*SC))*WARM*refl*.8;
  o=over(vec4(warmc*wz*(dk?.2:.3),wz*(dk?.16:.26)),o);
  float shn=vn(vec2(uv.x*40.,uv.y*HF*.8+T*.3))*(1.-depth)*.5;
  vec3 gl2=dk?vec3(.4,.8,.8):vec3(.45,.6,.7);
  float ga=shn*.05*(dk?1.:.7)*(1.+DIST*.35);
  o=over(vec4(gl2*ga,ga*(dk?.6:.5)),o);
  float ln=exp(-pow(dp/1.5,2.))*(dk?.18:.25);
  o=over(vec4((dk?vec3(.35,.6,.62):vec3(.55,.7,.78))*ln,ln),o);
  float wa=(1.-depth)*(dk?.1:.18);
  o=over(vec4((dk?vec3(.05,.1,.17):vec3(.7,.82,.88))*wa,wa),o);
 }
 if(!dk&&uv.y>=YH){
  float d=uv.y-YH;float wd=smoothstep(0.,.62,d/(1.-YH));
  vec3 wc=mix(LW0,LW1,wd);
  wc=mix(wc,skyc(YH-d*.9),.22*(1.-wd));
  o=over(o,vec4(wc*.97,.97));
 }
 o*=1.-DIM*.0;
 gl_FragColor=dither(o);
}`.replace(/H0/g, H0.toFixed(1));

// weather layer. KIND: 1 low mist, 2 fog bank, 3 mist pooled around the pilings, 4 fog thickening toward the dock's far end
const MIST_FS = GLSL + `
uniform float YH,SG,KIND,STR;
uniform vec3 MCL;
uniform vec3 DKP; // dock: x (0..1), waterline y (0..1), top y (0..1)
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 float x=uv.x*3.4;
 vec2 q=vec2(x*1.3+T*.012,uv.y*4.6-T*.003);
 q+=.6*vec2(fbm3(q*.8+2.),fbm3(q*.8+8.));
 float n=smoothstep(.34,.66,fbm3(q));
 float n2=smoothstep(.4,.7,fbm3(vec2(x*2.1-T*.02,uv.y*7.+3.)));
 float dy=uv.y-(YH+.01);
 float a=0.;
 if(KIND<1.5||KIND>2.5){
  float env=exp(-pow(dy/SG,2.))*(.55+.6*vn(vec2(x*.8,9.)));
  a=(n*.8+n2*.35)*env;
  if(KIND>2.5&&KIND<3.5){ // pooled: extra mist hugging the piling bases
   float px=(uv.x-DKP.x)*R.x/R.y*0.0+(uv.x-DKP.x);
   float pool=exp(-pow(px/.13,2.)-pow((uv.y-DKP.y)/.05,2.));
   a+=pool*(.35+.65*n)*.9;
  }
  if(KIND>3.5){ // far-end fog: thickest where the dock is farthest (its top), fading toward the viewer
   float px=uv.x-DKP.x;
   float ft=clamp((DKP.y-uv.y)/max(.001,DKP.y-DKP.z),0.,1.);
   float far=exp(-pow(px/.2,2.))*smoothstep(1.05,.0,1.-ft)*exp(-pow((uv.y-(DKP.z+.02))/.1,2.));
   a+=far*(.5+.5*n)*1.1+exp(-pow((uv.y-DKP.z)/.17,2.))*exp(-pow(px/.26,2.))*.35;
  }
 }else{
  // fog bank: a slow, rolling wall along the far shore, thickest toward one side, thinning down over the water
  float up=exp(-pow(dy/(SG*.8),2.)),down=exp(-max(dy,0.)/(SG*2.4));
  float env=dy<0.?up:down;
  float roll=.5+.5*sin(uv.x*3.-T*.07+vn(vec2(uv.x*2.,3.))*4.);
  a=(n*.75+n2*.5)*env*(.55+.7*roll);
  a=min(a*1.25,.9);
 }
 a*=STR;
 float g=.5+.5*sin(uv.x*5.+T*.03);
 vec3 mc=DK>.5?mix(vec3(.3,.5,.62),vec3(.28,.62,.55),g):MCL;
 a*=DK>.5?.85:1.0;
 a=clamp(a,0.,.95);
 gl_FragColor=dither(vec4(mc*a*(DK>.5?.75:1.),a));
}`;

const PAL = (dark, warm, L) => dark
	? (warm
		? { far: "#171a30", mid: "#151832", near: "#12152c", nearest: "#0f1226" }
		: { far: "#111c33", mid: "#101a30", near: "#0f192d", nearest: "#0e172a" })
	: L.ridges;
const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

/* per-theme footer config:  weather: none | mist | fogbank | shimmer | snow | drizzle | dusk
   dock: null | { side, scale, seed, water }  (water: use the fancy water sim around the pilings, with weather calm|drizzle|wind) */
export function vsFooter(root, { reducedMotion, seed = 366, weather = "none", dock = null, mult = 2.25, light }) {
	const dark = isDark();
	const stage = footerStage(root, { height: Math.round(H0 * mult) });
	if (!stage) return null;
	const { host } = stage;
	const YH = 0.6;
	const W_ = { none: {}, mist: { kind: 1, str: 1, sg: 0.1 }, fogbank: { kind: 2, str: 1, sg: 0.12 }, shimmer: { dist: 2.8 }, snow: { refl: 0.72 }, drizzle: { dist: 1.8, refl: 0.85 }, dusk: { dist: 2.2, warm: 1, amp: 0.8 } }[weather] || {};
	if (dock && weather === "mist") W_.kind = 3;
	if (dock && weather === "fog") { W_.kind = 4; W_.str = 1; W_.sg = 0.1; }
	if (!dock && weather === "fog") { W_.kind = 4; W_.str = 1; W_.sg = 0.1; }
	if (dock && weather === "drizzle") { W_.dist = 1.8; W_.refl = 0.85; }
	const gl = new GL(host, FS, { scale: 0.5 });
	const cS = mkCanvas(host);
	const cO = mkCanvas(host);
	const mist = W_.kind ? new GL(host, MIST_FS, { scale: 0.3 }) : null;
	const cW = weather === "snow" || weather === "drizzle" ? mkCanvas(host) : null;
	const C = PAL(dark, !!W_.warm, light);
	const LU = { LS0: hex3(light.sky[0]), LS1: hex3(light.sky[1]), LS2: hex3(light.sky[2]), LW0: hex3(light.water[0]), LW1: hex3(light.water[1]), LP0: hex3(light.aurora[0]), LP1: hex3(light.aurora[1]), LP2: hex3(light.aurora[2]), LP3: hex3(light.aurora[3]), LTN: light.tint || [1, 1, 1] };
	let W = 1, H = 1, octx = null, wctx = null, stars = [], flakes = [], dk = null, dockX = 0, dockY = 0, water = null, reflC = null, reflAt = 0;
	const st = { x: 0.5, y: 0.25, tx: 0.5, ty: 0.25 };

	/* ---------- ridges: background-toned, fewer and lower in the centre, taller with more layers toward the sides ---------- */
	const poly = (g, x0, x1, base, fn, step = 4) => {
		g.beginPath(); g.moveTo(x0, base + 1);
		for (let x = x0; x <= x1 + step; x += step) g.lineTo(x, base - fn(x));
		g.lineTo(x1 + step, base + 1); g.closePath(); g.fill();
	};
	function paintSil(g, sc) {
		g.save(); g.scale(sc, sc);
		const yh = H * YH, k = H / H0;
		const side = (x) => Math.pow(Math.abs((2 * x) / W - 1), 1.35);
		// layer: noise, lift, how much of it survives in the centre, and a centre threshold below which it vanishes
		const layers = [
			{ c: C.far, fn: ridgeFn(5, { amp: 20 * k, f: 0.0034 }), lift: 62 * k, mid: 0.1, cut: 0 },
			{ c: C.mid, fn: ridgeFn(9, { amp: 20 * k, f: 0.0046 }), lift: 48 * k, mid: 0.0, cut: 0.25 },
			{ c: C.near, fn: ridgeFn(14, { amp: 15 * k, f: 0.0062 }), lift: 34 * k, mid: 0.0, cut: 0.42 },
			{ c: C.nearest, fn: ridgeFn(23, { amp: 10 * k, f: 0.0085 }), lift: 22 * k, mid: 0.0, cut: 0.6 },
		];
		for (const L of layers) {
			g.fillStyle = L.c;
			poly(g, 0, W, yh, (x) => {
				const s = side(x);
				const w = L.mid + (1 - L.mid) * Math.max(0, (s - L.cut) / (1 - L.cut));
				return Math.max(0, (L.fn(x) * (0.5 + 0.5 * s) + L.lift) * w);
			}, 5);
		}
		g.restore();
	}
	function build() {
		const dpr = stage.dpr;
		const gS = sizeCanvas(cS, W, H, dpr);
		gS.clearRect(0, 0, cS.width, cS.height);
		gS.save(); gS.scale(dpr, dpr); paintSil(gS, 1); gS.restore();
		const tex = document.createElement("canvas");
		const tg = sizeCanvas(tex, W, H, 0.5);
		paintSil(tg, 0.5);
		gl.setTexture("S", tex, 0);
	}

	/* ---------- overlay: dim stars + their reflection, and the dock ---------- */
	const ramp = (y) => { const t = clamp(y / (H * YH * 0.8)); return t * t * (3 - 2 * t); };
	function drawOverlay(t) {
		const g = octx, dpr = stage.dpr;
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, W, H);
		if (dark) {
			for (const s of stars) {
				const tw = 0.7 + 0.3 * Math.sin(t * SPD * s.f + s.p);
				const a = s.b * tw * ramp(s.y);
				g.fillStyle = `rgba(228,238,255,${a.toFixed(3)})`;
				g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
				if (!water) {
					g.fillStyle = `rgba(190,220,235,${(a * 0.22 * (W_.refl || 1)).toFixed(3)})`;
					g.beginPath(); g.arc(s.x + Math.sin(t * SPD * 0.9 + s.p) * 0.8, H * YH * 2 - s.y, s.r * 0.9, 0, TAU); g.fill();
				}
			}
		}
		if (dk) { g.globalAlpha = dark ? 0.82 : 0.9; g.drawImage(dk.canvas, dockX, dockY, dk.width, dk.height); g.globalAlpha = 1; }
	}

	/* ---------- weather particles ---------- */
	function seedWeather() {
		const r = rng(seed + 11);
		flakes = [];
		const n = weather === "snow" ? Math.round((W * H) / 14000) : Math.round((W * H) / 5200);
		for (let i = 0; i < n; i++) flakes.push({ x: r() * W, y: r() * H * 0.96, v: 0.6 + r() * 0.8, s: 0.6 + r() * 1.2, p: r() * TAU, l: 5 + r() * 7 });
	}
	function drawWeather(t, dt) {
		const g = wctx, dpr = stage.dpr;
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, W, H);
		const wy = H * YH;
		if (weather === "snow") {
			for (const f of flakes) {
				f.y += f.v * 7 * dt; f.x += Math.sin(t * 0.25 * SPD * 8 + f.p) * 3 * dt + 1.2 * dt;
				if (f.y > H * 0.97) { f.y = -4; f.x = (f.x * 7.31) % W; }
				if (f.x > W + 4) f.x = -4;
				const fade = f.y > H * 0.88 ? clamp((H * 0.97 - f.y) / (H * 0.09)) : 1;
				const a = (dark ? 0.55 : 0.5) * fade * clamp(f.y / 40);
				g.fillStyle = dark ? `rgba(235,242,255,${a.toFixed(3)})` : `rgba(120,150,190,${(a * 0.85).toFixed(3)})`;
				g.beginPath(); g.arc(f.x, f.y, f.s, 0, TAU); g.fill();
			}
		} else {
			g.lineWidth = 0.8; g.lineCap = "round";
			for (const f of flakes) {
				f.y += f.v * 46 * dt; f.x += 7 * dt;
				if (f.y > H) { f.y = -12; f.x = (f.x * 5.17 + 13) % W; }
				if (f.x > W) f.x = 0;
				const a = (dark ? 0.2 : 0.22) * f.v * clamp(f.y / 60) * (f.y > wy ? clamp((H - f.y) / (H - wy) * 1.6) : 1);
				g.strokeStyle = dark ? `rgba(190,215,240,${a.toFixed(3)})` : `rgba(90,120,160,${a.toFixed(3)})`;
				g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x + f.l * 0.16, f.y + f.l); g.stroke();
			}
		}
	}

	/* ---------- optional water sim (dock themes with water) ---------- */
	function refreshReflection(now) {
		if (!water || !reflC || now - reflAt < 85) return;
		reflAt = now;
		const g = reflC.getContext("2d"), wy = Math.round(H * YH);
		g.fillStyle = dark ? "#0b1220" : "#fdffff"; g.fillRect(0, 0, reflC.width, reflC.height); // opaque: the sim samples it as the lake's colour
		// the still lake: sky, aurora, mirrored ridges (the GL output below the horizon) with the dock's own reflection
		g.drawImage(gl.c, 0, gl.c.height * YH, gl.c.width, gl.c.height * (1 - YH), 0, 0, reflC.width, reflC.height);
		const rf = dk?.reflectionCanvas || dk?.canvas;
		if (rf) g.drawImage(rf, dockX * (reflC.width / W), (dockY - wy) * (reflC.height / (H - wy)), dk.width * (reflC.width / W), dk.height * (reflC.height / (H - wy)));
		water.setReflection(reflC);
	}

	function draw(t, dt) {
		const a = reducedMotion ? 1 : 1 - Math.exp(-dt * 0.5);
		st.x += (st.tx - st.x) * a; st.y += (st.ty - st.y) * a;
		const T = t * SPD + 80;
		gl.draw({ T, DK: dark ? 1 : 0, AMP: (dark ? 0.8 : 1.0) * (W_.amp || 1), E: 0, M: [st.x, clamp(st.y, 0.05, YH - 0.1)], YH, HF: H,
			OFF: Math.max(0, (H * YH - 150) * 0.6), SC: 1 + (H / H0 - 1) * 0.3, RAMP: H * YH * 0.8, NEAR: 42 * (1 + (H / H0 - 1) * 0.3),
			DIST: W_.dist || 1, REFL: W_.refl || 1, WARM: W_.warm || 0, DIM: 0,
			...LU, BASE: 0.24, HGT: 0.13, WOB: 0.55, LS: 0.06, RAYS: 0.75, WX: 3.2, WAVE: 0.4, PULL: 0.2, LOWF: 0.03 });
		if (mist) {
			const dyF = dk ? (dockY + dk.waterlineY) / H : 0.9, topF = dk ? dockY / H : 0.8;
			mist.draw({ T, DK: dark ? 1 : 0, YH, SG: ((W_.sg || 0.1) * H0 * (1 + (H / H0 - 1) * 0.5)) / H, KIND: W_.kind, STR: W_.str || 1, DKP: [dk ? (dockX + dk.anchorX) / W : 0.5, dyF, dk ? topF : -1], MCL: hex3(light.mist), AMP: 1, E: 0, M: [0.5, 0.5] });
		}
		if (octx) drawOverlay(t);
		if (wctx) drawWeather(t, reducedMotion ? 0 : dt);
		if (water) { refreshReflection(performance.now()); }
	}
	const loop = createLoop({ host, fps: FPS, reduced: reducedMotion, draw });
	const ptr = pointerTracker(host, (s, kind) => {
		if (kind === "out") { st.tx = 0.5; st.ty = 0.25; }
		else if (kind === "move") { st.tx = clamp(s.x / W, -0.2, 1.2); st.ty = clamp(s.y / H, -0.3, 1.3); }
		else return;
		loop.wake();
	});

	/* ---------- dock + water modules ---------- */
	let dead = false, cancel = () => {};
	function placeDock() {
		if (!dk) return;
		const sideX = { left: 0.15, right: 0.85, center: 0.5 }[dock.side || "center"];
		dockX = Math.round(W * sideX - dk.anchorX);
		dockY = H - dk.height;
	}
	async function loadModules() {
		if (!dock) return;
		try {
			const { createDock } = await import("../_dock/dock.js");
			if (dead) return;
			const o = { dark, scale: dock.scale || 1, side: dock.side || "center", seed: dock.seed || seed };
			// water-sim themes: the dock is drawn without its baked reflection; that reflection feeds the sim instead
			dk = createDock(dock.water ? { ...o, reflection: false } : o);
		} catch { dk = null; }
		if (!dk || dead) return;
		placeDock();
		if (dock.water) await startWater();
		loop.redraw();
	}
	async function startWater() {
		try {
			const { createWaterSim } = await import("../_water/water.js");
			if (dead) return;
			const wy = Math.round(H * YH), wh = H - wy;
			const pil = (dk.pilings || []).map((p) => ({ x: dockX + p.x, y: dockY + p.y - wy, r: p.r }));
			reflC = document.createElement("canvas"); reflC.width = Math.round(W * 0.5); reflC.height = Math.round(wh * 0.5);
			water = createWaterSim({ width: W, height: wh, dark, reduced: reducedMotion, obstacles: pil, reflection: reflC, weather: dock.water });
			water.canvas.style.cssText = `position:absolute;left:0;top:${wy}px;width:${W}px;height:${wh}px;pointer-events:none;display:block`;
			cS.before(water.canvas);
			reflAt = 0;
			if (loop.visible) water.start();
		} catch { water = null; }
	}
	const io = new IntersectionObserver((es) => { if (!water) return; if (es.some((e) => e.isIntersecting)) water.start(); else water.stop(); });
	io.observe(host);

	stage.onSize = (s) => {
		W = s.w; H = s.h;
		gl.resize(W, H); mist?.resize(W, H);
		octx = sizeCanvas(cO, W, H, stage.dpr);
		if (cW) wctx = sizeCanvas(cW, W, H, 1);
		if (cW) seedWeather();
		const r = rng(77); stars = [];
		for (let i = 0; i < Math.round(W * H / 4200); i++) stars.push({ x: r() * W, y: Math.pow(r(), 1.2) * H * YH * 0.92, r: r() < 0.07 ? 1.15 : 0.5 + r() * 0.4, b: 0.2 + r() * 0.45, f: 0.4 + r() * 1.2, p: r() * TAU });
		placeDock();
		cancel(); cancel = idle(() => { build(); loop.start(); loop.redraw(); if (dock && !dk && !dead && !s.loading) { s.loading = true; loadModules(); } });
	};
	stage.layout();
	return { stage, destroy() { dead = true; cancel(); io.disconnect(); water?.destroy?.(); water?.canvas?.remove(); loop.destroy(); ptr.destroy(); gl.destroy(); mist?.destroy(); stage.destroy(); } };
}
