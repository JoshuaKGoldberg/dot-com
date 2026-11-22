import { createJourney, compileProgram, drawFullscreen, GLSL_NOISE } from "./_scroll/lib.js";

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uZ, uT, uDark;
out vec4 o;
${GLSL_NOISE}
float n1(float x,float s){ return vnoise(vec2(x,s)); }
float tri(float x){ return abs(fract(x)-.5)*2.; }
const float HY=.5;
const vec2 SUN=vec2(-.42,.66);

vec3 sky(vec2 q){
  float h=clamp((q.y-HY)/(1.-HY),0.,1.);
  vec3 lo=mix(vec3(.96,.84,.70),vec3(.30,.38,.62),uDark);
  vec3 hi=mix(vec3(.30,.54,.80),vec3(.012,.025,.085),uDark);
  vec3 c=mix(lo,hi,pow(h,.5));
  float d=length(q-SUN);
  vec3 sc=mix(vec3(1.,.82,.52),vec3(.86,.91,1.),uDark);
  c+=sc*(exp(-d*6.)*.42+smoothstep(.05,.044,d)*.95);
  float cl=fbm(vec2(q.x*2.2+uZ*.004,q.y*9.)+uT*.01);
  c=mix(c,mix(vec3(1.,.93,.85),vec3(.35,.42,.62),uDark),smoothstep(.55,.8,cl)*.35*smoothstep(0.,.25,h));
  if(uDark>.5){ vec2 g=floor(q*vec2(210.,120.)); float s=hash(g); float tw=.6+.4*sin(uT*2.+s*50.);
    c+=step(.9972,s)*tw*smoothstep(.05,.4,h)*.9; }
  return c;
}
vec3 mountains(vec3 c,vec2 q,float camx){
  vec3 fog=mix(vec3(.93,.85,.76),vec3(.14,.2,.38),uDark);
  for(int k=0;k<3;k++){
    float fk=float(k);
    float f=1.6+fk*1.5;
    float x=q.x*f+camx*.04*(fk+1.)+fk*11.;
    float ridge=.075+fk*.012+(.10-fk*.025)*(.6*n1(x,fk*3.7)+.4*n1(x*2.7,fk*5.1+2.));
    ridge-=fk*.015;
    vec3 col=mix(vec3(.55,.67,.80),vec3(.30,.44,.50),fk*.5);
    col=mix(col,mix(vec3(.20,.27,.46),vec3(.10,.16,.28),fk*.5),uDark);
    col=mix(col,fog,.5-fk*.2);
    float shade=n1(x*6.,fk)*.18; col*=1.-shade*.5;
    c=mix(c,col,smoothstep(0.003,-0.002,q.y-HY-ridge));
  }
  return c;
}
vec4 islands(vec2 q,float camx){
  vec4 res=vec4(0.); float best=1e9;
  vec3 fog=mix(vec3(.88,.82,.74),vec3(.10,.16,.30),uDark);
  for(int i=0;i<12;i++){
    float fi=float(i);
    float dz=4.+fi*5.2-uZ;
    if(dz<.6||dz>46.) continue;
    float side=mod(fi,2.)<.5?-1.:1.;
    float hx=hash(vec2(fi,3.1)), hw=hash(vec2(fi,7.7));
    float wx=side*(1.9+hx*1.2);
    float s=.85/dz;
    float cx=(wx-camx)*s;
    float base=HY-.3*s;
    float W=.8+hw*.9, Hh=.42+hw*.32;
    float u=(q.x-cx)/(W*s);
    if(abs(u)>=1.) continue;
    float prof=pow(1.-u*u,.55)*(.72+.28*tri(u*10.+fi*3.)) + pow(tri(u*4.5+fi),4.)*.38*(1.-u*u);
    float top=base+Hh*s*prof;
    bool refl=q.y<base;
    float yy=refl?2.*base-q.y:q.y;
    if(yy<top&&dz<best&&(!refl||q.y>base-Hh*s*1.2)){
      best=dz;
      float hgt=clamp((yy-base)/max(1e-4,top-base),0.,1.);
      vec3 dark=mix(vec3(.06,.15,.13),vec3(.04,.09,.12),uDark);
      vec3 lit=mix(vec3(.24,.40,.30),vec3(.12,.20,.28),uDark);
      vec3 c=mix(dark,lit,hgt*.8+.2*(-u*.5+.5));
      c*=.85+.3*n1(u*60.+fi,yy*90.);
      float fg=1.-exp(-dz*.05);
      c=mix(c,fog,fg);
      float shore=smoothstep(.012*s*8.,0.,yy-base);
      c=mix(c,mix(vec3(.55,.5,.42),vec3(.12,.12,.16),uDark),shore*.55);
      res=vec4(c,refl?.8:1.);
    }
  }
  return res;
}
void main(){
  vec2 q=vec2(gl_FragCoord.x-.5*uRes.x,gl_FragCoord.y)/uRes.y;
  float camx=sin(uZ*.45)*.5+sin(uZ*.17)*.4;
  vec3 col;
  float depth=HY-q.y;
  if(depth<=0.){
    col=sky(q);
    col=mountains(col,q,camx);
    vec4 il=islands(q,camx); col=mix(col,il.rgb,il.a);
  } else {
    float dist=.255/depth;
    float wx=q.x*dist/.85+camx;
    float rp=fbm(vec2(wx*2.2,(uZ+dist)*1.5)+uT*.04);
    float ripple=(rp-.5);
    float amp=smoothstep(0.,.3,depth);
    vec2 rq=vec2(q.x+ripple*.02*amp,HY+depth+ripple*.012*amp);
    vec3 refl=sky(rq); refl=mountains(refl,rq,camx);
    vec4 il=islands(vec2(q.x+ripple*.012*amp,q.y),camx);
    refl=mix(refl,il.rgb,il.a);
    vec3 deep=mix(vec3(.10,.27,.34),vec3(.04,.10,.19),uDark);
    float fres=.5+.4*exp(-depth*6.);
    col=mix(deep,refl*.92,fres);
    float g=smoothstep(.56,.78,rp)*exp(-abs(q.x-SUN.x*(1.+depth*.5))*(2.5+depth*2.))*exp(-depth*1.8);
    col+=mix(vec3(1.,.8,.55),vec3(.8,.88,1.),uDark)*g*.55;
    float line=smoothstep(.0,.05,abs(sin((rp*14.+dist*.4-uZ*.3)*2.)))*0.0;
    col+=ripple*.12*amp;
  }
  float hz=exp(-abs(depth)*16.);
  col=mix(col,mix(vec3(.96,.88,.78),vec3(.2,.27,.46),uDark),hz*.5);
  col*=1.-.25*dot(q-vec2(0.,.5),q-vec2(0.,.5))*.8;
  o=vec4(col,1.);
}`;

export function activate({ root, mode, reducedMotion }) {
	const overlay = root.querySelector(".overlay-b");
	const hud = document.createElement("div");
	hud.className = "pd-hud";
	hud.setAttribute("aria-hidden", "true");
	overlay.append(hud);
	const canoe = document.createElement("div");
	canoe.className = "pd-canoe";
	canoe.innerHTML = '<i class="pd-paddle"></i><i class="pd-bow"></i>';
	root.querySelector(".overlay-a").append(canoe);

	let prog;
	const journey = createJourney(root, {
		type: "webgl",
		reducedMotion,
		dark: mode === "dark",
		scale: 0.6,
		maxDpr: 1,
		ambientFps: 24,
		follow: 6,
		draw(S) {
			const gl = S.gl;
			if (!prog) {
				prog = compileProgram(gl, FS);
				prog.use();
			}
			prog.u("uRes", S.w, S.h);
			prog.u("uZ", S.p * 52);
			prog.u("uT", S.t);
			prog.u("uDark", mode === "dark" ? 1 : 0);
			drawFullscreen(gl);
			hud.textContent = `Paddled ${(S.p * 3.4).toFixed(1)} mi`;
		},
	});
	return () => journey.destroy();
}
