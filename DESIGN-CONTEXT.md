# Portfolio Design Context — Ajeet Design

> Reference doc for building **new case-study pages** that match the existing portfolio
> (`index.html`, live at `vivacious-blackberry-492653.legacy export.app`).
> Source is a **legacy export** (static SSR HTML + `js/*.mjs` runtime + `images/`).
> All visual values below were measured from the live, rendered site.
> Last updated to reflect manual post-export modifications in `responsive.css` + `index.html`.

---

## 1. Overview & Tech

- **Origin:** Built in the legacy export, exported to static HTML/JS. Single page today (`/` and `/test` are the same).
- **Design canvas width:** `1440px` desktop-first, now **fully responsive** via `responsive.css` (viewport meta is `device-width`). Breakpoints: ≤1100 (section headers — Framer gives them fixed widths up to 1010px, must be 100%), ≤1024/768/480 (type steps), ≤900 (cards/bento/About stack), ≤640 (hero flows in-document, nav compact, chips wrap), ≤400 (tightest). Key mobile facts: hero `framer-c3k5qs` needs `flex:none` (its `flex:1 0 0` collapses to height 0); the `::after` role line must use fluid `clamp()` type (pseudo-elements don't inherit Framer's font-size media vars); Contact is converted from absolute 1440-only layout to fluid flex; the icon scroll-flight is desktop-only (≥768 — below that the native About strip shows). Mobile structure changes (≤900/≤640): `framer-1ytk2nj` (About inner wrapper) has FIXED `height:797px + overflow:hidden` — must be auto/visible or it clips the Data/Craft/System strip; `framer-62b2oa` is an empty desktop spacer frame — `display:none` on mobile (it rendered as a huge blank block); company chips wrappers (`framer-18nwjwv`/`framer-d63esj`) get `display:contents` so the label takes its own line and the three chips wrap as one centred row (their container needs `width:100%` — it's min-content otherwise). NOTE: headless Chrome clamps windows to 500px min — test phones via the ≤640 branch at 500px; use a `[data-framer-root] { transform: translateY(-N px) }` debug shift to screenshot page regions (headless scroll doesn't paint).
- **Page background:** pure white `#FFFFFF`.
- **Centered content column:** ~`1020px` wide cards/sections, horizontally centered on the 1440 canvas.
- **Section gutters:** `clamp(16px, 5vw, 180px)` left/right padding, set in `responsive.css`.
- **Fonts load from:** Google Fonts (Geist, IBM Plex Sans, Fira Code, Lato) + local `images/*.woff2` (PP Mori, Inter, Neue Regrade).
- **Local dev server:** `python3 -m http.server 8080` at `http://localhost:8080` (the legacy export JS modules blocked over `file://`).

### Two font worlds (important)
1. **Portfolio chrome** (everything you design — headings, cards, nav, buttons): **`PP Mori`**. This is the brand font. Always use it.
2. **Embedded product mockups** (screenshots inside case-study cards): use product-native fonts (`Inter`, `Geist`, `IBM Plex Sans`, `Fira Code`).

### Modification layer
All customisations live in two places — never edit the export’s generated files:
- **`responsive.css`** — CSS overrides (layout, spacing, borders, gradients, nav glass, hero load keyframes, added content via `::after`)
- **`index.html` `<head>`** — three CDN `<script>` tags: GSAP 3.12.5, ScrollTrigger, Lenis 1.1.14 (load over `https://` so they work even on `file://`)
- **`index.html` (before `</body>`)** — injected blocks, in order:
  1. `<style>` — subtitle loop keyframe/class CSS
  2. Visibility-fix `<script>` — strips `opacity:0` from the export’s SSR inline styles (the legacy export JS is blocked over `file://`, so initial animation states stay stuck). **Skips `[data-gsap-managed]` elements** so GSAP-revealed items stay hidden until scrolled to.
  3. Subtitle-loop `<script>` — replaces the static subtitle element with two alternating phrases
  4. Lenis + GSAP ticker `<script>` — smooth scroll, synced to ScrollTrigger
  5. GSAP scroll-reveal `<script>` — unified entrance animations for every section (see §6)
  6. (Removed) the old IntersectionObserver About reveal — superseded by the GSAP layer

### Key the legacy export patterns to know
- **Border system:** the legacy export uses `::after` pseudo-elements on `data-border="true"` elements with CSS variables (`--border-left-width`, `--border-color`, etc.). Override the variables to control borders.
- **React hydration:** the legacy export uses React 18 hydration, which destroys JS-injected DOM nodes. Use CSS `::after` pseudo-elements for persistent added content — not `insertAdjacentElement`. A non-fatal React #405 hydration warning is expected (the visibility-fix mutates SSR markup before React hydrates); it has no visible effect.
- **Framer class prefix:** All Framer rules are scoped to `.framer-c57h6`. Use this in every override selector.
- **GSAP over the legacy export:** GSAP scroll animations run on a ~700ms post-hydration delay and query elements fresh, then tag them `data-gsap-managed`. ScrollTrigger is synced to Lenis via the shared `gsap.ticker`.

---

## 2. Color Palette

### Core (use these for portfolio UI)
| Role | Value | Notes |
|---|---|---|
| Page background | `#FFFFFF` / `rgb(255,255,255)` | Light sections |
| Section background (subtle) | `#efede9` warm off-white | Alternating bands behind cards |
| Heading ink | `#171717` / `rgb(23,23,23)` | Primary headings |
| Body ink (strong) | `#1F1F1F` / `rgb(31,31,31)` | Card titles |
| Body text | `#666666` / `rgb(102,102,102)` | Card subtext, paragraphs |
| Muted / eyebrow | `#737373` / `rgb(115,115,115)` & `#525252` | Subtitles, labels |
| Hero subtitle | `rgb(82,82,82)` | Looping subtitle phrases |
| Card surface | `#FFFFFF` | Card body |
| Button surface | `#FAFAFA` / `rgb(250,250,250)` | Pill buttons |
| Contact / dark section | `#000000` (and near-black `#050505`) | Inverted footer block |
| Text on dark | `#FFFFFF`, muted `rgba(255,255,255,0.6)` | |

### Brand accent
| Role | Value | Notes |
|---|---|---|
| Brand green | `rgb(74,222,128)` `#4ADE80` | Logo mark + section-header icon tiles |
| Green (dark pair) | `rgb(20,83,45)` `#14532D` | Icon detail / shadow |

### "Building with AI" section — dark wireframe room
Applied to `framer-fs20qu` (common parent of heading + bento grid). Near-black band with a
perspective wireframe-room SVG (`images/ai-grid.svg`, generated asset — back-wall grid,
depth lines converging to a centre vanishing point, concentric hoops, scattered `+` marks;
a radial `<mask>` fades all lines toward the vanishing point — full strength at the outer
edges → dissolved at the centre, so the room reads as receding into darkness)
plus an edge vignette. Also `padding: 72px 0` on `framer-fs20qu` for extra breathing room.
The background layers use `--ai-*` CSS vars (default 0) driven by the **cursor-parallax
script** in `index.html` (§6.5): grid + glows drift with the mouse, and a cursor-following
indigo spotlight layer (`--ai-cx`/`--ai-cy`) sits between the vignette and the grid:
```css
/* top → bottom: edge vignette, wireframe room, AI aurora glows, base */
background:
  radial-gradient(ellipse 85% 75% at 50% 45%, rgba(5,5,5,0) 45%, rgba(5,5,5,0.55) 100%),
  url("images/ai-grid.svg") center / cover no-repeat,
  radial-gradient(ellipse 55% 40% at 50% 42%, rgba(99,102,241,0.18) 0%, transparent 65%),  /* indigo core at vanishing point */
  radial-gradient(ellipse 70% 50% at 10% 6%, rgba(74,222,128,0.15) 0%, transparent 55%),   /* brand green, top-left */
  radial-gradient(ellipse 65% 55% at 92% 88%, rgba(168,85,247,0.15) 0%, transparent 55%),  /* violet, bottom-right */
  radial-gradient(ellipse 50% 45% at 88% 8%, rgba(56,189,248,0.10) 0%, transparent 60%),   /* cyan hint, top-right */
  #050505;
```
Inside the dark band (all in `responsive.css`, scoped under `.framer-fs20qu`):
- Title (`framer-1kewby2 .framer-text`) → `#fff`, plus a lime `*` accent via `::after` (`#4ADE80`)
- Subtitle (`framer-1098nfj .framer-text`) → `rgba(255,255,255,0.65)`
- Framer border vars on `framer-xinqve` / `framer-hyxuu` / `framer-jnm7s7` → `rgba(255,255,255,0.14)`
- Bento tiles stay white — they pop against the dark room

### Case-study accent panels (the colored image area in each card)
Each "Selected Work" card pairs white text on the left with a **full-bleed colored media panel** on the right. Rotate accent colors per card:
- **Lavender** — soft `#E9E6FB` / light violet gradient
- **Royal blue** — vivid `#2C2CF0`-ish blue
- **Sky→sand** — top sky blue fading to warm beige/tan
- **Beige/warm grey** — neutral fallback

---

## 3. Typography Scale (PP Mori)

All measured from the live site. `letter-spacing` is consistently slightly negative (~`-0.02em` to `-0.04em`) on large type.

| Token | Family | Size / Line | Weight | Letter-spacing | Color |
|---|---|---|---|---|---|
| **Hero H1** ("Hey, I'm Ajeet") | PP Mori | `48px / 55.2px` | 700 | `-1.92px` (-0.04em) | `#171717` |
| **Hero role line** ("Senior Product Designer") | PP Mori | `48px / 55.2px` | 700 | `-0.04em` | `#171717` |
| **Hero subtitle** (looping) | PP Mori | `24px / 32px` | 400 | normal | `rgb(82,82,82)` |
| **Contact H1** ("Lets Build…") | PP Mori | `48px / 57.6px` | 700 | `-0.96px` (-0.02em) | `#FFFFFF` |
| **Section title** ("Selected Work", "Building with AI", "Give it a read") | PP Mori | `40px / 48px` | 800 | `-0.8px` (-0.02em) | `#171717` |
| **Big word stack** ("Data." "Craft." "System.") | PP Mori | `40px / 41.25px` | 800 | normal | `#262626` |
| **Section subtitle** ("Let's deep dive into…") | PP Mori | `18px / 21.6px` | 400 | normal | `#737373` |
| **Card title** ("Improving conversion…") | PP Mori | `24px / 28px` | 700 | `-0.48px` (-0.02em) | `#1F1F1F` |
| **Card subtext** | PP Mori | `14px / 16.8px` | 500 | `-0.28px` (-0.02em) | `#666666` |
| **Button label** ("Read Case Study") | PP Mori | `16px / 24px` | 600 | normal | `#000000` |
| **Eyebrow / label** ("Currently designing at") | PP Mori | `14px / 28px` | 400 | normal | `#525252` |

**Rule of thumb for case-study pages:**
- Page/case title: 40–48px / 800.
- Section heading inside a case study: 24–32px / 700.
- Body copy: 16–18px / 400–500, line-height ~1.4–1.6, color `#666`.
- Captions/labels: 14px / 500, muted.

---

## 4. Spacing, Radii, Shadows

### Border radius (observed)
- **Pill / fully rounded** (nav, buttons): effectively infinite (`~16777216px` → use `border-radius: 9999px`).
- **Cards (outer):** `48px` (large, soft).
- **Media panel inside card / large image:** ~`32px`.
- **Smaller tiles / icon containers:** `12–26px`.
- **Inputs / small chips inside mockups:** `4–8px`.

### Padding
- Card body padding: `24px`.
- Pill buttons: `12px 20px`.

### Hero section spacing (after modifications)
- Badges → Heading block: `28px` top padding
- "Hey, I'm Ajeet" → "Senior Product Designer": `6px` gap
- Heading block → Subtitle: `20px` top padding
- Subtitle → Company chips: `28px` top padding

### Shadows
- **Buttons (the signature look):**
  `box-shadow: 0 0 1px rgba(0,0,0,0.2), inset 0 0 12px rgba(0,0,0,0.09);`
- **Nav pill (liquid glass, current):** see §5.1 — multi-layer inset + outer shadow over a near-opaque dark translucent fill.
- Cards generally **flat** (no drop shadow).

---

## 5. Components

### 5.1 Floating Nav Pill (fixed) — liquid glass (current)
- Fixed/sticky, centered at top, floats over content. `border-radius: 84px`, height `64px`, width `min(680px, 100vw-24px)`.
- **Liquid-glass material** (overrides in `responsive.css` on `framer-1ooizrb`):
  - `background: rgba(12,12,12,0.92)` (near-opaque dark — user dialled it dark; lighter glass read poorly)
  - `backdrop-filter: blur(40px) saturate(180%) brightness(1.05)`
  - `border: 1px solid rgba(255,255,255,0.1)`
  - Multi-layer shadow: inset top specular `rgba(255,255,255,0.14)`, inset bottom `rgba(0,0,0,0.12)`, faint side rims, outer `0 16px 40px rgba(0,0,0,0.14)` + `0 4px 12px rgba(0,0,0,0.08)`.
- `framer-od3clj` (inner nav wrapper) border softened to `rgba(255,255,255,0.1)`.
- Left: **logo** "ajeet design" (white). Right: links **Home / Work / About Me**, divider, **Resume / LinkedIn** (dimmer).
- Nav link text is retyped to **PP Mori 700** (matches the footer "Contact Me" CTA / site headings) via `responsive.css` on `.framer-od3clj .framer-text` — Framer originally shipped them in Geist-600 / Neue Regrade. Font-size left as Framer set it.
- Active link ("Home") is the export’s original **white pill** (a JS glass-tab attempt was tried and reverted — white-on-dark glass looked muddy).

### 5.2 Buttons (primary pill)
- "Read Case Study", "Contact Me", "Add Lender" style.
- Surface `#FAFAFA`, text `#000`, PP Mori 16/600, padding `12px 20px`, fully rounded.
- Signature shadow: `0 0 1px rgba(0,0,0,0.2), inset 0 0 12px rgba(0,0,0,0.09)`.

### 5.3 Hero section (current state after modifications)
- **Top pastel mesh** on `framer-1jhguc6` (in `responsive.css`): four radial gradients anchored
  above the viewport top — lavender `rgba(168,85,247,0.16)` centre, indigo `0.13` left, sky
  `0.11` right, pink `0.07` hint — over `#fff`; fades out by mid-hero. Grid texture sits above it.

the legacy export class keys:
- `framer-1jhguc6` — outer hero wrapper. `min-height: 700px`, `padding-top: 110px` (nav clearance), `position: relative`. Pseudo-elements `::before`/`::after` draw the vertical side lines at `left/right: clamp(16px, 5vw, 180px)`.
- `framer-c3k5qs` — inner flex fill (`flex: 1 0 0`), `padding: 0`, `place-content: center`.
- `framer-5vaexd` — content column, `position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%)`, `width: 100%`. Content is vertically centered by absolute positioning and spans full width between the vertical lines.
- `framer-1sllspy` — inner stack, `width: 100%; max-width: 100%; align-items: center`.

Content (top → bottom):
1. Location / experience badges (`.framer-17et2vx`)
2. "Hey, I'm Ajeet" H1 (`.framer-w7uw4j` → `framer-lxqqn1`)
3. "Senior Product Designer" — added via `responsive.css` `.framer-w7uw4j::after` (CSS pseudo-element; JS injection fails due to React hydration)
4. Looping subtitle — "Designing for complexity" ↔ "Building for scale" — 24px PP Mori, switches every 3s with 380ms fade; implemented via `index.html` `<style>` + `<script>` blocks targeting `.framer-1yfgaui`
5. "Currently designing at" row with company chips (Porter, Juspay, Convin.ai)

### 5.4 Vertical side border lines
- Present across all main sections as a continuous grid column marker.
- **Hero** (`framer-1jhguc6`): custom `::before`/`::after` gradient lines:
  ```css
  background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.05) 12%, rgba(0,0,0,0.05) 88%, transparent 100%);
  ```
  Positioned at `left/right: clamp(16px, 5vw, 180px)` — fade in from top, hold faint in middle, fade out at bottom. (Opacity `0.05` — user wanted them subtle.)
- **All other structure lines are light solid** (in `responsive.css`): the the legacy export wrapper
  borders (`xiaegt/eh96xg/e64r2n/1szzpcb/xsn7i4/cqrbvk/1xl1f7w/1m7zsgh/n5o53k`) are forced
  `--border-style: solid` with `--border-color: rgba(0,0,0,0.05)` (lighter than the original
  `#e5e5e5`, formerly dashed in places). Main sections keep 1px L/R side rails. AI dark band
  (`xinqve/hyxuu/jnm7s7`) uses `rgba(255,255,255,0.10)`. (A gradient-fade version was tried
  and reverted — user prefers solid.)
- Content in all sections is aligned to match these line positions (section padding = `clamp(16px, 5vw, 180px)`).

### 5.4b Hero grid texture
- The faint graph-paper grid behind the hero is an SVG (`framer-18ss2ql`, `svg297365751...` sibling) with `stroke-opacity: 0.09` strokes. Container `opacity: 0.45` in `responsive.css` knocks it back to a barely-there texture (user-tuned). Also receives the scroll parallax (§6.2).
- **`mix-blend-mode: multiply`** on the grid container — the SVG has white baked into its box, which showed rectangular edges against the top pastel mesh; multiply melts the white away.
- (Correction: `framer-1nmolxk` is NOT a hero haze — it is the 14px icon inside the Bangalore badge; see §5.5. The mesh seam was fixed solely by the grid multiply above.)

### 5.5 Badges / meta chips (hero)
- One segmented pill: **green map pin + "Bangalore" │ "5+ Years"** (`framer-lgi26s` = pill,
  `framer-lzod0m`/`framer-10pjkrx` = segments, `framer-1nmolxk` = 14px icon replaced with a
  brand-green pin data-URI in `responsive.css`).
- White fill, `#e8e8e8` border, `#ececec` divider, `0 1px 2px rgba(0,0,0,0.05)` shadow,
  segment padding `9px 14–17px`, labels PP Mori 13px/500 `#4b4b4b`, **pin icon same `#4b4b4b`**, fully rounded.
- Hero load animation targets the pill itself (`framer-lgi26s`) — NOT `framer-17et2vx`,
  which is the "5+ Years" segment inside it (animating that slid the text out of the pill).

### 5.6 Company chips ("Currently designing at")
- Inline row: muted label + divider + chips (Porter `framer-ipsl1e`, Juspay `framer-1x127ba`, Convin.ai `framer-lna641`).
- **Chip style (overridden in `responsive.css`):** white fully-rounded pill (`border-radius: 9999px`), `1px #e5e5e5` border, `padding: 7px 15px 7px 9px`, soft `0 1px 2px` shadow, `#e8e8e8` border (matches the hero badge pill); logo = 22px circle (border-radius 50%); name = PP Mori 14px/600 `#171717`.

### 5.7 Section header (repeated pattern)
Used before each major section ("Selected Work", "Building with AI", "Give it a read"):
- **Centered**, stacked:
  1. Small **squircle icon tile** (48px, rounded square + slight tilt, bold dark glyph) — **distinct per section**, replaced via CSS `background` data-URIs in `responsive.css` (original green sprite hidden with `display:none` on the inner svg):
     - Selected Work (`framer-129ann2`) — green `#4ADE80`, rounded triangle (play)
     - Building with AI (`framer-1dhg0jl`) — green `#4ADE80`, dark-green sparkle
     - Give it a read (`framer-1d6ij2w`) — purple `#C084FC`, bookmark
  2. **Title** PP Mori 40px/800 `#171717`.
  3. **Subtitle** PP Mori 18px/400 `#737373` — unique per section: Selected Work = "Let's deep dive into some of my selected work"; Building with AI = "Ideas I design, build and ship end-to-end with AI tools"; Give it a read = "Notes on design, systems and building things".

### 5.8 Selected Work card (THE primary case-study card)
- Outer card: white `#FFFFFF`, `border-radius: 48px`, `padding: 24px`, width ~`1020px`, height ~`420px`, flat.
- **Two-column split:**
  - **Left (~40%):** title (24px/700 `#1F1F1F`), subtext (14px/500 `#666`), **"Read Case Study"** pill button.
  - **Right (~55–60%):** full-height media panel with colored/gradient background, radius ~32px, device mockups.
- Cards stacked vertically with generous gap; accent color rotates per card.

### 5.9 "Building with AI" bento grid
- Same section header pattern — but on this section the title is **white** with a lime `*` accent and the subtitle is `rgba(255,255,255,0.65)` (dark band).
- Grid of cards (mix of 2-up wide + 3-up smaller) — bento layout.
- **Tiles are glassmorphism** (overrides in `responsive.css`, scoped under `.framer-fs20qu`):
  white sheen fill (`linear-gradient 180deg, rgba(255,255,255,0.12) → 0.05 → 0.03`) +
  `backdrop-filter: blur(28px) saturate(180%) brightness(1.6)` — the brightness lift is what
  separates the glass from the dark room. Border var `rgba(255,255,255,0.20)`, top specular
  `inset 0 1px 0 rgba(255,255,255,0.22)` + bottom `inset 0 -1px 0 rgba(0,0,0,0.30)`,
  seat shadows `0 24px 60px rgba(0,0,0,0.55)` + `0 4px 14px rgba(0,0,0,0.35)`.
  Each tile carries a faint radial **aurora tint sampled from the section background** —
  itx7f green TL, 19ebriy indigo TR, 7byk6d violet TL, 1kfbg45 cyan TR, jwdy93 green→violet bottom.
  Tile titles `#fff`, subtexts `rgba(255,255,255,0.62)` (classes: pyirc/1ijirur/1ijrbrw/idu6b3/a4e0zk
  + 1x1arje/z5yd7p/kdwpoz/qe8wrw/1u0roqr).
- **Section background:** dark wireframe room — `#050505` + perspective grid SVG (`images/ai-grid.svg`) + edge vignette, applied to `framer-fs20qu` (common parent of heading + bento). See §2 for the exact stack.

### 5.10 "Give it a read" article list — HIDDEN (kept for future use)
- Currently hidden via `display: none` on `framer-nc5g3x` in `responsive.css` — delete that rule to restore. Markup is untouched.
- Stacked list rows, each a white rounded card:
  - Left: small gradient rounded-square icon tile (~lavender/violet gradient).
  - Then: title (PP Mori ~16–18/600) + subtext (14/muted).
- With it hidden, the dark AI band flows directly into the black Contact band.

### 5.11 Contact / Footer — custom green notched panel
- **The original Framer contact section (`framer-yanuq0`) is `display:none`** — replaced by a
  bespoke footer. The new footer (`#ad-footer`) is a **static block appended to `<body>` by a
  small script, OUTSIDE the the legacy export root**, so React hydration can never destroy it (same
  persistence trick as the splash / icon-flight overlays). All its CSS + markup live in one
  injected `<style>`+`<script>` block at the end of `index.html`.
- **Structure** (mirrors a reference footer): dark `#050505` outer band → a big **brand-green
  (`#4ADE80`) rounded panel** with a **notched top tab** (`::before` bump + `::after` concave
  shoulders), grid lines drawn ON the panel (`linear-gradient` 46px squares in `rgba(5,46,22,.07)`,
  radial-masked so lines concentrate in the **centre and fade before the edges**), and
  dark-green text (`#052e16`). Tall panel (`min-height: min(640px,80vh)`); big dark gap above
  it (`#ad-footer` padding-top `clamp(90px,12vw,200px)`) separates it from the AI section.
  3-column grid: **PAGES** (Home/Work/About Me + Resume accent) · **center** (dark ↗ mark tile
  + "Lets Build Something Together" + dark "Contact Me ↗" pill) · **FOLLOW ON**
  (LinkedIn/Twitter/Dribbble/Instagram). Nav links use the **same typography as the Contact Me
  CTA** (title case, weight 700). Bottom bar: © · Made with ❤.
- **Responsive:** ≤760px the columns stack (center first via `order:-1`), bar centres.
- Links are `href="#"` placeholders — wire real URLs when available.
- **Themeable:** all footer colours are CSS vars on `#ad-footer` (`--adf-panel/ink/soft/accent/
  line/cta-bg/cta-fg/mark-bg/mark-fg`). The green theme is active; a **commented "BLACK footer
  theme" block** sits right below it — uncomment it (it wins the cascade) to switch the whole
  footer to a dark panel with green accents; re-comment to return to green.

---

## 6. Motion & Animation

The animation system is now **GSAP + Lenis driven** (added post-export), layered on top of the export’s own runtime. Three pillars:

### 6.1 Smooth scroll (Lenis)
- `lenis@1.1.14`, init in `index.html` before `</body>`.
- Config: `duration: 1.05`, easing `1 - (1-t)^4` (ease-out-quart), `wheelMultiplier: 1.1`, `touchMultiplier: 1.6`.
- Synced to GSAP: `lenis.on('scroll', ScrollTrigger.update)` + `gsap.ticker.add(t => lenis.raf(t*1000))` + `gsap.ticker.lagSmoothing(0)`.
- Adds a `lenis` class to `<html>` while active.

### 6.2 GSAP scroll-reveal layer
Unified entrance system (`gsap@3.12.5` + ScrollTrigger). Replaced the earlier IntersectionObserver. ~20 elements managed, ~21 triggers. Standard easing `power3.out`. Two helpers:
- `reveal(sel, opts)` — single element. `gsap.set(el, {opacity:0, y/x})` then `ScrollTrigger.create({ trigger: el, start:'top 90%', once:true, onEnter: () => gsap.to(el, {opacity:1, x:0, y:0}) })`.
- `batch(sels, opts)` — `ScrollTrigger.batch` (`start:'top 88%'`), items entering together stagger in via `gsap.to({opacity:1, y:0, scale:1})`.

| Target | Class(es) | Motion |
|---|---|---|
| Section headings | `framer-1i5ns50`, `framer-ag9lum`, `framer-1dpt38s` | fade up `y:36` |
| About bio wrapper (NOT the photo — Framer name "Background") | `framer-652bj3` | slide from left `x:-55, y:24` |
| About bio inner | `framer-hbarid` | slide from right `x:45, y:24` |
| Data/Craft/System | `framer-1ckmuqc`, `framer-ienf2m`, `framer-ssu4pe` | stagger up `y:30`, stagger 0.14 |
| Selected Work cards | `framer-1gmsbj2`, `framer-krhpmx`, `framer-1dv9wgl`, `framer-1pzmip5` | stagger up + scale `y:64, scale:0.96` |
| AI bento tiles | `framer-itx7f`, `framer-19ebriy`, `framer-7byk6d`, `framer-1kfbg45`, `framer-jwdy93` | stagger + scale `y:50, scale:0.94` |
| Article rows | `framer-1226555`, `framer-1ga305s` | stagger up `y:38` |
| Contact heading | `framer-1caux12` | fade up `y:44` |
| Hero grid (parallax) | `framer-18ss2ql` | scrub `yPercent:14` (keep `xPercent:-50` to preserve centering) |
| Hero app icons (orange/green/purple) | `#heroIcoOrange`, `#heroIcoGreen`, `#heroIcoPurple` | springy `back.out(2.2)` pop-in (stagger 0.12, delay 0.85), then infinite `sine.inOut` float+sway loop, different phase per icon |

**Critical — use `opacity`, never `autoAlpha`:** the reveals originally used `autoAlpha` (opacity **+ visibility**). That deadlocked the "Selected Work" heading (`framer-1i5ns50`) at `opacity:1; visibility:hidden` — the visibility-fix script had set `opacity:1` while GSAP's `autoAlpha` had left `visibility:hidden`, and neither released the other, so the heading rendered invisible ("missing"). Fix: both helpers now animate **plain `opacity`** (no `visibility` toggling), so nothing can get stuck. `reveal()` also uses an explicit `ScrollTrigger.create({ once:true })` which fires whether the element loads in view or is scrolled to. Each managed element still gets `data-gsap-managed` so the visibility-fix leaves it alone. The parallax on `framer-18ss2ql` **must** keep `xPercent:-50` (element is centered via `left:50% + translateX(-50%)`).

**Hero app icons:** the three icons below the subtitle are a single `<use>`-referenced SVG sprite (`svg297365751_11010`, inside `framer-1jed50t`). To animate them individually, IDs were added to the three source `<g>` groups in the sprite def: `#heroIcoOrange` (`#FB923C`), `#heroIcoGreen` (`#4ADE80`), `#heroIcoPurple` (`#C084FC`). **`<use>` reflects live transforms on the referenced source groups**, so GSAP animates the `<g>` IDs directly (no DOM duplication). `initHeroIcons()` handles the entrance + float loop; `transformOrigin: '50% 50%'` pivots each icon around its own centre.

### 6.3 CSS load animations (hero)
Hero content fades up on page load via `@keyframes hero-reveal` (in `responsive.css`), staggered: badges 0.15s → heading 0.32s → subtitle 0.52s → company chips 0.7s, each `1s cubic-bezier(0.2,0,0,1) both`.

**Hero subtitle loop** (separate, `index.html` `<style>` + `<script>`):
```css
.hero-subtitle-phrase { opacity: 0; transform: translateY(12px); transition: opacity 0.45s ease, transform 0.45s ease; }
.hero-subtitle-phrase.sub-active { opacity: 1; transform: translateY(0); }
.hero-subtitle-phrase.sub-leaving { opacity: 0; transform: translateY(-14px); transition: opacity 0.35s ease, transform 0.35s ease; }
```
JS alternates `.sub-active` / `.sub-leaving` every 3000ms (380ms leave delay).

### 6.4 the export’s own primitives (still present underneath)
- `opacity 0.4s ease-out` — fade. `transform 0.1s cubic-bezier(0.2, 0, 0, 1)` — snappy transforms. Heavy `will-change`.

### 6.5 "Building with AI" cursor parallax
Own `<script>` block in `index.html` (after the scroll-reveal layer). Desktop only
(`hover: hover` + `pointer: fine`). On `mousemove` over `framer-fs20qu`:
- Sets `--ai-gx/--ai-gy` (wireframe grid drifts opposite the cursor, ±22/±14px),
  `--ai-glx/--ai-gly` (aurora glows drift with the cursor, ±30/±22px) and
  `--ai-cx/--ai-cy` (spotlight position, %) — consumed by the background stack in `responsive.css`.
- Counter-translates the header (`framer-lt1n51`, ±6px) and the two bento rows
  (`framer-dw0zyn` ±10px, `framer-6h1865` ±14px) via `gsap.set` for a depth feel.
- All values lerped on the shared `gsap.ticker` (grid/rows 0.07, spotlight 0.12); writes stop
  once settled (`active` flag) so idle frames cost nothing. `mouseleave` eases back to centre.
- **Deliberately avoids GSAP-revealed elements** (tiles, `framer-ag9lum` heading) so it can
  never fight the scroll-reveal tweens. Guard: `data-ai-parallax` on the section.

### 6.6 Selected Work card hover (cursor-tracking 3D tilt)
Own `<script>` in `index.html`. Desktop only (`hover: hover` + `pointer: fine`). Per card
(`framer-1gmsbj2/krhpmx/1dv9wgl/1pzmip5`, guard `data-tilt-init`):
- **Tilt:** card rotates toward the cursor — `rotationX/Y` up to ±2.5°, `transformPerspective: 1000`,
  via `gsap.quickTo` (0.5s `power3.out`). Rotation channels only — the scroll-reveal batch owns
  card `y/scale/opacity`, and GSAP merges both into one transform, so they never conflict.
- **Media panel** (first of `.framer-acwpcf/.framer-gp6wwv/.framer-vlkxkp/.framer-1qywjkz`
  inside the card): zooms to 1.035 on enter (0.7s) and drifts opposite the cursor (±6/±4px)
  for depth; eases back on leave.
- **Lift shadow:** plain CSS `:hover` in `responsive.css` (`0 10px 28px rgba(0,0,0,0.025)`,
  single layer, 0.5s) — barely-there by design; cards stay flat at rest per §4.
- **CTA state:** on card hover the "Read Case Study" button (`framer-1v76fm8/phqwv3/z62pqu/1bwktwp`)
  inverts to `#171717` with white label, and a `→` arrow slides in (`.framer-text::after`,
  collapsed `max-width: 0` at rest → `20px` + `margin-left: 8px`, 0.35s). Pure CSS in `responsive.css`.

### 6.7 Splash / loader (Uber-style)
Static overlay `#ad-splash` + `<style>` + `<script>` injected before `</body>` (outside the
the legacy export root — hydration never touches it), plus a boot `<style>`/`<script>` in `<head>`:
- `<head>` script adds `splash-boot` (hides `[data-framer-root]` to prevent a pre-splash flash)
  and `splash-hold` (pauses the hero load animations via `animation-play-state`) on `<html>`.
  No-JS never gets the classes; the site renders normally.
- Timeline (GSAP): black bg + **`images/ajeet.svg` wordmark** (same artwork as the nav logo,
  `clamp(170px,20vw,240px)`) fades up 0.55s → holds 0.6s → **curved bouncy flight into the
  nav logo's live rect** (`framer-2nn2jt`, 1.0s): x and y run in parallel on different eases
  (`power2.inOut` vs `back.inOut(1.4)` — the mismatch bends the path into a swoosh), scale
  lands with `back.out(1.8)` overshoot, and a −7° tilt settles via `elastic.out(1.2, 0.45)`.
  (Do NOT use a timeline-callback-created MotionPath tween here — it stalled the shared
  ticker; parallel function-based tweens inside the timeline are the proven pattern.)
  → the 3px white **vertical bar starts expanding mid-flight** (`fly+=0.38`, 0.8s
  `power4.inOut`, the Uber wipe). The logo has `mix-blend-mode: difference` (z-index above
  the bar): white over the black bg, **flips to black wherever the wipe passes under it**,
  then crossfades to the real white nav wordmark (inside the dark pill) as the overlay
  fades 0.35s → `splash-hold` released (hero stagger plays from 0). The real nav wordmark
  sits exactly where the splash logo docked. Body scroll locked during splash.
- **Hydration gotcha:** the nav node must be queried *inside* the flight's function-based
  values (evaluated at tween start) — React hydration replaces the SSR node, so a reference
  captured at script eval goes detached (rect all zeros → scale 0 → logo vanishes).
- Skipped entirely on `prefers-reduced-motion` or if GSAP fails; 6s safety timeout force-removes
  the overlay so it can never trap the page.

### 6.8 Hero icons → About scroll flight (shared element, scrubbed)
Own `<script>` in `index.html`. The three hero icons fly from the hero to the About
"Data/Craft/System" strip as you scroll, fully reversible (ScrollTrigger `scrub: 0.4`):
- **Body-level overlay** (`#icon-flight`, `position:absolute` in doc space, `z-index: 1` —
  must beat `framer-5vaexd`, the hero content column, itself a z:1 stacking context holding
  the company chips; the nav pill is raised to `z-index: 2` in `responsive.css` so the
  icons pass under it,
  appended to `<body>` like the splash): re-renders the sprite via `<use>` — GSAP transforms
  on the sprite's source groups reflect into it. The hero's own copy (`framer-1jed50t`) is
  `visibility: hidden`. This is REQUIRED: the hero subtree sits under a transformed ancestor
  (`framer-5vaexd`, stacking-context cap) inside an `overflow:hidden` section — nothing inside
  it can ever paint above the About section or escape the hero bounds.
- Trigger: hero `top top` → endTrigger `framer-25ip3p` `center 62%`. Vertical travel tweens
  the overlay's `y`; horizontal spread tweens each sprite group's `x` (green → under "Data."
  `framer-pjjl6o`, orange → "Craft." `framer-ienf2m`, purple → "System." `framer-ssu4pe`).
- All deltas are measured in a `refreshInit` listener (scrub reverted, layout settled) and
  stored as doc-space constants; `invalidateOnRefresh` re-evaluates them. A late
  `ScrollTrigger.refresh()` at ~5.2s re-measures after the splash + hero load stagger settle.
- The About strip `framer-25ip3p` is `visibility: hidden` (keeps its layout box) — the
  travellers ARE those icons. Idle bob/sway tweens (`window._heroIcons.tweens`) are paused
  while scrub progress > 0, resumed at 0.
- Gotchas: sprite groups live in the DEF svg — `getBoundingClientRect()` on them is
  meaningless, and `getBBox()` excludes their own transform; measure via wrapper rect +
  `getBBox()` + `gsap.getProperty(el,'x')`.
### Patterns to reproduce on new sections
1. **Scroll-reveal:** use the `reveal()` / `batch()` helpers already in `index.html` — add the new element's class to a `batch([...])` call or a `reveal('.framer-c57h6 .your-class', {...})`. Tag is automatic.
2. **Reveal once** (`toggleActions: 'play none none none'`), `start: 'top 86–90%'`, `power3.out`, stagger 0.1–0.14.
3. **Always** `ScrollTrigger.refresh()` after adding triggers and on `window.load`.
4. Keep `data-gsap-managed` tagging so the visibility-fix exemption holds.

---

## 7. Recipe: Building a New Case-Study Page

Keep the **same chrome and rhythm** so it feels native:

1. **Reuse the floating nav pill** (same `#111`, 64px, blur, shadow) on every page. Mark "Work" active.
2. **Background:** white page with alternating subtle warm-off-white (`#efede9`) bands behind grouped content. Use the **black band** for the closing CTA.
3. **Case-study hero:** centered or left-aligned title block in **PP Mori 40–48 / 700–800**, eyebrow label (14/400 muted) above it (reuse badge style), optional one-line subtitle (18/400 `#737373`).
4. **Content column ~1020px**, centered, with generous vertical spacing between sections.
5. **Section blocks** use the section-header pattern (green icon tile + 24–32px title + muted subtitle) to introduce Problem / Process / Solution / Impact.
6. **Media:** put screenshots/mockups inside **rounded (32–48px) colored/gradient panels**, slightly tilted/layered, rotating accent colors (lavender, blue, sky→sand).
7. **Metrics/impact:** echo the "Data. Craft. System." big-word treatment (40/800) for standout numbers.
8. **Buttons:** soft embossed light pill (`#FAFAFA`, signature shadow, PP Mori 16/600).
9. **Close every page** with the dark **"Lets Build Something Together" → Contact Me** section + "Made with ❤️" footer.
10. **Animate** all sections with scroll-reveal fade-up + stagger (§6).

---

## 8. Content Voice / Notes

- First-person, casual-confident: "Hey, I'm Ajeet", "Let's deep dive…", "Lets Build Something Together".
- Case studies framed by **outcome**: "Improving conversion of rewards program" + metric subtext.
- About layout: photo composite (`framer-1xj9pya`, direct child of row `framer-leiwsy`) sits **flush against the left border line** (`justify-content: flex-start` on the row); bio (`framer-652bj3`, `max-width: none`) fills the rest with its text centred. A mirrored **right-side container mockup** (`images/container.png`) is drawn via `framer-leiwsy::after` (274px band, `background: contain`, flush right line); the bio keeps symmetric `padding: 20px` sides so its content centres in the gap between the two images. Hidden ≤900px. CSS pseudo-element, not injected DOM — survives React hydration.
- Sections: Hero → About ("Designer. Badminton… Photographer", credentials, Data/Craft/System) → **Selected Work** (Hyperswitch volume-based routing, lender configuration console) → **Building with AI** (Wallpaper app, Credit Card Benefits Optimiser, Design Tokens, Vitamins Tracker, etc.) → **Contact** → Footer. (**Give it a read** is hidden for now — see §5.10.)

---

## 9. Asset Reference

- Fonts: `images/*.woff2` (PP Mori = `images/noxivf8lirswba6eqtlfnbfsk.woff2`, Neue Regrade = `images/r91fiovskzbql1ki7ts58rfrnbm.woff2`, plus Inter set). Google-hosted: Geist, IBM Plex Sans, Fira Code, Lato.
- Imagery/mockups + favicons live in `images/` (PNG/WEBP/GIF).
- Runtime/logic: `js/legacy export.*.mjs`, `js/motion.*.mjs`, `js/react.*.mjs`, `js/script_main.*.mjs`, `js/init.mjs`.
- Search/content index: `js/searchindex-*.json` (good source of all page copy).

---

## 10. the legacy export Class Map (hero section)

| Class | the legacy export name | Role |
|---|---|---|
| `framer-1jhguc6` | (hero outer) | Full-width hero wrapper with side-line pseudo-elements |
| `framer-c3k5qs` | (inner fill) | Flex-fill container, `place-content: center` |
| `framer-5vaexd` | (content column) | `position: absolute`, centered, `width: 100%` |
| `framer-1sllspy` | Container | Main hero content stack, `width: 100%` |
| `framer-17et2vx` | Container | "5+ Years" inner segment (NOT the badges row — the pill is `framer-lgi26s`) |
| `framer-w7uw4j` | Heading 1:margin | Wraps H1 + "Senior Product Designer" `::after` |
| `framer-lxqqn1` | Heading 1 | H1 frame |
| `framer-ve2jwi` | Hey, I'm Ajeet | H1 text node |
| `framer-fz7b92` | Margin | Subtitle section wrapper, `padding-top: 20px` |
| `framer-mtk1mc` | Container | Subtitle inner container |
| `framer-1yfgaui` | Designing for complexity… | Replaced by subtitle loop script |
| `framer-1wgz76y` | Frame 2085662758 | Company chips area, `padding-top: 28px` |
| `framer-xl2nkg` | Currently designing at | "Currently designing at" label |
