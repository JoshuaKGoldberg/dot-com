import { createJourney, compileProgram, drawFullscreen, GLSL_NOISE, stops, clamp } from "./_scroll/lib.js";

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uAlt, uT, uDark;
out vec4 o;
${GLSL_NOISE}
const float DK[5]=float[5](2.2,4.0,6.0,8.2,10.4);
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float alt=uAlt;
  float s=smoothstep(7.,14.,alt);
  float hi=smoothstep(3.,12.,alt);
  vec3 d=normalize(vec3(uv.x,uv.y+.16,.9));
  float hy=-.16-.1*s+.30*s*uv.x*uv.x;
  float below=uv.y-hy;
  vec3 zen=mix(mix(vec3(.16,.40,.80),vec3(.01,.02,.07),hi),mix(vec3(.03,.06,.17),vec3(.0,.0,.02),s),uDark);
  vec3 hor=mix(mix(vec3(.80,.89,.98),vec3(.30,.55,.95),hi),mix(vec3(.18,.25,.46),vec3(.05,.12,.3),s),uDark);
  vec3 col;
  if(below>=0.){
    float up=clamp(below*1.35,0.,1.);
    col=mix(hor,zen,pow(up,.55+.5*s));
    float l=length(uv-vec2(.55,.40));
    vec3 sunc=mix(vec3(1.,.93,.72),vec3(.8,.88,1.),uDark);
    vec2 mp=mix(vec2(.55,.40),vec2(-.5,.38),uDark);
    l=length(uv-mp);
    col+=sunc*(exp(-l*(5.-3.*s))*mix(.5,.28,uDark)+smoothstep(.045,.035,l)*mix(.95,.8,uDark));
    float stv=max(s,uDark*.55)*smoothstep(0.,.25,below);
    if(stv>0.){
      vec2 g=floor(uv*vec2(300.,170.)+vec2(7.));
      float h=hash(g);
      float tw=.55+.45*sin(uT*2.+h*40.);
      col+=vec3(step(.9965,h)*tw*stv)*(.5+.5*hash(g+3.));
    }
    col+=vec3(.3,.55,1.)*(exp(-below*9.)*.5+exp(-below*40.)*.8)*s;
  } else {
    float dep=-below;
    vec2 e=vec2(uv.x,dep)/(dep+.14)*2.2+vec2(0.,uAlt*.12);
    float n=fbm(e*1.4);
    vec3 low=mix(vec3(.16,.34,.20),vec3(.18,.42,.58),smoothstep(.5,.58,n));
    low=mix(low,vec3(.55,.5,.4),smoothstep(.7,.8,fbm(e*3.)) *.4);
    vec3 spc=mix(vec3(.03,.16,.42),vec3(.12,.35,.2),smoothstep(.55,.72,fbm(e*.7+3.)));
    float sw=smoothstep(.55,.78,fbm(vec2(e.x*.9,e.y*1.6)+uT*.004));
    spc=mix(spc,vec3(.95),sw*.85);
    vec3 earth=mix(low,spc,s);
    earth=mix(earth,earth*vec3(.08,.12,.22),uDark*.9);
    float city=step(.987,hash(floor(e*vec2(70.,70.))))*smoothstep(.55,.65,fbm(e*2.2))*uDark;
    earth+=vec3(1.,.8,.4)*city*1.3;
    float fog=exp(-dep*mix(2.4,.7,s));
    col=mix(earth,hor,fog*(1.-s*.7));
    col+=vec3(.3,.55,1.)*exp(-dep*30.)*s*1.3;
  }
  // cloud decks
  vec3 lit=mix(vec3(1.,.985,.96),vec3(.46,.52,.70),uDark);
  vec3 under=mix(vec3(.56,.63,.75),vec3(.12,.15,.27),uDark);
  float cy=d.y;
  if(abs(cy)>.004){
    for(int j=0;j<5;j++){
      int k=cy>0.?4-j:j;
      float h=DK[k];
      float dy=h-alt;
      if((cy>0.)!=(dy>0.)) continue;
      float t=dy/cy;
      if(t>70.) continue;
      vec2 p=d.xz*t+vec2(0.,uT*.35+alt*0.)+vec2(float(k)*5.3,0.);
      float n=fbm(p*.24+vec2(0.,float(k)*3.1));
      float n2=fbm(p*.24+vec2(.5,.35)+vec2(0.,float(k)*3.1));
      float dens=smoothstep(.50,.76,n+.14*vnoise(p*.9));
      float a=dens*exp(-t*.085);
      float shade=clamp(.5+(n-n2)*3.,0.,1.);
      vec3 cc=cy>0.?mix(under,lit,shade*.7+dens*.2):mix(lit*.86,lit,shade);
      col=mix(col,cc,clamp(a,0.,1.));
    }
  }
  float fw=0.;
  for(int k=0;k<5;k++) fw=max(fw,smoothstep(1.0,0.,abs(alt-DK[k])));
  col=mix(col,mix(vec3(.93,.95,.98),vec3(.28,.32,.46),uDark),fw*.88);
  col*=1.-.22*dot(uv,uv);
  o=vec4(col,1.);
}`;

const NAMES = [[0, "Cumulus"], [0.25, "Altocumulus"], [0.55, "Cirrus"], [0.78, "Stratosphere"], [0.93, "Space"]];

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const hud = document.createElement("div");
	hud.className = "sf-hud";
	hud.setAttribute("aria-hidden", "true");
	root.querySelector(".overlay-b").append(hud);
	let prog, altOf, meters;
	const journey = createJourney(root, {
		type: "webgl",
		reducedMotion,
		dark,
		scale: 0.55,
		maxDpr: 1,
		ambientFps: 12,
		follow: 6,
		draw(S) {
			const gl = S.gl;
			if (!prog) {
				prog = compileProgram(gl, FS);
				prog.use();
			}
			altOf ||= stops(S.anchors, [0.4, 3.1, 5.1, 7.2, 9.6, 14.5]);
			meters ||= stops(S.anchors, [1600, 3200, 6500, 10500, 21000, 408000]);
			prog.u("uRes", S.w, S.h);
			prog.u("uAlt", altOf(S.p));
			prog.u("uT", S.t);
			prog.u("uDark", dark ? 1 : 0);
			drawFullscreen(gl);
			const f = clamp(altOf(S.p) / 14.5);
			let name = NAMES[0][1];
			for (const [t, n] of NAMES) if (f >= t) name = n;
			const m = meters(S.p);
			hud.textContent = `${name} · ${m >= 50000 ? Math.round(m / 1000) + " km" : Math.round(m / 100) * 100 + " m"}`;
		},
	});
	return () => journey.destroy();
}
