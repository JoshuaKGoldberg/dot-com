// _vs/footer.js: #347's valley footer, stilled. No ripples, no animals; every motion ~6-8x slower; taller; scene-parameterized.
//   scene: "pines" | "ridges" | "horizon" | "peaks" | "islands"
import { GL, GLSL, AURORA_FN, footerStage, createLoop, pointerTracker, mkCanvas, sizeCanvas, isDark, idle, rng, clamp, TAU, ridgeFn, spruce } from "../_refined-e/kit.js";

const H0 = 300;        // #347's footer height; the aurora keeps its pixel scale
const SPD = 0.13;      // clock speed vs #347's ~0.8: about 6x slower
const FPS = 15;

const FS = GLSL + AURORA_FN + `
uniform sampler2D S;uniform float YH,HF,OFF,SC,RAMP,NEAR;
// sky height (px) -> aurora coordinate: keeps #347's curtain size, scaled up a little in tall footers
vec2 ap(vec2 p){return vec2(p.x,(p.y*HF-OFF)/(H0*SC));}
float ramp(float y){float t=clamp(y*HF/RAMP,0.,1.);return t*t*(3.-2.*t);}
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 bool dk=DK>.5;
 vec4 o=vec4(0.);
 float yhp=YH*HF;
 if(uv.y<YH){
  vec4 A=aurora(ap(uv),1.);
  float k=AMP*ramp(uv.y)*(1.-smoothstep(yhp-NEAR,yhp,uv.y*HF));
  o=glow(A.rgb*k,A.a*k,1.3);
  float hz=exp(-(YH-uv.y)*HF/(.1*H0*SC))*(.55+.45*vn(vec2(uv.x*2.5,T*.02)));
  o=over(vec4((dk?vec3(.1,.3,.34):vec3(.7,.84,.88))*hz*(dk?.22:.3),hz*(dk?.12:.25)),o);
  o*=ramp(uv.y);
 }else{
  float d=uv.y-YH;
  float dp=d*HF;
  float depth=smoothstep(0.,.5,d/(1.-YH));
  // very slow surface shimmer displaces the mirrored lookup
    vec2 off=vec2((vn(vec2(uv.x*26.,uv.y*HF/5.+T*.5))-.5)*.0045*(.3+dp/H0*3.),(vn(vec2(uv.x*14.+4.,uv.y*HF/3.5-T*.4))-.5)*.004/(HF/H0)*(.2+dp/H0*3.));
  vec2 pr=vec2(uv.x+off.x,YH-d+off.y);
  float refl=mix(.85,.05,smoothstep(0.,.32*H0*SC,dp))*ramp(pr.y);
  vec4 A=aurora(ap(pr),1.);
  float k=AMP*refl*(1.-smoothstep(yhp-NEAR,yhp,pr.y*HF));
  o=glow(A.rgb*k*.9,A.a*k*.9,1.3);
  vec4 sl=texture2D(S,vec2(pr.x,pr.y));
  o=over(sl*(dk?.85:.55)*mix(1.,.5,depth),o);
  float shn=vn(vec2(uv.x*40.,uv.y*HF*.8+T*.3))*(1.-depth)*.5;
  vec3 gl2=dk?vec3(.4,.8,.8):vec3(.45,.6,.7);
  float ga=shn*.05*(dk?1.:.7);
  o=over(vec4(gl2*ga,ga*(dk?.6:.5)),o);
  float ln=exp(-pow(dp/1.5,2.))*(dk?.18:.25);
  o=over(vec4((dk?vec3(.35,.6,.62):vec3(.55,.7,.78))*ln,ln),o);
  float wa=(1.-depth)*(dk?.1:.18);
  o=over(vec4((dk?vec3(.05,.1,.17):vec3(.7,.82,.88))*wa,wa),o);
 }
 gl_FragColor=dither(o);
}`.replace(/H0/g, H0.toFixed(1));

const MIST_FS = GLSL + `
uniform float YH,SG;
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 float x=uv.x*3.4;
 vec2 q=vec2(x*1.3+T*.012,uv.y*4.6-T*.003);
 q+=.6*vec2(fbm3(q*.8+2.),fbm3(q*.8+8.));
 float n=smoothstep(.34,.66,fbm3(q));
 float n2=smoothstep(.4,.7,fbm3(vec2(x*2.1-T*.02,uv.y*7.+3.)));
 float env=exp(-pow((uv.y-(YH+.01))/SG,2.))*(.55+.6*vn(vec2(x*.8,9.)));
 float a=(n*.8+n2*.35)*env;
 float g=.5+.5*sin(uv.x*5.+T*.03);
 vec3 mc=DK>.5?mix(vec3(.3,.5,.62),vec3(.28,.62,.55),g):vec3(1.,1.,1.);
 a*=DK>.5?.85:1.0;
 gl_FragColor=dither(vec4(mc*a*(DK>.5?.75:1.),a));
}`;

const PAL = (dark) => dark
	? { far: "#16294a", mid: "#122340", farTree: "#101f3a", near: "#070d1a", tree: "#050a14", isle: "#060b16" }
	: { far: "#c9dae5", mid: "#bccfdc", farTree: "#bcd1dd", near: "#a9c3cf", tree: "#9bb8c6", isle: "#8fb0bf" };

// per-scene config: horizon fraction, aurora strength
const SCENES = {
	pines: { YH: 0.54, amp: 1 },
	ridges: { YH: 0.55, amp: 1 },
	horizon: { YH: 0.66, amp: 1.05 },
	peaks: { YH: 0.52, amp: 1 },
	islands: { YH: 0.5, amp: 1 },
};

export function vsFooter(root, { reducedMotion, scene = "pines", mult = 1.5, seed = 361 }) {
	const dark = isDark();
	const stage = footerStage(root, { height: Math.round(H0 * mult) });
	if (!stage) return null;
	const { host } = stage;
	const cfg = SCENES[scene];
	const YH = cfg.YH;
	const gl = new GL(host, FS, { scale: 0.5 });
	const cS = mkCanvas(host);
	const cO = mkCanvas(host);
	const mist = new GL(host, MIST_FS, { scale: 0.3 });
	const C = PAL(dark);
	let W = 1, H = 1, octx = null, stars = [];
	const st = { x: 0.5, y: 0.25, tx: 0.5, ty: 0.25 };

	/* ---------- silhouettes ---------- */
	function shoreTrees(g, yh, r, kTree, kLand) {
		const shore = (side, reach, amp, sd) => {
			const f = ridgeFn(sd, { amp: amp * 0.18, f: 0.012 });
			const hgt = (x) => { const t = side < 0 ? x / reach : (W - x) / reach; return t >= 1 ? 0 : amp * Math.pow(1 - t, 1.5) + f(x) * (1 - t); };
			const x0 = side < 0 ? 0 : W - reach, x1 = side < 0 ? reach : W;
			g.fillStyle = C.near;
			g.beginPath(); g.moveTo(x0, yh + 1);
			for (let x = x0; x <= x1; x += 3) g.lineTo(x, yh - Math.max(0, hgt(x)));
			g.lineTo(x1, yh + 1); g.fill();
			g.fillStyle = C.tree;
			for (let x = x0; x < x1; x += (7 + r() * 8) * (kTree > 1.2 ? 1.25 : 1)) {
				const h0 = hgt(x); if (h0 < 6) continue;
				const hh = (16 + r() * 30 * Math.min(1, h0 / (40 * kLand))) * kTree;
				spruce(g, x, yh - h0 + 4, hh, hh * 0.3, (r() - 0.5) * 2);
			}
		};
		shore(-1, W * 0.3, 52 * kLand, 21); shore(1, W * 0.28, 44 * kLand, 33);
	}
	const poly = (g, x0, x1, base, fn, step = 4) => {
		g.beginPath(); g.moveTo(x0, base + 1);
		for (let x = x0; x <= x1 + step; x += step) g.lineTo(x, base - fn(x));
		g.lineTo(x1 + step, base + 1); g.closePath(); g.fill();
	};
	// ridged peaks: sharp summits from folded sines
	const peakFn = (sd, amp, f) => {
		const r = rng(sd), ph = [r() * TAU, r() * TAU, r() * TAU], fr = [f, f * 2.3, f * 5.1];
		return (x) => { let h = 0, a = 1, n = 0; for (let i = 0; i < 3; i++) { h += a * (1 - Math.abs(Math.sin(x * fr[i] + ph[i]))); n += a; a *= 0.42; } return Math.pow(h / n, 1.7) * amp; };
	};
	function paintSil(g, sc) {
		g.save(); g.scale(sc, sc);
		const yh = H * YH, r = rng(seed + 7), k = H / H0;
		if (scene === "pines") {
			const far = ridgeFn(11, { amp: 15 * k * 0.8, f: 0.007 });
			g.fillStyle = C.far; poly(g, 0, W, yh, (x) => 6 + Math.max(0, far(x) + 8 * k));
			g.fillStyle = C.farTree;
			for (let x = 0; x < W; x += 6 + r() * 8) spruce(g, x, yh - 6 - Math.max(0, far(x) + 8 * k) + 2, (6 + r() * 6) * 1.2, 2.8 + r() * 1.4);
			shoreTrees(g, yh, r, 1.9, 1.35);
		} else if (scene === "ridges") {
			const layers = [
				{ c: C.far, fn: ridgeFn(5, { amp: 30 * k, f: 0.0032 }), lift: 52 * k },
				{ c: C.mid, fn: ridgeFn(9, { amp: 28 * k, f: 0.0045 }), lift: 36 * k },
				{ c: C.farTree, fn: ridgeFn(14, { amp: 20 * k, f: 0.0062 }), lift: 22 * k },
				{ c: C.near, fn: ridgeFn(23, { amp: 14 * k, f: 0.0085 }), lift: 9 * k },
			];
			for (const L of layers) { g.fillStyle = L.c; poly(g, 0, W, yh, (x) => Math.max(1, L.fn(x) + L.lift), 5); }
		} else if (scene === "horizon") {
			const f = ridgeFn(7, { amp: 1.6, f: 0.004 });
			g.fillStyle = C.far; poly(g, 0, W, yh, (x) => 2.2 + f(x), 6);
		} else if (scene === "peaks") {
			const f1 = peakFn(31, 120 * k * 0.85, 0.0042), f2 = peakFn(47, 78 * k * 0.85, 0.0065);
			g.fillStyle = C.far; poly(g, 0, W, yh, (x) => 6 + f1(x), 3);
			g.fillStyle = C.mid; poly(g, 0, W, yh, (x) => 3 + f2(x) * 0.8, 3);
			// low treeline along the whole shore
			const tl = ridgeFn(61, { amp: 5, f: 0.01 });
			g.fillStyle = C.near; poly(g, 0, W, yh, (x) => 6 + tl(x) + 4, 4);
			g.fillStyle = C.tree;
			for (let x = 0; x < W; x += 4 + r() * 5) spruce(g, x, yh - (6 + tl(x) + 4) + 3, 9 + r() * 11 + (r() < 0.12 ? 7 : 0), 2.6 + r() * 1.3, (r() - 0.5));
		} else if (scene === "islands") {
			const f = ridgeFn(17, { amp: 1.4, f: 0.005 });
			g.fillStyle = C.far; poly(g, 0, W, yh, (x) => 2 + f(x), 6);
		}
		g.restore();
	}
	// islands live on the water: drawn sharp, with a faint reflection of their own
	function paintIslands(g) {
		const r = rng(seed + 3), yh = H * YH, depth = H - yh;
		const spots = [[0.16, 0.2, 0.7], [0.36, 0.48, 1.0], [0.58, 0.16, 0.55], [0.8, 0.36, 0.85], [0.93, 0.12, 0.45]];
		spots.sort((a, b) => a[1] - b[1]);
		for (const [fx, fy, sz] of spots) {
			const x = W * fx + (r() - 0.5) * 30, base = yh + 8 + depth * 0.62 * fy, k = 0.55 + sz * 0.9 + fy * 0.5;
			const w = (60 + r() * 50) * k, hm = (6 + r() * 4) * k;
			const trees = [];
			const n = 3 + Math.round(sz * 5);
			for (let i = 0; i < n; i++) {
				const tx = x + (r() - 0.5) * w * 0.7;
				const edge = 1 - Math.abs(tx - x) / (w * 0.45);
				trees.push({ x: tx, h: (13 + r() * 22) * k * (0.55 + 0.45 * clamp(edge)), w: (4 + r() * 2) * k });
			}
			const draw = (flip) => {
				g.save();
				if (flip) { g.translate(0, 2 * base); g.scale(1, -1); g.globalAlpha = dark ? 0.32 : 0.3; }
				g.fillStyle = C.isle;
				g.beginPath(); g.ellipse(x, base, w / 2, hm, 0, Math.PI, TAU); g.lineTo(x + w / 2, base); g.lineTo(x - w / 2, base); g.fill();
				g.fillStyle = C.tree;
				for (const t of trees) spruce(g, t.x, base - hm * 0.45 * (1 - Math.abs(t.x - x) / (w / 2)) + 1, t.h, t.w);
				g.restore();
			};
			draw(false); draw(true);
		}
	}
	function build() {
		const dpr = stage.dpr;
		const gS = sizeCanvas(cS, W, H, dpr);
		gS.clearRect(0, 0, cS.width, cS.height);
		gS.save(); gS.scale(dpr, dpr); paintSil(gS, 1); if (scene === "islands") paintIslands(gS); gS.restore();
		// the shader mirrors the shore silhouettes (not the islands, which carry their own reflection)
		const tex = document.createElement("canvas");
		const tg = sizeCanvas(tex, W, H, 0.5);
		paintSil(tg, 0.5);
		gl.setTexture("S", tex, 0);
	}

	/* ---------- overlay: still, dim stars and their reflection ---------- */
	const ramp = (y) => { const t = clamp(y / (H * YH * 0.8)); return t * t * (3 - 2 * t); };
	function drawOverlay(t) {
		const g = octx, dpr = stage.dpr;
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, W, H);
		if (!dark) return;
		for (const s of stars) {
			const tw = 0.7 + 0.3 * Math.sin(t * SPD * s.f + s.p);
			const a = s.b * tw * ramp(s.y);
			g.fillStyle = `rgba(228,238,255,${a.toFixed(3)})`;
			g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
			g.fillStyle = `rgba(190,220,235,${(a * 0.22).toFixed(3)})`;
			g.beginPath(); g.arc(s.x + Math.sin(t * SPD * 0.9 + s.p) * 0.8, H * YH * 2 - s.y, s.r * 0.9, 0, TAU); g.fill();
		}
	}

	function draw(t, dt) {
		const a = reducedMotion ? 1 : 1 - Math.exp(-dt * 0.5); // the pointer's pull eases in over a couple of seconds
		st.x += (st.tx - st.x) * a; st.y += (st.ty - st.y) * a;
		const T = t * SPD + 80;
		gl.draw({ T, DK: dark ? 1 : 0, AMP: (dark ? 0.8 : 1.0) * cfg.amp, E: 0, M: [st.x, clamp(st.y, 0.05, YH - 0.1)], YH, HF: H,
			OFF: Math.max(0, (H * YH - 150) * 0.6), SC: 1 + (H / H0 - 1) * 0.3, RAMP: H * YH * 0.8, NEAR: 42 * (1 + (H / H0 - 1) * 0.3),
			BASE: 0.24, HGT: 0.13, WOB: 0.55, LS: 0.06, RAYS: 0.75, WX: 3.2, WAVE: 0.4, PULL: 0.2, LOWF: 0.03 });
		mist.draw({ T, DK: dark ? 1 : 0, YH, SG: (0.11 * H0 * (1 + (H / H0 - 1) * 0.5)) / H, AMP: 1, E: 0, M: [0.5, 0.5] });
		if (octx) drawOverlay(t);
	}
	const loop = createLoop({ host, fps: FPS, reduced: reducedMotion, draw });
	const ptr = pointerTracker(host, (s, kind) => {
		if (kind === "out") { st.tx = 0.5; st.ty = 0.25; }
		else if (kind === "move") { st.tx = clamp(s.x / W, -0.2, 1.2); st.ty = clamp(s.y / H, -0.3, 1.3); }
		else return;
		loop.wake();
	});

	let cancel = () => {};
	stage.onSize = (s) => {
		W = s.w; H = s.h;
		gl.resize(W, H); mist.resize(W, H);
		octx = sizeCanvas(cO, W, H, stage.dpr);
		const r = rng(77); stars = [];
		for (let i = 0; i < Math.round(W * H / 4200); i++) stars.push({ x: r() * W, y: Math.pow(r(), 1.2) * H * YH * 0.92, r: r() < 0.07 ? 1.15 : 0.5 + r() * 0.4, b: 0.2 + r() * 0.45, f: 0.4 + r() * 1.2, p: r() * TAU });
		cancel(); cancel = idle(() => { build(); loop.start(); loop.redraw(); });
	};
	stage.layout();
	return { stage, destroy() { cancel(); loop.destroy(); ptr.destroy(); gl.destroy(); mist.destroy(); stage.destroy(); } };
}
