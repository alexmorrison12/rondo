/**
 * The launch plan, as data. Rendered by /launch-plan/ (Mission Control) and exported to
 * docs/LAUNCH_PLAN.md by tools/export-plan.mjs, so the page and the document never drift.
 * Numbers are planning targets for a concept product, sized to be internally consistent.
 */
import type { Phase } from './site.ts';

export const PLAN_SUMMARY = {
  northStar: 'Pre-orders placed',
  goal: '12,000 Rondos pre-ordered by 28 February 2027 ($5.6M in bookings), with at least 35% of revenue arriving through organic and shared-loop traffic.',
  positioning:
    'The only instrument you can master in ten seconds and still be discovering in ten years — built to last that long, with no subscription.',
  strategy:
    'Let people play before they pay. The website is the demo, every loop is a link, and every link is a playable ad. Landing pages carry each launch phase; the core site takes over for day-to-day operation once units ship.',
};

export const TARGETS: { metric: string; target: string; by: string }[] = [
  { metric: 'Waitlist sign-ups', target: '60,000', by: '2 Nov 2026' },
  { metric: 'Founders Editions reserved', target: '2,000 of 2,000', by: '16 Nov 2026' },
  { metric: 'Pre-orders', target: '12,000', by: '28 Feb 2027' },
  { metric: 'Visitors who make a loop', target: '14%', by: 'Launch period' },
  { metric: 'Loops shared', target: '20,000', by: '28 Feb 2027' },
  { metric: 'Blended CAC', target: '≤ $45', by: 'Launch period' },
];

export interface PhasePlan {
  id: Phase;
  title: string;
  dates: string;
  goal: string;
  landing: { href: string; name: string }[];
  tactics: string[];
  kpis: [string, string][];
  exit: string;
  siteChanges: string[];
}

export const PHASE_PLANS: PhasePlan[] = [
  {
    id: 'signal',
    title: 'Signal',
    dates: '6 Oct – 2 Nov 2026',
    goal: 'Create curiosity and collect intent before anyone knows exactly what Rondo is.',
    landing: [{ href: '/lp/signal/', name: 'Signal teaser + referral waitlist' }],
    tactics: [
      'A single glowing ring on a night sky: visitors turn it to hear a fragment. No product shots.',
      'Referral queue: every friend who joins moves you 100 places closer to the sun; the first 2,000 get Founders access.',
      'Weekly reveals: a new ring lights up on the teaser each Tuesday, each unlocking one feature.',
      'Seed 40 creators with a laser-cut aluminium ring coaster and a QR code to the teaser.',
      'Cryptic six-second loops on TikTok, Reels and Shorts: one ring, one note, one date.',
      'Open the "Orbit" Discord at 5,000 sign-ups.',
    ],
    kpis: [
      ['Waitlist', '60,000'],
      ['Sign-ups from referrals', '≥ 25%'],
      ['Paid cost per sign-up (tests)', '≤ $2.50'],
      ['Press briefings booked', '12'],
    ],
    exit: 'If fewer than 40,000 have joined by 27 October, extend Signal one week and double creator seeding.',
    siteChanges: [
      'Every primary button says "Join the list" and routes to the Signal page.',
      'Status lines read "Revealing 17 November".',
      'The shop swaps "Pre-order" for "Join the list"; nothing can be bought.',
    ],
  },
  {
    id: 'founders',
    title: 'Founders',
    dates: '3 – 16 Nov 2026',
    goal: 'Reward the earliest believers and give the launch a story people want to be part of.',
    landing: [{ href: '/lp/founders/', name: 'Claim a numbered Founders Edition' }],
    tactics: [
      'Waitlist gets early access in referral order: your orbit rank decides when your window opens.',
      '"Claim your number": pick any free serial from 0001 to 2000; birthdays and lucky numbers go first.',
      'A $49 deposit, fully refundable until shipping, holds the number.',
      'Founders\' names compiled into the firmware credits, forever.',
      'Shareable "I\'m Rondo No. 0427" cards after every claim.',
      'Three-email sequence and a live Founders AMA in Discord.',
    ],
    kpis: [
      ['Founders reserved', '2,000 (100%)'],
      ['Waitlist → deposit', '≥ 3.5%'],
      ['Claims shared', '≥ 30%'],
      ['Deposit refunds', '≤ 5%'],
    ],
    exit: 'Sell-out ends the phase early; any unclaimed numbers roll into launch-day pre-orders.',
    siteChanges: [
      'Primary buttons say "Claim a Founders number" and route to the Founders page.',
      'The shop shows the Founders Edition first and routes to the claim flow.',
    ],
  },
  {
    id: 'launch',
    title: 'Launch',
    dates: '17 Nov 2026 – 28 Feb 2027',
    goal: 'Open public pre-orders and turn attention into bookings while the story is loudest.',
    landing: [
      { href: '/lp/launch/', name: 'Launch page for paid social, press and Product Hunt' },
      { href: '/lp/gift/', name: 'Gift: give a loop now, a Rondo in spring' },
      { href: '/lp/creators/', name: 'Creator and affiliate program' },
    ],
    tactics: [
      '17 Nov, 09:00 PT: embargo lifts on 8 creator reviews and 4 publications; the 60-second launch film goes live.',
      'Product Hunt and a "Show HN: open firmware for a $449 instrument" post the same morning.',
      'Playable ads: short videos that end on "tap to play", landing in the instrument with a loop already loaded.',
      'Retarget people who made a loop (not everyone who visited): "Your loop is waiting."',
      'Gift campaign from 20 Nov: printable card with the giver\'s loop and a QR code; cut-off 18 Dec.',
      'Creator program from 1 Dec: free unit, 12% commission, monthly #playincircles challenge.',
      'Email: waitlist → pre-order (5 emails), abandoned bag (3), post-purchase give $25 / get $25.',
    ],
    kpis: [
      ['Pre-orders', '12,000'],
      ['Visit → pre-order', '≥ 1.0% overall, ≥ 6% for loop makers'],
      ['Loop share rate', '≥ 12% of makers'],
      ['Viral coefficient (K)', '≥ 0.35'],
      ['Cancellations', '≤ 6%'],
    ],
    exit: 'Hand over to Orbit when the first units ship; keep pre-orders open for wave two if demand exceeds wave one.',
    siteChanges: [
      'Primary buttons say "Pre-order · $449" and go to the shop.',
      'Shipping promise reads "Ships spring 2027" everywhere, including checkout and email.',
      'Home sticky bar, Orbit log reward and gift options are live.',
    ],
  },
  {
    id: 'orbit',
    title: 'Orbit',
    dates: 'From 1 Mar 2027',
    goal: 'Ship, delight, and let the core site run the business: evergreen conversion, community and repeat revenue.',
    landing: [{ href: '/', name: 'Core site (home, instrument, play, loops, shop)' }],
    tactics: [
      'Ship in pre-order sequence with tracking emails and a "first loop" unboxing card.',
      'Switch the site to in-stock: "Buy Rondo · ships in 2 working days".',
      'Reviews and owner loops appear on product pages; Loop of the Week becomes a weekly ritual.',
      'A new voice every quarter via free firmware; each drop is a marketing moment.',
      'Selected design-store retail after 10,000 units have shipped.',
    ],
    kpis: [
      ['NPS', '≥ 60'],
      ['Owners still playing at 30 days (survey)', '≥ 70%'],
      ['Revenue from organic and shared traffic', '≥ 40%'],
      ['Accessory attach rate', '≥ 25%'],
    ],
    exit: 'Ongoing. Reviewed monthly against the operating scorecard.',
    siteChanges: [
      'Buttons say "Buy Rondo"; delivery reads "Ships in 2 working days".',
      'Landing pages rotate by campaign; the core site carries everyday traffic.',
    ],
  },
];

export const FUNNEL: { step: string; value: number; note: string }[] = [
  { step: 'Visitors', value: 1_200_000, note: 'Launch period, all channels' },
  { step: 'Played the instrument', value: 480_000, note: '40% tap a ring or press play' },
  { step: 'Made a loop (8+ notes)', value: 168_000, note: '35% of players' },
  { step: 'Added to bag', value: 38_400, note: '3.2% of visitors' },
  { step: 'Pre-ordered', value: 12_000, note: '1.0% of visitors · 31% of bags' },
];

export const LOOPS: { name: string; mechanic: string; why: string }[] = [
  {
    name: 'Every loop is a link',
    mechanic: 'A loop encodes into its URL. Whoever opens it hears it instantly, can remix it, and shares their own.',
    why: 'The product is the ad. No server, no account, no friction.',
  },
  {
    name: 'The referral orbit',
    mechanic: 'Waitlist position improves by 100 places per friend who joins; the first 2,000 get Founders access.',
    why: 'Proven waitlist mechanics, made visible as an orbit you move closer to the sun.',
  },
  {
    name: 'Founders numbers',
    mechanic: 'Claim a serial that means something; get a shareable card.',
    why: 'Personal meaning beats fake scarcity, and it gets posted.',
  },
  {
    name: 'Gift a song',
    mechanic: 'Givers compose a loop; the card carries a QR code that plays it.',
    why: 'Every gift introduces a new household to the product before it ships.',
  },
  {
    name: 'Creators and challenges',
    mechanic: '12% commission, free units, and a monthly #playincircles prompt.',
    why: 'Short, satisfying, remixable videos are native to the platforms.',
  },
  {
    name: 'Give $25, get $25',
    mechanic: 'Post-purchase referral credited on purchase, not sign-up.',
    why: 'Turns happy owners into a sales channel while resisting referral fraud.',
  },
];

export const CHANNELS: { channel: string; phase: string; tactic: string; budget: number; kpi: string }[] = [
  { channel: 'Short video (organic)', phase: 'All', tactic: 'Daily loops, ring-turn close-ups, "mood to loop" prompts', budget: 0, kpi: '25M views' },
  { channel: 'Creator seeding', phase: 'Signal, Launch', tactic: '200 units, briefs not scripts, challenge prizes', budget: 120_000, kpi: '150 videos' },
  { channel: 'Paid social', phase: 'Launch', tactic: 'Playable video ads → Launch page, retarget loop makers', budget: 280_000, kpi: 'CAC ≤ $55' },
  { channel: 'PR and reviews', phase: 'Launch', tactic: 'Embargoed units to 40 outlets and reviewers', budget: 60_000, kpi: '30 reviews on day one' },
  { channel: 'Product Hunt, HN, Reddit', phase: 'Launch day', tactic: 'Founders AMA, open-firmware angle', budget: 0, kpi: 'Top 3 of the day' },
  { channel: 'Email', phase: 'All', tactic: 'Waitlist, Founders, abandoned bag, referral sequences', budget: 12_000, kpi: '12% waitlist → pre-order' },
  { channel: 'Gift guides and affiliates', phase: 'Nov – Dec', tactic: 'Editorial gift guides, gift landing page', budget: 40_000, kpi: '1,500 units' },
  { channel: 'Community', phase: 'All', tactic: 'Discord, Loop of the Week, firmware previews', budget: 8_000, kpi: '15,000 members' },
];

export const BUDGET: { item: string; amount: number }[] = [
  { item: 'Paid social', amount: 280_000 },
  { item: 'Creators (units + fees)', amount: 120_000 },
  { item: 'Content production (films, photography)', amount: 80_000 },
  { item: 'PR and launch events', amount: 60_000 },
  { item: 'Gift guides and affiliates', amount: 40_000 },
  { item: 'Tools, email, analytics', amount: 32_000 },
  { item: 'Contingency', amount: 40_000 },
];

export const EXPERIMENTS: { test: string; hypothesis: string; metric: string }[] = [
  { test: 'Hero: "Hear it" first vs "Pre-order" first', hypothesis: 'Sound-first creates more loop makers, who convert 6× better.', metric: 'Pre-orders per visitor' },
  { test: 'Price framing near CTA', hypothesis: '"$3.74 a month over ten years" reduces price hesitation.', metric: 'Bag adds' },
  { test: 'Shared-loop arrival', hypothesis: 'Opening shared loops with "make your own" beats the full instrument.', metric: 'Share-to-maker rate' },
  { test: 'Founders grid vs counter', hypothesis: 'Choosing a number beats a countdown.', metric: 'Deposits' },
  { test: 'Pay in 4 as default', hypothesis: 'Instalments lift conversion without raising cancellations.', metric: 'Checkout completion' },
  { test: 'Orbit log reward', hypothesis: 'A walnut dock at five stars lifts engagement and AOV.', metric: 'Stars earned, AOV' },
];

export const EVENTS = [
  'play_start',
  'note_add',
  'ring_turn',
  'loop_made (8+ notes)',
  'loop_shared',
  'shared_loop_open',
  'mood_compose',
  'wav_export',
  'waitlist_join',
  'referral_invite',
  'founders_claim',
  'add_to_bag',
  'checkout_start',
  'preorder_placed',
];

export const RISKS: { risk: string; mitigation: string }[] = [
  { risk: 'Manufacturing slips (EVT → PVT)', mitigation: 'Monthly build updates, refundable deposits, ship in waves, 5% buffer stock.' },
  { risk: 'Audio blocked or silent on some phones', mitigation: 'Clear "sound on" affordance, hint about the silent switch, visual-first demo.' },
  { risk: '"Isn\'t this just an app?"', mitigation: 'Honest comparison on the Instrument page; tactile close-up videos; 100-night trial.' },
  { risk: 'Price resistance at $449', mitigation: 'Pay in 4, ten-year cost framing, no-subscription promise, trial.' },
  { risk: 'Creator fatigue / sameness', mitigation: 'Rotate formats monthly, fund challenges rather than scripted ads.' },
  { risk: 'Referral fraud', mitigation: 'Verified emails, rewards on purchase not sign-up, rate limits.' },
];

export const OPERATIONS = {
  cadence: [
    ['Monday', 'Scorecard review: traffic, makers, shares, bookings, CAC'],
    ['Tuesday', 'Loop of the Week goes live (home, loops, email, socials)'],
    ['Thursday', 'Experiment readout and next test chosen'],
    ['Monthly', 'Firmware notes, build update, landing-page rotation'],
  ] as [string, string][],
  deferred: [
    {
      title: 'Accessibility to WCAG 2.2 AA',
      when: 'Weeks 1–3',
      detail: 'Screen-reader pass on the instrument and 3D scenes, reflow and zoom to 400%, focus order, captions and transcripts for films.',
    },
    {
      title: 'SEO and content',
      when: 'Weeks 2–6',
      detail: 'Sitemap and structured-data coverage, per-loop pages with generated OG images, a "ten-second lessons" learning hub.',
    },
    {
      title: 'Real commerce',
      when: 'Weeks 3–8',
      detail: 'Shopify or Stripe checkout, tax and VAT, inventory, wallets (Apple Pay, Google Pay), order emails.',
    },
    {
      title: 'Accounts and access control',
      when: 'Weeks 6–10',
      detail: 'Optional passkey accounts for saved loops; CMS roles for content ops; server-side feature flags for phases.',
    },
    {
      title: 'Waitlist and referral backend',
      when: 'Before Signal',
      detail: 'Persisted queue, verified referrals, anti-fraud, email platform integration.',
    },
    {
      title: 'Performance and resilience',
      when: 'Ongoing',
      detail: 'Real-user Core Web Vitals, WebGPU renderer path, reduced-data mode, error monitoring.',
    },
    {
      title: 'Localisation',
      when: 'After Orbit',
      detail: 'EUR, GBP and JPY pricing, six languages, regional shipping promises.',
    },
  ],
};

export const ASSETS = [
  'Teaser film (12 s vertical, generated from the live scene) plus 12 six-second loops and the 60 s launch film',
  'OG cards for every page and every shared loop',
  'Press kit: renders, specs, founder notes, FAQ',
  'Creator brief and challenge calendar',
  'Email templates for every sequence',
  'Support macros for the top 20 questions',
];
