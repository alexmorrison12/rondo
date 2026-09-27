# Rondo launch plan

> Generated from `src/data/plan.ts` by `tools/export-plan.mjs`. The live, interactive version (with a phase switcher that previews the whole site in each phase) is at [https://alexmorrison12.github.io/rondo/launch-plan/](https://alexmorrison12.github.io/rondo/launch-plan/).

## Goal

12,000 pre-orders by 28 February 2027: 10,000 Rondos at $449 and 2,000 Founders Editions at $599, or $5.69M in orders. Cash follows shipping: only the $98k of Founders deposits arrives before March. At least 35% of orders should come through organic and shared-loop traffic.

**North star:** Pre-orders placed

## Strategy

Let people play before they pay. The website is the demo, every loop is a link, and every link is a playable ad. Landing pages carry each launch phase; the core site takes over for day-to-day operation once units ship.

## Positioning

The only instrument you can master in ten seconds and still be discovering in ten years — built to last that long, with no subscription.

## Flight plan

| Target | Value | By |
|---|---|---|
| Waitlist sign-ups | 60,000 | 2 Nov 2026 |
| Founders Editions reserved | 2,000 of 2,000 | 16 Nov 2026 |
| Pre-orders | 12,000 | 28 Feb 2027 |
| Visitors who make a loop | 14% | Launch period |
| Loops shared | 20,000 | 28 Feb 2027 |
| Blended CAC (acquisition spend ÷ orders) | ≤ $45 · ≤ $55 all-in | Launch period |

## Critical path

Dated gates. If one slips, the phase after it slips with it.

| Date | Gate | Owner |
|---|---|---|
| 29 Sep 2026 | Waitlist and referral backend live: persisted queue, verified emails, ?ref= attribution. Otherwise Signal moves back a week. | Engineering |
| 2 Oct 2026 | Email platform and consent-based analytics wired to every page | Growth |
| 20 Oct 2026 | Deposit checkout and 15-minute number holds tested end to end | Engineering |
| 27 Oct 2026 | 240 pre-production (DVT) units allocated: 40 press, 200 creators | Operations |
| 10 Nov 2026 | Full pre-order dry run: tax, charge-on-ship, a pay-later provider that supports pre-orders, all emails | Engineering |
| 16 Nov 2026 | Go / no-go for launch day | Founders |

## Phases

### Signal · 6 Oct – 2 Nov 2026

**Goal:** Create curiosity and collect intent before anyone knows exactly what Rondo is.

**Landing pages:** [Signal teaser + referral waitlist](https://alexmorrison12.github.io/rondo/lp/signal/)

**Tactics**

- A single playable ring on a night sky: visitors turn it and hear it answer. Play first, product later.
- Referral queue: every verified friend who joins moves you 100 places closer to the sun; the first 2,000 get Founders access, and the top ten referrers have their loop shipped as a preset.
- Weekly reveals: a new ring lights up on the teaser each Tuesday, each unlocking one feature.
- Seed 40 creators with a laser-cut aluminium ring coaster and a QR code to the teaser.
- Cryptic six-second loops on TikTok, Reels and Shorts: one ring, one note, one date.
- Open the "Orbit" Discord at 5,000 sign-ups.

**KPIs**

| KPI | Target |
|---|---|
| Waitlist | 60,000 |
| Sign-ups from referrals | ≥ 25% |
| Paid cost per sign-up (tests) | ≤ $2.50 |
| Press briefings booked | 12 |

**Exit criteria:** If fewer than 40,000 have joined by 27 October, extend Signal one week and double creator seeding.

**What changes on the site in this phase**

- At go-live the phase follows the calendar (phaseForDate in site.ts); the prototype previews Launch by default.
- Every primary button says "Join the list" and routes to the Signal page; nothing can be bought.
- Status lines read "Revealing 17 November".
- Primary CTA: “Join the list” → `/lp/signal/`

### Founders · 3 – 16 Nov 2026

**Goal:** Reward the earliest believers and give the launch a story people want to be part of.

**Landing pages:** [Claim a numbered Founders Edition](https://alexmorrison12.github.io/rondo/lp/founders/)

**Tactics**

- Waitlist gets early access in referral order: your orbit rank decides when your window opens.
- "Claim your number": pick any free serial from 0001 to 2000; birthdays and lucky numbers go first.
- Choosing a number holds it for 15 minutes; a $49 deposit, refundable until it ships, makes it yours.
- Founders' names in the open-source firmware credits and on a card in the box.
- Shareable "I'm Rondo No. 0427" cards after every claim.
- Three-email sequence and a live Founders AMA in Discord.

**KPIs**

| KPI | Target |
|---|---|
| Founders reserved | 2,000 (100%) |
| Waitlist → deposit | ≥ 3.5% |
| Claims shared | ≥ 30% |
| Deposit refunds | ≤ 5% |

**Exit criteria:** Sell-out ends the phase early; any unclaimed numbers roll into launch-day pre-orders.

**What changes on the site in this phase**

- Primary buttons say "Claim a Founders number" and route to the Founders page.
- The shop shows the Founders Edition first and routes to the claim flow.
- Primary CTA: “Claim a Founders number” → `/lp/founders/`

### Launch · 17 Nov 2026 – 28 Feb 2027

**Goal:** Open public pre-orders and turn attention into bookings while the story is loudest.

**Landing pages:** [Launch page for paid social, press and Product Hunt](https://alexmorrison12.github.io/rondo/lp/launch/) · [Gift: give a loop now, a Rondo in spring](https://alexmorrison12.github.io/rondo/lp/gift/) · [Creator and affiliate program](https://alexmorrison12.github.io/rondo/lp/creators/)

**Tactics**

- 17 Nov, 09:00 PT: embargo lifts on 8 creator reviews and 4 publications (pre-production units lent in October); the 60-second launch film goes live.
- Paid spend front-loaded 17–25 Nov. No Black Friday discount on 27 Nov: "The price is the price."
- Product Hunt and a "Show HN: open firmware for a $449 instrument" post the same morning.
- Playable ads: short videos that end on "tap to play", landing in the instrument with a loop already loaded.
- Re-engage people who made a loop through "Email me my loop" and consented pixels only: "Your loop is waiting."
- Gift campaign from 20 Nov: printable card with the giver's loop and a QR code; cut-off 18 Dec.
- Creator program from 1 Dec: free unit, 12% commission, monthly #playincircles challenge.
- Email: waitlist → pre-order (5 emails), abandoned bag (3), post-purchase give $25 / get $25.

**KPIs**

| KPI | Target |
|---|---|
| Pre-orders | 12,000 |
| Visit → pre-order | ≥ 1.0% overall (≥ 3% loop makers, ~0.6% others) |
| Loop share rate | ≥ 12% of makers |
| Viral coefficient K = share rate × opens per share × opens that make a loop | 0.12 × 6 × 0.49 ≈ 0.35 |
| Cancellations | ≤ 6% |

**Exit criteria:** Gate on 1 Dec: if visit → pre-order is below 0.6%, pause prospecting and move budget to loop makers and email. Orders keep shipping in waves from 15 Mar; Orbit begins when the backlog clears.

**What changes on the site in this phase**

- Primary buttons say "Pre-order · $449" and go to the shop.
- Shipping promise reads "Ships spring 2027" everywhere, including checkout and email.
- Home sticky bar, Orbit log reward and gift options are live.
- Primary CTA: “Pre-order” → `/shop/`

### Orbit · From 3 May 2027

**Goal:** Ship, delight, and let the core site run the business: evergreen conversion, community and repeat revenue.

**Landing pages:** [Core site (home, instrument, play, loops, shop)](https://alexmorrison12.github.io/rondo/)

**Tactics**

- Ship in pre-order sequence with tracking emails and a "first loop" unboxing card.
- Once the backlog has shipped, switch the site to in-stock: "Buy Rondo · ships in 2 working days".
- Reviews and owner loops appear on product pages; Loop of the Week becomes a weekly ritual.
- A new voice every quarter via free firmware; each drop is a marketing moment.
- Selected design-store retail after 10,000 units have shipped.

**KPIs**

| KPI | Target |
|---|---|
| NPS | ≥ 60 |
| Owners still playing at 30 days (survey) | ≥ 70% |
| Revenue from organic and shared traffic | ≥ 40% |
| Accessory attach rate | ≥ 25% |

**Exit criteria:** Ongoing. Reviewed monthly against the operating scorecard.

**What changes on the site in this phase**

- Buttons say "Buy Rondo"; delivery reads "Ships in 2 working days".
- Landing pages rotate by campaign; the core site carries everyday traffic.
- Primary CTA: “Buy Rondo” → `/shop/`

## Funnel (launch-period targets)

| Step | Target | Note |
|---|---:|---|
| Visitors | 1,200,000 | Launch period, all channels |
| Played the instrument | 480,000 | 40% tap a ring or press play |
| Made a loop (8+ notes) | 168,000 | 35% of players |
| Added to bag | 38,400 | 3.2% of visitors |
| Pre-ordered | 12,000 | 1.0% of visitors: ~5,500 loop makers (3.3%) + ~6,500 others (0.6%) |

## Viral loops

- **Every loop is a link.** A loop encodes into its URL. Whoever opens it hears it instantly, can remix it, and shares their own. _The product is the ad. No server, no account, no friction._
- **The referral orbit.** Waitlist position improves by 100 places per friend who joins; the first 2,000 get Founders access. _Proven waitlist mechanics, made visible as an orbit you move closer to the sun._
- **Founders numbers.** Claim a serial that means something; get a shareable card. _Personal meaning beats fake scarcity, and it gets posted._
- **Gift a song.** Givers compose a loop; the card carries a QR code that plays it. _Every gift introduces a new household to the product before it ships._
- **Creators and challenges.** 12% commission, free units, and a monthly #playincircles prompt. _Short, satisfying, remixable videos are native to the platforms._
- **Give $25, get $25.** Post-purchase referral credited on purchase, not sign-up. _Turns happy owners into a sales channel while resisting referral fraud._

## Channels

| Channel | Phase | Tactic | Budget | KPI |
|---|---|---|---:|---|
| Email to the waitlist | Founders, Launch | Waitlist → Founders → pre-order sequences, abandoned bag | $12,000 | 5,400 orders (9% of 60k) |
| Paid social | Launch | Playable video ads → Launch page with a loop loaded | $280,000 | 3,600 orders · CAC ≤ $78 |
| Creators and affiliates | Signal, Launch | 200 lent units, briefs not scripts, 12% commission, challenges | $120,000 | 1,400 orders |
| PR, Product Hunt, HN, organic, shared loops | Launch day onward | 40 lent press units, founders AMA, open-firmware angle | $60,000 | 900 orders |
| Gift guides | Nov – Dec | Editorial gift guides, Gift landing page | $40,000 | 700 orders |
| Short video (organic) | All | Daily loops, ring-turn close-ups, mood-to-loop prompts | In-house | 25M views (feeds all of the above) |
| Community | All | Discord, Loop of the Week, firmware previews | $8,000 | 15,000 members |

_Attributed on last non-direct touch: 5,400 + 3,600 + 1,400 + 900 + 700 = 12,000. Acquisition spend (paid, creators, PR, gift guides) is $500k, a blended $42 per order. Adding 12% creator commission (~$75k), $25 + $25 referral credits (~$30k) and free Orbit docks (~$24k) gives about $52 all-in._

## Budget · $652,000

| Item | Amount |
|---|---:|
| Paid social | $280,000 |
| Creators (200 lent units, fees, prizes) | $120,000 |
| Content production (films, photography) | $80,000 |
| PR (40 lent units) and launch events | $60,000 |
| Gift guides and affiliates | $40,000 |
| Tools, email, analytics | $32,000 |
| Contingency | $40,000 |

## Experiments

| Test | Hypothesis | Metric |
|---|---|---|
| Hero: "Hear it" first vs "Pre-order" first | Sound-first creates more loop makers, who convert several times better. | Bag adds (3.2% base: ~45k visitors per arm for a 10% lift) |
| Price framing near CTA | "$3.74 a month over ten years" reduces price hesitation. | Bag adds |
| Shared-loop arrival | Opening shared loops with "make your own" beats the full instrument. | Share-to-maker rate |
| Founders grid vs counter | Choosing a number beats a countdown. | Deposits |
| Pay in 4 as default | Instalments lift conversion without raising cancellations. | Checkout completion |
| Orbit log reward | A walnut dock at five stars lifts engagement and AOV. | Stars earned, AOV |

**Measured events:** `play_start`, `note_add`, `ring_turn`, `loop_made (8+ notes)`, `loop_shared`, `shared_loop_open`, `mood_compose`, `wav_export`, `waitlist_join`, `referral_invite`, `founders_claim`, `add_to_bag`, `checkout_start`, `preorder_placed`

Cookieless analytics by default; marketing pixels only with consent.

## Risks

| Risk | Mitigation |
|---|---|
| Manufacturing slips (EVT → PVT) | Monthly build updates, refundable deposits, ship in waves, 5% buffer stock. |
| Audio blocked or silent on some phones | Clear "sound on" affordance, hint about the silent switch, visual-first demo. |
| "Isn't this just an app?" | Honest comparison on the Instrument page; tactile close-up videos; 100-night trial. |
| Price resistance at $449 | Pay in 4, ten-year cost framing, no-subscription promise, trial. |
| Creator fatigue / sameness | Rotate formats monthly, fund challenges rather than scripted ads. |
| Referral fraud | Verified emails, rewards on purchase not sign-up, rate limits. |
| Pay-later at shipment | Choose a provider that supports charge-on-ship by 10 Nov; otherwise offer instalments when the order ships. |
| Proof before shipping | No invented testimonials or counts: show embargoed press quotes, testers who consent to being named, and real backend numbers only. |

## After launch: operating the core site

### Weekly cadence

| When | What |
|---|---|
| Monday | Scorecard review: traffic, makers, shares, orders, CAC (Growth) |
| Tuesday | Loop of the Week goes live on home, loops, email and socials (Community) |
| Thursday | Experiment readout and next test chosen (Growth) |
| Daily | Support queue under 24 h; one CX lead hired by January, two by shipping (Operations) |
| Monthly | Firmware notes, build update, landing-page rotation (Product) |

### Deliberately deferred (this build prioritises the experience)

1. **Accessibility to WCAG 2.2 AA** (Weeks 1–3 after sign-off): Screen-reader pass on the instrument and 3D scenes, reflow and zoom to 400%, focus order, captions and transcripts for films.
2. **SEO and content** (Weeks 2–6 after sign-off): Sitemap and structured-data coverage, per-loop pages with generated OG images, a "ten-second lessons" learning hub.
3. **Real commerce** (Deposits by 20 Oct · pre-orders by 10 Nov): Stripe checkout with saved cards charged on shipment, tax, wallets (Apple Pay, Google Pay), order emails, US and Canada first.
4. **Accounts and access control** (Before Orbit): Optional passkey accounts for saved loops; CMS roles for content ops; server-side feature flags for phases.
5. **Waitlist and referral backend** (By 29 Sep (critical path)): Persisted queue, verified referrals, ?ref= attribution, anti-fraud, email platform integration.
6. **Performance and resilience** (Ongoing): Real-user Core Web Vitals, WebGPU renderer path, reduced-data mode, error monitoring.
7. **Localisation** (After Orbit): EUR, GBP and JPY pricing, six languages, regional shipping promises.

### Launch assets

- Teaser film (12 s vertical, generated from the live scene) plus 12 six-second loops and the 60 s launch film
- OG cards for every page, plus a “someone made you a loop” card for shared links
- Press kit: renders, specs, founder notes, FAQ
- Creator brief and challenge calendar
- Email templates for every sequence
- Support macros for the top 20 questions
