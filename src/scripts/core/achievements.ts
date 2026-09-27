/**
 * The Orbit log: seven small "stars" earned by being curious (never by being interrupted).
 * Five stars unlock a real reward at checkout: a walnut dock with your Rondo.
 */
import { REWARD_AT, STARS, type StarId } from '@/data/stars';
import { url } from '@/lib/url';
import { rewardUnlocked } from './cart';
import { uiChime } from './sound';
import { persisted } from './store';
import { toast } from './toast';

export { STARS, REWARD_AT, type StarId };

export const earned = persisted<Partial<Record<StarId, number>>>('stars', {});

export const earnedCount = () => Object.keys(earned.get()).length;

let opener: (() => void) | null = null;

let pending: StarId[] = [];
let flushTimer = 0;

function pulseCounter() {
  document.querySelectorAll<HTMLElement>('[data-orbit-open]').forEach((b) => {
    b.dataset.pulse = 'false';
    void b.offsetWidth;
    b.dataset.pulse = 'true';
  });
}

/** Stars earned together become one quiet note; while music plays they only pulse the counter. */
function flush() {
  const ids = pending;
  pending = [];
  if (!ids.length) return;
  const count = earnedCount();
  const titles = ids.map((i) => STARS.find((s) => s.id === i)!.title);
  if (isPlaying()) return;
  toast(ids.length === 1 ? `Star ${count} of ${STARS.length}: ${titles[0]}` : `${ids.length} stars: ${titles.join(', ')} (${count} of ${STARS.length})`, {
    icon: 'star',
    duration: 3500,
    action: opener ? { label: 'Orbit log', onClick: opener } : undefined,
  });
}

let isPlaying: () => boolean = () => false;
/** Let the page tell us when music is playing (stars stay quiet then). */
export function setPlayingProbe(fn: () => boolean) {
  isPlaying = fn;
}

export function earn(id: StarId): void {
  if (earned.get()[id]) return;
  earned.set((prev) => ({ ...prev, [id]: Date.now() }));
  const count = earnedCount();
  uiChime();
  pulseCounter();
  pending.push(id);
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(flush, 1600);
  if (count === REWARD_AT && !rewardUnlocked.get()) {
    rewardUnlocked.set(true);
    window.setTimeout(
      () =>
        toast('Five stars: a walnut dock is now on us with any Rondo.', {
          icon: 'gift',
          duration: 8000,
          action: { label: 'Shop', onClick: () => (location.href = url('/shop/')) },
        }),
      900,
    );
  }
}

/* Constellation layout for the popover map (7 stars, loosely a ring with a tail). */
const POINTS: [number, number][] = [
  [30, 64],
  [58, 30],
  [104, 22],
  [146, 40],
  [160, 82],
  [128, 112],
  [206, 118],
];

function renderMap(svg: SVGSVGElement, got: Partial<Record<StarId, number>>) {
  const ids = STARS.map((s) => s.id);
  let lines = '';
  for (let i = 0; i < POINTS.length - 1; i++) {
    const a = POINTS[i]!;
    const b = POINTS[i + 1]!;
    const on = got[ids[i]!] && got[ids[i + 1]!];
    lines += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="currentColor" stroke-opacity="${on ? 0.7 : 0.15}" stroke-width="1" ${on ? '' : 'stroke-dasharray="2 4"'}/>`;
  }
  const dots = POINTS.map((p, i) => {
    const on = Boolean(got[ids[i]!]);
    return `<circle cx="${p[0]}" cy="${p[1]}" r="${on ? 4.5 : 2.5}" fill="${on ? 'var(--sun)' : 'currentColor'}" fill-opacity="${on ? 1 : 0.35}">${on ? '<animate attributeName="r" values="4.5;5.5;4.5" dur="3s" repeatCount="indefinite"/>' : ''}</circle>`;
  }).join('');
  svg.innerHTML = lines + dots;
}

export function initAchievements(): void {
  const pop = document.querySelector<HTMLElement>('#orbit-log');
  const counts = document.querySelectorAll<HTMLElement>('[data-orbit-count]');
  const btns = document.querySelectorAll<HTMLElement>('[data-orbit-open]');
  if (pop && 'showPopover' in pop) {
    opener = () => pop.showPopover();
  }

  earned.subscribe((got) => {
    const n = Object.keys(got).length;
    counts.forEach((c) => (c.textContent = `${n}/${STARS.length}`));
    btns.forEach((b) => b.setAttribute('aria-label', `Orbit log: ${n} of ${STARS.length} stars`));
    if (!pop) return;
    pop.querySelectorAll<HTMLElement>('[data-star]').forEach((li) => {
      li.dataset.earned = String(Boolean(got[li.dataset.star as StarId]));
    });
    const map = pop.querySelector<SVGSVGElement>('[data-orbit-map]');
    if (map) renderMap(map, got);
    const reward = pop.querySelector<HTMLElement>('[data-orbit-reward]');
    if (reward) {
      reward.textContent =
        n >= REWARD_AT
          ? 'Reward unlocked: a walnut dock ships free with your Rondo. It is applied at checkout automatically.'
          : `Earn ${REWARD_AT - n} more star${REWARD_AT - n === 1 ? '' : 's'} and a walnut dock ($39) ships free with your Rondo.`;
    }
  });

  // Easter egg: tap the eclipse in the footer three times.
  let taps = 0;
  let tapTimer = 0;
  document.querySelector('[data-eclipse]')?.addEventListener('click', (e) => {
    const el = e.currentTarget as HTMLElement;
    taps++;
    window.clearTimeout(tapTimer);
    tapTimer = window.setTimeout(() => (taps = 0), 1200);
    el.dataset.taps = String(Math.min(taps, 3));
    if (taps >= 3) {
      el.dataset.eclipsed = 'true';
      earn('eclipse');
      window.setTimeout(() => delete el.dataset.eclipsed, 4200);
      taps = 0;
    }
  });
}
