import { GL, GLSL, AURORA_FN, footerStage, createLoop, pointerTracker, topAurora, marginSky, mkCanvas, sizeCanvas, isDark, idle, rng, clamp, lerp, smooth, TAU, ridgeFn, ridgePath, spruce, hexRgb, rgba } from "./_refined-e/kit.js";

const WIDE = 1.26;
const FS = GLSL + AURORA_FN + `
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 vec4 A=aurora(uv,1.);
 float k=AMP*(smoothstep(0.,.2,uv.y))*(1.-smoothstep(.55,.8,uv.y));
 vec4 o=glow(A.rgb*k,A.a*k,1.3);
 // soft horizon wash behind the ridges
 float hz=exp(-pow((uv.y-.6)/.14,2.))*(.5+.5*vn(vec2(uv.x*3.,T*.02)));
 vec3 hc=DK>.5?vec3(.1,.32,.4):vec3(.62,.8,.86);
 o=over(o,vec4(hc*hz*(DK>.5?.2:.22),hz*(DK>.5?.12:.22)));
 gl_FragColor=dither(o);
}`;

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const stage = footerStage(root, { height: 260 });
	if (!stage) return;
	const { host } = stage;
	const offs = [topAurora(root, { level: 1, reduced: reducedMotion }), marginSky(root, { dark, stars: true, seed: 314 })];

	// aurora (wider than the stage, panned with the cursor)
	const aWrap = document.createElement("div");
	aWrap.style.cssText = `position:absolute;top:0;height:100%;width:${WIDE * 100}%;left:${-(WIDE - 1) * 50}%;will-change:transform`;
	host.appendChild(aWrap);
	const gl = new GL(aWrap, FS, { scale: 0.42 });
	const layersHost = document.createElement("div");
	layersHost.style.cssText = "position:absolute;inset:0";
	host.appendChild(layersHost);
	const post = (c) => { const d = document.createElement("i"); d.className = c; host.appendChild(d); };
	post("ra-pano-post l"); post("ra-pano-post r"); post("ra-pano-sill");

	const layers = []; // {el, depth}
	const P = dark
		? { far: ["#243658", "#18294a"], mid: ["#16264a", "#0f1c38"], near: ["#0d1830", "#09122a"], front: ["#070f20", "#060c1a"], tree: "#08101f", tower: "#050a14" }
		: { far: ["#cfe0ec", "#e3edf3"], mid: ["#b9d2e0", "#d2e3ea"], near: ["#a6c4d2", "#c3d9e0"], front: ["#98b9c8", "#b5d0d8"], tree: "#a8c3cf", tower: "#7d9bab" };
	const par = { x: 0, tx: 0, raf: 0 };
	let W = 0, H = 0, vis = null;

	function tower(g, x, base) {
		const h = 40, w = 9;
		g.fillStyle = P.tower; g.strokeStyle = P.tower; g.lineWidth = 1.2;
		g.beginPath(); g.moveTo(x - w, base); g.lineTo(x - w * 0.55, base - h); g.moveTo(x + w, base); g.lineTo(x + w * 0.55, base - h); g.stroke();
		g.lineWidth = 0.8;
		for (let k = 1; k < 4; k++) { const t = k / 4, ww = lerp(w, w * 0.55, t), yy = base - h * t; g.beginPath(); g.moveTo(x - ww, yy); g.lineTo(x + ww, yy); g.moveTo(x - ww, yy); g.lineTo(x + lerp(w, w * 0.55, t - 0.25), base - h * (t - 0.25)); g.stroke(); }
		g.fillRect(x - w * 0.8, base - h - 5, w * 1.6, 5);
		g.beginPath(); g.moveTo(x - w * 0.95, base - h - 5); g.lineTo(x, base - h - 10); g.lineTo(x + w * 0.95, base - h - 5); g.closePath(); g.fill();
		if (dark) { // one warm window
			const gr = g.createRadialGradient(x, base - h - 2.6, 0, x, base - h - 2.6, 9);
			gr.addColorStop(0, "rgba(255,196,110,.55)"); gr.addColorStop(1, "rgba(255,196,110,0)");
			g.fillStyle = gr; g.fillRect(x - 10, base - h - 14, 20, 20);
			g.fillStyle = "#ffd28a"; g.fillRect(x - 2.2, base - h - 4, 4.4, 2.4);
		}
	}
	function build() {
		layersHost.textContent = ""; layers.length = 0;
		const mx = 28, dpr = stage.dpr, r = rng(260);
		const mk = (depth, paint) => {
			const c = document.createElement("canvas");
			c.width = Math.round((W + mx * 2) * dpr); c.height = Math.round(H * dpr);
			c.className = "ra-pano-layer";
			c.style.cssText = `position:absolute;top:0;left:${-mx}px;width:${W + mx * 2}px;height:${H}px;display:block`;
			const g = c.getContext("2d"); g.scale(dpr, dpr); g.translate(mx, 0);
			paint(g); layersHost.appendChild(c); layers.push({ el: c, depth });
		};
		const fill = (g, base, fn, cols, y0, y1) => {
			const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
			g.fillStyle = gr; ridgePath(g, W + mx, H, base, fn); g.save(); g.translate(-mx, 0); g.restore(); g.fill();
		};
		const wide = (g, fn) => (x) => fn(x - 0);
		if (dark) mk(5, (g) => {
			const n = Math.round(W * H / 2600);
			for (let i = 0; i < n; i++) { const x = -mx + r() * (W + mx * 2), y = Math.pow(r(), 1.3) * H * 0.55; const b = 0.25 + Math.pow(r(), 2) * 0.6; g.fillStyle = `rgba(225,235,255,${b})`; g.beginPath(); g.arc(x, y, r() < 0.06 ? 1.2 : 0.55 + r() * 0.45, 0, TAU); g.fill(); }
		});
		const f1 = ridgeFn(101, { amp: 30, f: 0.0042 }), f2 = ridgeFn(117, { amp: 20, f: 0.0075 }), f3 = ridgeFn(133, { amp: 14, f: 0.0105 });
		mk(12, (g) => { g.translate(0, 0); fill(g, H * 0.6, (x) => f1(x), P.far, H * 0.4, H * 0.8); });
		mk(24, (g) => {
			const base = H * 0.69;
			fill(g, base, f2, P.mid, H * 0.5, H * 0.85);
			g.fillStyle = P.tree;
			for (let x = -mx; x < W + mx; x += 5 + r() * 7) spruce(g, x, base - f2(x) + 1, 8 + r() * 9, 3.2 + r() * 1.6, (r() - 0.5) * 1.5);
			tower(g, W * 0.73, base - f2(W * 0.73) + 1);
		});
		mk(40, (g) => {
			const base = H * 0.78;
			fill(g, base, f3, P.near, H * 0.6, H * 0.95);
			g.fillStyle = dark ? "#070e1d" : "#9bb9c6";
			for (let x = -mx; x < W + mx; x += 6 + r() * 9) spruce(g, x, base - f3(x) + 1, 12 + r() * 13, 4.5 + r() * 2.5, (r() - 0.5) * 2);
		});
		mk(66, (g) => {
			const base = H * 0.9; const f4 = ridgeFn(171, { amp: 7, f: 0.012 });
			fill(g, base, f4, P.front, H * 0.8, H);
			g.fillStyle = dark ? "#050a15" : "#8bacbb";
			for (let x = -mx; x < W + mx; x += 10 + r() * 16) if (x < W * 0.32 || x > W * 0.68) spruce(g, x, base - f4(x) + 2, 26 + r() * 20, 9 + r() * 4, (r() - 0.5) * 3);
		});
		applyPar();
	}
	let lastK = "";
	function applyPar() {
		const k = par.x.toFixed(2);
		if (k === lastK) return; lastK = k;
		for (const l of layers) l.el.style.transform = `translate3d(${(-par.x * l.depth * 0.5).toFixed(1)}px,0,0)`;
		aWrap.style.transform = `translate3d(${(-par.x * 20).toFixed(1)}px,0,0)`;
	}
	const parStep = () => {
		par.raf = 0;
		par.x += (par.tx - par.x) * (reducedMotion ? 1 : 0.12);
		if (Math.abs(par.tx - par.x) < 0.002) par.x = par.tx; else par.raf = requestAnimationFrame(parStep);
		applyPar();
	};

	const st = { x: 0.5, y: 0.35, e: 0, tx: 0.5, ty: 0.35 };
	const ptr = pointerTracker(host, (s, kind) => {
		if (kind === "out") { par.tx = 0; st.tx = 0.5; st.ty = 0.35; }
		else if (kind === "move") {
			const inX = clamp(s.x / Math.max(1, W) * 2 - 1, -1, 1);
			par.tx = inX; st.tx = (s.x + (WIDE - 1) * 0.5 * W) / (W * WIDE); st.ty = clamp(s.y / H, -0.5, 1.5);
		}
		if (!par.raf && (kind === "move" || kind === "out")) par.raf = requestAnimationFrame(parStep);
		loop.wake();
	});
	const draw = (t, dt) => {
		const a = reducedMotion ? 1 : 1 - Math.exp(-dt * 4);
		const ox = st.x, oy = st.y;
		st.x += (st.tx - st.x) * a; st.y += (st.ty - st.y) * a;
		st.e += (Math.min(1, Math.hypot(st.x - ox, st.y - oy) / Math.max(dt, 0.001) / 1.2) - st.e) * (1 - Math.exp(-dt * 2));
		gl.draw({ T: t * (0.8 + st.e) + 30, DK: dark ? 1 : 0, AMP: dark ? 0.95 : 1.2, E: st.e, M: [st.x, clamp(st.y, 0.05, 0.6)],
			BASE: 0.3, HGT: 0.17, WOB: 0.5, LS: 0.07, RAYS: 0.75, WX: 3.2 * WIDE, WAVE: 0.4, PULL: 0.35, LOWF: 0.03 });
	};
	const loop = createLoop({ host, fps: 24, reduced: reducedMotion, draw });
	let cancel = () => {};
	stage.onSize = (s) => { W = s.w; H = s.h; gl.resize(W * WIDE, H); cancel(); cancel = idle(() => { build(); loop.start(); loop.redraw(); }); };
	stage.layout();
	return () => { cancel(); loop.destroy(); ptr.destroy(); cancelAnimationFrame(par.raf); gl.destroy(); stage.destroy(); offs.forEach((f) => f()); };
}
