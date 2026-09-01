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
    vec2 uv = (vUv - 0.5) * (0.965 + 0.02 * sin(t)) + 0.5;
    uv += vec2(sin(t * 0.7), cos(t * 0.9)) * 0.006;
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
    float bright = mix(0.2, 1.0, smoothstep(0.03, 0.85, vB));
    bright = min(bright + uHover * 0.12, 1.05);
    vec3 col = tex.rgb * bright;
    col *= 1.0 - vPress * 0.14;           // soft shadow inside the press dent
    col *= 1.0 - 0.15 * length(vUv - 0.5);
    gl_FragColor = vec4(col, alpha * uFade);
  }
`;

/* Stand-in artwork. The original draws each project procedurally; these are
   placeholders until real captures exist. */
function placeholderDraw(card) {
  return function (x, w, h) {
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, card.a); g.addColorStop(1, card.b);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,0.13)';
    x.fillRect(w * 0.07, h * 0.12, w * 0.86, h * 0.46);
    x.fillStyle = 'rgba(255,255,255,0.2)';
    for (let r = 0; r < 3; r++) x.fillRect(w * 0.07, h * 0.68 + r * h * 0.075, w * (0.56 - r * 0.13), h * 0.032);
    x.fillStyle = '#fff';
    x.font = '600 ' + Math.round(w * 0.052) + 'px Sora, system-ui, sans-serif';
    x.fillText(card.title, w * 0.07, h * 0.64);
  };
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
  const screens = [];

  cards.forEach(function (card, i) {
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = Math.round(1024 * PH / PW);
    placeholderDraw(card)(cv.getContext('2d'), cv.width, cv.height);
    const tex = new THREE.CanvasTexture(cv);
    if (maxAniso) tex.anisotropy = maxAniso;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

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

    focusWorld.set(FOCUS_LOCAL[0], FOCUS_LOCAL[1], FOCUS_LOCAL[2]).applyMatrix4(wall.matrixWorld);
    /* uAmp and the sigmas are world distances in the shader, so they scale
       with the rig or the dome would be the wrong size for the cards */
    screens.forEach(function (m) {
      m.material.uniforms.uAmp.value = BULGE_AMP * s;
      m.material.uniforms.uSigma.value = BULGE_SIGMA * s;
      m.material.uniforms.uSigmaB.value = BRIGHT_SIGMA * s;
    });
  }

  /* --- motion state (verbatim) --- */
  const state = { scroll: -1.3, mid: -1.3, target: -FOCUS_LOCAL[0] / STEP, vel: 0 };
  const bend = { p: 0, v: 0 };        // spring state for the elastic whip
  let hovered = null, isDragging = false, dragMoved = 0, lastX = 0;
  let throwFrom = 0, throwTo = 0, throwT = 1, throwDur = 1.7;

  const mouse = new THREE.Vector2(-2, -2);
  const raycaster = new THREE.Raycaster();
  const hitUV = new THREE.Vector2(0.5, 0.5);

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
    rig.visible = fade > 0.005;
    if (!rig.visible) return;

    if (throwT < 1) {
      throwT = Math.min(1, throwT + (dtMs / 1000) / throwDur);
      state.target = throwFrom + (throwTo - throwFrom) * expoOut(throwT);
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
    });
    // the press point glides after the cursor -> "pressed on movement"
    if (hovered !== null && hitPoint) {
      hitUV.set(hitPoint.x, hitPoint.y);
      screens[hovered].material.uniforms.uMouse.value.lerp(hitUV, 0.16);
    }
  }

  return { rig, wall, screens, place, update, bindDrag,
           hoveredIndex: function () { return hovered; },
           dragged: function () { return dragMoved; },
           state: state, PW, PH, STEP };
}
