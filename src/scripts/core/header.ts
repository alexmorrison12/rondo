/**
 * Header behaviour: condenses after the first scroll, hides while reading downward,
 * returns on any upward scroll, and adapts its theme to the section underneath it.
 */
export function initHeader(): void {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;

  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    header.dataset.scrolled = String(y > 8);
    const menuOpen = document.querySelector('dialog.menu-sheet[open]');
    if (!menuOpen && !header.matches(':focus-within')) {
      if (y > lastY + 6 && y > 480) header.dataset.hidden = 'true';
      else if (y < lastY - 6 || y < 480) header.dataset.hidden = 'false';
    }
    lastY = y;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();

  // Theme follows the section beneath the header (sections opt in with data-header-theme).
  const themed = document.querySelectorAll<HTMLElement>('[data-header-theme]');
  if (themed.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) header.dataset.theme = (entry.target as HTMLElement).dataset.headerTheme ?? 'day';
        }
      },
      { rootMargin: '-2% 0px -96% 0px' },
    );
    themed.forEach((s) => io.observe(s));
  }

  // Mobile menu sheet
  const sheet = document.querySelector<HTMLDialogElement>('[data-menu]');
  document.querySelector('[data-menu-open]')?.addEventListener('click', () => sheet?.showModal());
  sheet?.querySelector('[data-menu-close]')?.addEventListener('click', () => sheet.close());
  sheet?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) sheet.close();
  });
}
