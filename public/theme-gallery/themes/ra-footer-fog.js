import { GL, GLSL, AURORA_FN, footerStage, createLoop, pointerTracker, topAurora, isDark, clamp } from "./_refined-e/kit.js";

const FS = GLSL + AURORA_FN + `
float fogN(vec2 p,float sp,float sd){
 vec2 q=p*vec2(1.5,3.2)+vec2(T*sp,sd);
 q+=.55*vec2(fbm3(q*.6+3.),fbm3(q*.6+9.));   // domain warp breaks any horizontal structure
 return smoothstep(.36,.82,fbm3(q));
}
float ridgeY(float x,float y0,float a,float f,float s){return y0+(fbm3(vec2(x*f+s,s*.7))-.5)*a;}
void main(){
 vec2 uv=gl_FragCoord.xy/R;uv.y=1.-uv.y;
 float x=uv.x*3.2;
 float px=1.3/R.y;
 bool dk=DK>.5;
 // ---- sky ----
 vec4 A=aurora(uv,1.);
 float k=AMP*smoothstep(0.,.16,uv.y)*(1.-smoothstep(.62,.84,uv.y));
 vec4 o=glow(A.rgb*k,A.a*k,1.3);
 vec4 At=aurora(vec2(uv.x,BASE+.03),1.);
 vec3 tint=At.rgb/(At.a+.001);
 float ga=(1.-exp(-At.a*.9))*(1.+E*.5);
 // ---- far ridge, fog, mid ridge, fog, near ridge ----
 vec3 c1=dk?vec3(.15,.23,.40):vec3(.83,.89,.93);
 vec3 c2=dk?vec3(.095,.15,.28):vec3(.74,.83,.88);
 vec3 c3=dk?vec3(.035,.06,.12):vec3(.64,.77,.83);
 vec3 mist=dk?vec3(.16,.27,.42):vec3(.97,.98,1.);
 float y1=ridgeY(x,.5,1.5,.45,1.3),y2=ridgeY(x,.66,1.1,.7,4.1),y3=ridgeY(x,.84,.6,1.0,7.7);
 float m1=smoothstep(-px,px,uv.y-y1);
 float rim1=exp(-max(uv.y-y1,0.)/.02)*m1*ga;
 vec3 col1=c1+tint*rim1*(dk?.35:.18);
 o=over(vec4(col1*m1,m1),o);
 float e1=exp(-pow((uv.y-(y1+.05))/.16,2.))*(.55+.7*vn(vec2(x*.9,5.)));
 float f1=fogN(vec2(x,uv.y),.02,0.)*e1;
 vec3 fc1=mist*(dk?.55:1.)+tint*ga*(dk?.85:.25)*vec3(1.);
 float fa1=f1*(dk?.95:.8);
 o=over(vec4(fc1*fa1*(dk?.6:1.),fa1),o);
 float m2=smoothstep(-px,px,uv.y-y2);
 float rim2=exp(-max(uv.y-y2,0.)/.016)*m2*ga;
 o=over(vec4((c2+tint*rim2*(dk?.22:.1))*m2,m2),o);
 float e2=exp(-pow((uv.y-(y2+.04))/.13,2.))*(.5+.8*vn(vec2(x*1.1,12.)));
 float f2=fogN(vec2(x+3.,uv.y),-.03,5.)*e2;
 float fa2=f2*(dk?.9:.75);
 o=over(vec4((mist*(dk?.5:1.)+tint*ga*(dk?.55:.15))*fa2*(dk?.7:1.),fa2),o);
 float m3=smoothstep(-px,px,uv.y-y3);
 o=over(vec4(c3*m3,m3),o);
 float f3=fogN(vec2(x+9.,uv.y*1.1),.012,11.)*exp(-pow((uv.y-(y3+.015))/.05,2.))*.3;
 o=over(vec4(mist*(dk?.45:1.)*f3,f3),o);
 // dim bottom so the footer text sits on a calm, quiet ground
 o*=smoothstep(0.,.1,uv.y);
 gl_FragColor=dither(o);
}`;

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const stage = footerStage(root, { height: 260 });
	if (!stage) return;
	const { host } = stage;
	const top = topAurora(root, { level: 2, reduced: reducedMotion });
	const gl = new GL(host, FS, { scale: 0.6 });
	const st = { x: 0.5, y: 0.3, tx: 0.5, ty: 0.3, e: 0 };
	let W = 1, H = 1;
	const ptr = pointerTracker(host, (s, kind) => {
		if (kind === "out") { st.tx = 0.5; st.ty = 0.3; }
		else if (kind === "move") { st.tx = clamp(s.x / W, -0.2, 1.2); st.ty = clamp(s.y / H, -0.5, 1.5); }
		loop.wake();
	});
	const draw = (t, dt) => {
		const a = reducedMotion ? 1 : 1 - Math.exp(-dt * 4);
		const ox = st.x, oy = st.y;
		st.x += (st.tx - st.x) * a; st.y += (st.ty - st.y) * a;
		st.e += (Math.min(1, Math.hypot(st.x - ox, st.y - oy) / Math.max(dt, 0.001) / 1.2) - st.e) * (1 - Math.exp(-dt * 2));
		gl.draw({ T: t * (0.8 + st.e * 1.5) + 20, DK: dark ? 1 : 0, AMP: dark ? 0.75 : 1.0, E: st.e, M: [st.x, clamp(st.y, 0.05, 0.6)],
			BASE: 0.2, HGT: 0.12, WOB: 0.7, LS: 0.07, RAYS: 0.7, WX: 3.2, WAVE: 0.4, PULL: 0.35, LOWF: 0.03 });
	};
	const loop = createLoop({ host, fps: 24, reduced: reducedMotion, draw });
	stage.onSize = (s) => { W = s.w; H = s.h; gl.resize(W, H); loop.start(); loop.redraw(); };
	stage.layout();
	return () => { loop.destroy(); ptr.destroy(); gl.destroy(); stage.destroy(); top(); };
}
