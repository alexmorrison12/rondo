/** The bag drawer: a native <dialog> rendered from cart state, with undo on remove. */
import { formatPrice } from '@/data/site';
import { ICONS } from '@/lib/icons';
import { url } from '@/lib/url';
import { cart, removeLine, restoreLine, rewardUnlocked, setQty, totals, type CartItem } from './cart';
import { uiPop } from './sound';
import { toast } from './toast';

let dialog: HTMLDialogElement | null = null;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function thumb(item: CartItem): string {
  const finish =
    item.colorway === 'ember'
      ? 'var(--finish-ember)'
      : item.colorway === 'moon'
        ? 'var(--finish-moon)'
        : item.colorway === 'eclipse'
          ? 'var(--finish-eclipse)'
          : 'var(--finish-noon)';
  if (item.sku === 'rondo' || item.sku === 'founders') {
    return `<span class="bag-thumb bag-thumb--rondo" style="--finish:${finish}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
  }
  const glyph = item.sku === 'gift-card' ? ICONS.gift : item.sku === 'midi' ? ICONS.usb : ICONS.sparkles;
  return `<span class="bag-thumb" aria-hidden="true">${glyph}</span>`;
}

function render(items: CartItem[]) {
  if (!dialog) return;
  const body = dialog.querySelector<HTMLElement>('[data-bag-body]')!;
  const foot = dialog.querySelector<HTMLElement>('[data-bag-foot]')!;
  const t = totals(items);

  if (!items.length) {
    body.innerHTML = `
      <div class="bag-empty">
        <span class="bag-thumb bag-thumb--rondo bag-thumb--xl" style="--finish:var(--finish-moon)" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <p class="title">Your bag is empty.</p>
        <p class="soft">The rings are waiting. You can also play one for free, right now, in your browser.</p>
        <div class="bag-empty__actions">
          <a class="btn btn--ink" href="${url('/shop/')}">Choose your Rondo</a>
          <a class="btn btn--quiet" href="${url('/play/')}">Play in browser ${ICONS.arrowRight}</a>
        </div>
      </div>`;
    foot.hidden = true;
    return;
  }

  foot.hidden = false;
  body.innerHTML = `<ul class="bag-lines" role="list">${items
    .map(
      (i) => `
      <li class="bag-line" data-key="${esc(i.key)}">
        ${thumb(i)}
        <div class="bag-line__info">
          <p class="bag-line__name">${esc(i.name)}</p>
          <p class="bag-line__variant">${esc(i.variant)}</p>
          <div class="bag-line__row">
            <div class="stepper" role="group" aria-label="Quantity for ${esc(i.name)}">
              <button type="button" data-qty="-1" aria-label="One fewer">${ICONS.minus}</button>
              <output aria-live="polite">${i.qty}</output>
              <button type="button" data-qty="1" aria-label="One more" ${i.sku === 'founders' ? 'disabled' : ''}>${ICONS.plus}</button>
            </div>
            <button type="button" class="bag-line__remove" data-remove>Remove</button>
          </div>
        </div>
        <p class="bag-line__price num">${formatPrice(i.price * i.qty)}</p>
      </li>`,
    )
    .join('')}</ul>
    ${t.rewardLabel ? `<p class="bag-reward">${ICONS.star}<span>${esc(t.rewardLabel)}</span></p>` : ''}`;

  foot.innerHTML = `
    <dl class="bag-sum">
      <div><dt>Subtotal</dt><dd class="num">${formatPrice(t.subtotal)}</dd></div>
      ${t.reward ? `<div><dt>Orbit reward</dt><dd class="num">−${formatPrice(t.reward)}</dd></div>` : ''}
      ${t.referral ? `<div><dt>Friend's referral</dt><dd class="num">−${formatPrice(t.referral)}</dd></div>` : ''}
      <div><dt>Shipping</dt><dd>Free</dd></div>
      <div class="bag-sum__total"><dt>Total</dt><dd class="num">${formatPrice(t.total)}</dd></div>
    </dl>
    <a class="btn btn--ink btn--lg btn--block" href="${url('/checkout/')}">Checkout ${ICONS.arrowRight}</a>
    <p class="bag-note">${ICONS.shield} ${t.founders ? `${formatPrice(t.dueToday)} deposit today` : 'Nothing charged until it ships'} · 100-night trial</p>`;
}

export function openBag(): void {
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
}

export function initBag(): void {
  dialog = document.querySelector<HTMLDialogElement>('[data-bag]');
  const badges = document.querySelectorAll<HTMLElement>('[data-bag-count]');
  const buttons = document.querySelectorAll<HTMLElement>('[data-bag-open]');

  const sync = (items: CartItem[]) => {
    const count = totals(items).count;
    badges.forEach((b) => {
      b.textContent = count ? String(count) : '';
      b.dataset.count = String(count);
    });
    buttons.forEach((b) => b.setAttribute('aria-label', count ? `Bag, ${count} item${count > 1 ? 's' : ''}` : 'Bag, empty'));
    render(items);
  };
  cart.subscribe(sync);
  rewardUnlocked.subscribe(() => render(cart.get()), false);

  buttons.forEach((b) => b.addEventListener('click', openBag));
  if (!dialog) return;
  dialog.querySelector('[data-bag-close]')?.addEventListener('click', () => dialog!.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog!.close();
  });
  dialog.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const line = target.closest<HTMLElement>('.bag-line');
    if (!line) return;
    const key = line.dataset.key!;
    const qtyBtn = target.closest<HTMLButtonElement>('[data-qty]');
    if (qtyBtn) {
      const item = cart.get().find((i) => i.key === key);
      if (item) {
        const next = item.qty + Number(qtyBtn.dataset.qty);
        if (next <= 0) return removeWithUndo(key);
        setQty(key, next);
        uiPop(Number(qtyBtn.dataset.qty) > 0);
      }
      return;
    }
    if (target.closest('[data-remove]')) removeWithUndo(key);
  });
}

function removeWithUndo(key: string) {
  const index = cart.get().findIndex((i) => i.key === key);
  const removed = removeLine(key);
  if (!removed) return;
  uiPop(false);
  toast(`Removed ${removed.name}`, { icon: 'undo', action: { label: 'Undo', onClick: () => restoreLine(removed, index) } });
}
