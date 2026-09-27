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
  shipWindow: 'spring 2027',
  payInFour: true,
} as const;

/** Key dates for the launch. ISO strings in UTC. */
export const DATES = {
  signalStart: '2026-10-06T16:00:00Z',
  foundersStart: '2026-11-03T17:00:00Z',
  launch: '2026-11-17T17:00:00Z',
  giftCutoff: '2026-12-18T23:59:00Z',
  shipStart: '2027-03-15T16:00:00Z',
} as const;

export type ColorwayId = 'noon' | 'ember' | 'moon' | 'eclipse';

export interface Colorway {
  id: ColorwayId;
  name: string;
  note: string;
  swatch: string;
  foundersOnly?: boolean;
}

export const COLORWAYS: Colorway[] = [
  { id: 'noon', name: 'Noon', note: 'Anodised sky blue', swatch: 'oklch(0.7 0.1 238)' },
  { id: 'ember', name: 'Ember', note: 'Sunset coral', swatch: 'oklch(0.66 0.15 32)' },
  { id: 'moon', name: 'Moon', note: 'Raw bead-blasted silver', swatch: 'oklch(0.86 0.008 250)' },
  {
    id: 'eclipse',
    name: 'Eclipse',
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
  cta: { label: string; href: string; price: string };
  status: string;
  shipping: string;
}

export const PHASES: Record<Phase, PhaseDef> = {
  signal: {
    id: 'signal',
    name: 'Signal',
    window: '6 Oct – 2 Nov 2026',
    summary: 'Teaser and waitlist. Nothing is for sale; we collect intent and referrals.',
    cta: { label: 'Join the list', href: '/lp/signal/', price: 'Reveal 17 Nov' },
    status: 'Revealing 17 November',
    shipping: 'Join the list to hear first',
  },
  founders: {
    id: 'founders',
    name: 'Founders',
    window: '3 – 16 Nov 2026',
    summary: '2,000 numbered Founders Editions, reserved with a $49 refundable deposit.',
    cta: { label: 'Claim a Founders number', href: '/lp/founders/', price: '$49 deposit' },
    status: 'Founders numbers are being claimed',
    shipping: 'Founders ship first, in March 2027',
  },
  launch: {
    id: 'launch',
    name: 'Launch',
    window: '17 Nov 2026 – 28 Feb 2027',
    summary: 'Public pre-orders on the core site, supported by launch and gift landing pages.',
    cta: { label: 'Pre-order', href: '/shop/', price: '$449' },
    status: 'Pre-orders open',
    shipping: 'Ships spring 2027',
  },
  orbit: {
    id: 'orbit',
    name: 'Orbit',
    window: 'From 1 Mar 2027',
    summary: 'In stock. The core site runs the business; landing pages rotate by campaign.',
    cta: { label: 'Buy Rondo', href: '/shop/', price: '$449' },
    status: 'In stock',
    shipping: 'Ships in 2 working days',
  },
};

export const PHASE_ORDER: Phase[] = ['signal', 'founders', 'launch', 'orbit'];

/** The phase the public site renders by default. Mission Control (/launch-plan/) can preview others. */
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

export const formatPrice = (n: number, opts: { cents?: boolean } = {}) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(n);

/** Price reframed over the ten-year promise. */
export const perMonthOverTenYears = (price: number) => price / (PRODUCT.updateYears * 12);
