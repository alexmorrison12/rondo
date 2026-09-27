/** Rondo Web: the full instrument page. */
import { RondoEngine, renderLoop } from '../audio/engine';
import { audioBufferToWav } from '../audio/wav';
import { earn } from '../core/achievements';
import { downloadBlob, shareLink } from '../core/share';
import { ensureSound, soundPref } from '../core/sound';
import { persisted } from '../core/store';
import { toast } from '../core/toast';
import { InstrumentFace, type EditEvent } from '../instrument/face';
import { SKIES, cssOklch } from '../lib/skies';
import { patternFromHash, encodePattern } from '../seq/codec';
import { generatePattern, moodToPattern, morningOrbit } from '../seq/generate';
import { ENGINES, MAX_STEPS, clonePattern, cycleLength, noteCount, type EngineId, type Pattern } from '../seq/model';
import { presetById } from '../seq/presets';
import { scaleById, type ScaleId } from '../seq/scales';
import { ICONS } from '@/lib/icons';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

const lastLoop = persisted<string | null>('last-loop', null);

/* ── Initial pattern: shared link › dice › last session › flagship ── */
function initialPattern(): { pattern: Pattern; source: 'shared' | 'dice' | 'resume' | 'default' } {
  const shared = patternFromHash(location.hash);
  if (shared) return { pattern: shared, source: 'shared' };
  if (location.hash === '#dice') return { pattern: generatePattern(Date.now() & 0xffffffff), source: 'dice' };
  const presetMatch = /#preset=([\w-]+)/.exec(location.hash);
  if (presetMatch) {
    const preset = presetById(presetMatch[1]!);
    if (preset) return { pattern: clonePattern(preset.pattern), source: 'shared' };
  }
  const resumed = lastLoop.get() ? patternFromHash(`#l=${lastLoop.get()}`) : null;
  if (resumed) return { pattern: resumed, source: 'resume' };
  return { pattern: morningOrbit(), source: 'default' };
}

const start = initialPattern();
let pattern = start.pattern;
let engine: RondoEngine | null = null;
const undoStack: string[] = [];
const redoStack: string[] = [];
let editsThisSession = 0;
let playStartedAt = 0;
let nudged = false;

const canvas = $<HTMLCanvasElement>('[data-face]');
const announcer = $('[data-announce]');

const face = new InstrumentFace(canvas, {
  pattern,
  interactive: true,
  onPointerDown: wakeAudio,
  onBeforeEdit: pushHistory,
  onEdit: handleEdit,
  onToggle: () => void togglePlay(),
  onAnnounce: (msg) => (announcer.textContent = msg),
});

function ensureEngine(): RondoEngine {
  if (engine) return engine;
  engine = new RondoEngine(pattern);
  face.setEngine(engine);
  engine.onChange(() => {
    syncControls();
    scheduleUrl();
  });
  engine.onState((playing) => {
    $('[data-play]').setAttribute('aria-pressed', String(playing));
    $('[data-play-label]').textContent = playing ? 'Stop' : 'Play';
    $('[data-play-icon]').innerHTML = playing ? ICONS.stop : ICONS.play;
  });
  return engine;
}

/** Touching the instrument is opting in to hearing it. */
function wakeAudio() {
  if (!soundPref.get()) void ensureSound().then(() => earn('sound'));
  ensureEngine();
}

async function togglePlay() {
  await ensureSound();
  earn('sound');
  const e = ensureEngine();
  await e.toggle();
  if (e.playing) {
    playStartedAt = performance.now();
    hideHint();
  }
}

function current(): Pattern {
  return engine?.pattern ?? pattern;
}

function setPattern(next: Pattern, opts: { record?: boolean } = {}) {
  if (opts.record !== false) pushHistory();
  pattern = next;
  face.setPattern(next);
  if (engine) engine.setPattern(next);
  syncControls();
  scheduleUrl();
}

/* ── History ─────────────────────────────────────────────────────── */
function pushHistory() {
  undoStack.push(JSON.stringify(current()));
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
  syncHistoryButtons();
}

function restore(json: string) {
  const p = JSON.parse(json) as Pattern;
  pattern = p;
  face.setPattern(p);
  engine?.setPattern(p);
  syncControls();
  scheduleUrl();
}

function undo() {
  const prev = undoStack.pop();
  if (!prev) return;
  redoStack.push(JSON.stringify(current()));
  restore(prev);
  syncHistoryButtons();
}

function redo() {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(JSON.stringify(current()));
  restore(next);
  syncHistoryButtons();
}

function syncHistoryButtons() {
  $<HTMLButtonElement>('[data-undo]').disabled = undoStack.length === 0;
  $<HTMLButtonElement>('[data-redo]').disabled = redoStack.length === 0;
}

/* ── Edits → achievements, URL, gentle nudge ─────────────────────── */
function handleEdit(e: EditEvent) {
  editsThisSession++;
  hideHint();
  if (e.type === 'add') earn('note');
  if (e.type === 'rotate') earn('spin');
  if (noteCount(current()) >= 8 && editsThisSession >= 3) earn('loop');
  syncControls();
  scheduleUrl();
  maybeNudge();
}

let urlTimer = 0;
function scheduleUrl() {
  window.clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    const code = encodePattern(current());
    history.replaceState(null, '', `#l=${code}`);
    lastLoop.set(code);
  }, 350);
}

function maybeNudge() {
  if (nudged) return;
  const played = playStartedAt ? (performance.now() - playStartedAt) / 1000 : 0;
  if (editsThisSession >= 8 || played > 60) {
    nudged = true;
    toast('This is a loop worth keeping. Share it, or hear it on the real thing.', {
      icon: 'sparkles',
      duration: 9000,
      action: { label: 'Share', onClick: () => void share() },
    });
  }
}

function hideHint() {
  $('[data-hint]').dataset.hidden = 'true';
}

/* ── Controls ────────────────────────────────────────────────────── */
function applySky(scaleId: ScaleId) {
  const sky = SKIES[scaleById(scaleId).sky];
  document.body.style.setProperty('--sky-a', cssOklch(sky.top));
  document.body.style.setProperty('--sky-b', cssOklch(sky.bottom));
  document.body.dataset.dark = String(sky.dark > 0.5);
  document.querySelector('[data-header]')?.setAttribute('data-theme', sky.dark > 0.5 ? 'night' : 'day');
}

function syncControls() {
  const p = current();
  $<HTMLInputElement>('[data-loop-name]').value = p.name;
  $<HTMLOutputElement>('[data-bpm-out]').textContent = String(p.bpm);
  $<HTMLSelectElement>('[data-key]').value = String(p.key);
  $<HTMLSelectElement>('[data-scale]').value = p.scale;
  $('[data-scale-feel]').textContent = scaleById(p.scale).feel;
  $<HTMLInputElement>('[data-swing]').value = String(Math.round(p.swing * 100));
  $<HTMLInputElement>('[data-space]').value = String(Math.round(p.space * 100));
  $<HTMLInputElement>('[data-drift]').value = String(Math.round(p.drift * 100));
  const cycle = cycleLength(p);
  $('[data-cycle]').textContent =
    cycle <= 16 ? `Loops every bar` : `Repeats every ${cycle} steps · ${Math.round((cycle / 16) * 10) / 10} bars`;
  $$('[data-ring]').forEach((el) => {
    const i = Number(el.dataset.ring);
    const r = p.rings[i]!;
    $('[data-steps-out]', el).textContent = String(r.steps);
    $('[data-mute]', el).setAttribute('aria-pressed', String(r.mute));
    $<HTMLInputElement>('[data-volume]', el).value = String(Math.round(r.volume * 100));
    $$('[data-engine]', el).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.engine === r.engine)));
  });
  applySky(p.scale);
}

function mutate(fn: (p: Pattern) => void, record = true) {
  if (record) pushHistory();
  fn(current());
  if (engine) engine.update();
  else face.setPattern(current());
  syncControls();
  scheduleUrl();
}

function bindControls() {
  $('[data-play]').addEventListener('click', () => void togglePlay());
  $$('[data-bpm]').forEach((b) =>
    b.addEventListener('click', () => {
      const delta = Number(b.dataset.bpm);
      const next = Math.min(180, Math.max(50, current().bpm + delta));
      if (engine) engine.setBpm(next);
      else current().bpm = next;
      syncControls();
      scheduleUrl();
    }),
  );
  $('[data-dice]').addEventListener('click', roll);
  $('[data-undo]').addEventListener('click', undo);
  $('[data-redo]').addEventListener('click', redo);
  $('[data-share]').addEventListener('click', () => void share());
  $('[data-export]').addEventListener('click', () => void exportWav());

  $<HTMLInputElement>('[data-loop-name]').addEventListener('change', (e) => {
    mutate((p) => (p.name = (e.target as HTMLInputElement).value.trim() || 'Untitled loop'));
  });
  $<HTMLSelectElement>('[data-key]').addEventListener('change', (e) =>
    mutate((p) => (p.key = Number((e.target as HTMLSelectElement).value))),
  );
  $<HTMLSelectElement>('[data-scale]').addEventListener('change', (e) =>
    mutate((p) => (p.scale = (e.target as HTMLSelectElement).value as ScaleId)),
  );
  const slider = (sel: string, apply: (p: Pattern, v: number) => void) => {
    const input = $<HTMLInputElement>(sel);
    input.addEventListener('pointerdown', () => pushHistory());
    input.addEventListener('input', () => mutate((p) => apply(p, Number(input.value)), false));
  };
  slider('[data-swing]', (p, v) => (p.swing = v / 100));
  slider('[data-space]', (p, v) => (p.space = v / 100));
  slider('[data-drift]', (p, v) => (p.drift = v / 100));

  $$('[data-ring]').forEach((el) => {
    const i = Number(el.dataset.ring);
    $$('[data-steps]', el).forEach((b) =>
      b.addEventListener('click', () =>
        mutate((p) => {
          const r = p.rings[i]!;
          r.steps = Math.min(MAX_STEPS, Math.max(1, r.steps + Number(b.dataset.steps)));
          r.offset = r.offset % r.steps;
        }),
      ),
    );
    $('[data-mute]', el).addEventListener('click', () => mutate((p) => (p.rings[i]!.mute = !p.rings[i]!.mute)));
    $('[data-clear]', el).addEventListener('click', () => mutate((p) => p.rings[i]!.notes.fill(-1)));
    $$('[data-engine]', el).forEach((b) =>
      b.addEventListener('click', () => {
        mutate((p) => (p.rings[i]!.engine = b.dataset.engine as EngineId));
        const eng = ENGINES.find((x) => x.id === b.dataset.engine);
        if (eng) announcer.textContent = `${eng.name}: ${eng.blurb}`;
      }),
    );
    const vol = $<HTMLInputElement>('[data-volume]', el);
    vol.addEventListener('pointerdown', () => pushHistory());
    vol.addEventListener('input', () => mutate((p) => (p.rings[i]!.volume = Number(vol.value) / 100), false));
  });

  // Tabs
  const tabs = $$<HTMLButtonElement>('[role="tab"]');
  const select = (tab: HTMLButtonElement) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
  };
  tabs.forEach((t, idx) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      const next = tabs[(idx + dir + tabs.length) % tabs.length]!;
      select(next);
      next.focus();
    });
  });

  // Mood
  $<HTMLFormElement>('[data-mood-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $<HTMLTextAreaElement>('[data-mood-text]').value;
    compose(text);
  });
  $$('[data-mood-chip]').forEach((c) =>
    c.addEventListener('click', () => {
      $<HTMLTextAreaElement>('[data-mood-text]').value = c.textContent ?? '';
      compose(c.textContent ?? '');
    }),
  );

  // Presets
  $$('[data-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      const preset = presetById(b.dataset.preset!);
      if (!preset) return;
      setPattern(clonePattern(preset.pattern));
      $$('[data-preset]').forEach((x) => x.setAttribute('aria-current', String(x === b)));
      toast(`Loaded “${preset.pattern.name}” by ${preset.author}`, { icon: 'headphones' });
      if (!engine?.playing) void togglePlay();
    }),
  );

  // Global keys
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable]')) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ' && !t.closest('button, a')) {
      e.preventDefault();
      void togglePlay();
    } else if (e.key.toLowerCase() === 'd') {
      roll();
    }
  });
}

function roll() {
  const next = generatePattern((Math.random() * 2 ** 32) >>> 0);
  setPattern(next);
  toast(`Rolled a ${scaleById(next.scale).name.toLowerCase()} loop at ${next.bpm} bpm`, { icon: 'dices' });
  if (!engine?.playing) void togglePlay();
}

function compose(text: string) {
  if (!text.trim()) {
    toast('Write a few words first: a place, a time, a feeling.', { icon: 'wand' });
    return;
  }
  const next = moodToPattern(text);
  setPattern(next);
  toast(`Composed “${next.name}” · ${scaleById(next.scale).name}, ${next.bpm} bpm`, { icon: 'wand' });
  if (!engine?.playing) void togglePlay();
}

async function share() {
  window.clearTimeout(urlTimer);
  const code = encodePattern(current());
  history.replaceState(null, '', `#l=${code}`);
  const shareUrl = `${location.origin}${location.pathname}#l=${code}`;
  const result = await shareLink({
    title: `${current().name} — made on Rondo`,
    text: `I made a loop called “${current().name}”. Tap to play it:`,
    url: shareUrl,
  });
  if (result !== 'cancelled') earn('share');
}

async function exportWav() {
  const btn = $<HTMLButtonElement>('[data-export]');
  btn.disabled = true;
  const dismiss = toast('Rendering four bars…', { icon: 'download', duration: 20000 });
  try {
    const buffer = await renderLoop(current(), 4);
    const name = current().name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'rondo-loop';
    downloadBlob(audioBufferToWav(buffer), `${name}.wav`);
    dismiss();
    toast('Saved a WAV. Royalty-free: use it anywhere.', { icon: 'check' });
  } catch (err) {
    console.error(err);
    dismiss();
    toast('Could not render audio in this browser.', { icon: 'x' });
  } finally {
    btn.disabled = false;
  }
}

/* ── Boot ────────────────────────────────────────────────────────── */
if (import.meta.env.DEV) Object.assign(window, { __rondo: { face, engine: () => engine } });
bindControls();
syncControls();
syncHistoryButtons();
face.draw();

if (start.source === 'shared') {
  toast(`Someone shared “${pattern.name}” with you. Tap the sun to hear it.`, { icon: 'headphones', duration: 7000 });
} else if (start.source === 'resume') {
  toast(`Welcome back. “${pattern.name}” is where you left it.`, { icon: 'undo' });
}
if (soundPref.get()) {
  // Preference remembered: build the engine on the first gesture anywhere.
  window.addEventListener('pointerdown', () => ensureEngine(), { once: true, capture: true });
}
