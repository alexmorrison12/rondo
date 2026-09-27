# Design review: what the studio found, and what changed

The first complete build of the site was not shipped. It went to an external review first, and this document records what that review found and what was changed as a result.

## Who reviewed it

The "studio" was a panel of three independent AI reviewers, each briefed as a senior member of an outside design studio and each working alone. None of them wrote any of the site. They reviewed it the way a jury would: from about a hundred screenshots at desktop and phone sizes, from scripted headless-Chrome passes (real WebGL, full scrolls and end-to-end flows), and by reading the code behind each finding.

| Reviewer | Lens |
|---|---|
| A | Art direction and UX: first impressions, craft, coherence, the Awwwards bar |
| B | Systems and QA: runtime errors, render loops, performance, keyboard, flows |
| C | Conversion and launch: the belief ladder, pricing honesty, checkout, launch-plan credibility |

The brief, the raw reports and the evidence scripts are kept out of the repository in `review/`, which is gitignored.

## Scores on the first build

| | Design | Usability | Creativity | Content | Other |
|---|---|---|---|---|---|
| A | 7.0 | 6.0 | 7.5 | 7.0 | Art direction 7.5 · Conversion 5.5 · Nielsen 26/40 |
| B | 8.0 | 5.5 | 8.5 | 7.0 | Robustness 6.5 · Performance 8.5 |
| C | 8 | 6 | 8.5 | 6 | Conversion 4.5 · Launch plan 4 |

All three agreed on the idea: the site is the demo, the sky runs from morning to night, and the sale arrives at night, when the LEDs glow brightest. They also agreed it wasn't ready. A juror's first click failed, and the checkout said different things about when you pay. Some of the "beta tester" proof was invented, and the plan's numbers didn't add up.

## What changed

### Blockers (P0)

| Finding | Fix |
|---|---|
| The hero's "Pre-order $449" did nothing on click or tap: Astro's scoped CSS left the link with `pointer-events: none` over the WebGL canvas | Global selector for interactive elements inside scenes, plus a smoke test that checks every visible CTA is the element under its own centre, at desktop and phone sizes |
| The site said "Pre-orders open" before the teaser phase had started, and any visitor could switch the phase for good from Mission Control | The phase comes from the calendar (`phaseForDate`). This prototype shows the launch phase deliberately, behind a visible "Prototype · Launch phase" chip. Previews are per tab (`?phase=` plus sessionStorage), with a reset |
| Invented quotes labelled as beta testers | Removed. The home now shows proof a visitor can check: the notes they placed on the page, the open-source repository and the written promise. The launch page does the same, with the teaser film |
| Checkout, bag and order pages contradicted each other on payment | One source of payment copy (`PAYMENT` in `site.ts`): $0 today and $449 on ship day for pre-orders; a $49 refundable deposit for Founders; pay in four starting on ship day |
| Silent on a muted iPhone | Web Audio uses the playback audio session, with a one-time hint where that isn't supported |

### Major (P1)

- **Toasts** no longer cover what you're about to press. On wide screens they sit top right, under the header. On phones they sit under the header too, clear of the buttons in the lower half. Stars are merged into one quiet toast and pulse the header counter, and never interrupt a playing loop.
- **The three-move lesson** follows scroll, and each move has a "Show me" button that performs it on the 3D instrument, which also gives keyboard users a way through. On phones, tilting the phone opens the filter.
- **Founders flow**: a claimed number is held for 15 minutes and goes straight to a $49 deposit checkout. The confirmation draws a shareable Founders card.
- **Referrals and gifts** work end to end: `?ref=` gives $25 off and carries through bag, checkout and order. Gift details and a loop travel with the gift line.
- **Shared loops became messages.** Sharing asks for a first name. The link opens a card that says "Alex made you a loop", tinted with the sky at the sender's local time, with a Play button and a line about the real instrument. From there, "Make one back" starts the reply. A `/l/` hop gives link previews their own card, "Someone made you a loop."
- **Order numbers, newsletter and support**: RDO-format numbers everywhere; the newsletter no longer puts the email in the URL; support's status line no longer claims a firmware version before anything has shipped.
- **Mission Control** fits on phones. It gained a dated critical path and an attribution note that reconciles the channel numbers.
- **The plan's numbers** were reconciled: 12,000 orders across channels on last-touch attribution, CAC of $42 blended and about $52 all-in, the K-factor spelled out, and deferred items given owners and dates.

### Polish (P2)

- Copy: a clearer hero lead; trust lines true to each phase ("Nothing charged until it ships · 100-night trial · No subscription, ever"); "$449, once." in place of a per-month figure that was easy to misread; plainer launch-page headings.
- The ten-year promise now runs to 2037, ten years from the first deliveries, on every page and on the /story/ dial.
- The exploded view is a believable teardown: a routed main board with LED footprints under every ring, chips and passives, a labelled pouch battery, four T5 screws, bearing races, and a cooler reflection floor that keeps the blue anodising from turning olive.
- Product renders are reframed so the object is never cropped, and the Open Graph cards were regenerated.
- The 3D pages show still renders when WebGL is off or Save-Data is on. Clouds, parallax and idle bobbing respect reduced motion, and the Signal ring sleeps when it's off screen or settled.
- WAV exports are limited and normalised to −1 dBFS.
- Rolled loops get names ("Paper Comet", "Late Ferry") instead of "Rolled loop", and the "loop of your own" star needs six notes you placed yourself.

## Deferred, on purpose

As agreed in the brief, these wait until after the first release (full list with dates in [LAUNCH_PLAN.md](LAUNCH_PLAN.md)):

- A full WCAG 2.2 AA pass: screen readers on the 3D scenes, 400% reflow, captions.
- Real commerce: Stripe, tax, wallets, order emails.
- A waitlist and referral backend. The prototype stores these in the browser.
- Per-loop link previews. Static hosting can't see the `#fragment`, so shared links use one generic card.
- Loading three.js only when a 3D scene is about to run, so pages that fall back to stills skip the download.
