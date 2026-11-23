// _wc/shader.js: the light-mode watercolor variant of the _vs4 aurora shader (header and footer). Dark mode never touches this.
// It patches the _vs4 shader source (read only) at a few points and swaps its light "ink" branch for a pigment-on-paper one. Everything is shader math
// (no textures, no filters): pooled edges, grain, granulation, blooms, wet-on-wet hue bleeding, multiply glazes and a cursor-pulled pigment trail.
import { AURORA_FS, AURORA_FS_FOOT } from "../_vs4/aurora.js";

export const PIG = { jade: [60, 175, 140], cornflower: [80, 150, 205], wisteria: [160, 115, 200], rose: [225, 120, 150] };
const u3 = (c) => c.map((v) => v / 255);

const HELP = `
uniform vec3 TR[8];
uniform vec3 GP0,GP1,GP2,GP3;

vec3 okScale(vec3 c,float k){
 vec3 q=pow(max(c,vec3(0.)),vec3(2.2));
 float l=pow(max(.4122214708*q.r+.5363325363*q.g+.0514459929*q.b,0.),.33333),m=pow(max(.2119034982*q.r+.6806995451*q.g+.1073969566*q.b,0.),.33333),s=pow(max(.0883024619*q.r+.2817188376*q.g+.6299787005*q.b,0.),.33333);
 float L=.2104542553*l+.7936177850*m-.0040720468*s,A=1.9779984951*l-2.4285922050*m+.4505937099*s,B=.0259040371*l+.7827717662*m-.8086757660*s;
 A*=k;B*=k;
 float l2=L+.3963377774*A+.2158037573*B,m2=L-.1055613458*A-.0638541728*B,s2=L-.0894841775*A-1.2914855480*B;
 l2=l2*l2*l2;m2=m2*m2*m2;s2=s2*s2*s2;
 vec3 r=vec3(4.0767416621*l2-3.3077115913*m2+.2309699292*s2,-1.2684380046*l2+2.6097574011*m2-.3413193965*s2,-.0041960863*l2-.7034186147*m2+1.7076147010*s2);
 return pow(clamp(r,0.,1.),vec3(1./2.2));
}
float grainN(vec2 f){ vec2 q=f/GS; return .5*vn(q)+.3*vn(q*2.3+9.1)+.2*hash(floor(f/max(GS*.5,1.))); }
void main(){`;

// per-mode GLSL: tt (palette index) modifier, and the light output
const MODES = {
	plain: { out: `float l=(1.-exp(-a*1.7))*.78; gl_FragColor=dither(vec4(h*l,l))*fq;` },
	pooled: { out: `
	  float body=smoothstep(.03,.2,a)*.5+(1.-exp(-a*1.7))*.28;
	  float rim=exp(-pow((a-.14)/.06,2.))*smoothstep(.02,.1,a);
	  float l=clamp(body+rim*.1,0.,.9);
	  vec3 hh=mix(h,h*h*.85,rim*.55);
	  gl_FragColor=dither(vec4(hh*l,l))*fq;` },
	paper: { gs: 1.6, out: `
	  float gg=grainN(fc);
	  float l=(1.-exp(-a*1.7))*.8*(.62+.75*gg);
	  vec3 hh=mix(h,h*h*.9,(1.-gg)*.35);
	  l=clamp(l,0.,.95);
	  gl_FragColor=dither(vec4(hh*l,l))*fq;` },
	granulate: { gs: 1.2, out: `
	  float sp=hash(floor(fc*.9)+7.); float sp2=vn(fc*.35+3.);
	  float dotk=smoothstep(.80,.93,sp)*(.35+.65*sp2);
	  float pit=smoothstep(.12,.03,sp);
	  float l=(1.-exp(-a*1.5))*.62*(1.-pit*.55)+dotk*.16*smoothstep(.02,.2,a);
	  vec3 hh=mix(h,h*h*.85,clamp(dotk*1.1,0.,1.)*.7);
	  l=clamp(l,0.,.9);
	  gl_FragColor=dither(vec4(hh*l,l))*fq;` },
	bloom: { out: `
	  float n=fbm(vec2(px/70.,py/50.)+SD.xy*9.);
	  float thr=.76-.12*LV;
	  float ez=exp(-pow((a-.2)/.15,2.));
	  float blob=smoothstep(thr,thr+.05,n)*ez;
	  float rimb=exp(-pow((n-thr)/.04,2.))*ez;
	  float l=(1.-exp(-a*1.7))*.78;
	  l=l*(1.-.6*blob)+rimb*.09*smoothstep(.02,.12,a);
	  vec3 hh=mix(h,h*h*.8,rimb*.75);
	  l=clamp(l,0.,.95);
	  gl_FragColor=dither(vec4(hh*l,l))*fq;` },
	wet: { tt: `tt+=(fbm(vec2(px/170.+T*.03,py/70.+T*.02+SD.x*5.))-.5)*1.0+.28*sin(px/230.+T*.12+SD.z*6.);`, out: `
	  float soft=.8+.4*fbm(vec2(px/90.-T*.02,py/60.));
	  float l=(1.-exp(-a*1.4))*.66*soft;
	  gl_FragColor=dither(vec4(h*l,l))*fq;` },
	duet: { tt: `tt=clamp(.12+.8*(.5+.5*sin(px/270.+T*.06+py/230.+SD.x*6.))+(tt-.4)*.22,0.,1.2);`, out: `float l=(1.-exp(-a*1.6))*.74; gl_FragColor=dither(vec4(h*l,l))*fq;` },
	cool: { out: `float l=(1.-exp(-a*1.5))*.62; vec3 hh=mix(h,vec3(1.),.06); gl_FragColor=dither(vec4(hh*l,l))*fq;` },
	glaze: { out: `
	  vec3 Tm=vec3(1.);
	  VL*=v/(VL.x+VL.y+VL.z+1e-4)*AM;
	  float wv=.5+.5*sin(px/340.+T*.05);
	  for(int L=0;L<3;L++){
	    float kk=(1.-exp(-VL[L]*1.3))*.42;
	    vec3 cL=L==0?mix(GP0,GP1,wv):(L==1?mix(GP1,GP2,1.-wv):mix(GP2,GP3,wv));
	    Tm*=mix(vec3(1.),cL,kk);
	  }
	  float mT=min(Tm.r,min(Tm.g,Tm.b));
	  gl_FragColor=dither(vec4(Tm-vec3(mT),1.-mT))*fq;` },
	pull: { out: `float l=(1.-exp(-a*1.7))*.78; gl_FragColor=dither(vec4(h*l,l))*fq;` },
};

export function wcShader(mode, foot, boost = false) {
	const M = MODES[mode];
	let s = foot ? AURORA_FS_FOOT : AURORA_FS;
	const rep = (a, b) => { if (!s.includes(a)) throw new Error("wc shader patch failed: " + a.slice(0, 30)); s = s.replace(a, b); };
	rep("void main(){", HELP.replace("float grainN", `const float GS=${(M.gs || 1.5).toFixed(2)};\nfloat grainN`));
	rep("mix(vec3(lum),col,1.+1.1*g+.4*sp)", "mix(vec3(lum),col,DK>.5?1.+1.1*g+.4*sp:1.+.1*g+.06*sp)");
	rep("float v=0.,ln0=0.;", "float v=0.,ln0=0.;vec3 VL=vec3(0.);");
	rep("v+=exp(-pow(py/hl,1.5))*soft*(1.-.2*fl);", "float vv=exp(-pow(py/hl,1.5))*soft*(1.-.2*fl);v+=vv;VL[L]=vv;");
	// pulled pigment: streaks hanging from where the cursor has been, hue taken from the pigment it left
	const pull = mode === "pull" ? `
 float ps=0.,ph=0.;
 for(int i=0;i<8;i++){ float w=TR[i].y; float dx=px-TR[i].x; float sk=w*exp(-pow(dx/(34.+70.*(1.-w)),2.))*exp(-py/(110.+190.*w)); ps+=sk; ph+=sk*TR[i].z; }
 v+=ps*1.05; ph/=(ps+1e-4);` : "";
	rep("float tt=clamp(", `${pull}\n float tt=clamp(`);
	const ttp = mode === "pull" ? "tt=mix(tt,ph,clamp(ps*1.6,0.,.85));" : "";
	rep("vec3 col=pal(tt);", `${M.tt || ""}${ttp}\n vec3 col=pal(tt);`);
	// the light branch
	const i0 = s.indexOf("else{\n  // light: luminous ink");
	if (i0 < 0) throw new Error("wc shader: light branch not found");
	const i1 = s.indexOf("\n}`", i0) >= 0 ? s.length : s.length;
	const tail = s.slice(i0);
	const end = tail.indexOf("gl_FragColor=dither(vec4(h*l,l))*fq;");
	if (end < 0) throw new Error("wc shader: light tail not found");
	const after = tail.slice(end + "gl_FragColor=dither(vec4(h*l,l))*fq;".length);
	s = s.slice(0, i0) + `else{\n vec3 h=${boost ? "okScale(clamp(col,0.,1.),1.+.25*LV)" : "clamp(col,0.,1.)"};\n vec2 fc=gl_FragCoord.xy;\n ${boost ? "a*=1.+.25*LV;\n " : ""}${M.out}${after}`;
	return s;
}

// uniforms for a mode: pigment stops (LP0..LP3 feed _vs4's pal) plus the glaze pigments
export function wcUniforms(mode) {
	const j = u3(PIG.jade), c = u3(PIG.cornflower), w = u3(PIG.wisteria), r = u3(PIG.rose);
	let stops = [j, c, w, r];
	if (mode === "duet") stops = [j, j, r, r];
	if (mode === "cool") stops = [j, c, w, w];
	return { LP0: stops[0], LP1: stops[1], LP2: stops[2], LP3: stops[3], LP4: stops[3], LTN: [1, 1, 1], GP0: j, GP1: c, GP2: w, GP3: r };
}
