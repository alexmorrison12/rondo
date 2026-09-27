/**
 * Creators landing page. One RondoEngine is shared by the hero and the four format demos. Each demo
 * scripts its loop against the engine's own step clock (rings joining for the drop, a ring clicking
 * round, words composing a loop, notes tapped in one by one), so what you hear is what you'd film.
 */
import { COLORWAYS, PRODUCT, formatPrice, type ColorwayId } from '@/data/site';
import { ICONS } from '@/lib/icons';
import { RondoEngine } from '../audio/engine';
import { earn } from '../core/achievements';
import { ensureSound } from '../core/sound';
import { InstrumentFace } from '../instrument/face';
import { moodToPattern } from '../seq/generate';
import { RINGS, clonePattern, drumsFrom, emptyPattern, notesFrom, type EngineId, type Pattern } from '../seq/model';
import { presetById } from '../seq/presets';
import { scaleById } from '../seq/scales';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const announcer = $('[data-announce]');
const announce = (msg: string) => {
  if (announcer) announcer.textContent = msg;
};

/* ── One engine, one run at a time ─────────────────────────────── */
interface Run {
  id: string;
  face: InstrumentFace;
  pattern: Pattern;
  /** Global engine step at which this run's bar one lands. */
  start: number;
  tick?: (rel: number) => void;
  ui: (playing: boolean) => void;
}

let engine: RondoEngine | null = null;
let run: Run | null = null;
let raf = 0;

/** Rotate every ring so slot 0 falls on global step `at` (the engine keeps counting between runs). */
function alignTo(p: Pattern, at: number) {
  p.rings.forEach((r) => {
    r.offset = (((r.offset - at) % r.steps) + r.steps) % r.steps;
  });
}

function halt() {
  const r = run;
  if (!r) return;
  run = null;
  cancelAnimationFrame(raf);
  raf = 0;
  engine?.stop();
  r.face.setEngine(null);
  r.ui(false);
}

async function begin(next: Omit<Run, 'start'>, setup?: (p: Pattern) => void) {
  await ensureSound();
  earn('sound');
  halt();
  if (!engine) engine = new RondoEngine(next.pattern);
  const e = engine;
  // From the top, so every demo starts at twelve o'clock; if the engine kept counting, align to it.
  e.setPattern(next.pattern, { keepPosition: false });
  const start = Math.ceil(e.stepFloat());
  alignTo(next.pattern, start);
  setup?.(next.pattern);
  e.update();
  next.face.setPattern(next.pattern);
  next.face.setEngine(e);
  run = { ...next, start };
  next.ui(true);
  await e.start();
  if (!raf) raf = requestAnimationFrame(loop);
}

function loop() {
  raf = 0;
  const r = run;
  const e = engine;
  if (!r || !e?.playing) return;
  r.tick?.(e.stepFloat() - r.start);
  raf = requestAnimationFrame(loop);
}

/* ── Hero ───────────────────────────────────────────────────────── */
function initHero() {
  const canvas = $<HTMLCanvasElement>('[data-hero-face]');
  const btn = $<HTMLButtonElement>('[data-hero-play]');
  if (!canvas || !btn) return;
  const pattern = clonePattern(presetById('commute-hymn')!.pattern);
  const face = new InstrumentFace(canvas, { pattern, finish: 'ember' });
  const icon = $('[data-hero-icon]');
  const ui = (playing: boolean) => {
    btn.setAttribute('aria-pressed', String(playing));
    btn.setAttribute('aria-label', playing ? 'Stop the loop' : 'Play a loop on the Rondo');
    if (icon) icon.innerHTML = playing ? ICONS.pause : ICONS.play;
  };
  btn.addEventListener('click', () => {
    if (run?.id === 'hero') halt();
    else void begin({ id: 'hero', face, pattern, ui });
  });

  // While idle, the rings click round one detent at a time (visual only, no sound).
  let visible = true;
  new IntersectionObserver(([entry]) => (visible = Boolean(entry?.isIntersecting))).observe(canvas);
  if (reduceMotion) return;
  const order = [3, 2, 1, 3, 0];
  let n = 0;
  window.setInterval(() => {
    if (!visible || run?.id === 'hero' || document.hidden) return;
    const ring = pattern.rings[order[n++ % order.length]!]!;
    ring.offset = (ring.offset - 1 + ring.steps) % ring.steps;
    face.setPattern(pattern);
  }, 2200);
}

/* ── "A Rondo, on us": pick a finish ────────────────────────────── */
function initPick() {
  const canvas = $<HTMLCanvasElement>('[data-pick-face]');
  if (!canvas) return;
  const face = new InstrumentFace(canvas, { pattern: clonePattern(presetById('keplers-kitchen')!.pattern), finish: 'moon' });
  const swatches = $$<HTMLButtonElement>('[data-pick]');
  const name = $('[data-pick-name]');
  const choose = (id: ColorwayId) => {
    face.setFinish(id);
    swatches.forEach((s) => {
      s.setAttribute('aria-checked', String(s.dataset.pick === id));
      s.tabIndex = s.dataset.pick === id ? 0 : -1;
    });
    const cw = COLORWAYS.find((c) => c.id === id);
    if (cw && name) name.textContent = `${cw.name} · ${cw.note}`;
  };
  choose('moon');
  swatches.forEach((s, i) => {
    s.addEventListener('click', () => choose(s.dataset.pick as ColorwayId));
    // Radio group keyboarding: arrows move and select.
    s.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = swatches[(i + d + swatches.length) % swatches.length]!;
      next.focus();
      choose(next.dataset.pick as ColorwayId);
    });
  });
}

/* ── Format demos ───────────────────────────────────────────────── */
function setRing(p: Pattern, i: number, engineId: EngineId, steps: number, notes: number[], volume: number) {
  const r = p.rings[i]!;
  r.engine = engineId;
  r.steps = steps;
  r.notes = notes;
  r.volume = volume;
  r.offset = 0;
  r.mute = false;
}

function base(name: string, key: number, scale: Pattern['scale'], bpm: number, swing: number, space: number): Pattern {
  const p = emptyPattern();
  Object.assign(p, { name, key, scale, bpm, swing, space, drift: 0 });
  return p;
}

const ringColor = (i: number) => `var(${RINGS[i]!.colorVar})`;
const dots = (on: boolean[]) =>
  on.map((v, i) => `<i style="--c:${ringColor(i)}"${v ? ' data-on' : ''}></i>`).join('');

interface Demo {
  build(): Pattern;
  idleCaption(): string;
  idleStatus(): string;
  /** Runs before playback starts; returns the per-run tick. */
  start(p: Pattern, face: InstrumentFace, set: (caption: string, status?: string) => void): (rel: number) => void;
}

const LOOK = 0.9;

const DROP_CAPTIONS = ['just the melody…', 'add the chords…', 'now the bass…', 'the drop.'];
const PROMPTS = ['rain on the night bus', 'sunday pancakes', 'first swim of summer', 'deadline at midnight'];
let promptIndex = 0;

const TAPS: [ring: number, slot: number, note: number][] = [
  [0, 0, 0],
  [0, 8, 0],
  [0, 4, 1],
  [0, 12, 1],
  [1, 0, 0],
  [1, 6, 3],
  [2, 0, 0],
  [2, 4, 5],
  [3, 0, 7],
  [3, 3, 9],
];

const DEMOS: Record<string, Demo> = {
  drop: {
    build() {
      const p = base('The drop', 5, 'dorian', 108, 0.1, 0.4);
      setRing(p, 0, 'dust', 16, drumsFrom('k.h.c.hkh.k.c.ho'), 0.82);
      setRing(p, 1, 'sub', 16, notesFrom('0..0..3.4..4..6.'), 0.8);
      setRing(p, 2, 'tape', 8, notesFrom('0..3....'), 0.5);
      setRing(p, 3, 'glass', 5, notesFrom('7.9.6'), 0.58);
      return p;
    },
    idleCaption: () => 'wait for it…',
    idleStatus: () => dots([true, true, true, true]),
    start(p, _face, set) {
      // Rings join from the inside out, two bars apart; the drums land on bar seven.
      let stage = 0;
      const apply = (s: number) => {
        stage = s;
        p.rings.forEach((r, i) => (r.mute = i < 4 - s));
        engine?.update();
        set(DROP_CAPTIONS[s - 1]!, dots(p.rings.map((r) => !r.mute)));
      };
      apply(1);
      return (rel) => {
        const phase = (rel + LOOK) % 192;
        const s = phase < 32 ? 1 : phase < 64 ? 2 : phase < 96 ? 3 : 4;
        if (s !== stage) apply(s);
      };
    },
  },

  turn: {
    build() {
      const p = base('One click', 10, 'mixolydian', 90, 0.18, 0.45);
      setRing(p, 0, 'dust', 16, drumsFrom('k..h.zh.k.rh.zh.'), 0.6);
      setRing(p, 1, 'sub', 12, notesFrom('0..3..4..3..'), 0.72);
      setRing(p, 2, 'tape', 8, notesFrom('0...3...'), 0.45);
      setRing(p, 3, 'pluck', 9, notesFrom('4.6.5.7.4'), 0.66);
      return p;
    },
    idleCaption: () => 'same notes, one click',
    idleStatus: () => 'Spark · 9 steps',
    start(_p, face, set) {
      // One detent on the Spark ring every half bar: the melody re-forms under your thumb.
      let clicks = 0;
      set('same notes, one click', 'click 0');
      return (rel) => {
        const k = Math.floor((rel + LOOK) / 8);
        if (k > clicks) {
          clicks = k;
          face.turn(3, 1);
          set('same notes, one click', `click ${clicks}`);
        }
      };
    },
  },

  mood: {
    build: () => moodToPattern(PROMPTS[promptIndex % PROMPTS.length]!),
    idleCaption: () => `“${PROMPTS[promptIndex % PROMPTS.length]}”`,
    idleStatus: () => {
      const q = moodToPattern(PROMPTS[promptIndex % PROMPTS.length]!);
      return `${scaleById(q.scale).name} · ${q.bpm} bpm`;
    },
    start(p, face, set) {
      const describe = (q: Pattern) => `${scaleById(q.scale).name} · ${q.bpm} bpm`;
      const type = (text: string, status: string) => typeCaption(face.canvas.closest('.clip'), `“${text}”`, status, set);
      type(PROMPTS[promptIndex % PROMPTS.length]!, describe(p));
      let block = 0;
      // Every eight bars, a new moment: same engine, new words, new loop.
      return (rel) => {
        const k = Math.floor((rel + LOOK) / 128);
        if (k <= block || !engine || !run) return;
        block = k;
        promptIndex++;
        const words = PROMPTS[promptIndex % PROMPTS.length]!;
        const next = moodToPattern(words);
        alignTo(next, run.start + k * 128);
        engine.setBpm(next.bpm);
        Object.assign(p, { name: next.name, key: next.key, scale: next.scale, swing: next.swing, space: next.space, drift: 0 });
        p.rings = next.rings;
        engine.update();
        face.setPattern(p);
        type(words, describe(p));
      };
    },
  },

  build: {
    build() {
      const p = base('Ten taps', 2, 'lydian', 96, 0.12, 0.42);
      setRing(p, 0, 'dust', 16, Array(16).fill(-1), 0.75);
      setRing(p, 1, 'sub', 12, Array(16).fill(-1), 0.8);
      setRing(p, 2, 'tape', 8, Array(16).fill(-1), 0.5);
      setRing(p, 3, 'glass', 7, Array(16).fill(-1), 0.58);
      TAPS.forEach(([r, s, n]) => (p.rings[r]!.notes[s] = n));
      return p;
    },
    idleCaption: () => 'silence → song in 10 taps',
    idleStatus: () => '10 taps',
    start(p, face, set) {
      // A tap every half bar, each one landing just before its note comes round. Then it plays, then again.
      const CYCLE = 160;
      let cycle = 0;
      let next = 0;
      const tap = () => {
        const [r, s, n] = TAPS[next]!;
        p.rings[r]!.notes[s] = n;
        face.pulse(r, s);
        next++;
        set(next < TAPS.length ? `tap ${next} of 10` : '…and that’s a song.', `${next}/10`);
      };
      const clear = () => {
        p.rings.forEach((r) => r.notes.fill(-1));
        next = 0;
      };
      clear();
      tap();
      return (rel) => {
        const look = rel + LOOK;
        const c = Math.floor(look / CYCLE);
        if (c !== cycle) {
          cycle = c;
          clear();
        }
        const phase = look - c * CYCLE;
        let changed = false;
        while (next < TAPS.length && phase >= next * 8) {
          tap();
          changed = true;
        }
        if (changed) engine?.update();
      };
    },
  },
};

/** A typewriter caption (instant under reduced motion). */
const typing = new WeakMap<Element, number>();
function typeCaption(clip: Element | null, text: string, status: string, set: (c: string, s?: string) => void) {
  const caption = clip?.querySelector<HTMLElement>('[data-caption]');
  if (!clip || !caption) return set(text, status);
  window.clearInterval(typing.get(clip));
  if (reduceMotion) return set(text, status);
  let i = 0;
  caption.dataset.typing = '';
  set('', status);
  const timer = window.setInterval(() => {
    i++;
    caption.textContent = text.slice(0, i);
    if (i >= text.length) {
      window.clearInterval(timer);
      delete caption.dataset.typing;
    }
  }, 38);
  typing.set(clip, timer);
}

function initFormats() {
  $$<HTMLButtonElement>('[data-demo]').forEach((clip) => {
    const demo = DEMOS[clip.dataset.demo!];
    const canvas = clip.querySelector<HTMLCanvasElement>('[data-clip-face]');
    if (!demo || !canvas) return;
    const face = new InstrumentFace(canvas, { pattern: demo.build(), finish: clip.dataset.finish ?? 'noon' });
    const caption = clip.querySelector<HTMLElement>('[data-caption]');
    const status = clip.querySelector<HTMLElement>('[data-status]');
    const time = clip.querySelector<HTMLElement>('[data-time]');
    const icon = clip.querySelector<HTMLElement>('[data-clip-icon]');
    const title = clip.closest('.format')?.querySelector('h3')?.textContent ?? 'demo';
    const set = (c: string, s?: string) => {
      if (caption) caption.textContent = c;
      if (status && s !== undefined) status.innerHTML = s;
    };
    const idle = () => {
      set(demo.idleCaption(), demo.idleStatus());
      if (time) time.textContent = '0:00';
    };
    idle();

    let clock = 0;
    const ui = (playing: boolean) => {
      clip.setAttribute('aria-pressed', String(playing));
      if (icon) icon.innerHTML = playing ? ICONS.pause : ICONS.play;
      window.clearInterval(clock);
      if (!playing) {
        window.clearInterval(typing.get(clip));
        if (caption) delete caption.dataset.typing;
      }
      if (playing) {
        const t0 = performance.now();
        clock = window.setInterval(() => {
          const secs = Math.floor((performance.now() - t0) / 1000);
          if (time) time.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        }, 250);
        announce(`Playing ${title}.`);
      } else {
        idle();
      }
    };

    clip.addEventListener('click', () => {
      if (run?.id === clip.dataset.demo) {
        halt();
        return;
      }
      const pattern = demo.build();
      let tick: ((rel: number) => void) | undefined;
      void begin({ id: clip.dataset.demo!, face, pattern, ui, tick: (rel) => tick?.(rel) }, (p) => {
        tick = demo.start(p, face, set);
      });
    });
  });
}

/* ── Earnings estimator ─────────────────────────────────────────── */
const RATE = 0.12;
const PER_SALE = PRODUCT.price * RATE;

function initEstimator() {
  const calc = $('[data-calc]');
  if (!calc) return;
  const input = (k: string) => $<HTMLInputElement>(`[data-range="${k}"]`, calc)!;
  const out = (k: string) => $(`[data-out="${k}"]`, calc)!;
  const views = input('views');
  const stops = JSON.parse(views.dataset.stops ?? '[]') as number[];
  const nf = new Intl.NumberFormat('en-US');
  const pct = (v: number) => `${v.toFixed(1)}%`;
  const live = $('[data-calc-live]', calc);
  const all = [views, input('videos'), input('ctr'), input('conv')];

  const update = (speak = false) => {
    const v = stops[Number(views.value)] ?? 25000;
    const n = Number(input('videos').value);
    const ctr = Number(input('ctr').value);
    const conv = Number(input('conv').value);
    const monthViews = v * n;
    const clicks = (monthViews * ctr) / 100;
    const sales = (clicks * conv) / 100;
    const month = sales * PER_SALE;

    out('views').textContent = nf.format(v);
    out('videos').textContent = String(n);
    out('ctr').textContent = pct(ctr);
    out('conv').textContent = pct(conv);
    views.setAttribute('aria-valuetext', `${nf.format(v)} views`);
    input('videos').setAttribute('aria-valuetext', `${n} video${n === 1 ? '' : 's'}`);
    input('ctr').setAttribute('aria-valuetext', `${ctr.toFixed(1)} percent`);
    input('conv').setAttribute('aria-valuetext', `${conv.toFixed(1)} percent`);
    all.forEach((el) => {
      const min = Number(el.min);
      const max = Number(el.max);
      el.style.setProperty('--fill', `${((Number(el.value) - min) / (max - min)) * 100}%`);
    });

    const salesText = sales < 10 ? (Math.round(sales * 10) / 10).toFixed(1).replace(/\.0$/, '') : nf.format(Math.round(sales));
    $('[data-month]', calc)!.textContent = formatPrice(Math.round(month));
    $('[data-year]', calc)!.textContent = formatPrice(Math.round(month * 12));
    $('[data-f="views"]', calc)!.textContent = nf.format(monthViews);
    $('[data-f="clicks"]', calc)!.textContent = nf.format(Math.round(clicks));
    $('[data-f="sales"]', calc)!.textContent = salesText;
    $('[data-f="rondos"]', calc)!.textContent = salesText === '1' ? 'Rondo' : 'Rondos';
    if (speak && live) {
      live.textContent = `Estimated commission: about ${formatPrice(Math.round(month))} a month, ${formatPrice(Math.round(month * 12))} a year.`;
    }
  };
  all.forEach((el) => {
    el.addEventListener('input', () => update());
    el.addEventListener('change', () => update(true));
  });
  update();
}

/* ── Application form ───────────────────────────────────────────── */
type Field = HTMLInputElement | HTMLSelectElement;

function checkField(el: Field): string | null {
  const v = el.value.trim();
  switch (el.name) {
    case 'name':
      return v.length >= 2 ? null : 'Tell us your name, so we know who to reply to.';
    case 'email':
      if (!v) return 'We need an email address to reply to.';
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'That email doesn’t look quite right. A typo, maybe?';
    case 'platform':
      return v ? null : 'Pick the place you post most.';
    case 'handle': {
      const h = v.replace(/^@+/, '');
      if (!h) return 'Your handle, so we can see what you make.';
      return /^[A-Za-z0-9._-]{2,30}$/.test(h) ? null : 'Handles use letters, numbers, dots, dashes and underscores.';
    }
    case 'followers':
      return v ? null : 'A rough range is fine.';
    case 'link': {
      if (!v) return 'Show us one thing you’ve made.';
      try {
        const u = new URL(v);
        return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? null : 'Use a full web address, starting with https://';
      } catch {
        return 'Use a full web address, starting with https://';
      }
    }
    case 'consent':
      return (el as HTMLInputElement).checked
        ? null
        : 'Please tick this: we need it to reply, and it keeps your posts on the right side of the rules.';
    default:
      return null;
  }
}

function initForm() {
  const form = $<HTMLFormElement>('[data-apply]');
  const done = $('[data-done]');
  if (!form || !done) return;
  const fields = $$<Field>('input[name], select[name]', form);
  const status = $('[data-form-status]', form);

  const show = (el: Field, msg: string | null) => {
    const err = $(`#e-${el.name}`, form);
    el.setAttribute('aria-invalid', String(Boolean(msg)));
    if (err) {
      err.textContent = msg ?? '';
      err.hidden = !msg;
    }
  };

  fields.forEach((el) => {
    // Tidy what people paste: a bare domain gets https://, a handle loses its @.
    el.addEventListener('blur', () => {
      if (el.type === 'checkbox') return;
      if (el.name === 'link' && el.value.trim() && !/^[a-z]+:\/\//i.test(el.value.trim())) el.value = `https://${el.value.trim()}`;
      if (el.name === 'handle') el.value = el.value.trim().replace(/^@+/, '');
      if (el.value.trim() || el.getAttribute('aria-invalid') === 'true') show(el, checkField(el));
    });
    const recheck = () => {
      if (el.getAttribute('aria-invalid') === 'true') show(el, checkField(el));
    };
    el.addEventListener('input', recheck);
    el.addEventListener('change', recheck);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const link = form.elements.namedItem('link') as HTMLInputElement | null;
    if (link && link.value.trim() && !/^[a-z]+:\/\//i.test(link.value.trim())) link.value = `https://${link.value.trim()}`;
    const bad = fields.filter((el) => {
      const msg = checkField(el);
      show(el, msg);
      return Boolean(msg);
    });
    if (bad.length) {
      if (status) status.textContent = `${bad.length} ${bad.length === 1 ? 'answer needs' : 'answers need'} a second look.`;
      bad[0]!.focus();
      return;
    }
    const first = (form.elements.namedItem('name') as HTMLInputElement).value.trim().split(/\s+/)[0] ?? '';
    const title = $('[data-done-title]', done);
    if (title) title.textContent = first ? `Got it, ${first}.` : 'Got it.';
    form.hidden = true;
    done.hidden = false;
    title?.focus();
  });

  $('[data-reset]', done)?.addEventListener('click', () => {
    done.hidden = true;
    form.hidden = false;
    fields[0]?.focus();
  });
}

/* ── Boot ───────────────────────────────────────────────────────── */
initHero();
initPick();
initFormats();
initEstimator();
initForm();
if (import.meta.env.DEV) Object.assign(window, { __creators: { engine: () => engine, run: () => run } });
