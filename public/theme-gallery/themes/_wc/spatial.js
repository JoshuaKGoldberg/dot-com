// _wc/spatial.js: the "spatial scene" pass for the hero cutout, in one small WebGL program.
//  - displaces the cutout per pixel by its depth map (two-step parallax lookup), so near parts (face, nose) move more than far ones (shoulders)
//  - optional eye pass: the baked eyes-without-irises image plus the iris sprite, offset toward the pointer and clipped by the eye-opening mask
//  - a zoom, a small perspective-ish rotation, and a lift offset; the output is a premultiplied RGBA canvas the size of the portrait's overflow canvas
const A = new URL("../../assets/", import.meta.url).href;
const cache = new Map();
const img = (f) => { if (!cache.has(f)) cache.set(f, new Promise((res) => { const i = new Image(); i.decoding = "async"; i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = A + f; })); return cache.get(f); };
export const loadSpatial = async () => {
	const [body, depth, eyesBody, iris, mask, json] = await Promise.all([img("headshot-body-512.webp"), img("headshot-depth-512.png"), img("headshot-eyes-512.webp"), img("headshot-iris-512.png"), img("headshot-eyemask-512.png"), fetch(A + "headshot-eyes-512.json").then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
	// the depth map dilated outward (a max filter, built once) so the silhouette's fringe moves with the person: no seam line where depth jumps to the background
	let dd = depth;
	if (depth) {
		const n = depth.naturalWidth || 512, c = document.createElement("canvas"); c.width = c.height = n;
		const g = c.getContext("2d"); g.drawImage(depth, 0, 0); g.globalCompositeOperation = "lighten";
		for (const r of [2, 4, 6]) for (let k = 0; k < 8; k++) g.drawImage(depth, Math.cos((k * Math.PI) / 4) * r, Math.sin((k * Math.PI) / 4) * r);
		const c2 = document.createElement("canvas"); c2.width = c2.height = n; const g2 = c2.getContext("2d"); g2.filter = "blur(1.6px)"; g2.drawImage(c, 0, 0); g2.filter = "none"; dd = c2;
	}
	return { body, depth: dd, eyesBody, iris, mask, json, ok: !!(body && depth) };
};

const VS = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
const FS = `precision highp float;
varying vec2 v;
uniform sampler2D B,Dp,EB,IR,EM;
uniform vec2 OFF,OL,OR,CEN;
uniform float ZM,ROT,D0,EYE,SPLIT,PAD,TY,FK,DBG;
uniform vec3 FC;
uniform vec2 FR;
// Warp strength field (how much of the depth variation is applied): 1 below the neck, falling smoothly toward the head, lowest (~12%) at the face and
// radiating out from it, so the head (face + hood + ears + antenna) moves as one nearly rigid piece. strength = smoothmax(floor, smoothmin(radial, vertical)).
const float FLOOR=.12, HEADV=.26, DFLAT=.85;
float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
float warpK(vec2 uv){
 vec2 q=uv-FC.xy; q.x/=FR.x; q.y/=(q.y>0.?FR.y*.55:FR.y);
 float r=length(q);
 float R=FLOOR+(1.-FLOOR)*smoothstep(.55,2.75,r);
 float V=HEADV+(1.-HEADV)*smoothstep(325./512.,430./512.,uv.y);
 return max(FLOOR,smin(R,V,.12));
}
float faceFlat(vec2 uv,float d){ return DFLAT+mix(1.,warpK(uv),FK)*(d-DFLAT); }
// v: 0..1 over the overflow canvas (y up). The cutout occupies PAD..1-PAD.
vec4 body(vec2 uv){
 if(uv.x<0.||uv.y<0.||uv.x>1.) return vec4(0.);
 if(uv.y>1.) uv.y=1.; // never show the photo's bottom edge: the last row is stretched (the portrait's circle clips it)
 if(EYE<.5) return texture2D(B,uv);
 vec4 c=texture2D(EB,uv);
 vec2 o=uv.x<SPLIT?OL:OR;
 vec4 ir=texture2D(IR,uv-o); float m=texture2D(EM,uv).r;
 return c*(1.-ir.a*m)+ir*m;
}
void main(){
 vec2 c=vec2(v.x,1.-v.y);
 vec2 uv=(c-PAD)/(1.-2.*PAD);
 uv-=CEN; float cs=cos(ROT),sn=sin(ROT); uv=vec2(cs*uv.x+sn*uv.y,-sn*uv.x+cs*uv.y); uv=uv/ZM+CEN; uv.y+=TY;
 uv.y=min(uv.y,1.);
 float d1=faceFlat(uv,texture2D(Dp,clamp(uv,0.,1.)).r);
 vec2 u1=uv-OFF*(d1-D0);
 float d2=faceFlat(u1,texture2D(Dp,clamp(u1,0.,1.)).r);
 vec2 u2=uv-OFF*(d2-D0);
 vec4 bc=body(u2);
 if(DBG>.5){ float k=warpK(u2); vec3 hc=mix(vec3(.1,.2,.9),vec3(1.,.15,.1),k); hc=mix(hc,vec3(1.,.9,.2),smoothstep(.7,1.,k)); gl_FragColor=vec4(hc*bc.a*.85,bc.a*.85); return; }
 gl_FragColor=bc;
}`;

export function makeSpatial(E, A_) {
	const c = document.createElement("canvas"); c.width = c.height = E.C;
	const gl = c.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true, depth: false, stencil: false, powerPreference: "low-power" });
	if (!gl) return null;
	const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn("[wc]", gl.getShaderInfoLog(x)); return null; } return x; };
	const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return null;
	const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
	if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn("[wc]", gl.getProgramInfoLog(pr)); return null; }
	gl.useProgram(pr); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const al = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
	gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.viewport(0, 0, E.C, E.C);
	const loc = {}, L = (k) => (loc[k] ??= gl.getUniformLocation(pr, k));
	const tex = (name, image, unit, premul) => {
		const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premul); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		for (const [k, vv] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, vv);
		gl.uniform1i(L(name), unit); return t;
	};
	const eyes = !!(A_.eyesBody && A_.iris && A_.mask && A_.json);
	const texs = [tex("B", A_.body, 0, true), tex("Dp", A_.depth, 1, false)];
	if (eyes) texs.push(tex("EB", A_.eyesBody, 2, true), tex("IR", A_.iris, 3, true), tex("EM", A_.mask, 4, false));
	const PAD = (E.D - E.D) / E.C; // the cutout is drawn at E.o..E.o+E.D inside the overflow canvas
	const pad = E.o / E.C;
	gl.uniform1f(L("PAD"), pad); gl.uniform3f(L("FC"), 289 / 512, 240 / 512, 0.9); gl.uniform2f(L("FR"), 62 / 512, 88 / 512); gl.uniform1f(L("FK"), 1); gl.uniform2f(L("CEN"), 0.5, 0.5); gl.uniform1f(L("SPLIT"), eyes ? A_.json.split / 512 : 0.5); void PAD;
	return {
		canvas: c, eyes,
		render({ offx = 0, offy = 0, d0 = 0.35, zoom = 1, rot = 0, ty = 0, eye = 0, oL = [0, 0], oR = [0, 0] }) {
			gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
			gl.uniform2f(L("OFF"), offx, offy); gl.uniform1f(L("D0"), d0); gl.uniform1f(L("ZM"), zoom); gl.uniform1f(L("ROT"), rot); gl.uniform1f(L("TY"), ty); gl.uniform1f(L("DBG"), window.__wcDbg ? 1 : 0); gl.uniform1f(L("FK"), window.__wcOld ? 0 : 1);
			gl.uniform1f(L("EYE"), eyes && eye ? 1 : 0); gl.uniform2f(L("OL"), oL[0], oL[1]); gl.uniform2f(L("OR"), oR[0], oR[1]);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		},
		destroy() { try { gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch {} },
	};
}
