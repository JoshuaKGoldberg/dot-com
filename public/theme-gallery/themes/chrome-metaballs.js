// Raymarched SDF metaballs of liquid chrome reflecting a procedural studio environment.
import { FULLSCREEN_VS, createLoop, mountCanvas, program, siteColors, trackPointer } from "./_kit/kit.js";

const FS = `#version 300 es
precision highp float;
uniform vec2 res; uniform float dpr, time, dark, textX, boost;
uniform vec2 center; uniform vec3 acc1, acc2; uniform vec3 mball;
out vec4 o;
const int N = 6;
const float PXU = 190.; // css px per world unit

vec4 balls[N];
float smin(float a, float b, float k){ float h = max(k - abs(a-b), 0.)/k; return min(a,b) - h*h*k*.25; }
float map(vec3 p){
	float d = 1e5;
	for (int i=0;i<N;i++) d = smin(d, length(p - balls[i].xyz) - balls[i].w, .75);
	d = smin(d, length(p - vec3(mball.xy, 0.)) - mball.z, .75);
	return d;
}
vec3 nrm(vec3 p){ vec2 e = vec2(1., -1.)*.0035; return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx)); }

float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
vec3 env(vec3 d){
	float y = d.y;
	vec3 col;
	float sky = smoothstep(-.015, .015, y);
	if (dark > .5) {
		vec3 up = mix(vec3(.05,.06,.13), vec3(.01,.012,.03), smoothstep(0.,.9,y));
		vec3 dn = mix(vec3(.0,.0,.01), vec3(.07,.05,.12), smoothstep(-.1,-.9,y));
		col = mix(dn, up, sky);
		col += acc1 * .9 * exp(-pow(y*14., 2.));                  // sharp glowing horizon
	} else {
		vec3 up = mix(vec3(.4,.45,.58), vec3(1.), smoothstep(0.,.8,y));
		vec3 dn = mix(vec3(.06,.07,.1), vec3(.6,.62,.68), smoothstep(-.05,-.8,y));
		col = mix(dn, up, sky);
	}
	float az = atan(d.x, d.z);
	// softboxes on a ring around the scene
	vec2 u1 = vec2(az - .55, y - .5);   float b1 = smoothstep(.04,-.04, rbox(u1, vec2(.45,.16), .08));
	vec2 u2 = vec2(az + 1.15, y - .1);  float b2 = smoothstep(.04,-.04, rbox(u2, vec2(.12,.55), .05));
	vec2 u3 = vec2(az - 2.2, y + .05);  float b3 = smoothstep(.05,-.05, rbox(u3, vec2(.5,.07), .03));
	vec2 u4 = vec2(az + 2.8, y - .35);  float b4 = smoothstep(.05,-.05, rbox(u4, vec2(.3,.22), .1));
	float top = smoothstep(.82, .97, y);
	if (dark > .5) {
		col += vec3(1.,.97,.95) * b1 * 1.8 + acc1 * b2 * 2.0 + acc2 * b3 * 1.6 + vec3(.9,.95,1.) * b4 * 1.1 + vec3(.8)*top*.7;
	} else {
		col = mix(col, vec3(1.), b1) ;
		col = mix(col, acc1*1.1, b2*.8);
		col = mix(col, vec3(.02,.03,.06), b3*.9);    // dark strip for contrast
		col = mix(col, vec3(1.), b4*.9);
		col = mix(col, vec3(1.), top);
	}
	return col;
}

void main(){
	vec2 P = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
	vec2 q = (P - center) / PXU; q.y = -q.y;
	float t = time;
	for (int i=0;i<N;i++){
		float fi = float(i);
		vec3 c = vec3(1.7*sin(t*.31 + fi*1.9) + .3*sin(t*.7+fi),
		              1.0*sin(t*.37 + fi*2.7 + 1.) + .2*cos(t*.9+fi*3.),
		              .5*sin(t*.23 + fi*1.3));
		balls[i] = vec4(c, .62 + .18*sin(fi*2.1 + t*.5) + (i==0 ? .3 : 0.));
	}
	vec3 ro = vec3(0., 0., 7.);
	vec3 rd = normalize(vec3(q, -7. * 1.0));   // gentle perspective
	// ortho-ish: shift origin by q, direction slightly diverging
	ro = vec3(q * 1.0, 7.); rd = normalize(vec3(q*.12, -1.));
	// bounding sphere
	float R = 3.9;
	float b = dot(ro, rd); float c = dot(ro,ro) - R*R; float disc = b*b - c;
	vec4 outc = vec4(0.);
	if (disc > 0.) {
		float tt = -b - sqrt(disc);
		float tmax = -b + sqrt(disc);
		float md = 1e5; bool hit = false;
		for (int i=0;i<44;i++){
			float d = map(ro + rd*tt);
			md = min(md, d);
			if (d < .004) { hit = true; break; }
			tt += d * .92;
			if (tt > tmax) break;
		}
		float px = 1./PXU * 1.3;
		if (hit) {
			vec3 p = ro + rd*tt; vec3 n = nrm(p);
			vec3 r = reflect(rd, n);
			float ndv = clamp(dot(n, -rd), 0., 1.);
			float F = mix(.72, 1., pow(1.-ndv, 4.));
			vec3 col = env(r) * F;
			col *= vec3(.96,.98,1.04);
			col *= mix(vec3(1.), .5+.5*cos(6.2832*(ndv*.6 + vec3(0.,.33,.67))), .1);
			// soft occlusion where blobs merge
			float ao = clamp(map(p + n*.25)/.25, 0., 1.);
			col *= .55 + .45*ao;
			float edge = smoothstep(0., px*2., -map(p)+px);
			float a = 1.;
			// keep the text column calm
			float tx = smoothstep(textX - 60., textX + 140., P.x);
			a *= mix(1., .5, tx);
			a *= mix(.88, 1., boost);
			outc = vec4(col * a, a);
		} else {
			float e = smoothstep(px*1.6, 0., md);
			if (e > 0.) {
				// halo ray just grazing the surface: sample an edge colour
				vec3 col = (dark > .5 ? vec3(.55,.6,.8) : vec3(.35,.38,.5));
				float tx = smoothstep(textX - 60., textX + 140., P.x);
				float a = e * mix(1., .5, tx) * .9;
				outc = vec4(col*a, a);
			}
		}
	}
	float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
	o = outc + (g-.5)/512. * outc.a;
}`;

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const hero = root.querySelector(".site-portrait");
	if (!layer || !hero) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { scale: 0.75, maxDpr: 1.25, maxPixels: 1.4e6 });
	const gl = view.gl;
	if (!gl) return () => view.destroy();
	const prog = program(gl, FULLSCREEN_VS, FS);
	gl.bindVertexArray(gl.createVertexArray());
	const colors = siteColors(root);
	const acc1 = dark ? [0.25, 0.7, 1.0] : [0.35, 0.4, 1.0];
	const acc2 = dark ? [1.0, 0.35, 0.75] : [0.9, 0.3, 0.5];

	let center = [view.cssW * 0.3, view.cssH * 0.3];
	let textX = view.cssW * 0.45;
	let onscreen = true;
	const measure = () => {
		const r = hero.getBoundingClientRect();
		const top = layer.getBoundingClientRect().top;
		center = [r.left + r.width / 2, r.top - top + r.height / 2];
		textX = r.right + 10;
		onscreen = r.bottom > -420 && r.top - top < view.cssH + 420;
	};
	measure();

	const m = { x: 0, y: 0, r: 0, tr: 0, tx: 0, ty: 0 };
	let boost = 0;
	let lastMove = -1e9;
	const pointer = trackPointer(layer, {
		onMove(s) {
			// pointer in world units relative to the cluster centre
			const wx = (s.x - center[0]) / 190;
			const wy = -(s.y - center[1]) / 190;
			const d = Math.hypot(wx, wy);
			const lim = 3.1;
			const k = d > lim ? lim / d : 1;
			m.tx = wx * k;
			m.ty = wy * k;
			lastMove = performance.now();
			boost = 1;
			loop.kick(reducedMotion ? 60 : 1);
		},
	});

	const t0 = Math.random() * 20;
	function draw(dt, t) {
		const active = performance.now() - lastMove < 2800;
		m.tr += ((active ? 0.62 : 0) - m.tr) * Math.min(1, dt * 3);
		m.x += (m.tx - m.x) * Math.min(1, dt * 5);
		m.y += (m.ty - m.y) * Math.min(1, dt * 5);
		if (!active) boost = Math.max(0, boost - dt * 0.5);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, view.width, view.height);
		gl.disable(gl.BLEND);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		if (!onscreen) return;
		prog.use();
		prog.set("res", view.width, view.height);
		prog.set("dpr", view.dpr);
		prog.set("time", reducedMotion ? 4.2 : t0 + t);
		prog.set("dark", dark ? 1 : 0);
		prog.set("textX", textX);
		prog.set("boost", boost);
		prog.set("center", center[0], center[1]);
		prog.set("acc1", acc1);
		prog.set("acc2", acc2);
		prog.set("mball", m.x, m.y, m.tr);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
	const loop = createLoop(draw, { continuous: !reducedMotion, fps: 40 });
	if (reducedMotion) loop.kick(2);

	const onScroll = () => {
		measure();
		loop.kick(reducedMotion ? 2 : 1);
	};
	root.addEventListener("scroll", onScroll, { passive: true });
	let rt = 0;
	const ro = new ResizeObserver(() => {
		clearTimeout(rt);
		rt = setTimeout(() => {
			view.fit();
			measure();
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
	};
}
