/**
 * Bag state. Pure functions over a persisted array so checkout, the drawer and the
 * header badge always agree. Prices come from data/site.ts, never from the DOM.
 */
import { ADDONS, COLORWAYS, PRODUCT, type ColorwayId } from '@/data/site';
import { persisted } from './store';

export type Sku = 'rondo' | 'founders' | 'dock' | 'sleeve' | 'midi' | 'gift-card';

export interface GiftDetails {
  to: string;
  from: string;
  message: string;
  /** Encoded loop (the #l= code) printed on the gift card as a QR code. */
  loop?: string;
}

export interface CartItem {
  key: string;
  sku: Sku;
  name: string;
  variant: string;
  price: number;
  qty: number;
  colorway?: ColorwayId;
  engraving?: string;
  founderNumber?: number;
  gift?: GiftDetails;
}

export const cart = persisted<CartItem[]>('cart', [], 2);

/** Set when the Orbit log reward (five stars) is unlocked. */
export const rewardUnlocked = persisted<boolean>('reward', false);

/** A friend's referral (?ref=CODE): $25 off an instrument. */
export const REFERRAL_CREDIT = 25;
export const referral = persisted<{ code: string; at: number } | null>('referral', null);

export function lineKey(item: Pick<CartItem, 'sku' | 'colorway' | 'engraving' | 'founderNumber' | 'gift'>): string {
  return [item.sku, item.colorway ?? '', item.engraving ?? '', item.founderNumber ?? '', item.gift ? `gift:${item.gift.to}` : ''].join('|');
}

export function rondoItem(opts: {
  colorway: ColorwayId;
  founders?: boolean;
  engraving?: string;
  founderNumber?: number;
  gift?: GiftDetails;
}): Omit<CartItem, 'qty'> {
  const cw = COLORWAYS.find((c) => c.id === opts.colorway) ?? COLORWAYS[0]!;
  const founders = Boolean(opts.founders);
  const engraving = opts.engraving?.trim() || undefined;
  const parts = [cw.name];
  if (founders && opts.founderNumber) parts.push(`No. ${String(opts.founderNumber).padStart(4, '0')}`);
  if (engraving) parts.push(`engraved “${engraving}”`);
  if (opts.gift?.to) parts.push(`gift for ${opts.gift.to}`);
  const base = {
    sku: (founders ? 'founders' : 'rondo') as Sku,
    name: founders ? 'Rondo Founders Edition' : 'Rondo',
    variant: parts.join(' · '),
    price: founders ? PRODUCT.foundersPrice : PRODUCT.price,
    colorway: cw.id,
    engraving,
    founderNumber: opts.founderNumber,
    gift: opts.gift,
  };
  return { ...base, key: lineKey(base) };
}

export function addonItem(id: string): Omit<CartItem, 'qty'> | null {
  const a = ADDONS.find((x) => x.id === id);
  if (!a) return null;
  const base = { sku: a.id as Sku, name: a.name, variant: a.note, price: a.price };
  return { ...base, key: lineKey(base) };
}

export function addToCart(item: Omit<CartItem, 'qty'>, qty = 1): void {
  cart.set((items) => {
    const existing = items.find((i) => i.key === item.key);
    if (existing) {
      // Founders numbers are unique: never more than one of the same number.
      const max = item.sku === 'founders' ? 1 : 9;
      return items.map((i) => (i.key === item.key ? { ...i, qty: Math.min(max, i.qty + qty) } : i));
    }
    return [...items, { ...item, qty }];
  });
}

export function setQty(key: string, qty: number): void {
  cart.set((items) =>
    qty <= 0 ? items.filter((i) => i.key !== key) : items.map((i) => (i.key === key ? { ...i, qty: Math.min(9, qty) } : i)),
  );
}

export function removeLine(key: string): CartItem | undefined {
  const removed = cart.get().find((i) => i.key === key);
  cart.set((items) => items.filter((i) => i.key !== key));
  return removed;
}

export function restoreLine(item: CartItem, index?: number): void {
  cart.set((items) => {
    if (items.some((i) => i.key === item.key)) return items;
    const next = [...items];
    next.splice(index ?? next.length, 0, item);
    return next;
  });
}

export function clearCart(): void {
  cart.set([]);
}

export interface Totals {
  count: number;
  subtotal: number;
  reward: number;
  rewardLabel: string | null;
  referral: number;
  shipping: number;
  total: number;
  hasInstrument: boolean;
  /** Paid today: Founders deposits only (pre-orders are charged when they ship). */
  dueToday: number;
  founders: boolean;
}

export function totals(items: CartItem[] = cart.get(), reward = rewardUnlocked.get(), ref = referral.get()): Totals {
  const count = items.reduce((n, i) => n + i.qty, 0);
  const subtotal = items.reduce((n, i) => n + i.qty * i.price, 0);
  const hasInstrument = items.some((i) => i.sku === 'rondo' || i.sku === 'founders');
  let rewardValue = 0;
  let rewardLabel: string | null = null;
  if (reward && hasInstrument) {
    const dock = ADDONS.find((a) => a.id === 'dock')!;
    const dockInBag = items.some((i) => i.sku === 'dock');
    rewardValue = dockInBag ? dock.price : 0;
    rewardLabel = dockInBag ? 'Orbit log reward: walnut dock on us' : 'Orbit log reward: a walnut dock ships free with your Rondo';
  }
  const referralValue = ref && hasInstrument ? REFERRAL_CREDIT : 0;
  const founders = items.some((i) => i.sku === 'founders');
  const dueToday = items.filter((i) => i.sku === 'founders').reduce((n, i) => n + i.qty * PRODUCT.foundersDeposit, 0);
  return {
    count,
    subtotal,
    reward: rewardValue,
    rewardLabel,
    referral: referralValue,
    shipping: 0,
    total: Math.max(0, subtotal - rewardValue - referralValue),
    hasInstrument,
    dueToday,
    founders,
  };
}
