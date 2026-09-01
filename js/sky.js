/*
  Sky Edition — cinematic scroll journey.
  Five states: sunset cloud-sea hero → whiteout cloud-dive (about) → clear
  blue (work deck) → lightning storm (AI) → sunny meadow (contact).
  Scroll drives a smoothed master progress s ∈ [0,4]; camera, sky shader,
  fog, lights and cloud groups all interpolate along it.
*/
import * as THREE from './three.module.min.js';
import { createCardWall } from './card-wall.js';

(function () {
  if (window.__adSkyInit) return; window.__adSkyInit = true;
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INSTANT = REDUCED || location.hash === '#instant'; // no smoothing (reduced motion / screenshot probes)
  window.__adI = INSTANT; // debug/verification hook
  if (INSTANT) { // kills reveal transitions and bypasses the boot hold
    document.documentElement.classList.add('sky-instant');
    document.documentElement.classList.remove('sky-booting');
  } else {
    document.documentElement.classList.add('sky-booting');
  }

  var canvas = document.getElementById('sky-canvas');
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) { canvas.style.display = 'none'; return; }
  // fill-rate is the frame budget here (dozens of overlapping full-screen
  // cloud sprites) — DPR 2 on retina made scrolling stutter
  // ── quality tier ────────────────────────────────────────────────────────
  // Chosen once from coarse device signals: fill-rate is this scene's budget
  // (dozens of overlapping full-screen cloud sprites), so the knobs that
  // matter are pixel ratio and instance counts, not geometry detail.
  var QUALITY = (function () {
    var narrow = Math.min(innerWidth, innerHeight) < 700;
    var coarse = matchMedia('(pointer: coarse)').matches;
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    if ((coarse && narrow) || cores <= 4 || mem <= 3) return 'low';
    if (coarse || cores <= 8 || devicePixelRatio > 2.5) return 'medium';
    return 'high';
  })();
  // Tuft counts are deliberately TINY. A dense instanced field reads as
  // repeated stamps no matter how well it is varied — the field has to come
  // from the terrain's own shading, with a handful of clusters only as
  // occasional punctuation near the camera.
  var Q = {
    high:   { dpr: 2,   tufts: 22, shadow: 1024 },
    medium: { dpr: 1.5, tufts: 16, shadow: 512 },
    low:    { dpr: 1,   tufts: 9,  shadow: 0 }
  }[QUALITY];
  window.__adQ = QUALITY; // verification hook
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.dpr));
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  if ('toneMapping' in renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
  }

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);

  // ── palettes per state: [hero, cloud-dive, blue, storm, meadow] ─────────
  // States: [above the cloud sea, inside the clouds, deep blue sky,
  //          storm night, golden-hour grassland]
  // hero = Cartier-journey sunset: soft teal zenith → cream → golden haze,
  // warm-tinted cloud sea, low sun glow near the horizon
  var P = {
    top: ['#aacfd1', '#a8c4cd', '#1156c9', '#0a3f9e', '#0d1220', '#3d7cb2'].map(c => new THREE.Color(c)),
    mid: ['#f0e2ba', '#f0dcb4', '#4d9fe8', '#5fa3e0', '#1c2434', '#f4cf95'].map(c => new THREE.Color(c)),
    bot: ['#eec092', '#f0c493', '#cfe9fb', '#dceaf7', '#39445a', '#f8bd7d'].map(c => new THREE.Color(c)),
    fogC: ['#edd2a9', '#eed6ab', '#a9cdf0', '#cfe0f2', '#232c3c', '#f2d3a4'].map(c => new THREE.Color(c)),
    // row 4 carries real haze now: exp2 fog is negligible on the near grass
    // (<1% at 50 units) but ~40% on the backdrop ranges at ~380, which is what
    // dissolves them into the sky and sells the distance
    fogD: [0.0015, 0.0026, 0.0012, 0.0016, 0.0045, 0.0018],
    glowC: ['#ffc998', '#ffce9c', '#ffbe92', '#cfe4f7', '#28324a', '#ffb469'].map(c => new THREE.Color(c)),
    glowI: [1.0, 0.75, 0.62, 0, 0.08, 1.05],
    starsOp: [0, 0, 0, 0, 0.85, 0],
    // hemi/dir only reach LIT meshes (mountains, airships, meadow) — clouds
    // are unlit sprites, so these can run hot to keep the snow white
    // row 4 trades hemi for dir: golden hour is a LOW, directional, warm key
    // with little ambient fill, which is what separates it from a flat noon
    hemiI: [1.25, 1.2, 1.5, 1.08, 0.38, 1.02],
    dirI: [1.5, 1.45, 1.8, 1.7, 0.22, 1.9],
    dirC: ['#ffcf9c', '#ffd2a0', '#ffddb6', '#eaf2fb', '#9fb2d8', '#ffc27e'].map(c => new THREE.Color(c)),
    // hemisphere GROUND colour — the bounce coming back up off the terrain.
    // Cool grey everywhere the sky is cool; warm earth under the golden hour,
    // so the grass is lit warm from below as well as from the sun.
    hemiG: ['#b9c4cf', '#b9c4cf', '#b9c4cf', '#b9c4cf', '#b9c4cf', '#c88b4c'].map(c => new THREE.Color(c)),
    // hemisphere SKY colour, and the reason the meadow reads warm at all: the
    // one DirectionalLight is shared by all five states and runs nearly
    // parallel to the meadow floor (dot with the ground normal ≈0.16), so an
    // up-facing surface takes almost its whole value from this term. Warming
    // dirC alone left the grass noon-green — this is the lever that works.
    hemiS: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffd2a0'].map(c => new THREE.Color(c)),
    deckOp: [0.38, 0.45, 0, 0.3, 0, 0.12], // hero shows only a few crisp tops through the soft sea
    deck2Op: [0, 0, 0.5, 0.2, 0.35, 0],    // forward cloud band under the work/storm legs
    deckC: ['#f6e2c4', '#f7e0bd', '#ffffff', '#ffffff', '#333b4d', '#ffffff'].map(c => new THREE.Color(c)),
    seaOp: [1, 0.45, 0, 0, 0, 0],      // hero fog-sea: stays below the camera on the approach
    stormOp: [0, 0, 0, 0, 0.55, 0],
    sunnyOp: [0, 0, 0, 0, 0, 0.55],
    sunOp: [0, 0, 0, 0, 0, 0.72], // dimmed: a light source, not the hero graphic
    sun2Op: [0, 0, 0.9, 0, 0, 0],  // the work scene's low red sunset sun
    groundOp: [0, 0, 0, 0, 0, 1], // meadow hidden until the final descent
    heroPkOp: [1, 1, 0, 0, 0, 0],      // hero summit; scene 1 flies in close to it
    peaksOp: [0, 0, 0.85, 0, 0, 0],    // work scene: the wider snowy ranges
    heroBalOp: [0.92, 0, 0, 0, 0, 0],  // hero: a single drifting airship
    balOp: [0, 0, 0.85, 0, 0, 0],      // work scene: the other two
    birdOp: [0.7, 0, 0.8, 0, 0, 0], // needs to run high — silhouettes wash out over white clouds
    jetOp: [0, 0, 0.9, 0, 0, 0.85], // distant airliner + contrail: work sky and meadow finale
    sparkOp: [0, 0, 0, 0, 0.9, 0],     // firefly lights in the night leg
    roll: [0.035, -0.05, 0.075, -0.06, -0.09] // banking per transition
  };

  // camera keyframes (pos, look) per state:
  // skim the cloud sea → sink into it → burst above into clear blue →
  // storm ceiling → dive and flare out over the grassland
  var K = [
    { p: [0, 61, 12], l: [0, 67, -75] }, // hero looks slightly UP, per the reference framing
    { p: [12, 58, -142], l: [34, 54, -228] }, // approach: skimming right past the summit, still in the sky
    // z always decreases scene to scene so every transition flies FORWARD —
    // the climb over the summit connects the approach to the open work sky
    { p: [20, 124, -300], l: [20, 146, -400] }, // work: high up, pitched into open blue (ridge ≈ bottom fifth)
    // cloudline: the pitch comes down off the open blue to a level horizon, so
    // the low sun and the cloud deck it lights both sit in frame. Still flying
    // forward — z keeps decreasing — and drifting right toward the sun.
    { p: [24, 104, -336], l: [26, 112, -424] },
    { p: [30, 106, -370], l: [78, 96, -455] },
    { p: [60, 4.5, -510], l: [60, 9, -587] }
  ].map(k => ({ p: new THREE.Vector3().fromArray(k.p), l: new THREE.Vector3().fromArray(k.l) }));

  /* ── the card wall on the cloudline leg ──────────────────────────────────
     Placed 62 units down K[3]'s own sight line and turned to face it: lookAt
     aims local +z at the target and the wall's front IS +z, so one call does
     the orientation. Scale is set so a card stands at about 55% of frame
     height, which is the proportion measured off the reference (58% there, in
     a wider frame than this one). */
  var WALL_CARDS = [
    /* PLACEHOLDER content — titles and colours are stand-ins. */
    { title: 'Card one',   a: '#3f6fd8', b: '#16326f' },
    { title: 'Card two',   a: '#d8683f', b: '#7a2718' },
    { title: 'Card three', a: '#3fb0a0', b: '#124742' },
    { title: 'Card four',  a: '#8a6bd8', b: '#33246c' },
    { title: 'Card five',  a: '#d8a83f', b: '#7a5312' },
    { title: 'Card six',   a: '#c85a8a', b: '#5e1a3a' }
  ];
  var wall = createCardWall(THREE, WALL_CARDS);
  /* Sized against the reference: its centre card is 46% of frame width and
     55% of height, with THREE cards spanning the viewport and the outer two
     running off the edges. Small cards packed five across was the wrong read —
     edge to edge means the cards are big enough to reach the edges, not that
     more of them fit. */
  var wallDist = 62, wallScale = 16.5;
  (function placeWall() {
    var camP = K[3].p;
    var dir = K[3].l.clone().sub(camP).normalize();
    wall.group.position.copy(camP).addScaledVector(dir, wallDist);
    wall.group.position.y -= 10;              // low enough to clear the line of copy
    wall.group.scale.setScalar(wallScale);
    wall.group.lookAt(camP);
    wall.group.visible = false;
    window.__wall = wall;   // debug/verification hook, like __adS
    scene.add(wall.group);

    var host = document.querySelector('#s-cloudline .stage');
    if (host) {
      host.appendChild(wall.layer);
      /* one wall unit spans this many screen pixels, so a drag of N pixels
         moves the wall by the distance under the cursor */
      wall.bindDrag(host, function () {
        var vFov = camera.fov * Math.PI / 180;
        var worldPerPx = 2 * Math.tan(vFov / 2) * wallDist / innerHeight;
        return worldPerPx / wallScale;
      });
    }
  })();

  /* the dent follows the cursor: intersect the pointer ray with the wall's own
     plane, then convert the hit into wall units (worldToLocal undoes scale) */
  var wRay = new THREE.Raycaster(), wPlane = new THREE.Plane();
  var wNrm = new THREE.Vector3(), wHit = new THREE.Vector3();
  var wPtr = new THREE.Vector2(), wPtrLive = false;
  addEventListener('pointermove', function (e) {
    wPtr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1));
    wPtrLive = true;
  }, { passive: true });
  addEventListener('pointerleave', function () { wPtrLive = false; }, { passive: true });

  function wallPress() {
    if (!wPtrLive || !wall.group.visible) return null;
    wall.group.getWorldDirection(wNrm);
    wPlane.setFromNormalAndCoplanarPoint(wNrm, wall.group.position);
    wRay.setFromCamera(wPtr, camera);
    if (!wRay.ray.intersectPlane(wPlane, wHit)) return null;
    return wall.group.worldToLocal(wHit);
  }

  // ── sky dome (custom gradient shader, follows the camera) ──────────────
  var skyUni = {
    uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() },
    uBot: { value: new THREE.Color() }, uFlash: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 0.3, -1) },
    uGlowC: { value: new THREE.Color() }, uGlowI: { value: 0 }
  };
  var dome = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: skyUni, side: THREE.BackSide, depthWrite: false,
      vertexShader:
        'varying vec3 vDir; void main(){ vDir = position;' +
        ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; uniform float uFlash;' +
        'uniform vec3 uSunDir; uniform vec3 uGlowC; uniform float uGlowI;' +
        'varying vec3 vDir;' +
        'void main(){ vec3 d = normalize(vDir); float h = d.y;' +
        ' vec3 col = h > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.55, h))' +
        '                    : mix(uMid, uBot, smoothstep(0.0, 0.35, -h));' +
        // atmospheric glow around the sun: tight core + wide soft halo
        ' float sd = max(dot(d, uSunDir), 0.0);' +
        // tight core, narrow halo — wide halos cream over the sky gradient
        ' col += uGlowC * uGlowI * (pow(sd, 26.0) * 0.9 + pow(sd, 9.0) * 0.16);' +
        ' col = mix(col, vec3(1.0), uFlash);' +
        // linear → sRGB so the palette hexes land on screen as authored
        ' col = pow(max(col, 0.0), vec3(0.4545));' +
        // blue-noise-ish dither kills gradient banding on large flat skies
        ' col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 160.0;' +
        ' gl_FragColor = vec4(col, 1.0); }'
    })
  );
  dome.renderOrder = -1;
  scene.add(dome);

  scene.fog = new THREE.FogExp2(0xc3cdd6, 0.01);

  var hemi = new THREE.HemisphereLight(0xffffff, 0xb9c4cf, 0.9); scene.add(hemi);
  // keyed to the sun sprite's position: terrain ahead of the camera is
  // backlit (shadowed faces toward us) like the low-sun reference look
  var dir = new THREE.DirectionalLight(0xffffff, 0.6); dir.position.set(125, 80, -470); scene.add(dir);

  // ── cloud sprites ───────────────────────────────────────────────────────
  // Wide cumulus texture: sunlit puff tops, shaded blue-grey underbellies,
  // flattened base — reads as a real cloud instead of a soft blob.
  function cloudTexture() {
    var c = document.createElement('canvas'); c.width = 1536; c.height = 768;
    var g = c.getContext('2d');
    var baseY = 510, major = [], all = [], i, j, p, rad;
    for (i = 0; i < 20; i++) {
      var px = 180 + Math.random() * 1176;
      var mid = 1 - Math.abs(px - 768) / 768; // dome profile: tallest mid-cloud
      var pr = (50 + Math.random() * 92) * (0.58 + mid * 0.72);
      major.push([px, baseY - pr * (0.28 + Math.random() * 0.58), pr]);
    }
    // billowy silhouette: ring every major puff with smaller cauliflower
    // lobes along its upper rim
    for (i = 0; i < major.length; i++) {
      p = major[i]; all.push(p);
      var n = 7 + Math.floor(Math.random() * 5);
      for (j = 0; j < n; j++) {
        var a = Math.PI * (0.08 + Math.random() * 0.84);
        all.push([
          p[0] + Math.cos(a) * p[2] * (0.55 + Math.random() * 0.45),
          p[1] - Math.sin(a) * p[2] * (0.45 + Math.random() * 0.4),
          p[2] * (0.26 + Math.random() * 0.3)
        ]);
      }
      // warm lit fringe puffs that catch sunrise on the upper edge
      if (Math.random() > 0.35) {
        all.push([p[0] - p[2] * 0.45, p[1] - p[2] * 0.42, p[2] * 0.34, 1]);
        all.push([p[0] + p[2] * 0.42, p[1] - p[2] * 0.36, p[2] * 0.28, 1]);
      }
    }
    // solid cores with a short falloff — defined edges, not soft blobs
    for (i = 0; i < all.length; i++) {
      p = all[i];
      rad = g.createRadialGradient(p[0] - p[2] * 0.12, p[1] - p[2] * 0.22, p[2] * 0.1, p[0], p[1], p[2]);
      rad.addColorStop(0, p[3] ? 'rgba(255,237,210,0.98)' : 'rgba(255,255,255,1)');
      rad.addColorStop(0.52, p[3] ? 'rgba(255,244,224,0.82)' : 'rgba(253,254,255,0.94)');
      rad.addColorStop(0.82, 'rgba(250,252,255,0.43)');
      rad.addColorStop(1, 'rgba(250,252,255,0)');
      g.fillStyle = rad;
      g.fillRect(p[0] - p[2], p[1] - p[2], p[2] * 2, p[2] * 2);
    }
    // high-altitude wisps add scale and prevent a stamped-sprite look
    g.globalCompositeOperation = 'lighter';
    for (i = 0; i < 18; i++) {
      var wy = 140 + Math.random() * 250;
      var wx = 80 + Math.random() * 1376;
      var ww = 180 + Math.random() * 360;
      var wh = 16 + Math.random() * 42;
      rad = g.createRadialGradient(wx, wy, 0, wx, wy, ww * 0.55);
      rad.addColorStop(0, 'rgba(255,255,255,0.28)');
      rad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rad;
      g.beginPath(); g.ellipse(wx, wy, ww, wh, (Math.random() - 0.5) * 0.18, 0, Math.PI * 2); g.fill();
    }
    // shade the lower interior only (source-atop keeps the silhouette crisp).
    // Kept very light — heavier grey reads as storm clouds.
    g.globalCompositeOperation = 'source-atop';
    for (i = 0; i < major.length; i++) {
      p = major[i];
      rad = g.createRadialGradient(p[0], p[1] + p[2] * 0.45, p[2] * 0.12, p[0], p[1] + p[2] * 0.45, p[2] * 1.05);
      rad.addColorStop(0, 'rgba(154,170,190,0.34)');
      rad.addColorStop(0.62, 'rgba(198,210,226,0.16)');
      rad.addColorStop(1, 'rgba(206,216,230,0)');
      g.fillStyle = rad;
      g.fillRect(p[0] - p[2] * 1.1, p[1] - p[2] * 0.4, p[2] * 2.2, p[2] * 1.6);
    }
    // subtle sunlit rim from the upper-right
    var rim = g.createLinearGradient(0, 0, 1536, 260);
    rim.addColorStop(0, 'rgba(255,255,255,0)');
    rim.addColorStop(0.72, 'rgba(255,226,190,0.18)');
    rim.addColorStop(1, 'rgba(255,246,225,0.32)');
    g.fillStyle = rim; g.fillRect(0, 0, 1536, 768);
    // flatten the base like a real cumulus deck
    g.globalCompositeOperation = 'destination-out';
    var fade = g.createLinearGradient(0, baseY + 10, 0, 768);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(0.35, 'rgba(0,0,0,0.6)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = fade; g.fillRect(0, baseY + 10, 1536, 768 - baseY - 10);
    g.globalCompositeOperation = 'source-over';
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true; return t;
  }
  var cloudTexs = [cloudTexture(), cloudTexture(), cloudTexture()];
  function cloudGroup(n, bounds, sMin, sMax, texs) {
    var grp = new THREE.Group();
    var tx = texs || cloudTexs;
    for (var i = 0; i < n; i++) {
      var m = new THREE.SpriteMaterial({ map: tx[i % tx.length], transparent: true, depthWrite: false, opacity: 0 });
      var sp = new THREE.Sprite(m);
      sp.position.set(
        bounds.x[0] + Math.random() * (bounds.x[1] - bounds.x[0]),
        bounds.y[0] + Math.random() * (bounds.y[1] - bounds.y[0]),
        bounds.z[0] + Math.random() * (bounds.z[1] - bounds.z[0]));
      var s = sMin + Math.random() * (sMax - sMin);
      sp.scale.set(s, s * 0.5, 1);
      sp.userData = { base: 0.68 + Math.random() * 0.32, vx: 0.4 + Math.random() * 0.9 };
      grp.add(sp);
    }
    scene.add(grp); return grp;
  }
  // the main deck: dense enough that overlapping sprites fuse into a
  // continuous sea of cloud the camera skims, sinks into, then rises above
  var deck = cloudGroup(102, { x: [-210, 210], y: [12, 50], z: [-260, 40] }, 50, 130);
  // second band further down the flight path — the floor under the work and
  // storm legs now that the camera keeps flying forward instead of doubling back
  var deck2 = cloudGroup(84, { x: [-190, 240], y: [42, 82], z: [-620, -290] }, 50, 130);
  // storm ceiling over the AI leg of the journey (built in place, then the
  // whole leg is shifted forward along the flight path). Soft-blob textures,
  // not the crisp cauliflower ones — crisp sprites read as separate puffs;
  // the storm should fuse into one continuous churning mass
  var stormTexs = [softCloudTexture(), softCloudTexture(), null]; // null → crisp, set below
  var storm = cloudGroup(48, { x: [-40, 160], y: [64, 112], z: [-80, -330] }, 80, 160, stormTexs);
  for (var si = 0; si < storm.children.length; si++) {
    var ss = storm.children[si];
    // every third sprite keeps a crisp cauliflower map: readable billows
    // riding inside the fused soft mass
    var crisp = !ss.material.map;
    if (crisp) ss.material.map = cloudTexs[si % 3];
    // graded tint, height-keyed: near-black underside, lighter up high.
    // Crisp billows run a brighter slate band than the soft filler so the
    // ceiling reads as churning structure, not one flat wall
    var gy = Math.min(1, Math.max(0, (ss.position.y - 64) / 48));
    ss.userData.sc = crisp
      ? new THREE.Color().lerpColors(new THREE.Color(0x2b3652), new THREE.Color(0x4d5d84), gy)
      : new THREE.Color().lerpColors(new THREE.Color(0x101724), new THREE.Color(0x28334c), gy);
  }
  storm.position.set(0, 24, -220);
  // friendly puffs over the meadow
  // five, not nine, and spread wider: the sun needs clean sky around it and
  // the composition needs large areas of empty blue to breathe
  var sunny = cloudGroup(5, { x: [-10, 130], y: [46, 80], z: [-330, -460] }, 30, 54);
  sunny.position.z = -252;

  // ── hero fog-sea: huge fully-soft sprites that FUSE into one continuous
  // dusky cloud blanket (the crisp cauliflower deck reads as separate puffs;
  // the reference hero is a dense out-of-focus sea)
  function softCloudTexture() {
    var c = document.createElement('canvas'); c.width = 768; c.height = 384;
    var g = c.getContext('2d');
    for (var i = 0; i < 18; i++) {
      var px = 110 + Math.random() * 548, py = 150 + Math.random() * 138;
      var pr = 78 + Math.random() * 118;
      var rad = g.createRadialGradient(px, py - 14, 0, px, py, pr);
      rad.addColorStop(0, 'rgba(255,255,255,0.85)');
      rad.addColorStop(0.55, 'rgba(255,255,255,0.38)');
      rad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rad;
      g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }
    var glow = g.createLinearGradient(0, 0, 768, 90);
    glow.addColorStop(0, 'rgba(255,255,255,0)');
    glow.addColorStop(1, 'rgba(255,228,196,0.2)');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = glow; g.fillRect(0, 0, 768, 384);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true; return t;
  }
  var seaTexs = [softCloudTexture(), softCloudTexture()];
  var seaTopC = new THREE.Color('#f8e7ca'), seaBotC = new THREE.Color('#bb9179');
  var sea = new THREE.Group();
  for (var qi = 0; qi < 86; qi++) {
    var qm = new THREE.SpriteMaterial({ map: seaTexs[qi % 2], transparent: true, depthWrite: false, opacity: 0 });
    var qs = new THREE.Sprite(qm);
    var qy = -4 + Math.random() * 32; // tops stay below ~60 so the summit always clears
    qs.position.set(-260 + Math.random() * 520, qy, -320 + Math.random() * 360);
    var qsc = 84 + Math.random() * 118;
    qs.scale.set(qsc, qsc * 0.34, 1);
    // sunset grading: cream near the horizon line, dusky rose in the depths
    var qc = new THREE.Color().lerpColors(seaBotC, seaTopC, Math.min(1, Math.max(0, (qy + 2) / 42)));
    qs.userData = { base: 0.5 + Math.random() * 0.4, vx: 0.3 + Math.random() * 0.6, c: qc };
    sea.add(qs);
  }
  scene.add(sea);

  // ── meadow: grass, flowers, sun ─────────────────────────────────────────
  function grassTexture() {
    // Illustrated meadow, NOT a photographic lawn: a muted sage/olive base
    // carrying broad soft tonal drifts. The blades exist only to break up the
    // gradient at close range — at the old 7000 × 0.25–0.6 alpha they read as
    // streaky brush strokes across the whole field, which is the single
    // loudest "this is a textured plane" tell. Keep them faint.
    var c = document.createElement('canvas'); c.width = c.height = 1024;
    var g = c.getContext('2d');
    var bg = g.createLinearGradient(0, 0, 1024, 1024);
    bg.addColorStop(0, '#8fb069');
    bg.addColorStop(0.5, '#7ba055');
    bg.addColorStop(1, '#688c47');
    g.fillStyle = bg; g.fillRect(0, 0, 1024, 1024);
    // narrow value spread — neighbouring tones, so patches read as light
    // falling across the field rather than as different-coloured blotches
    var shades = ['#7ea15a', '#88a962', '#94b46d', '#71964f', '#9dbb78', '#829e5b'];
    var i, x, y;
    for (i = 0; i < 260; i++) { // broad soft drifts (big + very low alpha)
      g.fillStyle = shades[Math.floor(Math.random() * shades.length)];
      g.globalAlpha = 0.05 + Math.random() * 0.07;
      g.beginPath();
      g.ellipse(Math.random() * 1024, Math.random() * 1024,
        90 + Math.random() * 190, 70 + Math.random() * 150, Math.random() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    for (i = 0; i < 2400; i++) { // faint blades, all leaning the same way
      x = Math.random() * 1024; y = Math.random() * 1024;
      g.strokeStyle = shades[Math.floor(Math.random() * shades.length)];
      g.globalAlpha = 0.07 + Math.random() * 0.11;
      g.lineWidth = 0.6 + Math.random() * 0.8;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(
        x + 1.5 + (Math.random() - 0.5) * 2, y - 4 - Math.random() * 5,
        x + 3 + (Math.random() - 0.5) * 4, y - 6 - Math.random() * 8);
      g.stroke();
    }
    for (i = 0; i < 30; i++) { // sparse warm specks — distant flower heads
      x = Math.random() * 1024; y = Math.random() * 1024;
      g.globalAlpha = 0.28 + Math.random() * 0.2;
      g.fillStyle = ['#e8c66a', '#dcb44e', '#efd792'][Math.floor(Math.random() * 3)];
      g.beginPath(); g.arc(x, y, 1 + Math.random() * 1.4, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 7);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true; return t;
  }
  // ── GPU vegetation ──────────────────────────────────────────────────────
  // One InstancedMesh per species: a single geometry, a single material, and
  // ALL per-blade work (billboarding + wind) done in the vertex shader. The
  // frame loop touches one time uniform and one opacity — it never iterates
  // instances. This replaces a bank of individual sprites each carrying its
  // own material, which is the pattern that doesn't scale past a few dozen.
  var vegTime = { value: 0 };
  function vegetation(tex, count, dbl) {
    var geo = new THREE.PlaneGeometry(1, 1, 1, 4);
    geo.translate(0, 0.5, 0); // pivot at the stem base, so sway bends from the ground
    // Point every normal UP rather than at the camera. A billboarded quad's
    // own normal faces the viewer, which here aims almost straight at the sun
    // and blows the albedo out to white under the meadow's hot hemi+dir. Up
    // normals make vegetation shade like the terrain it grows from — the
    // tones then sit in the same family as the ground instead of glowing.
    var nrm = geo.attributes.normal;
    for (var ni = 0; ni < nrm.count; ni++) nrm.setXYZ(ni, 0, 1, 0);
    nrm.needsUpdate = true;
    var mat = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, alphaTest: 0.22, roughness: 1, metalness: 0,
      side: dbl ? THREE.DoubleSide : THREE.FrontSide, opacity: 0
    });
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = vegTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          'vec3 iOrigin = instanceMatrix[3].xyz;',
          // two detuned frequencies + a phase from world position: the field
          // never waves in unison, which is the tell of a single sine
          'float ph = iOrigin.x * 0.11 + iOrigin.z * 0.07;',
          'float sway = sin(uTime * 0.62 + ph) * 0.06 + sin(uTime * 1.13 + ph * 1.9) * 0.03;',
          // quadratic in height → the blade BENDS from its base instead of sliding
          'float vh = max(position.y, 0.0); vh *= vh;',
          'transformed.x += sway * vh;',
          'transformed.z += sway * 0.4 * vh;'
        ].join('\n'))
        // view-aligned billboard: build the quad in view space around the
        // instance origin, so it faces the camera from any scroll position
        .replace('#include <project_vertex>', [
          'vec4 mvPosition = vec4( transformed, 1.0 );',
          '#ifdef USE_INSTANCING',
          '  float sX = length(instanceMatrix[0].xyz);',
          '  float sY = length(instanceMatrix[1].xyz);',
          '  vec4 cMV = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);',
          '  mvPosition = cMV + vec4(transformed.x * sX, transformed.y * sY, 0.0, 0.0);',
          '#else',
          '  mvPosition = modelViewMatrix * mvPosition;',
          '#endif',
          'gl_Position = projectionMatrix * mvPosition;'
        ].join('\n'));
    };
    var m = new THREE.InstancedMesh(geo, mat, count);
    m.frustumCulled = false; // billboarding moves verts off the CPU-side bounds
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
    return m;
  }
  // A low, wide clump — ground COVER, not a plant. Tuned against a first pass
  // that used dark saturated blades on a tall quad: each tuft then read as a
  // separate spiky object sitting on the grass. What makes it read as field is
  // (a) tones pulled close to the terrain's own palette, (b) a silhouette
  // wider than it is tall, and (c) low contrast between blades.
  function tuftTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    var n = 13 + Math.floor(Math.random() * 6);
    for (var i = 0; i < n; i++) {
      var bx = 64 + (Math.random() - 0.5) * 88;      // wider spread
      var lean = (bx - 64) * 0.5 + (Math.random() - 0.5) * 22;
      var top = 44 + Math.random() * 40;             // shorter blades
      var w = 3.4 + Math.random() * 3.4;             // broader, softer
      // Authored DARK on purpose. The meadow's hemi runs at 1.45 with a white
      // sky colour and these quads have up-facing normals, so they receive the
      // full hemisphere term — mid-green here renders near-white. These hexes
      // are what land in the terrain's tonal range once lit.
      var lg = g.createLinearGradient(0, 128, 0, top);
      // Verified values — do not "correct" these toward the terrain's hexes.
      // Up-facing normals + hemi 1.45 (white) + dir 1.55 give vegetation ~3×
      // light, so anything authored at the terrain's own tone renders washed
      // out. These land in range once lit.
      lg.addColorStop(0, '#3d5a28');
      lg.addColorStop(1, '#65834a');
      // Blades are drawn OPAQUE. Filling them with globalAlpha onto a
      // transparent canvas produced washed-out near-white marks once uploaded
      // and lit — the silhouette has to come from the blade shapes, not from
      // partial alpha. (The flower map, drawn opaque, never had this.)
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(bx - w, 128);
      g.quadraticCurveTo(bx - w * 0.3 + lean * 0.5, (128 + top) * 0.5, bx + lean, top);
      g.quadraticCurveTo(bx + w * 0.3 + lean * 0.5, (128 + top) * 0.5, bx + w, 128);
      g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
  }

  // Terrain as COMPOSITION, not noise. Three hand-placed forms only:
  // a broad valley whose sides rise (a funnel carrying the eye down the middle
  // toward the windmill and the ranges), and two large asymmetric swells set
  // by hand left and right. The final term is a very low-frequency roll purely
  // to keep the horizon from reading as a ruled line — there is deliberately
  // no high-frequency noise anywhere, because that is what made the old
  // surface read as "procedural terrain" instead of a designed landscape.
  // Local space: lx = worldX − 60, ly = −worldZ − 582 (ly grows into the scene;
  // the camera sits at about ly = −72).
  function meadowH(lx, ly) {
    // Relief DEVELOPS WITH DISTANCE. The camera stands at eye height 4.5 in
    // this field, so any form built at its feet either clips the lens or rises
    // above the horizon and swallows the scene — an earlier pass did exactly
    // that and pushed the foreground flowers up onto the skyline. Ground is
    // level where the viewer stands and gains shape as it recedes, which is
    // also simply how a meadow reads from standing height. Foreground interest
    // is the job of the flowers, not of terrain under the lens.
    var d = Math.min(1, Math.max(0, (ly + 66) / 130));
    // valley walls: the eye is carried down the low middle toward the windmill
    // held down deliberately: taller walls swallowed the mountain layers, and
    // the ranges are what carry the depth — terrain must frame them, not hide them
    var valley = Math.pow(Math.min(Math.abs(lx), 200) / 200, 2) * 17;
    var hillA = Math.exp(-(Math.pow((lx + 132) / 100, 2) + Math.pow((ly - 78) / 125, 2))) * 13;
    var hillB = Math.exp(-(Math.pow((lx - 150) / 115, 2) + Math.pow((ly - 26) / 105, 2))) * 9.5;
    var roll = Math.sin(lx * 0.015 + 1.2) * 2.4 + Math.cos(ly * 0.012 - 0.4) * 2.0;
    return (valley + hillA + hillB + roll) * d;
  }
  // more segments: the broad curves need them to stay smooth in silhouette
  var groundGeo = new THREE.PlaneGeometry(520, 520, 96, 96);
  var gPos = groundGeo.attributes.position;
  // Depth by COLOUR, not by geometry: the field runs from a richer, more
  // saturated green underfoot to a muted olive as it recedes, so the terrain
  // itself carries the foreground→midground→distance ladder. One uniform green
  // over the whole plane is what made it read as a painted sheet.
  var gCol = new Float32Array(gPos.count * 3);
  var cNear = new THREE.Color(0.84, 0.97, 0.70);
  var cFar = new THREE.Color(1.0, 0.99, 0.88);
  var gTmp = new THREE.Color();
  for (var gi = 0; gi < gPos.count; gi++) {
    var gx = gPos.getX(gi), gy = gPos.getY(gi);
    gPos.setZ(gi, meadowH(gx, gy));
    gTmp.copy(cNear).lerp(cFar, Math.min(1, Math.max(0, (gy + 70) / 250)));
    gCol[gi * 3] = gTmp.r; gCol[gi * 3 + 1] = gTmp.g; gCol[gi * 3 + 2] = gTmp.b;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
  groundGeo.computeVertexNormals();
  var ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({
      map: grassTexture(), vertexColors: true, roughness: 1, transparent: true, opacity: 0
    }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(60, 0, -582);
  scene.add(ground);

  // Vegetation layer: grass tufts sitting ON the terrain rather than painted
  // into it, so the field has real silhouette against the horizon. Density is
  // biased hard toward the camera (cubic) — foreground reads as detail, the
  // midground thins out, the distance stays clean texture.
  var tufts = vegetation(tuftTexture(), Q.tufts, true);
  var tuftRows = [];
  (function () {
    var mtx = new THREE.Matrix4(), q = new THREE.Quaternion();
    var pos = new THREE.Vector3(), scl = new THREE.Vector3();
    var col = new THREE.Color();
    // Patchy, not evenly sown. A uniform scatter reads as a procedural fill;
    // real ground cover grows in drifts with bare earth between them.
    var patches = [];
    for (var pc = 0; pc < 15; pc++) {
      patches.push({
        u: Math.random() * 2 - 1,
        dz: 72 - Math.pow(Math.random(), 1.5) * 120,
        w: 0.16 + Math.random() * 0.3
      });
    }
    for (var t = 0; t < Q.tufts; t++) {
      var pk = patches[(Math.random() * patches.length) | 0];
      // heavy bias toward the camera: foreground reads as detail, the far
      // field stays clean terrain (spreading these to the horizon just made
      // the distance noisy and killed the aerial perspective)
      var dz = pk.dz + (Math.random() + Math.random() - 1) * 26;
      dz = Math.max(-50, Math.min(74, dz));
      var spanU = pk.u + (Math.random() + Math.random() - 1) * pk.w;
      // Small and low. At the previous size each clump was legible as its own
      // object, and one legible repeated asset ruins the field no matter how
      // few there are — these should register as texture, never as a stamp.
      var s = 0.34 + Math.random() * 0.4;
      var sxw = s * (1.7 + Math.random() * 0.9);
      tuftRows.push({ u: spanU, dz: dz, sx: sxw, sy: s });
      scl.set(sxw, s, 1);
      pos.set(60 + spanU * 40, meadowH(spanU * 40, -dz) - 0.1, -582 + dz);
      mtx.compose(pos, q, scl);
      tufts.setMatrixAt(t, mtx);
      // tonal drift so the field isn't one flat green
      col.setRGB(0.86 + Math.random() * 0.18, 0.9 + Math.random() * 0.14, 0.82 + Math.random() * 0.16);
      tufts.setColorAt(t, col);
    }
    tufts.instanceMatrix.needsUpdate = true;
    if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  })();
  // tufts span the frustum like the flowers, so they re-resolve on resize
  function placeTufts() {
    var mtx = new THREE.Matrix4(), q = new THREE.Quaternion();
    var pos = new THREE.Vector3(), scl = new THREE.Vector3();
    // A narrow frustum squeezes the same tufts into a fraction of the width,
    // so portrait reads far denser than landscape at identical counts. Thin
    // deterministically (every Nth instance) rather than by count, so the
    // clumping survives — dropping a random subset erodes the patches.
    var keep = camera.aspect < 0.9 ? 3 : 1;
    for (var t = 0; t < tuftRows.length; t++) {
      var r = tuftRows[t];
      var dx = r.u * frustumHalf(r.dz) * 1.15; // slight overscan past the edges
      tufts.getMatrixAt(t, mtx); mtx.decompose(pos, q, scl);
      if (keep > 1 && (t % keep)) { scl.set(0, 0, 0); }
      else if (scl.x === 0) { scl.set(r.sx, r.sy, 1); }
      pos.set(60 + dx, meadowH(dx, -r.dz) - 0.1, -582 + r.dz);
      mtx.compose(pos, q, scl);
      tufts.setMatrixAt(t, mtx);
    }
    tufts.instanceMatrix.needsUpdate = true;
  }

  // small windmill on the meadow's left rise — lit 3D geometry, sails spin
  // slowly in the frame loop. Opacity rides groundOp via millMats.
  var millMats = [];
  function millMat(hex, dbl) {
    var m = new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.9, transparent: true, opacity: 0,
      side: dbl ? THREE.DoubleSide : THREE.FrontSide
    });
    millMats.push(m); return m;
  }
  var mill = new THREE.Group();
  // deeper than the backdrop haze on purpose: as the midground anchor it has
  // to hold a readable silhouette, and the old pale cream dissolved into the
  // ranges behind it. More radial segments soften the shading without
  // meaningfully costing anything at this size.
  var towerM = millMat('#d3bf9b'), trimM = millMat('#543926'), sailM = millMat('#f6efdd', true);
  var tower = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.75, 8.5, 16), towerM);
  tower.position.y = 4.25; mill.add(tower);
  var roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.2, 16), trimM);
  roof.position.y = 9.55; mill.add(roof);
  var millHub = new THREE.Group();
  millHub.position.set(0, 8.8, 1.4); // on the cap face toward the camera
  var nose = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 8), trimM);
  nose.rotation.x = Math.PI / 2; millHub.add(nose);
  for (var wb = 0; wb < 4; wb++) {
    var arm = new THREE.Group();
    var spar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.6, 0.08), trimM);
    spar.position.y = 2.3; arm.add(spar);
    var sail = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 3.1), sailM);
    sail.position.set(0.56, 2.75, 0); arm.add(sail);
    arm.rotation.z = wb * Math.PI / 2;
    millHub.add(arm);
  }
  mill.add(millHub);
  // base y from meadowH at the mill's ground-local coords (see ground mapping)
  // Soft contact shadow, painted rather than shadow-mapped. The scene's single
  // DirectionalLight is shared by all five states and travels almost parallel
  // to the meadow floor (dot with the ground normal ≈ 0.16), so a real shadow
  // map here would cost a pass per frame for a shadow you could barely see —
  // and re-aiming the light to fix that would re-light the other four scenes.
  // A grounded gradient gives the read the brief actually wants: contact.
  (function () {
    var sc = document.createElement('canvas'); sc.width = sc.height = 128;
    var sg = sc.getContext('2d');
    var sr = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
    sr.addColorStop(0, 'rgba(48,62,38,0.44)');
    sr.addColorStop(0.55, 'rgba(48,62,38,0.2)');
    sr.addColorStop(1, 'rgba(48,62,38,0)');
    sg.fillStyle = sr; sg.fillRect(0, 0, 128, 128);
    var st = new THREE.CanvasTexture(sc);
    st.colorSpace = THREE.SRGBColorSpace; st.needsUpdate = true;
    var shadowM = millMat('#ffffff');           // rides groundOp with the mill
    shadowM.map = st; shadowM.transparent = true;
    shadowM.depthWrite = false; shadowM.roughness = 1;
    var shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(9, 6.4), shadowM);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0.4, 0.08, 0.6);  // offset along the light, local to the mill
    mill.add(shadowPlane);
  })();
  mill.position.set(10, meadowH(10 - 60, -(-622) - 582) - 0.3, -622);
  mill.scale.set(1.18, 1.18, 1.18);
  mill.rotation.y = 0.5; // three-quarter view — reads as a mill, not a cross
  scene.add(mill);

  // Sunflower, rebuilt at 256px. The old 128px map was softening badly now
  // that foreground heads render 200px+ tall, and its structure was the giveaway:
  // perfect ellipses on a perfect ring around a flat radial gradient reads as
  // clip art. Real structure — tapered pointed petals with per-petal jitter,
  // a phyllotaxis seed disc, a tapered stem and veined leaves — costs nothing
  // extra at runtime because it is baked once into one texture.
  function sunflowerTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    var R = Math.random;
    var cx = 128, cy = 96;                 // head centre, same proportion as before
    var headR = 25 + R() * 5;
    var petalN = 16 + Math.floor(R() * 5);
    var tilt = (R() - 0.5) * 0.35;         // the whole head leans a little

    // ── stem: tapered, curved, lit down one edge ──
    var stemTop = cy + headR * 0.55;
    g.lineCap = 'round';
    g.strokeStyle = '#2c5a1c'; g.lineWidth = 9;
    g.beginPath(); g.moveTo(cx + 2, stemTop); g.quadraticCurveTo(cx - 7, 180, cx + 1, 255); g.stroke();
    g.strokeStyle = '#3f7527'; g.lineWidth = 5.5;
    g.beginPath(); g.moveTo(cx + 2, stemTop); g.quadraticCurveTo(cx - 7, 180, cx + 1, 255); g.stroke();
    g.strokeStyle = 'rgba(120,170,80,0.5)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx - 1, stemTop + 6); g.quadraticCurveTo(cx - 9, 180, cx - 2, 250); g.stroke();

    // ── leaves: pointed, with a midrib ──
    function leaf(bx, by, len, ang, flip) {
      g.save(); g.translate(bx, by); g.rotate(ang);
      var lg = g.createLinearGradient(0, 0, len * flip, 0);
      lg.addColorStop(0, '#2c5a1c'); lg.addColorStop(1, '#4a842e');
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(len * 0.3 * flip, -len * 0.44, len * 0.8 * flip, -len * 0.28, len * flip, 0);
      g.bezierCurveTo(len * 0.8 * flip, len * 0.28, len * 0.3 * flip, len * 0.44, 0, 0);
      g.fill();
      g.strokeStyle = 'rgba(26,56,16,0.5)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.9 * flip, 0); g.stroke();
      g.restore();
    }
    leaf(cx - 1, 170 + R() * 10, 38 + R() * 10, -0.36, -1);
    leaf(cx + 2, 202 + R() * 10, 32 + R() * 9, 0.32, 1);

    // ── petals: two offset rings, tapered to a point, jittered per petal ──
    function ring(rot, lenMul, colA, colB) {
      for (var i = 0; i < petalN; i++) {
        var a = i / petalN * Math.PI * 2 + rot + (R() - 0.5) * 0.09;
        var len = headR * lenMul * (0.84 + R() * 0.3);
        var wid = headR * 0.34 * (0.78 + R() * 0.44);
        g.save(); g.translate(cx, cy); g.rotate(a + tilt);
        var pg = g.createLinearGradient(0, -headR * 0.5, 0, -headR - len);
        pg.addColorStop(0, colA); pg.addColorStop(1, colB);
        g.fillStyle = pg;
        g.beginPath();
        g.moveTo(0, -headR * 0.5);
        g.quadraticCurveTo(-wid, -headR - len * 0.5, 0, -headR - len);
        g.quadraticCurveTo(wid, -headR - len * 0.5, 0, -headR * 0.5);
        g.fill();
        g.restore();
      }
    }
    ring(Math.PI / petalN, 1.16, '#b8690b', '#e9a723');  // back ring, darker + longer
    ring(0, 1.0, '#d8890f', '#ffcb45');                  // front ring

    // ── seed disc: phyllotaxis, not a flat gradient ──
    // Both stops CONCENTRIC. An offset inner circle makes canvas render the
    // cone outside its start radius as a hard pale crescent across the disc —
    // the highlight has to be a separate clipped pass, not a shifted gradient.
    var dg = g.createRadialGradient(cx, cy, headR * 0.05, cx, cy, headR);
    dg.addColorStop(0, '#5e4019');
    dg.addColorStop(0.6, '#452d12');
    dg.addColorStop(1, '#2c1c0a');
    g.fillStyle = dg; g.beginPath(); g.arc(cx, cy, headR, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.arc(cx, cy, headR, 0, Math.PI * 2); g.clip();
    var hl = g.createRadialGradient(cx - headR * 0.32, cy - headR * 0.34, 0,
                                    cx - headR * 0.32, cy - headR * 0.34, headR * 1.1);
    hl.addColorStop(0, 'rgba(150,112,52,0.5)');
    hl.addColorStop(1, 'rgba(150,112,52,0)');
    g.fillStyle = hl; g.fillRect(cx - headR, cy - headR, headR * 2, headR * 2);
    g.restore();
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var s2 = 0; s2 < 150; s2++) {
      var sr = Math.sqrt(s2 / 150) * headR * 0.9;
      var sa = s2 * golden;
      g.fillStyle = (s2 % 3) ? 'rgba(22,14,5,0.45)' : 'rgba(126,94,44,0.4)';
      g.beginPath();
      g.arc(cx + Math.cos(sa) * sr, cy + Math.sin(sa) * sr, 1.0 + (1 - sr / headR) * 0.8, 0, Math.PI * 2);
      g.fill();
    }
    for (var fl = 0; fl < 34; fl++) { // ring of tiny florets at the disc edge
      var fa = fl / 34 * Math.PI * 2 + tilt;
      g.fillStyle = 'rgba(206,150,38,0.7)';
      g.beginPath();
      g.arc(cx + Math.cos(fa) * headR * 0.88, cy + Math.sin(fa) * headR * 0.88, 1.5, 0, Math.PI * 2);
      g.fill();
    }
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true; return t;
  }
  var fTex = [sunflowerTexture(), sunflowerTexture()];
  // Composed, not scattered. An even spread is the giveaway that something was
  // placed by a loop, so these are hand-set clusters of deliberately uneven
  // density — some tight groups of 7–8, some pairs, and real empty ground
  // between them. Local space is (dx, dz) about the patch centre; +dz runs
  // toward the camera, so depth also drives scale.
  // Staged to FRAME the copy, not fill the frame. The centre corridor is left
  // deliberately empty — the headline and CTAs project there, and flowers
  // drifting behind a button is the one thing that reads as accident. Weight
  // runs left-foreground (heaviest, leading in under the windmill) to a
  // lighter right group, so the eye travels flowers → windmill → sun.
  // Clusters are authored in NORMALISED frustum space: u = −1..1 across the
  // visible width at that depth, not world units. The frustum here is only
  // tan(fov/2)·aspect·distance wide and distance is 72 − dz, so it narrows
  // hard toward the camera AND collapses on portrait mobile (aspect 0.5 is a
  // third of desktop's width). Authoring in world dx meant the composition
  // that framed the copy on desktop fell entirely outside the phone frame.
  // In u-space the same staging holds at every aspect; placeFlowers() below
  // resolves it to world units on init and on resize.
  // Twelve zones, forty-eight flowers — a denser field than the eighteen this
  // replaced, but built the same way: still FRAMING, not decoration.
  // The empty middle is the hard constraint, not the count. u maps essentially
  // 1:1 to screen NDC x (the camera looks straight down −z from x=60), and the
  // headline spans roughly u −0.44..+0.42, so every cluster centre is placed
  // such that centre ± uSpread never crosses |u| = 0.50. Density was added by
  // pushing OUTWARD and adding depth ranks — an inner rank toward the copy is
  // what would break it.
  var CLUSTERS = [ // [u, dz, count, uSpread]
    [-0.86,  60, 6, 0.15], [ 0.88,  57, 6, 0.15], // foreground — the hero flowers
    [-0.66,  46, 4, 0.12], [ 0.70,  43, 4, 0.12], // foreground, second rank
    [-0.80,  14, 5, 0.14], [ 0.82,   9, 5, 0.14], // midground
    [-0.64,  -8, 3, 0.11], [ 0.66, -14, 3, 0.11], // midground, inner edge
    [-0.72, -42, 4, 0.11], [ 0.68, -50, 4, 0.11], // background accents
    [-0.58, -66, 2, 0.08], [ 0.60, -72, 2, 0.08]  // furthest specks
  ];
  // half the visible width at a given flower depth, for the current aspect
  function frustumHalf(fdz) {
    return Math.tan(27.5 * Math.PI / 180) * camera.aspect * Math.max(6, 72 - fdz);
  }
  // Composition is stored as plain data; the GPU gets it as instance matrices.
  // This replaced one Sprite + one SpriteMaterial PER FLOWER — 57 materials
  // and 57 per-frame CPU writes — with two draw calls and two opacity writes.
  var FDATA = [];
  function addFlower(u, fdz) {
    // graded by depth: foreground heads read as detail, far ones as accents
    // steeper grade than before: foreground heads read as real objects you
    // could reach, far ones as specks. Scale is what sells distance here.
    var near = Math.min(1, Math.max(0, (fdz + 80) / 140));
    FDATA.push({
      u: u, dz: fdz,
      s: 0.7 + Math.pow(near, 1.5) * 2.9 + Math.random() * 0.35,
      // near-white tint drift — no two heads read exactly alike, but the
      // sunflower stays a sunflower (a saturated tint would recolour the map)
      r: 0.93 + Math.random() * 0.07,
      g: 0.93 + Math.random() * 0.07,
      b: 0.87 + Math.random() * 0.13
    });
  }
  for (var ci = 0; ci < CLUSTERS.length; ci++) {
    var cl = CLUSTERS[ci];
    for (var cj = 0; cj < cl[2]; cj++) {
      // gaussian-ish falloff from the cluster centre, so groups have a dense
      // core and a few outliers rather than a hard disc edge
      var ca = Math.random() * Math.PI * 2;
      var cr = (Math.random() + Math.random()) * 0.5 * cl[3];
      addFlower(cl[0] + Math.cos(ca) * cr, cl[1] + Math.sin(ca) * cr * 44);
    }
  }
  // (no stray scatter — strays were what made the zones read as a distribution
  // rather than as placed groups)
  // split across two meshes so two flower variants survive instancing
  var fGroups = [[], []];
  for (var fd = 0; fd < FDATA.length; fd++) fGroups[fd % 2].push(FDATA[fd]);
  var flowerMeshes = [
    vegetation(fTex[0], fGroups[0].length, true),
    vegetation(fTex[1], fGroups[1].length, true)
  ];
  // scratch objects reused across every call — no allocation per instance
  var fMtx = new THREE.Matrix4(), fQuat = new THREE.Quaternion();
  var fPos = new THREE.Vector3(), fScl = new THREE.Vector3(), fCol = new THREE.Color();
  // resolve u-space → world for the current aspect, and thin on portrait
  function placeFlowers() {
    var sMul = Math.min(1, 0.58 + camera.aspect * 0.26);
    // Which flowers can sit beside the copy is an ASPECT question, because the
    // copy is a DOM overlay in screen space while the flowers are in the scene.
    // On desktop the headline clears |u|≈0.44 and every cluster sits outside it.
    // On a phone the same headline wraps and runs nearly edge to edge, so no
    // horizontal corridor exists at all — and it is the FAR ranks that break,
    // because small distant flowers project up onto the horizon line, exactly
    // where the headline and buttons are. The foreground ranks are safe there:
    // they are big and low in frame, below the CTAs.
    // So portrait keeps the near ranks and drops the rest, and pushes what is
    // left out to the frame edges. (An earlier cull did the opposite — it
    // dropped the NEAR rank — and deleted the whole foreground on phones.)
    var portrait = camera.aspect < 0.95;
    for (var fm2 = 0; fm2 < 2; fm2++) {
      var mesh = flowerMeshes[fm2], grp = fGroups[fm2];
      for (var gi2 = 0; gi2 < grp.length; gi2++) {
        var d = grp[gi2];
        var s = d.s * sMul;
        var u = d.u;
        if (portrait) {
          // dz > 30 is the two foreground ranks; everything behind that lands
          // on the copy on a narrow frame. Scale 0 keeps the instance count
          // fixed — no rebuild, no per-instance branch in the shader.
          if (d.dz < 30) s = 0;
          else u = (u < 0 ? -1 : 1) * Math.max(Math.abs(u), 0.84);
        }
        var fdx = u * frustumHalf(d.dz);
        fPos.set(60 + fdx, meadowH(fdx, -d.dz) - 0.15, -582 + d.dz);
        fScl.set(s, s, 1);
        fMtx.compose(fPos, fQuat, fScl);
        mesh.setMatrixAt(gi2, fMtx);
        fCol.setRGB(d.r, d.g, d.b);
        mesh.setColorAt(gi2, fCol);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
  placeFlowers();

  function sunTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    // faint rays — enough to suggest direct light, not a photographic lens
    // flare. At 0.6 alpha these read as a game-engine glint.
    g.save(); g.translate(128, 128);
    for (var ri = 0; ri < 12; ri++) {
      var ra = ri / 12 * Math.PI * 2 + 0.26;
      var len = ri % 2 ? 70 : 112;
      var lg = g.createLinearGradient(0, 0, Math.cos(ra) * len, Math.sin(ra) * len);
      lg.addColorStop(0, 'rgba(255,243,214,0.3)');
      lg.addColorStop(1, 'rgba(255,243,214,0)');
      g.strokeStyle = lg; g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ra) * len, Math.sin(ra) * len); g.stroke();
    }
    g.restore();
    // warm core with a long, soft falloff: a source of light rather than a
    // white disc. The extra mid stops are what make the halo read as bloom.
    var rad = g.createRadialGradient(128, 128, 6, 128, 128, 128);
    rad.addColorStop(0, 'rgba(255,251,238,1)');
    rad.addColorStop(0.13, 'rgba(255,244,213,0.9)');
    rad.addColorStop(0.3, 'rgba(255,231,177,0.48)');
    rad.addColorStop(0.55, 'rgba(255,219,150,0.2)');
    rad.addColorStop(0.78, 'rgba(255,211,138,0.07)');
    rad.addColorStop(1, 'rgba(255,206,130,0)');
    g.fillStyle = rad; g.fillRect(0, 0, 256, 256);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
  }
  var sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0
  }));
  // off-centre so it never sits behind the contact copy; high enough to
  // peek over the mountain ridges in the finale
  // smaller and dimmer: the sun is a light source, not the loudest graphic on
  // screen — it must not compete with the headline for first read
  // dropped toward the ridgeline for the golden hour: a low sun is the whole
  // reason the light is warm and raking. Scale is left alone — the smaller sun
  // was a deliberate call, and a low sun that is also big reads as a sunset
  // poster rather than late afternoon. uSunDir tracks this, so the dome's glow
  // sinks with it and the warm band lands on the horizon instead of mid-sky.
  sun.position.set(125, 45, -722); sun.scale.set(26, 26, 1);
  scene.add(sun);

  // the work scene's own sun: a small red-orange sunset glint low over the
  // ranges (the meadow sun above can't sit right for both scenes at once)
  var sun2 = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0, fog: false,
    color: new THREE.Color('#ff9a6e')
  }));
  sun2.position.set(250, 112, -640); sun2.scale.set(46, 46, 1);
  scene.add(sun2);

  // mountain ridges behind the grassland — same 3D terrain as the peaks,
  // recolored (forested green near, hazy snow-blue far); see mountainMesh below

  // ── Cartier-journey props: 3D snow ranges, airships, birds, night lights ─
  // Real displaced-terrain mountains (lit, fogged) — flat billboard peaks
  // pixelated under magnification and read as 2D cutouts.
  function hash2(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return hash2(xi, yi) * (1 - u) * (1 - v) + hash2(xi + 1, yi) * u * (1 - v) +
           hash2(xi, yi + 1) * (1 - u) * v + hash2(xi + 1, yi + 1) * u * v;
  }
  function ridged(x, y) { // sharp alpine crests: folded octaves of value noise
    var a = 0, amp = 0.52, fr = 1;
    for (var o = 0; o < 4; o++) {
      a += (1 - Math.abs(vnoise(x * fr, y * fr) * 2 - 1)) * amp;
      amp *= 0.48; fr *= 2.1;
    }
    return a;
  }
  function sstep(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
  var rockC = new THREE.Color('#8a7a6b'), snowC = new THREE.Color('#faf6ee');
  function mountainMesh(w, d, amp, segX, seed, loCol, hiCol, solidBase, snowA, snowB) {
    snowA = snowA || 0.07; snowB = snowB || 0.24;
    var geo = new THREE.PlaneGeometry(w, d, segX, 30);
    var pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
    var col = new THREE.Color();
    var lo = loCol ? new THREE.Color(loCol) : rockC;
    var hi = hiCol ? new THREE.Color(hiCol) : snowC;
    for (var vi = 0; vi < pos.count; vi++) {
      var x = pos.getX(vi), y = pos.getY(vi);
      var nx = x / w * 5 + seed * 7.3, ny = y / d * 2.5 + seed * 3.1;
      // fade to the cloud line at the plane edges so ranges never end in a cliff
      var ex = 1 - Math.pow(Math.abs(x) / (w / 2), 3);
      var ey = 1 - Math.pow(Math.abs(y) / (d / 2), 2);
      var h = Math.pow(ridged(nx, ny), 1.7) * amp * ex * ey;
      pos.setZ(vi, h);
      // deep snow cover, rock only breaking through low on the flanks
      var sn = sstep(amp * snowA, amp * snowB, h + (vnoise(nx * 9, ny * 9) - 0.5) * amp * 0.22);
      col.lerpColors(lo, hi, sn);
      var ridgeShade = 0.82 + sstep(0.18, 0.92, ridged(nx * 1.7 + 9.4, ny * 1.9 - 4.1)) * 0.24;
      var warmFace = sstep(0.15, 0.75, vnoise(nx * 3.4 + 12.0, ny * 2.8));
      col.multiplyScalar(ridgeShade);
      col.lerp(new THREE.Color('#fff3dc'), sn * warmFace * 0.18);
      colors[vi * 3] = col.r; colors[vi * 3 + 1] = col.g; colors[vi * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.86, metalness: 0, transparent: true, opacity: 0
    });
    // dissolve the flat base into the cloud deck — otherwise the plane's
    // zero-height skirt shows as a hard-edged sheet between the clouds.
    // Grounded ridges keep their skirt (dissolving it opens a false "lake"
    // strip of sky between the meadow horizon and the mountains).
    var fA = (amp * 0.06).toFixed(2), fB = (amp * 0.3).toFixed(2);
    if (!solidBase) mat.onBeforeCompile = function (sh) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vElev;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvElev = position.z;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vElev;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
          'vec4 diffuseColor = vec4( diffuse, opacity * smoothstep(' + fA + ', ' + fB + ', vElev) );');
    };
    var m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    scene.add(m); return m;
  }
  var peaks = [
    (function () { var m = mountainMesh(280, 110, 58, 160, 1); m.position.set(-130, 48, -470); m.userData.o = 1; return m; })(),
    (function () { var m = mountainMesh(240, 100, 52, 150, 2); m.position.set(135, 46, -500); m.userData.o = 0.95; return m; })(),
    (function () { var m = mountainMesh(900, 170, 72, 230, 3); m.position.set(40, 42, -665); m.userData.o = 0.9; return m; })()
  ];
  // the hero's lone summit: right of centre, half-buried in the fog-sea,
  // more exposed rock than the work ranges (reference peak is warm rock + snow)
  var heroPeak = mountainMesh(235, 128, 82, 230, 7, '#766653', '#fff8ee', false, 0.08, 0.25);
  heroPeak.position.set(28, 4, -225); // lifted so the crown reads clearly over the fog-sea
  // The grassland backdrop: THREE layers staged for aerial perspective, the
  // thing that makes the world read as large. Each step back loses saturation
  // and contrast and gains the sky's blue, so the ranges recede instead of
  // advancing. (The previous warm-brown pair sat at the same value as the
  // foreground and popped forward as one flat dirt band.)
  // Amplitude stays high on every layer — the peaked silhouette is what reads
  // as "mountain"; distance alone flattens them into a strip.
  // opacity follows groundOp in the loop, scaled per layer.
  var ridgeNear = mountainMesh(980, 190, 40, 190, 5, '#69785e', '#909c78', true);
  ridgeNear.position.set(20, 0, -832);
  var ridgeMid = mountainMesh(1060, 200, 50, 195, 8, '#7d8d8b', '#a6b2ad', true);
  ridgeMid.position.set(-40, 0, -868);
  var ridgeFar = mountainMesh(1150, 220, 58, 200, 6, '#95a9bd', '#c6d6e3', true);
  ridgeFar.position.set(60, 0, -902);

  // Cartier-style red dirigible: 3D ellipsoid envelope with cream gores,
  // rope-hung gondola. Real geometry — lit, shaded, silhouettes correctly
  // from every angle (the old flat sprite pixelated up close).
  function goreTexture() {
    var c = document.createElement('canvas'); c.width = 512; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#a8242f'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#efdfc1';
    for (var x = 24; x < 512; x += 64) g.fillRect(x, 0, 22, 128);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true; return t;
  }
  var goreTex = goreTexture();
  // the hero craft flies close to camera, so it gets its own ornate envelope:
  // solid deep red, subtle gore seams, a draped rigging net and gold trim
  // flourishes (the work-scene ships keep the bold cream stripes)
  function heroEnvTexture() {
    var c = document.createElement('canvas'); c.width = 512; c.height = 128;
    var g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#b23440'); gr.addColorStop(0.5, '#a2242f'); gr.addColorStop(1, '#8c1f28');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
    var hl = g.createRadialGradient(390, 28, 8, 390, 28, 210);
    hl.addColorStop(0, 'rgba(255,210,172,0.34)');
    hl.addColorStop(0.38, 'rgba(255,188,144,0.16)');
    hl.addColorStop(1, 'rgba(255,188,144,0)');
    g.fillStyle = hl; g.fillRect(0, 0, 512, 128);
    var shade = g.createLinearGradient(0, 0, 512, 0);
    shade.addColorStop(0, 'rgba(35,0,8,0.24)');
    shade.addColorStop(0.42, 'rgba(35,0,8,0)');
    shade.addColorStop(1, 'rgba(255,224,180,0.1)');
    g.fillStyle = shade; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = 'rgba(58,10,16,0.3)'; g.lineWidth = 2;
    for (var x = 0; x <= 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
    g.strokeStyle = 'rgba(52,12,16,0.16)'; g.lineWidth = 1;
    for (x = -128; x < 512; x += 24) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 96, 128); g.stroke();
      g.beginPath(); g.moveTo(x + 96, 0); g.lineTo(x, 128); g.stroke();
    }
    // gold trim runs nose-to-tail (canvas y is the ship's long axis)
    [128, 384].forEach(function (fx) {
      g.strokeStyle = 'rgba(226,186,118,0.95)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(fx - 14, 20); g.lineTo(fx - 14, 108); g.stroke();
      g.beginPath(); g.moveTo(fx + 14, 20); g.lineTo(fx + 14, 108); g.stroke();
      g.lineWidth = 1.6; g.strokeStyle = 'rgba(238,206,142,0.95)';
      g.beginPath(); g.moveTo(fx, 34);
      for (var sy = 34; sy < 94; sy += 12)
        g.bezierCurveTo(fx + 8, sy + 3, fx - 8, sy + 9, fx, sy + 12);
      g.stroke();
    });
    // tiny rivets and panel ticks keep it crisp when the hero craft is close
    g.fillStyle = 'rgba(246,204,132,0.72)';
    for (x = 32; x < 512; x += 32) {
      for (var ry = 24; ry <= 104; ry += 40) {
        g.beginPath(); g.arc(x, ry, 1.3, 0, Math.PI * 2); g.fill();
      }
    }
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  function basketTexture() {
    var c = document.createElement('canvas'); c.width = 64; c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = '#8a6438'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(48,30,12,0.55)';
    for (var y = 2; y < 64; y += 9) g.fillRect(0, y, 64, 3);
    g.fillStyle = 'rgba(232,198,138,0.25)';
    for (var x = 0; x < 64; x += 11) g.fillRect(x, 0, 4, 64);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  var heroEnvTex = heroEnvTexture(), basketTex = basketTexture();
  function airship(scale, hero) {
    var g = new THREE.Group(), mats = [];
    var envMat = new THREE.MeshStandardMaterial({
      map: hero ? heroEnvTex : goreTex,
      roughness: hero ? 0.38 : 0.5,
      metalness: hero ? 0.03 : 0,
      transparent: true,
      opacity: 0
    });
    var envGeo = new THREE.SphereGeometry(1, 28, 20);
    if (hero) {
      // teardrop hull: squeeze the +y pole (it lands on -x — the tail —
      // after the rotation below) so the envelope tapers like the reference
      var vp = envGeo.attributes.position, vy, tq, shrink;
      for (var vi = 0; vi < vp.count; vi++) {
        vy = vp.getY(vi);
        if (vy > 0.15) {
          tq = (vy - 0.15) / 0.85;
          shrink = 1 - tq * tq * 0.45;
          vp.setX(vi, vp.getX(vi) * shrink);
          vp.setZ(vi, vp.getZ(vi) * shrink);
        }
      }
      envGeo.computeVertexNormals();
    }
    var env = new THREE.Mesh(envGeo, envMat);
    // poles onto the x axis: the gore stripes wrap nose-to-tail like panels
    env.rotation.z = Math.PI / 2;
    env.scale.set(1, 1.75, 1);
    g.add(env); mats.push(envMat);
    var basketMat = new THREE.MeshStandardMaterial(hero
      ? { map: basketTex, roughness: 0.95, transparent: true, opacity: 0 }
      : { color: '#7c5a33', roughness: 0.9, transparent: true, opacity: 0 });
    var basket = new THREE.Mesh(new THREE.BoxGeometry(
      hero ? 0.8 : 0.62, hero ? 0.5 : 0.4, hero ? 0.5 : 0.42), basketMat);
    basket.position.y = hero ? -1.58 : -1.42;
    g.add(basket); mats.push(basketMat);
    var ropeMat = new THREE.LineBasicMaterial({ color: 0x4a3624, transparent: true, opacity: 0 });
    var ropePts = [
      new THREE.Vector3(-0.55, -0.8, 0), new THREE.Vector3(-0.28, -1.24, 0.18),
      new THREE.Vector3(0.55, -0.8, 0), new THREE.Vector3(0.28, -1.24, 0.18),
      new THREE.Vector3(-0.55, -0.8, 0), new THREE.Vector3(-0.28, -1.24, -0.18),
      new THREE.Vector3(0.55, -0.8, 0), new THREE.Vector3(0.28, -1.24, -0.18)
    ];
    if (hero) {
      // denser rope fan up close, plus a little supply crate trailing the tail
      ropePts.push(
        new THREE.Vector3(-0.95, -0.55, 0), new THREE.Vector3(-0.38, -1.34, 0),
        new THREE.Vector3(0.95, -0.55, 0), new THREE.Vector3(0.38, -1.34, 0),
        new THREE.Vector3(-1.45, -0.35, 0), new THREE.Vector3(-0.4, -1.32, 0.12),
        new THREE.Vector3(1.45, -0.35, 0), new THREE.Vector3(0.4, -1.32, 0.12),
        new THREE.Vector3(-1.72, -0.12, 0), new THREE.Vector3(-2.18, -0.22, 0));
      var podMat = new THREE.MeshStandardMaterial({
        color: '#6d4b2c', roughness: 0.9, transparent: true, opacity: 0 });
      var pod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.3), podMat);
      pod.position.set(-2.3, -0.28, 0);
      g.add(pod); mats.push(podMat);
    }
    var ropes = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ropePts), ropeMat);
    g.add(ropes); mats.push(ropeMat);
    g.scale.setScalar(scale);
    g.userData.mats = mats;
    scene.add(g); return g;
  }
  // airships[0] is the hero's lone craft (heroBalOp); the others fly the
  // work scene (balOp)
  var airships = [[-42, 82, -64, 4.8], [46, 88, -380, 4.2], [92, 92, -445, 5.4]].map(function (b, bi) {
    var a = airship(b[3], bi === 0);
    a.position.set(b[0], b[1], b[2]);
    a.rotation.y = -0.35 + bi * 0.3; // slight heading variety
    if (bi === 0) a.rotation.z = 0.05; // hero craft rides nose-up, seen from just below
    a.userData.vx = 0.25 + bi * 0.12; a.userData.y0 = b[1]; a.userData.ph = bi * 2.1;
    return a;
  });
  // one lone airship over the meadow finale
  var balloonFar = airship(4.6);
  balloonFar.position.set(20, 42, -727);

  // a flock of 3D birds — flat silhouette wings that actually flap
  var birdMat = new THREE.MeshBasicMaterial({
    color: 0x33261f, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  var wingGeo = new THREE.PlaneGeometry(1.3, 0.42);
  wingGeo.translate(0.65, 0, 0);           // hinge at the wing root
  wingGeo.rotateX(-Math.PI / 2);           // wings spread flat, tips flap up/down
  var bodyGeo = new THREE.SphereGeometry(0.16, 8, 6);
  var flock = new THREE.Group();
  for (var fb = 0; fb < 8; fb++) {
    var bd = new THREE.Group();
    var wl = new THREE.Mesh(wingGeo, birdMat);
    var wr = new THREE.Mesh(wingGeo, birdMat); wr.scale.x = -1;
    var body = new THREE.Mesh(bodyGeo, birdMat);
    body.scale.set(2.2, 0.7, 0.7);
    bd.add(wl); bd.add(wr); bd.add(body);
    bd.position.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 18);
    bd.scale.setScalar(0.8 + Math.random() * 0.7);
    bd.userData = { wl: wl, wr: wr, ph: Math.random() * Math.PI * 2, fl: 5 + Math.random() * 3 };
    flock.add(bd);
  }
  flock.position.set(-55, 72, -145);
  scene.add(flock);

  // a tiny far-off jet crossing the work-scene sky left→right, dragging a
  // contrail that dissolves behind it — deliberately small and minimal
  function contrailTexture() {
    var c = document.createElement('canvas'); c.width = 256; c.height = 32;
    var g = c.getContext('2d');
    var lg = g.createLinearGradient(0, 0, 256, 0); // head (right) → tail (left)
    // alpha returns to 0 at the extreme right so texture-clamp ahead of the
    // jet (u+offset > 1) reads as empty sky, not a full-strength streak
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.3, 'rgba(255,255,255,0.28)');
    lg.addColorStop(0.9, 'rgba(255,255,255,0.8)');
    lg.addColorStop(0.985, 'rgba(255,255,255,0.85)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(0, 0, 256, 32);
    var vg = g.createLinearGradient(0, 0, 0, 32); // soft edges, crisp core
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.5, 'rgba(0,0,0,1)');
    vg.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = vg; g.fillRect(0, 0, 256, 32);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  var jetMat = new THREE.MeshBasicMaterial({
    color: 0xf6f9fc, transparent: true, opacity: 0, depthWrite: false });
  var jet = new THREE.Group();
  var fus = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 3.4, 6), jetMat);
  fus.rotation.z = -Math.PI / 2; // nose (narrow end) points along +x
  jet.add(fus);
  var jw = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3), jetMat);
  jw.rotation.x = -Math.PI / 2; jw.material.side = THREE.DoubleSide;
  jet.add(jw);
  var jfin = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.5), jetMat);
  jfin.position.set(-1.5, 0.3, 0);
  jet.add(jfin);
  jet.scale.setScalar(1.6);
  var jetGrp = new THREE.Group();
  jetGrp.add(jet);
  // flies a shallow parabola across the upper sky
  function jetY(x) { var jx = (x - 20) / 340; return 245 + 55 * (1 - jx * jx); }
  // the contrail is a world-fixed ribbon along the whole parabola: the drawn
  // path STAYS in the sky where the jet flew, and only the oldest stretch
  // dissolves. A JET_WIN-long alpha window (texture offset, clamped edges)
  // slides with the jet: ahead of it the ribbon reads as empty sky, far
  // behind it the trail has faded out.
  var JET_X0 = -320, JET_X1 = 360, JET_WIN = 280;
  var tSeg = 120, tPos = new Float32Array((tSeg + 1) * 2 * 3),
      tUv = new Float32Array((tSeg + 1) * 2 * 2), tIdx = [];
  for (var ti = 0; ti <= tSeg; ti++) {
    var tx = JET_X0 + (JET_X1 - JET_X0) * ti / tSeg, ty = jetY(tx);
    tPos.set([tx, ty - 1.1, 0, tx, ty + 1.1, 0], ti * 6);
    var tu = (tx - JET_X0) / JET_WIN;
    tUv.set([tu, 0, tu, 1], ti * 4);
    if (ti < tSeg) tIdx.push(ti * 2, ti * 2 + 2, ti * 2 + 1, ti * 2 + 1, ti * 2 + 2, ti * 2 + 3);
  }
  var trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  trailGeo.setAttribute('uv', new THREE.BufferAttribute(tUv, 2));
  trailGeo.setIndex(tIdx);
  trailGeo.setDrawRange(0, 0); // only ever draw the stretch BEHIND the jet
  var trailMat = new THREE.MeshBasicMaterial({
    map: contrailTexture(), transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide });
  var trail = new THREE.Mesh(trailGeo, trailMat);
  trail.position.z = -640;
  scene.add(trail);
  // starts already in frame with the path behind it trailing off-screen left
  jetGrp.position.set(-140, jetY(-140), -640);
  scene.add(jetGrp);

  // warm firefly lights floating through the storm-night leg
  var sparkGeo = new THREE.BufferGeometry();
  var sparkPos = new Float32Array(46 * 3);
  for (var ki = 0; ki < 46; ki++) {
    sparkPos[ki * 3] = 8 + Math.random() * 88;
    sparkPos[ki * 3 + 1] = 58 + Math.random() * 44;
    sparkPos[ki * 3 + 2] = -125 - Math.random() * 160;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  // soft glow map — untextured points rasterize as hard squares
  function glowTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var rad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    rad.addColorStop(0, 'rgba(255,255,255,1)');
    rad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    rad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rad; g.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  }
  var sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: 0xffdda6, size: 3.2, map: glowTexture(), sizeAttenuation: true,
    transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false
  }));
  scene.add(sparks);
  sparks.position.set(0, 24, -220); // rides with the storm leg

  // ── starfield (visible in the storm-night leg, rides with the camera) ──
  var starGeo = new THREE.BufferGeometry();
  var starPos = new Float32Array(600 * 3);
  for (var si = 0; si < 600; si++) {
    var sa = Math.random() * Math.PI * 2;
    var sy = 0.06 + Math.random() * 0.94;
    var sr = Math.sqrt(1 - sy * sy);
    starPos[si * 3] = Math.cos(sa) * sr * 540;
    starPos[si * 3 + 1] = sy * 540;
    starPos[si * 3 + 2] = Math.sin(sa) * sr * 540;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcfe0ff, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false
  }));
  dome.add(stars); // dome follows the camera, so the stars do too

  // ── scroll → master progress ────────────────────────────────────────────
  // data-sky-lock="N" on <body> pins the journey to scene N. Read fresh every
  // frame so it can be toggled at runtime — the About overlay sets it to hold
  // the hero sky still while its own content scrolls over the top.
  function lockedS() {
    var a = document.body.getAttribute('data-sky-lock');
    return a === null ? null : parseFloat(a);
  }
  var sections = ['s-hero', 's-intro', 's-work', 's-cloudline', 's-ai', 's-contact']
    .map(function (id) { return document.getElementById(id); });
  var tops = [0, 0, 0, 0, 0, 0];
  function measure() {
    var sy = window.pageYOffset;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i]) tops[i] = sections[i].getBoundingClientRect().top + sy;
    }
  }
  function targetS() {
    var lk = lockedS();
    if (lk !== null) return lk;
    var y = window.pageYOffset, vh = innerHeight, s = 0;
    var maxY = document.documentElement.scrollHeight - vh;
    for (var i = 1; i < sections.length; i++) {
      // the flight is the show: each transition plays out in the empty gap
      // and COMPLETES before the section arrives, so content only ever
      // appears in a settled scene
      var a = tops[i] - vh * 1.9, b = tops[i] - vh * 0.75;
      if (i === sections.length - 1 && b > maxY - 4) {
        // last zone must finish within reachable scroll or the sunny
        // meadow state is never fully entered
        b = maxY - 4; a = Math.min(a, b - vh * 1.15);
      }
      s += Math.min(1, Math.max(0, (y - a) / (b - a)));
    }
    return s;
  }
  var S = 0; // smoothed master progress
  var bootProgress = INSTANT ? 1 : 0;
  var bootRevealStarted = INSTANT;
  // where the journey stands right now, for gating content against the
  // camera. In INSTANT mode read the DOM directly — rAF (and therefore S)
  // lags under headless virtual time, but layout math is always current.
  function curS() { return INSTANT ? targetS() : S; }

  function lerp(a, b, f) { return a + (b - a) * f; }
  function smooth(f) { return f * f * (3 - 2 * f); }
  var tmpA = new THREE.Color(), tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
  // LAST is the top palette index. It was 4 for five states; the cloudline
  // leg makes six, so every clamp that used to say 4 or 3 shifts by one.
  var LAST = 5;
  function colAt(arr, i, f, out) { return out.lerpColors(arr[i], arr[Math.min(i + 1, LAST)], f); }
  function numAt(arr, i, f) { return lerp(arr[i], arr[Math.min(i + 1, LAST)], f); }

  // ── lightning ───────────────────────────────────────────────────────────
  var flash = 0, nextFlash = 2.5, flashfx = document.getElementById('flashfx');
  // small cloud-to-cloud bolts: thin jagged lines (vector geometry — sprites
  // this small would pixelate), regenerated and repositioned on every strike
  function boltGeometry() {
    var pts = [], bx = 0, by = 0, bz = 0;
    var n = 6 + Math.floor(Math.random() * 3);
    var drop = 24 + Math.random() * 16;
    for (var b = 0; b <= n; b++) {
      pts.push(new THREE.Vector3(bx, -by, bz));
      bx += (Math.random() - 0.5) * 7;
      bz += (Math.random() - 0.5) * 4;
      by += drop / n * (0.7 + Math.random() * 0.6);
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }
  var boltMat = new THREE.LineBasicMaterial({
    color: 0xdfe9ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, fog: false
  });
  var bolt = new THREE.Line(boltGeometry(), boltMat);
  var boltBranch = new THREE.Line(boltGeometry(), boltMat.clone());
  boltBranch.scale.set(0.5, 0.45, 0.5);
  bolt.add(boltBranch);
  // flanking ghost copies fake a wider glowing channel — LineBasicMaterial
  // ignores linewidth, so a lone line is a barely-visible hairline
  var boltGhosts = [-0.9, 0.9].map(function (gx) {
    var gm = boltMat.clone();
    var gl = new THREE.Line(bolt.geometry, gm);
    gl.position.x = gx;
    bolt.add(gl);
    return gl;
  });
  scene.add(bolt);
  function strike() {
    bolt.geometry.dispose(); bolt.geometry = boltGeometry();
    boltBranch.geometry.dispose(); boltBranch.geometry = boltGeometry();
    boltGhosts[0].geometry = boltGhosts[1].geometry = bolt.geometry;
    // hang the branch off a random elbow of the main channel
    var bp = bolt.geometry.attributes.position;
    var bk = 1 + Math.floor(Math.random() * (bp.count - 2));
    boltBranch.position.set(bp.getX(bk), bp.getY(bk), bp.getZ(bk));
    boltBranch.rotation.y = Math.random() * Math.PI * 2;
    // drop from the ceiling BASE into the clear air below it — channels that
    // start higher get buried behind the fused sprite mass. Keep z well past
    // the settled camera (-370) or the bolt spawns behind the near plane
    bolt.position.set(20 + Math.random() * 90, 86 + Math.random() * 10, -405 - Math.random() * 65);
  }
  strike();

  // ── overlay fades: headline blocks fade in near viewport centre and back
  // out as the flight continues (measure the SECTION — it has no transform —
  // and style the inner wrapper, or the translate would feed back into rects)
  var ovls = [['s-hero', 0], ['s-intro', 1], ['s-contact', 5]].map(function (d) {
    var sec = document.getElementById(d[0]);
    return { sec: sec, el: sec ? sec.querySelector('.ovl') : null, idx: d[1] };
  }).filter(function (o) { return o.el; });
  function updateOverlays() {
    if (REDUCED) return;
    var vh = innerHeight, s = curS();
    for (var o = 0; o < ovls.length; o++) {
      var b = ovls[o].sec.getBoundingClientRect();
      var d = (b.top + b.height / 2 - vh / 2) / vh;
      var vis = 1 - Math.min(1, Math.max(0, (Math.abs(d) - 0.22) / 0.46));
      // scene first, content second: hold the copy back until the camera
      // has settled into this scene (and fade it as the next flight begins)
      vis = Math.min(vis, 1 - Math.min(1, Math.abs(s - ovls[o].idx) / 0.5));
      vis = vis * vis * (3 - 2 * vis);
      var el = ovls[o].el;
      el.style.opacity = vis.toFixed(3);
      el.style.transform = 'translateY(' + (-d * 30).toFixed(1) + 'px)';
    }
  }

  // mouse parallax
  var mx = 0, my = 0;
  addEventListener('pointermove', function (e) {
    mx = (e.clientX / innerWidth - 0.5) * 2;
    my = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  // ── frame loop ──────────────────────────────────────────────────────────
  var clock = new THREE.Clock();
  var hidden = false;
  document.addEventListener('visibilitychange', function () { hidden = document.hidden; });

  function frame() {
    requestAnimationFrame(frame);
    if (hidden) return;
    var dt = Math.min(clock.getDelta(), 0.05);
    var T = clock.elapsedTime;

    var tgt = targetS();
    // critically-damped-ish follow: fast enough to track the wheel (laggy
    // easing reads as jerky when frames drop), slow enough to stay cinematic
    S = INSTANT ? tgt : S + (tgt - S) * Math.min(1, dt * 3.4);
    window.__adS = S; // debug/verification hook
    var i = Math.min(Math.floor(S), LAST - 1);
    var f = smooth(Math.min(Math.max(S - i, 0), 1));
    // storm approach gets a second smoothstep: gentler in and out of the
    // leg, faster through the middle — the night falls in one dramatic move.
    // The storm is entered from 3 now that cloudline sits at 3 (was 2).
    if (i === 3) f = smooth(f);

    // sky, fog, lights
    skyUni.uTop.value.copy(colAt(P.top, i, f, tmpA));
    skyUni.uMid.value.copy(colAt(P.mid, i, f, tmpA));
    skyUni.uBot.value.copy(colAt(P.bot, i, f, tmpA));
    scene.fog.color.copy(colAt(P.fogC, i, f, tmpA));
    scene.fog.density = numAt(P.fogD, i, f);
    hemi.intensity = numAt(P.hemiI, i, f);
    hemi.color.copy(colAt(P.hemiS, i, f, tmpA));
    hemi.groundColor.copy(colAt(P.hemiG, i, f, tmpA));
    dir.intensity = numAt(P.dirI, i, f);
    dir.color.copy(colAt(P.dirC, i, f, tmpA));
    skyUni.uGlowC.value.copy(colAt(P.glowC, i, f, tmpA));
    skyUni.uGlowI.value = numAt(P.glowI, i, f);
    stars.material.opacity = numAt(P.starsOp, i, f);

    bootProgress = INSTANT ? 1 : Math.min(1, Math.max(0, (T - 0.35) / 3.35));
    var bootEase = smooth(bootProgress);
    if (!bootRevealStarted && bootProgress >= 0.44) {
      bootRevealStarted = true;
      checkReveals();
    }
    if (bootProgress >= 1 && document.documentElement.classList.contains('sky-booting')) {
      document.documentElement.classList.remove('sky-booting');
      document.documentElement.classList.add('sky-loaded');
      checkReveals();
    }

    // camera along keyframes + idle drift + parallax + banking roll
    // flying-speed cue: the lens widens mid-transition, settles on arrival
    var baseFov = 55 + (REDUCED ? 0 : Math.sin(f * Math.PI) * (i === 2 ? 9 : 5));
    tmpPos.lerpVectors(K[i].p, K[Math.min(i + 1, 4)].p, f);
    tmpLook.lerpVectors(K[i].l, K[Math.min(i + 1, 4)].l, f);
    // final descent: nose pitches down toward the earth mid-dive, then
    // flares level over the grass
    if (i === 4) tmpLook.y -= Math.sin(f * Math.PI) * 30;  // dip into the storm (was 3 before cloudline)
    // storm approach: dive under the advancing cloud front, then flare
    // level as the night settles
    if (i === 2) { tmpPos.y -= Math.sin(f * Math.PI) * 9; tmpLook.y -= Math.sin(f * Math.PI) * 13; }
    if (!REDUCED) {
      tmpPos.x += Math.sin(T * 0.13) * 0.7 + mx * 1.4;
      tmpPos.y += Math.sin(T * 0.17) * 0.5 - my * 1.0;
      tmpLook.x += mx * 3.5; tmpLook.y -= my * 2.2;
    }
    if (S < 0.08 && bootProgress < 1) {
      camera.fov = lerp(40, baseFov, bootEase);
    } else {
      camera.fov = baseFov;
    }
    camera.updateProjectionMatrix();
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);
    camera.rotation.z += (REDUCED ? 0 : Math.sin(f * Math.PI) * P.roll[i]);
    dome.position.copy(camera.position);
    // dome glow anchor: the hero/approach sunset corner, then the work
    // scene's sunset sun, then the meadow sun — blended so it never jumps
    var g1 = Math.min(1, Math.max(0, (S - 1.2) / 0.8));
    var g2 = Math.min(1, Math.max(0, (S - 2.8) / 0.8));
    tmpLook.set(125, 66, -470).lerp(sun2.position, g1).lerp(sun.position, g2)
      .sub(camera.position).normalize();
    skyUni.uSunDir.value.copy(tmpLook);
    updateOverlays();

    /* The wall belongs to leg 3. Held flat across a plateau either side of 3
       rather than peaking on it: the reader scrolls THROUGH 3 while the
       section is on screen, so a peak would dissolve the cards exactly while
       they are being looked at. */
    var wd = Math.abs(S - 3);
    var wf = wd <= 0.4 ? 1 : Math.min(Math.max(1 - (wd - 0.4) / 0.45, 0), 1);
    wf = wf * wf * (3 - 2 * wf);
    wall.update(dt, wf, wallPress());
    wall.group.updateMatrixWorld();
    wall.layer.style.opacity = wf;
    wall.layoutLabels(camera, innerWidth, innerHeight);


    // cloud groups: opacity/tint per state, slow drift
    var dOp = numAt(P.deckOp, i, f), sOp = numAt(P.stormOp, i, f), pOp = numAt(P.sunnyOp, i, f);
    colAt(P.deckC, i, f, tmpA);
    var c, sp;
    for (c = 0; c < deck.children.length; c++) {
      sp = deck.children[c];
      sp.material.opacity = dOp * sp.userData.base;
      sp.visible = sp.material.opacity > 0.01;
      sp.material.color.copy(tmpA);
      if (!REDUCED) { sp.position.x += sp.userData.vx * dt; if (sp.position.x > 220) sp.position.x = -220; }
    }
    var d2Op = numAt(P.deck2Op, i, f);
    for (c = 0; c < deck2.children.length; c++) {
      sp = deck2.children[c];
      sp.material.opacity = d2Op * sp.userData.base;
      sp.visible = sp.material.opacity > 0.01;
      sp.material.color.copy(tmpA);
      if (!REDUCED) { sp.position.x += sp.userData.vx * dt; if (sp.position.x > 240) sp.position.x = -190; }
    }
    // hero fog-sea: slow drift; the warm tint holds through the sunset
    // approach and only whitens as the sea fades into the blue work sky
    var qOp = numAt(P.seaOp, i, f), qMix = Math.min(1, Math.max(0, S - 1)) * 0.65;
    for (c = 0; c < sea.children.length; c++) {
      sp = sea.children[c];
      sp.material.opacity = qOp * sp.userData.base;
      sp.visible = sp.material.opacity > 0.01;
      if (sp.visible) {
        sp.material.color.copy(sp.userData.c).lerp(tmpA.set(0xffffff), qMix);
        if (!REDUCED) { sp.position.x += sp.userData.vx * dt; if (sp.position.x > 300) sp.position.x = -300; }
      }
    }
    for (c = 0; c < storm.children.length; c++) {
      sp = storm.children[c];
      sp.material.opacity = sOp * sp.userData.base;
      sp.visible = sp.material.opacity > 0.01;
      sp.material.color.copy(sp.userData.sc);
      // strikes light the ceiling from within (flash lags one frame — fine)
      if (flash > 0.02) sp.material.color.lerp(tmpA.set(0x93a7d0), flash * 0.45);
    }
    for (c = 0; c < sunny.children.length; c++) {
      sp = sunny.children[c];
      sp.material.opacity = pOp * sp.userData.base;
      sp.visible = sp.material.opacity > 0.01;
      if (!REDUCED) { sp.position.x += sp.userData.vx * 0.4 * dt; if (sp.position.x > 130) sp.position.x = 5; }
    }
    sun.material.opacity = numAt(P.sunOp, i, f);
    sun2.material.opacity = numAt(P.sun2Op, i, f);

    // Cartier props
    var pkOp = numAt(P.peaksOp, i, f);
    for (c = 0; c < peaks.length; c++) {
      peaks[c].material.opacity = pkOp * peaks[c].userData.o;
      peaks[c].visible = peaks[c].material.opacity > 0.01;
    }
    heroPeak.material.opacity = numAt(P.heroPkOp, i, f);
    heroPeak.visible = heroPeak.material.opacity > 0.01;
    var bOp = numAt(P.balOp, i, f), hbOp = numAt(P.heroBalOp, i, f), m2, aOp;
    for (c = 0; c < airships.length; c++) {
      sp = airships[c];
      aOp = c === 0 ? hbOp : bOp;
      for (m2 = 0; m2 < sp.userData.mats.length; m2++) sp.userData.mats[m2].opacity = aOp;
      sp.visible = aOp > 0.01;
      if (!REDUCED && sp.visible) {
        sp.position.x += sp.userData.vx * dt;
        sp.position.y = sp.userData.y0 + Math.sin(T * 0.35 + sp.userData.ph) * 1.1;
        if (sp.position.x > 140) sp.position.x = -140;
      }
    }
    // one flock serves the hero and work scenes: it re-bases further down the
    // flight path while it's fully faded out mid-journey (birdOp ≈ 0 near S 1)
    if (S < 1.1) { flock.position.y = 72; flock.position.z = -145; }
    else { flock.position.y = 102; flock.position.z = -375; }
    birdMat.opacity = numAt(P.birdOp, i, f);
    flock.visible = birdMat.opacity > 0.01;
    if (!REDUCED && flock.visible) {
      flock.position.x += dt * 2.4;
      if (flock.position.x > 70) flock.position.x = -160;
      for (c = 0; c < flock.children.length; c++) {
        sp = flock.children[c];
        var fw = Math.sin(T * sp.userData.fl + sp.userData.ph) * 0.55;
        sp.userData.wl.rotation.z = fw;
        sp.userData.wr.rotation.z = -fw;
      }
    }
    var jOp = numAt(P.jetOp, i, f);
    jetMat.opacity = jOp; trailMat.opacity = jOp * 0.7;
    jetGrp.visible = jOp > 0.01; trail.visible = jetGrp.visible;
    // the same jet serves the work sky and the meadow finale: it re-bases
    // lower and deeper while faded out through the storm leg (jetOp ≈ 0),
    // so from the meadow it reads as the same airliner still crossing
    var jetDY = S < 4.02 ? 0 : -165, jetDZ = S < 4.02 ? -640 : -805;  // was 3.02 before cloudline
    trail.position.y = jetDY; trail.position.z = jetDZ;
    jetGrp.position.z = jetDZ;
    jetGrp.position.y = jetY(jetGrp.position.x) + jetDY;
    if (!REDUCED && jetGrp.visible) {
      jetGrp.position.x += dt * 7; // ~95 s to cross — a slow, distant pass
      // flies on past the ribbon's end so the lingering trail finishes
      // dissolving before the next pass starts
      if (jetGrp.position.x > JET_X1 + JET_WIN) jetGrp.position.x = JET_X0;
      jetGrp.position.y = jetY(jetGrp.position.x) + jetDY;
      // pitch along the arc's tangent so the craft stays on the parabola
      jetGrp.rotation.z = Math.atan(-110 * (jetGrp.position.x - 20) / (340 * 340));
    }
    // slide the contrail's alpha window up to the jet's current position and
    // draw only the segments it has already flown past
    trailMat.map.offset.x = 1 - (jetGrp.position.x - JET_X0) / JET_WIN;
    var tN = Math.max(0, Math.min(tSeg,
      Math.floor((jetGrp.position.x - JET_X0) / ((JET_X1 - JET_X0) / tSeg))));
    trailGeo.setDrawRange(0, tN * 6);
    sparks.material.opacity = numAt(P.sparkOp, i, f) * (0.7 + 0.3 * Math.sin(T * 2.2));

    var gOp = numAt(P.groundOp, i, f);
    for (m2 = 0; m2 < balloonFar.userData.mats.length; m2++) balloonFar.userData.mats[m2].opacity = gOp * 0.95;
    if (!REDUCED) balloonFar.position.y = 42 + Math.sin(T * 0.3) * 1.4;
    ground.material.opacity = gOp;
    // whole vegetation layer: two writes, no per-instance iteration
    tufts.material.opacity = gOp;
    tufts.visible = gOp > 0.01;
    if (!REDUCED) vegTime.value = T;
    // per-layer opacity completes the aerial recession the vertex colours start
    ridgeFar.material.opacity = gOp * 0.62;
    ridgeMid.material.opacity = gOp * 0.82;
    ridgeNear.material.opacity = gOp;
    for (m2 = 0; m2 < millMats.length; m2++) millMats[m2].opacity = gOp;
    mill.visible = gOp > 0.01;
    if (!REDUCED && mill.visible) millHub.rotation.z -= dt * 0.55;
    // the breeze now lives in the vegetation vertex shader (vegTime above), so
    // the whole field costs two writes instead of a loop over every flower
    flowerMeshes[0].material.opacity = flowerMeshes[1].material.opacity = 0.95 * gOp;
    flowerMeshes[0].visible = flowerMeshes[1].visible = gOp > 0.01;

    // lightning inside the storm leg — held back until the flight has mostly
    // settled into the night so flashes never strobe the day→night transition
    var stormFactor = Math.min(Math.max(1 - Math.abs(S - 4), 0), 1);  // storm moved 3 -> 4
    if (!REDUCED && !INSTANT && stormFactor > 0.7 && T > nextFlash) {
      flash = 1;
      strike();
      nextFlash = T + 5 + Math.random() * 6;
      if (Math.random() < 0.3) nextFlash = T + 0.14; // double-strike
    }
    if (window.__adFlashHold) { // capture hook: pin flash at a given level
      if (!window.__adHeld) { strike(); window.__adHeld = true; }
      flash = +window.__adFlashHold || 0.9;
    }
    flash *= Math.exp(-dt * 7);
    // sky whitens LESS than the bolt so the channel stays readable at peak
    skyUni.uFlash.value = flash * stormFactor * 0.55;
    flashfx.style.opacity = (flash * stormFactor * 0.3).toFixed(3);
    hemi.intensity += flash * stormFactor * 1.6;
    // sqrt: the channel lingers a beat after the sky flash dims
    var boltOp = Math.sqrt(flash) * stormFactor;
    boltMat.opacity = boltOp * 0.9;
    boltBranch.material.opacity = boltOp * 0.55;
    boltGhosts[0].material.opacity = boltGhosts[1].material.opacity = boltOp * 0.4;
    bolt.visible = boltOp > 0.02;

    renderer.render(scene, camera);
  }

  function resize() {
    var w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    // the meadow's flower/tuft staging is authored per-frustum, so it has to
    // be re-resolved whenever the aspect changes (camera starts at aspect 1)
    placeFlowers();
    placeTufts();
    measure();
  }
  addEventListener('resize', resize, { passive: true });
  resize();
  setTimeout(measure, 800); // re-measure once fonts/layout settle
  frame();

  // ── content reveals ─────────────────────────────────────────────────────
  // Rect-based (not IntersectionObserver): reliable under headless capture,
  // iframes and instant scrolls alike.
  var sceneIdx = { 's-hero': 0, 's-intro': 1, 's-work': 2, 's-cloudline': 3, 's-ai': 4, 's-contact': 5 };
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal')).map(function (el) {
    var sec = el.closest('section');
    return { el: el, idx: sec ? sceneIdx[sec.id] : 0 };
  });
  function checkReveals() {
    var h = innerHeight, s = curS();
    for (var r = revealEls.length - 1; r >= 0; r--) {
      // content waits for the camera: nothing reveals mid-flight
      if (Math.abs(s - revealEls[r].idx) > 0.35) continue;
      if (!INSTANT && revealEls[r].idx === 0 && !bootRevealStarted) continue;
      var box = revealEls[r].el.getBoundingClientRect();
      if (box.top < h * 0.88 && box.bottom > 0) {
        revealEls[r].el.classList.add('in');
        revealEls.splice(r, 1);
      }
    }
  }
  addEventListener('scroll', checkReveals, { passive: true });
  checkReveals();
  // timer fallback: scroll events don't always dispatch (headless virtual
  // time, some embedded contexts) — timers do. No-op once everything is in.
  setInterval(function () { checkReveals(); updateOverlays(); }, 600);
})();
