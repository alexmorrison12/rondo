/** Checkout: validation, promo codes, order creation (stored in session), confirmation hand-off. */
import { ADDONS, ORDER_NUMBER, PAYMENT, PHASES, formatPrice } from '@/data/site';
import { ICONS } from '@/lib/icons';
import { url } from '@/lib/url';
import { cart, clearCart, referral, rewardUnlocked, totals, type CartItem } from '../core/cart';
import { currentPhase } from '../core/phase';
import { sessionValue } from '../core/store';
import { toast } from '../core/toast';

export interface PlacedOrder {
  number: string;
  firstName: string;
  email: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  plan: 'full' | 'four';
  phase: string;
  placedAt: string;
  founderNumber?: number;
}

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const PROMOS: Record<string, { label: string; apply: (items: CartItem[]) => number }> = {
  CIRCLES10: {
    label: '10% off accessories',
    apply: (items) => items.filter((i) => ADDONS.some((a) => a.id === i.sku)).reduce((n, i) => n + i.price * i.qty * 0.1, 0),
  },
  FIELDNOTES: {
    label: 'Free wool sleeve with any Rondo',
    apply: (items) => (items.some((i) => i.sku === 'sleeve') && items.some((i) => i.sku === 'rondo' || i.sku === 'founders') ? 29 : 0),
  },
};
let promo: string | null = null;

function discount(items: CartItem[]) {
  const t = totals(items);
  const p = promo ? PROMOS[promo]!.apply(items) : 0;
  return { t, promoValue: Math.round(p * 100) / 100 };
}

function thumbFor(i: CartItem) {
  const finish = i.colorway ? `var(--finish-${i.colorway})` : 'var(--finish-moon)';
  if (i.sku === 'rondo' || i.sku === 'founders')
    return `<span class="bag-thumb bag-thumb--rondo" style="--finish:${finish}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
  return `<span class="bag-thumb" aria-hidden="true">${i.sku === 'midi' ? ICONS.usb : ICONS.sparkles}</span>`;
}

function render() {
  const items = cart.get();
  const lines = $('[data-summary-lines]');
  const totalsEl = $('[data-summary-totals]');
  if (!items.length) {
    lines.innerHTML = `<li style="grid-template-columns:1fr"><span>Your bag is empty. <a href="${url('/shop/')}">Choose your Rondo</a> or <a href="${url('/play/')}">play one for free</a>.</span></li>`;
    totalsEl.innerHTML = '';
    $<HTMLButtonElement>('[data-place]').disabled = true;
    return;
  }
  $<HTMLButtonElement>('[data-place]').disabled = false;
  const { t, promoValue } = discount(items);
  const total = Math.max(0, t.total - promoValue);
  const deposit = t.dueToday;
  lines.innerHTML = items
    .map(
      (i) => `<li>${thumbFor(i)}<span><span class="line-name">${esc(i.name)}${i.qty > 1 ? ` × ${i.qty}` : ''}</span><br><span class="line-variant">${esc(i.variant)}</span></span><span class="num">${formatPrice(i.price * i.qty)}</span></li>`,
    )
    .join('');
  totalsEl.innerHTML = `
    <div><dt>Subtotal</dt><dd class="num">${formatPrice(t.subtotal)}</dd></div>
    ${t.reward ? `<div><dt>Orbit reward</dt><dd class="num">−${formatPrice(t.reward)}</dd></div>` : ''}
    ${t.rewardLabel && !t.reward ? `<div><dt>Orbit reward</dt><dd>Walnut dock, free</dd></div>` : ''}
    ${t.referral ? `<div><dt>Friend's referral</dt><dd class="num">−${formatPrice(t.referral)}</dd></div>` : ''}
    ${promoValue ? `<div><dt>${esc(PROMOS[promo!]!.label)}</dt><dd class="num">−${formatPrice(promoValue, { cents: true })}</dd></div>` : ''}
    <div><dt>Shipping</dt><dd>Free</dd></div>
    <div><dt>Sales tax</dt><dd>From your address</dd></div>
    <div class="total"><dt>Total</dt><dd class="num">${formatPrice(total, { cents: total % 1 !== 0 })}</dd></div>
    ${deposit ? `<div><dt>Due today</dt><dd class="num">${formatPrice(deposit)} refundable deposit</dd></div><div><dt>When it ships</dt><dd class="num">${formatPrice(total - deposit)}</dd></div>` : ''}`;
  // One story about money, told the same way everywhere (data/site.ts PAYMENT).
  const phase = currentPhase();
  const inStock = phase === 'orbit';
  const remainder = total - deposit;
  $('[data-plan-full]').textContent = formatPrice(total, { cents: total % 1 !== 0 });
  $('[data-plan-four]').textContent = `${formatPrice(remainder / 4, { cents: true })} × 4`;
  $('[data-plan-full-note]').textContent = inStock
    ? `${formatPrice(total)} today.`
    : deposit
      ? `${formatPrice(deposit)} refundable deposit today · ${formatPrice(remainder)} the day it ships`
      : `${formatPrice(0)} today · ${formatPrice(total)} the day it ships`;
  $('[data-plan-four-note]').textContent = deposit
    ? `${formatPrice(deposit)} deposit today, then ${PAYMENT.payInFourLine(remainder).toLowerCase()}`
    : inStock
      ? `4 interest-free payments of ${formatPrice(total / 4, { cents: true })}, the first today`
      : PAYMENT.payInFourLine(total);
  $('[data-place-label]').textContent = inStock
    ? `Pay ${formatPrice(total)}`
    : deposit
      ? `Pay ${formatPrice(deposit)} deposit`
      : `Place pre-order · ${formatPrice(0)} today`;
}

/* ── Validation ─────────────────────────────────────────────────── */
const rules: Record<string, (v: string) => string | null> = {
  email: (v) => (!v ? 'Add your email so we can send your confirmation.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'That email looks incomplete, e.g. you@example.com.'),
  first: (v) => (v.trim() ? null : 'Add a first name.'),
  last: (v) => (v.trim() ? null : 'Add a last name.'),
  address: (v) => (v.trim().length > 3 ? null : 'Add a street address.'),
  city: (v) => (v.trim() ? null : 'Add a city.'),
  zip: (v) => (v.trim().length >= 3 ? null : 'Add a postcode.'),
};

function validateField(form: HTMLFormElement, name: string): boolean {
  const input = form.elements.namedItem(name) as HTMLInputElement | null;
  if (!input) return true;
  const msg = rules[name]!(input.value);
  const err = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
  input.setAttribute('aria-invalid', String(Boolean(msg)));
  if (err) {
    err.hidden = !msg;
    err.textContent = msg ?? '';
    if (msg) {
      err.id = `err-${name}`;
      input.setAttribute('aria-describedby', err.id);
    } else input.removeAttribute('aria-describedby');
  }
  return !msg;
}

function init() {
  const form = $<HTMLFormElement>('[data-checkout]');
  Object.keys(rules).forEach((name) => {
    const input = form.elements.namedItem(name) as HTMLInputElement | null;
    input?.addEventListener('blur', () => input.value && validateField(form, name));
    input?.addEventListener('input', () => input.getAttribute('aria-invalid') === 'true' && validateField(form, name));
  });

  const gift = $<HTMLInputElement>('[data-gift-toggle]');
  gift.addEventListener('change', () => ($('[data-gift-note]').hidden = !gift.checked));
  // Gifts from /lp/gift/ arrive with their card details: honour them.
  const giftItem = cart.get().find((i) => i.gift);
  if (giftItem?.gift) {
    gift.checked = true;
    $('[data-gift-note]').hidden = false;
    const note = $<HTMLTextAreaElement>('#co-gift');
    if (!note.value) note.value = [giftItem.gift.message, giftItem.gift.from ? `— ${giftItem.gift.from}` : ''].filter(Boolean).join('\n');
  }

  $<HTMLFormElement>('[data-promo]').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).elements.namedItem('promo') as HTMLInputElement;
    const code = input.value.trim().toUpperCase();
    const msg = $('[data-promo-msg]');
    if (!code) return;
    if (code === 'ORBIT') {
      msg.dataset.ok = String(rewardUnlocked.get());
      msg.textContent = rewardUnlocked.get()
        ? 'Your Orbit log reward is already applied.'
        : 'ORBIT unlocks at five stars in the Orbit log (the ✦ in the header).';
      return;
    }
    if (PROMOS[code]) {
      promo = code;
      msg.dataset.ok = 'true';
      msg.textContent = `Applied: ${PROMOS[code]!.label}.`;
      render();
    } else {
      msg.dataset.ok = 'false';
      msg.textContent = "That code isn't valid. Codes are case-insensitive, e.g. CIRCLES10.";
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = Object.keys(rules).filter((name) => !validateField(form, name));
    if (bad.length) {
      (form.elements.namedItem(bad[0]!) as HTMLInputElement).focus();
      toast(`Almost there: ${bad.length} field${bad.length > 1 ? 's need' : ' needs'} a look.`);
      return;
    }
    const items = cart.get();
    if (!items.length) return;
    const { t, promoValue } = discount(items);
    const data = new FormData(form);
    const n = String(Math.floor(10000 + Math.random() * 89999));
    const order: PlacedOrder = {
      number: ORDER_NUMBER.make(new Date().getFullYear(), Number(n)),
      firstName: String(data.get('first') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      items,
      subtotal: t.subtotal,
      discount: t.reward + promoValue,
      total: Math.max(0, t.total - promoValue),
      plan: data.get('plan') === 'four' ? 'four' : 'full',
      phase: PHASES[currentPhase()].name,
      placedAt: new Date().toISOString(),
      founderNumber: items.find((i) => i.founderNumber)?.founderNumber,
    };
    sessionValue<PlacedOrder>('order').set(order);
    const btn = $<HTMLButtonElement>('[data-place]');
    btn.disabled = true;
    btn.innerHTML = `<span>Placing your order…</span>`;
    window.setTimeout(() => {
      clearCart();
      location.href = url('/order/');
    }, 700);
  });

  cart.subscribe(render);
  rewardUnlocked.subscribe(render, false);
  referral.subscribe(render, false);
}

init();
