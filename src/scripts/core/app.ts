/**
 * Global bootstrap, loaded on every page by the Base layout.
 * Each subsystem is independent and fails soft.
 */
import { stripBase } from '@/lib/url';
import { earn, initAchievements } from './achievements';
import { initBag } from './bag';
import { initHeader } from './header';
import { initPalette } from './palette';
import { initPhase } from './phase';
import { initSound, onSoundState, setSound, soundPref } from './sound';
import { persisted } from './store';

function initSoundToggles() {
  const toggles = document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]');
  onSoundState(({ on, playing }) => {
    toggles.forEach((t) => {
      t.setAttribute('aria-pressed', String(on));
      t.dataset.playing = String(on && playing);
      const label = t.querySelector('[data-sound-label]');
      if (label) label.textContent = on ? 'Sound on' : 'Sound off';
    });
  });
  toggles.forEach((t) =>
    t.addEventListener('click', async () => {
      const next = !soundPref.get();
      await setSound(next);
      if (next) earn('sound');
    }),
  );
}

/** Pages visited: feeds the launch plan analytics mock and personalisation. */
function trackVisit() {
  const visited = persisted<string[]>('visited', []);
  const path = stripBase(location.pathname);
  if (!visited.get().includes(path)) visited.set((v) => [...v, path].slice(-40));
}

function safely(name: string, fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.error(`[rondo] ${name} failed to start`, err);
  }
}

safely('phase', initPhase);
safely('sound', initSound);
safely('header', initHeader);
safely('sound toggles', initSoundToggles);
safely('bag', initBag);
safely('achievements', initAchievements);
safely('palette', initPalette);
safely('visits', trackVisit);
safely('shortcut hints', () => {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  if (!mac) document.querySelectorAll('kbd').forEach((k) => k.textContent === '⌘' && (k.textContent = 'Ctrl'));
});
document.documentElement.dataset.js = 'ready';

if (import.meta.env.PROD) {
  console.info(
    '%cRONDO%c  Play in circles. This site is a concept prototype, source on GitHub. Press ⌘K for the command palette.',
    'font: 800 14px system-ui; letter-spacing: .1em; background:#ffe362; color:#0d1624; padding:2px 6px; border-radius:3px',
    'color: inherit',
  );
}
