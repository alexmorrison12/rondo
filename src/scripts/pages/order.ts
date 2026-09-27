/** Order confirmation: reads the placed order from session, offers calendar + referral. */
import { DATES, PRODUCT, formatPrice } from '@/data/site';
import { drawFoundersCard } from '../lib/founders-card';
import { earn } from '../core/achievements';
import { downloadBlob, shareLink } from '../core/share';
import { sessionValue } from '../core/store';
import type { PlacedOrder } from './checkout';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const order = sessionValue<PlacedOrder>('order').get();

if (!order) {
  $('[data-confirm]').hidden = true;
  $('[data-empty]').hidden = false;
} else {
  const isPre = order.phase !== 'Orbit';
  const founders = order.items.some((i) => i.sku === 'founders');
  $('[data-title]').textContent = order.firstName ? `You're in orbit, ${order.firstName}.` : "You're in orbit.";
  $('[data-lead]').textContent = !isPre
    ? `Your order is confirmed and will ship within two working days. A receipt is on its way to ${order.email}.`
    : founders
      ? `Your Founders number is yours: the ${formatPrice(PRODUCT.foundersDeposit)} deposit is paid, and the rest is charged the day it ships. A receipt is on its way to ${order.email}.`
      : `Your pre-order is confirmed and nothing has been charged: you pay the day it ships. A receipt is on its way to ${order.email}.`;
  if (founders && order.founderNumber) {
    const card = $('[data-founder-card]');
    const canvas = $<HTMLCanvasElement>('[data-founder-canvas]');
    card.hidden = false;
    document.fonts.ready.then(() => drawFoundersCard(canvas, order.founderNumber!));
    $('[data-founder-save]').addEventListener('click', () =>
      canvas.toBlob((b) => b && downloadBlob(b, `rondo-founders-${String(order.founderNumber).padStart(4, '0')}.png`), 'image/png'),
    );
  }
  const founder = order.founderNumber ? ` · Founders No. ${String(order.founderNumber).padStart(4, '0')}` : '';
  $('[data-number]').textContent = `Order ${order.number} · ${formatPrice(order.total)}${founder}`;

  const code = `RONDO-${order.firstName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'FRIEND'}${order.number.slice(-3)}`;
  const referUrl = `${location.origin}${import.meta.env.BASE_URL}?ref=${code}`;
  $<HTMLInputElement>('[data-refer]').value = referUrl;
  $('[data-share-refer]').addEventListener('click', async () => {
    const r = await shareLink({ title: 'Rondo: $25 off', text: 'Here is $25 off a Rondo, the instrument that plays in circles:', url: referUrl });
    if (r !== 'cancelled') earn('share');
  });

  $('[data-ics]').addEventListener('click', () => {
    const start = new Date(DATES.shipStart);
    const d = (x: Date) => x.toISOString().slice(0, 10).replace(/-/g, '');
    const end = new Date(start.getTime() + 24 * 3600 * 1000);
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Rondo//Order//EN',
      'BEGIN:VEVENT',
      `UID:${order.number}@rondo`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      `DTSTART;VALUE=DATE:${d(start)}`,
      `DTEND;VALUE=DATE:${d(end)}`,
      `SUMMARY:Your Rondo starts shipping (${order.number})`,
      'DESCRIPTION:Pre-orders ship in order. We will email tracking the day yours leaves.',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    downloadBlob(new Blob([ics], { type: 'text/calendar' }), 'rondo-ship-date.ics');
  });
}
