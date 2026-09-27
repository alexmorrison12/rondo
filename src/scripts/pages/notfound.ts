/**
 * 404: a Rondo drifting in the sky. Tap the sun to hear it; ring taps sound only if you
 * already have sound on (we never switch it on for a tap).
 */
import { stripBase } from '@/lib/url';
import { RondoEngine } from '../audio/engine';
import { earn } from '../core/achievements';
import { ensureSound, soundPref } from '../core/sound';
import { InstrumentFace } from '../instrument/face';
import { decodePattern } from '../seq/codec';

const canvas = document.querySelector<HTMLCanvasElement>('[data-lost-face]');
const pattern = canvas ? decodePattern(canvas.dataset.loop ?? '') : null;
const announcer = document.querySelector<HTMLElement>('[data-lost-announce]');

if (canvas && pattern) {
  let engine: RondoEngine | null = null;
  const face = new InstrumentFace(canvas, {
    pattern,
    finish: 'ember',
    interactive: true,
    onPointerDown: () => {
      if (soundPref.get()) attach();
    },
    onToggle: () => void toggle(),
    onEdit: (e) => {
      if (e.type === 'add') earn('note');
      if (e.type === 'rotate') earn('spin');
    },
    onAnnounce: (msg) => {
      if (announcer) announcer.textContent = msg;
    },
  });
  // Taps and turns stay on the instrument; vertical swipes still scroll the page.
  canvas.style.touchAction = 'pan-y';

  const attach = (): RondoEngine => {
    if (!engine) {
      engine = new RondoEngine(pattern);
      face.setEngine(engine);
    }
    return engine;
  };
  const toggle = async () => {
    await ensureSound();
    earn('sound');
    await attach().toggle();
  };
  canvas.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      void toggle();
    }
  });
}

/* Say which address went missing (a typo is easier to spot when you can see it). */
const pathBox = document.querySelector<HTMLElement>('[data-lost-path]');
const pathText = document.querySelector<HTMLElement>('[data-lost-path-text]');
const route = stripBase(location.pathname);
if (pathBox && pathText && !/^\/404(\.html)?\/?$/.test(route)) {
  let shown = location.pathname;
  try {
    shown = decodeURI(shown);
  } catch {
    /* keep it encoded */
  }
  pathText.textContent = shown.length > 64 ? `${shown.slice(0, 61)}…` : shown;
  pathBox.hidden = false;
}

/* ⌘K on a Mac, Ctrl K everywhere else. */
const mod = document.querySelector<HTMLElement>('[data-mod]');
if (mod && !/mac|iphone|ipad/i.test(navigator.userAgent)) mod.textContent = 'Ctrl';
