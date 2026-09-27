/**
 * The site's icon set: Lucide (ISC), inlined as strings so icons work both in
 * server-rendered Astro components and in client-rendered UI, with no icon font
 * or sprite request. Normalised to a 1.75 stroke and aria-hidden.
 */
import arrowRight from 'lucide-static/icons/arrow-right.svg?raw';
import arrowUpRight from 'lucide-static/icons/arrow-up-right.svg?raw';
import bag from 'lucide-static/icons/shopping-bag.svg?raw';
import calendar from 'lucide-static/icons/calendar-plus.svg?raw';
import check from 'lucide-static/icons/check.svg?raw';
import copy from 'lucide-static/icons/copy.svg?raw';
import dices from 'lucide-static/icons/dices.svg?raw';
import download from 'lucide-static/icons/download.svg?raw';
import gift from 'lucide-static/icons/gift.svg?raw';
import headphones from 'lucide-static/icons/headphones.svg?raw';
import infinity from 'lucide-static/icons/infinity.svg?raw';
import keyboard from 'lucide-static/icons/keyboard.svg?raw';
import leaf from 'lucide-static/icons/leaf.svg?raw';
import link from 'lucide-static/icons/link.svg?raw';
import lock from 'lucide-static/icons/lock.svg?raw';
import mail from 'lucide-static/icons/mail.svg?raw';
import menu from 'lucide-static/icons/menu.svg?raw';
import minus from 'lucide-static/icons/minus.svg?raw';
import pause from 'lucide-static/icons/pause.svg?raw';
import play from 'lucide-static/icons/play.svg?raw';
import plus from 'lucide-static/icons/plus.svg?raw';
import redo from 'lucide-static/icons/redo-2.svg?raw';
import rotate from 'lucide-static/icons/rotate-cw.svg?raw';
import search from 'lucide-static/icons/search.svg?raw';
import share from 'lucide-static/icons/share.svg?raw';
import shield from 'lucide-static/icons/shield-check.svg?raw';
import shuffle from 'lucide-static/icons/shuffle.svg?raw';
import sliders from 'lucide-static/icons/sliders-horizontal.svg?raw';
import sparkles from 'lucide-static/icons/sparkles.svg?raw';
import star from 'lucide-static/icons/star.svg?raw';
import stop from 'lucide-static/icons/square.svg?raw';
import truck from 'lucide-static/icons/truck.svg?raw';
import undo from 'lucide-static/icons/undo-2.svg?raw';
import usb from 'lucide-static/icons/usb.svg?raw';
import volume from 'lucide-static/icons/volume-2.svg?raw';
import volumeOff from 'lucide-static/icons/volume-x.svg?raw';
import wand from 'lucide-static/icons/wand-sparkles.svg?raw';
import wrench from 'lucide-static/icons/wrench.svg?raw';
import x from 'lucide-static/icons/x.svg?raw';

function normalise(svg: string): string {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+class="[^"]*"/, '')
    .replace(/\s+width="24"/, '')
    .replace(/\s+height="24"/, '')
    .replace('stroke-width="2"', 'stroke-width="1.75"')
    .replace('<svg', '<svg class="icon" aria-hidden="true" focusable="false"')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

const RAW = {
  arrowRight,
  arrowUpRight,
  bag,
  calendar,
  check,
  copy,
  dices,
  download,
  gift,
  headphones,
  infinity,
  keyboard,
  leaf,
  link,
  lock,
  mail,
  menu,
  minus,
  pause,
  play,
  plus,
  redo,
  rotate,
  search,
  share,
  shield,
  shuffle,
  sliders,
  sparkles,
  star,
  stop,
  truck,
  undo,
  usb,
  volume,
  volumeOff,
  wand,
  wrench,
  x,
} as const;

export type IconName = keyof typeof RAW;

export const ICONS = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k, normalise(v)]),
) as Record<IconName, string>;

/** The brand glyph: a ring, an inner ring and a sun. Used on primary CTAs. */
export const RING_GLYPH = `<svg class="btn__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.75"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="1.75"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`;
