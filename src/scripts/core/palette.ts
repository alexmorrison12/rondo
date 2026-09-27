/** ⌘K / Ctrl-K command palette. Pages plus actions, fuzzy-filtered, fully keyboard driven. */
import { PHASES, PHASE_ORDER } from '@/data/site';
import { url } from '@/lib/url';
import { openBag } from './bag';
import { setPhase } from './phase';
import { copyText } from './share';
import { setSound, soundPref } from './sound';
import { toast } from './toast';

interface Command {
  label: string;
  hint: string;
  keywords?: string;
  run: () => void;
}

const go = (path: string) => () => (location.href = url(path));

function commands(): Command[] {
  return [
    { label: 'Home', hint: 'Page', run: go('/') },
    { label: 'Play Rondo in your browser', hint: 'Page', keywords: 'web instrument sequencer', run: go('/play/') },
    { label: 'The instrument', hint: 'Page', keywords: 'specs materials design', run: go('/instrument/') },
    { label: 'Loops made on Rondo', hint: 'Page', keywords: 'gallery community', run: go('/loops/') },
    { label: 'Our story and the ten-year promise', hint: 'Page', keywords: 'about manifesto', run: go('/story/') },
    { label: 'Shop', hint: 'Page', keywords: 'buy pre-order configure colour', run: go('/shop/') },
    { label: 'Support and FAQ', hint: 'Page', keywords: 'help shipping returns warranty', run: go('/support/') },
    { label: 'Launch plan (Mission Control)', hint: 'Page', keywords: 'strategy phases', run: go('/launch-plan/') },
    { label: 'Landing: Signal teaser', hint: 'Landing page', run: go('/lp/signal/') },
    { label: 'Landing: Founders numbers', hint: 'Landing page', run: go('/lp/founders/') },
    { label: 'Landing: Launch day', hint: 'Landing page', run: go('/lp/launch/') },
    { label: 'Landing: Gift a loop', hint: 'Landing page', run: go('/lp/gift/') },
    { label: 'Landing: Creators', hint: 'Landing page', run: go('/lp/creators/') },
    { label: 'When will my Rondo ship?', hint: 'Support', keywords: 'delivery shipping date', run: go('/support/#when-ship') },
    { label: 'Returns and the 100-night trial', hint: 'Support', keywords: 'refund return money back', run: go('/support/#trial') },
    { label: 'Warranty and repairs', hint: 'Support', keywords: 'broken fix guarantee', run: go('/support/#warranty') },
    { label: 'Does it work with my music software?', hint: 'Support', keywords: 'midi daw ableton logic usb', run: go('/support/#music-software') },
    { label: 'How do I replace the battery?', hint: 'Support', keywords: 'battery screws repair', run: go('/support/#battery-swap') },
    { label: 'Roll a random loop', hint: 'Action', keywords: 'dice generate', run: go('/play/#dice') },
    {
      label: soundPref.get() ? 'Turn sound off' : 'Turn sound on',
      hint: 'Action',
      keywords: 'audio mute',
      run: () => void setSound(!soundPref.get()),
    },
    { label: 'Open bag', hint: 'Action', keywords: 'cart', run: () => openBag() },
    {
      label: 'Open Orbit log',
      hint: 'Action',
      keywords: 'stars achievements rewards',
      run: () => document.querySelector<HTMLElement>('#orbit-log')?.showPopover?.(),
    },
    {
      label: 'Copy link to this page',
      hint: 'Action',
      run: () => void copyText(location.href).then((ok) => ok && toast('Link copied', { icon: 'check' })),
    },
    ...PHASE_ORDER.map((p) => ({
      label: `Preview launch phase: ${PHASES[p].name}`,
      hint: 'Mission Control',
      keywords: 'phase preview',
      run: () => {
        setPhase(p);
        toast(`Previewing the ${PHASES[p].name} phase across the site`, { icon: 'sparkles' });
      },
    })),
  ];
}

function score(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return 100 - t.indexOf(q);
  let ti = 0;
  let s = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return 0;
    s += found === ti ? 3 : 1;
    ti = found + 1;
  }
  return s;
}

export function initPalette(): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-palette]');
  if (!dialog) return;
  const input = dialog.querySelector<HTMLInputElement>('input')!;
  const list = dialog.querySelector<HTMLUListElement>('ul')!;
  let items: Command[] = [];
  let active = 0;

  const render = () => {
    const q = input.value.trim();
    items = commands()
      .map((c) => ({ c, s: score(q, `${c.label} ${c.keywords ?? ''} ${c.hint}`) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c)
      .slice(0, 12);
    active = Math.min(active, Math.max(0, items.length - 1));
    list.innerHTML = items.length
      ? items
          .map(
            (c, i) =>
              `<li class="palette__item" role="option" id="pal-${i}" aria-selected="${i === active}" data-i="${i}"><span>${c.label}</span><small>${c.hint}</small></li>`,
          )
          .join('')
      : `<li class="palette__item" aria-disabled="true"><span>No matches. Try “play”, “shop” or “sound”.</span></li>`;
    input.setAttribute('aria-activedescendant', items.length ? `pal-${active}` : '');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };

  const open = () => {
    if (dialog.open) return;
    input.value = '';
    active = 0;
    render();
    dialog.showModal();
    input.focus();
  };
  const run = (i: number) => {
    const cmd = items[i];
    if (!cmd) return;
    dialog.close();
    cmd.run();
  };

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (dialog.open) {
        dialog.close();
      } else {
        open();
      }
    }
  });
  document.querySelectorAll('[data-palette-open]').forEach((b) => b.addEventListener('click', open));
  input.addEventListener('input', () => {
    active = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % Math.max(1, items.length);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + items.length) % Math.max(1, items.length);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(active);
    }
  });
  list.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (li) run(Number(li.dataset.i));
  });
  list.addEventListener('pointermove', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (li && Number(li.dataset.i) !== active) {
      active = Number(li.dataset.i);
      list.querySelectorAll('[aria-selected]').forEach((n) => n.setAttribute('aria-selected', 'false'));
      li.setAttribute('aria-selected', 'true');
    }
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}
