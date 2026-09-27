# RONDO — Play in circles.

A concept launch for **Rondo**, a palm-sized aluminium instrument with four turning rings. The site is the demo: visitors can play the instrument, in 3D and in the browser, before they are asked to buy it, and every loop they make is a shareable link.

**Live:** https://alexmorrison12.github.io/rondo/ · **Launch plan:** [/launch-plan/](https://alexmorrison12.github.io/rondo/launch-plan/) · [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md) · **Design review:** [docs/DESIGN_REVIEW.md](docs/DESIGN_REVIEW.md)

> Rondo is a concept product and this site is a design prototype. No orders are taken and no payment details are collected. People and quotes are illustrative.

## What's here

| | Page | What it does |
|---|---|---|
| Core | [`/`](https://alexmorrison12.github.io/rondo/) | A day in the sky, morning to night, around a playable WebGL instrument |
| | [`/play/`](https://alexmorrison12.github.io/rondo/play/) | Rondo Web: the full instrument, moods, presets, undo, share links, WAV export |
| | [`/instrument/`](https://alexmorrison12.github.io/rondo/instrument/) | 3D turntable with hotspots, specs, honest comparison |
| | [`/loops/`](https://alexmorrison12.github.io/rondo/loops/) | Listening room of community loops |
| | [`/story/`](https://alexmorrison12.github.io/rondo/story/) | Manifesto and the ten-year promise |
| | [`/shop/`](https://alexmorrison12.github.io/rondo/shop/) → `/checkout/` → `/order/` | Live 3D configurator, bag, checkout, confirmation |
| | [`/support/`](https://alexmorrison12.github.io/rondo/support/) | Search-first help centre |
| Launch | [`/lp/signal/`](https://alexmorrison12.github.io/rondo/lp/signal/) | Teaser + referral waitlist ("move closer to the sun") |
| | [`/lp/founders/`](https://alexmorrison12.github.io/rondo/lp/founders/) | Claim a numbered Founders Edition from a spiral of 2,000 |
| | [`/lp/launch/`](https://alexmorrison12.github.io/rondo/lp/launch/) | Launch-day page for paid, press and Product Hunt traffic |
| | [`/lp/gift/`](https://alexmorrison12.github.io/rondo/lp/gift/) | Give a loop now, a Rondo in spring |
| | [`/lp/creators/`](https://alexmorrison12.github.io/rondo/lp/creators/) | Creator and affiliate program |
| | `/l/#l=…` | Shared-loop hop: gives link previews a "someone made you a loop" card, then opens the loop in `/play/` |
| Ops | [`/launch-plan/`](https://alexmorrison12.github.io/rondo/launch-plan/) | Mission Control: preview the whole site in any launch phase |

Quality-of-life layer on every page: cross-document view transitions, speculation-rules prerendering, ⌘K command palette, persistent opt-in sound, bag drawer with undo, the Orbit log (seven discoverable stars; five unlock a free walnut dock), phase-aware CTAs and copy, signed shared loops that arrive as "Alex made you a loop" with a "Make one back" reply, still-image fallbacks without WebGL, and a footer easter egg.

## How it's built

- **Astro 7** (static, multi-page), **TypeScript** strict, **Three.js r186**, **Web Audio**. No UI framework, no CSS framework.
- **Design system** in `src/styles/` (OKLCH tokens, cascade layers, one variable font: Archivo). See [DESIGN.md](DESIGN.md) and [PRODUCT.md](PRODUCT.md).
- **Sound** is synthesised in code, with no samples: Karplus–Strong strings, FM bells, a tape pad, a sub bass and an analogue-modelled kit (`src/scripts/audio/`). A lookahead scheduler keeps timing on the audio clock.
- **The instrument model** (`src/scripts/seq/`): four polymetric rings, twelve scales, Euclidean and mood-driven generators, and a compact codec that turns a loop into a ~90-character URL.
- **3D** (`src/scripts/three/`): a procedural product model (lathe-turned body, anisotropic rings, LED shaders driven by the live sequencer), a painted sky shader, environment reflections re-baked from the time of day, generated cloud sprites, adaptive resolution and visibility-aware rendering.
- **Launch phases** (`src/data/site.ts`): one switch moves every CTA, trust line, status line and delivery promise across the site between Signal, Founders, Launch and Orbit. With `SITE_MODE = 'live'` the phase follows the calendar (`phaseForDate`); this prototype pins the launch phase and says so in a corner chip. Previews (`?phase=signal`) last for the tab only.

```
src/
  pages/            routes (core pages, lp/*, launch-plan, render)
  layouts/          Base.astro (head, header, footer, global UI)
  components/       Header, Footer, Logo, Cta, GlobalUI, Icon
  data/             site.ts (facts, prices, phases), plan.ts (launch plan), stars.ts
  scripts/core/     store, phase, sound, cart, bag, palette, toast, share, achievements, header
  scripts/audio/    dsp, engine, wav
  scripts/seq/      model, scales, codec, generate, presets
  scripts/three/    stage, sky, environment, device, clouds
  scripts/pages/    one module per page
tools/              gen_textures.py, render-assets.mjs, capture.mjs, export-plan.mjs
tests/              unit tests for the musical core
```

## Develop

```bash
npm install
npm run dev          # http://localhost:4321/rondo/
npm run check        # astro check (TypeScript)
npm test             # vitest
npm run build        # static build to dist/
```

Asset pipelines (run with the dev server up):

```bash
npm run assets:textures          # cloud sprites (numpy + Pillow)
npm run assets:render            # product renders, icons, OG cards (headless Chrome)
node tools/export-plan.mjs       # docs/LAUNCH_PLAN.md from src/data/plan.ts
node tools/capture.mjs http://localhost:4321/rondo [--mobile]   # screenshots for review
```

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: type-check, tests, build, and publish `dist/` to GitHub Pages. The base path is `/rondo`; override with `SITE` and `BASE` environment variables for a custom domain.

## Credits

Archivo by Omnibus-Type (SIL OFL 1.1) · Lucide icons (ISC) · three.js (MIT). Everything else, including the product, sound engines, 3D model, textures and renders, was made for this project.
