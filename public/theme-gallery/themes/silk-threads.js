// Contour lines of a drifting stream function, shaded as satin thread (Kajiya-Kay sheen), woven over/under.
import { FULLSCREEN_VS, createLoop, mountCanvas, program, siteColors, trackPointer } from "./_kit/kit.js";

const FS = `#version 300 es
precision highp float;
uniform vec2 res; uniform float dpr, cssH, time, halfW, cx, boost, dark;
uniform vec2 mouse; uniform vec3 bg, cA, cB, cC;
out vec4 o;
float hash(float n){ return fract(sin(n*127.1+311.7)*43758.5453); }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

vec2 bump(vec2 p){
	vec2 d = p - mouse; float k = exp(-dot(d,d)/(170.*170.));
	return p + d * 0.32 * k * boost;
}
float field(vec2 p, float th, float fr, float ph, float t){
	vec2 q = rot(th) * bump(p);
	float w = 95.*sin(q.y*0.0041 + ph + t*0.06)
	        + 46.*sin(q.y*0.0092 - q.x*0.0016 + ph*1.7 - t*0.09)
	        + 20.*sin(q.y*0.0195 + q.x*0.0042 + ph*2.3 + t*0.13);
	float f = (q.x + w) * fr;
	return f + 2.6*sin(f*0.12 + ph*3.1);
}
// one family of threads: returns colour in rgb, coverage in a, depth in z
vec4 thread(vec2 p, float th, float fr, float ph, float wlo, float whi, float seed, vec3 base, vec3 tint, out float z, float depth){
	float e = 1.0;
	float f0 = field(p, th, fr, ph, time);
	vec2 g = vec2(field(p+vec2(e,0.),th,fr,ph,time) - field(p-vec2(e,0.),th,fr,ph,time),
	              field(p+vec2(0.,e),th,fr,ph,time) - field(p-vec2(0.,e),th,fr,ph,time)) / (2.*e);
	float gmag = max(length(g), 1e-4);
	vec2 T = vec2(-g.y, g.x) / gmag;
	float id = floor(f0);
	float h = hash(id + seed);
	float h2 = hash(id*1.7 + seed*3.3);
	float present = smoothstep(0.18, 0.34, h);
	float w = mix(wlo, whi, h2);
	float d = (fract(f0) - 0.5) / gmag;
	float aa = 1.0 / dpr;
	float cov = clamp((w - abs(d)) / aa + 0.5, 0., 1.) * present;
	float cr = clamp(d / w, -1., 1.);
	float nz = sqrt(1. - cr*cr);
	vec2 N2 = vec2(-T.y, T.x) * cr;            // cylinder normal, xy part
	vec3 n = vec3(N2, nz);
	vec3 L = normalize(vec3(-0.55 + 0.25*sin(time*0.11), 0.65, 0.5));
	vec3 V = vec3(0., 0., 1.);
	vec3 H = normalize(L + V);
	float diff = max(dot(n, L), 0.);
	float TH = dot(vec3(T, 0.), H);
	float sinTH = sqrt(max(0., 1. - TH*TH));
	float spec1 = pow(sinTH, 90.) * (0.4 + 0.6*nz);
	vec3 L2 = normalize(vec3(0.6, -0.5, 0.45));
	float TH2 = dot(vec3(T, 0.), normalize(L2 + V));
	float spec2 = pow(sqrt(max(0., 1.-TH2*TH2)), 40.) * 0.45;
	// iridescent satin tint drifting with tangent direction
	vec3 iri = 0.5 + 0.5*cos(6.2831*(vec3(0., .33, .67) + dot(T, vec2(.8,.6))*.35 + h*.4 + time*.01));
	vec3 col = mix(base, tint, h2) ;
	vec3 lit = col * (0.42 + 0.7*diff);
	vec3 sheen = mix(vec3(1.), iri, 0.55) * (spec1 + spec2);
	if (dark > .5) lit += sheen * 1.05; else lit = mix(lit, vec3(1.), clamp(spec1*0.75, 0., .8)) + iri*spec2*.25;
	lit *= 0.82 + 0.18*nz;
	z = depth + 0.55*sin(dot(p, T)*0.011 + h*6.28) + nz*0.2;
	return vec4(lit, cov);
}

void main(){
	vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
	// margins: strong, content column: faint
	float side = smoothstep(halfW*0.8, halfW*1.12 + 90., abs(p.x - cx));
	float amt = mix(0.1, 1.0, side);
	amt *= mix(0.62, 1.0, boost);
	float z0, z1, z2;
	vec4 t0 = thread(p, 1.42, 1./13.0, 0.3, 1.0, 1.7, 11., cA*0.85, cB, z0, 0.0);
	vec4 t1 = thread(p, 1.70, 1./10.5, 2.1, 1.3, 2.2, 47., cB, cC, z1, 0.5);
	vec4 t2 = thread(p, 1.30, 1./17., 4.4, 2.0, 3.2, 91., cC, cA, z2, 1.0);
	// sort back-to-front by z
	vec4 c[3]; float z[3];
	c[0]=t0; c[1]=t1; c[2]=t2; z[0]=z0; z[1]=z1; z[2]=z2;
	for (int i=0;i<2;i++) for (int j=0;j<2;j++) if (z[j]>z[j+1]) { float zt=z[j]; z[j]=z[j+1]; z[j+1]=zt; vec4 ct=c[j]; c[j]=c[j+1]; c[j+1]=ct; }
	vec3 rgb = vec3(0.); float a = 0.;
	for (int i=0;i<3;i++){
		float ai = c[i].a * amt * (0.9);
		float occ = a * 0.35;        // soft contact shadow where threads cross
		rgb = rgb * (1. - ai) * (1. - 0.0*occ) + c[i].rgb * ai;
		a = a * (1. - ai) + ai;
	}
	float gn = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
	o = vec4(rgb + (gn-.5)/255., a);
}`;

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	const view = mountCanvas(layer, { scale: 1, maxDpr: 1.25, maxPixels: 1.5e6 });
	const gl = view.gl;
	if (!gl) return () => view.destroy();
	const colors = siteColors(root);
	const prog = program(gl, FULLSCREEN_VS, FS);
	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);

	const page = root.querySelector(".site-page");
	let halfW = 400;
	let cx = 0;
	const measure = () => {
		view.fit();
		const r = page.getBoundingClientRect();
		halfW = Math.min(r.width, 832) / 2 - 24;
		cx = r.left + r.width / 2;
	};
	measure();

	// palettes: deep wine / indigo / rose-gold on paper; pearl lilac / cyan / pink on night
	const pal = dark
		? [[0.34, 0.2, 0.62], [0.16, 0.42, 0.66], [0.62, 0.26, 0.5]]
		: [[0.36, 0.1, 0.32], [0.16, 0.2, 0.5], [0.72, 0.34, 0.38]];

	const m = { x: -999, y: -999, tx: -999, ty: -999 };
	let boost = 0;
	let lastMove = -1e9;
	const pointer = trackPointer(layer, {
		onMove(s) {
			m.tx = s.x;
			m.ty = s.y;
			if (m.x < -900) {
				m.x = s.x;
				m.y = s.y;
			}
			boost = 1;
			lastMove = performance.now();
			loop.kick(reducedMotion ? 90 : 1);
		},
	});

	const t0 = Math.random() * 40;
	function draw(dt, t) {
		m.x += (m.tx - m.x) * Math.min(1, dt * 7);
		m.y += (m.ty - m.y) * Math.min(1, dt * 7);
		if (performance.now() - lastMove > 2500) boost = Math.max(0, boost - dt * 0.4);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, view.width, view.height);
		gl.disable(gl.BLEND);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		prog.use();
		prog.set("res", view.width, view.height);
		prog.set("dpr", view.dpr);
		prog.set("time", reducedMotion ? 7 : t0 + t);
		prog.set("halfW", halfW);
		prog.set("cx", cx);
		prog.set("boost", boost);
		prog.set("dark", dark ? 1 : 0);
		prog.set("mouse", m.x, m.y);
		prog.set("bg", colors.bg);
		prog.set("cA", pal[0]);
		prog.set("cB", pal[1]);
		prog.set("cC", pal[2]);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
	const loop = createLoop(draw, { continuous: !reducedMotion, fps: 40 });
	if (reducedMotion) loop.kick(2);
	let rt = 0;
	const ro = new ResizeObserver(() => {
		clearTimeout(rt);
		rt = setTimeout(() => {
			measure();
			loop.kick(2);
		}, 100);
	});
	ro.observe(layer);
	return () => {
		loop.stop();
		ro.disconnect();
		clearTimeout(rt);
		pointer.destroy();
		view.destroy();
	};
}
