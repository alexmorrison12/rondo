/**
 * Launch phase state.
 *
 * - 'live' mode: the phase follows the calendar (phaseForDate in data/site.ts).
 * - 'prototype' mode: the site previews DEFAULT_PHASE and says so in the phase chip.
 * Previewing another phase (?phase=signal, the chip, ⌘K or Mission Control) lasts for this tab's
 * session only, so no visitor is ever left in a preview by accident.
 */
import { DEFAULT_PHASE, PHASES, PHASE_ORDER, SITE_MODE, phaseForDate, type Phase } from '@/data/site';
import { url } from '@/lib/url';

const KEY = 'rondo:phase-preview';
const isPhase = (v: unknown): v is Phase => typeof v === 'string' && v in PHASES;

export function basePhase(): Phase {
  return SITE_MODE === 'prototype' ? DEFAULT_PHASE : phaseForDate();
}

function readPreview(): Phase | null {
  try {
    const q = new URLSearchParams(location.search).get('phase');
    if (isPhase(q)) {
      sessionStorage.setItem(KEY, q);
      return q;
    }
    const s = sessionStorage.getItem(KEY);
    return isPhase(s) ? s : null;
  } catch {
    return null;
  }
}

let current: Phase = readPreview() ?? basePhase();
const listeners = new Set<(p: Phase) => void>();

export const phaseStore = {
  get: () => current,
  set(next: Phase) {
    current = next;
    try {
      if (next === basePhase()) sessionStorage.removeItem(KEY);
      else sessionStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l(current));
  },
  subscribe(fn: (p: Phase) => void, immediate = true) {
    listeners.add(fn);
    if (immediate) fn(current);
    return () => listeners.delete(fn);
  },
};

export const currentPhase = () => current;
export const setPhase = (p: Phase) => phaseStore.set(p);
export const isPreviewing = () => current !== basePhase();
export const exitPreview = () => phaseStore.set(basePhase());

/**
 * Elements opt in with:
 *   data-cta            → link whose href follows the phase (labels are CSS-switched per phase)
 *   data-phase-status   → status line ("Pre-orders open")
 *   data-phase-shipping → delivery promise
 *   data-phase-only="launch orbit" → shown only in those phases
 */
export function applyPhase(root: ParentNode = document): void {
  const phase = current;
  const def = PHASES[phase];
  document.documentElement.dataset.phase = phase;
  root.querySelectorAll<HTMLAnchorElement>('a[data-cta]').forEach((a) => {
    if (a.dataset.ctaFixed === undefined) a.href = url(def.cta.href);
  });
  root.querySelectorAll<HTMLElement>('[data-phase-status]').forEach((el) => (el.textContent = def.status));
  root.querySelectorAll<HTMLElement>('[data-phase-shipping]').forEach((el) => (el.textContent = def.shipping));
  root.querySelectorAll<HTMLElement>('[data-phase-only]').forEach((el) => {
    el.hidden = !(el.dataset.phaseOnly ?? '').split(/\s+/).includes(phase);
  });
}

/** The prototype chip: shows which phase the site is presenting and lets you switch or reset. */
function initChip() {
  const chip = document.querySelector<HTMLElement>('[data-phase-chip]');
  if (!chip) return;
  const label = chip.querySelector<HTMLElement>('[data-phase-chip-label]');
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-phase-pick]')];
  phaseStore.subscribe((p) => {
    const base = basePhase();
    chip.dataset.previewing = String(p !== base);
    // Live sites only show the chip while someone is previewing another phase.
    if (SITE_MODE === 'live') chip.hidden = p === base;
    if (label) label.textContent = p === base && SITE_MODE === 'prototype' ? `Prototype · ${PHASES[p].name} phase` : `Previewing ${PHASES[p].name}`;
    // The phone header's short version of the same label.
    document.querySelectorAll<HTMLElement>('[data-phase-badge]').forEach((b) => {
      b.textContent = p === base ? 'Prototype' : `Preview: ${PHASES[p].name}`;
      b.dataset.previewing = String(p !== base);
      if (SITE_MODE === 'live') b.hidden = p === base;
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.phasePick === p)));
  });
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      const p = b.dataset.phasePick;
      if (isPhase(p)) setPhase(p);
    }),
  );
  document.querySelectorAll('[data-phase-reset]').forEach((b) => b.addEventListener('click', exitPreview));
}

export function initPhase(): void {
  phaseStore.subscribe(() => applyPhase());
  initChip();
}

export { PHASE_ORDER };
