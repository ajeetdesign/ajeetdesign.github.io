/* ── curved gallery ─────────────────────────────────────────────────────────
   The card implementation from curved-gallery.html, kept as-is: both shaders
   are verbatim, as are the layout (a cylinder of RADIUS with per-card roll),
   the cascaded-exponential scroll response, and the underdamped spring that
   drives the whip.

   Four things had to change to run inside this site's scene rather than its
   own page, and only these:

   1. PlaneBufferGeometry -> PlaneGeometry. The original loads Three r128 from
      a CDN; this site ships a newer build where the BufferGeometry aliases
      were removed. Same class, current name.

   2. The original owns a renderer, camera, scene, fog and grid floor. Here it
      is a Group added to the journey's scene, so all of that is dropped — one
      renderer and one context, as the site already has.

   3. Placement. The shader does its bulge in WORLD space around uFocus, so the
      wall cannot simply be moved: the focus point and the bulge's amplitude
      and sigmas are world distances and have to travel and scale with it. The
      rig below reproduces the original's camera-relative geometry — its camera
      sat at (0, 0.12, 7.6) looking at the origin — and then rescales those
      world constants to match.

   4. Input. The original binds GSAP Observer to wheel on window with
      preventDefault, which is right when the page does not scroll. Here the
      wheel IS the site's navigation, and capturing it would trap the reader in
      the section. Drag drives the wall; the wheel is left to the page.
      That removes the only real use of Observer, and the remaining GSAP calls
      are a clamp, a killTweensOf and one expo.out tween — not worth 80KB of
      CDN on every page load, so the throw is written out below. The easing is
      the same curve.                                                        */

/* The card's own aspect, not the reference's canvas size. The procedural art
   was drawn at 1152x712 (1.62) onto a 1.70 card and quietly stretched to fit;
   a photograph of real UI cannot absorb that, so the backing canvas matches
   the card and the shot is cover-cropped into it instead. */
const CW = 1600, CH = Math.round(CW * 3.3 / 5.6);

/* --- layout constants (verbatim) --- */
const PW = 5.6, PH = 3.3, GAP = 0.28, STEP = PW + GAP;
const RADIUS = 19;                  // gentle arc — cards enter/exit at a shallow angle

/* --- the fixed "lens": a spherical bulge left of centre (verbatim) --- */
const FOCUS_LOCAL = [-1.6, 0.0, 0]; // anchor, in the gallery's own frame
const BULGE_AMP = 1.35;   // how far vertices push toward the camera
const BULGE_SIGMA = 2.8;  // broad soft dome — spans most of a card
const BRIGHT_SIGMA = 4.1; // brightness falls off over a wider range than the bulge

/* the original's camera, which the rig reproduces */
const SRC_CAM = { pos: [0, 0.12, 7.6], fov: 50 };
/* how far the wall sits below its resting place at the start of the
   entrance — the 3D equivalent of .reveal's translateY */
const RISE = 1.15;

const clamp = (lo, hi, v) => Math.min(hi, Math.max(lo, v));

const vsh = `
  #define PI 3.14159265
  uniform float uVel;
  uniform vec3  uFocus;
  uniform float uAmp;
  uniform float uSigma;
  uniform float uSigmaB;
  uniform float uWave;     // ripple strength at the dome's rim (grows with motion)
  uniform float uPress;    // hover press strength 0..1
  uniform vec2  uMouse;    // press point in uv (glides after the cursor)
  uniform float uTime;
  uniform vec2  uAspect;
  varying vec2  vUv;
  varying float vF;        // bulge factor 0..1
  varying float vB;        // brightness factor 0..1 (wider falloff)
  varying float vPress;    // dent factor for shading
  void main(){
    vUv = uv;
    vec3 p = position;
    // velocity whip: S-bend while the wall is moving fast
    p.z += uVel * sin((uv.x - 0.5) * PI) * 0.55;
    p.y += uVel * (uv.y - 0.5) * sin((uv.x - 0.5) * PI) * 0.25;
    // cursor press: the surface dents in under the pointer, and a small
    // ripple radiates outward from the press point across the card
    vec2 pv = (uv - uMouse) * uAspect;   // plane units -> circular press
    float pd = length(pv);
    float dent = exp(-(pd * pd) / 0.5);
    float ripple = sin(pd * 7.0 - uTime * 5.5) * exp(-pd * 1.6);
    p.z -= uPress * (dent * 0.3 + ripple * 0.05 * (1.0 - dent));
    vPress = uPress * dent;
    // to world space, then wrap over the fixed sphere at the left end.
    // The falloff is dominated by horizontal distance, so the whole
    // vertical column of a card lifts together (top edge arches up,
    // bottom edge dips down) — a card passing through bends around it.
    vec4 wp = modelMatrix * vec4(p, 1.0);
    float dx = wp.x - uFocus.x;
    float dy = (wp.y - uFocus.y) * 0.5;   // slight spherical rounding
    float d2 = dx * dx + dy * dy;
    float q = d2 / (uSigma * uSigma);
    float f = exp(-q);                    // the dome
    vF = f;
    vB = exp(-(dx * dx) / (uSigmaB * uSigmaB));
    // ripple: a soft trough ringing the dome (~1.9 sigma out, wide shoulders),
    // so an entering card's leading edge sags down and back as it rides the
    // wave tail, climbs the dome, then dips again on the way off
    float dn = sqrt(q);
    float ring = exp(-pow((dn - 1.9) / 0.85, 2.0));
    wp.z += f * uAmp - ring * uWave;
    wp.y -= ring * uWave * 0.35;          // slight vertical droop on the wave
    wp.x -= dx * f * 0.05;                // curl: pull toward the peak, wrapping content over it
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fsh = `
  uniform sampler2D uMap;
  uniform vec2  uAspect;
  uniform float uHover;
  uniform float uTime;
  uniform float uSeed;
  uniform float uFade;
  varying vec2  vUv;
  varying float vF;
  varying float vB;
  varying float vPress;
  void main(){
    // slow ken-burns drift so screens feel "live"
    float t = uTime * 0.05 + uSeed * 10.0;
    vec2 kbUv = (vUv - 0.5) * (0.965 + 0.02 * sin(t)) + 0.5;
    kbUv += vec2(sin(t * 0.7), cos(t * 0.9)) * 0.006;
    /* The baked heading/arrow live in the bottom ~20% of the texture (below
       the scrim). Panning that band with the rest of the shot would drift the
       chrome around, and every card runs its own uSeed phase, so the same
       fixed-pixel padding would land at a visibly different spot card to
       card at any given instant. Hold that band to the raw, unpanned uv. */
    float kbAmt = smoothstep(0.14, 0.22, vUv.y);
    vec2 uv = mix(vUv, kbUv, kbAmt);
    vec4 tex = texture2D(uMap, uv);
    // rounded corners (SDF in plane units)
    vec2 p = (vUv - 0.5) * uAspect;
    vec2 b = uAspect * 0.5 - vec2(0.16);
    vec2 d2 = abs(p) - b;
    float d = length(max(d2, 0.0)) + min(max(d2.x, d2.y), 0.0) - 0.16;
    float alpha = 1.0 - smoothstep(-0.008, 0.008, d);
    if (alpha < 0.01) discard;
    // brightness = horizontal falloff from the same focus, wider than the bulge,
    // so a card fades smoothly across its own width as it moves away
    /* Three separate things were making these read dull. The floor was 0.84,
       tuned back when the falloff alone made an off-focus card fade to a
       fifth against a near-black reference page — over the bright sky and a
       real UI screenshot that same floor just reads as a haze over the shot,
       so it comes up again to keep depth cueing without muddying the asset. */
    float bright = mix(0.94, 1.0, smoothstep(0.03, 0.85, vB));
    bright = min(bright + uHover * 0.12, 1.05);
    /* No gamma lift any more. It was here because the reference's artwork was
       drawn for a dark page — black rooms and midnight scenes that only went
       muddy when scaled. These are bright shots of real UI on near-white
       ground, where lifting the midtones just flattens them against the
       background and costs the 11px labels their contrast. */
    vec3 col = tex.rgb * bright;
    col *= 1.0 - vPress * 0.14;           // soft shadow inside the press dent
    col *= 1.0 - 0.03 * length(vUv - 0.5);   // vignette eased for the same reason
    gl_FragColor = vec4(col, alpha * uFade);
  }
`;

/* One texture per distinct file. The card list repeats the same three shots to
   keep the carousel's loop long, and decoding a 2400x1350 JPEG once per copy
   would cost three times the memory for identical pixels. */
const texCache = new Map();
let pending = [];

/* Baked onto every card, bottom-left title and bottom-right arrow, so the
   glyph rides the texture instead of a DOM node that would have to track a
   plane bulging and curving in 3D every frame. */
function drawCardOverlay(ctx, title) {
  if (!title) return;
  /* The vertex shader's "curl" pulls each card horizontally toward the fixed
     lens focus at the left of the wall, so the card nearest that focus gets
     its left edge visually compressed toward centre — the same fixed pixel
     padding then reads tighter on that card than on ones further from the
     focus. The arrow sits at the right, away from the focus, so it doesn't
     need the same cushion. */
  const padX = 56, padTextL = 104, padB = 96;
  const grad = ctx.createLinearGradient(0, CH * 0.8, 0, CH);
  grad.addColorStop(0, 'rgba(8, 14, 22, 0)');
  grad.addColorStop(1, 'rgba(8, 14, 22, 0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, CH * 0.8, CW, CH * 0.2);

  ctx.font = '600 34px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#fff';
  ctx.fillText(title, padTextL, CH - padB + 6);
  ctx.shadowBlur = 0;

  const r = 42, cx = CW - padX - r, cy = CH - padB - r + 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.stroke();

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy);
  ctx.lineTo(cx + 13, cy);
  ctx.moveTo(cx + 3, cy - 11);
  ctx.lineTo(cx + 13, cy);
  ctx.lineTo(cx + 3, cy + 11);
  ctx.stroke();
}

function makeTexture(THREE, p, maxAniso) {
  if (texCache.has(p.src)) return texCache.get(p.src);

  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const ctx = c.getContext('2d');

  const t = new THREE.CanvasTexture(c);
  if (maxAniso) t.anisotropy = maxAniso;
  /* The reference this was lifted from drew low-frequency procedural art, where
     a mip-less LinearFilter was a cheap, invisible shortcut. These textures are
     screenshots with small real UI text, viewed at an angle on a curved wall —
     without mipmaps the anisotropy setting above is inert (it only kicks in
     under a *MipmapLinearFilter), so oblique cards lost the minified text to
     bilinear mush instead of being sharpened by it. */
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;

  let loadedImg = null;

  /* Redrawn (not just overlaid) so a late font swap — document.fonts.ready
     can resolve after the image has already landed — never stacks a second
     scrim and title on top of the first. */
  function paint() {
    /* The card is drawn before the JPEG arrives, so the canvas starts on the
       shots' own near-white ground rather than transparent black — otherwise
       a card entering frame flashes dark before its image lands. */
    ctx.fillStyle = '#e8eef5';
    ctx.fillRect(0, 0, CW, CH);
    if (loadedImg) {
      // cover: crop the long edge rather than squashing a screenshot to fit
      const s = Math.max(CW / loadedImg.width, CH / loadedImg.height);
      const w = loadedImg.width * s, h = loadedImg.height * s;
      ctx.drawImage(loadedImg, (CW - w) / 2, (CH - h) / 2, w, h);
    }
    drawCardOverlay(ctx, p.title);
    t.needsUpdate = true;
  }

  /* Deferred, not fetched here. The gallery is built during page init but its
     section is most of a page down, and these are ~250KB each — the story
     player they came from held them in data-src for the same reason. hydrate()
     assigns the srcs once the leg is actually approaching. */
  pending.push(function () {
    const img = new Image();
    img.decoding = 'async';
    img.onload = function () { loadedImg = img; paint(); };
    img.src = p.src;
  });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);

  texCache.set(p.src, t);
  return t;
}

/* Runs each deferred fetch exactly once, however many times it is called. */
function hydrate() {
  const q = pending;
  pending = [];
  q.forEach(function (fn) { fn(); });
}

export function createGallery(THREE, cards, maxAniso) {
  const N = cards.length;
  const TOTAL = N * STEP;

  /* rig: reproduces the original's camera-relative geometry inside this world.
     Everything the gallery built at its own origin hangs under here. */
  const rig = new THREE.Group();
  const wall = new THREE.Group();
  wall.rotation.z = 0.045;     // subtle roll, right side lifted (verbatim)
  wall.position.y = 0.05;
  rig.add(wall);

  const geo = new THREE.PlaneGeometry(PW, PH, 64, 32);
  const focusWorld = new THREE.Vector3();
  let baseY = 0;

  /* uFocus is a WORLD point, so it has to be recomputed whenever the rig
     moves — otherwise the lens stays put while the wall slides underneath it
     and the bulge appears to travel across the cards. */
  function refocus() {
    rig.updateMatrixWorld(true);
    focusWorld.set(FOCUS_LOCAL[0], FOCUS_LOCAL[1], FOCUS_LOCAL[2]).applyMatrix4(wall.matrixWorld);
  }

  /* The entrance the rest of the page uses: content rises from below as it
     fades in. `t` runs 0 (fully below, hidden) to 1 (settled). */
  function setEntrance(t) {
    const y = baseY - (1 - t) * RISE;
    if (y !== rig.position.y) { rig.position.y = y; refocus(); }
  }
  const screens = [];

  cards.forEach(function (card, i) {
    const tex = makeTexture(THREE, card, maxAniso);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vsh, fragmentShader: fsh, transparent: true, depthWrite: false,
      uniforms: {
        uMap: { value: tex },
        uVel: { value: 0 },
        uFocus: { value: focusWorld },
        uAmp: { value: BULGE_AMP },
        uSigma: { value: BULGE_SIGMA },
        uSigmaB: { value: BRIGHT_SIGMA },
        uWave: { value: 0.16 },
        uPress: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uHover: { value: 0 },
        uTime: { value: 0 },
        uSeed: { value: i / N },
        uFade: { value: 0 },
        uAspect: { value: new THREE.Vector2(PW, PH) }
      }
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.index = i;
    mesh.frustumCulled = false;   // the shader relocates vertices; bounds lie
    wall.add(mesh);
    screens.push(mesh);
  });

  /* Places the rig so this scene's camera sees the wall exactly as the
     original's did, and rescales the world-space bulge constants to match. */
  function place(camPos, lookAt, fov, dropY) {
    const dir = lookAt.clone().sub(camPos).normalize();
    /* match apparent size across the two fields of view: a wider frame makes
       the same object smaller, so scale up by the ratio of the half-angles */
    const s = Math.tan(fov * Math.PI / 360) / Math.tan(SRC_CAM.fov * Math.PI / 360);
    rig.scale.setScalar(s);
    rig.position.copy(camPos).addScaledVector(dir, SRC_CAM.pos[2] * s);
    rig.position.y -= SRC_CAM.pos[1] * s;
    rig.position.y -= (dropY || 0) * s;   // clear whatever sits above it
    rig.lookAt(camPos);                 // local +z back toward the viewer
    rig.updateMatrixWorld(true);

    baseY = rig.position.y;
    refocus();
    /* uAmp and the sigmas are world distances in the shader, so they scale
       with the rig or the dome would be the wrong size for the cards */
    screens.forEach(function (m) {
      m.material.uniforms.uAmp.value = BULGE_AMP * s;
      m.material.uniforms.uSigma.value = BULGE_SIGMA * s;
      m.material.uniforms.uSigmaB.value = BRIGHT_SIGMA * s;
    });
  }

  /* Not in the source, which is driven only by wheel and drag: the wall here
     creeps on its own and gives way the moment a card is hovered, so the
     reader can stop it simply by looking at one. */
  const AUTO = 0.20;           // cards per second

  /* --- motion state (verbatim) --- */
  const state = { scroll: -1.3, mid: -1.3, target: -FOCUS_LOCAL[0] / STEP, vel: 0 };
  const bend = { p: 0, v: 0 };        // spring state for the elastic whip
  let hovered = null, isDragging = false, dragMoved = 0, lastX = 0;
  let throwFrom = 0, throwTo = 0, throwT = 1, throwDur = 1.7;
  let lastCamera = null;         // for pick(), which fires outside the frame loop

  const mouse = new THREE.Vector2(-2, -2);
  const raycaster = new THREE.Raycaster();
  const hitUV = new THREE.Vector2(0.5, 0.5);

  /* A one-off raycast at a click/tap point, independent of the continuously
     updated hover state above — hover is mouse-only and can be stale or
     unset for a touch tap that never fired a pointermove first. */
  function pick(clientX, clientY) {
    if (!lastCamera) return null;
    const nx = (clientX / innerWidth) * 2 - 1, ny = -(clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, lastCamera);
    const hits = raycaster.intersectObjects(screens.filter(function (s) { return s.visible; }));
    return hits.length ? hits[0].object.userData.index : null;
  }

  /* the original's release is gsap.to(..., 1.7s, 'expo.out'); this is that
     curve written out, so the throw feels the same without the dependency */
  const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

  function bindDrag(el) {
    el.addEventListener('pointerdown', function (e) {
      isDragging = true; dragMoved = 0; lastX = e.clientX; throwT = 1;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      dragMoved += Math.abs(dx);
      state.target -= dx * 0.0032;      // verbatim gain
      state.velX = dx;
    });
    function end(e) {
      if (!isDragging) return;
      isDragging = false;
      const throwDelta = clamp(-2.6, 2.6, -(state.velX || 0) * 0.10);
      throwFrom = state.target; throwTo = state.target + throwDelta;
      throwT = 0;
      try { el.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  addEventListener('pointermove', function (e) {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  }, { passive: true });

  function update(time, dtMs, fade, camera) {
    lastCamera = camera;
    rig.visible = fade > 0.005;
    if (!rig.visible) return;

    if (throwT < 1) {
      throwT = Math.min(1, throwT + (dtMs / 1000) / throwDur);
      state.target = throwFrom + (throwTo - throwFrom) * expoOut(throwT);
    } else if (!isDragging && hovered === null) {
      /* the drift only runs when nothing else is driving: a throw still
         has right of way, and a hovered card halts it outright */
      state.target += AUTO * (dtMs / 1000);
    }

    // two cascaded exponentials -> S-curved response: motion eases IN
    // as input arrives and eases OUT as it settles, never linear
    const k1 = 1 - Math.pow(1 - 0.09, dtMs / 16.67);
    const k2 = 1 - Math.pow(1 - 0.075, dtMs / 16.67);
    const prev = state.scroll;
    state.mid += (state.target - state.mid) * k1;
    state.scroll += (state.mid - state.scroll) * k2;
    state.vel += ((state.scroll - prev) - state.vel) * 0.1;

    // elastic whip: an underdamped spring chases the scroll velocity,
    // so the bend eases in, trails the motion, and wobbles softly on stop
    const targetBend = clamp(-1.2, 1.2, state.vel * STEP * 1.5);
    const dts = Math.min(dtMs, 33) / 1000;
    const K = 120, C = 14;               // stiffness / damping (zeta ~ 0.64)
    bend.v += (K * (targetBend - bend.p) - C * bend.v) * dts;
    bend.p += bend.v * dts;
    const velU = bend.p;
    // ripple grows with motion: barely-there at rest, pronounced mid-glide
    const waveU = 0.1 + Math.min(0.5, Math.abs(velU)) * 0.55;

    screens.forEach(function (m, i) {
      let x = i * STEP - state.scroll * STEP;
      x = ((x % TOTAL) + TOTAL * 1.5) % TOTAL - TOTAL / 2;
      const theta = x / RADIUS;
      m.position.set(Math.sin(theta) * RADIUS, 0, (Math.cos(theta) - 1) * RADIUS);
      m.rotation.y = theta;
      m.rotation.z = theta * 0.07;   // slight roll grows toward the edges
      m.visible = Math.abs(theta) < 1.5;
      /* Scale is on the same lens as the bulge/brightness: full size at the
         centre, easing down toward the edges so a card visibly grows into
         focus as it arrives and shrinks again as it's carried off. */
      m.userData.focusScale = 0.8 + 0.2 * Math.exp(-(theta * theta) / (0.62 * 0.62));
      const u = m.material.uniforms;
      u.uVel.value = velU;
      u.uWave.value = waveU;
      u.uTime.value = time;
      u.uFade.value = fade;
    });

    // hover raycast (undeformed proxy geometry is close enough)
    let hit = null, hitPoint = null;
    if (!isDragging) {
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(screens.filter(function (s) { return s.visible; }));
      if (hits.length) { hit = hits[0].object.userData.index; hitPoint = hits[0].uv; }
    }
    if (hovered !== hit) hovered = hit;
    screens.forEach(function (m, i) {
      const on = i === hovered ? 1 : 0;
      const u = m.material.uniforms;
      u.uHover.value += (on - u.uHover.value) * 0.12;
      u.uPress.value += (on - u.uPress.value) * 0.12;
      // a little lift on hover, same ease as the brightness/press above
      const target = 1 + on * 0.06;
      const cur = m.userData.hoverScale || 1;
      m.userData.hoverScale = cur + (target - cur) * 0.12;
      m.scale.setScalar(m.userData.hoverScale * m.userData.focusScale);
    });
    // the press point glides after the cursor -> "pressed on movement"
    if (hovered !== null && hitPoint) {
      hitUV.set(hitPoint.x, hitPoint.y);
      screens[hovered].material.uniforms.uMouse.value.lerp(hitUV, 0.16);
    }
  }

  return { rig, wall, screens, place, update, bindDrag, setEntrance, hydrate, pick,
           hoveredIndex: function () { return hovered; },
           dragged: function () { return dragMoved; },
           state: state, PW, PH, STEP };
}
