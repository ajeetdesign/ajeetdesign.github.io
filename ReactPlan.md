# React Migration Plan — Ajeet Design Portfolio

> Goal: convert the current **Framer static export** (`index.html` + `js/*.mjs` runtime + `responsive.css` overrides + injected GSAP scripts) into a clean, maintainable **React (Vite)** project — keeping the exact look, the GSAP/Lenis animation layer, and the design system, while deleting the ~6 MB of Framer runtime we no longer need.
>
> Read alongside **`DESIGN-CONTEXT.md`** — that doc is the source of truth for colors, type, spacing, components, and the animation layer. This plan maps the existing Framer markup to React components and lists exactly what to keep vs delete.

---

## 0. TL;DR

- **Stack:** Vite + React 18 + CSS Modules (design tokens as CSS variables) + GSAP (`@gsap/react`) + Lenis (`lenis/react`).
- **Keep:** image/mockup assets, the **PP Mori** font (+ any actually-used fonts), favicons, all copy, the GSAP/Lenis animation behaviour, the design values in `DESIGN-CONTEXT.md`.
- **Delete:** the entire `js/` Framer runtime (~5.9 MB), `test.html` (duplicate of `index.html`), `.DS_Store`, and — once ported — `index.html` + `responsive.css`.
- **Approach:** rebuild section-by-section as components; port the custom animation scripts into React hooks; self-host fonts; verify visually against the current site at each step.

---

## 1. What the site is

Single-page, desktop-first (1440px canvas) portfolio. One real page (`/` and `/test` are identical). Section order:

1. **Nav** — floating liquid-glass pill (fixed)
2. **Hero** — badges → "Hey, I'm Ajeet" + "Senior Product Designer" → looping subtitle → 3 floating app icons → "Currently designing at" company chips; faint grid texture + vertical side lines behind
3. **About** — profile photo + bio + "Based on Data. Polished Craft. Creating System."
4. **Selected Work** — section header + 4 case-study cards
5. **Building with AI** — section header + 5-tile bento grid (gradient background)
6. **Give it a read** — section header + 2 article rows
7. **Contact** — dark CTA band + "Made with ❤️" footer

All copy is recoverable from `js/searchindex-p0tgozwd93j8.json` (extract before deleting `js/`).

---

## 2. Asset audit — keep vs delete

### 2.1 DELETE (Framer runtime & cruft) — ~6.4 MB
| Path | Size | Why |
|---|---|---|
| `js/google-3fcakcac.*.mjs` | 2.5 MB | Framer-bundled font/icon payload |
| `js/framer.*.mjs` | 436 KB | Framer runtime |
| `js/hi9gms….mjs`, `js/hxiiyb….mjs` | ~900 KB | Framer page bundles |
| `js/motion.*.mjs` | 151 KB | Framer's motion (replaced by GSAP) |
| `js/react.*.mjs` | 145 KB | Framer's bundled React (we bring our own) |
| `js/fontshare-*.mjs`, `js/framer-font-*.mjs`, `js/google-*.mjs` | ~250 KB | Framer font loaders (self-host instead) |
| `js/init.mjs`, `js/script_main.*.mjs`, `js/rolldown-runtime.*.mjs`, `js/shared-lib.*.mjs`, `js/px9*.mjs`, `js/aohx*.mjs` | small | Framer bootstrap |
| `js/rerouter.js`, `js/sitesnotfoundpage*.js` | small | Framer routing/404 |
| `test.html` | 453 KB | **Exact duplicate** of `index.html` |
| `.DS_Store` | — | macOS cruft |

**Before deleting `js/`:** copy `js/searchindex-p0tgozwd93j8.json` somewhere temporary — it's the cleanest source of all page copy.

### 2.2 KEEP — migrate into the React project
| What | Where now | Move to | Notes |
|---|---|---|---|
| Mockups / screenshots | `images/*.png`, `*.webp`, `*.gif` (23 files) | `src/assets/img/` | **Audit usage first** — Framer exports unused assets. Keep only referenced ones; rename to human-readable. |
| **PP Mori** font | `images/*.woff2` | `public/fonts/` or `src/assets/fonts/` | Brand font — required. |
| Other fonts | `images/*.woff2` (31 total) | — | **Audit** — most are unused (Geist, Lato, Fira, IBM Plex etc. that Framer bundled). Keep only what the design actually uses (PP Mori, maybe Neue Regrade). Likely drop 20+ files. |
| Favicons | `images/default-favicon-*.png`, `app-icon.png` | `public/` | |
| All copy | `js/searchindex-*.json` | component JSX / a `content.js` | Extract then delete. |
| Design values | `DESIGN-CONTEXT.md` | `src/styles/tokens.css` | Convert §2–§4 to CSS variables. |
| Animation behaviour | injected `<script>`s in `index.html` | React hooks (see §5) | Port, don't copy verbatim. |

---

## 3. Target project structure

```
ajeet-portfolio/
├─ public/
│  ├─ fonts/                 # PP Mori (+ used fonts) woff2
│  ├─ favicon files
│  └─ ...
├─ src/
│  ├─ assets/img/            # mockups, icons (renamed, audited)
│  ├─ styles/
│  │  ├─ tokens.css          # colors, type scale, spacing (from DESIGN-CONTEXT §2–4)
│  │  ├─ fonts.css           # @font-face for PP Mori etc.
│  │  └─ global.css          # reset, base, smooth-scroll html
│  ├─ hooks/
│  │  ├─ useSmoothScroll.js  # Lenis + GSAP ticker sync (§6.1 of context)
│  │  └─ useScrollReveal.js  # GSAP ScrollTrigger reveal helper (§6.2)
│  ├─ components/
│  │  ├─ Nav/                # liquid-glass pill
│  │  ├─ Hero/               # + HeroIcons, SubtitleLoop, GridBackground
│  │  ├─ About/             # + DataCraftSystem
│  │  ├─ SelectedWork/       # + WorkCard
│  │  ├─ BuildingWithAI/     # + BentoTile
│  │  ├─ GiveItARead/        # + ArticleRow
│  │  ├─ Contact/
│  │  └─ shared/             # SectionHeader, Button, Badge, Chip, Card
│  ├─ data/content.js        # copy extracted from searchindex
│  ├─ App.jsx
│  └─ main.jsx
├─ index.html                # minimal Vite entry (NOT the Framer one)
├─ vite.config.js
└─ package.json
```

---

## 4. Component breakdown (Framer class → React component)

| Component | Replaces (Framer class) | Contents / props |
|---|---|---|
| `Nav` | `framer-1ooizrb` / `framer-od3clj` | logo, links, active "Home" pill. Liquid-glass styles from context §5.1 |
| `Hero` | `framer-1jhguc6` → `framer-1sllspy` | wraps the pieces below; owns side-lines + grid bg |
| `Hero/GridBackground` | `framer-18ss2ql` (SVG) | faint grid SVG; gets parallax |
| `Hero/Badges` | `framer-17et2vx` | Bangalore, 5+ Years chips |
| `Hero/Heading` | `framer-w7uw4j` | "Hey, I'm Ajeet" + "Senior Product Designer" (now a real `<h1>`+`<p>`, no `::after` hack) |
| `Hero/SubtitleLoop` | `framer-1yfgaui` | React state interval alternating two phrases |
| `Hero/HeroIcons` | `#heroIcoOrange/Green/Purple` SVG sprite | **rebuild as 3 inline `<svg>` components** — individual GSAP animation becomes trivial (no `<use>` sprite hack) |
| `Hero/CompanyChips` | `framer-1wgz76y` | Porter, Juspay, Convin.ai |
| `About` | `framer-xiaegt` → `framer-leiwsy` | photo + bio + DataCraftSystem |
| `About/DataCraftSystem` | `framer-ml6zjt` | "Based on Data." etc. with the 3 colored icons |
| `SectionHeader` (shared) | repeated icon-tile + title + subtitle | props: `icon`, `title`, `subtitle` |
| `SelectedWork` + `WorkCard` | `framer-1gmsbj2`, `krhpmx`, `1dv9wgl`, `1pzmip5` | 4 cards, two-column split, accent panel |
| `BuildingWithAI` + `BentoTile` | `framer-itx7f`, `19ebriy`, `7byk6d`, `1kfbg45`, `jwdy93` | 5 tiles; gradient bg (context §5.9) |
| `GiveItARead` + `ArticleRow` | `framer-1226555`, `1ga305s` | 2 rows |
| `Contact` + `Footer` | dark band + `framer-1caux12` | CTA + "Made with ❤️" |
| `Button` (shared) | pill button | signature shadow (context §5.2) |

---

## 5. Porting the custom animation layer

Everything currently in injected `<script>`s (see `DESIGN-CONTEXT.md` §6) → React. The Framer-hydration workarounds (visibility-fix, `data-gsap-managed`, `<use>`-sprite reflection, `::after` role line) **all disappear** — in React we own the DOM, so these hacks are no longer needed.

| Current (vanilla, in index.html) | React replacement |
|---|---|
| Lenis init + GSAP ticker sync | `useSmoothScroll()` hook (or `<ReactLenis root>` from `lenis/react`) |
| `reveal()` / `batch()` ScrollTrigger helpers | `useScrollReveal()` hook using `@gsap/react`'s `useGSAP()` |
| visibility-fix script | **delete** — not needed, React renders final state |
| `data-gsap-managed` tagging | **delete** — components set their own initial state |
| Hero load stagger (CSS `@keyframes hero-reveal`) | `useGSAP` timeline in `Hero` |
| Subtitle loop (`<script>` + `<style>`) | `SubtitleLoop` component with `useEffect` interval + CSS transitions |
| Hero icons (`<use>` sprite + injected IDs) | 3 real `<svg>` components; `useGSAP` for pop-in + float loop — **cleaner, no sprite reflection trick** |
| Hero grid parallax | `useGSAP` scrub tween in `GridBackground` |
| `::after` "Senior Product Designer" | real markup in `Hero/Heading` |
| Nav liquid glass | plain CSS in `Nav/Nav.module.css` |

Keep the **values** identical (durations, easings, offsets) — they're all documented in context §6. Lenis: `duration: 1.05`, `wheelMultiplier: 1.1`, `touchMultiplier: 1.6`, easing `1-(1-t)^4`.

---

## 6. Migration steps (phased — verify after each)

> **Status:** project built in `ajeet-portfolio/` (Vite). Phases 1–8 ✅ done & verified (renders, no JS errors, smooth scroll + reveals fire on scroll, hero pixel-faithful). Phase 9 (deleting the original Framer files) **pending user confirmation** — destructive, kept until parity is confirmed. Phase 10 = user's side-by-side check.

1. ✅ **Scaffold** — Vite + React; added `gsap @gsap/react lenis`. (Built `package.json`/`vite.config.js` manually rather than `npm create` for control.)
2. ✅ **Extract content** — copy → `src/data/content.js`. Assets copied to `src/assets/img` + `public/fonts`. PP Mori is paid (Pangram Pangram, not on a CDN) → self-hosted the one embedded weight as `ppmori-semibold.woff2`.
3. ✅ **Tokens & fonts** — `src/styles/tokens.css` (context §2–4), `fonts.css`, `global.css`.
4. ✅ **Shared primitives** — `Button`, `SectionHeader` (Badge/Chip folded into Hero).
5. ✅ **Static layout** — `Nav → Hero → About → SelectedWork → BuildingWithAI → GiveItARead → Contact`.
6. ✅ **Smooth scroll** — `useSmoothScroll` hook (manual Lenis + GSAP ticker; values from context §6.1).
7. ✅ **Animation layer** — `useScrollReveal` hook (data-reveal / data-reveal-group); hero load stagger; subtitle loop; hero icons (now 3 real inline SVGs — no `<use>` hack); grid parallax.
8. ✅ **Polish & responsive** — `clamp()` rules ported; mobile breakpoints added.
9. ⏳ **Cleanup (PENDING CONFIRM)** — delete `js/`, `test.html`, Framer `index.html`, `responsive.css`, `.DS_Store`. Keep `DESIGN-CONTEXT.md` + this file + `ajeet-portfolio/`.
10. ⏳ **Verify** — user side-by-side check (run `npm run dev` in `ajeet-portfolio/`).

### Known follow-ups / refinements
- **Image mapping is best-effort.** Mockups were matched to work cards / bento tiles by dimension; some object-fit framing may need tuning or exact swaps. Favicons (Juspay, Convin) + profile photo confirmed correct.
- **Font weights:** only PP Mori SemiBold was embedded in the export; declared across 400–800 so it reads correctly. If exact lighter/heavier cuts are wanted, license the full PP Mori family.
- **Selected Work card #3/#4 titles** were lightly inferred (the export had placeholder copy) — edit in `content.js`.

---

## 7. Styling approach — LOCKED: CSS Modules + CSS-variable tokens

**Decision: CSS Modules + design tokens as CSS variables.** Not Tailwind. Rationale, specific to this project:

- **Bespoke visuals stay readable.** The nav liquid glass (multi-layer inset+outer shadows), radial gradients (Building with AI), gradient side-lines, and exact `-0.04em` letter-spacing become unreadable arbitrary values (`[box-shadow:...]`) in Tailwind. As plain CSS they stay legible.
- **Tokens already exist.** `DESIGN-CONTEXT.md` §2–4 maps 1:1 to a `tokens.css` variables file — direct doc↔code mapping, no re-encoding into `tailwind.config.js`.
- **`responsive.css` ports verbatim.** Tuned `clamp(16px, 5vw, 180px)` gutters and the hero rhythm drop straight into `*.module.css`.
- **Solo + design-led + animation-heavy.** Scoped real CSS is more transferable and reviewable next to GSAP code that manipulates the same properties.

**Structure:**
- `src/styles/tokens.css` — colors, type scale, spacing, radii, shadows as CSS variables (from DESIGN-CONTEXT §2–4)
- `src/styles/fonts.css` — `@font-face` for PP Mori (+ any used font)
- `src/styles/global.css` — reset, base, `html { }` smooth-scroll base
- one `Component.module.css` per component; bespoke one-offs (glass, gradients) as plain CSS in the relevant module

### Other decisions to confirm before starting
- **Lenis integration:** `lenis/react` `<ReactLenis>` component vs manual hook. *Plan assumes the React package.*
- **Routing:** single page — no router needed. Add `react-router` only if real case-study sub-pages get built (see context §7 recipe).
- **Content source:** hardcode copy in components vs central `content.js`. *Plan assumes `content.js`* for easy edits.
- **Image hosting:** import from `src/assets` (hashed by Vite) vs `public/`. *Plan assumes `src/assets`* except favicons.

---

## 8. Risks & gotchas

- **Font audit is the biggest cleanup win** — 31 woff2 are bundled but the design really only uses **PP Mori** (brand) + maybe Neue Regrade. Don't blindly copy all 31. Confirm via `@font-face`/`--font-family` usage in the current CSS.
- **Mockup fidelity** — the Selected Work / bento mockups are detailed Framer vector/screenshot recreations. Easiest path: export each as a static image (already are PNGs in `images/`) rather than rebuilding in JSX. Rebuild only if crispness/theming demands it.
- **Exact spacing** — the hero rhythm and section gutters are tuned (context §4, §5.3). Port the `clamp()` values verbatim.
- **No more hydration hacks** — once off Framer, remove the visibility-fix, `data-gsap-managed`, and `<use>`-sprite tricks entirely. They exist only to fight Framer's runtime.
- **GSAP + React strict mode** — use `@gsap/react`'s `useGSAP()` (handles cleanup, double-invoke in dev StrictMode).

---

## 9. Definition of done

- Visual parity with the current site (hero, sections, nav glass, gradients, lines, type).
- All animations working: smooth scroll, section reveals, hero load stagger, subtitle loop, floating icons, grid parallax.
- `js/`, `test.html`, Framer `index.html`, `responsive.css`, `.DS_Store` removed.
- Bundle ~6 MB → <500 KB (excl. images/fonts).
- `DESIGN-CONTEXT.md` still accurate; this plan checked off.
