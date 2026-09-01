/* ── card wall ──────────────────────────────────────────────────────────────
   Written for this scene, from an analysis of the reference rather than from
   its code.

   What the reference does, measured off a 1920x960 capture and a look at the
   live page:

     · one full-screen WebGL2 canvas (a Nuxt bundle, nothing global) — so the
       wall belongs in the renderer we already have, not a second one
     · the cards are one continuous curved surface, not a row of tiles: seams
       between them are hairlines, and the card over the centre BOWS while its
       neighbours turn sharply away
     · a centre card measures 44% of frame width and 58% of height, with a
       sagitta of roughly 4.7% of its width
     · each card carries its name inside the bottom-left and a round arrow
       inside the bottom-right — inside the card, not floating beside it
     · it scrolls horizontally for ever, by drag, with momentum that decays
       smoothly and never snaps to a slot

   The bow is the whole trick and it is worth being precise about why. The wall
   is a single parabola z = -k(u - apex)^2 evaluated in strip coordinates, and
   every card evaluates the SAME function of u. So neighbouring cards agree at
   their shared edge and the surface is continuous; a card sitting over the
   apex is bent by the curvature there, while one further out is effectively a
   flat panel rotated away. Curvature is constant, so no bend travels along the
   wall as it scrolls — the shape is identical everywhere and only the cards
   move through it. Laying the cards out with per-card rotations instead would
   give visible creases and a bend that slides.                              */

const CARD_W = 3.46;          // 1.73:1, a browser viewport
const CARD_H = 2.00;
const SEAM   = 0.14;          // hairline, per the capture
const SPACING = CARD_W + SEAM;
/* Gentle. At 0.34 a card one place along sits so much further back that it
   curls out of frame and the wall reads as a barrel seen from inside; the
   reference is a shallow arc that runs off both edges of the screen with four
   cards showing. Recession per step is CURVE * SPACING^2, so this is the
   single number that decides wall-versus-cylinder. */
const CURVE  = 0.115;
const APEX   = 0.0;           // strip coordinate the wall is nearest at
const SEG_X  = 64, SEG_Y = 40;

/* velocity decays to 0.855 of itself every 60fps frame in the reference, a
   clean single exponential with no late pull toward a slot. Expressed as a
   rate so it is frame-rate independent: 0.855 = e^(-k/60). */
const DECAY = -60 * Math.log(0.855);   // ~9.4 per second

const VS = `
  uniform float uOff, uCurve, uApex;
  uniform vec2  uPress;
  uniform float uPressAmt, uPressR, uPressDepth, uTime;
  varying vec2  vUv;
  varying float vPress;
  void main(){
    vUv = uv;
    vec3 p = position;

    /* u is the position along the whole strip, so every card evaluates one
       shared parabola and the surface stays continuous across the seams */
    float u  = uOff + p.x;
    float du = u - uApex;
    float z  = -uCurve * du * du;

    /* a soft-body dent under the cursor: a gaussian well with a slightly
       raised lip, and a slow ripple riding on it so it reads as a skin
       being pushed rather than a shape being scaled */
    float r    = length((p.xy - uPress) / uPressR);
    float g    = exp(-r * r);
    float lip  = (1.0 - 1.7 * r * r) * g;
    float ripple = sin(r * 6.5 - uTime * 2.6) * g * 0.15;
    float press = uPressAmt * (lip + ripple);
    z -= press * uPressDepth;
    vPress = press;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(u, p.y, z, 1.0);
  }`;

const FS = `
  precision highp float;
  uniform sampler2D uPage;
  uniform float uFade, uScroll, uSpan, uAspect, uCorner;
  varying vec2 vUv;
  varying float vPress;
  void main(){
    /* the page creeps on a loop so a card reads as a site, not a still */
    float pv = fract(vUv.y * uSpan + uScroll);
    vec3 col = texture2D(uPage, vec2(vUv.x, pv)).rgb;

    col *= 1.0 - vPress * 0.30;      // the dent shades, the lip catches light

    /* rounded corners, analytic so they stay sharp at any size. Into ALPHA:
       painting them into colour would put black corners over the sky. */
    vec2 he = vec2(uAspect, 1.0) * 0.5 - uCorner;
    vec2 d  = max(abs(vUv - 0.5) * vec2(uAspect, 1.0) - he, 0.0);
    float m = 1.0 - smoothstep(0.0, 0.006, length(d) - uCorner);

    gl_FragColor = vec4(col, m * uFade);
  }`;

/* Stand-in card art: a tall page with a few stacked screens so the loop reads
   as scrolling site content. Swap for real captures when they exist. */
function placeholderPage(THREE, card) {
  const W = 512, screens = 3, H = Math.round(W / (CARD_W / CARD_H)) * screens;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const band = H / screens;

  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, card.a); grad.addColorStop(1, card.b);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  for (let s = 0; s < screens; s++) {
    const y = s * band;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(W * 0.07, y + band * 0.12, W * 0.86, band * 0.44);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let r = 0; r < 3; r++) {
      g.fillRect(W * 0.07, y + band * 0.66 + r * band * 0.07,
                 W * (0.58 - r * 0.13), band * 0.03);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/* CPU twin of the shader's parabola. Anything that needs to know where a card
   actually is — the labels here, hit testing later — must evaluate the same
   function the GPU does, or it will disagree with what is on screen. */
function wallPoint(off, lx, ly, out) {
  const u = off + lx, du = u - APEX;
  return out.set(u, ly, -CURVE * du * du);
}

export function createCardWall(THREE, cards, opts) {
  opts = opts || {};
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(CARD_W, CARD_H, SEG_X, SEG_Y);
  const span = cards.length * SPACING;

  const items = cards.map(function (card, i) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false,
      uniforms: {
        uPage: { value: placeholderPage(THREE, card) },
        uOff: { value: 0 }, uCurve: { value: CURVE }, uApex: { value: APEX },
        uFade: { value: 0 }, uScroll: { value: i * 0.17 }, uSpan: { value: 1 / 3 },
        uAspect: { value: CARD_W / CARD_H }, uCorner: { value: 0.05 },
        uPress: { value: new THREE.Vector2(0, -99) }, uPressAmt: { value: 0 },
        uPressR: { value: 1.05 }, uPressDepth: { value: 0.30 },
        uTime: { value: 0 }
      }
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;   // the shader moves the vertices; bounds lie

    const name = document.createElement('span');
    name.className = 'cwName';
    name.textContent = card.title;
    const go = document.createElement('span');
    go.className = 'cwGo';
    go.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h13M11 5l5 5-5 5"/></svg>';

    group.add(mesh);
    return { mesh: mesh, u: mat.uniforms, name: name, go: go, off: 0,
             drift: 0.022 + (i % 3) * 0.006 };
  });

  const layer = document.createElement('div');
  layer.className = 'cardWall';
  layer.setAttribute('aria-hidden', 'true');
  items.forEach(function (it) { layer.appendChild(it.name); layer.appendChild(it.go); });

  /* the reference never sits still — it drifts, and a drag rides on top of
     that rather than replacing it */
  const DRIFT = 0.34;   // wall units per second
  let pos = 0, vel = 0, pressAmt = 0, dragging = false, lastX = 0, moved = 0;
  const press = new THREE.Vector2(0, -99);
  const _v = new THREE.Vector3();

  /* Drag lives on a DOM element rather than the canvas: the sky canvas sits
     behind the page and never sees the pointer. */
  function bindDrag(el, unitsPerPx) {
    el.addEventListener('pointerdown', function (e) {
      dragging = true; moved = 0; lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx);
      const step = -dx * unitsPerPx();
      pos += step;
      vel = step;                 // carry the hand's speed into the release
    });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function update(dt, fade, pressLocal) {
    group.visible = fade > 0.005;
    if (!group.visible) return;

    if (!dragging) {
      pos += DRIFT * dt;              // the carousel always moves
      pos += vel;
      vel *= Math.exp(-DECAY * dt);   // frame-rate independent, no snapping
      if (Math.abs(vel) < 1e-5) vel = 0;
    }

    if (pressLocal) {
      press.set(pressLocal.x, pressLocal.y);
      pressAmt += (1 - pressAmt) * Math.min(1, dt * 7);
    } else {
      pressAmt += (0 - pressAmt) * Math.min(1, dt * 6);
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let off = i * SPACING + pos;
      off = ((off % span) + span) % span;      // endless, without moving the group
      if (off > span / 2) off -= span;
      it.off = off;
      it.u.uOff.value = off;
      it.u.uFade.value = fade;
      it.u.uTime.value += dt;
      it.u.uScroll.value = (it.u.uScroll.value + dt * it.drift) % 1;
      /* uPress is in CARD-local x — the shader adds uOff afterwards — so the
         same point on the wall is a different local x on every card */
      it.u.uPress.value.set(press.x - off, press.y);
      it.u.uPressAmt.value = pressAmt;
    }
  }

  /* Name and arrow sit INSIDE the card near its bottom edge, so they are
     placed from points on the card's own surface rather than from its corners
     — which means they ride the bow instead of floating off it. */
  function layoutLabels(camera, w, h) {
    const insetX = CARD_W * 0.40, insetY = CARD_H * 0.36;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const near = Math.abs(it.off - APEX) < SPACING * 1.2;
      it.name.style.display = it.go.style.display = near ? 'block' : 'none';
      if (!near) continue;

      wallPoint(it.off, -insetX, -insetY, _v).applyMatrix4(group.matrixWorld).project(camera);
      it.name.style.transform = 'translate(' + ((_v.x * .5 + .5) * w).toFixed(1) +
        'px,' + ((-_v.y * .5 + .5) * h).toFixed(1) + 'px)';

      wallPoint(it.off, insetX, -insetY, _v).applyMatrix4(group.matrixWorld).project(camera);
      it.go.style.transform = 'translate(' + ((_v.x * .5 + .5) * w).toFixed(1) +
        'px,' + ((-_v.y * .5 + .5) * h).toFixed(1) + 'px)';
    }
  }

  return { group, layer, items, update, layoutLabels, bindDrag,
           CARD_W, CARD_H, SPACING, span,
           isDragging: function () { return dragging; },
           dragged: function () { return moved; } };
}
