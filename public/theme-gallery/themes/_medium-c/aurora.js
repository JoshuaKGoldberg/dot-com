// Soft, cursor-reactive aurora. WebGL fragment shader at reduced resolution (CSS upscaling adds blur),
// with a cheap 2D fallback when WebGL is unavailable.

const VS = "attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
const FS = `precision mediump float;
varying vec2 uv;
uniform float t,energy,dark,amp,aspect;
uniform vec3 ptr;
uniform vec3 c0,c1,c2;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+7.1;a*=.5;}return s;}
void main(){
 float x=uv.x, y=1.-uv.y;
 vec3 acc=vec3(0.); float ia=0.;
 for(int i=0;i<3;i++){
  float fi=float(i);
  float g=exp(-pow((x-ptr.x)*aspect*1.6,2.)/(2.*.32*.32))*ptr.z;
  float fold=.075*sin(x*2.6+t*.07+fi*2.1)+.04*sin(x*6.3-t*.11+fi*1.3)+.11*(fbm(vec2(x*1.7+fi*5.,t*.03+fi))-.5);
  float edge=.46+fi*.06+fold;
  edge+=(ptr.y-edge)*.55*g;
  float d=edge-y;
  float lo=smoothstep(-.1,.03,d);
  float k=4.4-1.8*g-fi*.4;
  float fall=exp(-max(d,0.)*k);
  float glow=exp(-pow(max(-d,0.)*9.,2.))*.4;
  float rx=x*aspect*(9.+fi*3.)+sin(d*4.+fi)*.8+fbm(vec2(x*3.,fi))*2.;
  float rays=fbm(vec2(rx,t*.08+fi*3.));
  rays=pow(smoothstep(.2,.8,rays),1.1)*1.5+.2;
  rays=mix(1.,rays,.55*smoothstep(.0,.12,d)*(1.-.55*smoothstep(.15,.45,d)));
  float inten=(lo*fall+glow)*rays;
  inten*=.6+.7*energy+1.5*g;
  inten*=1.-.22*fi;
  vec3 col=mix(c0,c1,smoothstep(.02,.17,d));
  col=mix(col,c2,smoothstep(.15,.38,d)*(.6+.4*sin(x*3.+fi)));
  col=mix(col,vec3(1.),.12*exp(-abs(d)*40.)*lo);
  acc+=col*inten; ia+=inten;
 }
 float fade=smoothstep(.99,.66,y)*(.55+.45*smoothstep(0.,.2,y));
 acc*=amp*fade; ia*=amp*fade;
 float a=clamp(ia,0.,1.);
 vec3 c=acc/max(ia,.0001);
 float aw=mix(1.,.38,dark);
 gl_FragColor=vec4(c*a*aw,a*aw);
}`;

export class Aurora {
	constructor(canvas, { dark, colors, amp }) {
		this.canvas = canvas;
		this.dark = dark;
		this.colors = colors; // three [r,g,b] 0..1
		this.amp = amp ?? (dark ? 0.95 : 0.55);
		this.gl = null;
		this.ctx2 = null;
		let gl = null;
		try {
			gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
		} catch {}
		if (gl) {
			const mk = (type, src) => {
				const s = gl.createShader(type);
				gl.shaderSource(s, src);
				gl.compileShader(s);
				return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
			};
			const vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, FS);
			const pr = vs && fs ? gl.createProgram() : null;
			if (pr) {
				gl.attachShader(pr, vs);
				gl.attachShader(pr, fs);
				gl.linkProgram(pr);
			}
			if (pr && gl.getProgramParameter(pr, gl.LINK_STATUS)) {
				this.gl = gl;
				this.pr = pr;
				gl.useProgram(pr);
				const buf = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, buf);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
				const loc = gl.getAttribLocation(pr, "p");
				gl.enableVertexAttribArray(loc);
				gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
				this.u = {};
				for (const n of ["t", "energy", "dark", "amp", "aspect", "ptr", "c0", "c1", "c2"]) this.u[n] = gl.getUniformLocation(pr, n);
			} else gl = null;
		}
		if (!this.gl) {
			this.ctx2 = canvas.getContext("2d");
			this.sprites = colors.map((c) => {
				const s = document.createElement("canvas");
				s.width = 1;
				s.height = 64;
				const x = s.getContext("2d");
				const g = x.createLinearGradient(0, 0, 0, 64);
				const rgb = c.map((v) => Math.round(v * 255)).join(",");
				g.addColorStop(0, `rgba(${rgb},0)`);
				g.addColorStop(0.7, `rgba(${rgb},.35)`);
				g.addColorStop(0.96, `rgba(${rgb},.9)`);
				g.addColorStop(1, `rgba(${rgb},0)`);
				x.fillStyle = g;
				x.fillRect(0, 0, 1, 64);
				return s;
			});
		}
		this.lost = false;
		this.onLost = (e) => { e.preventDefault(); this.lost = true; };
		canvas.addEventListener("webglcontextlost", this.onLost);
	}
	resize(w, h) {
		this.canvas.width = Math.max(8, w | 0);
		this.canvas.height = Math.max(8, h | 0);
		if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
	}
	// ptr: {x 0..1, y 0..1 (canvas-relative), z strength}
	render(t, ptr, energy) {
		const cv = this.canvas;
		if (this.gl) {
			if (this.lost) return;
			const gl = this.gl, u = this.u;
			gl.uniform1f(u.t, t);
			gl.uniform1f(u.energy, energy);
			gl.uniform1f(u.dark, this.dark ? 1 : 0);
			gl.uniform1f(u.amp, this.amp);
			gl.uniform1f(u.aspect, cv.width / cv.height);
			gl.uniform3f(u.ptr, ptr.x, ptr.y, ptr.z);
			gl.uniform3fv(u.c0, this.colors[0]);
			gl.uniform3fv(u.c1, this.colors[1]);
			gl.uniform3fv(u.c2, this.colors[2]);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			return;
		}
		const x = this.ctx2, W = cv.width, H = cv.height;
		x.clearRect(0, 0, W, H);
		x.globalCompositeOperation = this.dark ? "lighter" : "source-over";
		for (let b = 0; b < 3; b++) {
			for (let i = 0; i < W; i++) {
				const u = i / W;
				const g = Math.exp(-Math.pow((u - ptr.x) * 4, 2) * 0.5) * ptr.z;
				let by = H * (0.46 + b * 0.06 + 0.075 * Math.sin(u * 2.6 + t * 0.07 + b * 2.1) + 0.04 * Math.sin(u * 6.3 - t * 0.11 + b));
				by += (ptr.y * H - by) * 0.4 * g;
				const hg = H * (0.3 + 0.1 * Math.sin(u * 4 + b)) * (1 + 0.6 * g);
				x.globalAlpha = Math.min(1, (0.5 + 0.2 * Math.sin(u * 40 + t * 0.1 + b)) * (0.62 + 0.5 * energy + 0.9 * g) * (1 - 0.22 * b) * this.amp * 0.8);
				x.drawImage(this.sprites[b], 0, 0, 1, 64, i, by - hg, 1.2, hg);
			}
		}
		x.globalAlpha = 1;
		x.globalCompositeOperation = "destination-out";
		const gr = x.createLinearGradient(0, H * 0.6, 0, H);
		gr.addColorStop(0, "rgba(0,0,0,0)");
		gr.addColorStop(1, "rgba(0,0,0,1)");
		x.fillStyle = gr;
		x.fillRect(0, H * 0.6, W, H * 0.4);
		x.globalCompositeOperation = "source-over";
	}
	// Approximate aurora colour (0..255) at normalized x, for tinting fireflies etc.
	colorAt(xn, t = 0, mix = null) {
		const k = 0.5 + 0.5 * Math.sin(xn * 4.1 + t * 0.05);
		const j = 0.5 + 0.5 * Math.sin(xn * 2.3 - t * 0.03 + 1.7);
		const a = this.colors[0].map((v, i) => v + (this.colors[1][i] - v) * k);
		return a.map((v, i) => (v + (this.colors[2][i] - v) * j * 0.8) * 255);
	}
	destroy() {
		this.canvas.removeEventListener("webglcontextlost", this.onLost);
		if (this.gl) {
			this.gl.getExtension("WEBGL_lose_context")?.loseContext();
			this.gl = null;
		}
	}
}
