/* ── bird flock ──────────────────────────────────────────────────────────────
   Procedurally-built gulls: the anatomy, the flapping vertex shader and the
   boids simulation are all verbatim from the drop-in reference, and the
   comments explaining WHY each part is shaped the way it is come with them.

   Four things had to change to run inside this site's scene rather than its own
   page, and only these — the same list curved-gallery.js carries, for the same
   reason:

   1. The original owns a renderer, canvas, scene, camera, ResizeObserver,
      IntersectionObserver and rAF loop. Here it is a Group added to the
      journey's scene, so all of that is dropped: one renderer and one context,
      as the site already has. The host calls update() from its own frame loop.

   2. A uOpacity uniform. The site fades the flock in and out per scene through
      P.birdOp, which the reference had no concept of — its only alpha was the
      per-instance corridor fade. The two multiply.

   3. The haze range follows the camera. The reference derived uNear/uFar from
      its own fixed camera z; here the flock re-bases between the hero and work
      legs and the camera flies a path, so update() measures the real distance
      each frame. Its comment about portrait viewports washing the flock out
      applies doubly when the camera actually moves.

   4. setHaze(), so the tint distant birds recede toward can track the scene's
      own fog colour instead of being pinned to one sky.

   Not changed: this keeps its own haze rather than taking the scene's fog. A
   ShaderMaterial gets no fog chunks unless they are asked for, and the
   reference's haze is doing something more specific anyway — it also thins the
   primaries and trailing edges, which is what stops a distant bird reading as a
   solid blob.                                                                */

/* ==================================================================== utils */
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function tbl(rows, t) {                      // rows: [key, v1, v2, ...]
  if (t <= rows[0][0]) return rows[0].slice(1);
  for (let i = 1; i < rows.length; i++) {
    if (t <= rows[i][0]) {
      const a = rows[i - 1], b = rows[i], k = (t - a[0]) / (b[0] - a[0]);
      return a.slice(1).map((v, j) => lerp(v, b[j + 1], k));
    }
  }
  return rows[rows.length - 1].slice(1);
}

/* ==================================================================== anatomy
   +X forward (bill tip), +Y up, ±Z spanwise. One half-span = 1 unit.
   Gull-like: span : total length ~ 2.2 : 1

   The wing is assembled the way a real one is, because in silhouette the
   joins are exactly what you read:
     · arm-wing + secondaries — one sheet, trailing edge scalloped per feather
     · six primaries          — separate feathers from the wrist, slotted tips
     · alula                  — small tuft on the leading edge at the wrist
   The tail is six separate rectrices; the legs tuck back beneath it.        */

const WRIST_R = 0.50, WRIST_X = 0.06;

// body radius profile: plump breast, pinched neck, small head, tapering bill
const BODY = [
  [-0.30, 0.006], [-0.26, 0.041], [-0.20, 0.071], [-0.10, 0.095], [0.00, 0.103],
  [0.08, 0.098], [0.14, 0.084], [0.19, 0.061], [0.245, 0.048], [0.285, 0.047],
  [0.325, 0.059], [0.37, 0.068], [0.415, 0.063], [0.45, 0.046], [0.50, 0.027],
  [0.545, 0.014], [0.60, 0.003]
];
// arm-wing sheet: [span, chord, leading-edge x]
const ARM = [
  [0.00, 0.300, 0.130], [0.15, 0.300, 0.135], [0.30, 0.286, 0.130],
  [0.42, 0.270, 0.118], [0.52, 0.252, 0.100], [0.62, 0.232, 0.078]
];
// vane width along one primary
const VANE = [[0, 0.010], [0.12, 0.030], [0.35, 0.048], [0.60, 0.050], [0.78, 0.040], [0.92, 0.022], [1, 0.004]];
const NPRIM = 6, NRECT = 6;

function buildBird(THREE) {
  const P = [], A = [], PT = [], IDX = [];
  let base = 0;
  function grid(nu, nv, f) {
    const start = base;
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const v = f(i / nu, j / nv);
      P.push(v.p[0], v.p[1], v.p[2]);
      /* Packed into a single vec4. Attribute slots are scarce: WebGL caps at
         16 and three.js already spends 3 on position/normal/uv plus 4 on
         instanceMatrix, so one float per attribute overflows the program.
         aWrist and aSide are gone entirely — both are derivable in the
         shader (aWrist from span, aSide from sign(position.z)).           */
      A.push(v.s || 0, v.t || 0, v.c || 0, v.f || 0);
      PT.push(v.t || 0);
      base++;
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = start + i * (nv + 1) + j;
      IDX.push(a, a + nv + 1, a + 1, a + 1, a + nv + 1, a + nv + 2);
    }
  }
  const BODYN = BODY.map(b => [(b[0] + 0.30) / 0.90, b[0], b[1]]);   // re-keyed 0..1

  /* ---- body: lathe, belly fuller than the back (breast keel) */
  grid(32, 12, (u, v) => {
    const [x, r] = tbl(BODYN, u);
    const a = v * Math.PI * 2, sa = Math.sin(a);
    const keel = 1 + 0.13 * Math.max(0, -sa) * sstep(-0.22, 0.05, x) * (1 - sstep(0.20, 0.34, x));
    return { p: [x, sa * r * 1.05 * keel, Math.cos(a) * r * 0.93], t: 0 };
  });

  /* ---- legs: tucked back along the belly, tiny trailing feet */
  for (const d of [-1, 1]) grid(6, 2, (u, v) => {
    const x = lerp(0.03, -0.34, u), spread = lerp(0.030, 0.052, u);
    const th = lerp(0.016, 0.005, u) * (1 - Math.abs(v - 0.5) * 1.2);
    const foot = u > 0.86 ? 0.020 * (u - 0.86) / 0.14 : 0;
    return { p: [x, lerp(-0.072, -0.044, u) + (v - 0.5) * th * 1.4, d * (spread + foot) + (v - 0.5) * th], t: 0 };
  });

  /* ---- tail: six rectrices, fanned, faintly notched at the centre */
  for (let k = 0; k < NRECT; k++) {
    const f = (k / (NRECT - 1) - 0.5) * 2;
    const ang = f * 0.56, len = lerp(0.29, 0.235, Math.abs(f));
    grid(6, 2, (u, v) => {
      const L = u * len;
      const [w] = tbl([[0, 0.008], [0.2, 0.026], [0.6, 0.030], [0.9, 0.022], [1, 0.005]], u);
      return {
        p: [-0.24 - L * Math.cos(ang) + (v - 0.5) * w * Math.sin(ang),
          -0.016 * u - 0.008 * (1 - Math.abs(f)),
          L * Math.sin(ang) + (v - 0.5) * w * Math.cos(ang)], t: 2
      };
    });
  }

  /* ---- arm-wing + secondaries: one sheet, trailing edge scalloped */
  for (const d of [-1, 1]) grid(18, 5, (u, v) => {
    const s = u * 0.62;
    const [chord, xle] = tbl(ARM, s);
    const scallop = -0.016 * Math.pow(v, 3) * Math.abs(Math.sin(s * Math.PI * 8.5));
    const camber = 0.10 * chord * (0.35 + 0.65 * s / 0.62) * (1 - Math.pow(2 * v - 1, 2));
    return { p: [xle - chord * v + scallop, camber, d * s], s, c: v, t: 1 };
  });

  /* ---- primaries: separate feathers from the wrist, tips forming the swept
          point. The outer three are emarginated — they narrow abruptly, which
          is what opens the visible slots at the tip.                        */
  for (const d of [-1, 1]) for (let k = 0; k < NPRIM; k++) {
    const f = k / (NPRIM - 1);                                  // 0 innermost .. 1 outermost
    const x0 = lerp(-0.070, 0.100, f), r0 = lerp(0.44, 0.50, f);
    const x1 = lerp(-0.206, -0.184, f), r1 = lerp(0.735, 1.000, Math.pow(f, 0.92));
    const dx = x1 - x0, dr = r1 - r0, L = Math.hypot(dx, dr);
    const ux = dx / L, ur = dr / L, nx = -ur, nr = ux;                // along + normal, in (x,r)
    const wide = lerp(1.35, 0.86, f), notch = 0.34 * sstep(0.45, 1, f);
    grid(8, 2, (u, v) => {
      let [w] = tbl(VANE, u);
      w *= wide * (1 - notch * sstep(0.55, 0.74, u));
      const off = (v - 0.5) * w, bow = 0.055 * Math.pow(u, 1.6) * (0.4 + 0.6 * f);
      const x = x0 + ux * L * u + nx * off, r = r0 + ur * L * u + nr * off;
      return { p: [x, bow, d * r], s: r, c: v, t: 3, f: (f - 0.5) * 2 };
    });
  }

  /* ---- alula: small tuft on the leading edge at the wrist */
  for (const d of [-1, 1]) grid(4, 2, (u, v) => {
    const w = 0.030 - 0.026 * u;
    const r = lerp(0.470, 0.600, u) + (v - 0.5) * w;
    return { p: [lerp(0.095, 0.020, u) + (v - 0.5) * w * 0.3, 0.004, d * r], s: r, c: v, t: 4 };
  });

  /* body, legs and tail sit slightly shorter than they were drawn, so the
     span : total-length ratio lands where a gull's actually is (~2.1 : 1) */
  for (let i = 0; i < PT.length; i++) if (PT[i] < 0.5 || PT[i] === 2) P[i * 3] *= 0.85;

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aData', new THREE.Float32BufferAttribute(A, 4));  // span, part, chord, fan
  g.setIndex(IDX);
  return g;
}

/* ==================================================================== shader */
const VERT = `
attribute vec4 aData;   /* span, part, chord, fan   — packed to fit the
                           16-attribute limit; see buildBird()          */
attribute vec4 iData;   /* phase, amplitude, glide, fade (per instance) */
uniform float uNear, uFar, uFarAlpha;
varying float vAlpha, vHaze;

#define PI  3.14159265
#define TAU 6.28318531
#define DUTY 0.42
#define WX ${WRIST_X}
#define WR ${WRIST_R}

void main(){
  vec3 p = position;

  float aSpan = aData.x, aPart = aData.y, aChord = aData.z, aFan = aData.w;
  float iPhase = iData.x, iAmp = iData.y, iGlide = iData.z, iFade = iData.w;

  /* both of these were separate attributes until they overflowed the
     program; each is exactly recoverable, so they cost nothing to derive */
  float aWrist = clamp((aSpan - WR)/0.50, 0.0, 1.0);
  float aSide  = sign(position.z);

  /* phase, lagged along the span so a wave travels out to the tip */
  float ph = iPhase - 0.55*aSpan;
  float fr = fract(ph/TAU);

  /* fast downstroke, slower recovery, and the wing eases to a stop before
     each reversal instead of snapping direction                        */
  float u = fr < DUTY ? 0.5*smoothstep(0.0,1.0, fr/DUTY)
                      : 0.5 + 0.5*smoothstep(0.0,1.0,(fr-DUTY)/(1.0-DUTY));
  float w    = cos(TAU*u);                                     /* +1 top, -1 bottom */
  float up   = fr < DUTY ? 0.0 : sin(PI*(fr-DUTY)/(1.0-DUTY)); /* upstroke envelope */
  float down = fr < DUTY ? sin(PI*fr/DUTY) : 0.0;              /* downstroke envelope */

  bool isWing = (aPart > 0.5 && aPart < 1.5) || aPart > 2.5;

  if(isWing){
    float x = p.x, r = abs(p.z), y = p.y;

    /* 1. primary slotting — feathers fan apart, most of it on the upstroke */
    if(aFan != 0.0){
      /* scaled by aWrist so each feather pivots at its base and stays
         attached to the sheet, instead of the whole strip swinging */
      float fan = aFan * 0.145 * aWrist * (0.34 + 0.66*up) * (1.0 - 0.55*iGlide);
      float ex = x - WX, er = r - WR, cs = cos(fan), sn = sin(fan);
      x = WX + ex*cs - er*sn;
      r = WR + ex*sn + er*cs;
    }

    /* 2. wrist tuck — the hand-wing sweeps back and in on the upstroke */
    float fold = up * (1.0-iGlide) * iAmp * 0.66 * aWrist;
    float dx = x - WX, dr = r - WR, cf = cos(fold), sf = sin(fold);
    x = WX + dx*cf - dr*sf;
    r = WR + dx*sf + dr*cf;
    r *= 1.0 - 0.10*fold;

    /* 3. spanwise flex — the wing bows up under load through the downstroke */
    y += 0.055 * aSpan*aSpan * down * iAmp * (1.0-iGlide);

    /* 4. twist — the tip pitches through the stroke (washout) */
    float tw = (0.32*sin(TAU*u + 0.85)*(1.0-0.65*iGlide) + 0.05) * aSpan*aSpan;
    float ct = cos(tw), st = sin(tw);
    float xt = x*ct - y*st;
    float yt = x*st + y*ct;

    /* 5. flap — deep down, high up, outer wing swings furthest */
    float ang = mix(-0.80, 0.94, (w+1.0)*0.5) * iAmp * (0.55 + 0.45*aSpan);
    ang = mix(ang, 0.13 + 0.05*aSpan, iGlide);
    float ca = cos(ang), sa = sin(ang);
    p = vec3(xt, r*sa + yt*ca, aSide*(r*ca - yt*sa));
  } else {
    /* body and tail ride up as the wings drive down; the tail damps a little */
    p.y -= 0.055 * w * (1.0-iGlide) * iAmp * (aPart > 1.5 ? 0.75 : 1.0);
  }

  vec4 mv = modelViewMatrix * instanceMatrix * vec4(p,1.0);

  /* atmospheric perspective, plus translucent primaries and trailing edges */
  float haze = smoothstep(uNear, uFar, -mv.z);
  vAlpha = iFade * mix(1.0, uFarAlpha, haze)
         * (1.0 - 0.26*smoothstep(0.55,1.0,aSpan))
         * (1.0 - 0.16*smoothstep(0.70,1.0,aChord));
  vHaze  = haze;

  gl_Position = projectionMatrix * mv;
}`;

/* uOpacity is the one addition: the scene fade multiplies the per-bird alpha
   rather than replacing it, so birds still fade at the corridor ends while the
   whole flock comes and goes with the leg. */
const FRAG = `
uniform vec3 uColor, uHaze;
uniform float uHazeMix, uOpacity;
varying float vAlpha, vHaze;
void main(){
  float a = vAlpha * uOpacity;
  if(a < 0.012) discard;        /* else invisible birds still write depth
                                   and occlude the ones behind them */
  gl_FragColor = vec4(mix(uColor, uHaze, vHaze*uHazeMix), a);
}`;

/* ==================================================================== flock */
export function createFlock(THREE, opts) {
  const CONFIG = Object.assign({
    count: 26,
    heading: 'away',       // 'away' = receding, as in the reference | 'toward'
    yaw: -0.30,            // corridor yaw, radians; negative veers right as it recedes
    climb: 0.07,           // gentle gain in altitude along the corridor
    color: '#3c352f',      // silhouette colour (nearest birds)
    haze: '#cdc6b2',       // colour distant birds tint toward
    hazeMix: 0.68,
    farAlpha: 0.16,
    scale: 1.0,
    speed: 1.0,
    corridor: 130,         // depth of the flight corridor
    spread: [40, 20],      // lateral, vertical spread of the flock
    fadeIn: 18,            // units over which a recycled bird fades back in
    fadeOut: 26,           // units over which it fades out at the far end …
    fadeFar: 0             // … and the floor it fades TO, so it recedes into
                           //    the haze instead of disappearing outright
  }, opts || {});

  /* the flock lives in its own frame, so the corridor runs along local ±Z and
     the whole thing is simply yawed to point away-and-right                   */
  const group = new THREE.Group();
  group.rotation.y = CONFIG.yaw;

  const N = CONFIG.count;
  const geo = buildBird(THREE);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(CONFIG.color) },
      uHaze: { value: new THREE.Color(CONFIG.haze) },
      uHazeMix: { value: CONFIG.hazeMix },
      uNear: { value: 65 }, uFar: { value: 245 },
      uFarAlpha: { value: CONFIG.farAlpha },
      uOpacity: { value: 0 }
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
  /* depthWrite is false where the reference had it true: there it drew onto an
     empty transparent canvas, but here the birds share a depth buffer with the
     cloud sprites they fly among, and writing depth punched holes in the ones
     drawn after them. The discard above still keeps fully-faded birds free. */
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  group.add(mesh);

  // one vec4 per bird rather than four floats — four separate instanced
  // attributes put the program over the 16-slot limit
  const iData = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
  iData.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iData', iData);

  /* ================================================================== birds */
  const [SX, SY] = CONFIG.spread, LEN = CONFIG.corridor, LH = LEN / 2;
  const FADE_IN = CONFIG.fadeIn, FADE_OUT = CONFIG.fadeOut, FADE_FAR = CONFIG.fadeFar;
  const SGN = CONFIG.heading === 'toward' ? 1 : -1;
  const drift = new THREE.Vector3(0, CONFIG.climb, SGN).normalize();

  const B = [];
  for (let i = 0; i < N; i++) {
    const size = rnd(0.82, 1.20);
    B.push({
      p: new THREE.Vector3(rnd(-SX / 2, SX / 2), rnd(-SY / 2, SY / 2), rnd(-LH, LH)),
      v: drift.clone().multiplyScalar(6).add(new THREE.Vector3(rnd(-1, 1), rnd(-.4, .4), rnd(-1, 1))),
      a: new THREE.Vector3(),
      size,
      freq: rnd(2.5, 3.4) / Math.pow(size, 0.85),     // bigger birds beat slower
      phase: rnd(0, Math.PI * 2),
      amp: 1, glide: 0, roll: 0,
      state: Math.random() < 0.3 ? 'glide' : 'flap',
      timer: rnd(0.5, 3)
    });
  }
  const M = new THREE.Matrix4();
  const fwd = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(),
    up2 = new THREE.Vector3(), side2 = new THREE.Vector3(),
    tmp = new THREE.Vector3(), lat = new THREE.Vector3(), WU = new THREE.Vector3(0, 1, 0),
    target = new THREE.Vector3();
  const want = 6.2 * CONFIG.speed;

  function step(dt, t) {
    /* the flock as a whole weaves, so it never reads as a rigid formation */
    target.set(Math.sin(t * 0.11) * SX * 0.22 + Math.sin(t * 0.043) * SX * 0.12,
      Math.sin(t * 0.077) * SY * 0.28, 0);

    for (let i = 0; i < N; i++) {
      const b = B[i];
      b.a.set(0, 0, 0);
      let cx = 0, cy = 0, cz = 0, vx = 0, vy = 0, vz = 0, n = 0;

      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const o = B[j];
        const dx = o.p.x - b.p.x, dy = o.p.y - b.p.y, dz = o.p.z - b.p.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 240) continue;
        const d = Math.sqrt(d2) || 0.001;
        cx += o.p.x; cy += o.p.y; cz += o.p.z; vx += o.v.x; vy += o.v.y; vz += o.v.z; n++;
        if (d < 5.5) { const f = (5.5 - d) / d * 3.4; b.a.x -= dx * f; b.a.y -= dy * f; b.a.z -= dz * f; }
      }
      if (n) {
        b.a.x += (cx / n - b.p.x) * 0.16; b.a.y += (cy / n - b.p.y) * 0.16; b.a.z += (cz / n - b.p.z) * 0.16;
        b.a.x += (vx / n - b.v.x) * 0.9; b.a.y += (vy / n - b.v.y) * 0.9; b.a.z += (vz / n - b.v.z) * 0.9;
      }
      b.a.x += (target.x - b.p.x) * 0.055;
      b.a.y += (target.y - b.p.y) * 0.055;
      b.a.addScaledVector(drift, 2.4);
      if (Math.abs(b.p.x) > SX * 0.5) b.a.x -= Math.sign(b.p.x) * (Math.abs(b.p.x) - SX * 0.5) * 1.1;
      if (Math.abs(b.p.y) > SY * 0.5) b.a.y -= Math.sign(b.p.y) * (Math.abs(b.p.y) - SY * 0.5) * 1.4;
      b.a.x += Math.sin(t * 0.9 + i * 2.1) * 1.1;
      b.a.y += Math.sin(t * 0.7 + i * 1.3) * 0.9;
      b.a.z += Math.cos(t * 0.8 + i * 3.7) * 0.7;

      if (b.a.length() > 16) b.a.setLength(16);
      b.v.addScaledVector(b.a, dt);
      const sp = b.v.length();
      if (sp > 0.001) b.v.multiplyScalar(lerp(1, want / sp, 0.06));
      b.p.addScaledVector(b.v, dt);

      /* recycle down the corridor, fading at both ends so nothing pops in */
      let z = b.p.z * SGN;                         // -LH at the near end, +LH at the far end
      if (z > LH) {
        b.p.z -= SGN * LEN; z -= LEN;
        b.p.x = lerp(b.p.x, rnd(-SX / 2, SX / 2), 0.6);
        b.p.y = lerp(b.p.y, rnd(-SY / 2, SY / 2), 0.6);
      }
      /* The far ramp is the one that decides whether a bird recedes or simply
         evaporates. The reference faded over 26 of its 130 units into nothing,
         which reads as vanishing mid-flight once uFarAlpha is high enough for
         distant birds to still be visible — so the ramp is configurable, and
         it fades to FADE_FAR rather than to zero: the haze then carries them
         the rest of the way out, which is what recession actually looks like. */
      const alpha = Math.min(sstep(0, FADE_IN, z + LH),
        FADE_FAR + (1 - FADE_FAR) * sstep(0, FADE_OUT, LH - z));

      /* ---- flap / glide: nobody flaps forever; climbing birds work harder */
      b.timer -= dt;
      if (b.timer <= 0) {
        if (b.state === 'flap') { b.state = 'glide'; b.timer = rnd(0.9, 3.2); }
        else { b.state = 'flap'; b.timer = rnd(1.4, 4.0); }
      }
      const climb = clamp((b.v.y - drift.y * want) / 2.2, -1, 1);
      if (climb > 0.45 && b.state === 'glide') { b.state = 'flap'; b.timer = Math.max(b.timer, 1.0); }
      b.glide = lerp(b.glide, b.state === 'glide' ? 1 : 0, 1 - Math.exp(-dt * 3.2));
      b.amp = lerp(b.amp, clamp(0.82 + climb * 0.28, 0.6, 1.15), 1 - Math.exp(-dt * 2.5));
      b.phase += Math.PI * 2 * b.freq * (1 - b.glide * 0.55) * dt;
      if (b.phase > Math.PI * 2) b.phase -= Math.PI * 2;   /* unbounded phase loses
                                                             float32 precision over a
                                                             long-lived page          */

      /* ---- orientation: heading from velocity, rolled into the turn */
      fwd.copy(b.v).normalize();
      side.crossVectors(fwd, WU); if (side.lengthSq() < 1e-6) side.set(0, 0, 1); side.normalize();
      up.crossVectors(side, fwd).normalize();
      lat.copy(b.a).addScaledVector(fwd, -b.a.dot(fwd));
      b.roll = lerp(b.roll, clamp(lat.dot(side) * 0.075, -0.85, 0.85), 1 - Math.exp(-dt * 3.5));
      const cr = Math.cos(b.roll), sr = Math.sin(b.roll);
      up2.copy(up).multiplyScalar(cr).addScaledVector(side, sr);
      side2.copy(side).multiplyScalar(cr).addScaledVector(up, -sr);

      M.makeBasis(fwd, up2, side2);
      M.scale(tmp.setScalar(b.size * CONFIG.scale));
      M.setPosition(b.p);
      mesh.setMatrixAt(i, M);

      const q = i * 4;
      iData.array[q] = b.phase;
      iData.array[q + 1] = b.amp;
      iData.array[q + 2] = b.glide;
      iData.array[q + 3] = alpha;
    }
    mesh.instanceMatrix.needsUpdate = true;
    iData.needsUpdate = true;
  }

  for (let i = 0; i < 30; i++) step(0.05, i * 0.05);   // settle the flock before frame one

  const wp = new THREE.Vector3();
  return {
    group: group,
    /* The reference pinned uNear/uFar to its own fixed camera z and noted that
       hardcoding them washed the flock out on portrait viewports. Here the
       camera flies a path AND the flock re-bases between legs, so the range is
       measured from the real distance every frame. */
    update: function (dt, t, camera) {
      if (mat.uniforms.uOpacity.value < 0.005) return;
      /* dt <= 0 means "hold the flock still but keep it correctly hazed" —
         reduced motion passes 0. The range has to be set either way: it is
         derived from the camera, and left at its constructor defaults the birds
         either lose their depth entirely or wash out to nothing. */
      if (dt > 0) step(dt, t);
      group.getWorldPosition(wp);
      const d = wp.distanceTo(camera.position);
      mat.uniforms.uNear.value = d - CONFIG.corridor * 0.45;
      mat.uniforms.uFar.value = d + CONFIG.corridor * 0.95;
    },
    setOpacity: function (v) {
      mat.uniforms.uOpacity.value = v;
      group.visible = v > 0.005;
    },
    setHaze: function (col) { mat.uniforms.uHaze.value.copy(col); },
    material: mat
  };
}
