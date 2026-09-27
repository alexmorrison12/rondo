# Design

The visual contract for rondo. Tokens live in `src/styles/tokens.css`; this file explains them.

## Visual theme

**An instrument hanging in a painted sky.** A small, precisely machined aluminium object floats in a Magritte-blue sky while the page scrolls from morning to night. Crisp metal against soft atmosphere, big confident type like the engravings on a watch bezel, and light that behaves the way it does outdoors: the product's reflections, shadows and LEDs change with the time of day.

Scene sentence: *a design-literate thirty-something on the sofa at golden hour, phone in hand after work, taps a friend's link — a small aluminium instrument hanging in a blue sky starts to hum, and they have ten seconds of curiosity to spend.* That is why the site opens bright (a morning sky) and closes dark (a night sky for the purchase moment, when the LEDs glow brightest).

Named anchors:
- René Magritte's daytime skies (*La Grande Famille*, *L'Empire des lumières*): flat cerulean, soft cumulus, a calm surreal object.
- Jacquemus' surreal CGI product campaigns: a real object, at an impossible scale or place, played straight.
- Watch-bezel and camera-lens engravings: condensed, tabular, precise labels that belong to the object.

## Color

Strategy per surface:
- **Brand pages** (home, landing pages, story): *Drenched*. The sky IS the surface and changes with scroll: `morning → noon → afternoon → golden → dusk → evening → night`. Palettes live in `src/scripts/lib/skies.ts` (OKLCH, converted at runtime).
- **Commerce and tools** (shop, checkout, support, plan): *Restrained*. Haze surface, ink text, one sun accent.
- **Instrument UI** (play, loops): *Full palette* with four named functional roles, one per ring.

| Token | OKLCH | Role |
|---|---|---|
| `--ink` | 0.2 0.03 258 | Text on light/sky. 18:1 on white, 8:1 on noon sky |
| `--ink-soft` | 0.4 0.035 255 | Secondary text on white/haze only (9.2:1) |
| `--ink-sky-soft` | 0.3 0.04 255 | Secondary text on sky surfaces (never `--ink-soft` on sky: 4.1:1) |
| `--haze` / `--haze-2` | 0.975 / 0.945, 0.008–0.012 235 | Cool surfaces for commerce pages |
| `--sky-100…700` | L .95→.5, hue 228–250 | Seed family (seed `oklch(0.75 0.08 230)`) |
| `--night-900…700` | 0.15–0.29 0.035–0.05 262 | Night surfaces |
| `--starlight` | 0.9 0.03 250 | Text on night (14.6:1) |
| `--sun` | 0.92 0.15 95 | THE action colour. Primary CTAs on sky/night, ink text on it (14:1) |
| `--ember` `--sunlit` `--tide` `--lilac` | see tokens | Ring colours: Pulse, Root, Glow, Spark. Functional, used in the instrument and LEDs |

Rules: the sun colour means "act" everywhere. On white/haze surfaces the primary button is ink with a sun dot (a pale fill would disappear). No gradient text, no purple-blue gradients: the only gradients are skies.

## Typography

One family, chosen for voice: **Archivo Variable** (wdth 62–125, wght 100–900), self-hosted. Its width axis gives the whole system from one file: expanded heavy for display (a confident, engraved-object voice), normal for reading, condensed for small instrument labels.

| Role | Size | Width | Weight | Tracking |
|---|---|---|---|---|
| Display XL | clamp(3.25rem, 1.6rem + 6.4vw, 6rem) | 125 | 800 | −0.025em |
| Display L | clamp(2.4rem, 1.4rem + 3.6vw, 4.25rem) | 118 | 760 | −0.02em |
| Title | clamp(1.5rem, 1.15rem + 1.2vw, 2.1rem) | 108 | 680 | −0.01em |
| Lead | 1.25rem / 1.45 | 100 | 420 | 0 |
| Body | 1.0625rem / 1.6 | 100 | 400 | 0 |
| Label (engraving) | 0.8125rem / 1.2 | 72 | 620 | +0.04em, tabular numerals |

Motion signature: headlines "inhale" on entrance, animating `font-stretch` from 62% to 125% and weight from 300 to 800. When sound plays, the hero wordmark breathes with the beat along the same axes.

Engraved labels are used only on things that are *part of the instrument* (ring names, step counts, specs, prices). They are not section eyebrows.

## Layout

- Fluid 4pt-based spacing (`--s-*`) and fluid section rhythm (`--section`).
- Home: a persistent full-viewport WebGL stage behind the content; one dominant idea per viewport; copy blocks are asymmetric, anchored left or right of the object.
- Content max-width 1320px; prose measure 62ch.
- Radii: 6px inputs, 12px panels (max 16px), pills for buttons and chips, circles for the instrument language.
- Z-index scale: `--z-stage 0 · --z-content 1 · --z-sticky 20 · --z-header 30 · --z-drawer 40 · --z-modal 50 · --z-toast 60`.

## Components

- **Buttons**: pill. `btn--sun` (sun fill, ink text, for sky/night), `btn--ink` (ink fill, white text, sun dot, for light), `btn--ghost` (1px current-colour border). Press = 2px sink, 120ms.
- **Phase CTA**: every primary CTA carries `data-cta`; its label and destination come from the launch phase (`src/scripts/core/phase.ts`).
- **Sound toggle**: always in the header; animated bars while audio plays.
- **Orbit log**: header star counter plus a popover of seven discoverable "stars" (achievements). Collecting five unlocks a walnut dock, free, with your Rondo.
- **Bag**: native `<dialog>` drawer with free-shipping line, quantity steppers, and undo on remove.
- **Command palette**: ⌘K / Ctrl-K, native `<dialog>`, pages plus actions.
- **Toasts**: polite live region, 4s, with optional action.

## Motion

- Easing: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` (expo) for entrances; `--ease-io: cubic-bezier(0.65, 0, 0.35, 1)` for camera and state morphs. No bounce, no elastic.
- Durations: 120 (press) / 220 (state) / 420 (panels) / 720ms (entrances).
- The 3D camera is spring-damped toward scroll-derived keyframes, never snapped.
- Cross-document View Transitions between pages (`@view-transition`), with the logo and page title as shared elements.
- `prefers-reduced-motion`: no camera flights, idle rotation or parallax; states crossfade; the sky still changes colour, but in steps.

## 3D and imagery

- Procedural product model (`src/scripts/three/device.ts`): lathe-turned aluminium body, four rings with *anisotropic* circular brushing (the radial highlight of turned metal), sapphire sun dome with real transmission, and a shader-driven LED ring that renders the live sequencer state.
- Reflections come from the current sky: the environment map is regenerated from the sky palette as the time of day changes.
- Generated assets: cloud sprites (`tools/gen_textures.py`, numpy fBm), product renders, favicons and OG cards (`tools/render-assets.mjs`, headless Chrome rendering the real scene).

## Sound

Strictly opt-in. One `AudioContext`, created on the first user gesture. Four engines are synthesised in code (Karplus–Strong pluck, FM glass, tape pad, analogue-modelled drums), with no sample downloads. UI sounds are quiet and sparse: ring detent ticks and one chime per earned star.
