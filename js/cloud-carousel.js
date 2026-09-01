/* ── the curved card wall, living inside the sky scene ──────────────────────
   Ported from the standalone study (curved-carousel.html), which ran its own
   THREE.WebGLRenderer on its own canvas against Three r128 from a CDN. Two
   renderers and two copies of Three on one page is two GL contexts, two frame
   loops and two versions of the same library, so the wall is rebuilt here as
   an ordinary Group inside the journey's existing scene instead.

   Three changes were needed to make it portable:

   1. The study's vertex shader ends `viewMatrix * vec4(u, p.y, z, 1.0)`,
      skipping the model matrix entirely — the wall is pinned to world origin
      and cannot be moved. It reads modelViewMatrix here, so the Group's
      transform applies and the wall can be placed and scaled in the sky.

   2. Its fragment shader multiplies colour by the rounded-corner mask and
      leaves alpha at 1, so corners come out black. That is invisible on the
      study's near-black page and very visible over a blue sky, so the mask
      moves into alpha.

   3. uFade mixed toward black, which would darken the sky as the wall
      arrived. It scales alpha now, so the wall fades in from nothing.

   The parabola, the poke and the scroll physics are the study's, unchanged.  */

export const CFG = {
  cardW: 3.46, cardH: 2.00, gap: 0.455,
  /* one parabola for the whole wall: Z = -curve * (u - apexX)^2. Every card
     evaluates the same function of u, so they form one continuous surface —
     the card over the apex bends, its neighbours read as flat panels angled
     away. Constant curvature is also why the motion is smooth: no bend
     travels through the cards, it is identical everywhere. */
  /* 0.4118 was fitted to the study's 42 deg camera. This scene is 55 deg and
     sees much more of the wall at once, so the same constant turned the
     neighbours edge-on. Gentler here keeps a readable band across frame. */
  curve: 0.155, apexX: 0.31,
  segX: 72, segY: 44,
  pokeR: 1.05, pokeDepth: 0.30, pokeRing: 1.70, pokeRipple: 0.15, pokeLag: 0.15,
  lerp: 0.122,            // velocity decay per frame, measured off the original
  zoom: 1.14,
  corner: 0.05,
  pageH: 3,               // each card's texture is a three-screen-tall page
  texW: 620
};
const SPACING = CFG.cardW + CFG.gap;
const ASPECT = CFG.cardW / CFG.cardH;

const VS = `
  uniform float uOff, uScale, uLift, uCurve, uApex;
  uniform vec2  uPoke;
  uniform float uPokeAmt, uPokeR, uPokeDepth, uPokeRing, uPokeRipple, uTime;
  varying vec2 vUv; varying vec2 vRawUv; varying float vDepth; varying float vPress;
  void main(){
    vRawUv = uv;
    vec3 p = position;
    p.x *= uScale; p.y *= uScale;

    float u  = uOff + p.x;
    float du = u - uApex;
    float z  = -uCurve * du * du + uLift;

    /* a gaussian dip under the cursor, a raised ring around it, and a slow
       travelling ripple riding on top — soft-body, not a scale */
    float pr   = length((p.xy - uPoke) / uPokeR);
    float g    = exp(-pr * pr);
    float hat  = (1.0 - uPokeRing * pr * pr) * g;
    float ring = sin(pr * 6.5 - uTime * 2.6) * g * uPokeRipple;
    float press = uPokeAmt * (hat + ring);
    z -= press * uPokeDepth;
    vPress = press;

    /* the skin stretches as it deforms, so drag the texture with it */
    vUv = uv - normalize(p.xy - uPoke + vec2(1e-5)) * press * 0.028;

    /* modelViewMatrix, not viewMatrix — this is the change that lets the wall
       sit anywhere in the scene instead of at world origin */
    vec4 mv = modelViewMatrix * vec4(u, p.y, z, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const FS = `
  precision highp float;
  uniform sampler2D uPage;
  uniform float uBright, uFade, uScroll, uSpan, uAspect, uCorner, uZoom;
  varying vec2 vUv; varying vec2 vRawUv; varying float vDepth; varying float vPress;
  void main(){
    /* the page scrolls on a loop, so the card plays like a site preview */
    vec2 z = (vUv - 0.5) * uZoom + 0.5;
    float pv = fract(z.y * uSpan + uScroll);
    vec3 col = texture2D(uPage, vec2(z.x, pv)).rgb;

    /* the raised ring catches light, the dip falls into shadow */
    col *= 1.0 - vPress * 0.30;
    col *= uBright;

    /* analytic rounded corners, resolution independent — into ALPHA, so the
       corners are cut out rather than painted black over the sky */
    vec2 he = vec2(uAspect, 1.0) * 0.5 - uCorner;
    vec2 d  = max(abs(vRawUv - 0.5) * vec2(uAspect, 1.0) - he, 0.0);
    float m = 1.0 - smoothstep(0.0, 0.006, length(d) - uCorner);

    gl_FragColor = vec4(col, m * uFade);
  }`;

/* Placeholder card art. Three stacked bands make a page that reads as a site
   preview as it loops. Replaced wholesale once real shots exist. */
function pageTexture(THREE, card, i) {
  const W = CFG.texW, H = Math.round(W / ASPECT) * CFG.pageH;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const band = H / CFG.pageH;

  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, card.a); g.addColorStop(1, card.b);
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  for (let s = 0; s < CFG.pageH; s++) {
    const y0 = s * band;
    x.fillStyle = 'rgba(255,255,255,0.10)';
    x.fillRect(W * 0.08, y0 + band * 0.16, W * 0.84, band * 0.42);
    x.fillStyle = 'rgba(255,255,255,0.16)';
    for (let r = 0; r < 3; r++) {
      x.fillRect(W * 0.08, y0 + band * 0.68 + r * band * 0.075,
                 W * (0.62 - r * 0.14), band * 0.035);
    }
  }
  x.fillStyle = '#fff';
  x.font = '600 ' + Math.round(W * 0.075) + 'px Sora, system-ui, sans-serif';
  x.fillText(card.title, W * 0.08, band * 0.62);
  x.fillStyle = 'rgba(255,255,255,0.72)';
  x.font = '500 ' + Math.round(W * 0.042) + 'px Sora, system-ui, sans-serif';
  x.fillText(card.tag, W * 0.08, band * 0.62 + W * 0.075);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

export function createCarousel(THREE, cards, maxAniso) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(CFG.cardW, CFG.cardH, CFG.segX, CFG.segY);

  const items = cards.map((card, i) => {
    const page = pageTexture(THREE, card, i);
    if (maxAniso) page.anisotropy = maxAniso;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false,
      uniforms: {
        uPage: { value: page },
        uOff: { value: 0 }, uScale: { value: 1 }, uLift: { value: 0 },
        uCurve: { value: CFG.curve }, uApex: { value: CFG.apexX },
        uBright: { value: 1 }, uFade: { value: 0 },
        uScroll: { value: Math.random() }, uSpan: { value: 1 / CFG.pageH },
        uAspect: { value: ASPECT }, uCorner: { value: CFG.corner },
        uZoom: { value: CFG.zoom },
        uPoke: { value: new THREE.Vector2(0, -99) }, uPokeAmt: { value: 0 },
        uTime: { value: 0 }, uPokeR: { value: CFG.pokeR },
        uPokeDepth: { value: CFG.pokeDepth }, uPokeRing: { value: CFG.pokeRing },
        uPokeRipple: { value: CFG.pokeRipple }
      }
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;      // the shader moves vertices; the bounds lie
    group.add(m);
    return { mesh: m, u: mat.uniforms, speed: 0.03 + (i % 4) * 0.008 };
  });

  const span = items.length * SPACING;
  let pos = 0, vel = 0, poked = 0;
  const poke = new THREE.Vector2(0, -99);

  /* dt seconds, fade 0..1, drive is scroll velocity in wall units, and
     pokeLocal is the cursor in the wall's own coordinates (x along the strip,
     y up the card) or null when the pointer is away. */
  function update(dt, fade, drive, pokeLocal) {
    group.visible = fade > 0.005;
    if (!group.visible) return;

    vel += drive;
    pos += vel;
    vel *= 1 - CFG.lerp;          // single exponential decay, no snapping

    if (pokeLocal) {
      poke.set(pokeLocal.x, pokeLocal.y);
      poked += (1 - poked) * 0.12;
    } else {
      poked += (0 - poked) * 0.10;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      /* wrap each card into the window around the apex so the strip is
         endless without ever moving the Group */
      let off = i * SPACING + pos;
      off = ((off % span) + span) % span;
      if (off > span / 2) off -= span;
      it.u.uOff.value = off;
      it.u.uFade.value = fade;
      it.u.uTime.value += dt;
      it.u.uScroll.value = (it.u.uScroll.value + dt * it.speed) % 1;
      /* uPoke is in CARD-local x (the shader adds uOff after), so the same
         wall position is a different local x on every card. Sharing one value
         would dent all of them identically instead of denting the wall once. */
      it.u.uPoke.value.set(poke.x - off, poke.y);
      it.u.uPokeAmt.value = poked;
    }
  }

  return { group, update, items, SPACING, span };
}
