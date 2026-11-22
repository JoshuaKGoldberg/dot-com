import { dustMotes } from "./_dl-d/fx.js";
import { GL, GLSL, AURORA_FN, footerStage, createLoop, pointerTracker, calmTopAurora, squiggleRainbow, marginSky, mkCanvas, sizeCanvas, isDark, idle, rng, clamp, lerp, smooth, TAU, ridgeFn, ridgePath, spruce, rgba } from "./_dl-d/kit.js";

const FS = GLSL + AURORA_FN + `
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 vec4 A=aurora(uv,1.);
 float k=AMP*smoothstep(0.,.2,uv.y)*(1.-smoothstep(.5,.8,uv.y));
 gl_FragColor=dither(glow(A.rgb*k,A.a*k,1.3));
}`;

// soft disc: no hard rim, gentle falloff
function disc(rgb, dark) {
	const S = 96, c = document.createElement("canvas"); c.width = c.height = S;
	const g = c.getContext("2d"), r = S / 2;
	const gr = g.createRadialGradient(r, r, 0, r, r, r);
	const a = dark ? 0.55 : 0.5;
	gr.addColorStop(0, rgba(rgb, a * 0.55)); gr.addColorStop(0.55, rgba(rgb, a * 0.62));
	gr.addColorStop(0.8, rgba(rgb, a * 0.4)); gr.addColorStop(0.93, rgba(rgb, a * 0.12)); gr.addColorStop(1, rgba(rgb, 0));
	g.fillStyle = gr; g.fillRect(0, 0, S, S);
	return c;
}

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const stage = footerStage(root, { height: 260 });
	if (!stage) return;
	const { host } = stage;
	const offs = [calmTopAurora(root, { reduced: reducedMotion }), marginSky(root, { dark, stars: true, wisps: true, seed: 350 })];
	offs.push(dustMotes(root, { dark, reduced: reducedMotion }));
	offs.push(squiggleRainbow(root));
	const gl = new GL(host, FS, { scale: 0.3 });
	const cD = mkCanvas(host);
	const treesHost = document.createElement("div");
	treesHost.style.cssText = "position:absolute;inset:0";
	host.appendChild(treesHost);
	const cols = dark ? [[80, 255, 170], [70, 190, 255], [170, 130, 255]] : [[90, 200, 170], [110, 170, 235], [190, 150, 230]];
	const sprites = cols.map((c) => disc(c, dark));
	let W = 1, H = 1, ctx = null, discs = [];
	const SC = 0.5;
	const par = { x: 0, tx: 0, raf: 0 }, trees = [];
	const st = { x: 0.5, y: 0.3, tx: 0.5, ty: 0.3, e: 0 };

	function seedDiscs() {
		const r = rng(316), out = [];
		// well-spaced: rejection sampling so no two big discs pile up
		for (let tries = 0; out.length < 13 && tries < 400; tries++) {
			const rad = 16 + Math.pow(r(), 1.8) * 46;
			const u = 0.03 + r() * 0.94, v = 0.12 + r() * 0.5;
			if (u > 0.36 && u < 0.64 && v > 0.45) continue; // keep the text column's air clear
			if (out.some((d) => Math.hypot((d.u - u) * W, (d.v - v) * H) < (d.rad + rad) * 1.05)) continue;
			out.push({ u, v, rad, c: (u * 3.2 | 0) % 3 === 0 ? 0 : u < 0.6 ? 1 : 2, p: r() * TAU, sp: 0.05 + r() * 0.08, a: 0.5 + r() * 0.5 });
		}
		discs = out;
	}
	function drawDiscs(t) {
		ctx.clearRect(0, 0, cD.width, cD.height);
		ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
		const sig = W * 0.22;
		for (const d of discs) {
			let x = d.u * W + Math.sin(t * d.sp + d.p) * 10, y = d.v * H + Math.cos(t * d.sp * 0.8 + d.p) * 6;
			const dx = x - st.x * W, g = Math.exp(-(dx * dx) / (2 * sig * sig));
			x -= dx * 0.2 * g; y += (st.y * H - y) * 0.12 * g;
			const rad = d.rad * (1 + 0.15 * g);
			ctx.globalAlpha = clamp(d.a * (0.65 + 0.7 * g) * (dark ? 1 : 0.85), 0, 1);
			ctx.drawImage(sprites[d.c], (x - rad) * SC, (y - rad) * SC, rad * 2 * SC, rad * 2 * SC);
		}
		ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
	}
	function build() {
		treesHost.textContent = ""; trees.length = 0;
		const r = rng(58), mx = 40;
		const mk = (depth, scale, paint) => {
			const c = document.createElement("canvas");
			c.width = Math.round((W + mx * 2) * scale); c.height = Math.round(H * scale);
			c.className = "ra-bk-tree";
			c.style.cssText = `position:absolute;left:${-mx}px;top:0;width:${W + mx * 2}px;height:${H}px;display:block`;
			const g = c.getContext("2d"); g.scale(scale, scale); g.translate(mx, 0);
			paint(g); treesHost.appendChild(c); trees.push({ el: c, depth });
		};
		const col = dark ? "#050a15" : "#97b9b0";
		mk(14, Math.min(stage.dpr, 1.25), (g) => { // low treeline
			g.fillStyle = dark ? "#08101e" : "#c6dbd5";
			const f = ridgeFn(5, { amp: 8, f: 0.01 });
			ridgePath(g, W + mx, H, H * 0.93, f); g.fill();
			for (let x = -mx; x < W + mx; x += 5 + r() * 7) spruce(g, x, H * 0.94 - f(x), (dark ? 20 : 12) + r() * (dark ? 26 : 12), 6 + r() * 3, (r() - 0.5) * 2);
		});
		mk(46, 0.55, (g) => { // big defocused spruces framing the sides, kept off the text column
			g.fillStyle = col;
			const cx = W / 2;
			for (let i = 0; i < 12; i++) {
				const left = i % 2 === 0;
				const off = r() * W * 0.26;
				const x = left ? off - 10 : W - off + 10;
				const h = (140 + r() * 120) * (1 - off / (W * 0.4));
				spruce(g, x, H + 14, h, h * (0.3 + r() * 0.06), (left ? 1 : -1) * r() * 4);
			}
		});
		applyPar(true);
	}
	let lastK = "";
	function applyPar(force) {
		const k = par.x.toFixed(2); if (k === lastK && !force) return; lastK = k;
		for (const t of trees) t.el.style.transform = `translate3d(${(-par.x * t.depth * 0.5).toFixed(1)}px,0,0)`;
	}
	const parStep = () => {
		par.raf = 0; par.x += (par.tx - par.x) * (reducedMotion ? 1 : 0.1);
		if (Math.abs(par.tx - par.x) < 0.002) par.x = par.tx; else par.raf = requestAnimationFrame(parStep);
		applyPar();
	};
	const ptr = pointerTracker(host, (s, kind) => {
		if (kind === "out") { st.tx = 0.5; st.ty = 0.3; par.tx = 0; }
		else if (kind === "move") { st.tx = clamp(s.x / W, -0.2, 1.2); st.ty = clamp(s.y / H, -0.3, 1.3); par.tx = clamp(s.x / W * 2 - 1, -1, 1); }
		if (!par.raf) par.raf = requestAnimationFrame(parStep);
		loop.wake();
	});
	const draw = (t, dt) => {
		const a = reducedMotion ? 1 : 1 - Math.exp(-dt * 4);
		const ox = st.x, oy = st.y;
		st.x += (st.tx - st.x) * a; st.y += (st.ty - st.y) * a;
		st.e += (Math.min(1, Math.hypot(st.x - ox, st.y - oy) / Math.max(dt, 0.001) / 1.2) - st.e) * (1 - Math.exp(-dt * 2));
		gl.draw({ T: t * (0.8 + st.e) + 50, DK: dark ? 1 : 0, AMP: dark ? 0.55 : 0.9, E: st.e, M: [st.x, clamp(st.y, 0.05, 0.6)],
			BASE: 0.27, HGT: 0.2, WOB: 0.5, LS: 0.07, RAYS: 0.3, WX: 3.2, WAVE: 0.4, PULL: 0.3, LOWF: 0.04 });
		drawDiscs(t);
	};
	const loop = createLoop({ host, fps: 24, reduced: reducedMotion, draw });
	let cancel = () => {};
	stage.onSize = (s) => {
		W = s.w; H = s.h; gl.resize(W, H); ctx = sizeCanvas(cD, W, H, SC); ctx.imageSmoothingEnabled = true;
		seedDiscs(); cancel(); cancel = idle(() => { build(); loop.start(); loop.redraw(); });
	};
	stage.layout();
	return () => { cancel(); loop.destroy(); ptr.destroy(); cancelAnimationFrame(par.raf); gl.destroy(); stage.destroy(); offs.forEach((f) => f()); };
}
