/**
 * Story: a broken music box you can fix, and prototype / maker faces that play their loops.
 * One engine for the whole page; whichever face you press takes it over. Loops arrive as
 * share codes in data-loop (the page defines them once, server-side).
 */
import { ICONS } from '@/lib/icons';
import { RondoEngine } from '../audio/engine';
import { earn } from '../core/achievements';
import { ensureSound, soundPref } from '../core/sound';
import { BANDS, InstrumentFace, type EditEvent } from '../instrument/face';
import { decodePattern } from '../seq/codec';
import type { Pattern } from '../seq/model';

interface Player {
  face: InstrumentFace;
  pattern: Pattern;
  /** Buttons that reflect this player's state (aria-pressed, [data-icon], [data-label]). */
  controls: HTMLElement[];
}

const players: Player[] = [];
let engine: RondoEngine | null = null;
let active: Player | null = null;

function sync() {
  const playing = Boolean(engine?.playing);
  for (const p of players) {
    const on = playing && p === active;
    for (const c of p.controls) {
      c.dataset.playing = String(on);
      const icon = c.querySelector('[data-icon]');
      if (icon) icon.innerHTML = on ? ICONS.pause : ICONS.play;
      // A control either changes its words or its pressed state, never both.
      const label = c.querySelector('[data-label]');
      if (label) label.textContent = on ? 'Pause' : 'Hear it';
      else c.setAttribute('aria-pressed', String(on));
    }
  }
}

/** Point the page's engine at a player (creating the engine on first use). */
function attach(p: Player): RondoEngine {
  if (!engine) {
    engine = new RondoEngine(p.pattern);
    engine.onState(sync);
  } else if (engine.pattern !== p.pattern) {
    engine.setPattern(p.pattern);
  }
  if (active && active !== p) active.face.setEngine(null);
  active = p;
  p.face.setEngine(engine);
  return engine;
}

async function toggle(p: Player) {
  if (engine?.playing && active === p) {
    engine.stop();
    return;
  }
  await ensureSound();
  earn('sound');
  await attach(p).start();
  sync();
}

/* ── Faces that play when pressed (prototypes, makers) ───────────── */
document.querySelectorAll<HTMLButtonElement>('[data-player]').forEach((btn) => {
  const canvas = btn.querySelector('canvas');
  const pattern = decodePattern(btn.dataset.loop ?? '');
  if (!canvas || !pattern) return;
  const face = new InstrumentFace(canvas, { pattern, finish: btn.dataset.finish ?? 'noon' });
  const player: Player = { face, pattern, controls: [btn] };
  players.push(player);
  btn.addEventListener('click', () => void toggle(player));
});

/* ── The music box: three missing teeth, fixable by tapping ──────── */
const WORDS = ['No', 'One', 'Two', 'Three'];
const SVG_NS = 'http://www.w3.org/2000/svg';

function initMusicBox(canvas: HTMLCanvasElement) {
  const decoded = decodePattern(canvas.dataset.loop ?? '');
  if (!decoded) return;
  const pattern: Pattern = decoded;
  const missing = (canvas.dataset.missing ?? '').split(',').filter(Boolean).map(Number);
  const fix = (canvas.dataset.fix ?? '').split(',').filter(Boolean).map(Number);
  const gaps = document.querySelector<SVGSVGElement>('[data-gaps]');
  const status = document.querySelector<HTMLElement>('[data-fix-status]');
  const playBtn = document.querySelector<HTMLButtonElement>('[data-musicbox-play]');
  const announcer = document.querySelector<HTMLElement>('[data-announce]');
  let fixed = false;

  const face = new InstrumentFace(canvas, {
    pattern,
    finish: 'moon',
    interactive: true,
    // With sound already on, touching a ring auditions it (unless another loop is playing).
    onPointerDown: () => {
      if (soundPref.get() && !(engine?.playing && active !== player)) attach(player);
    },
    onEdit: handleEdit,
    onToggle: () => void toggle(player),
    onAnnounce: (msg) => {
      if (announcer) announcer.textContent = msg;
    },
  });
  const player: Player = { face, pattern, controls: playBtn ? [playBtn] : [] };
  players.push(player);
  // Taps and ring turns stay on the instrument; vertical swipes still scroll the story.
  canvas.style.touchAction = 'pan-y';

  canvas.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      void toggle(player);
    }
  });
  playBtn?.addEventListener('click', () => void toggle(player));

  function handleEdit(e: EditEvent) {
    if (e.type === 'add') earn('note');
    if (e.type === 'rotate') earn('spin');
    if (e.type === 'add' && e.ring === 0) {
      const i = missing.indexOf(e.slot);
      // Put back exactly the tooth that was missing.
      const tooth = fix[i];
      if (tooth !== undefined) pattern.rings[0].notes[e.slot] = tooth;
    }
    render();
  }

  function render() {
    const ring = pattern.rings[0];
    const band = BANDS[0]!;
    const mid = (band.outer + band.inner) / 2;
    const size = (band.outer - band.inner) * 0.34;
    const open = missing.filter((s) => (ring.notes[s] ?? -1) < 0);

    if (gaps) {
      for (const slot of missing) {
        let g = gaps.querySelector<SVGGElement>(`[data-slot="${slot}"]`);
        if (!g) {
          g = document.createElementNS(SVG_NS, 'g');
          g.dataset.slot = String(slot);
          const dot = document.createElementNS(SVG_NS, 'circle');
          dot.setAttribute('class', 'gap');
          dot.setAttribute('r', String(size * 0.62));
          const halo = document.createElementNS(SVG_NS, 'circle');
          halo.setAttribute('class', 'gap-ring');
          halo.setAttribute('r', String(size * 1.25));
          g.append(halo, dot);
          gaps.append(g);
        }
        const d = (((slot - ring.offset) % ring.steps) + ring.steps) % ring.steps;
        const a = -Math.PI / 2 + (d / ring.steps) * Math.PI * 2;
        g.setAttribute('transform', `translate(${(Math.cos(a) * mid).toFixed(4)} ${(Math.sin(a) * mid).toFixed(4)})`);
        const isOpen = open.includes(slot);
        g.querySelectorAll('circle').forEach((c) => c.toggleAttribute('data-fixed', !isOpen));
      }
    }

    if (!status) return;
    if (open.length === 0) {
      status.dataset.done = '';
      status.textContent = 'Fixed. It took us four years. It took you a few seconds.';
      if (!fixed) {
        fixed = true;
        // A small reward if sound is already on; never switch sound on uninvited.
        if (soundPref.get() && !engine?.playing) void toggle(player);
      }
    } else {
      delete status.dataset.done;
      status.textContent =
        open.length === missing.length
          ? `${WORDS[open.length] ?? open.length} notes are missing. Tap the marked gaps to put them back.`
          : `${WORDS[open.length] ?? open.length} to go.`;
    }
  }

  render();
}

const box = document.querySelector<HTMLCanvasElement>('[data-musicbox]');
if (box) initMusicBox(box);
