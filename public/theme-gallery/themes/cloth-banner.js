// #62 Cloth Banner: the hero title is printed on a pinned 3D Verlet cloth, rendered as a lit WebGL mesh.
// Pointer = wind. Swipe fast (or yank hard) and the fabric tears, then zips itself back together.
import { bindKeys, clamp, createLoop, createPill, dprCap } from "./physics-kit/kit.js";

const M = 72; // canvas margin around the banner (css px)
const STEP = 1 / 60;
const ITER = 9;
const DAMP = 0.992;
const GRAVITY = 1500;
const TEAR_STRETCH = 2.15;
const SWIPE_SPEED = 1900;

const VERT = `
attribute vec2 aPos; attribute vec2 aUv; attribute vec2 aLight;
uniform vec2 uRes; uniform vec2 uOffset; uniform float uShadow;
varying vec2 vUv; varying vec2 vLight;
void main(){
  vec2 p = aPos + uOffset;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
  vUv = aUv; vLight = aLight;
}`;
const FRAG = `
precision mediump float;
uniform sampler2D uTex; uniform float uShadow;
varying vec2 vUv; varying vec2 vLight;
void main(){
  vec4 t = texture2D(uTex, vUv);
  if (uShadow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 0.13 * t.a) ; return; }
  vec3 c = t.rgb * vLight.x + vec3(vLight.y) * t.a;
  gl_FragColor = vec4(c, t.a);
}`;

export function activate({ root, reducedMotion, mode }) {
	const dark = mode === "dark";
	const title = root.querySelector(".site-title");
	const tagline = root.querySelector(".site-tagline");
	const heroText = root.querySelector(".site-hero-text");
	if (!title || !tagline || !heroText) return undefined;

	// Wrap the title + tagline into a banner box; the socials stay below as real links.
	const banner = document.createElement("div");
	banner.className = "cloth-banner";
	heroText.insertBefore(banner, title);
	banner.append(title, tagline);
	const rod = document.createElement("div");
	rod.className = "cloth-rod";
	rod.setAttribute("aria-hidden", "true");
	banner.append(rod);
	const hint = document.createElement("p");
	hint.className = "cloth-hint";
	hint.innerHTML = "Pointer is the wind · <b>swipe fast</b> to tear · grab to pull";
	banner.after(hint);

	const canvas = document.createElement("canvas");
	canvas.className = "cloth-canvas";
	canvas.setAttribute("aria-hidden", "true");
	banner.append(canvas);
	const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true });
	if (!gl) {
		canvas.remove();
		return undefined;
	}

	let disposed = false;
	let nx = 0;
	let ny = 0;
	let W = 0;
	let H = 0;
	let dpr = 1;
	let time = 0;
	let visible = true;
	let wake = () => {};

	// Particles
	let X, Y, Z, PX, PY, PZ, pinned, restX, restY;
	// Constraints
	let ca, cb, crest, ctarget, cactive, ctype, cquadA, cquadB, tornAt, cCount;
	let quadDiag, quadEdges, cut;
	let torn = [];
	// Render buffers
	let verts, indices, vbo, ibo, tex, prog, loc;
	let nIndices = 0;

	const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, lastX: -9999, lastY: -9999, lastT: 0, inside: false, active: 0 };
	let grab; // {idx:[...], w:[...]}
	let scrollSpeed = 0;
	let lastScroll = root.scrollTop;
	let reknitClock = 0;

	function build() {
		const rect = banner.getBoundingClientRect();
		W = Math.round(rect.width);
		H = Math.round(rect.height);
		dpr = dprCap(1.5);
		canvas.width = Math.round((W + M * 2) * dpr);
		canvas.height = Math.round((H + M * 2) * dpr);
		nx = clamp(Math.round(W / 17), 12, 44);
		ny = clamp(Math.round(H / 17), 6, 20);
		const n = nx * ny;
		X = new Float32Array(n);
		Y = new Float32Array(n);
		Z = new Float32Array(n);
		PX = new Float32Array(n);
		PY = new Float32Array(n);
		PZ = new Float32Array(n);
		restX = new Float32Array(n);
		restY = new Float32Array(n);
		pinned = new Uint8Array(n);
		const sx = W / (nx - 1);
		const sy = H / (ny - 1);
		for (let j = 0; j < ny; j++) {
			for (let i = 0; i < nx; i++) {
				const k = j * nx + i;
				restX[k] = X[k] = PX[k] = M + i * sx;
				restY[k] = Y[k] = PY[k] = M + j * sy;
			}
		}
		// Pins: five evenly spaced grommets along the top edge, hanging the cloth in soft swags.
		const pins = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (nx - 1)));
		for (const i of pins) pinned[i] = 1;
		buildConstraints(sx, sy);
		buildTexture(pins);
		buildGL();
		// A little settling impulse so it is already breathing on first paint.
		if (!reducedMotion) {
			for (let s = 0; s < 40; s++) simulate(STEP, true);
		}
		draw();
	}

	function buildConstraints(sx, sy) {
		const list = [];
		const quads = (nx - 1) * (ny - 1);
		quadDiag = new Int32Array(quads * 2).fill(-1);
		quadEdges = new Int32Array(quads * 4).fill(-1); // top,bottom,left,right edge constraint idx
		cut = new Uint8Array(quads);
		const edgeId = { h: new Int32Array(nx * ny).fill(-1), v: new Int32Array(nx * ny).fill(-1) };
		const q = (i, j) => (i < 0 || j < 0 || i >= nx - 1 || j >= ny - 1 ? -1 : j * (nx - 1) + i);
		for (let j = 0; j < ny; j++) {
			for (let i = 0; i < nx; i++) {
				const k = j * nx + i;
				if (i < nx - 1) {
					edgeId.h[k] = list.length;
					list.push([k, k + 1, sx, 0, q(i, j - 1), q(i, j)]);
				}
				if (j < ny - 1) {
					edgeId.v[k] = list.length;
					list.push([k, k + nx, sy, 1, q(i - 1, j), q(i, j)]);
				}
			}
		}
		const diag = Math.hypot(sx, sy);
		for (let j = 0; j < ny - 1; j++) {
			for (let i = 0; i < nx - 1; i++) {
				const k = j * nx + i;
				const qq = q(i, j);
				quadDiag[qq * 2] = list.length;
				list.push([k, k + nx + 1, diag, 2, qq, -1]);
				quadDiag[qq * 2 + 1] = list.length;
				list.push([k + 1, k + nx, diag, 2, qq, -1]);
				quadEdges[qq * 4] = edgeId.h[k];
				quadEdges[qq * 4 + 1] = edgeId.h[k + nx];
				quadEdges[qq * 4 + 2] = edgeId.v[k];
				quadEdges[qq * 4 + 3] = edgeId.v[k + 1];
			}
		}
		cCount = list.length;
		ca = new Int32Array(cCount);
		cb = new Int32Array(cCount);
		crest = new Float32Array(cCount);
		ctarget = new Float32Array(cCount);
		ctype = new Uint8Array(cCount);
		cquadA = new Int32Array(cCount);
		cquadB = new Int32Array(cCount);
		cactive = new Uint8Array(cCount).fill(1);
		tornAt = new Float32Array(cCount);
		list.forEach(([a, b, r, t, qa, qb], c) => {
			ca[c] = a;
			cb[c] = b;
			crest[c] = ctarget[c] = r;
			ctype[c] = t;
			cquadA[c] = qa;
			cquadB[c] = qb;
		});
		torn = [];
	}

	function buildTexture(pins) {
		const S = 2; // texture scale
		const tw = Math.round(W * S);
		const th = Math.round(H * S);
		const c = document.createElement("canvas");
		c.width = tw;
		c.height = th;
		const g = c.getContext("2d");
		const cs = getComputedStyle(root);
		const gold = cs.getPropertyValue("--siteSquiggle").trim() || "#e5a823";
		const base = dark ? "#1b3a96" : "#1f4fcf";
		const base2 = dark ? "#10246a" : "#17389a";
		g.scale(S, S);
		// Fabric body with a slight vertical gradient.
		const grad = g.createLinearGradient(0, 0, 0, H);
		grad.addColorStop(0, base);
		grad.addColorStop(1, base2);
		g.fillStyle = grad;
		g.fillRect(0, 0, W, H);
		// Swallow-tail notch cut from the bottom edge.
		g.save();
		g.globalCompositeOperation = "destination-out";
		g.beginPath();
		g.moveTo(W * 0.5 - W * 0.07, H + 1);
		g.lineTo(W * 0.5, H - H * 0.13);
		g.lineTo(W * 0.5 + W * 0.07, H + 1);
		g.closePath();
		g.fill();
		g.restore();
		// Weave.
		g.globalAlpha = 0.09;
		g.fillStyle = "#fff";
		for (let x = 0; x < W; x += 3) g.fillRect(x, 0, 1, H);
		g.globalAlpha = 0.07;
		g.fillStyle = "#000";
		for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
		g.globalAlpha = 1;
		// Gold border band + stitching.
		g.strokeStyle = gold;
		g.lineWidth = 4;
		g.beginPath();
		g.moveTo(10, 28);
		g.lineTo(10, H - 12);
		g.lineTo(W * 0.5 - W * 0.065, H - 12);
		g.lineTo(W * 0.5, H - H * 0.13 - 8);
		g.lineTo(W * 0.5 + W * 0.065, H - 12);
		g.lineTo(W - 10, H - 12);
		g.lineTo(W - 10, 28);
		g.stroke();
		g.setLineDash([5, 5]);
		g.lineWidth = 1.5;
		g.strokeStyle = "rgb(255 255 255 / 0.7)";
		g.beginPath();
		g.moveTo(19, 32);
		g.lineTo(19, H - 21);
		g.lineTo(W * 0.5 - W * 0.06, H - 21);
		g.lineTo(W * 0.5, H - H * 0.13 - 15);
		g.lineTo(W * 0.5 + W * 0.06, H - 21);
		g.lineTo(W - 19, H - 21);
		g.lineTo(W - 19, 32);
		g.stroke();
		g.setLineDash([]);
		// Top hem strip where the grommets sit.
		g.fillStyle = "rgb(0 0 0 / 0.18)";
		g.fillRect(0, 0, W, 26);
		g.fillStyle = "rgb(255 255 255 / 0.12)";
		g.fillRect(0, 26, W, 1.5);
		for (const i of pins) {
			const gx = Math.min(Math.max((i / (nx - 1)) * W, 11), W - 11);
			g.fillStyle = "#e9eefc";
			g.beginPath();
			g.arc(gx, 13, 6.5, 0, Math.PI * 2);
			g.fill();
			g.strokeStyle = gold;
			g.lineWidth = 2.2;
			g.stroke();
			g.fillStyle = "#0a1030";
			g.beginPath();
			g.arc(gx, 13, 3, 0, Math.PI * 2);
			g.fill();
		}
		// Printed text, aligned to the real DOM text so selection lines up.
		const br = banner.getBoundingClientRect();
		const paint = (el, color, weightFallback) => {
			const r = el.getBoundingClientRect();
			const s = getComputedStyle(el);
			g.font = `${s.fontStyle} ${s.fontWeight || weightFallback} ${s.fontSize} ${s.fontFamily}`;
			g.fillStyle = color;
			g.textBaseline = "alphabetic";
			if ("fontVariationSettings" in g) g.fontVariationSettings = s.fontVariationSettings;
			const fs = Number.parseFloat(s.fontSize);
			const lh = Number.parseFloat(s.lineHeight) || fs * 1.2;
			const range = document.createRange();
			range.selectNodeContents(el);
			const lines = new Map();
			// Walk words to recover each wrapped line's text and origin.
			const textNode = el.firstChild;
			const words = textNode.nodeValue.split(/(\s+)/);
			let offset = 0;
			for (const w of words) {
				if (w.trim()) {
					range.setStart(textNode, offset);
					range.setEnd(textNode, offset + w.length);
					const wr = range.getBoundingClientRect();
					const key = Math.round(wr.top);
					const line = lines.get(key) ?? { x: wr.left, top: wr.top, h: wr.height, text: "" };
					line.text += (line.text ? " " : "") + w;
					lines.set(key, line);
				}
				offset += w.length;
			}
			const metrics = g.measureText("Hg");
			for (const line of lines.values()) {
				const baseline = line.top + (line.h - (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent)) / 2 + metrics.fontBoundingBoxAscent;
				g.fillText(line.text, line.x - br.left, baseline - br.top);
			}
			return { r, lh };
		};
		g.save();
		g.shadowColor = "rgb(0 0 0 / 0.35)";
		g.shadowBlur = 3;
		g.shadowOffsetY = 1.5;
		const t = paint(title, "#ffffff", 800);
		g.restore();
		paint(tagline, "rgb(232 240 255 / 0.95)", 400);
		// Brand squiggle under the title.
		const tr = t.r;
		g.strokeStyle = gold;
		g.lineWidth = 3.2;
		g.lineCap = "round";
		g.beginPath();
		const sy0 = tr.bottom - br.top + 2;
		for (let x = tr.left - br.left; x < Math.min(tr.right - br.left, W - 24); x += 2) {
			const y = sy0 + Math.sin((x - (tr.left - br.left)) * 0.55) * 2.6;
			x === tr.left - br.left ? g.moveTo(x, y) : g.lineTo(x, y);
		}
		g.stroke();
		canvasTex = c;
	}
	let canvasTex;

	function shader(type, src) {
		const s = gl.createShader(type);
		gl.shaderSource(s, src);
		gl.compileShader(s);
		return s;
	}

	function buildGL() {
		prog = gl.createProgram();
		gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
		gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
		gl.linkProgram(prog);
		gl.useProgram(prog);
		loc = {
			pos: gl.getAttribLocation(prog, "aPos"),
			uv: gl.getAttribLocation(prog, "aUv"),
			light: gl.getAttribLocation(prog, "aLight"),
			res: gl.getUniformLocation(prog, "uRes"),
			off: gl.getUniformLocation(prog, "uOffset"),
			shadow: gl.getUniformLocation(prog, "uShadow"),
		};
		const n = nx * ny;
		verts = new Float32Array(n * 6);
		for (let j = 0; j < ny; j++) {
			for (let i = 0; i < nx; i++) {
				const k = (j * nx + i) * 6;
				verts[k + 2] = i / (nx - 1);
				verts[k + 3] = j / (ny - 1);
			}
		}
		indices = new Uint16Array((nx - 1) * (ny - 1) * 6);
		vbo = gl.createBuffer();
		ibo = gl.createBuffer();
		tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasTex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.viewport(0, 0, canvas.width, canvas.height);
		canvasTex = undefined;
	}

	// ---------------------------------------------------------------- simulation

	function simulate(dt, quiet) {
		time += dt;
		const g = GRAVITY * dt * dt;
		const n = nx * ny;
		const wt = time;
		const ambient = reducedMotion ? 0 : 1;
		const gust = reducedMotion ? 0 : Math.min(1, scrollSpeed / 1800);
		for (let k = 0; k < n; k++) {
			if (pinned[k] || (grab && grab.set.has(k))) continue;
			const x = X[k];
			const y = Y[k];
			const z = Z[k];
			let vx = (x - PX[k]) * DAMP;
			let vy = (y - PY[k]) * DAMP;
			let vz = (z - PZ[k]) * (DAMP - 0.004);
			PX[k] = x;
			PY[k] = y;
			PZ[k] = z;
			// Billowing breeze: a travelling wave plus slow gusts, strongest toward the free bottom.
			const fy = (y - M) / H;
			const wave = Math.sin(wt * 1.7 + x * 0.013 + y * 0.011) * 0.6 + Math.sin(wt * 0.63 - x * 0.006) * 0.7 + 0.35;
			const az = ((ambient * 520 * wave) + gust * 900 * Math.sin(wt * 9 + x * 0.02)) * (0.25 + fy * 0.9);
			vz += az * dt * dt;
			vx += ambient * Math.sin(wt * 0.8 + y * 0.01) * 60 * dt * dt * (0.3 + fy);
			X[k] = x + vx;
			Y[k] = y + vy + g;
			Z[k] = z + vz - Z[k] * 0.0009;
		}
		// Pointer wind.
		if (pointer.active > 0) {
			const R = 105;
			const sp = Math.hypot(pointer.vx, pointer.vy);
			for (let k = 0; k < n; k++) {
				if (pinned[k]) continue;
				const dx = X[k] - pointer.x;
				const dy = Y[k] - pointer.y;
				const d2 = dx * dx + dy * dy;
				if (d2 > R * R) continue;
				const w = (1 - Math.sqrt(d2) / R) ** 2;
				X[k] += pointer.vx * w * 0.0021 * dt * 60;
				Y[k] += pointer.vy * w * 0.0021 * dt * 60;
				Z[k] -= Math.min(sp, 2600) * w * 0.0022 * dt * 60;
			}
			pointer.active -= dt;
			pointer.vx *= 0.9;
			pointer.vy *= 0.9;
		}
		// Grab.
		if (grab) {
			for (const k of grab.idx) {
				const w = grab.w.get(k);
				const tx = pointer.x + grab.ox.get(k);
				const ty = pointer.y + grab.oy.get(k);
				X[k] += (tx - X[k]) * 0.55 * w;
				Y[k] += (ty - Y[k]) * 0.55 * w;
				Z[k] += (30 * w - Z[k]) * 0.3;
				PX[k] = X[k];
				PY[k] = Y[k];
				PZ[k] = Z[k];
			}
		}
		// Relax rest lengths (zip-up after re-knit).
		for (let c = 0; c < cCount; c++) {
			if (crest[c] !== ctarget[c]) {
				crest[c] += (ctarget[c] - crest[c]) * 0.06;
				if (Math.abs(crest[c] - ctarget[c]) < 0.05) crest[c] = ctarget[c];
			}
		}
		for (let it = 0; it < ITER; it++) {
			for (let c = 0; c < cCount; c++) {
				if (!cactive[c]) continue;
				const a = ca[c];
				const b = cb[c];
				const dx = X[b] - X[a];
				const dy = Y[b] - Y[a];
				const dz = Z[b] - Z[a];
				const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4;
				const diff = (d - crest[c]) / d;
				let wa = pinned[a] || (grab && grab.set.has(a)) ? 0 : 0.5;
				let wb = pinned[b] || (grab && grab.set.has(b)) ? 0 : 0.5;
				if (wa + wb === 0) continue;
				if (wa === 0) wb = 1;
				if (wb === 0) wa = 1;
				X[a] += dx * diff * wa;
				Y[a] += dy * diff * wa;
				Z[a] += dz * diff * wa;
				X[b] -= dx * diff * wb;
				Y[b] -= dy * diff * wb;
				Z[b] -= dz * diff * wb;
			}
		}
		// Tear by overstretch.
		if (!quiet) {
			for (let c = 0; c < cCount; c++) {
				if (!cactive[c] || ctype[c] === 2 || crest[c] !== ctarget[c]) continue;
				const a = ca[c];
				const b = cb[c];
				const d = Math.hypot(X[b] - X[a], Y[b] - Y[a], Z[b] - Z[a]);
				if (d > ctarget[c] * TEAR_STRETCH) tear(c);
			}
			// Zip torn edges back together, oldest first, once the fabric is calm.
			reknitClock += dt;
			if (torn.length && reknitClock > 0.03 && !grab) {
				const c = torn[0];
				if (time - tornAt[c] > 2.4 && !(pointer.active > 0 && Math.hypot(X[ca[c]] - pointer.x, Y[ca[c]] - pointer.y) < 90)) {
					reknitClock = 0;
					torn.shift();
					knit(c);
				}
			}
		}
	}

	function tear(c) {
		if (!cactive[c]) return;
		cactive[c] = 0;
		tornAt[c] = time;
		torn.push(c);
		for (const q of [cquadA[c], cquadB[c]]) {
			if (q < 0) continue;
			cut[q] = 1;
			cactive[quadDiag[q * 2]] = 0;
			cactive[quadDiag[q * 2 + 1]] = 0;
		}
	}

	function knit(c) {
		const set = (idx) => {
			const a = ca[idx];
			const b = cb[idx];
			crest[idx] = Math.min(Math.hypot(X[b] - X[a], Y[b] - Y[a], Z[b] - Z[a]), ctarget[idx] * 6);
			cactive[idx] = 1;
		};
		set(c);
		for (const q of [cquadA[c], cquadB[c]]) {
			if (q < 0) continue;
			let any = false;
			for (let e = 0; e < 4; e++) if (!cactive[quadEdges[q * 4 + e]]) any = true;
			cut[q] = any ? 1 : 0;
			if (!any) {
				set(quadDiag[q * 2]);
				set(quadDiag[q * 2 + 1]);
			}
		}
	}

	function energy() {
		let e = 0;
		const n = nx * ny;
		for (let k = 0; k < n; k++) e += Math.abs(X[k] - PX[k]) + Math.abs(Y[k] - PY[k]) + Math.abs(Z[k] - PZ[k]);
		return e / n;
	}

	// ---------------------------------------------------------------- render

	const LX = -0.38;
	const LY = -0.5;
	const LZ = 0.78;
	const LL = Math.hypot(LX, LY, LZ);
	function draw() {
		if (!verts) return;
		const cx = M + W / 2;
		const cy = M + H / 2;
		const CAM = 1000;
		const n = nx * ny;
		// Project and light each vertex.
		for (let j = 0; j < ny; j++) {
			for (let i = 0; i < nx; i++) {
				const k = j * nx + i;
				const s = CAM / (CAM - Z[k]);
				const o = k * 6;
				verts[o] = cx + (X[k] - cx) * s;
				verts[o + 1] = cy + (Y[k] - cy) * s;
				const il = i > 0 ? k - 1 : k;
				const ir = i < nx - 1 ? k + 1 : k;
				const ju = j > 0 ? k - nx : k;
				const jd = j < ny - 1 ? k + nx : k;
				const ax = X[ir] - X[il];
				const ay = Y[ir] - Y[il];
				const az = Z[ir] - Z[il];
				const bx = X[jd] - X[ju];
				const by = Y[jd] - Y[ju];
				const bz = Z[jd] - Z[ju];
				let nxv = ay * bz - az * by;
				let nyv = az * bx - ax * bz;
				let nzv = ax * by - ay * bx;
				const nl = Math.hypot(nxv, nyv, nzv) || 1;
				nxv /= nl;
				nyv /= nl;
				nzv /= nl;
				if (nzv < 0) {
					nxv = -nxv;
					nyv = -nyv;
					nzv = -nzv;
				}
				const diff = Math.max(0, (nxv * LX + nyv * LY + nzv * LZ) / LL);
				const hx = LX / LL;
				const hy = LY / LL;
				const hz = LZ / LL + 1;
				const hl = Math.hypot(hx, hy, hz);
				const spec = Math.max(0, (nxv * hx + nyv * hy + nzv * hz) / hl) ** 18;
				verts[o + 4] = 0.5 + 0.62 * diff - clamp(Z[k] * -0.0012, -0.15, 0.15);
				verts[o + 5] = spec * 0.32;
			}
		}
		let ni = 0;
		for (let j = 0; j < ny - 1; j++) {
			for (let i = 0; i < nx - 1; i++) {
				if (cut[j * (nx - 1) + i]) continue;
				const a = j * nx + i;
				indices[ni++] = a;
				indices[ni++] = a + 1;
				indices[ni++] = a + nx;
				indices[ni++] = a + 1;
				indices[ni++] = a + nx + 1;
				indices[ni++] = a + nx;
			}
		}
		nIndices = ni;
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.useProgram(prog);
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
		gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices.subarray(0, ni), gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(loc.pos);
		gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, 24, 0);
		gl.enableVertexAttribArray(loc.uv);
		gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, 24, 8);
		gl.enableVertexAttribArray(loc.light);
		gl.vertexAttribPointer(loc.light, 2, gl.FLOAT, false, 24, 16);
		gl.uniform2f(loc.res, W + M * 2, H + M * 2);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.uniform1f(loc.shadow, 1);
		gl.uniform2f(loc.off, 6, 11);
		gl.drawElements(gl.TRIANGLES, ni, gl.UNSIGNED_SHORT, 0);
		gl.uniform1f(loc.shadow, 0);
		gl.uniform2f(loc.off, 0, 0);
		gl.drawElements(gl.TRIANGLES, ni, gl.UNSIGNED_SHORT, 0);
	}

	// ---------------------------------------------------------------- loop & input

	let calm = 0;
	const loop = createLoop({
		hz: 60,
		maxSteps: 2,
		step(dt) {
			if (!visible) return false;
			simulate(dt);
			scrollSpeed *= 0.9;
			if (reducedMotion) {
				calm = energy() < 0.02 && pointer.active <= 0 && !grab && !torn.length ? calm + 1 : 0;
				return calm < 40;
			}
			return true;
		},
		render: draw,
	});
	wake = () => {
		if (visible) loop.start();
	};

	function toLocal(event) {
		const r = banner.getBoundingClientRect();
		return { x: event.clientX - r.left + M, y: event.clientY - r.top + M, r };
	}

	function onMove(event) {
		const { x, y, r } = toLocal(event);
		const now = performance.now();
		const inside = event.clientX > r.left - 40 && event.clientX < r.right + 40 && event.clientY > r.top - 30 && event.clientY < r.bottom + 50;
		if (inside || grab) {
			if (pointer.lastT && now - pointer.lastT < 120) {
				const dt = Math.max(1, now - pointer.lastT) / 1000;
				const vx = (x - pointer.lastX) / dt;
				const vy = (y - pointer.lastY) / dt;
				pointer.vx = pointer.vx * 0.5 + vx * 0.5;
				pointer.vy = pointer.vy * 0.5 + vy * 0.5;
				const speed = Math.hypot(vx, vy);
				if (speed > SWIPE_SPEED && !grab) swipeCut(pointer.lastX, pointer.lastY, x, y);
			}
			pointer.active = 0.25;
			wake();
		}
		pointer.x = x;
		pointer.y = y;
		pointer.lastX = x;
		pointer.lastY = y;
		pointer.lastT = inside || grab ? now : 0;
		root.style.cursor = grab ? "grabbing" : "";
	}

	function swipeCut(x0, y0, x1, y1) {
		const dx = x1 - x0;
		const dy = y1 - y0;
		const len2 = dx * dx + dy * dy || 1;
		for (let c = 0; c < cCount; c++) {
			if (!cactive[c] || ctype[c] === 2) continue;
			const mx = (X[ca[c]] + X[cb[c]]) / 2;
			const my = (Y[ca[c]] + Y[cb[c]]) / 2;
			const t = clamp(((mx - x0) * dx + (my - y0) * dy) / len2, 0, 1);
			const px = x0 + dx * t;
			const py = y0 + dy * t;
			if ((mx - px) ** 2 + (my - py) ** 2 < 15 * 15 && Math.min(ca[c] % nx, cb[c] % nx) >= 0 && !(pinned[ca[c]] && pinned[cb[c]])) tear(c);
		}
	}

	function onDown(event) {
		if (event.button !== 0 || event.target.closest?.("a, button, .phys-pill")) return;
		const { x, y, r } = toLocal(event);
		if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) return;
		let best = -1;
		let bd = 60 * 60;
		for (let k = 0; k < nx * ny; k++) {
			if (pinned[k]) continue;
			const d = (X[k] - x) ** 2 + (Y[k] - y) ** 2;
			if (d < bd) {
				bd = d;
				best = k;
			}
		}
		if (best < 0) return;
		event.preventDefault();
		const idx = [];
		const w = new Map();
		const ox = new Map();
		const oy = new Map();
		for (let k = 0; k < nx * ny; k++) {
			if (pinned[k]) continue;
			const d = Math.hypot(X[k] - X[best], Y[k] - Y[best]);
			if (d < 26) {
				idx.push(k);
				w.set(k, 1 - d / 40);
				ox.set(k, X[k] - x);
				oy.set(k, Y[k] - y);
			}
		}
		grab = { idx, w, ox, oy, set: new Set(idx) };
		pointer.x = x;
		pointer.y = y;
		root.style.cursor = "grabbing";
		wake();
	}

	function onUp() {
		if (!grab) return;
		grab = undefined;
		root.style.cursor = "";
		wake();
	}

	function onScroll() {
		const s = root.scrollTop;
		scrollSpeed = Math.min(2400, scrollSpeed + Math.abs(s - lastScroll) * 40);
		lastScroll = s;
		if (!reducedMotion) wake();
	}

	const io = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (visible) wake();
	});
	io.observe(banner);

	const ui = createPill(root, {
		pos: "left",
		hint: "Cloth banner · move to blow, swipe to tear",
		items: [
			{ id: "gust", label: "Gust", key: "w", primary: true, title: "Blow a gust of wind", onClick: () => gustNow() },
			{ id: "tear", label: "Tear", key: "x", title: "Rip the banner", onClick: () => ripNow() },
		],
	});

	function gustNow() {
		for (let k = 0; k < nx * ny; k++) {
			if (pinned[k]) continue;
			Z[k] -= 70 + ((k % nx) / nx) * 30;
			X[k] += 4 + Math.random() * 6;
		}
		wake();
	}

	function ripNow() {
		// Slash diagonally across the middle.
		const x0 = M + W * 0.25;
		const y0 = M + H * 0.15;
		const x1 = M + W * 0.75;
		const y1 = M + H * 0.85;
		swipeCut(x0, y0, x1, y1);
		for (let k = 0; k < nx * ny; k++) if (!pinned[k]) Z[k] -= 20 + Math.random() * 18;
		wake();
	}

	const removeKeys = bindKeys({ w: gustNow, x: ripNow });

	let ro;
	let readyTimer;
	(async () => {
		try {
			await document.fonts.load('800 60px "Fraunces"');
			await document.fonts.load('400 24px "League Spartan"');
			await document.fonts.ready;
		} catch {
			/* fall through */
		}
		if (disposed) return;
		build();
		root.classList.add("cloth-on");
		window.addEventListener("pointermove", onMove, { passive: true });
		window.addEventListener("pointerdown", onDown);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		root.addEventListener("scroll", onScroll, { passive: true });
		let lastW = W;
		ro = new ResizeObserver(() => {
			const w = Math.round(banner.getBoundingClientRect().width);
			if (Math.abs(w - lastW) > 2 && !disposed) {
				lastW = w;
				clearTimeout(readyTimer);
				readyTimer = setTimeout(() => {
					loop.stop();
					build();
					wake();
				}, 120);
			}
		});
		ro.observe(banner);
		if (reducedMotion) {
			// One gentle static frame: a small pre-simulated sag, then wait for the user.
			for (let s = 0; s < 90; s++) simulate(STEP, true);
			draw();
		} else {
			wake();
		}
	})();

	return () => {
		disposed = true;
		loop.stop();
		io.disconnect();
		ro?.disconnect();
		clearTimeout(readyTimer);
		removeKeys();
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerdown", onDown);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		root.removeEventListener("scroll", onScroll);
		gl.getExtension("WEBGL_lose_context")?.loseContext();
		canvas.remove();
	};
}
