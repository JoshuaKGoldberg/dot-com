// Rising incense smoke: a laminar thread that breaks into curl-noise turbulence; the pointer pushes it aside.
import { FULLSCREEN_VS, createLoop, mountCanvas, program, siteColors, trackPointer } from "./_kit/kit.js";

const FS = `#version 300 es
precision highp float;
uniform vec2 res; uniform float dpr, time, dark, vis;
uniform vec2 src; uniform vec4 wake[8];
uniform vec3 bg;
out vec4 o;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
	return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*noise(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }

float plume(vec2 pp, float seed, float t, float widScale){
	float h = src.y - pp.y;
	float x = pp.x - src.x;
	if (h < -6.) return 0.;
	float hh = max(h, 0.);
	float wid = (2.2 + 40.*pow(hh/620., 1.3)) * widScale;
	if (abs(x) > wid*3.6 + 160.*smoothstep(80., 600., hh) + 40.) return 0.;
	float turb = smoothstep(70., 430., hh);
	float sway = 22.*sin(hh*0.012 - t*0.55 + seed)*(hh/(hh+150.))
	           + 70.*sin(hh*0.0043 + t*0.17 + seed*2.)*smoothstep(60., 700., hh);
	vec2 n = vec2(x*0.016, (hh - t*46.)*0.0115) + seed*3.7;
	vec2 w1 = vec2(fbm(n*1.4 + vec2(0., t*.04)), fbm(n*1.4 + vec2(5.2, 1.3)));
	vec2 n2 = n + (w1 - .5) * 3.6 * turb;
	float f = fbm(n2*1.7 + 3.1);
	float xs = x - sway + (f - .5) * wid * 3.2 * turb + (w1.x - .5) * 9. * smoothstep(10., 120., hh);
	float core = exp(-(xs*xs)/(wid*wid));
	float rid = 1. - abs(2.*fbm(n2*2.5 + 7.7) - 1.);
	rid = pow(rid, 3.4);
	float d = core * mix(1., rid*1.9, turb*.9);
	d *= smoothstep(-5., 12., h) * exp(-hh/560.) * (1. - smoothstep(560., 920., hh));
	return d;
}

void main(){
	vec2 P = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
	vec2 pp = P;
	for (int i=0;i<8;i++){ vec2 d = P - wake[i].xy; float k = exp(-dot(d,d)/(110.*110.)); pp -= wake[i].zw * k; }
	float t = time;
	float d = plume(pp, 0., t, 1.0) * 1.0 + plume(pp + vec2(-9., 0.), 2.3, t*0.93 + 4., 0.7) * 0.55;
	d = clamp(d, 0., 1.4);
	float hh = max(src.y - pp.y, 0.);
	vec3 col; float a;
	if (dark > .5) {
		col = mix(vec3(1.0, .74, .52), vec3(.88, .86, .94), smoothstep(0., 220., hh));
		a = d * .62 * vis;
	} else {
		col = mix(vec3(.46,.36,.30), vec3(.30,.33,.44), smoothstep(0., 260., hh));
		a = d * .55 * vis;
	}
	a = clamp(a, 0., .92);
	float gn = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
	o = vec4(col * a + (gn-.5)/400., a);
}`;

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const footer = root.querySelector(".site-footer");
	if (!layer || !footer) return;
	const dark = mode === "dark";
	// the incense holder lives in the footer
	const holder = document.createElement("div");
	holder.className = "incense";
	holder.setAttribute("aria-hidden", "true");
	holder.innerHTML = '<div class="incense-bowl"></div><div class="incense-stick"><div class="incense-ember-wrap"><div class="incense-ember"></div></div></div>';
	footer.append(holder);
	const tip = holder.querySelector(".incense-ember");

	const view = mountCanvas(layer, { scale: 0.5, maxDpr: 1, maxPixels: 7e5 });
	const gl = view.gl;
	if (!gl) return () => view.destroy();
	const prog = program(gl, FULLSCREEN_VS, FS);
	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);

	let src = [view.cssW * 0.8, view.cssH + 20];
	let vis = 1;
	const placeSource = () => {
		const r = tip.getBoundingClientRect();
		const top = layer.getBoundingClientRect().top;
		const x = r.left + r.width / 2;
		const y = r.top - top + r.height / 2;
		const limit = view.cssH + 12;
		src = [x, Math.min(y, limit)];
		// a faint wisp keeps drifting up from the bottom edge when the footer is far below
		vis = y <= limit ? 1 : Math.max(0.35, 1 - (y - limit) / 2400);
	};
	placeSource();

	const wake = Array.from({ length: 8 }, () => ({ x: -999, y: -999, vx: 0, vy: 0 }));
	let wi = 0;
	const flat = new Float32Array(32);
	const pointer = trackPointer(layer, {
		onMove(s) {
			if (!s.inside) return;
			const sp = Math.hypot(s.dx, s.dy);
			if (sp < 1.5) return;
			const w = wake[wi++ % 8];
			const k = Math.min(1, 38 / sp);
			w.x = s.x;
			w.y = s.y;
			w.vx = s.dx * k * 1.6;
			w.vy = s.dy * k * 1.6;
			loop.kick(reducedMotion ? 80 : 1);
		},
	});

	const t0 = reducedMotion ? 9 : Math.random() * 30;
	function draw(dt, t) {
		for (let i = 0; i < 8; i++) {
			const w = wake[i];
			const decay = Math.exp(-dt * 0.9);
			w.vx *= decay;
			w.vy *= decay;
			flat[i * 4] = w.x;
			flat[i * 4 + 1] = w.y;
			flat[i * 4 + 2] = w.vx;
			flat[i * 4 + 3] = w.vy;
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, view.width, view.height);
		gl.disable(gl.BLEND);
		prog.use();
		prog.set("res", view.width, view.height);
		prog.set("dpr", view.dpr);
		prog.set("time", reducedMotion ? t0 : t0 + t);
		prog.set("dark", dark ? 1 : 0);
		prog.set("vis", vis);
		prog.set("src", src[0], src[1]);
		gl.uniform4fv(prog.loc("wake"), flat);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
	const loop = createLoop(draw, { continuous: !reducedMotion, fps: 45 });
	if (reducedMotion) loop.kick(2);

	const onScroll = () => {
		placeSource();
		loop.kick(reducedMotion ? 2 : 1);
	};
	root.addEventListener("scroll", onScroll, { passive: true });
	let rt = 0;
	const ro = new ResizeObserver(() => {
		clearTimeout(rt);
		rt = setTimeout(() => {
			view.fit();
			placeSource();
			loop.kick(2);
		}, 100);
	});
	ro.observe(layer);
	return () => {
		loop.stop();
		ro.disconnect();
		clearTimeout(rt);
		root.removeEventListener("scroll", onScroll);
		pointer.destroy();
		view.destroy();
		holder.remove();
	};
}
