// GPU stable-fluids ink. Light mode: ink absorbs light off paper. Dark mode: ink glows.
import { FULLSCREEN_VS, createLoop, mountCanvas, program, siteColors, trackPointer, makeButton } from "./_kit/kit.js";

const VS = `#version 300 es
precision highp float;
uniform vec2 texelSize;
out vec2 vUv, vL, vR, vT, vB;
void main(){
	vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2));
	vUv = p; vL = p - vec2(texelSize.x, 0.); vR = p + vec2(texelSize.x, 0.);
	vT = p + vec2(0., texelSize.y); vB = p - vec2(0., texelSize.y);
	gl_Position = vec4(p*2.-1., 0., 1.);
}`;
const H = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB; out vec4 o;
`;
const FS = {
	splat: H + `uniform sampler2D uTarget; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
void main(){ vec2 p = vUv - point; p.x *= aspect; vec3 s = exp(-dot(p,p)/radius) * color; o = vec4(texture(uTarget, vUv).xyz + s, 1.); }`,
	advect: H + `uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
void main(){ vec2 c = vUv - dt * texture(uVelocity, vUv).xy * texelSize; o = texture(uSource, c) / (1. + dissipation*dt); o.a = 1.; }`,
	curl: H + `uniform sampler2D uVelocity;
void main(){ float L=texture(uVelocity,vL).y, R=texture(uVelocity,vR).y, T=texture(uVelocity,vT).x, B=texture(uVelocity,vB).x; o = vec4(.5*(R-L-T+B),0.,0.,1.); }`,
	vorticity: H + `uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
void main(){ float L=texture(uCurl,vL).x, R=texture(uCurl,vR).x, T=texture(uCurl,vT).x, B=texture(uCurl,vB).x, C=texture(uCurl,vUv).x;
	vec2 f = .5*vec2(abs(T)-abs(B), abs(R)-abs(L)); f /= length(f)+1e-4; f *= curl*C; f.y *= -1.;
	vec2 v = texture(uVelocity,vUv).xy + f*dt; o = vec4(clamp(v,-1000.,1000.),0.,1.); }`,
	divergence: H + `uniform sampler2D uVelocity;
void main(){ float L=texture(uVelocity,vL).x, R=texture(uVelocity,vR).x, T=texture(uVelocity,vT).y, B=texture(uVelocity,vB).y; vec2 C=texture(uVelocity,vUv).xy;
	if(vL.x<0.)L=-C.x; if(vR.x>1.)R=-C.x; if(vT.y>1.)T=-C.y; if(vB.y<0.)B=-C.y; o = vec4(.5*(R-L+T-B),0.,0.,1.); }`,
	pressure: H + `uniform sampler2D uPressure, uDivergence;
void main(){ float L=texture(uPressure,vL).x, R=texture(uPressure,vR).x, T=texture(uPressure,vT).x, B=texture(uPressure,vB).x; float d=texture(uDivergence,vUv).x; o = vec4((L+R+B+T-d)*.25,0.,0.,1.); }`,
	gradient: H + `uniform sampler2D uPressure, uVelocity;
void main(){ float L=texture(uPressure,vL).x, R=texture(uPressure,vR).x, T=texture(uPressure,vT).x, B=texture(uPressure,vB).x; vec2 v = texture(uVelocity,vUv).xy - vec2(R-L,T-B); o = vec4(v,0.,1.); }`,
	clear: H + `uniform sampler2D uTexture; uniform float value; void main(){ o = value*texture(uTexture,vUv); }`,
	display: H + `uniform sampler2D uDye; uniform vec2 texelSize; uniform vec3 bg; uniform float dark, vis;
float dens(vec2 uv){ return dot(texture(uDye, uv).rgb, vec3(.333)); }
void main(){
	vec3 d = texture(uDye, vUv).rgb;
	vec2 e = texelSize * 1.5;
	float gx = dens(vUv+vec2(e.x,0.)) - dens(vUv-vec2(e.x,0.));
	float gy = dens(vUv+vec2(0.,e.y)) - dens(vUv-vec2(0.,e.y));
	vec3 n = normalize(vec3(-gx*3., -gy*3., 1.));
	float rim = clamp(length(vec2(gx,gy))*5., 0., 1.);
	float spec = pow(max(dot(n, normalize(vec3(-.4,.6,.7))), 0.), 28.);
	vec3 c;
	if (dark > .5) {
		vec3 glow = 1. - exp(-d * (.9 + .9*vis));
		c = bg + glow * (.75 + .35*rim) + spec * glow * .5;
		c = mix(bg, c, .55 + .45*vis);
	} else {
		vec3 T = exp(-d * (1.2 + .8*vis));
		T = max(T, vec3(mix(.34, .1, vis)));
		c = bg * T * (1. - .12*rim) + spec*.22*(1.-T);
		c = mix(bg, c, .8 + .2*vis);
	}
	// light film grain to keep gradients from banding
	float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
	o = vec4(c + (g-.5)/255., 1.);
}`,
};

const INKS = [
	[0.1, 0.2, 0.72],
	[0.04, 0.58, 0.62],
	[0.82, 0.14, 0.42],
	[0.95, 0.6, 0.08],
	[0.42, 0.18, 0.8],
	[0.1, 0.2, 0.72],
];
function inkAt(t) {
	const f = ((t % 5) + 5) % 5;
	const i = Math.floor(f);
	const k = f - i;
	return INKS[i].map((v, j) => v + (INKS[i + 1][j] - v) * k);
}

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { scale: 0.7, maxDpr: 1.25, maxPixels: 1.6e6 });
	const gl = view.gl;
	const hint = document.createElement("div");
	hint.className = "ink-hint";
	hint.textContent = "Move the pointer to drop ink";
	root.append(hint);
	const resetBtn = makeButton(root, "Clear ink", { title: "Clear the water" });
	if (!gl || !(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"))) {
		hint.textContent = "";
		return () => {
			view.destroy();
			hint.remove();
			resetBtn.remove();
		};
	}
	gl.getExtension("OES_texture_float_linear");
	const colors = siteColors(root);
	const P = {};
	for (const k of Object.keys(FS)) P[k] = program(gl, VS, H === "" ? "" : FS[k]);
	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	gl.disable(gl.BLEND);

	function makeFBO(w, h) {
		const tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
		gl.viewport(0, 0, w, h);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		return { tex, fbo, w, h, tx: 1 / w, ty: 1 / h };
	}
	function makeDouble(w, h) {
		const d = { a: makeFBO(w, h), b: makeFBO(w, h) };
		d.read = () => d.a;
		d.write = () => d.b;
		d.swap = () => ([d.a, d.b] = [d.b, d.a]);
		return d;
	}
	let vel, prs, dye, div, crl;
	let simW, simH, dyeW, dyeH;
	function sizes() {
		const aspect = view.cssW / view.cssH;
		const dim = (res) => (aspect >= 1 ? [Math.round(res * aspect), res] : [res, Math.round(res / aspect)]);
		[simW, simH] = dim(112);
		[dyeW, dyeH] = dim(320);
	}
	function build() {
		sizes();
		vel = makeDouble(simW, simH);
		prs = makeDouble(simW, simH);
		div = makeFBO(simW, simH);
		crl = makeFBO(simW, simH);
		dye = makeDouble(dyeW, dyeH);
	}
	build();

	function blit(prog, target, bind) {
		prog.use();
		prog.set("texelSize", target ? target.tx : 1 / view.width, target ? target.ty : 1 / view.height);
		bind?.(prog);
		gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
		gl.viewport(0, 0, target ? target.w : view.width, target ? target.h : view.height);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
	const tex = (unit, t, prog, name) => {
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, t);
		prog.seti(name, unit);
	};

	function splat(x, y, vx, vy, color, radius = 0.0016) {
		const aspect = view.cssW / view.cssH;
		blit(P.splat, vel.write(), (p) => {
			tex(0, vel.read().tex, p, "uTarget");
			p.set("aspect", aspect);
			p.set("point", x, y);
			p.set("color", vx, vy, 0);
			p.set("radius", radius * 1.2);
		});
		vel.swap();
		blit(P.splat, dye.write(), (p) => {
			tex(0, dye.read().tex, p, "uTarget");
			p.set("aspect", aspect);
			p.set("point", x, y);
			p.set("color", color[0], color[1], color[2]);
			p.set("radius", radius);
		});
		dye.swap();
	}
	const toDensity = (rgb, amt) =>
		dark ? rgb.map((v) => v * amt * 0.9) : rgb.map((v) => -Math.log(Math.max(0.04, v)) * amt * 0.55);

	let hue = Math.random() * 5;
	let drip = 0.6;
	let boost = 0;
	let idleFor = 0;
	const queue = [];
	let lastX = 0;
	let lastY = 0;
	let hasLast = false;

	const pointer = trackPointer(layer, {
		onMove(s) {
			if (!s.inside) return;
			const dist = Math.hypot(s.dx, s.dy);
			if (dist < 0.5) return;
			hue += dist * 0.0018;
			const x = s.x / s.cssW;
			queue.push([s.x / view.cssW, 1 - s.y / view.cssH, (s.dx / view.cssW) * 360, (-s.dy / view.cssH) * 360, Math.min(1, dist / 40)]);
			if (queue.length > 12) queue.shift();
			boost = 1;
			idleFor = 0;
			hint.dataset.hide = "1";
			loop.kick(reducedMotion ? 120 : 1);
		},
	});
	void pointer;

	function ambient(strength = 1) {
		const side = Math.random() < 0.5 ? 0.04 + Math.random() * 0.17 : 0.79 + Math.random() * 0.17;
		const y = 0.1 + Math.random() * 0.8;
		hue += 0.37 + Math.random() * 0.6;
		const ang = Math.random() * Math.PI * 2;
		const sp = 70 + Math.random() * 110;
		splat(side, y, Math.cos(ang) * sp, Math.sin(ang) * sp, toDensity(inkAt(hue), 2.4 * strength), 0.0010 + Math.random() * 0.0016);
	}

	const SIM_DT = 1 / 60;
	function stepSim(dt) {
		blit(P.curl, crl, (p) => tex(0, vel.read().tex, p, "uVelocity"));
		blit(P.vorticity, vel.write(), (p) => {
			tex(0, vel.read().tex, p, "uVelocity");
			tex(1, crl.tex, p, "uCurl");
			p.set("curl", 14);
			p.set("dt", dt);
		});
		vel.swap();
		blit(P.divergence, div, (p) => tex(0, vel.read().tex, p, "uVelocity"));
		blit(P.clear, prs.write(), (p) => {
			tex(0, prs.read().tex, p, "uTexture");
			p.set("value", 0.8);
		});
		prs.swap();
		for (let i = 0; i < 18; i++) {
			blit(P.pressure, prs.write(), (p) => {
				tex(0, prs.read().tex, p, "uPressure");
				tex(1, div.tex, p, "uDivergence");
			});
			prs.swap();
		}
		blit(P.gradient, vel.write(), (p) => {
			tex(0, prs.read().tex, p, "uPressure");
			tex(1, vel.read().tex, p, "uVelocity");
		});
		vel.swap();
		blit(P.advect, vel.write(), (p) => {
			const v = vel.read();
			tex(0, v.tex, p, "uVelocity");
			tex(1, v.tex, p, "uSource");
			p.set("texelSize", v.tx, v.ty);
			p.set("dt", dt);
			p.set("dissipation", 0.35);
		});
		vel.swap();
		blit(P.advect, dye.write(), (p) => {
			tex(0, vel.read().tex, p, "uVelocity");
			tex(1, dye.read().tex, p, "uSource");
			p.set("texelSize", vel.read().tx, vel.read().ty);
			p.set("dt", dt);
			p.set("dissipation", 0.24);
		});
		dye.swap();
	}

	function draw() {
		blit(P.display, null, (p) => {
			tex(0, dye.read().tex, p, "uDye");
			p.set("texelSize", dye.read().tx, dye.read().ty);
			p.set("bg", colors.bg[0], colors.bg[1], colors.bg[2]);
			p.set("dark", dark ? 1 : 0);
			p.set("vis", boost);
		});
	}

	function frame(dt) {
		drip -= dt;
		if (drip <= 0) {
			ambient(0.8);
			drip = 1.6 + Math.random() * 2.4;
		}
		while (queue.length) {
			const [x, y, vx, vy, k] = queue.shift();
			splat(x, y, vx, vy, toDensity(inkAt(hue), 0.55 * k + 0.12), 0.0007 + 0.0006 * k);
		}
		idleFor += dt;
		if (idleFor > 2.5) boost = Math.max(0, boost - dt * 0.35);
		stepSim(Math.min(dt, 1 / 30) * 1.4);
		draw();
	}

	// seed with a few drops so the first frame is already beautiful
	for (let i = 0; i < 5; i++) ambient(1.2);
	const pre = 48;
	for (let i = 0; i < pre; i++) {
		if (i === 12 || i === 30) ambient(1.3);
		stepSim(SIM_DT * 1.4);
	}
	draw();

	const loop = createLoop((dt) => frame(dt), { continuous: !reducedMotion, fps: 0 });
	if (reducedMotion) loop.kick(2);

	resetBtn.addEventListener("click", () => {
		for (const f of [vel.a, vel.b, dye.a, dye.b, prs.a, prs.b]) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}
		draw();
		loop.kick(2);
	});

	let lastW = view.cssW;
	let lastH = view.cssH;
	const onResize = () => {
		if (Math.abs(layer.clientWidth - lastW) < 2 && Math.abs(layer.clientHeight - lastH) < 2) return;
		lastW = layer.clientWidth;
		lastH = layer.clientHeight;
		view.fit();
		build();
		loop.kick(2);
	};
	let rt = 0;
	const ro = new ResizeObserver(() => {
		clearTimeout(rt);
		rt = setTimeout(onResize, 120);
	});
	ro.observe(layer);

	return () => {
		loop.stop();
		ro.disconnect();
		clearTimeout(rt);
		pointer.destroy();
		view.destroy();
		hint.remove();
		resetBtn.remove();
	};
}
