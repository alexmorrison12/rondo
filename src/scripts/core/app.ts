/**
 * Global bootstrap, loaded on every page by the Base layout.
 * Each subsystem is independent and fails soft.
 */
import { stripBase } from '@/lib/url';
import { earn, initAchievements, setPlayingProbe } from './achievements';
import { initBag } from './bag';
import { REFERRAL_CREDIT, referral } from './cart';
import { initHeader } from './header';
import { initPalette } from './palette';
import { initPhase } from './phase';
import { initSound, isMusicPlaying, onSoundState, setSound, soundPref } from './sound';
import { persisted } from './store';
import { toast } from './toast';

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

/** Footer newsletter: validate in place, never put the address in the URL. */
function initNewsletter() {
  document.querySelectorAll<HTMLFormElement>('[data-newsletter]').forEach((form) =>
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector<HTMLInputElement>('input[type="email"]');
      const v = input?.value.trim() ?? '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        input?.setAttribute('aria-invalid', 'true');
        input?.focus();
        toast(v ? 'That email looks incomplete, e.g. you@example.com.' : 'Add your email to subscribe.', { icon: 'mail' });
        return;
      }
      input?.setAttribute('aria-invalid', 'false');
      form.reset();
      toast("You're subscribed. The first Field notes arrive with a loop. (Prototype: nothing was sent.)", { icon: 'check' });
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
safely('achievements', () => {
  initAchievements();
  setPlayingProbe(isMusicPlaying);
});
safely('newsletter', initNewsletter);
safely('palette', initPalette);
safely('visits', trackVisit);
safely('referral', () => {
  // A friend's link (?ref=CODE) carries $25 off through to checkout.
  const code = new URLSearchParams(location.search).get('ref');
  if (!code || !/^[\w-]{3,32}$/.test(code)) return;
  const had = referral.get();
  referral.set({ code, at: Date.now() });
  if (!had) {
    window.setTimeout(
      () => toast(`A friend sent you $${REFERRAL_CREDIT} off a Rondo. It's applied at checkout.`, { icon: 'gift', duration: 7000 }),
      900,
    );
  }
});
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
