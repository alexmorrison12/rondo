import { ICONS, type IconName } from '@/lib/icons';

export interface ToastOptions {
  icon?: IconName;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

const MAX = 3;

function region(): HTMLElement {
  let el = document.querySelector<HTMLElement>('[data-toasts]');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toasts';
    el.dataset.toasts = '';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.append(el);
  }
  return el;
}

export function toast(message: string, opts: ToastOptions = {}): () => void {
  const host = region();
  const el = document.createElement('div');
  el.className = 'toast';
  const icon = opts.icon ? `<span class="toast__icon">${ICONS[opts.icon]}</span>` : '';
  el.innerHTML = `${icon}<span class="toast__msg"></span>`;
  el.querySelector('.toast__msg')!.textContent = message;

  let timer = 0;
  const dismiss = () => {
    window.clearTimeout(timer);
    if (el.dataset.leaving !== undefined) return;
    el.dataset.leaving = '';
    const done = () => el.remove();
    el.addEventListener('animationend', done, { once: true });
    window.setTimeout(done, 400);
  };

  if (opts.action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast__action';
    btn.textContent = opts.action.label;
    btn.addEventListener('click', () => {
      opts.action!.onClick();
      dismiss();
    });
    el.append(btn);
  }

  host.append(el);
  while (host.children.length > MAX) host.firstElementChild?.remove();

  const duration = opts.duration ?? (opts.action ? 6000 : 4000);
  const arm = () => (timer = window.setTimeout(dismiss, duration));
  el.addEventListener('pointerenter', () => window.clearTimeout(timer));
  el.addEventListener('pointerleave', arm);
  arm();
  return dismiss;
}
