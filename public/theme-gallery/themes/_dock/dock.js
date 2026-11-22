// Reusable pre-rendered wooden dock for lake footers.
//   createDock({ dark, scale = 1, side = "center", seed }) ->
//     { canvas, width, height, waterlineY, anchorX }
// Rendered once (DPR <= 2), cached per option set, deterministic per seed.
// Transparent background; includes its own soft reflection. No animation.

const CACHE = new Map();
const W0 = 340; // design size in CSS px at scale 1
const H0 = 196;

// World units are feet: x lateral, h height above the water, z depth from the shore end.
const DECK_W = 6.6;
const DECK_H = 2.1;
const Z_NEAR = -1.6;
const Z_FAR = 29.5;
const POST_R = 0.28;
const POST_X = DECK_W / 2 + 0.3;
const RIM_W = 0.4;
const FACE_H = 0.55;

function hashSeed(seed) {
  const s = String(seed ?? 1);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const rgba = (c, a = 1) => `rgba(${Math.round(clamp(c[0], 0, 255))},${Math.round(clamp(c[1], 0, 255))},${Math.round(clamp(c[2], 0, 255))},${clamp(a, 0, 1).toFixed(3)})`;

const PALETTES = {
  dark: {
    wood: [21, 31, 49],
    rim: [24, 35, 54],
    post: [17, 26, 42],
    gap: [11, 18, 32],
    shadow: [9, 15, 28],
    haze: [14, 24, 44],
    rimLight: [96, 130, 176],
    rimLightA: 0.1,
    moss: [16, 34, 40],
    mossA: 0.15,
    refl: [8, 14, 28],
    reflA: 0.4,
    streak: [120, 155, 200],
    streakA: 0.05,
    ripple: [130, 165, 210],
    hazeMax: 0.5,
    alpha: 0.8,
    tone: 0.04,
  },
  light: {
    // within a few levels of the near-white footer water (~245-252), so it barely reads
    wood: [243, 246, 247],
    rim: [246, 248, 249],
    post: [238, 242, 244],
    gap: [235, 239, 241],
    shadow: [232, 236, 239],
    haze: [247, 250, 251],
    rimLight: [255, 255, 255],
    rimLightA: 0.06,
    moss: [236, 241, 237],
    mossA: 0.05,
    refl: [236, 240, 242],
    reflA: 0.14,
    streak: [255, 255, 255],
    streakA: 0.08,
    ripple: [255, 255, 255],
    hazeMax: 0.6,
    alpha: 0.55,
    tone: 0.015,
  },
};

export function createDock({ dark = true, scale = 1, side = "center", seed = 1, reflection = true } = {}) {
  const dpr = clamp(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 1, 2);
  if (side !== "left" && side !== "right") side = "center";
  const key = [dark ? 1 : 0, scale, side, seed, dpr, reflection ? 1 : 0].join("|");
  const hit = CACHE.get(key);
  if (hit) return hit;
  const result = render({ dark: !!dark, scale, side, seed, dpr, reflection: reflection !== false });
  CACHE.set(key, result);
  return result;
}

function render({ dark, scale, side, seed, dpr, reflection }) {
  const pal = dark ? PALETTES.dark : PALETTES.light;
  const rnd = mulberry32(hashSeed(seed) ^ 0x9e3779b9);
  const R = (a = 0, b = 1) => a + (b - a) * rnd();
  const k = dpr * scale;
  const cw = Math.round(W0 * scale);
  const ch = Math.round(H0 * scale);
  const pw = Math.round(cw * dpr);
  const ph = Math.round(ch * dpr);

  const canvas = document.createElement("canvas");
  canvas.width = pw;
  canvas.height = ph;
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
  const ctx = canvas.getContext("2d");

  // ---- camera / projection ----
  const S0 = 26, D = 24, HC = 9.2, HY = 6;
  const nearC = { left: 0.3, right: 0.7, center: 0.5 }[side] * W0;
  const VPX = { left: 0.6, right: 0.4, center: 0.5 }[side] * W0;
  const off = (nearC - VPX) / S0;
  const camX = -off;
  const sc = (z) => (S0 * D) / (z + D);
  const P = (x, h, z) => {
    const s = sc(z);
    return [VPX + (x + off) * s, HY + (HC - h) * s];
  };
  const waterY = (z) => HY + HC * sc(z);
  const haze = (z) => clamp((z - Z_NEAR) / (Z_FAR - Z_NEAR), 0, 1) * pal.hazeMax;
  const tint = (c, z) => mix(c, pal.haze, haze(z));

  const setup = (c) => {
    c.setTransform(k, 0, 0, k, 0, 0);
    c.lineJoin = "round";
    c.lineCap = "round";
  };
  const layer = () => {
    const c = document.createElement("canvas");
    c.width = pw;
    c.height = ph;
    const x = c.getContext("2d");
    setup(x);
    return [c, x];
  };
  const poly = (c, pts, fill, stroke, lw) => {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 0.5; c.stroke(); }
  };
  const line = (c, a, b, style, w) => {
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.strokeStyle = style;
    c.lineWidth = w;
    c.stroke();
  };
  const ellipse = (c, x, y, rx, ry, fill, stroke, lw) => {
    c.beginPath();
    c.ellipse(x, y, Math.max(rx, 0.01), Math.max(ry, 0.01), 0, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 0.5; c.stroke(); }
  };

  const posts = [];
  const postZ = [2.2, 8.6, 15.0, 21.4, 28.2];
  const tallSide = rnd() < 0.5 ? -1 : 1;
  for (const z of postZ) {
    for (const sd of [-1, 1]) {
      const zz = z + R(-0.25, 0.25);
      let top = DECK_H - 0.3;
      if (z === 28.2 && sd === tallSide) top = DECK_H + 1.75;
      else if (rnd() < 0.34) top = DECK_H + R(0.28, 0.5);
      posts.push({ sd, z: zz, top, lean: R(-0.02, 0.02), seed: rnd() });
    }
  }
  const faceVisible = (sd) => (sd > 0 ? camX > DECK_W / 2 : camX < -DECK_W / 2);
  const ladderSide = camX >= 0 ? 1 : -1;
  const ladderZ = 24.9;

  // =====================================================================
  // 1. Water layer: faint streaks, reflection of the dock
  // =====================================================================
  const [wc, wx] = layer();

  // faint horizontal glints so the zone reads as water
  if (reflection) {
    const yTop = waterY(Z_FAR) - 4;
    for (let i = 0; i < 26; i++) {
      const t = Math.pow(rnd(), 0.8);
      const y = yTop + (H0 - yTop) * t;
      const len = R(24, 90) * (0.5 + t);
      const x = R(-10, W0 - len + 10);
      const a = pal.streakA * R(0.4, 1) * (0.5 + t * 0.6);
      const g = wx.createLinearGradient(x, 0, x + len, 0);
      g.addColorStop(0, rgba(pal.streak, 0));
      g.addColorStop(0.5, rgba(pal.streak, a));
      g.addColorStop(1, rgba(pal.streak, 0));
      wx.fillStyle = g;
      wx.fillRect(x, y, len, R(0.6, 1.3));
    }
  }

  // reflection (drawn mirrored into its own layer, softened, wobbled, then composited)
  const [rfc, rfx] = layer();
  {
    const [rc, rx] = layer();
    const rcol = pal.refl;
    // deck mass: convex hull of the mirrored box
    const pts = [];
    for (const x of [-DECK_W / 2 - 0.7, DECK_W / 2 + 0.7]) {
      for (const h of [0, -(DECK_H + 0.9)]) {
        for (const z of [Z_NEAR - 3, Z_FAR]) pts.push(P(x, h, z));
      }
    }
    const hull = convexHull(pts);
    const ymin = Math.min(...hull.map((p) => p[1]));
    const ymax = Math.max(...hull.map((p) => p[1]));
    const g = rx.createLinearGradient(0, ymin, 0, Math.min(ymax, H0));
    g.addColorStop(0, rgba(rcol, 0.85));
    g.addColorStop(1, rgba(rcol, 0.4));
    poly(rx, hull, g);

    // posts
    for (const p of posts) {
      const xc = p.sd * POST_X;
      const s = sc(p.z);
      const foot = P(xc, 0, p.z);
      const tip = P(xc, -p.top * 1.5, p.z);
      const w = POST_R * 3 * s;
      const gg = rx.createLinearGradient(0, foot[1], 0, tip[1]);
      gg.addColorStop(0, rgba(rcol, 0.95));
      gg.addColorStop(1, rgba(rcol, 0.1));
      rx.fillStyle = gg;
      rx.fillRect(foot[0] - w / 2, foot[1], w, tip[1] - foot[1]);
    }
    // ladder
    {
      const xl = ladderSide * (POST_X + 0.05);
      for (const dz of [-0.75, 0.75]) {
        const a = P(xl, 0, ladderZ + dz), b = P(xl, -(DECK_H + 0.4), ladderZ + dz);
        const gg = rx.createLinearGradient(0, a[1], 0, b[1]);
        gg.addColorStop(0, rgba(rcol, 0.7));
        gg.addColorStop(1, rgba(rcol, 0));
        line(rx, a, b, gg, Math.max(0.8, 0.12 * sc(ladderZ)));
      }
    }

    // soften: downscale/upscale once
    const tmp = document.createElement("canvas");
    tmp.width = Math.max(2, Math.round(pw * 0.4));
    tmp.height = Math.max(2, Math.round(ph * 0.4));
    const tx = tmp.getContext("2d");
    tx.imageSmoothingQuality = "high";
    tx.drawImage(rc, 0, 0, tmp.width, tmp.height);
    const [sc2, sx2] = layer();
    sx2.setTransform(1, 0, 0, 1, 0, 0);
    sx2.imageSmoothingQuality = "high";
    sx2.drawImage(tmp, 0, 0, pw, ph);

    // wobble in thin slices (ripple displacement), growing with distance below the waterline
    const [oc, ox] = layer();
    ox.setTransform(1, 0, 0, 1, 0, 0);
    const ph1 = R(0, 6.28), ph2 = R(0, 6.28);
    const step = Math.max(1, Math.round(1.5 * k));
    for (let y = 0; y < ph; y += step) {
      const cy = y / k;
      const amp = 0.5 + (cy / H0) * 1.8;
      const dx = (Math.sin(cy * 0.55 + ph1) * 0.7 + Math.sin(cy * 0.17 + ph2) * 0.6) * amp * k;
      ox.drawImage(sc2, 0, y, pw, step, dx, y, pw, step);
    }
    // watery gaps
    ox.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 70; i++) {
      const t = rnd();
      const y = waterY(Z_FAR) + (H0 - waterY(Z_FAR)) * t;
      const len = R(14, 70);
      const x = R(-10, W0);
      ox.fillStyle = `rgba(0,0,0,${R(0.3, 0.75).toFixed(2)})`;
      ox.fillRect(x * k, y * k, len * k, R(0.7, 1.6 + t * 1.2) * k);
    }
    ox.globalCompositeOperation = "source-over";

    rfx.setTransform(1, 0, 0, 1, 0, 0);
    rfx.globalAlpha = pal.reflA;
    rfx.drawImage(oc, 0, 0);
    rfx.globalAlpha = 1;
    setup(rfx);
  }

  // composite the water layer with soft left/right edges
  for (const lx of [wx, rfx]) {
    lx.setTransform(1, 0, 0, 1, 0, 0);
    lx.globalCompositeOperation = "destination-in";
    const g = lx.createLinearGradient(0, 0, pw, 0);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.07, "rgba(0,0,0,1)");
    g.addColorStop(0.93, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    lx.fillStyle = g;
    lx.fillRect(0, 0, pw, ph);
    lx.globalCompositeOperation = "source-over";
    setup(lx);
  }

  // =====================================================================
  // 2. Dock layer
  // =====================================================================
  const [dc, c] = layer();

  // ripples around post feet (on water, behind the posts)
  for (const p of posts) {
    if (!reflection || p.z < 6) continue;
    const foot = P(p.sd * POST_X, 0, p.z);
    const s = sc(p.z);
    const w = POST_R * s;
    const a = 1 - haze(p.z);
    ellipse(c, foot[0], foot[1] + 0.4, w * 2.1, w * 0.62, null, rgba(pal.ripple, pal.streakA * 1.5 * a), 0.6);
    ellipse(c, foot[0], foot[1] + 0.8, w * 3.4, w * 1.0, null, rgba(pal.ripple, pal.streakA * 0.8 * a), 0.5);
    ellipse(c, foot[0], foot[1] + 0.2, w * 1.25, w * 0.34, rgba(pal.shadow, 0.35), null);
  }

  // ---- deck planks ----
  const planks = [];
  {
    let z = Z_NEAR;
    while (z < Z_FAR - 0.3) {
      const len = R(0.4, 0.56);
      planks.push({ z0: z, z1: Math.min(z + len, Z_FAR), tone: R(-1, 1), seed: rnd() });
      z += len + 0.045;
    }
  }
  const innerX = DECK_W / 2 - RIM_W;
  const rndP = (seed) => mulberry32(Math.floor(seed * 4294967296));

  for (let i = planks.length - 1; i >= 0; i--) {
    const pl = planks[i];
    const pr = rndP(pl.seed);
    const PR = (a = 0, b = 1) => a + (b - a) * pr();
    const zm = (pl.z0 + pl.z1) / 2;
    const s = sc(zm);
    const pxLen = (sc(pl.z0) * 0.3 + (pl.z1 - pl.z0) * s);
    const split = pr() < 0.16 ? PR(-1.4, 1.4) : null;
    const segs = split === null ? [[-DECK_W / 2 + 0.05, DECK_W / 2 - 0.05]] : [[-DECK_W / 2 + 0.05, split - 0.025], [split + 0.025, DECK_W / 2 - 0.05]];
    // dark under-gap (visible between boards)
    {
      const a = P(-DECK_W / 2, DECK_H - 0.05, pl.z0 - 0.045), b = P(DECK_W / 2, DECK_H - 0.05, pl.z0 - 0.045);
      const cc = P(DECK_W / 2, DECK_H - 0.05, pl.z1), d = P(-DECK_W / 2, DECK_H - 0.05, pl.z1);
      poly(c, [a, b, cc, d], rgba(tint(pal.gap, zm), 1));
    }
    for (const [xa, xb] of segs) {
      const base = mul(pal.wood, 1 + pl.tone * pal.tone * 2.2 + PR(-0.05, 0.05));
      const warm = dark ? [PR(-1.5, 1.5), PR(-1, 1), PR(-2, 2)] : [PR(0, 4), PR(-1, 2), PR(-3, 1)];
      const col = tint([base[0] + warm[0], base[1] + warm[1], base[2] + warm[2]], zm);
      const n0 = P(xa, DECK_H, pl.z0), n1 = P(xb, DECK_H, pl.z0), f1 = P(xb, DECK_H, pl.z1), f0 = P(xa, DECK_H, pl.z1);
      const g = c.createLinearGradient(n0[0], 0, n1[0], 0);
      g.addColorStop(0, rgba(mul(col, 1 + PR(-0.05, 0.05))));
      g.addColorStop(0.5, rgba(mul(col, 1 + PR(-0.04, 0.05))));
      g.addColorStop(1, rgba(mul(col, 1 + PR(-0.05, 0.05))));
      poly(c, [n0, n1, f1, f0], g);
      const fade = 1 - haze(zm) * 0.9;
      // weathering patches
      if (pr() < 0.45) {
        const wa = PR(xa, xb), wb = Math.min(xb, wa + PR(0.6, 2.2));
        const q0 = P(wa, DECK_H, pl.z0), q1 = P(wb, DECK_H, pl.z0), q2 = P(wb, DECK_H, pl.z1), q3 = P(wa, DECK_H, pl.z1);
        const bleach = pr() < 0.5;
        poly(c, [q0, q1, q2, q3], bleach ? rgba(pal.rimLight, 0.05 * fade) : rgba(pal.shadow, 0.12 * fade));
      }
      // grain
      const ng = clamp(Math.round(pxLen / 2.4), 1, 6);
      for (let gi = 0; gi < ng; gi++) {
        const zg = pl.z0 + (pl.z1 - pl.z0) * PR(0.1, 0.9);
        const x0 = xa + PR(0, 0.5), x1 = xb - PR(0, 0.5);
        c.beginPath();
        const segN = 7;
        const wob = PR(0.01, 0.035), phs = PR(0, 6.28);
        for (let j = 0; j <= segN; j++) {
          const xx = x0 + ((x1 - x0) * j) / segN;
          const p = P(xx, DECK_H, zg + Math.sin(j * 1.3 + phs) * wob);
          if (j === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]);
        }
        c.strokeStyle = pr() < 0.78 ? rgba(pal.shadow, PR(0.1, 0.24) * fade) : rgba(pal.rimLight, PR(0.04, 0.09) * fade);
        c.lineWidth = Math.max(0.35, s * 0.012);
        c.stroke();
      }
      // knot
      if (pr() < 0.13 && xb - xa > 0.8) {
        const xk = PR(xa + 0.3, xb - 0.3), zk = pl.z0 + (pl.z1 - pl.z0) * PR(0.35, 0.65);
        const kc = P(xk, DECK_H, zk);
        const rxk = PR(0.08, 0.14) * s;
        const ryk = Math.abs(P(xk, DECK_H, zk + 0.06)[1] - P(xk, DECK_H, zk - 0.06)[1]) * 0.5 * PR(0.9, 1.3);
        ellipse(c, kc[0], kc[1], rxk * 1.6, ryk * 1.6, rgba(pal.shadow, 0.1 * fade));
        ellipse(c, kc[0], kc[1], rxk, ryk, rgba(pal.shadow, 0.34 * fade), rgba(pal.shadow, 0.3 * fade), 0.4);
        ellipse(c, kc[0], kc[1], rxk * 0.45, ryk * 0.45, rgba(pal.shadow, 0.35 * fade));
      }
      // nail heads
      if (s > 11) {
        const nzs = [pl.z0 + (pl.z1 - pl.z0) * 0.3, pl.z0 + (pl.z1 - pl.z0) * 0.72];
        const xs = [xa + 0.28, xb - 0.28];
        for (const xx of xs) {
          if (xx < -innerX - 0.1 || xx > innerX + 0.1) { /* near rim, still draw */ }
          const nz = nzs[pr() < 0.5 ? 0 : 1];
          const p = P(xx, DECK_H, nz);
          ellipse(c, p[0], p[1], Math.max(0.35, 0.035 * s), Math.max(0.25, 0.022 * s), rgba(pal.shadow, 0.55 * fade));
        }
      }
      // near-edge catch light
      const n0b = P(xa, DECK_H, pl.z0 + 0.02), n1b = P(xb, DECK_H, pl.z0 + 0.02);
      line(c, n0b, n1b, rgba(pal.rimLight, pal.rimLightA * 0.5 * fade), Math.max(0.35, s * 0.018));
    }
  }

  // ---- visible side face (stringer face) ----
  const drawFace = (sd) => {
    const x = sd * DECK_W / 2;
    const a = P(x, DECK_H + 0.04, Z_NEAR), b = P(x, DECK_H + 0.04, Z_FAR);
    const cc = P(x, DECK_H - FACE_H, Z_FAR), d = P(x, DECK_H - FACE_H, Z_NEAR);
    const g = c.createLinearGradient(0, a[1], 0, d[1]);
    // draw per-segment in z for haze + seams
    let z = Z_NEAR;
    while (z < Z_FAR) {
      const len = R(6, 9.5);
      const z1 = Math.min(Z_FAR, z + len);
      const tone = 1 + R(-0.07, 0.07);
      const col = tint(mul(pal.rim, 0.78 * tone), (z + z1) / 2);
      const q = [P(x, DECK_H + 0.04, z), P(x, DECK_H + 0.04, z1), P(x, DECK_H - FACE_H, z1), P(x, DECK_H - FACE_H, z)];
      const gg = c.createLinearGradient(0, q[0][1], 0, q[3][1]);
      gg.addColorStop(0, rgba(mul(col, 1.05)));
      gg.addColorStop(1, rgba(mul(col, 0.62)));
      poly(c, q, gg);
      // long grain along the face
      for (let gi = 0; gi < 3; gi++) {
        const hh = DECK_H - FACE_H * R(0.15, 0.9);
        const p0 = P(x, hh, z + R(0, 1)), p1 = P(x, hh + R(-0.02, 0.02), z1 - R(0, 1));
        line(c, p0, p1, rgba(pal.shadow, R(0.1, 0.22) * (1 - haze(z))), 0.5);
      }
      line(c, q[3], q[2], rgba(pal.shadow, 0.5), 0.8); // dark seam below the board
      line(c, q[0], q[3], rgba(pal.shadow, 0.5), 0.8); // butt joint
      z = z1 + 0.03;
    }
    // shadow under the lip (soft)
    poly(c, [d, cc, [cc[0], cc[1] + 3], [d[0], d[1] + 3]], rgba(pal.shadow, 0.25));
  };
  for (const sd of [-1, 1]) if (faceVisible(sd)) drawFace(sd);

  // ---- ladder (hangs on the camera side, behind posts) ----
  const drawLadder = () => {
    const xl = ladderSide * (POST_X + 0.05);
    const s = sc(ladderZ);
    const railW = Math.max(1.2, 0.15 * s);
    const col = tint(mul(pal.post, 1.15), ladderZ);
    const top = DECK_H + 0.65, bot = -0.9;
    for (const dz of [-0.75, 0.75]) {
      const a = P(xl, top, ladderZ + dz), b = P(xl, bot, ladderZ + dz);
      // upper part above the water, slightly lighter; part below water is dimmer
      const w = P(xl, 0, ladderZ + dz);
      line(c, a, w, rgba(col), railW);
      line(c, a, w, rgba(pal.rimLight, pal.rimLightA * 0.5), 0.5);
      line(c, w, b, rgba(mix(col, pal.haze, 0.55), 0.55), railW * 0.9);
    }
    for (let h = 0.35; h < DECK_H + 0.45; h += 0.78) {
      const a = P(xl, h, ladderZ - 0.75), b = P(xl, h, ladderZ + 0.75);
      line(c, a, b, rgba(mul(col, 0.9)), Math.max(0.7, 0.09 * s));
      line(c, [a[0], a[1] - 0.4], [b[0], b[1] - 0.4], rgba(pal.rimLight, pal.rimLightA * 0.35), 0.4);
    }
    // handle loops
    for (const dz of [-0.75, 0.75]) {
      const a = P(xl, top, ladderZ + dz);
      ellipse(c, a[0], a[1], 0.07 * s, 0.07 * s * 0.5, rgba(mul(col, 1.15)));
    }
  };

  // ---- braces ----
  const sortedPosts = posts.slice().sort((a, b) => b.z - a.z);
  for (const sd of [-1, 1]) {
    const mine = posts.filter((p) => p.sd === sd).sort((a, b) => a.z - b.z);
    for (let i = 0; i < mine.length - 1; i++) {
      const A = mine[i], B = mine[i + 1];
      const xb = sd * POST_X;
      const zm = (A.z + B.z) / 2;
      const s = sc(zm);
      const col = tint(mul(pal.post, 1.08), zm);
      const bw = Math.max(0.8, 0.17 * s);
      const hLow = 0.25, hHigh = DECK_H - 0.75;
      const diag = [[P(xb, hLow, A.z + 0.2), P(xb, hHigh, B.z - 0.2)], [P(xb, hHigh, A.z + 0.2), P(xb, hLow, B.z - 0.2)]];
      for (const [a, b] of diag) {
        line(c, a, b, rgba(col), bw);
        line(c, [a[0], a[1] - bw * 0.35], [b[0], b[1] - bw * 0.35], rgba(pal.rimLight, pal.rimLightA * 0.4 * (1 - haze(zm))), 0.4);
      }
      // wale rail
      const ra = P(xb, hHigh + 0.05, A.z), rb = P(xb, hHigh + 0.05, B.z);
      line(c, ra, rb, rgba(mul(col, 0.95)), Math.max(1, 0.24 * s));
      line(c, [ra[0], ra[1] - 0.12 * s], [rb[0], rb[1] - 0.12 * s], rgba(pal.rimLight, pal.rimLightA * 0.5 * (1 - haze(zm))), 0.5);
      // low rail near the water, with wet darkening
      const la = P(xb, 0.5, A.z), lb = P(xb, 0.5, B.z);
      line(c, la, lb, rgba(mul(col, 0.7)), Math.max(0.9, 0.18 * s));
    }
  }

  if (true) drawLadder();

  // ---- posts ----
  for (const p of sortedPosts) {
    const pr = rndP(p.seed);
    const PR = (a = 0, b = 1) => a + (b - a) * pr();
    const xc = p.sd * POST_X;
    const s = sc(p.z);
    const w = POST_R * 2 * s;
    const top = P(xc + p.lean * 2, p.top, p.z);
    const foot = P(xc, 0, p.z);
    const col = tint(pal.post, p.z);
    const toneK = 1 + PR(-0.08, 0.08);
    const x0 = (a, t) => a[0] + (foot[0] - top[0]) * t;
    // outline with slight irregularity
    const N = 10;
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = top[1] + (foot[1] - top[1]) * t;
      const cx = top[0] + (foot[0] - top[0]) * t;
      left.push([cx - w / 2 + PR(-0.04, 0.04) * w, y]);
      right.push([cx + w / 2 + PR(-0.04, 0.04) * w, y]);
    }
    const body = left.concat(right.slice().reverse());
    const g = c.createLinearGradient(top[0] - w / 2, 0, top[0] + w / 2, 0);
    g.addColorStop(0, rgba(mul(col, 0.8 * toneK)));
    g.addColorStop(0.28, rgba(mul(col, 1.18 * toneK)));
    g.addColorStop(0.7, rgba(mul(col, 0.92 * toneK)));
    g.addColorStop(1, rgba(mul(col, 0.58 * toneK)));
    poly(c, body, g);
    const hh = Math.abs(foot[1] - top[1]);
    // grain streaks
    for (let gi = 0; gi < 4; gi++) {
      const fx = PR(0.12, 0.88);
      c.beginPath();
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const y = top[1] + (foot[1] - top[1]) * t;
        const cx = top[0] + (foot[0] - top[0]) * t - w / 2 + w * fx + Math.sin(t * 7 + gi * 2 + p.seed * 9) * w * 0.03;
        if (i === 0) c.moveTo(cx, y); else c.lineTo(cx, y);
      }
      c.strokeStyle = rgba(pal.shadow, PR(0.1, 0.22) * (1 - haze(p.z)));
      c.lineWidth = Math.max(0.35, w * 0.035);
      c.stroke();
    }
    // horizontal checks / cracks
    for (let ci = 0; ci < 3; ci++) {
      const t = PR(0.1, 0.8);
      const y = top[1] + (foot[1] - top[1]) * t;
      const cx = top[0] + (foot[0] - top[0]) * t;
      const a = cx - w / 2 + PR(0.1, 0.5) * w;
      line(c, [a, y], [a + PR(0.1, 0.35) * w, y + PR(-0.6, 0.6)], rgba(pal.shadow, 0.28), 0.5);
    }
    // wet / algae toward the waterline
    const wetTop = P(xc, 1.1, p.z)[1];
    const wg = c.createLinearGradient(0, wetTop, 0, foot[1]);
    wg.addColorStop(0, rgba(pal.shadow, 0));
    wg.addColorStop(1, rgba(pal.shadow, 0.5));
    c.save();
    poly(c, body, null);
    c.clip();
    c.fillStyle = wg;
    c.fillRect(foot[0] - w, wetTop, w * 2, foot[1] - wetTop + 1);
    const mg = c.createLinearGradient(0, P(xc, 0.7, p.z)[1], 0, foot[1]);
    mg.addColorStop(0, rgba(pal.moss, 0));
    mg.addColorStop(1, rgba(pal.moss, pal.mossA));
    c.fillStyle = mg;
    c.fillRect(foot[0] - w, P(xc, 0.7, p.z)[1], w * 2, foot[1]);
    // soft shadow just under the deck lip
    const lipY = P(xc, DECK_H - FACE_H, p.z)[1];
    const sg = c.createLinearGradient(0, lipY, 0, lipY + 0.7 * s);
    sg.addColorStop(0, rgba(pal.shadow, 0.35));
    sg.addColorStop(1, rgba(pal.shadow, 0));
    c.fillStyle = sg;
    c.fillRect(foot[0] - w, lipY, w * 2, 0.7 * s);
    c.restore();
    // rim light on the sky-facing edge
    const edgeX = p.sd < 0 ? 0 : 0;
    c.beginPath();
    for (let i = 0; i <= N; i++) {
      const pt = left[i];
      if (i === 0) c.moveTo(pt[0] + 0.5, pt[1]); else c.lineTo(pt[0] + 0.5, pt[1]);
    }
    c.strokeStyle = rgba(pal.rimLight, pal.rimLightA * 0.8 * (1 - haze(p.z)));
    c.lineWidth = Math.max(0.5, w * 0.06);
    c.stroke();
    // through-bolt
    {
      const bp = P(xc, DECK_H - FACE_H * 0.5 - 0.2, p.z);
      const hide = p.top > DECK_H + 0.2 ? false : false;
      if (s > 11 && !hide) {
        ellipse(c, bp[0], bp[1], 0.075 * s, 0.075 * s, rgba(pal.shadow, 0.55));
        ellipse(c, bp[0] - 0.01 * s, bp[1] - 0.012 * s, 0.035 * s, 0.035 * s, rgba(pal.rimLight, pal.rimLightA * 0.5));
      }
    }
    // cap for posts that rise above the rim
    if (p.top > DECK_H + 0.1) {
      const rxp = w / 2, ryp = w * 0.2;
      const capCol = mul(col, 1.12);
      ellipse(c, top[0], top[1], rxp * 1.04, ryp * 1.04, rgba(mul(col, 0.7)));
      ellipse(c, top[0], top[1] - 0.3, rxp, ryp, rgba(capCol));
      ellipse(c, top[0], top[1] - 0.3, rxp * 0.62, ryp * 0.62, null, rgba(pal.shadow, 0.26), 0.45);
      ellipse(c, top[0], top[1] - 0.3, rxp * 0.3, ryp * 0.3, null, rgba(pal.shadow, 0.22), 0.4);
      ellipse(c, top[0], top[1] - 0.3, rxp, ryp, null, rgba(pal.rimLight, pal.rimLightA * 0.7), 0.5);
      // lone tall post: a rope wrap
      if (p.top > DECK_H + 1) {
        for (let r = 0; r < 4; r++) {
          const y = P(xc, DECK_H + 0.45 + r * 0.14, p.z)[1];
          const cx = top[0] + (foot[0] - top[0]) * ((y - top[1]) / (foot[1] - top[1]));
          ellipse(c, cx, y, w * 0.52, w * 0.15, null, rgba(mix(col, pal.rimLight, 0.2), 0.8), Math.max(0.5, 0.06 * s));
        }
      }
    }
  }

  // ---- rim boards (stringers) on top ----
  for (const sd of [-1, 1]) {
    let z = Z_NEAR;
    const rows = [];
    while (z < Z_FAR) {
      const len = R(6.5, 9.5);
      rows.push([z, Math.min(Z_FAR, z + len)]);
      z += len + 0.03;
    }
    for (let ri = rows.length - 1; ri >= 0; ri--) {
      const [za, zb] = rows[ri];
      const zm = (za + zb) / 2;
      const s = sc(zm);
      const xo = sd * DECK_W / 2, xi = sd * innerX;
      const hT = DECK_H + 0.07;
      const q = [P(xo, hT, za), P(xi, hT, za), P(xi, hT, zb), P(xo, hT, zb)];
      const col = tint(mul(pal.rim, 1 + R(-0.05, 0.05)), zm);
      const g = c.createLinearGradient(q[0][0], 0, q[1][0], 0);
      g.addColorStop(0, rgba(mul(col, 1.07)));
      g.addColorStop(1, rgba(mul(col, 0.94)));
      poly(c, q, g);
      // inner shadow line + outer highlight
      line(c, q[1], q[2], rgba(pal.shadow, 0.55 * (1 - haze(zm) * 0.7)), Math.max(0.5, s * 0.025));
      line(c, q[0], q[3], rgba(pal.rimLight, pal.rimLightA * (1 - haze(zm))), Math.max(0.5, s * 0.03));
      // long grain
      for (let gi = 0; gi < 4; gi++) {
        const xx = xi + (xo - xi) * R(0.12, 0.88);
        const p0 = P(xx, hT, za + R(0, 1.5)), p1 = P(xx + R(-0.02, 0.02), hT, zb - R(0, 1.5));
        line(c, p0, p1, rgba(pal.shadow, R(0.08, 0.22) * (1 - haze(zm))), Math.max(0.35, s * 0.012));
      }
      // butt-joint line + end-grain
      line(c, q[0], q[1], rgba(pal.shadow, 0.5), 0.7);
      // knot
      if (rnd() < 0.5) {
        const zk = za + (zb - za) * R(0.2, 0.8), xk = (xi + xo) / 2;
        const kc = P(xk, hT, zk);
        ellipse(c, kc[0], kc[1], 0.1 * s, Math.abs(P(xk, hT, zk + 0.07)[1] - P(xk, hT, zk - 0.07)[1]) * 0.5, rgba(pal.shadow, 0.34), rgba(pal.shadow, 0.3), 0.4);
      }
      // bolts along the rim
      for (let zb2 = za + 1; zb2 < zb - 0.3; zb2 += 2.1) {
        const bp = P((xi + xo) / 2, hT, zb2);
        if (s > 10) ellipse(c, bp[0], bp[1], 0.045 * s, 0.026 * s, rgba(pal.shadow, 0.5 * (1 - haze(zb2))));
      }
    }
  }

  // ---- far end header board ----
  {
    const hT = DECK_H + 0.07;
    const q = [P(-DECK_W / 2, hT, Z_FAR - 0.5), P(DECK_W / 2, hT, Z_FAR - 0.5), P(DECK_W / 2, hT, Z_FAR + 0.05), P(-DECK_W / 2, hT, Z_FAR + 0.05)];
    poly(c, q, rgba(tint(mul(pal.rim, 0.98), Z_FAR)));
    line(c, q[0], q[1], rgba(pal.shadow, 0.45), 0.6);
    line(c, q[3], q[2], rgba(pal.rimLight, pal.rimLightA * 0.6), 0.5);
  }

  // ---- cleats, rope coil ----
  const drawBox = (x0, x1, z0, z1, h0, h1, col, fadeZ) => {
    const col2 = tint(col, fadeZ);
    // front (-z) face
    poly(c, [P(x0, h0, z0), P(x1, h0, z0), P(x1, h1, z0), P(x0, h1, z0)], rgba(mul(col2, 0.62)));
    // camera-side face
    const sx = camX > (x0 + x1) / 2 ? x1 : x0;
    poly(c, [P(sx, h0, z0), P(sx, h0, z1), P(sx, h1, z1), P(sx, h1, z0)], rgba(mul(col2, 0.78)));
    // top
    poly(c, [P(x0, h1, z0), P(x1, h1, z0), P(x1, h1, z1), P(x0, h1, z1)], rgba(mul(col2, 1.18)), rgba(pal.rimLight, pal.rimLightA * 0.5), 0.35);
  };
  const cleat = (xc, zc, rot) => {
    const s = sc(zc);
    const hT = DECK_H + 0.07;
    const cp = P(xc, hT, zc);
    // contact shadow
    const sp = P(xc + 0.04, hT, zc + 0.04);
    ellipse(c, sp[0] + 0.5, sp[1] + 0.8, 0.5 * s, 0.1 * s, rgba(pal.shadow, 0.35));
    const col = mul(pal.post, 1.3);
    // bar runs along z
    drawBox(xc - 0.12, xc + 0.12, zc - 0.5, zc + 0.5, hT, hT + 0.1, col, zc);
    // horns
    drawBox(xc - 0.1, xc + 0.1, zc - 0.5, zc - 0.28, hT + 0.1, hT + 0.3, col, zc);
    drawBox(xc - 0.1, xc + 0.1, zc + 0.28, zc + 0.5, hT + 0.1, hT + 0.3, col, zc);
    // bolt
    ellipse(c, cp[0], cp[1] - 0.1 * s, 0.03 * s, 0.018 * s, rgba(pal.shadow, 0.6));
  };
  const cl1 = camX >= 0 ? -1 : 1; // put cleats on both sides at different depths
  cleat(-(DECK_W / 2 - RIM_W / 2) , 11.3 + R(-0.4, 0.4), 0);
  cleat(DECK_W / 2 - RIM_W / 2, 18.6 + R(-0.5, 0.5), 0);
  {
    // rope coil on the deck beside the far cleat
    const zc = 17.0, xc = DECK_W / 2 - 1.15;
    const cp = P(xc, DECK_H + 0.04, zc);
    const s = sc(zc);
    const ry = Math.abs(P(xc, DECK_H, zc + 0.5)[1] - P(xc, DECK_H, zc - 0.5)[1]) * 0.5;
    const rope = tint(mul(pal.wood, 1.12), zc);
    ellipse(c, cp[0] + 0.5, cp[1] + 0.8, 0.62 * s, ry * 1.05, rgba(pal.shadow, 0.28));
    for (let i = 0; i < 4; i++) {
      const r = 0.52 - i * 0.1;
      ellipse(c, cp[0], cp[1] - i * 0.55, r * s, ry * (r / 0.5), rgba(mul(rope, 0.9 - i * 0.04)), rgba(pal.shadow, 0.35), 0.5);
      ellipse(c, cp[0], cp[1] - i * 0.55 - 0.3, r * s * 0.92, ry * (r / 0.5) * 0.86, null, rgba(pal.rimLight, pal.rimLightA * 0.45), 0.4);
    }
    ellipse(c, cp[0], cp[1] - 1.9, 0.14 * s, ry * 0.3, rgba(pal.shadow, 0.55));
  }

  // =====================================================================
  // 3. Compose
  // =====================================================================
  const out = canvas.getContext("2d");
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  if (reflection) {
    out.drawImage(wc, 0, 0);
    out.drawImage(rfc, 0, 0);
  }
  out.globalAlpha = pal.alpha;
  out.drawImage(dc, 0, 0);
  out.globalAlpha = 1;

  const refZ = postZ[1];
  const pilings = posts
    .map((p) => {
      const f = P(p.sd * POST_X, 0, p.z);
      return { x: f[0] * scale, y: f[1] * scale, r: POST_R * sc(p.z) * scale };
    })
    .filter((p) => p.y <= ch && p.y > 0)
    .sort((a, b) => a.y - b.y);
  let reflectionCanvas = null;
  if (!reflection) {
    reflectionCanvas = document.createElement("canvas");
    reflectionCanvas.width = pw;
    reflectionCanvas.height = ph;
    reflectionCanvas.style.width = `${cw}px`;
    reflectionCanvas.style.height = `${ch}px`;
    reflectionCanvas.getContext("2d").drawImage(rfc, 0, 0);
  }
  return {
    pilings,
    reflectionCanvas,
    canvas,
    width: cw,
    height: ch,
    waterlineY: waterY(refZ) * scale,
    anchorX: nearC * scale,
  };
}

function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}
