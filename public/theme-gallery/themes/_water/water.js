/*
 * _water/water.js : a calm, GPU height-field lake for the dock footers.
 *
 *   import { createWaterSim } from "./_water/water.js";
 *   const water = createWaterSim({ width, height, dark, reduced, obstacles, reflection, weather });
 *   water.canvas                 rendered water (CSS size width x height), pointer-events: none
 *   water.setReflection(canvas)  swap the mirror source (call <= ~10-15 fps)
 *   water.setObstacles(list)     [{ x, y, r }] piling footprints, CSS px, region coords (y down)
 *   water.start() / stop() / destroy()
 *   extras: setWeather(w), setDark(b), resize(w, h), disturb(x, y, amp), swell(amp)
 *
 * Simulation: damped anisotropic wave equation on an RGBA16F ping-pong pair
 * (R = height, G = velocity), fixed 60 Hz timestep, ~0.5x resolution capped by area.
 * Pilings are reflecting (Neumann) boundaries from a tiny CPU-rasterised mask.
 * Rendering: normals from the height field -> refraction of the reflection canvas,
 * Fresnel modulation, soft glints, trough shading, caustic lines and a faint foam
 * ring at the pilings. Rest state is an exact mirror.
 *
 * Perf: one WebGL2 context, DPR <= 1.5, ~30 fps, runs only while visible
 * (IntersectionObserver + start/stop + document.hidden). 2D fallback when WebGL2 or
 * float render targets are missing. Reduced motion draws the still reflection only.
 */

const TAU = Math.PI * 2;
const STEP = 1 / 60;
const TIME_SCALE = 0.28; // the whole lake runs ~3.5x slower than real time: calm, far-off water
const MAX_SPLATS = 24;
const ANISO = 0.7; // y-extent of rings / pilings relative to x (low viewing angle)
const SIM_CELL_CAP = 250000; // fine detail: ~1 cell per CSS px (capped by area)

const WEATHER = {
  calm: {
    wind: 0.0036, gustBase: 0.55, wspeed: 0.55, dir: [0.82, -0.57], damp: 0.9962,
    rain: 0, swell: [8, 16], swellAmp: 1, swellPeriod: 1.4,
  },
  drizzle: {
    wind: 0.0025, gustBase: 0.6, wspeed: 0.4, dir: [0.7, -0.7], damp: 0.9955,
    rain: 1, swell: [30, 50], swellAmp: 0.35, swellPeriod: 1.5,
  },
  wind: {
    wind: 0.016, gustBase: 0.14, wspeed: 1.5, dir: [0.96, -0.28], damp: 0.9948,
    rain: 0, swell: [5, 10], swellAmp: 0.7, swellPeriod: 1.1,
  },
};

const VERT = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
void main(){ gl_Position = vec4(P[gl_VertexID], 0., 1.); }`;

const SIM_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uState, uMask;
uniform vec2 uSize, uC2, uWindDir;
uniform float uT, uDamp, uWind, uGustBase, uWSpeed, uSwellAmp, uSwellPhase, uSwellTilt;
uniform int uN;
uniform vec4 uSplat[${MAX_SPLATS}];
out vec4 o;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
ivec2 sz;
float hc;
float nb(ivec2 q){
  q = clamp(q, ivec2(0), sz - 1);
  if (texelFetch(uMask, q, 0).r > .5) return hc;
  return texelFetch(uState, q, 0).r;
}
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  sz = ivec2(uSize);
  if (texelFetch(uMask, p, 0).r > .5) {
    // solid cell: never read by the solver (ghost cells use the fluid side); store the
    // neighbour mean purely so rendering has no slope discontinuity at the piling
    float sum = 0., cnt = 0.;
    for (int k = 0; k < 4; k++) {
      ivec2 q = clamp(p + ivec2(k == 0 ? -1 : k == 1 ? 1 : 0, k == 2 ? -1 : k == 3 ? 1 : 0), ivec2(0), sz - 1);
      if (texelFetch(uMask, q, 0).r < .5) { sum += texelFetch(uState, q, 0).r; cnt += 1.; }
    }
    o = vec4(cnt > 0. ? sum / cnt : 0., 0., 0., 1.);
    return;
  }
  vec4 s = texelFetch(uState, p, 0);
  hc = s.r; float v = s.g;
  float hl = nb(p + ivec2(-1, 0)), hr = nb(p + ivec2(1, 0));
  float hd = nb(p + ivec2(0, -1)), hu = nb(p + ivec2(0, 1));
  vec2 fp = vec2(p);
  float top = fp.y / uSize.y;                 // 1 at the far horizon
  float cs = mix(1., .42, top);               // distant water: shorter, slower waves
  float a = cs * (uC2.x * (hl + hr - 2. * hc) + uC2.y * (hu + hd - 2. * hc));
  float f = 0.;
  if (uWind > 0.) {
    vec2 d = uWindDir;
    vec2 pr = vec2(dot(fp, d), dot(fp, vec2(-d.y, d.x)));
    float fm = mix(1., 1.9, top);
    // far-view lake: chop is near pixel scale, never blobs
    float n = vn(vec2(pr.x * .9 * fm - uT * 1.9 * uWSpeed, pr.y * 2.1 * fm))
            + .5 * vn(vec2(pr.x * 1.4 * fm - uT * 2.9 * uWSpeed, pr.y * 3.2 * fm + 7.));
    n = n / 1.5 - .5;
    float g = smoothstep(.38, .72, vn(vec2(pr.x * .0045 - uT * .1 * uWSpeed, pr.y * .0065 + 3.)));
    f += uWind * mix(uGustBase, 1., g) * n * .3 * mix(1., .35, top);
  }
  float dy = fp.y - (uSize.y - 12.);
  if (uSwellAmp > 0. && abs(dy) < 1.5) {
    float ex = smoothstep(20., 120., fp.x) * smoothstep(20., 120., uSize.x - fp.x);
    float pat = .55 + .45 * sin(fp.x * .007 + 1.3);
    f += uSwellAmp * ex * pat * sin(uSwellPhase - fp.x * uSwellTilt) * (1. - abs(dy) / 1.5);
  }
  float dmin = min(min(fp.x, uSize.x - 1. - fp.x), min(fp.y, uSize.y - 1. - fp.y));
  float sp = 1. - clamp(dmin / 10., 0., 1.); sp *= sp;
  v = (v + a + f) * (uDamp - .1 * sp);
  float h = hc * (1. - .04 * sp) + v + .035 * (hl + hr + hu + hd - 4. * hc);
  for (int i = 0; i < ${MAX_SPLATS}; i++) {
    if (i >= uN) break;
    vec4 sp4 = uSplat[i];
    vec2 dd = fp - sp4.xy;
    float q = (dd.x * dd.x + dd.y * dd.y / ${(ANISO * ANISO).toFixed(3)}) / (sp4.z * sp4.z);
    if (q < 12.) h += sp4.w * (1. - .7 * q) * exp(-q);
  }
  o = vec4(clamp(h, -3., 3.), clamp(v, -1., 1.), 0., 1.);
}`;

const DRAW_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uState, uMask, uRefl;
uniform vec2 uRes, uSimSize, uCss, uLight;
uniform vec3 uLightCol, uTint, uSheen;
uniform float uDark, uRefr, uTime;
out vec4 o;

float F(float c){ return .02 + .98 * pow(1. - c, 5.); }
float hash2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn2(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 st = 1. / uSimSize;
  float h  = texture(uState, uv).r;
  float hl = texture(uState, uv - vec2(st.x, 0.)).r, hr = texture(uState, uv + vec2(st.x, 0.)).r;
  float hd = texture(uState, uv - vec2(0., st.y)).r, hu = texture(uState, uv + vec2(0., st.y)).r;
  vec2 slope = vec2(hr - hl, hu - hd) * .5 * .15;  // the sim only adds faint lapping and wake
  float lap = hl + hr + hu + hd - 4. * h;
  vec3 m = texture(uMask, uv).rgb;               // mask, halo, ring
  float persp = mix(1.15, .6, uv.y);             // nearer water bends the image more

  // large, gentle, slow swells (analytic): long wavelengths that shorten toward the horizon
  vec2 px = uv * uCss;
  float kz = mix(1., 3.4, uv.y);                 // perspective compression toward the far shore
  vec2 sw = vec2(0.); float swh = 0.;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float L = 420. / (1. + fi * .7);             // ~420, 250, 175 css px
    vec2 dir = normalize(vec2(.35 + fi * .25, 1.));
    float ph = dot(vec2(px.x, px.y * kz), dir) / L * 6.2832 - uTime * (.45 + fi * .13);
    float A = (1. - fi * .25);
    swh += A * sin(ph);
    sw += dir * A * cos(ph);
  }
  // micro ripples: procedural, about 1-4 css px, elongated sideways and finer toward the horizon,
  // like a lake seen from far up the shore
  vec2 mr = vec2(0.);
  float e = .5;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float fq = .62 * pow(1.8, fi);                 // cycles per css px: sub-pixel to ~1.6px ripples
    vec2 q = vec2(px.x * fq, px.y * kz * fq * 2.6) + vec2(uTime * (.25 + fi * .1), fi * 17.);
    float dx = vn2(q + vec2(e, 0.)) - vn2(q - vec2(e, 0.));
    float dy = vn2(q + vec2(0., e)) - vn2(q - vec2(0., e));
    mr += vec2(dx, dy) / (1. + fi * .6);
  }
  mr *= mix(1., .55, uv.y);
  // refraction of the mirrored scene (reflections stretch vertically); kept tiny for a far view
  vec2 off = slope * vec2(.55, 1.) * uRefr * persp / uCss;
  off += vec2(sw.x * .5, sw.y * 2.2) * persp / uCss;  // the swell sways the reflection by a pixel or two
  off += vec2(mr.x * .35, mr.y * .9) / uCss;          // micro ripples: well under a pixel to ~1px
  off = clamp(off, vec2(-.01), vec2(.01));
  vec3 refl = texture(uRefl, uv + off).rgb;

  // fresnel: relative to the rest state so a calm surface is an exact mirror
  vec3 n = normalize(vec3(-(slope + mr * .012) * 2.2, 1.));
  vec3 V = normalize(vec3(0., -.93, .36));
  float ratio = F(clamp(dot(n, V), 0., 1.)) / F(V.z);
  float kg = mix(.2, 1., uDark);                 // light mode: very gentle shading, no grey smoke
  float mr = mix(1., clamp(ratio, 0., 1.), kg);
  vec3 col = mix(uTint, refl, mr);
  col *= 1. + .35 * clamp(ratio - 1., 0., 1.);
  col *= 1. + .03 * swh * persp * mix(.5, 1., uDark); // broad, soft light bands from the swell

  // troughs a touch darker, crests a touch lighter
  float tr = clamp(-h * 3., 0., 1.);
  col *= 1. - .12 * kg * tr;
  col += uLightCol * .035 * clamp(h * 4., 0., 1.) * (.4 + .6 * uDark);

  // slope shading: faces tilted toward the bright horizon catch sky light, the others fall off
  float sy = slope.y;
  col *= 1. + clamp(sy * 2.5, -.1 * kg, .14 * kg);
  col += uSheen * clamp(sy * 10., 0., 1.) * (.35 + .65 * (1. - uv.y)) * .25 + uSheen * .12 * clamp(abs(slope.x) * 7., 0., 1.);

  // glints from a soft light (moon / aurora glow, or pale sky)
  float gate = smoothstep(.012, .05, length(slope + mr * .012));
  vec3 Ht = normalize(vec3(clamp((uLight.x - uv.x) * .30, -.3, .3), .10, 1.));
  float nd = max(dot(n, Ht), 0.);
  float path = exp(-pow((uv.x - uLight.x) / .26, 2.)) * (.45 + .55 * uv.y);
  float spec = pow(nd, 400.) * 1.2 + pow(nd, 60.) * .1; // pinpoint sparkles, not patches
  col += uLightCol * spec * path * gate * mix(.3, .55, uDark);

  // caustic lines and lapping ring close to the pilings
  float c = clamp(-lap * 3., 0., 1.);
  float caus = c * c * (.25 + 1.3 * m.g) * (1. - m.r);
  col += uLightCol * caus * mix(.07, .05, uDark);
  float foam = m.b * smoothstep(.006, .05, abs(h)) * (1. - m.r);
  col += uLightCol * foam * .03;
  col *= 1. - .10 * kg * m.g * clamp(abs(h) * 6., 0., 1.) * (1. - foam);

  col = mix(col, texture(uRefl, uv).rgb, smoothstep(.3, .85, m.r)); // the piling itself stays calm
  o = vec4(col, 1.);
}`;

export function createWaterSim(opts = {}) {
  let W = Math.max(8, opts.width || 600);
  let H = Math.max(8, opts.height || 200);
  let dark = !!opts.dark;
  const reduced = !!opts.reduced;
  let weather = WEATHER[opts.weather] ? opts.weather : "calm";
  let reflection = opts.reflection || null;
  let obstacles = (opts.obstacles || []).slice();
  const dpr = Math.min(1.5, (typeof devicePixelRatio === "number" && devicePixelRatio) || 1);

  const canvas = document.createElement("canvas");
  canvas.style.cssText = `display:block;width:${W}px;height:${H}px;pointer-events:none`;
  canvas.setAttribute("aria-hidden", "true");

  let mode = "none"; // "gl" | "2d" | "still"
  let gl = null;
  let ctx2 = null;
  let destroyed = false;
  let wanted = false;
  let visible = true;
  let raf = 0;
  let lastDraw = 0;
  let acc = 0;
  let simTime = 0;
  let warmed = false;
  let reflDirty = true;
  let maskDirty = true;
  let io = null;
  let rect = null;

  // forcing state (JS side)
  const pending = []; // splats awaiting the next frame: [x, y, r, amp] in cell units
  let nextRain = 0;
  let swellT0 = -1e9;
  let swellDur = 0;
  let swellAmp = 0;
  let swellTilt = 0;
  let nextSwell = 6;
  let pointer = null;
  let sx = 0.5; // cell scale (cells per css px)
  let SW = 2;
  let SH = 2;

  const rand = (a, b) => a + Math.random() * (b - a);

  function layout() {
    sx = Math.min(1, Math.sqrt(SIM_CELL_CAP / (W * H)));
    SW = Math.max(16, Math.round(W * sx));
    SH = Math.max(16, Math.round(H * sx));
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  }

  /* ------------------------------------------------------------ WebGL */
  const R = {}; // gl resources

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(frag) {
    const p = gl.createProgram();
    const v = compile(gl.VERTEX_SHADER, VERT);
    const f = compile(gl.FRAGMENT_SHADER, frag);
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.deleteShader(v);
    gl.deleteShader(f);
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, "");
      u[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }
  function tex(w, h, internal, format, type, data, filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function buildStateTargets() {
    for (const k of ["a", "b"]) {
      if (R[k]) { gl.deleteTexture(R[k].t); gl.deleteFramebuffer(R[k].fb); }
      const t = tex(SW, SH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, null, gl.LINEAR);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("float fbo incomplete");
      gl.viewport(0, 0, SW, SH);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      R[k] = { t, fb };
    }
    R.cur = "a";
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Probe on a throwaway canvas so a failed setup never locks the real canvas out of 2D.
  function glSupported() {
    const t = document.createElement("canvas");
    const g = t.getContext("webgl2");
    if (!g) return false;
    const ok = !!(g.getExtension("EXT_color_buffer_float") || g.getExtension("EXT_color_buffer_half_float"));
    g.getExtension("WEBGL_lose_context")?.loseContext();
    return ok;
  }

  function initGL() {
    if (opts.force2d || !glSupported()) return false;
    const g = canvas.getContext("webgl2", {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: "low-power", preserveDrawingBuffer: false,
    });
    if (!g) return false;
    gl = g;
    if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) return false;
    try {
      R.sim = program(SIM_FRAG);
      R.draw = program(DRAW_FRAG);
      R.vao = gl.createVertexArray();
      buildStateTargets();
      R.mask = null;
      R.refl = tex(1, 1, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]), gl.LINEAR);
      R.splat = new Float32Array(MAX_SPLATS * 4);
    } catch (e) {
      console.warn("[water] WebGL setup failed, using 2D fallback:", e);
      freeGL(true);
      return false;
    }
    maskDirty = true;
    reflDirty = true;
    return true;
  }

  function freeGL(lose) {
    if (!gl) return;
    try {
      for (const k of ["a", "b"]) if (R[k]) { gl.deleteTexture(R[k].t); gl.deleteFramebuffer(R[k].fb); R[k] = null; }
      if (R.mask) gl.deleteTexture(R.mask);
      if (R.refl) gl.deleteTexture(R.refl);
      if (R.sim) gl.deleteProgram(R.sim.p);
      if (R.draw) gl.deleteProgram(R.draw.p);
      if (R.vao) gl.deleteVertexArray(R.vao);
      R.mask = R.refl = R.sim = R.draw = R.vao = null;
      if (lose) gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {}
    gl = null;
  }

  // Rasterise piling footprints: R = solid, G = soft halo, B = lapping ring.
  function uploadMask() {
    maskDirty = false;
    const data = new Uint8Array(SW * SH * 4);
    for (const o of obstacles) {
      const cx = o.x * sx;
      const cy = (H - o.y) * sx;
      const rx = Math.max(o.r * sx, 1.3);
      const ry = rx * ANISO;
      const ext = 7;
      const x0 = Math.max(0, Math.floor(cx - rx * ext)), x1 = Math.min(SW - 1, Math.ceil(cx + rx * ext));
      const y0 = Math.max(0, Math.floor(cy - ry * ext)), y1 = Math.min(SH - 1, Math.ceil(cy + ry * ext));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          const d = Math.hypot(dx, dy);
          const i = (y * SW + x) * 4;
          if (d <= 1) data[i] = 255;
          const halo = d < 1 ? 1 : Math.exp(-(((d - 1) / 1.9) ** 2));
          const ring = d < 1 ? 0 : Math.exp(-(((d - 1.35) / 0.5) ** 2));
          data[i + 1] = Math.max(data[i + 1], Math.round(halo * 255));
          data[i + 2] = Math.max(data[i + 2], Math.round(ring * 255));
          data[i + 3] = 255;
        }
      }
    }
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    if (R.mask) gl.deleteTexture(R.mask);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    R.mask = tex(SW, SH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, data, gl.LINEAR);
  }

  function uploadReflection() {
    reflDirty = false;
    if (!reflection) return;
    gl.bindTexture(gl.TEXTURE_2D, R.refl);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, reflection);
    } catch (e) { /* tainted or zero-sized source: keep the previous texture */ }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  /* --------------------------------------------------------- forcing */
  function addSplat(x, y, r, amp) {
    if (pending.length < MAX_SPLATS * 3) pending.push(x, y, r, amp);
  }

  function updateForcing(dt) {
    const P = WEATHER[weather];
    // rain
    if (P.rain) {
      const rate = Math.min(26, Math.max(8, (W * H) / 9000));
      nextRain -= dt;
      let guard = 6;
      while (nextRain <= 0 && guard--) {
        nextRain += rand(0.5, 1.5) / rate;
        const k = Math.random();
        const y = rand(14, SH - 14);
        const f = 1 - 0.55 * (y / SH); // distant drops are smaller and flatter
        addSplat(rand(14, SW - 14), y, rand(0.6, 0.9) * f, (0.35 + 0.4 * k * k) * f);
      }
    }
    // swells
    nextSwell -= dt;
    if (nextSwell <= 0 && P.swell) {
      nextSwell = rand(P.swell[0], P.swell[1]);
      startSwell(rand(0.7, 1.15) * P.swellAmp);
    }
  }

  function startSwell(a) {
    const P = WEATHER[weather];
    swellT0 = simTime + P.swellPeriod * 1.0;
    swellDur = P.swellPeriod * 1.15;
    swellAmp = a * 0.011;
    swellTilt = rand(-0.012, 0.012);
  }

  function pointerFrame() {
    if (!pointer || !pointer.moved || !rect) return;
    pointer.moved = false;
    const { x, y, lx, ly } = pointer;
    const inside = (px, py) => px >= -6 && px <= rect.width + 6 && py >= -6 && py <= rect.height + 6;
    if (inside(x, y) && lx != null && inside(lx, ly)) {
      const len = Math.hypot(x - lx, y - ly);
      if (len > 0.5) {
        const n = Math.min(8, Math.ceil((len * sx) / 2));
        const amp = -0.25 * Math.min(1, 0.25 + len / 30);
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          addSplat((lx + (x - lx) * t) * sx, (rect.height - (ly + (y - ly) * t)) * sx, 0.9, amp / Math.sqrt(n) * 0.8);
        }
      }
    }
    pointer.lx = x;
    pointer.ly = y;
  }

  function onPointerMove(e) {
    if (!visible || !running()) return;
    if (!rect) rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (!pointer) pointer = { x, y, lx: null, ly: null, moved: true };
    else {
      if (pointer.moved === false) { pointer.lx = pointer.x; pointer.ly = pointer.y; }
      pointer.x = x; pointer.y = y; pointer.moved = true;
    }
  }
  function onPointerLeave() { if (pointer) { pointer.lx = null; pointer.moved = false; } }

  /* ---------------------------------------------------------- GL step */
  function simStep(first) {
    const P = WEATHER[weather];
    const src = R[R.cur], dstKey = R.cur === "a" ? "b" : "a", dst = R[dstKey];
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.viewport(0, 0, SW, SH);
    gl.useProgram(R.sim.p);
    const u = R.sim.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R.mask);
    gl.uniform1i(u.uState, 0);
    gl.uniform1i(u.uMask, 1);
    gl.uniform2f(u.uSize, SW, SH);
    gl.uniform2f(u.uC2, 0.3, 0.3 * ANISO * ANISO);
    gl.uniform2f(u.uWindDir, P.dir[0], P.dir[1]);
    gl.uniform1f(u.uT, simTime);
    gl.uniform1f(u.uDamp, P.damp);
    gl.uniform1f(u.uWind, P.wind);
    gl.uniform1f(u.uGustBase, P.gustBase);
    gl.uniform1f(u.uWSpeed, P.wspeed);
    // swell packet envelope
    const e = (simTime - swellT0) / swellDur;
    const env = Math.abs(e) < 3 ? Math.exp(-e * e) : 0;
    gl.uniform1f(u.uSwellAmp, env * swellAmp);
    gl.uniform1f(u.uSwellPhase, (TAU * simTime) / P.swellPeriod);
    gl.uniform1f(u.uSwellTilt, swellTilt);
    let n = 0;
    if (first) {
      n = Math.min(MAX_SPLATS, pending.length / 4);
      for (let i = 0; i < n * 4; i++) R.splat[i] = pending[i];
      pending.splice(0, n * 4);
      if (pending.length > MAX_SPLATS * 2) pending.length = 0;
      gl.uniform4fv(u.uSplat, R.splat);
    }
    gl.uniform1i(u.uN, n);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    R.cur = dstKey;
    simTime += STEP;
  }

  function renderGL() {
    if (maskDirty) uploadMask();
    if (reflDirty) uploadReflection();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(R.draw.p);
    const u = R.draw.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R[R.cur].t);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R.mask);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, R.refl);
    gl.uniform1i(u.uState, 0);
    gl.uniform1i(u.uMask, 1);
    gl.uniform1i(u.uRefl, 2);
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform2f(u.uSimSize, SW, SH);
    gl.uniform2f(u.uCss, W, H);
    gl.uniform1f(u.uDark, dark ? 1 : 0);
    gl.uniform1f(u.uRefr, 22);
    gl.uniform1f(u.uTime, simTime);
    if (dark) {
      gl.uniform2f(u.uLight, opts.light?.[0] ?? 0.62, opts.light?.[1] ?? 0.1);
      gl.uniform3f(u.uLightCol, 0.72, 0.95, 0.86);
      gl.uniform3f(u.uTint, 0.012, 0.03, 0.04);
      gl.uniform3f(u.uSheen, 0.07, 0.2, 0.21);
    } else {
      gl.uniform2f(u.uLight, opts.light?.[0] ?? 0.55, opts.light?.[1] ?? 0.1);
      gl.uniform3f(u.uLightCol, 1.0, 0.97, 0.9);
      gl.uniform3f(u.uTint, 0.8, 0.87, 0.91);
      gl.uniform3f(u.uSheen, 0.05, 0.05, 0.045);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ------------------------------------------------------ 2D fallback */
  const C = { cs: 10, nx: 0, ny: 0, h: null, v: null, mask: null };

  function cpuInit() {
    C.cs = Math.max(8, Math.ceil(Math.sqrt((W * H) / 3200)));
    C.nx = Math.ceil(W / C.cs);
    C.ny = Math.ceil(H / C.cs);
    C.h = new Float32Array(C.nx * C.ny);
    C.v = new Float32Array(C.nx * C.ny);
    C.mask = new Uint8Array(C.nx * C.ny);
    for (const o of obstacles) {
      const cx = o.x / C.cs, cy = o.y / C.cs, r = Math.max(o.r / C.cs, 0.6);
      for (let y = 0; y < C.ny; y++) for (let x = 0; x < C.nx; x++) {
        if (Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) / ANISO) <= r) C.mask[y * C.nx + x] = 1;
      }
    }
  }

  function cpuStep() {
    const { nx, ny, h, v, mask } = C;
    const P = WEATHER[weather];
    const cx2 = 0.24, cy2 = 0.24 * ANISO * ANISO;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i = y * nx + x;
        if (mask[i]) { h[i] = 0; v[i] = 0; continue; }
        const c = h[i];
        const g = (j, ok) => (ok && !mask[j] ? h[j] : c);
        const a = cx2 * (g(i - 1, x > 0) + g(i + 1, x < nx - 1) - 2 * c) + cy2 * (g(i - nx, y > 0) + g(i + nx, y < ny - 1) - 2 * c);
        const edge = Math.min(x, nx - 1 - x, y, ny - 1 - y);
        v[i] = (v[i] + a) * (P.damp - (edge < 2 ? 0.05 : 0));
      }
    }
    for (let i = 0; i < h.length; i++) h[i] += v[i];
    // forcing: a few random wavelets, plus pending splats
    const wind = weather === "wind" ? 5 : weather === "calm" ? 2 : 1;
    for (let k = 0; k < wind; k++) {
      const i = (Math.random() * h.length) | 0;
      if (!mask[i]) v[i] += rand(-1, 1) * P.wind * 14;
    }
    while (pending.length) {
      const [x, y, , amp] = pending.splice(0, 4);
      const gx = Math.round((x / sx) / C.cs), gy = Math.round(((SH - y) / sx) / C.cs);
      if (gx > 0 && gx < nx - 1 && gy > 0 && gy < ny - 1 && !mask[gy * nx + gx]) h[gy * nx + gx] += amp * 3;
    }
    simTime += STEP;
  }

  function render2D() {
    const c = ctx2;
    const cw = canvas.width, ch = canvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (!reflection) { c.fillStyle = dark ? "#0a1418" : "#7a8f9a"; c.fillRect(0, 0, cw, ch); return; }
    c.drawImage(reflection, 0, 0, cw, ch);
    if (mode !== "2d" || !C.h) return;
    const { nx, ny, h, mask, cs } = C;
    const kx = cw / W, rs = reflection.width / cw;
    for (let y = 1; y < ny - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const i = y * nx + x;
        if (mask[i]) continue;
        const gx = (h[i + 1] - h[i - 1]) * 0.5, gy = (h[i + nx] - h[i - nx]) * 0.5;
        const dx = Math.max(-5, Math.min(5, gx * 70)), dy = Math.max(-8, Math.min(8, gy * 110));
        if (Math.abs(dx) + Math.abs(dy) < 0.5) continue;
        const px = x * cs * kx, py = y * cs * kx, w = cs * kx;
        c.drawImage(reflection, (px + dx * kx) * rs, (py + dy * kx) * rs, w * rs, w * rs, px, py, w, w);
      }
    }
  }

  /* ------------------------------------------------------------ loop */
  function running() { return wanted && visible && !document.hidden && !destroyed && mode !== "still"; }

  function frame(now) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(frame);
    if (now - lastDraw < 29) return;
    const dt = Math.min((now - lastDraw) / 1000, 0.1);
    lastDraw = now;
    rect = canvas.getBoundingClientRect();
    tick(dt);
  }

  function tick(dt) {
    dt *= TIME_SCALE;
    updateForcing(dt);
    pointerFrame();
    acc = Math.min(acc + dt, STEP * 3.2);
    let first = true;
    if (mode === "gl") {
      if (maskDirty) uploadMask();
      while (acc >= STEP) { simStep(first); first = false; acc -= STEP; }
      renderGL();
    } else if (mode === "2d") {
      while (acc >= STEP) { cpuStep(); acc -= STEP; }
      render2D();
    }
  }

  function kick() {
    if (running() && !raf) { lastDraw = performance.now() - 40; raf = requestAnimationFrame(frame); }
    if (!running() && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function drawOnce() {
    if (destroyed || document.hidden) return;
    if (mode === "gl") renderGL();
    else if (mode === "2d" || mode === "still") render2D();
  }

  function warm() {
    if (warmed || mode !== "gl") { warmed = true; return; }
    warmed = true;
    // pre-roll so the lake already has life (and a swell on the way) when first seen
    if (weather === "wind") nextSwell = 1.5;
    for (let i = 0; i < 150; i++) {
      if (i % 30 === 0) updateForcing(0.5);
      simStep(i % 30 === 0);
    }
  }

  function onVisibility() { kick(); if (!document.hidden && wanted) drawOnce(); }

  /* ---------------------------------------------------------- setup */
  function setup() {
    layout();
    if (reduced) {
      mode = "still";
      ctx2 = canvas.getContext("2d");
    } else if (initGL()) {
      mode = "gl";
    } else {
      mode = "2d";
      // the canvas may have a webgl2 context attached; use a fresh node if so
      ctx2 = canvas.getContext("2d");
      if (!ctx2) {
        console.warn("[water] canvas locked to a failed WebGL context; showing nothing");
        mode = "still";
      } else cpuInit();
    }
    drawOnce();
  }

  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); if (raf) { cancelAnimationFrame(raf); raf = 0; } mode = "lost"; });
  canvas.addEventListener("webglcontextrestored", () => {
    if (destroyed) return;
    if (initGL()) { mode = "gl"; warmed = false; drawOnce(); kick(); }
  });

  setup();

  if (!reduced) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    if (typeof IntersectionObserver === "function") {
      io = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        visible = e.isIntersecting;
        if (!visible) pointer = null;
        kick();
        if (visible && wanted) drawOnce();
      }, { rootMargin: "40px" });
      io.observe(canvas);
    }
  }

  /* ------------------------------------------------------------- API */
  const api = {
    canvas,
    setReflection(c) {
      reflection = c;
      reflDirty = true;
      if (!raf) drawOnce(); // not looping: refresh the still frame
    },
    setObstacles(list) {
      obstacles = (list || []).slice();
      maskDirty = true;
      if (mode === "2d") cpuInit();
      if (!raf) drawOnce();
    },
    start() {
      if (destroyed) return;
      wanted = true;
      if (!warmed) warm();
      kick();
    },
    stop() {
      wanted = false;
      kick();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      wanted = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      io = null;
      freeGL(true);
      reflection = null;
      obstacles = [];
      pending.length = 0;
      C.h = C.v = C.mask = null;
      canvas.width = canvas.height = 1;
    },
    // extras
    setWeather(w) {
      if (!WEATHER[w] || w === weather) return;
      weather = w;
      nextRain = 0;
      nextSwell = Math.min(nextSwell, rand(2, 5));
    },
    setDark(d) { dark = !!d; if (!raf) drawOnce(); },
    resize(w, h) {
      W = Math.max(8, w); H = Math.max(8, h);
      layout();
      rect = null;
      if (mode === "gl") { buildStateTargets(); maskDirty = true; warmed = false; if (wanted) warm(); }
      else if (mode === "2d") cpuInit();
      drawOnce();
    },
    // drop a disturbance at a CSS-px point (region coords, y down)
    disturb(x, y, amp = 0.12) { addSplat(x * sx, (H - y) * sx, 1.6, -Math.abs(amp) * 0.4); },
    swell(a = 1) { startSwell(a); },
  };
  return api;
}

export default createWaterSim;
