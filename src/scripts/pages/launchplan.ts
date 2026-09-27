/** Mission Control: switch the live site between launch phases. */
import { PHASES, type Phase } from '@/data/site';
import { phaseStore, setPhase } from '../core/phase';
import { uiTick } from '../core/sound';
import { toast } from '../core/toast';

const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-phase]')];
const details = [...document.querySelectorAll<HTMLElement>('[data-phase-detail]')];

phaseStore.subscribe((phase) => {
  buttons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.phase === phase)));
  details.forEach((d) => (d.hidden = d.dataset.phaseDetail !== phase));
});

buttons.forEach((b, i) => {
  b.addEventListener('click', () => {
    const phase = b.dataset.phase as Phase;
    if (phase === phaseStore.get()) return;
    setPhase(phase);
    uiTick(1);
    toast(`The whole site is now in the ${PHASES[phase].name} phase.`, { icon: 'sparkles' });
  });
  b.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = buttons[(i + dir + buttons.length) % buttons.length]!;
    next.focus();
    next.click();
  });
});
