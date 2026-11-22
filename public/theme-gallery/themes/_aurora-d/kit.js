// _aurora-d: shared engine for the night-sky aurora themes (#253-256).
// Aurora = soft curtains rendered in a low-res WebGL canvas (2D ImageData fallback), CSS-upscaled (bilinear = the blur).
// Sky, stars, Milky Way, trails and land are painted once into cached canvases.
import { Flock, rng, ridgeGeo, paintRidge, forestGeo, paintForest, makePineVariants, hex, rgba, clamp, lerp } from "../forest-kit/kit.js";
export { rng, clamp, lerp, hex, rgba };
export const TAU = Math.PI * 2;
export const isDark = () => document.documentElement.classList.contains("dark");
export const idle = (timeout = 200) => new Promise((res) => ("requestIdleCallback" in window ? requestIdleCallback(() => res(), { timeout }) : setTimeout(res, 16)));

const H = hex;
export const PAL = {
	dark: {
		sky: [[0, "#01030b"], [0.4, "#050d22"], [0.68, "#0e1a3c"], [0.8, "#1c2d58"]],
		water: ["#14234a", "#050a1c"],
		far: { top: H("#1a2650"), bottom: H("#2b3b68"), shade: H("#0e1632"), lit: H("#44588a") },
		mid: { top: H("#131d41"), bottom: H("#223157"), shade: H("#0a1128"), lit: null },
		midTrees: [H("#0e1733"), H("#0b1229"), H("#111c3b")],
		shore: [H("#0a1229"), H("#080e20"), H("#0d1631")],
		land: [H("#070c1c"), H("#03060e")],
		fg: [H("#04070f"), H("#03050b"), H("#060a14")],
		star: [[235, 240, 255], [190, 210, 255], [255, 232, 200]],
		starA: 1,
	},
	light: {
		sky: [[0, "#a9b5e6"], [0.45, "#d3d5f0"], [0.7, "#eee2ee"], [0.8, "#f8e4dc"]],
		water: ["#d9c9dc", "#9aa5cb"],
		far: { top: H("#9aa6cc"), bottom: H("#c7cce2"), shade: H("#7783ac"), lit: H("#e8e8f4") },
		mid: { top: H("#7f8cb4"), bottom: H("#aab3d0"), shade: H("#5f6c98"), lit: null },
		midTrees: [H("#6a77a2"), H("#5f6d9a"), H("#7783ac")],
		shore: [H("#5b6893"), H("#505e8a"), H("#66739d")],
		land: [H("#3a4668"), H("#232c4a")],
		fg: [H("#2c3658"), H("#252e4e"), H("#323d62")],
		star: [[70, 62, 150], [60, 80, 160], [130, 80, 120]],
		starA: 0.42,
	},
};

function mk(w, h, dpr) {
	const c = document.createElement("canvas");
	c.width = Math.max(1, Math.ceil(w * dpr));
	c.height = Math.max(1, Math.ceil(h * dpr));
	c.style.width = `${w}px`;
	c.style.height = `${h}px`;
	const x = c.getContext("2d");
	x.scale(dpr, dpr);
	return { c, x };
}
function sizeCanvas(c, w, h, dpr) {
	c.width = Math.max(1, Math.ceil(w * dpr));
	c.height = Math.max(1, Math.ceil(h * dpr));
	c.style.width = `${w}px`;
	c.style.height = `${h}px`;
	const x = c.getContext("2d");
	x.setTransform(dpr, 0, 0, dpr, 0, 0);
	return x;
}

// ---------------- Aurora (WebGL, 2D fallback) ----------------
const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FS = `precision highp float;
uniform vec2 uRes;uniform vec4 uA;uniform vec4 uB;uniform vec4 uC;uniform vec3 uS[3];uniform float uDark;uniform vec2 uZ;
vec3 pal(float d,int b){
 vec3 g=vec3(.30,1.,.62),t=vec3(.22,.78,.92),v=vec3(.66,.42,1.),r=vec3(1.,.36,.6),w=vec3(.62,1.,.8);
 if(b==1){g=vec3(.2,.9,.78);t=vec3(.28,.6,1.);v=vec3(.6,.4,1.);}
 if(b==2){g=vec3(.5,.55,1.);t=vec3(.72,.4,1.);v=vec3(.95,.38,.78);}
 vec3 c=mix(w,g,smoothstep(0.,.15,d));c=mix(c,t,smoothstep(.15,.5,d));c=mix(c,v,smoothstep(.45,.85,d));c=mix(c,r,smoothstep(.8,1.,d));
 return uDark>.5?c:c*.82+.12;
}
float prof(float d){
 if(d<-.25||d>1.)return 0.;
 if(d<0.){float s=(d+.25)/.25;return s*s*(3.-2.*s);}
 return exp(-2.2*d)*(1.-smoothstep(.55,1.,d));
}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
 float cx=uA.x,cy=clamp(uA.y,uZ.x,uZ.y),en=uA.z,ph=uA.w,fl=uB.x,gain=uB.y,y0=uB.z,gap=uB.w,hh=uC.x,flow=uC.y,wy=uC.z,rf=uC.w;
 float fade=1.,rip=1.,px=p.x,py=p.y;
 if(py>wy){fade=rf*pow(max(0.,1.-(py-wy)/(uRes.y-wy)),1.3);rip=.78+.22*sin(py*2.1+ph*3.+px*.06);py=2.*wy-py;px+=sin(p.y*.9+ph*2.)*1.2;}
 float sig=uRes.x*.17,dx=px-cx,g=exp(-dx*dx/(2.*sig*sig));
 float u=px/uRes.x,uu=u-(dx/uRes.x)*.28*g*flow;
 float sA=0.;vec3 sC=vec3(0.);
 for(int b=0;b<3;b++){
  float fb=float(b);vec3 s=uS[b];
  float by=uRes.y*(y0+fb*gap)+uRes.y*.05*sin(uu*3.2+s.x+ph*.55)+uRes.y*.028*sin(uu*8.1+s.y-ph*.8);
  by+=(cy+uRes.y*.05-by)*.38*g*flow;
  float hg=uRes.y*hh*(1.+.28*sin(uu*4.7+s.z+ph*.4))*(1.+.55*g*(.4+en));
  float ray=(.62+.38*sin(uu*6.2832*7.+s.y*3.+ph*1.5+fb))*(.8+.2*sin(uu*6.2832*19.+s.z+ph*2.3));
  float calm=1.-.3*exp(-pow((u-.5)/.22,2.));
  float amp=ray*(.55+.75*g*(.5+en*.8))*(1.-.2*fb)*gain*(1.+fl*1.8)*calm;
  float d=(by-py)/hg;
  float a=amp*prof(d);
  sA+=a;sC+=pal(clamp(d,0.,1.),b)*a;
 }
 float a=max(0.,(1.-exp(-sA*1.25))*fade*rip-.03)*1.03;
 vec3 c=sC/max(sA,1e-4);
 gl_FragColor=vec4(c*a,a);
}`;

const LUT = (() => {
	// 2D fallback LUT: intensity per d in [-0.25, 1]
	const I = new Float32Array(256);
	for (let k = 0; k < 256; k++) {
		const d = (k / 255) * 1.25 - 0.25;
		let v;
		if (d < 0) { const s = (d + 0.25) / 0.25; v = s * s * (3 - 2 * s); }
		else { const t = clamp((d - 0.55) / 0.45); v = Math.exp(-2.2 * d) * (1 - t * t * (3 - 2 * t)); }
		I[k] = v;
	}
	return I;
})();
const BAND_COL = [
	[[0.62, 1, 0.8], [0.3, 1, 0.62], [0.22, 0.78, 0.92], [0.66, 0.42, 1], [1, 0.36, 0.6]],
	[[0.62, 1, 0.8], [0.2, 0.9, 0.78], [0.28, 0.6, 1], [0.6, 0.4, 1], [1, 0.36, 0.6]],
	[[0.62, 1, 0.8], [0.5, 0.55, 1], [0.72, 0.4, 1], [0.95, 0.38, 0.78], [1, 0.36, 0.6]],
];

export class Aurora {
	constructor(canvas, { dark, y0 = 0.4, gap = 0.04, hgt = 0.26, gain = 0.85, flow = 1, wy = 0.8, refl = 0.3, scale, rest = [0.66, 0.38] }) {
		this.canvas = canvas;
		this.dark = dark;
		this.cfg = { y0, gap, hgt, gain: dark ? gain : gain * 0.55, flow, wy, refl: dark ? refl : refl * 0.8 };
		this.rest = rest;
		this.scaleOpt = scale;
		this.seeds = [[0.6, 2.1, 4.2], [3.3, 0.7, 1.9], [5.1, 4.4, 0.4]];
		this.phase = 0.8;
		this.energy = 0;
		this.flash = 0;
		this.cx = 0; this.cy = 0;
		this.W = 0; this.H = 0;
		this.gl = null;
		this.ctx2 = null;
		this.lost = false;
		this.init();
	}
	init() {
		const c = this.canvas;
		let gl = null;
		try { gl = c.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" }); } catch { gl = null; }
		if (gl && this.setupGL(gl)) { this.gl = gl; this.sc = this.scaleOpt || 0.25; }
		else { this.gl = null; this.ctx2 = c.getContext("2d"); this.sc = this.scaleOpt || 1 / 6; }
		this.onLost = (e) => { e.preventDefault(); this.lost = true; };
		c.addEventListener("webglcontextlost", this.onLost);
	}
	setupGL(gl) {
		const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
		const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
		if (!vs || !fs) return false;
		const pr = gl.createProgram();
		gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
		if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
		gl.useProgram(pr);
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const loc = gl.getAttribLocation(pr, "p");
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		this.u = {};
		for (const n of ["uRes", "uA", "uB", "uC", "uDark", "uZ"]) this.u[n] = gl.getUniformLocation(pr, n);
		this.u.uS = gl.getUniformLocation(pr, "uS");
		gl.uniform3fv(this.u.uS, new Float32Array(this.seeds.flat()));
		gl.uniform1f(this.u.uDark, this.dark ? 1 : 0);
		gl.disable(gl.BLEND);
		this.prog = pr;
		return true;
	}
	resize(w, h) {
		this.W = w; this.H = h;
		const lw = Math.max(8, Math.ceil(w * this.sc)), lh = Math.max(8, Math.ceil(h * this.sc));
		this.lw = lw; this.lh = lh;
		this.canvas.width = lw; this.canvas.height = lh;
		this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`;
		if (this.gl) this.gl.viewport(0, 0, lw, lh);
		else {
			this.img = this.ctx2.createImageData(lw, lh);
			const n = lw * lh;
			this.acc = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
		}
		if (!this.cx) { this.cx = this.rest[0] * w; this.cy = this.rest[1] * h; }
	}
	// ptr: {x,y,active,speed}
	step(dt, ptr, reduced) {
		const W = this.W, Hh = this.H;
		let tx, ty;
		if (ptr.active) { tx = ptr.x; ty = ptr.y; }
		else { tx = this.rest[0] * W + Math.sin(this.phase * 0.35) * W * 0.06; ty = this.rest[1] * Hh; }
		const k = reduced ? 1 : 1 - Math.exp(-dt * 5);
		this.cx += (tx - this.cx) * k;
		this.cy += (ty - this.cy) * k;
		if (reduced) return;
		const target = Math.min(1, ptr.speed / 700);
		this.energy += (target - this.energy) * (1 - Math.exp(-dt * 3));
		if (this.energy < 0.01) this.energy = 0;
		this.flash *= Math.exp(-dt * 1.6);
		if (this.flash < 0.01) this.flash = 0;
		this.phase += dt * (0.1 + this.energy * 1.4 + this.flash * 0.3);
	}
	get busy() { return this.energy > 0.03 || this.flash > 0.03; }
	draw() {
		if (!this.lw || this.lost) return;
		const { lw, lh, sc } = this;
		const c = this.cfg;
		const wy = c.wy * lh;
		const cx = this.cx * sc, cy = this.cy * sc;
		const zt = lh * 0.1, zb = wy * 0.92;
		if (this.gl) {
			const gl = this.gl, u = this.u;
			gl.uniform2f(u.uRes, lw, lh);
			gl.uniform4f(u.uA, cx, cy, this.energy, this.phase);
			gl.uniform4f(u.uB, this.flash, c.gain, c.y0, c.gap);
			gl.uniform4f(u.uC, c.hgt, c.flow, wy, c.refl);
			gl.uniform2f(u.uZ, zt, zb);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			return;
		}
		this.draw2d(cx, cy, zt, zb, wy);
	}
	draw2d(cx, cy0, zt, zb, wy) {
		const { lw, lh } = this;
		const c = this.cfg, ph = this.phase, en = this.energy, fl = this.flash;
		const [aA, aR, aG, aB] = this.acc;
		aA.fill(0); aR.fill(0); aG.fill(0); aB.fill(0);
		const cy = clamp(cy0, zt, zb);
		const sig = lw * 0.17;
		for (let b = 0; b < 3; b++) {
			const [s0, s1, s2] = this.seeds[b];
			const cols = BAND_COL[b];
			for (let x = 0; x < lw; x++) {
				const dx = x - cx, g = Math.exp(-(dx * dx) / (2 * sig * sig));
				const u = x / lw, uu = u - (dx / lw) * 0.28 * g * c.flow;
				let by = lh * (c.y0 + b * c.gap) + lh * 0.05 * Math.sin(uu * 3.2 + s0 + ph * 0.55) + lh * 0.028 * Math.sin(uu * 8.1 + s1 - ph * 0.8);
				by += (cy + lh * 0.05 - by) * 0.38 * g * c.flow;
				const hg = lh * c.hgt * (1 + 0.28 * Math.sin(uu * 4.7 + s2 + ph * 0.4)) * (1 + 0.55 * g * (0.4 + en));
				const ray = (0.62 + 0.38 * Math.sin(uu * TAU * 7 + s1 * 3 + ph * 1.5 + b)) * (0.8 + 0.2 * Math.sin(uu * TAU * 19 + s2 + ph * 2.3));
				const calm = 1 - 0.3 * Math.exp(-(((u - 0.5) / 0.22) ** 2));
				const amp = ray * (0.55 + 0.75 * g * (0.5 + en * 0.8)) * (1 - 0.2 * b) * c.gain * (1 + fl * 1.8) * calm;
				const top = Math.max(0, Math.floor(by - hg)), bot = Math.min(lh - 1, Math.floor(by + hg * 0.25));
				for (let y = top; y <= bot; y++) {
					const d = (by - y) / hg;
					const k = clamp(((d + 0.25) * 255) / 1.25, 0, 255) | 0;
					const a = amp * LUT[k];
					if (a < 0.002) continue;
					const dd = clamp(d, 0, 1) * 4, si = Math.min(3, dd | 0), f = dd - si;
					const c0 = cols[si], c1 = cols[si + 1];
					const i = y * lw + x;
					aA[i] += a;
					aR[i] += a * lerp(c0[0], c1[0], f); aG[i] += a * lerp(c0[1], c1[1], f); aB[i] += a * lerp(c0[2], c1[2], f);
				}
			}
		}
		const d = this.img.data;
		const lightK = this.dark ? 1 : 0.82, lightO = this.dark ? 0 : 0.12;
		for (let i = 0; i < lw * lh; i++) {
			const sA = aA[i];
			const o = i * 4;
			if (sA < 0.004) { d[o + 3] = 0; continue; }
			const a = Math.max(0, 1 - Math.exp(-sA * 1.25) - 0.03) * 1.03, inv = 255 / sA;
			if (a <= 0) { d[o + 3] = 0; continue; }
			d[o] = (aR[i] * inv * lightK + lightO * 255); d[o + 1] = (aG[i] * inv * lightK + lightO * 255); d[o + 2] = (aB[i] * inv * lightK + lightO * 255); d[o + 3] = a * 255;
		}
		const wyI = Math.round(wy);
		for (let y = wyI; y < lh; y++) {
			const src = 2 * wyI - y - 1;
			if (src < 0) break;
			const fade = c.refl * Math.pow(Math.max(0, 1 - (y - wyI) / (lh - wyI)), 1.3) * (0.78 + 0.22 * Math.sin(y * 2.1 + ph * 3));
			const sh = Math.round(Math.sin(y * 0.9 + ph * 2) * 1.2);
			for (let x = 0; x < lw; x++) {
				const xs = clamp(x + sh, 0, lw - 1);
				const so = (src * lw + xs) * 4, o = (y * lw + x) * 4;
				d[o] = d[so]; d[o + 1] = d[so + 1]; d[o + 2] = d[so + 2]; d[o + 3] = d[so + 3] * fade;
			}
		}
		this.ctx2.putImageData(this.img, 0, 0);
	}
	destroy() {
		this.canvas.removeEventListener("webglcontextlost", this.onLost);
		if (this.gl) {
			const ext = this.gl.getExtension("WEBGL_lose_context");
			ext?.loseContext();
		}
	}
}

// ---------------- Painters ----------------
// Gradients are painted as solid 1px rows: Skia dithers canvas gradients, which showed up as a faint scanline texture.
function rowGradient(x, w, y0, y1, stops) {
	const n = y1 - y0;
	for (let y = 0; y < n; y++) {
		const t = y / Math.max(1, n - 1);
		let i = 1;
		while (i < stops.length - 1 && t > stops[i][0]) i++;
		const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
		const f = clamp((t - t0) / (t1 - t0));
		x.fillStyle = `rgb(${lerp(c0[0], c1[0], f) | 0},${lerp(c0[1], c1[1], f) | 0},${lerp(c0[2], c1[2], f) | 0})`;
		x.fillRect(0, y0 + y, w, 1);
	}
}
export function paintSky(x, w, h, wyPx, dark) {
	const p = PAL[dark ? "dark" : "light"];
	rowGradient(x, w, 0, wyPx, p.sky.map(([t, c]) => [t, H(c)]));
	rowGradient(x, w, wyPx, h, [[0, H(p.water[0])], [1, H(p.water[1])]]);
}

export function paintMilky(out, w, h, { dark, strength = 1, seed = 5 }) {
	const r = rng(seed);
	const P0 = [-0.06 * w, 0.8 * h], C = [0.5 * w, -0.32 * h], P2 = [1.08 * w, 0.66 * h];
	const at = (t) => { const a = (1 - t) ** 2, b = 2 * t * (1 - t), c = t * t; return [a * P0[0] + b * C[0] + c * P2[0], a * P0[1] + b * C[1] + c * P2[1]]; };
	const nrm = (t) => { const e = 0.01, a = at(t - e), b = at(t + e); const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
	const bulge = (t) => 0.55 + 0.45 * Math.exp(-(((t - 0.33) / 0.22) ** 2));
	const base = dark ? 1 : 0.5;
	// Gradients are drawn at half resolution and upscaled: Skia's gradient dithering is otherwise a visible 1px lattice.
	const glow = mk(w, h, 0.5), lanes = mk(w, h, 0.5);
	let x = glow.x;
	x.save();
	x.globalCompositeOperation = dark ? "lighter" : "source-over";
	const blob = (px, py, rad, col, a) => {
		const g = x.createRadialGradient(px, py, 0, px, py, rad);
		g.addColorStop(0, rgba(col, a));
		g.addColorStop(1, rgba(col, 0));
		x.fillStyle = g;
		x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
	};
	const cool = dark ? [110, 130, 215] : [150, 130, 215], cream = dark ? [255, 226, 190] : [235, 190, 170], white = dark ? [200, 212, 255] : [170, 160, 230];
	for (let i = 0; i < 26; i++) {
		const t = (i + r()) / 26, [px, py] = at(t), [nx, ny] = nrm(t), o = (r() - 0.5) * h * 0.06;
		blob(px + nx * o, py + ny * o, h * (0.14 + 0.1 * bulge(t)), cool, 0.06 * strength * base * bulge(t));
	}
	for (let i = 0; i < 110; i++) {
		const t = r(), [px, py] = at(t), [nx, ny] = nrm(t), o = (r() - 0.5) * h * 0.13 * bulge(t);
		const warm = Math.exp(-(((t - 0.33) / 0.12) ** 2));
		blob(px + nx * o, py + ny * o, h * (0.035 + r() * 0.06) * (0.7 + bulge(t)), warm > 0.35 && r() < 0.5 ? cream : white, (0.045 + r() * 0.05) * strength * base * (0.5 + bulge(t)));
	}
	x.restore();
	// dust lanes
	x = lanes.x;
	x.save();
	const sky = dark ? [4, 8, 22] : [215, 212, 238];
	for (let i = 0; i < 34; i++) {
		const t = 0.1 + r() * 0.8, [px, py] = at(t), [nx, ny] = nrm(t), o = (r() - 0.5) * h * 0.05;
		x.save();
		x.translate(px + nx * o, py + ny * o);
		x.rotate(Math.atan2(ny, nx) + Math.PI / 2 + (r() - 0.5) * 0.4);
		x.scale(1, 0.22 + r() * 0.15);
		blob(0, 0, h * (0.05 + r() * 0.06), sky, (dark ? 0.45 : 0.3) * strength);
		x.restore();
	}
	x.restore();
	out.save();
	out.globalCompositeOperation = dark ? "lighter" : "source-over";
	out.drawImage(glow.c, 0, 0, w, h);
	out.restore();
	out.drawImage(lanes.c, 0, 0, w, h);
	x = out;
	// fine star dust
	const buckets = [[], [], []];
	for (let i = 0; i < 4200 * strength; i++) {
		const t = r(), [px, py] = at(t), [nx, ny] = nrm(t);
		const o = (r() + r() + r() - 1.5) * h * 0.11 * bulge(t);
		buckets[(r() * 3) | 0].push(px + nx * o, py + ny * o);
	}
	const col = dark ? [225, 232, 255] : [90, 80, 170];
	buckets.forEach((b, k) => {
		x.fillStyle = rgba(col, (dark ? 0.16 : 0.1) * (k + 1) * strength);
		x.beginPath();
		for (let i = 0; i < b.length; i += 2) x.rect(b[i], b[i + 1], 1, 1);
		x.fill();
	});
}

export function glowDot(size, col) {
	const { c, x } = mk(size, size, 1);
	const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	g.addColorStop(0, rgba(col, 1)); g.addColorStop(0.18, rgba(col, 0.55)); g.addColorStop(1, rgba(col, 0));
	x.fillStyle = g; x.fillRect(0, 0, size, size);
	return c;
}

export function paintStars(x, w, hSky, { dark, count = 1600, seed = 11, bright = 40 }) {
	const p = PAL[dark ? "dark" : "light"];
	const r = rng(seed);
	const groups = new Map();
	for (let i = 0; i < count; i++) {
		const sx = r() * w, sy = Math.pow(r(), 1.12) * hSky;
		const ci = r() < 0.12 ? 2 : r() < 0.35 ? 1 : 0;
		const lvl = 1 + ((r() * 4) | 0);
		const sz = r() < 0.08 ? 1.6 : 0.8 + r() * 0.4;
		const key = ci * 100 + lvl * 10 + (sz > 1.2 ? 1 : 0);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(sx, sy, sz);
	}
	for (const [key, a] of groups) {
		const ci = (key / 100) | 0, lvl = ((key % 100) / 10) | 0;
		x.fillStyle = rgba(p.star[ci], (0.18 + lvl * 0.17) * p.starA);
		x.beginPath();
		for (let i = 0; i < a.length; i += 3) x.rect(a[i], a[i + 1], a[i + 2], a[i + 2]);
		x.fill();
	}
	// a few bright stars with halos
	const spr = p.star.map((c) => glowDot(24, c));
	for (let i = 0; i < bright; i++) {
		const sx = r() * w, sy = Math.pow(r(), 1.2) * hSky * 0.95, s = 8 + r() * 12;
		x.globalAlpha = (0.4 + r() * 0.5) * (dark ? 1 : 0.6);
		x.drawImage(spr[(r() * 3) | 0], sx - s / 2, sy - s / 2, s, s);
	}
	x.globalAlpha = 1;
}

// A tiny canvas of bright stars used as a CSS-opacity twinkle layer.
export function paintTwinkle(x, w, hSky, { dark, seed, n = 60 }) {
	const p = PAL[dark ? "dark" : "light"];
	const r = rng(seed);
	const spr = p.star.map((c) => glowDot(20, c));
	x.globalAlpha = dark ? 0.95 : 0.55;
	for (let i = 0; i < n; i++) {
		const s = 5 + r() * 7;
		x.drawImage(spr[(r() * 3) | 0], r() * w - s / 2, Math.pow(r(), 1.2) * hSky * 0.9 - s / 2, s, s);
	}
	x.globalAlpha = 1;
}

// Star trails around a pivot at the canvas centre. Arcs are batched by colour, width and fade step.
export function paintTrails(x, size, { dark, seed = 21, count = 900, len = 0.5 }) {
	const p = PAL[dark ? "dark" : "light"];
	const r = rng(seed);
	const R = size / 2, K = 14;
	x.save();
	x.translate(R, R);
	x.lineCap = "round";
	const cls = [];
	for (let i = 0; i < count; i++) {
		const rad = Math.sqrt(r()) * R * 0.98 + 6;
		const ci = r() < 0.12 ? 2 : r() < 0.35 ? 1 : 0;
		const big = r() < 0.1;
		cls.push({ rad, th: r() * TAU, ci, big, a: 0.35 + r() * 0.65, L: len * (0.85 + r() * 0.3) });
	}
	for (let ci = 0; ci < 3; ci++) {
		for (const big of [false, true]) {
			const set = cls.filter((s) => s.ci === ci && s.big === big);
			if (!set.length) continue;
			x.lineWidth = big ? 2 : 1;
			for (let k = 0; k < K; k++) {
				const f0 = k / K, f1 = (k + 1.15) / K;
				const al = Math.pow((k + 1) / K, 1.6) * 0.85 * p.starA * (dark ? 1 : 0.85);
				x.strokeStyle = rgba(p.star[ci], al);
				x.beginPath();
				for (const s of set) {
					// head at th, tail extends backwards
					const a0 = s.th - s.L * (1 - f0), a1 = s.th - s.L * Math.max(0, 1 - f1);
					x.moveTo(Math.cos(a0) * s.rad, Math.sin(a0) * s.rad);
					x.arc(0, 0, s.rad, a0, a1);
				}
				x.stroke();
			}
		}
	}
	// pole star
	const g = glowDot(40, dark ? [255, 248, 230] : [90, 70, 170]);
	x.drawImage(g, -14, -14, 28, 28);
	x.fillStyle = dark ? "#fff" : "#3a2f8a";
	x.beginPath(); x.arc(0, 0, 1.8, 0, TAU); x.fill();
	x.restore();
}

export function paintLand(w, h, dpr, dark, wy, seed = 7) {
	const p = PAL[dark ? "dark" : "light"];
	const pad = 60;
	const back = mk(w, h + pad, dpr), front = mk(w, h + pad, dpr);
	const bx = back.x;
	const variants = makePineVariants(91, 8);
	const far = ridgeGeo({ w, h, baseY: h * 0.62, amp: h * 0.34, scale: w * 0.26, seed, power: 1.15, x0: 2.3 });
	paintRidge(bx, far, { ...p.far, depth: 70, light: 1 });
	const mid = ridgeGeo({ w, h, baseY: h * 0.69, amp: h * 0.13, scale: w * 0.16, seed: seed + 14, power: 1.2 });
	paintRidge(bx, mid, { ...p.mid, depth: 70, light: 1 });
	paintForest(bx, forestGeo({ w, h, ridge: mid, rows: 3, rowGap: 6, tree: [9, 15], gap: [4, 7], seed: seed + 24, bottom: wy }), variants, p.midTrees);
	bx.clearRect(0, wy, w, h + pad - wy);
	// reflection
	const d = Math.min(h + pad - wy, h * 0.3);
	const dp = Math.ceil(d * dpr);
	const tmp = document.createElement("canvas");
	tmp.width = back.c.width; tmp.height = dp;
	const tx = tmp.getContext("2d");
	tx.setTransform(1, 0, 0, -1, 0, dp);
	tx.drawImage(back.c, 0, Math.floor((wy - d) * dpr), back.c.width, dp, 0, 0, back.c.width, dp);
	tx.setTransform(1, 0, 0, 1, 0, 0);
	tx.globalCompositeOperation = "destination-in";
	const rg = tx.createLinearGradient(0, 0, 0, dp);
	rg.addColorStop(0, "rgba(0,0,0,.55)"); rg.addColorStop(1, "rgba(0,0,0,0)");
	tx.fillStyle = rg; tx.fillRect(0, 0, tmp.width, dp);
	bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.drawImage(tmp, 0, Math.round(wy * dpr)); bx.restore();
	// shore pines
	const r = rng(77);
	const shore = [];
	for (let sx = -20; sx < w + 20; sx += 11 + r() * 20) {
		const clump = Math.sin(sx * 0.013) * 0.5 + 0.5;
		shore.push({ x: sx, y: wy + 2 + r() * 5, h: h * (0.03 + r() * 0.03 + clump * 0.03), v: (r() * 8) | 0, b: (r() * 3) | 0 });
	}
	paintForest(bx, { trees: shore }, variants, p.shore);
	// foreground promontories + big pines at the edges
	const fx = front.x;
	const L = { x1: w * 0.28, top: wy - h * 0.045, seed: 3 }, R = { x1: w * 0.76, top: wy - h * 0.02, seed: 9 };
	const landY = (side, sx) => {
		const A = side === "l" ? L : R;
		const u = side === "l" ? (sx + 120) / (A.x1 + 120) : (w + 120 - sx) / (w + 120 - A.x1);
		return lerp(A.top, h + pad + 20, Math.pow(clamp(u), 2.2)) + Math.sin(sx * 0.09 + A.seed) * 3;
	};
	for (const side of ["l", "r"]) {
		const [a, b] = side === "l" ? [-120, L.x1 + 20] : [R.x1 - 20, w + 120];
		fx.beginPath();
		fx.moveTo(a, h + pad + 40);
		for (let sx = a; sx <= b; sx += 6) fx.lineTo(sx, landY(side, sx));
		fx.lineTo(b, h + pad + 40);
		fx.closePath();
		const gl = fx.createLinearGradient(0, h * 0.7, 0, h + pad);
		gl.addColorStop(0, rgba(p.land[0])); gl.addColorStop(1, rgba(p.land[1]));
		fx.fillStyle = gl; fx.fill();
	}
	const trees = [];
	const place = (side, n, big) => {
		for (let i = 0; i < n; i++) {
			const t = (i + r()) / n;
			const sx = side === "l" ? lerp(-30, w * 0.24, Math.pow(t, 0.8)) : lerp(w + 30, w * 0.8, Math.pow(t, 0.8));
			const hh = h * (big ? lerp(0.52, 0.2, Math.pow(t, 0.7)) : lerp(0.4, 0.17, Math.pow(t, 0.7))) * (0.85 + r() * 0.3);
			trees.push({ x: sx, y: landY(side, sx) + 10 + r() * 10, h: hh, v: (r() * 8) | 0, b: (r() * 3) | 0 });
		}
	};
	place("l", 8, true); place("r", 7, false);
	trees.sort((a, b) => a.y - b.y);
	// wider trees: paintForest scales width by tree height, matching #91
	paintForest(fx, { trees }, variants, p.fg);
	return { back: back.c, front: front.c, pad };
}

// ---------------- Scene ----------------
export function createNight({ root, reducedMotion, aurora = {}, milky = 0, stars = true, trails = false, twinkle = true, starsAbove = false, wyFrac = 0.8, onStep }) {
	const host = root.querySelector(".scenery-a");
	const el = document.createElement("div");
	el.className = "ad-root";
	host.appendChild(el);
	const mkc = (cls) => { const c = document.createElement("canvas"); if (cls) c.className = cls; return c; };
	const bg = mkc(), auroraC = mkc();
	const clip = document.createElement("div");
	clip.className = "ad-clip";
	let starsC = null, tw1 = null, tw2 = null, trailWrap = null, trailC = null;
	if (trails) { trailWrap = document.createElement("div"); trailWrap.className = "ad-spin"; trailWrap.style.cssText = "position:absolute"; trailC = mkc(); trailWrap.appendChild(trailC); clip.appendChild(trailWrap); }
	else if (stars) { starsC = mkc(); clip.appendChild(starsC); if (twinkle) { tw1 = mkc("ad-tw"); tw2 = mkc("ad-tw b"); clip.append(tw1, tw2); } }
	const landB = mkc("ad-land"), landF = mkc("ad-land");
	el.append(bg);
	if (starsAbove) el.append(auroraC, clip); else el.append(clip, auroraC);
	el.append(landB, landF);

	let dark = isDark(), dead = false, gen = 0, W = 0, H = 0, dpr = 1, wy = 0, built = false;
	const cleanups = [];
	const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); cleanups.push(() => t.removeEventListener(type, fn, o)); };
	const aur = new Aurora(auroraC, { dark, wy: wyFrac, ...aurora });
	const ptr = { x: 0, y: 0, active: false, speed: 0, t: 0 };
	const api = { el, clip, aurora: aur, ptr, on, reduced: !!reducedMotion, get w() { return W; }, get h() { return H; }, get wy() { return wy; }, get dark() { return dark; }, get dpr() { return dpr; }, root, ready: false, afterBuild: null, onDark: null };

	// ---- pointer ----
	on(window, "pointermove", (e) => {
		const r = host.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		const now = e.timeStamp || performance.now();
		if (ptr.active && now > ptr.t) { const sp = Math.hypot(x - ptr.x, y - ptr.y) / ((now - ptr.t) / 1000); ptr.speed = Math.max(ptr.speed * 0.6, Math.min(2500, sp)); }
		ptr.x = x; ptr.y = y; ptr.t = now; ptr.active = e.pointerType !== "touch" || ptr.active;
		if (e.pointerType === "touch") ptr.active = true;
		if (reducedMotion) wakeStatic();
		else wake();
	}, { passive: true });
	on(document.documentElement, "pointerleave", () => { ptr.active = false; if (reducedMotion) wakeStatic(); });
	on(window, "pointerup", (e) => { if (e.pointerType === "touch") ptr.active = false; }, { passive: true });

	// ---- loop ----
	let timer = 0, raf = 0, last = 0;
	function tick() {
		timer = 0; raf = 0;
		if (dead || document.hidden || reducedMotion) return;
		const now = performance.now();
		const dt = Math.min(0.1, (now - last) / 1000 || 0.04);
		last = now;
		ptr.speed *= Math.exp(-dt * 4);
		aur.step(dt, ptr, false);
		onStep?.(dt);
		aur.draw();
		schedule();
	}
	function schedule() {
		if (dead || timer || raf || document.hidden || reducedMotion) return;
		const delay = aur.busy ? 16 : 45; // ~30fps when reacting, ~20fps idle drift
		timer = setTimeout(() => { timer = 0; raf = requestAnimationFrame(tick); }, delay);
	}
	function wake() { if (!built) return; schedule(); }
	let staticRaf = 0;
	function wakeStatic() {
		if (staticRaf || !built) return;
		staticRaf = requestAnimationFrame(() => { staticRaf = 0; aur.step(0, ptr, true); aur.draw(); });
	}
	api.wake = wake;
	api.redraw = () => { aur.draw(); };
	api.flash = (v) => { aur.flash = Math.min(1.6, aur.flash + v); if (reducedMotion) { aur.draw(); clearTimeout(api._ft); api._ft = setTimeout(() => { aur.flash = 0; aur.draw(); }, 900); } else wake(); };
	on(document, "visibilitychange", () => { if (document.hidden) { clearTimeout(timer); cancelAnimationFrame(raf); timer = raf = 0; } else { last = performance.now(); schedule(); } });

	// ---- scroll parallax ----
	let sRaf = 0;
	const parallax = () => {
		sRaf = 0;
		const t = clamp(root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight));
		landB.style.transform = `translate3d(0,${(-t * 18).toFixed(1)}px,0)`;
		landF.style.transform = `translate3d(0,${(-t * 46).toFixed(1)}px,0)`;
	};
	on(root, "scroll", () => { if (!sRaf) sRaf = requestAnimationFrame(parallax); }, { passive: true });

	// ---- build ----
	async function rebuild() {
		const my = ++gen;
		const w = host.clientWidth, h = host.clientHeight;
		if (!w || !h) return;
		W = w; H = h; dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		wy = Math.round(h * wyFrac);
		aur.resize(w, h);
		aur.draw();
		clip.style.width = `${w}px`; clip.style.height = `${wy}px`;
		const step = async (fn) => { await idle(); if (my !== gen || dead) return false; fn(); return true; };
		if (!(await step(() => {
			const x = sizeCanvas(bg, w, h, 1);
			paintSky(x, w, h, wy, dark);
			if (milky) paintMilky(x, w, wy, { dark, strength: milky });
		}))) return;
		if (starsC && !(await step(() => {
			const x = sizeCanvas(starsC, w, wy, dpr);
			paintStars(x, w, wy, { dark, count: Math.round((w * wy) / 520) });
			if (tw1) { paintTwinkle(sizeCanvas(tw1, w, wy, 1), w, wy, { dark, seed: 3 }); paintTwinkle(sizeCanvas(tw2, w, wy, 1), w, wy, { dark, seed: 4 }); }
		}))) return;
		if (trailC && !(await step(() => {
			const px = w * 0.74, py = wy * 0.3;
			const Rr = Math.hypot(Math.max(px, w - px), Math.max(py, wy - py)) + 20;
			const sc = Math.min(0.8, 2400 / (2 * Rr));
			const size = Math.ceil(2 * Rr);
			trailWrap.style.cssText = `position:absolute;left:${px - size / 2}px;top:${py - size / 2}px;width:${size}px;height:${size}px;transform-origin:50% 50%`;
			trailC.width = Math.ceil(size * sc); trailC.height = trailC.width;
			trailC.style.width = `${size}px`; trailC.style.height = `${size}px`;
			paintTrails(trailC.getContext("2d"), trailC.width, { dark, count: Math.round(Math.min(1100, (size * size * sc * sc) / 3200)), len: 0.5 });
		}))) return;
		if (!(await step(() => {
			const L = paintLand(w, h, dpr, dark, wy);
			for (const [c, src] of [[landB, L.back], [landF, L.front]]) {
				c.width = src.width; c.height = src.height;
				c.style.width = `${w}px`; c.style.height = `${h + L.pad}px`;
				c.getContext("2d").drawImage(src, 0, 0);
			}
		}))) return;
		built = true; api.ready = true;
		parallax();
		api.afterBuild?.();
		if (reducedMotion) wakeStatic(); else { last = performance.now(); schedule(); }
	}
	let rt = 0;
	const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(rebuild, built ? 140 : 0); });
	ro.observe(host);
	const mo = new MutationObserver(() => {
		const d = isDark();
		if (d !== dark) { dark = d; api.onDark?.(d); aur.dark = d; if (aur.gl) { aur.gl.uniform1f(aur.u.uDark, d ? 1 : 0); } clearTimeout(rt); rt = setTimeout(rebuild, 0); }
	});
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	api.hint = (text) => {
		const d = document.createElement("div");
		d.className = "ad-hint";
		d.textContent = text;
		(root.querySelector(".overlay-b") || root).appendChild(d);
		return { el: d, hide() { d.classList.add("is-gone"); } };
	};
	api.destroy = () => {
		dead = true;
		clearTimeout(timer); clearTimeout(rt); clearTimeout(api._ft);
		cancelAnimationFrame(raf); cancelAnimationFrame(sRaf); cancelAnimationFrame(staticRaf);
		ro.disconnect(); mo.disconnect();
		cleanups.forEach((f) => f());
		aur.destroy();
		el.remove();
	};
	return api;
}

// Taps on empty sky (not links/buttons/text selections).
export function isEmptyAt(root, cx, cy) {
	const e = document.elementFromPoint(cx, cy);
	if (!e || (!root.contains(e) && e !== root)) return false;
	if (e.closest("a,button,input,select,textarea,label,[contenteditable]")) return false;
	if (e === root) return true;
	return ["DIV", "MAIN", "SECTION", "HEADER", "FOOTER", "UL", "OL", "NAV"].includes(e.tagName);
}
export function onEmptyTap(scene, fn) {
	let d = null;
	scene.on(window, "pointerdown", (e) => { d = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
	scene.on(window, "pointerup", (e) => {
		if (!d) return;
		const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y), quick = performance.now() - d.t < 600;
		d = null;
		if (moved > 6 || !quick) return;
		const sel = window.getSelection();
		if (sel && !sel.isCollapsed) return;
		if (isEmptyAt(scene.root, e.clientX, e.clientY)) {
			const r = scene.el.getBoundingClientRect();
			fn(e.clientX - r.left, e.clientY - r.top, e);
		}
	});
}

// Sparse #91-style birds: a small loose flock and a rare goose V. The loop runs only while a group is on screen.
export function addBirds(scene, { seed = 5 } = {}) {
	const cv = document.createElement("canvas");
	cv.style.cssText = "position:absolute;left:0;top:0;pointer-events:none";
	scene.el.insertBefore(cv, scene.el.querySelector(".ad-land"));
	const flock = new Flock({ seed, groups: 1, perGroup: [4, 6], size: [3.4, 5], band: [0.1, 0.38], speed: [40, 62], respawn: [14, 30], flap: [6, 9] });
	const geese = new Flock({ seed: seed + 3, groups: 1, perGroup: [5, 7], size: [6, 7.5], band: [0.08, 0.2], speed: [30, 38], formation: "v", respawn: [30, 60], flap: [2.4, 3] });
	flock.groups[0].wait = 5 + Math.random() * 6;
	geese.groups[0].wait = 18 + Math.random() * 20;
	let cx = null, raf = 0, timer = 0, last = 0, dead = false;
	const cols = () => (scene.dark ? ["rgba(190,205,235,.3)", "rgba(200,214,240,.4)", "rgba(215,226,248,.5)"] : ["rgba(60,60,110,.4)", "rgba(50,50,100,.5)", "rgba(40,40,90,.6)"]);
	const any = () => flock.groups[0].active || geese.groups[0].active;
	const draw = () => { cx.clearRect(0, 0, cv.width, cv.height); flock.draw(cx, cols()); geese.draw(cx, cols()); };
	function loop(now) {
		raf = 0;
		if (dead || document.hidden) return;
		const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
		last = now;
		flock.update(dt, { wind: 0.5, perches: [] });
		geese.update(dt, { wind: 0.5, perches: [] });
		draw();
		if (any()) raf = requestAnimationFrame(loop);
		else { cx.clearRect(0, 0, cv.width, cv.height); poll(); }
	}
	function poll() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (dead) return;
			if (document.hidden) return poll();
			flock.update(1, {}); geese.update(1, {});
			if (any()) { last = performance.now(); raf = requestAnimationFrame(loop); } else poll();
		}, 1000);
	}
	const prev = scene.afterBuild;
	scene.afterBuild = () => {
		prev?.();
		cv.width = scene.w; cv.height = scene.wy;
		cv.style.width = `${scene.w}px`; cv.style.height = `${scene.wy}px`;
		cx = cv.getContext("2d");
		flock.resize(scene.w, scene.wy); geese.resize(scene.w, scene.wy);
		if (scene.reduced) { flock.spawn(flock.groups[0], true); draw(); }
		else if (!raf && !timer) poll();
	};
	return () => { dead = true; cancelAnimationFrame(raf); clearTimeout(timer); };
}
