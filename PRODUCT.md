# Product

> Context note: the owner delegated every product and creative decision ("full creative control — do what you think is best"). The answers below are those decisions, written down so every surface is built against the same contract. Change them here first, then in the code.

## Register

brand

## Platform

web

## Users

Primary: design-literate adults (25–45) who buy fewer, better objects — the people who own a Playdate, a Kindle, a good pair of headphones, a film camera they actually use. Most of them are not musicians, or stopped playing years ago. They reach the site from a friend's shared loop link, a short video, or a launch post, usually on a phone, with about ten seconds of curiosity to spend.

Secondary: working musicians and producers looking for a pocketable sketchpad that speaks MIDI and doesn't need a laptop. They arrive later in the funnel (via reviews, creators, the Instrument page) and read specs.

Tertiary (Q4): gift buyers looking for something meaningful that isn't another screen.

## Product Purpose

RONDO is a palm-sized aluminium instrument with four concentric rings. Each ring is a rhythm: tap it to place a note, turn it to shift the groove, tilt the whole thing to open the sound. Because the rings loop at different lengths they drift apart and fall back together like planets, so a simple loop keeps evolving on its own.

The website's job is to sell a premium ($449 / $599 Founders) hardware pre-order by letting people *play the product before they own it*. Success means: a visitor makes a sound within 10 seconds, makes a loop within 60, shares it, and pre-orders or joins the list. Every shared loop link is a playable ad.

## Positioning

The only instrument you can master in ten seconds and still be discovering in ten years — built to last that long, with no subscription, no account and open firmware.

## Conversion & proof

- Primary CTA: Pre-order Rondo ($449). Phase-aware: *Join the list* (Signal) → *Reserve a Founders number* (Founders) → *Pre-order* (Launch) → *Buy* (Orbit).
- Secondary CTA: *Play it here* — the in-browser instrument (Rondo Web). It is the fallback for anyone not ready to pay, and it feeds the viral loop (make → share → friend plays → friend makes).
- The line a visitor remembers after 10 seconds: **"Play in circles."** — spin the rings, make a song.
- Belief ladder, in order:
  1. I want to hold that. (the object — 3D hero in a painted sky)
  2. Even I could make music with it. (proved by playing it on the page)
  3. It's deep enough not to get boring. (polymeter maths, four engines, MIDI)
  4. It's built properly and will last. (materials, repairability, the ten-year promise)
  5. People like me love it. (loops made by others, tester quotes)
  6. The price is fair. ($449 over ten years ≈ $3.74/month; no subscription ever)
  7. Buying is safe. (100-night trial, 5-year warranty, free shipping, pay in 4)
- Proof on hand: none real yet — this is a concept launch. Tester quotes and loop authors on the site are clearly fictional placeholders and the site is labelled as a concept prototype. The launch plan's first operational task is replacing them with real beta-tester quotes.

## Brand Personality

Playful, precise, unhurried. Speaks like a friendly instrument maker, not a startup: concrete nouns, short sentences, the occasional wink. Never shouts, never uses fake urgency. Emotional goals, in order: curiosity → delight ("wait, *I* made that?") → trust → quiet desire.

## Anti-references

- Dark-mode "music gear" sites with neon glows and techno typography.
- Space/cosmic clichés: purple nebula gradients, starfield-everything, sci-fi fonts.
- Teenage-Engineering pastiche: light-grey Swiss grid with orange accents and tiny mono labels.
- SaaS landing grammar: eyebrow kickers on every section, icon-card grids, hero metrics, gradient text, glass cards.
- Growth-hack dark patterns: exit-intent popups, fake countdowns, pre-checked add-ons.

## Design Principles

1. **The site is the demo.** Show by letting people play; every section should let the visitor *do* something, not just read.
2. **One object, one sky.** The product is always the hero; the sky tells time and sets mood. Nothing else competes for attention.
3. **Earned, not extracted.** Rewards (orbit log, founders numbers, referral orbit) come from curiosity and participation, never from interruption or pressure.
4. **Built for the next ten years.** Native platform features over frameworks (view transitions, speculation rules, Web Audio), progressive enhancement, no lock-in — the same promise the product makes.
5. **Honest numbers.** Prices, dates and guarantees are stated plainly and consistently everywhere.

## Accessibility & Inclusion

Target WCAG 2.2 AA as the eventual bar; this first build prioritises the experience and defers a full audit (per the owner). Non-negotiables already in scope: semantic landmarks and headings, keyboard-operable instrument, visible focus, `prefers-reduced-motion` alternatives for every animation and camera move, sound strictly opt-in with a persistent toggle, text contrast ≥ 4.5:1.
