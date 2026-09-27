/**
 * Launch phase state. The public site renders DEFAULT_PHASE on the server; Mission Control
 * (/launch-plan/) can switch the phase to preview how every CTA, status line and delivery
 * promise across the site changes as the launch moves forward.
 */
import { DEFAULT_PHASE, PHASES, type Phase } from '@/data/site';
import { url } from '@/lib/url';
import { persisted } from './store';

export const phaseStore = persisted<Phase>('phase', DEFAULT_PHASE);

export function currentPhase(): Phase {
  const p = phaseStore.get();
  return p in PHASES ? p : DEFAULT_PHASE;
}

export function setPhase(phase: Phase): void {
  phaseStore.set(phase);
}

/**
 * Elements opt in with:
 *   data-cta            → link whose href + label follow the phase CTA
 *   data-cta-label      → text node for the label (inside data-cta)
 *   data-cta-price      → price / qualifier text
 *   data-phase-status   → status line ("Pre-orders open")
 *   data-phase-shipping → delivery promise
 *   data-phase-only="launch orbit" → shown only in those phases
 */
export function applyPhase(root: ParentNode = document): void {
  const phase = currentPhase();
  const def = PHASES[phase];
  document.documentElement.dataset.phase = phase;

  root.querySelectorAll<HTMLAnchorElement>('a[data-cta]').forEach((a) => {
    if (a.dataset.ctaFixed !== undefined) return;
    a.href = url(def.cta.href);
    const label = a.querySelector<HTMLElement>('[data-cta-label]');
    if (label) label.textContent = def.cta.label;
    const price = a.querySelector<HTMLElement>('[data-cta-price]');
    if (price) price.textContent = def.cta.price;
  });
  root.querySelectorAll<HTMLElement>('[data-phase-status]').forEach((el) => (el.textContent = def.status));
  root.querySelectorAll<HTMLElement>('[data-phase-shipping]').forEach((el) => (el.textContent = def.shipping));
  root.querySelectorAll<HTMLElement>('[data-phase-only]').forEach((el) => {
    const phases = (el.dataset.phaseOnly ?? '').split(/\s+/);
    el.hidden = !phases.includes(phase);
  });
}

export function initPhase(): void {
  phaseStore.subscribe(() => applyPhase());
}
