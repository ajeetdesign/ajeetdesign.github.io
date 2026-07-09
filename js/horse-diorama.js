/* ────────────────────────────────────────────────────────────────────────
   Anthro-horse "designer at a Mac" — hero-top centerpiece.
   Standing horse-headed character (t-shirt + shorts) beside a MacBook.
   Self-contained Three.js (vendored, MIT). Intro: one fast spin, then a
   slow perpetual turntable. Sits in an in-flow band above the hero content.
   Hydration-safe; honors prefers-reduced-motion; pauses off-screen/hidden.
   ──────────────────────────────────────────────────────────────────────── */
import * as THREE from './three.module.min.js?v=2';

(function () {
  if (window.__adHorseInit) return;
  window.__adHorseInit = true;

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── stage: body-level overlay (React-safe), anchored over the hero top ──
  var stage = document.createElement('div');
  stage.id = 'ad-horse';
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText =
    'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;' +
    'z-index:1;opacity:0;transition:opacity .6s ease';
  document.body.appendChild(stage);
  document.documentElement.classList.add('ad-horse-on'); // CSS retunes hero spacing

  // ── renderer / scene ────────────────────────────────────────────────────
  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  stage.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(6.5, 5.3, 9.0);
  camera.lookAt(0, 1.95, 0.15);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c6b6, 0.95));
  var key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(5, 9, 6); scene.add(key);
  var fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-6, 4, -3); scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  var turntable = new THREE.Group(); scene.add(turntable);
  function mat(hex) { return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 }); }
  function metalMat(hex) { return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.35, metalness: 0.65 }); }
  function box(w, h, d, m, x, y, z, parent) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), (m && m.isMaterial) ? m : mat(m));
    mesh.position.set(x, y, z); (parent || turntable).add(mesh); return mesh;
  }

  var C = {
    body: 0xb47d49, bodyLt: 0xc79a67, muzzle: 0xdcb488, mane: 0x5b3a1e, hoof: 0x2e2016,
    tee: 0x2fa79b, teeDk: 0x24857c, shorts: 0x3d5680, shortsDk: 0x334a6e,
    deskTop: 0xcf8a52, deskLeg: 0xb5713c, chair: 0x8f5a2e, alu: 0xd7dadf, aluDk: 0xb9bcc2,
    screen: 0x1b1d22, screenLit: 0x9fd6e6, pot: 0xe7e2da, leaf: 0x5fa05a
  };
  // Layout: character faces the viewer (+Z), the desk + Mac sit in front of it
  // (between character and camera) so the horse reads as WORKING at the laptop.

  // ── chair (behind/under the horse) ───────────────────────────────────────
  box(1.5, 0.18, 1.3, C.chair, 0, 1.28, -0.45);              // seat
  box(0.16, 1.2, 0.16, C.chair, -0.62, 0.6, 0.1);            // legs
  box(0.16, 1.2, 0.16, C.chair, 0.62, 0.6, 0.1);
  box(0.16, 1.2, 0.16, C.chair, -0.62, 0.6, -0.95);
  box(0.16, 1.2, 0.16, C.chair, 0.62, 0.6, -0.95);
  box(1.5, 1.15, 0.16, C.chair, 0, 2.05, -1.02);             // backrest

  // ── seated anthro horse ──────────────────────────────────────────────────
  // hips + thighs (thighs run forward, under the desk)
  box(1.3, 0.66, 0.9, C.shorts, 0, 1.62, -0.3);
  box(0.46, 0.42, 1.05, C.shorts, -0.4, 1.5, 0.35);          // L thigh
  box(0.46, 0.42, 1.05, C.shorts, 0.4, 1.5, 0.35);          // R thigh
  box(0.02, 0.42, 1.0, C.shortsDk, 0, 1.5, 0.36);           // leg split
  // shins (drop from the knees) + hooves
  box(0.4, 1.05, 0.4, C.body, -0.4, 0.75, 0.8);
  box(0.4, 1.05, 0.4, C.body, 0.4, 0.75, 0.8);
  box(0.46, 0.24, 0.56, C.hoof, -0.4, 0.14, 0.95);
  box(0.46, 0.24, 0.56, C.hoof, 0.4, 0.14, 0.95);
  // torso / t-shirt (upright)
  box(1.34, 1.2, 0.72, C.tee, 0, 2.55, -0.22);
  box(1.44, 0.28, 0.78, C.teeDk, 0, 3.08, -0.22);            // collar line
  box(0.5, 0.44, 0.78, C.tee, -0.9, 2.9, -0.22);            // L shoulder/sleeve
  box(0.5, 0.44, 0.78, C.tee, 0.9, 2.9, -0.22);            // R shoulder/sleeve
  // arms reaching forward onto the keyboard
  box(0.32, 0.7, 0.34, C.tee, -0.86, 2.5, -0.12);          // L upper arm (sleeve)
  box(0.32, 0.7, 0.34, C.tee, 0.86, 2.5, -0.12);          // R upper arm
  box(0.3, 0.32, 0.95, C.body, -0.72, 2.08, 0.4);         // L forearm forward
  box(0.3, 0.32, 0.95, C.body, 0.72, 2.08, 0.4);         // R forearm forward
  box(0.36, 0.2, 0.34, C.bodyLt, -0.6, 2.02, 0.92);       // L hand on keys
  box(0.36, 0.2, 0.34, C.bodyLt, 0.6, 2.02, 0.92);       // R hand on keys
  // neck
  box(0.55, 0.5, 0.5, C.body, 0, 3.3, -0.16);

  // ── horse head (tilted down, looking at the screen) ──────────────────────
  var hg = new THREE.Group(); hg.position.set(0, 3.55, -0.1); hg.rotation.x = 0.28; turntable.add(hg);
  box(0.82, 0.78, 0.78, C.bodyLt, 0, 0.32, 0.06, hg);        // skull
  box(0.54, 0.5, 0.5, C.muzzle, 0, 0.12, 0.55, hg);         // muzzle
  box(0.56, 0.12, 0.12, C.mane, 0, -0.02, 0.8, hg);         // mouth
  box(0.12, 0.13, 0.1, C.hoof, -0.24, 0.4, 0.48, hg);       // eyes
  box(0.12, 0.13, 0.1, C.hoof, 0.24, 0.4, 0.48, hg);
  box(0.14, 0.1, 0.1, 0x241812, -0.12, 0.13, 0.78, hg);     // nostrils
  box(0.14, 0.1, 0.1, 0x241812, 0.12, 0.13, 0.78, hg);
  box(0.16, 0.62, 0.06, 0xf3ede2, 0, 0.28, 0.48, hg);       // blaze
  box(0.15, 0.34, 0.15, C.bodyLt, -0.28, 0.86, -0.02, hg);  // ears
  box(0.15, 0.34, 0.15, C.bodyLt, 0.28, 0.86, -0.02, hg);
  box(0.08, 0.17, 0.08, C.mane, -0.28, 0.84, 0.03, hg);
  box(0.08, 0.17, 0.08, C.mane, 0.28, 0.84, 0.03, hg);
  box(0.5, 0.22, 0.34, C.mane, 0, 0.74, -0.06, hg);         // forelock
  box(0.44, 0.5, 0.28, C.mane, 0, 0.3, -0.42, hg);          // mane down nape

  // ── desk (in front of the horse) ─────────────────────────────────────────
  var DTOP = 1.92, DFZ = 1.05;
  box(2.5, 0.16, 1.15, C.deskTop, 0, DTOP, DFZ);
  box(0.18, DTOP, 0.18, C.deskLeg, -1.1, DTOP / 2, DFZ - 0.45);
  box(0.18, DTOP, 0.18, C.deskLeg, 1.1, DTOP / 2, DFZ - 0.45);
  box(0.18, DTOP, 0.18, C.deskLeg, -1.1, DTOP / 2, DFZ + 0.45);
  box(0.18, DTOP, 0.18, C.deskLeg, 1.1, DTOP / 2, DFZ + 0.45);

  // ── MacBook on the desk (screen faces the horse; logo faces the viewer) ───
  var macG = new THREE.Group(); turntable.add(macG);
  macG.position.set(0, DTOP + 0.11, DFZ - 0.05);
  box(1.25, 0.07, 0.82, metalMat(C.alu), 0, 0, 0, macG);          // base
  box(1.12, 0.016, 0.5, metalMat(C.aluDk), 0, 0.045, -0.1, macG); // keyboard well
  box(0.95, 0.02, 0.4, C.screen, 0, 0.052, -0.12, macG);         // keys
  box(0.38, 0.008, 0.24, 0x2c2f36, 0, 0.05, 0.28, macG);         // trackpad
  var lid = box(1.25, 0.74, 0.05, metalMat(C.alu), 0, 0.36, 0.42, macG); lid.rotation.x = 0.32;
  var scr = box(1.08, 0.62, 0.02, metalMat(C.screen), 0, 0.36, 0.4, macG); scr.rotation.x = 0.32;
  scr.material = new THREE.MeshStandardMaterial({ color: C.screenLit, roughness: 0.3, emissive: 0x2b4b57, emissiveIntensity: 0.5 });
  var logo = box(0.15, 0.17, 0.02, 0xffffff, 0, 0.4, 0.45, macG); logo.rotation.x = 0.32;
  logo.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0x333333, emissiveIntensity: 0.15 });

  // ── little plant, back corner of the desk ────────────────────────────────
  box(0.3, 0.3, 0.3, C.pot, 0.95, DTOP + 0.23, DFZ + 0.28);
  box(0.09, 0.36, 0.09, C.leaf, 0.95, DTOP + 0.5, DFZ + 0.28);
  box(0.28, 0.12, 0.28, C.leaf, 0.95, DTOP + 0.64, DFZ + 0.28);

  // ── contact shadow ──────────────────────────────────────────────────────
  var c = document.createElement('canvas'); c.width = c.height = 128;
  var g = c.getContext('2d');
  var rad = g.createRadialGradient(64, 64, 4, 64, 64, 60);
  rad.addColorStop(0, 'rgba(60,40,25,0.30)'); rad.addColorStop(1, 'rgba(60,40,25,0)');
  g.fillStyle = rad; g.fillRect(0, 0, 128, 128);
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 5.2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.02, 0.2); scene.add(shadow);

  // ── mount: body overlay anchored over the hero top (React tree untouched) ─
  function hero() { return document.querySelector('.framer-c57h6 .framer-1jhguc6'); }

  var RATIO = 0.9;
  function place() {
    var h = hero();
    if (!h) return false;
    var hr = h.getBoundingClientRect();
    if (hr.width < 10) return false;
    var sx = window.pageXOffset || document.documentElement.scrollLeft;
    var sy = window.pageYOffset || document.documentElement.scrollTop;
    var narrow = window.innerWidth <= 640;
    // clearance below the nav pill, and a smaller footprint on phones
    var NAV_CLEAR = narrow ? 66 : 96;
    var maxW = narrow ? 196 : 300;
    var factor = narrow ? 0.56 : 0.72;
    var w = Math.min(maxW, hr.width * factor);
    var ht = w * RATIO;
    var left = hr.left + sx + (hr.width - w) / 2;       // centered on the hero
    var top = hr.top + sy + NAV_CLEAR;                  // just below the nav pill
    stage.style.width = w + 'px';
    stage.style.height = ht + 'px';
    stage.style.left = Math.round(left) + 'px';
    stage.style.top = Math.round(top) + 'px';
    renderer.setSize(w, ht, false);
    camera.aspect = w / ht; camera.updateProjectionMatrix();
    stage.style.opacity = '1';
    return true;
  }

  // ── animation ───────────────────────────────────────────────────────────
  var clock = new THREE.Clock();
  var introDur = 2.2, spins = 3.0, slow = 0.18;
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  var visible = true, hidden = false;
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || hidden) return;
    var t = clock.getElapsedTime(), rot;
    if (REDUCED) rot = t * slow;
    else if (t < introDur) rot = easeOut(t / introDur) * spins * Math.PI * 2;
    else rot = spins * Math.PI * 2 + (t - introDur) * slow;
    turntable.rotation.y = rot;
    renderer.render(scene, camera);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0 }).observe(stage);
  }
  document.addEventListener('visibilitychange', function () { hidden = document.hidden; });
  addEventListener('resize', place, { passive: true });
  // re-append if React ever wipes body-level nodes, and keep anchored as layout settles
  if ('MutationObserver' in window) {
    var mo = new MutationObserver(function () {
      if (!document.contains(stage)) { document.body.appendChild(stage); }
    });
    mo.observe(document.body, { childList: true });
  }

  var tries = 0;
  (function settle() {
    var ok = place();
    if (++tries < 40) setTimeout(settle, ok ? 600 : 120);
  })();
  frame();
})();
