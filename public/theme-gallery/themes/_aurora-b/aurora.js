// Soft cursor-reactive aurora. WebGL fragment shader at reduced resolution (CSS upscaling adds blur),
// with a low-res 2D canvas fallback. Pointer is read from window listeners only.
const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FS = `precision highp float;
uniform vec2 uRes,uPtr;uniform float uT,uE,uI,uK,uTop;
uniform vec3 uA0,uA1,uA2,uB0,uB1,uB2;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+7.1;a*=.5;}return s;}
void main(){
 vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;
 float fade=smoothstep(uTop-.34,uTop-.06,uv.y);
 if(fade<=0.001){gl_FragColor=vec4(0.);return;}
 float py=clamp(uPtr.y,.52,.9);
 vec3 col=vec3(0.);float al=0.;
 for(int i=0;i<3;i++){
  float fi=float(i);
  float g=exp(-pow((uv.x-uPtr.x)*asp/.36,2.));
  float x=uv.x+(uPtr.x-uv.x)*.12*g;
  float t=uT*(.035+.02*fi);
  float fold=sin(x*3.1+fi*2.3+t*3.)*.05+sin(x*6.7-fi*1.7-t*4.)*.022+(fbm(vec2(x*2.2+fi*5.,t))-.5)*.14;
  float yb=uTop-.05-fi*.075+fold;
  yb+=(py-.14-yb)*.32*g*(.55+uE*.6);
  float ht=.21+.06*sin(x*4.7+fi*3.1+t*2.)+.2*g*(.5+uE)+.04*fi;
  float h=(uv.y-yb)/ht;
  float prof=h<0.?exp(h*8.):exp(-h*2.1);
  prof*=1.+1.1*exp(-h*h*70.);
  float ray=.5+.5*fbm(vec2(x*asp*18.+fi*9.,uv.y*1.1-t*2.));
  float flick=.8+.2*sin(uT*.5+x*8.+fi*2.);
  float a=prof*ray*flick*(.42+.8*g+uE*.35*g)*(1.-.2*fi);
  bool odd=mod(fi,2.)>.5;
  vec3 c0=odd?uB0:uA0,c1=odd?uB1:uA1,c2=odd?uB2:uA2;
  vec3 c=mix(mix(c0,c1,smoothstep(0.,.45,h)),c2,smoothstep(.3,1.3,h));
  col+=c*a;al+=a;
 }
 vec3 rgb=clamp(col/max(al,1e-4),0.,1.);
 float A=1.-exp(-al*uI*fade*1.3);
 gl_FragColor=vec4(rgb*A,A*uK);
}`;

export const AURORA_GREEN = { a: [[0.2, 1, 0.55], [0.1, 0.85, 0.75], [0.62, 0.35, 1]] };
const lerp = (a, b, t) => a + (b - a) * t;

export function createAurora({ root, reducedMotion, dark, palette, intensity = 1, top = 0.9, scale = 0.45, host }) {
	host = host || root.querySelector(".scenery-b");
	const canvas = document.createElement("canvas");
	canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
	host.prepend(canvas);
	let gl = null, prog = null, loc = {}, ctx2 = null;
	try { gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, powerPreference: "low-power" }); } catch { gl = null; }
	if (gl) {
		const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
		const vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, FS);
		if (vs && fs) {
			prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
			if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) prog = null;
		}
		if (!prog) { gl.getExtension("WEBGL_lose_context")?.loseContext(); gl = null; }
	}
	if (gl) {
		gl.useProgram(prog);
		const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const pl = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
		for (const n of ["uRes", "uPtr", "uT", "uE", "uI", "uK", "uTop", "uA0", "uA1", "uA2", "uB0", "uB1", "uB2"]) loc[n] = gl.getUniformLocation(prog, n);
		gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	} else {
		ctx2 = canvas.getContext("2d");
	}
	let pal = palette, inten = intensity, w = 1, h = 1, lw = 1, lh = 1;
	let tx = 0.66, ty = 0.7, x = tx, y = ty, energy = 0, speed = 0, active = false, lastMove = 0;
	let raf = 0, timer = 0, last = 0, t = 8, dead = false, sprites = null;
	const frameCbs = [];
	const isDark = () => dark();

	function resize() {
		const r = host.getBoundingClientRect();
		w = Math.max(1, r.width); h = Math.max(1, r.height);
		const s = gl ? scale : 0.16;
		lw = Math.max(2, Math.round(w * s)); lh = Math.max(2, Math.round(h * s));
		canvas.width = lw; canvas.height = lh;
		if (gl) gl.viewport(0, 0, lw, lh);
		sprites = null;
		draw();
	}
	function mkSprites() {
		const dk = isDark();
		const ps = [pal.a, pal.b || pal.a];
		sprites = ps.map((p) => {
			const c = document.createElement("canvas"); c.width = 1; c.height = 96;
			const q = c.getContext("2d"); const g = q.createLinearGradient(0, 0, 0, 96);
			const rgb = (v, a) => `rgba(${v.map((n) => (n * 255) | 0)},${a})`;
			g.addColorStop(0, rgb(p[2], 0)); g.addColorStop(0.4, rgb(p[2], 0.25)); g.addColorStop(0.75, rgb(p[1], 0.6)); g.addColorStop(0.93, rgb(p[0], dk ? 0.95 : 0.9)); g.addColorStop(1, rgb(p[0], 0));
			q.fillStyle = g; q.fillRect(0, 0, 1, 96); return c;
		});
	}
	function draw2d() {
		if (!sprites) mkSprites();
		const c = ctx2; c.clearRect(0, 0, lw, lh);
		c.globalCompositeOperation = isDark() ? "lighter" : "source-over";
		const asp = w / h;
		for (let b = 0; b < 3; b++) for (let i = 0; i < lw; i++) {
			const u = i / lw;
			const g = Math.exp(-Math.pow(((u - x) * asp) / 0.36, 2));
			const tt = t * (0.035 + 0.02 * b);
			const fold = Math.sin(u * 3.1 + b * 2.3 + tt * 3) * 0.05 + Math.sin(u * 6.7 - b * 1.7 - tt * 4) * 0.022;
			let yb = top - 0.05 - b * 0.075 + fold;
			const pyv = Math.min(0.9, Math.max(0.52, 1 - ty));
			yb += (pyv - 0.14 - yb) * 0.32 * g * (0.55 + energy * 0.6);
			const ht = (0.21 + 0.06 * Math.sin(u * 4.7 + b * 3.1 + tt * 2) + 0.2 * g * (0.5 + energy) + 0.04 * b) * lh * 1.6;
			const yTop = (1 - yb) * lh - ht * 0.15 - ht;
			const fade = Math.min(1, Math.max(0, ((1 - (yTop + ht) / lh) - (top - 0.34)) / 0.28));
			c.globalAlpha = Math.min(1, (0.5 + 0.5 * Math.sin(u * 40 + b + t * 0.4)) * 0.3 + 0.5) * (0.42 + 0.8 * g) * inten * (1 - 0.2 * b) * 0.8 * Math.max(0.15, fade);
			c.drawImage(sprites[b % 2], 0, 0, 1, 96, i, yTop, 1.2, ht * 1.15);
		}
		c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
	}
	function draw() {
		if (dead) return;
		if (gl) {
			if (gl.isContextLost()) return;
			const dk = isDark();
			gl.uniform2f(loc.uRes, lw, lh); gl.uniform2f(loc.uPtr, x, 1 - y);
			gl.uniform1f(loc.uT, t); gl.uniform1f(loc.uE, energy); gl.uniform1f(loc.uI, inten);
			gl.uniform1f(loc.uK, dk ? 0.4 : 1); gl.uniform1f(loc.uTop, top);
			const a = pal.a, b = pal.b || pal.a;
			gl.uniform3fv(loc.uA0, a[0]); gl.uniform3fv(loc.uA1, a[1]); gl.uniform3fv(loc.uA2, a[2]);
			gl.uniform3fv(loc.uB0, b[0]); gl.uniform3fv(loc.uB1, b[1]); gl.uniform3fv(loc.uB2, b[2]);
			gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		} else draw2d();
		for (const f of frameCbs) f(canvas);
	}
	function frame(now) {
		raf = 0;
		if (dead || document.hidden) return;
		const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
		t += dt;
		const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 5);
		const px = x, py = y;
		x += (tx - x) * k; y += (ty - y) * k;
		let busy = Math.abs(tx - x) > 0.0008 || Math.abs(ty - y) > 0.0008;
		if (!busy) { x = tx; y = ty; }
		const sp = Math.hypot((x - px) * w, (y - py) * h) / dt;
		speed = speed * 0.6 + sp * 0.4;
		const target = reducedMotion ? 0 : Math.min(1, speed / 700);
		energy += (target - energy) * (1 - Math.exp(-dt * 3));
		if (energy < 0.01) energy = 0; else busy = true;
		draw();
		if (reducedMotion) return;
		if (busy) raf = requestAnimationFrame(frame);
		else timer = setTimeout(() => { timer = 0; wake(true); }, 50); // idle drift at ~20 fps, low-res only
	}
	function wake(idle) {
		if (dead || raf || document.hidden) return;
		if (timer && !idle) { clearTimeout(timer); timer = 0; }
		last = performance.now() - (idle ? 50 : 16);
		raf = requestAnimationFrame(frame);
	}
	function onMove(e) {
		if (e.pointerType === "touch") return;
		const r = host.getBoundingClientRect();
		tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); ty = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
		active = true; lastMove = performance.now();
		if (reducedMotion) { if (!raf) raf = requestAnimationFrame((n) => { last = n; frame(n); }); } else wake();
	}
	const onVis = () => { if (!document.hidden) wake(); };
	window.addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	const ro = new ResizeObserver(resize); ro.observe(host);
	canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
	resize();
	if (!reducedMotion) wake();
	return {
		canvas, get gl() { return !!gl; },
		onFrame(f) { frameCbs.push(f); },
		setIntensity(v) { if (Math.abs(v - inten) < 0.002) return; inten = v; if (reducedMotion || !raf && !timer) draw(); },
		setPalette(p) { pal = p; sprites = null; draw(); },
		redraw: draw,
		destroy() {
			dead = true; cancelAnimationFrame(raf); clearTimeout(timer); ro.disconnect();
			window.removeEventListener("pointermove", onMove); document.removeEventListener("visibilitychange", onVis);
			if (gl) gl.getExtension("WEBGL_lose_context")?.loseContext();
			canvas.remove();
		},
	};
}
