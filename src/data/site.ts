/**
 * Single source of truth for product facts, prices, dates and launch phases.
 * Everything customer-facing (pages, CTAs, checkout, launch plan) reads from here,
 * so a price or date changes in exactly one place.
 */

export const CURRENCY = 'USD';

export const PRODUCT = {
  name: 'Rondo',
  tagline: 'Play in circles.',
  oneLiner:
    'A palm-sized instrument with four spinning rings. Tap a ring to place a note, turn it to change the groove.',
  price: 449,
  foundersPrice: 599,
  foundersDeposit: 49,
  foundersTotal: 2000,
  trialNights: 100,
  warrantyYears: 5,
  updateYears: 10,
  /** Ten years of updates from the day the first units ship. */
  updatesUntil: 2037,
  shipWindow: 'spring 2027',
  payInFour: true,
} as const;

export const formatPrice = (n: number, opts: { cents?: boolean } = {}) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(n);

/** Key dates for the launch. ISO strings in UTC. */
export const DATES = {
  signalStart: '2026-10-06T16:00:00Z',
  foundersStart: '2026-11-03T17:00:00Z',
  launch: '2026-11-17T17:00:00Z',
  giftCutoff: '2026-12-18T23:59:00Z',
  shipStart: '2027-03-15T16:00:00Z',
  /** Pre-order backlog cleared: the site switches to in-stock. */
  orbitStart: '2027-05-03T16:00:00Z',
} as const;

export type ColorwayId = 'noon' | 'ember' | 'moon' | 'eclipse';

export interface Colorway {
  id: ColorwayId;
  name: string;
  /** Plain colour word, so "Noon" never reads as a time of day on its own. */
  word: string;
  note: string;
  swatch: string;
  foundersOnly?: boolean;
}

export const COLORWAYS: Colorway[] = [
  { id: 'noon', name: 'Noon', word: 'blue', note: 'Anodised sky blue', swatch: 'oklch(0.7 0.1 238)' },
  { id: 'ember', name: 'Ember', word: 'coral', note: 'Sunset coral', swatch: 'oklch(0.66 0.15 32)' },
  { id: 'moon', name: 'Moon', word: 'silver', note: 'Raw bead-blasted silver', swatch: 'oklch(0.86 0.008 250)' },
  {
    id: 'eclipse',
    name: 'Eclipse',
    word: 'black',
    note: 'Black, with a brass sun',
    swatch: 'oklch(0.24 0.012 260)',
    foundersOnly: true,
  },
];

export interface Addon {
  id: string;
  name: string;
  price: number;
  note: string;
}

export const ADDONS: Addon[] = [
  { id: 'dock', name: 'Walnut dock', price: 39, note: 'Solid walnut. Charges through the base.' },
  { id: 'sleeve', name: 'Wool sleeve', price: 29, note: 'Felted merino. Fits a coat pocket.' },
  { id: 'midi', name: 'MIDI pair', price: 19, note: 'Two 3.5 mm TRS-A cables, 1.5 m.' },
];

export type Phase = 'signal' | 'founders' | 'launch' | 'orbit';

export interface PhaseDef {
  id: Phase;
  name: string;
  window: string;
  summary: string;
  cta: { label: string; short: string; href: string; price: string };
  status: string;
  shipping: string;
  /** Risk reversals under the main call to action, true for this phase. */
  trust: string[];
}

export const PHASES: Record<Phase, PhaseDef> = {
  signal: {
    id: 'signal',
    name: 'Signal',
    window: '6 Oct – 2 Nov 2026',
    summary: 'Teaser and waitlist. Nothing is for sale; we collect intent and referrals.',
    cta: { label: 'Join the list', short: 'Join', href: '/lp/signal/', price: 'Reveal 17 Nov' },
    status: 'Revealing 17 November',
    shipping: 'Join the list to hear first',
    trust: ['Free to join', 'One email a week, at most', 'No subscription, ever'],
  },
  founders: {
    id: 'founders',
    name: 'Founders',
    window: '3 – 16 Nov 2026',
    summary: '2,000 numbered Founders Editions, reserved with a $49 refundable deposit.',
    cta: { label: 'Claim a Founders number', short: 'Claim', href: '/lp/founders/', price: '$49 deposit' },
    status: 'Founders numbers are being claimed',
    shipping: 'Founders ship first, in March 2027',
    trust: [`${formatPrice(PRODUCT.foundersDeposit)} deposit, refundable until it ships`, `${PRODUCT.trialNights}-night trial`, 'No subscription, ever'],
  },
  launch: {
    id: 'launch',
    name: 'Launch',
    window: '17 Nov 2026 – 2 May 2027',
    summary: 'Public pre-orders on the core site, supported by launch and gift landing pages.',
    cta: { label: 'Pre-order', short: 'Pre-order', href: '/shop/', price: '$449' },
    status: 'Pre-orders open',
    shipping: 'Ships spring 2027',
    trust: ['Nothing charged until it ships', `${PRODUCT.trialNights}-night trial`, 'No subscription, ever'],
  },
  orbit: {
    id: 'orbit',
    name: 'Orbit',
    window: 'From 3 May 2027',
    summary: 'The pre-order backlog has shipped and Rondo is in stock. The core site runs the business; landing pages rotate by campaign.',
    cta: { label: 'Buy Rondo', short: 'Buy', href: '/shop/', price: '$449' },
    status: 'In stock',
    shipping: 'Ships in 2 working days',
    trust: ['Ships in 2 working days', `${PRODUCT.trialNights}-night trial`, 'No subscription, ever'],
  },
};

export const PHASE_ORDER: Phase[] = ['signal', 'founders', 'launch', 'orbit'];

/** The phase the calendar says we're in. Used at go-live; the prototype previews Launch by default. */
export function phaseForDate(now = new Date()): Phase {
  const t = now.getTime();
  if (t < Date.parse(DATES.foundersStart)) return 'signal';
  if (t < Date.parse(DATES.launch)) return 'founders';
  if (t < Date.parse(DATES.orbitStart)) return 'launch';
  return 'orbit';
}

/**
 * 'prototype': the site previews DEFAULT_PHASE (so the full commerce flow can be shown) and says so
 * in a visible chip. 'live': the phase follows the calendar (phaseForDate). Previews of other phases
 * are per-tab (?phase= or the chip) and never persist beyond the session.
 */
export const SITE_MODE: 'prototype' | 'live' = 'prototype';

/** The phase the prototype previews by default. */
export const DEFAULT_PHASE: Phase = 'launch';

export const NAV = [
  { href: '/instrument/', label: 'Instrument' },
  { href: '/play/', label: 'Play' },
  { href: '/loops/', label: 'Loops' },
  { href: '/story/', label: 'Story' },
] as const;

export const LANDING_PAGES = [
  { href: '/lp/signal/', name: 'Signal', phase: 'signal' as Phase, purpose: 'Teaser + referral waitlist' },
  { href: '/lp/founders/', name: 'Founders', phase: 'founders' as Phase, purpose: 'Claim a numbered Founders Edition' },
  { href: '/lp/launch/', name: 'Launch day', phase: 'launch' as Phase, purpose: 'Paid social, press and Product Hunt traffic' },
  { href: '/lp/gift/', name: 'Gift', phase: 'launch' as Phase, purpose: 'Holiday: give a loop now, a Rondo in spring' },
  { href: '/lp/creators/', name: 'Creators', phase: 'orbit' as Phase, purpose: 'Creator and affiliate program' },
] as const;

/** Price reframed over the ten-year promise. */
export const perMonthOverTenYears = (price: number) => price / (PRODUCT.updateYears * 12);

/**
 * How money moves. Every surface that mentions payment (FAQ, offer cards, checkout, order,
 * support) renders from here so the terms can never contradict each other.
 */
/** One order-number format, used by checkout (generation) and support (validation, examples). */
export const ORDER_NUMBER = {
  example: 'RDO-2026-10427',
  pattern: /^RDO-?\d{4}-?\d{5}$/i,
  make: (year: number, n: number) => `RDO-${year}-${String(n).padStart(5, '0')}`,
};

export const PAYMENT = {
  standardToday: 0,
  foundersToday: PRODUCT.foundersDeposit,
  standardLine: () => `${formatPrice(0)} today · ${formatPrice(PRODUCT.price)} the day it ships`,
  foundersLine: () =>
    `${formatPrice(PRODUCT.foundersDeposit)} refundable deposit today · ${formatPrice(PRODUCT.foundersPrice - PRODUCT.foundersDeposit)} the day it ships`,
  payInFourLine: (total: number) => `4 interest-free payments of ${formatPrice(total / 4, { cents: true })}, the first on the day it ships`,
  cancel: 'Cancel any time before it ships. Pre-orders are never charged early, and deposits come back in full.',
  tax: 'Sales tax is calculated at checkout.',
  markets: 'Shipping to the US and Canada at launch, in US and Canadian dollars. UK, EU and Japan follow in 2027 with local prices.',
} as const;
