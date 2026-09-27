/**
 * Loops: a listening room. Every record on the page is a real loop drawn by the shared face
 * renderer, and they all play through ONE engine, like one turntable: starting a record lifts
 * the needle from the last one. Faces only animate while they own the engine; the rest stay
 * static (and InstrumentFace already skips frames while off-screen).
 */
import { RondoEngine } from '../audio/engine';
import { earn } from '../core/achievements';
import { shareLink } from '../core/share';
import { ensureSound, onSoundState } from '../core/sound';
import { toast } from '../core/toast';
import { InstrumentFace } from '../instrument/face';
import { SKIES, cssOklch } from '../lib/skies';
import { encodePattern } from '../seq/codec';
import { moodToPattern } from '../seq/generate';
import { clonePattern, cycleLength, emptyPattern, type Pattern } from '../seq/model';
import { presetById } from '../seq/presets';
import { KEYS, scaleById, type SkyId } from '../seq/scales';
import { ICONS } from '@/lib/icons';
import { url } from '@/lib/url';

type Finish = 'noon' | 'ember' | 'moon' | 'eclipse';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const loopHref = (p: Pattern) => `${url('/play/')}#l=${encodePattern(p)}`;

/* ── One turntable ──────────────────────────────────────────────── */

interface Player {
  title: string;
  by: string;
  /** The source loop. Never handed to the engine directly (drift mutates what it plays). */
  pattern: Pattern;
  face: InstrumentFace;
  /** Carries data-playing; watched to decide when the "now playing" pill appears. */
  root: HTMLElement;
  /** Where focus lands when you jump back to the record from the pill. */
  control: HTMLElement;
  render(playing: boolean): void;
  /** Called every frame while playing, with the position inside the loop's full cycle. */
  tick?(pos: number, cycle: number): void;
  /** Clear live readouts when another record takes the engine. */
  rest?(): void;
}

let engine: RondoEngine | null = null;
let active: Player | null = null;
let loaded: Pattern | null = null;
let request = 0;
/** The listener's latest wish, so a pause that lands mid-start still wins. */
let intent: 'play' | 'pause' = 'pause';
let raf = 0;
let level = 0;
const stateListeners = new Set<() => void>();
const onPlayback = (fn: () => void) => stateListeners.add(fn);
const emit = () => stateListeners.forEach((fn) => fn());

const announcer = $('[data-announce]');
function announce(message: string) {
  if (!announcer) return;
  announcer.textContent = '';
  requestAnimationFrame(() => (announcer.textContent = message));
}

function release(player: Player) {
  player.face.setEngine(null);
  player.render(false);
  player.rest?.();
  player.root.style.removeProperty('--level');
}

async function play(player: Player) {
  const id = ++request;
  intent = 'play';
  // Instant acknowledgement: the first press also builds the synth, which takes a beat on slow phones.
  player.root.dataset.pending = 'true';
  try {
    await startPlayer(player, id);
  } finally {
    delete player.root.dataset.pending;
  }
}

async function startPlayer(player: Player, id: number) {
  await ensureSound(); // first await: still inside the user's gesture
  if (id !== request) return;
  earn('sound');
  if (!engine) {
    engine = new RondoEngine(clonePattern(player.pattern));
    loaded = player.pattern;
    engine.onState((playing) => {
      if (!playing && active) {
        active.render(false);
        active.root.style.removeProperty('--level');
      }
      emit();
    });
  }
  if (active && active !== player) release(active);
  active = player;
  if (loaded !== player.pattern) {
    engine.setPattern(clonePattern(player.pattern), { keepPosition: false });
    loaded = player.pattern;
  }
  player.face.setEngine(engine);
  await engine.start();
  if (id !== request || active !== player) {
    if (intent === 'pause' && engine.playing) engine.stop();
    return;
  }
  player.render(true);
  announce(`Playing ${player.title}${player.by ? ` by ${player.by}` : ''}.`);
  emit();
  run();
}

function pause() {
  request++;
  intent = 'pause';
  if (!engine?.playing) return;
  engine.stop();
  announce('Paused.');
}

function toggle(player: Player) {
  if (active === player && engine?.playing) pause();
  else void play(player);
}

/** One frame loop for live readouts (bar counters, bezel, light spill); the faces run their own. */
function run() {
  if (raf) return;
  const frame = () => {
    raf = 0;
    const e = engine;
    const p = active;
    if (!e?.playing || !p) {
      level = 0;
      return;
    }
    const cycle = Math.max(1, cycleLength(e.pattern));
    const step = e.stepFloat();
    p.tick?.(((step % cycle) + cycle) % cycle, cycle);
    if (!reduceMotion.matches) {
      level += (e.level() - level) * 0.22;
      p.root.style.setProperty('--level', level.toFixed(3));
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}

/* ── Records ────────────────────────────────────────────────────── */

function barReadout(pos: number, cycle: number): { index: number; text: string } {
  const unit = cycle % 16 === 0 ? 16 : 1;
  const index = Math.floor(pos / unit);
  return { index, text: `${unit === 16 ? 'Bar' : 'Step'} ${index + 1} of ${cycle / unit}` };
}

function recordPlayer(li: HTMLLIElement): Player | null {
  const preset = presetById(li.dataset.loop ?? '');
  const canvas = $<HTMLCanvasElement>('canvas', li);
  const button = $<HTMLButtonElement>('[data-record-toggle]', li);
  const cycleEl = $('[data-cycle]', li);
  if (!preset || !canvas || !button || !cycleEl) return null;

  const face = new InstrumentFace(canvas, {
    pattern: clonePattern(preset.pattern),
    finish: (li.dataset.finish as Finish) ?? 'noon',
  });
  let shown = -1;
  const player: Player = {
    title: preset.pattern.name,
    by: preset.author,
    pattern: preset.pattern,
    face,
    root: li,
    control: button,
    render(playing) {
      li.dataset.playing = String(playing);
      button.setAttribute('aria-pressed', String(playing));
      if (!playing) {
        shown = -1;
        cycleEl.textContent = cycleEl.dataset.idle ?? '';
      }
    },
    tick(pos, cycle) {
      const { index, text } = barReadout(pos, cycle);
      if (index === shown) return;
      shown = index;
      cycleEl.textContent = text;
    },
  };
  button.addEventListener('click', () => toggle(player));
  return player;
}

/* ── Loop of the week ───────────────────────────────────────────── */

function featurePlayer(): Player | null {
  const section = $('[data-feature]');
  const preset = presetById(section?.dataset.loop ?? '');
  const canvas = section && $<HTMLCanvasElement>('canvas', section);
  const button = section && $<HTMLButtonElement>('[data-feature-toggle]', section);
  if (!section || !preset || !canvas || !button) return null;

  const label = $('[data-toggle-label]', button);
  const glyph = $('[data-toggle-glyph]', button);
  const cycleEl = $('[data-feature-cycle]', section);
  const bezel = $<SVGSVGElement>('[data-bezel]', section);
  const ticks = $$<SVGLineElement>('.bezel__tick', section);
  const hand = $<SVGGElement>('[data-bezel-hand]', section);
  const face = new InstrumentFace(canvas, {
    pattern: clonePattern(preset.pattern),
    finish: (section.dataset.finish as Finish) ?? 'noon',
  });

  let shown = -1;
  let breathe = 0;
  const player: Player = {
    title: preset.pattern.name,
    by: preset.author,
    pattern: preset.pattern,
    face,
    root: section,
    control: button,
    render(playing) {
      section.dataset.playing = String(playing);
      if (label) label.textContent = playing ? 'Pause' : 'Play';
      if (glyph) glyph.innerHTML = playing ? ICONS.pause : ICONS.play;
      if (!playing && cycleEl) {
        shown = -1;
        cycleEl.textContent = cycleEl.dataset.idle ?? '';
      }
    },
    rest() {
      ticks.forEach((t) => {
        t.removeAttribute('data-on');
        t.removeAttribute('data-now');
      });
      hand?.setAttribute('transform', 'rotate(0)');
      section.style.removeProperty('--breathe');
    },
    tick(pos, cycle) {
      const frac = pos / cycle;
      hand?.setAttribute('transform', `rotate(${(frac * 360).toFixed(2)})`);
      if (!reduceMotion.matches) {
        breathe += (level - breathe) * 0.3;
        section.style.setProperty('--breathe', breathe.toFixed(3));
      }
      const bar = Math.min(ticks.length - 1, Math.floor(frac * ticks.length));
      if (bar === shown) return;
      // Full circle: the rings have lined up again. Light the whole bezel for a moment.
      if (bar < shown && bezel) {
        bezel.dataset.lap = '';
        window.setTimeout(() => delete bezel.dataset.lap, 900);
      }
      shown = bar;
      ticks.forEach((t, i) => {
        t.toggleAttribute('data-on', i < bar);
        t.toggleAttribute('data-now', i === bar);
      });
      if (cycleEl) cycleEl.textContent = barReadout(pos, cycle).text;
    },
  };

  button.addEventListener('click', () => toggle(player));
  $('[data-feature-disc]', section)?.addEventListener('click', () => toggle(player));
  $('[data-feature-share]', section)?.addEventListener('click', async () => {
    const shareUrl = new URL(loopHref(preset.pattern), location.origin).toString();
    const result = await shareLink({
      title: `${preset.pattern.name} by ${preset.author} — made on Rondo`,
      text: `“${preset.pattern.name}” by ${preset.author}, made on Rondo. Tap to play it:`,
      url: shareUrl,
    });
    if (result !== 'cancelled') earn('share');
  });
  return player;
}

/* ── Describe a moment ──────────────────────────────────────────── */

/** A finish that reads against each sky: coral in daylight, blue at golden hour, silver after dark. */
const FINISH_FOR_SKY: Record<SkyId, Finish> = {
  dawn: 'noon',
  morning: 'ember',
  noon: 'ember',
  afternoon: 'ember',
  golden: 'noon',
  dusk: 'moon',
  evening: 'moon',
  night: 'moon',
};

function momentPlayer(): Player | null {
  const section = $('[data-moment]');
  const win = section && $('[data-moment-window]', section);
  const canvas = win && $<HTMLCanvasElement>('canvas', win);
  const form = section && $<HTMLFormElement>('[data-moment-form]', section);
  const input = section && $<HTMLInputElement>('[data-moment-text]', section);
  const button = section && $<HTMLButtonElement>('[data-moment-toggle]', section);
  if (!section || !win || !canvas || !form || !input || !button) return null;

  const glyph = $('[data-toggle-glyph]', button);
  const nameEl = $('[data-moment-name]', section);
  const metaEl = $('[data-moment-meta]', section);
  const open = $<HTMLAnchorElement>('[data-moment-open]', section);
  const face = new InstrumentFace(canvas, { pattern: emptyPattern(), finish: 'moon' });

  const player: Player = {
    title: 'Your loop',
    by: '',
    pattern: emptyPattern(),
    face,
    root: section,
    control: button,
    render(playing) {
      section.dataset.playing = String(playing);
      button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} “${player.title}”`);
      if (glyph) glyph.innerHTML = playing ? ICONS.pause : ICONS.play;
    },
  };

  const applySky = (p: Pattern) => {
    const sky = SKIES[scaleById(p.scale).sky];
    win.style.setProperty('--m-top', cssOklch(sky.top));
    win.style.setProperty('--m-mid', cssOklch(sky.mid));
    win.style.setProperty('--m-bottom', cssOklch(sky.bottom));
    win.style.setProperty('--m-sun', cssOklch(sky.sun));
    win.style.setProperty('--m-clouds', String(sky.clouds));
    // Overhead sun sits high in the window; below the horizon it drops out of view.
    win.style.setProperty('--m-sun-y', sky.sunElevation < -0.1 ? '130%' : `${Math.round(80 - sky.sunElevation * 62)}%`);
    win.dataset.sky = sky.id;
    face.setFinish(FINISH_FOR_SKY[sky.id]);
    return sky;
  };

  const show = (p: Pattern, example: boolean) => {
    const scale = scaleById(p.scale);
    const sky = applySky(p);
    player.pattern = p;
    player.title = p.name;
    face.setPattern(clonePattern(p));
    win.dataset.state = 'ready';
    button.disabled = false;
    player.render(section.dataset.playing === 'true');
    if (nameEl) nameEl.textContent = p.name;
    if (metaEl) {
      const facts = `${scale.name} · ${KEYS[p.key]} · ${p.bpm} bpm · ${sky.label.toLowerCase()} sky`;
      metaEl.textContent = example ? `Example · ${facts}` : facts;
    }
    if (open) {
      open.href = loopHref(p);
      open.hidden = false;
      open.setAttribute('aria-label', `Open “${p.name}” in Rondo Web`);
    }
  };

  const compose = (text: string) => {
    const words = text.trim();
    if (!words) {
      toast('Write a few words first: a place, a time, a feeling.', { icon: 'wand' });
      input.focus();
      return;
    }
    show(moodToPattern(words), false);
    void play(player);
  };

  // Never an empty window: the placeholder's words are already a loop, silent until pressed.
  const example = input.placeholder.trim();
  if (example) {
    win.dataset.instant = '';
    show(moodToPattern(example), true);
    requestAnimationFrame(() => requestAnimationFrame(() => delete win.dataset.instant));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    compose(input.value);
  });
  $$<HTMLButtonElement>('[data-moment-chip]', section).forEach((chip) =>
    chip.addEventListener('click', () => {
      input.value = chip.textContent?.trim() ?? '';
      compose(input.value);
    }),
  );
  button.addEventListener('click', () => toggle(player));
  $('[data-moment-disc]', section)?.addEventListener('click', () => {
    if (win.dataset.state === 'ready') toggle(player);
    else input.focus();
  });
  return player;
}

/* ── Mood filter (radio group) ──────────────────────────────────── */

/** Visible position → layout slot: a large record with two companions, then three small ones. */
function layout(records: HTMLLIElement[]) {
  let i = 0;
  for (const li of records) {
    if (li.hidden) continue;
    const k = i % 6;
    li.dataset.slot = k === 0 ? 'l' : k < 3 ? `s${k}` : `m${k - 2}`;
    li.dataset.side = Math.floor(i / 6) % 2 ? 'b' : 'a';
    i++;
  }
}

let transitionId = 0;
/** Resolves once the DOM reflects the update (a view transition applies it a frame later). */
async function withTransition(update: () => void): Promise<void> {
  if (reduceMotion.matches || typeof document.startViewTransition !== 'function') {
    update();
    return;
  }
  const root = document.documentElement;
  const id = ++transitionId;
  root.dataset.vt = 'filter';
  const t = document.startViewTransition(update);
  const clear = () => {
    if (id === transitionId) delete root.dataset.vt;
  };
  void t.finished.then(clear, clear);
  await t.updateCallbackDone.catch(() => undefined);
}

function initFilters(records: HTMLLIElement[]) {
  const group = $('[data-filters]');
  const note = $('[data-mood-note]');
  if (!group) return { reset: () => Promise.resolve() };
  const chips = $$<HTMLButtonElement>('[role="radio"]', group);
  let current = chips.find((c) => c.getAttribute('aria-checked') === 'true')?.dataset.mood ?? 'all';

  const select = (chip: HTMLButtonElement, focus: boolean): Promise<void> => {
    if (focus) chip.focus();
    const mood = chip.dataset.mood ?? 'all';
    if (mood === current) return Promise.resolve();
    current = mood;
    const done = withTransition(() => {
      chips.forEach((c) => {
        const on = c === chip;
        c.setAttribute('aria-checked', String(on));
        c.tabIndex = on ? 0 : -1;
      });
      records.forEach((li) => (li.hidden = mood !== 'all' && li.dataset.mood !== mood));
      layout(records);
      if (note) note.textContent = chip.dataset.note ?? '';
    });
    // Count from the data: with a view transition the DOM update is still pending here.
    const count = records.filter((li) => mood === 'all' || li.dataset.mood === mood).length;
    announce(mood === 'all' ? `Showing all ${count} loops.` : `Showing ${count} ${mood.toLowerCase()} loops.`);
    return done;
  };

  chips.forEach((chip, i) => {
    chip.addEventListener('click', () => void select(chip, false));
    chip.addEventListener('keydown', (e) => {
      const last = chips.length - 1;
      const next =
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
          ? (i + 1) % chips.length
          : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
            ? (i + last) % chips.length
            : e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? last
                : -1;
      if (next < 0) return;
      e.preventDefault();
      void select(chips[next]!, true);
    });
  });

  return {
    reset: (): Promise<void> => {
      const all = chips.find((c) => c.dataset.mood === 'all');
      return all ? select(all, false) : Promise.resolve();
    },
  };
}

/* ── Now playing ────────────────────────────────────────────────── */

function initNowPlaying(filters: { reset: () => Promise<void> }) {
  const bar = $('[data-now]');
  const nameEl = $('[data-now-name]');
  const byEl = $('[data-now-by]');
  const byWrap = byEl?.parentElement;
  if (!bar) return;
  let watched: Element | null = null;
  let inView = true;

  const sync = () => {
    const playing = Boolean(engine?.playing && active);
    if (active && watched !== active.root) {
      if (watched) io.unobserve(watched);
      watched = active.root;
      inView = true;
      io.observe(watched);
    }
    if (active) {
      if (nameEl) nameEl.textContent = active.title;
      if (byEl) byEl.textContent = active.by;
      if (byWrap) byWrap.hidden = !active.by;
    }
    bar.dataset.visible = String(playing && !inView);
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.target === watched) inView = entry.isIntersecting;
      sync();
    },
    { threshold: 0.25 },
  );
  onPlayback(sync);

  $('[data-now-stop]', bar)?.addEventListener('click', () => pause());
  $('[data-now-jump]', bar)?.addEventListener('click', async () => {
    const p = active;
    if (!p) return;
    if (p.root.hidden) await filters.reset();
    p.root.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    p.control.focus({ preventScroll: true });
  });
}

/* ── Boot ───────────────────────────────────────────────────────── */

function boot() {
  const records = $$<HTMLLIElement>('[data-records] > .record');
  const players = [featurePlayer(), ...records.map(recordPlayer), momentPlayer()].filter((p): p is Player => p !== null);
  const filters = initFilters(records);
  initNowPlaying(filters);

  // Turning sound off in the header lifts the needle too, and so does leaving the page
  // (a back-button return from the bfcache then shows an honest, paused room).
  onSoundState(({ on }) => {
    if (!on && engine?.playing) pause();
  });
  window.addEventListener('pagehide', () => {
    if (engine?.playing) pause();
  });

  if (import.meta.env.DEV) Object.assign(window, { __loops: { players, engine: () => engine, active: () => active } });
}

// Don't build a dozen faces for a prerendered page until it is actually shown.
if ((document as Document & { prerendering?: boolean }).prerendering) {
  document.addEventListener('prerenderingchange', boot, { once: true });
} else {
  boot();
}
