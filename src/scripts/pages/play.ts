/** Rondo Web: the full instrument page. */
import { RondoEngine, renderLoop } from '../audio/engine';
import { audioBufferToWav, masterBuffer } from '../audio/wav';
import { earn } from '../core/achievements';
import { downloadBlob, shareLink } from '../core/share';
import { ensureSound, soundPref } from '../core/sound';
import { persisted, sessionValue } from '../core/store';
import { toast } from '../core/toast';
import { InstrumentFace, type EditEvent } from '../instrument/face';
import { SKIES, SKY_ORDER, cssOklch, type SkyDef } from '../lib/skies';
import { patternFromHash, encodePattern } from '../seq/codec';
import { generatePattern, moodToPattern, morningOrbit } from '../seq/generate';
import { ENGINES, MAX_STEPS, clonePattern, cycleLength, type EngineId, type Pattern } from '../seq/model';
import { presetById } from '../seq/presets';
import { scaleById, type ScaleId } from '../seq/scales';
import { ICONS } from '@/lib/icons';
import { url } from '@/lib/url';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

const lastLoop = persisted<string | null>('last-loop', null);
/** The name people sign their shared loops with, remembered for next time. */
const shareFrom = persisted<string>('share-from', '');
/** Who this visitor is making a loop back for (set by "Make one back"). */
const replyTo = sessionValue<string>('reply-to');

/* ── Shared links: #l=<loop>&f=<first name>&t=<HHMM, sender's local time> ── */
interface Arrival {
  from: string;
  time: string | null;
}

const codeIn = (hash: string) => /[#&]l=([A-Za-z0-9_-]+)/.exec(hash)?.[1] ?? null;
const cleanName = (s: string) =>
  s
    .replace(/[^\p{L}\p{N} .'’-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);

function readArrival(hash: string): Arrival | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.get('l') || !(params.has('f') || params.has('t'))) return null;
  const t = params.get('t') ?? '';
  const valid = /^\d{4}$/.test(t) && Number(t.slice(0, 2)) < 24 && Number(t.slice(2)) < 60;
  return { from: cleanName(params.get('f') ?? ''), time: valid ? `${t.slice(0, 2)}:${t.slice(2)}` : null };
}

/** The sky the sender was under: nearest of the eight skies to their clock (small hours are night). */
function skyForTime(hhmm: string): SkyDef {
  const [h, m] = hhmm.split(':').map(Number);
  const mins = h! * 60 + m!;
  if (mins < 5 * 60) return SKIES.night;
  let best = SKIES[SKY_ORDER[0]!];
  let bestD = Infinity;
  for (const id of SKY_ORDER) {
    const [sh, sm] = SKIES[id].clock.split(':').map(Number);
    const d = Math.abs(sh! * 60 + sm! - mins);
    if (d < bestD) {
      bestD = d;
      best = SKIES[id];
    }
  }
  return best;
}

/* ── Initial pattern: shared link › dice › last session › flagship ── */
function initialPattern(): { pattern: Pattern; source: 'shared' | 'link' | 'dice' | 'resume' | 'default' } {
  const shared = patternFromHash(location.hash);
  if (shared) {
    if (readArrival(location.hash)) return { pattern: shared, source: 'shared' };
    // A reload of your own loop (the address bar keeps it) isn't a message from someone else.
    if (codeIn(location.hash) === lastLoop.get()) return { pattern: shared, source: 'resume' };
    return { pattern: shared, source: 'link' };
  }
  if (location.hash === '#dice') return { pattern: generatePattern(Date.now() & 0xffffffff), source: 'dice' };
  const presetMatch = /#preset=([\w-]+)/.exec(location.hash);
  if (presetMatch) {
    const preset = presetById(presetMatch[1]!);
    if (preset) return { pattern: clonePattern(preset.pattern), source: 'link' };
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
/** Notes this visitor placed themselves (the "loop of your own" star needs six). */
let userNotes = 0;
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
  if (e.type === 'add') {
    userNotes++;
    earn('note');
  }
  if (e.type === 'rotate') earn('spin');
  if (userNotes >= 6) earn('loop');
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
      action: { label: 'Share', onClick: share },
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
  $('[data-share]').addEventListener('click', share);
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
  tabs.forEach((t, idx) => {
    t.addEventListener('click', () => selectTab(t.id));
    t.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      const next = tabs[(idx + dir + tabs.length) % tabs.length]!;
      selectTab(next.id);
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

function selectTab(id: string) {
  $$<HTMLButtonElement>('[role="tab"]').forEach((t) => {
    const on = t.id === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
  });
}

function roll() {
  const next = generatePattern((Math.random() * 2 ** 32) >>> 0);
  setPattern(next);
  toast(`Rolled “${next.name}”: ${scaleById(next.scale).name}, ${next.bpm} bpm`, { icon: 'dices' });
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

/** Share opens a small sheet first: signing the loop is what makes it arrive as a message. */
function share() {
  window.clearTimeout(urlTimer);
  const sheet = $<HTMLDialogElement>('[data-share-sheet]');
  const to = replyTo.get();
  const name = current().name;
  $('[data-share-title]').textContent = to ? `Send “${name}” to ${to}` : `Send “${name}”`;
  $<HTMLInputElement>('[data-share-from]').value = shareFrom.get();
  sheet.showModal();
}

async function sendLink() {
  const from = cleanName($<HTMLInputElement>('[data-share-from]').value);
  shareFrom.set(from);
  const code = encodePattern(current());
  history.replaceState(null, '', `#l=${code}`);
  lastLoop.set(code);
  const now = new Date();
  const q = new URLSearchParams({ l: code });
  if (from) q.set('f', from);
  q.set('t', `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`);
  // /l/ carries the link preview ("Someone made you a loop") and forwards to this page.
  const shareUrl = `${location.origin}${url('/l/')}#${q.toString()}`;
  const to = replyTo.get();
  const name = current().name;
  const result = await shareLink({
    title: `“${name}”, a loop made on Rondo`,
    text: to ? `${to}, I made you one back: “${name}”. Hear it:` : `I made “${name}” on Rondo. Hear it, then make me one back:`,
    url: shareUrl,
  });
  if (result !== 'cancelled') earn('share');
}

/* ── Arrival: a loop someone made for you ────────────────────────── */
let arrivalFrom = '';

function showArrival(a: Arrival) {
  arrivalFrom = a.from;
  const dlg = $<HTMLDialogElement>('[data-arrival]');
  const p = current();
  $('[data-arrival-title]').textContent = a.from ? `${a.from} made you a loop.` : 'Someone made you a loop.';
  $('[data-arrival-loop]').textContent = `“${p.name}”`;
  $('[data-arrival-meta]').textContent = `· ${scaleById(p.scale).name} · ${p.bpm} bpm`;
  const when = $('[data-arrival-when]');
  if (a.time) {
    const sky = skyForTime(a.time);
    dlg.style.setProperty('--arr-a', cssOklch(sky.top));
    dlg.style.setProperty('--arr-b', cssOklch(sky.bottom));
    dlg.dataset.dark = String(sky.dark > 0.5);
    when.textContent = `Made at ${a.time} their time, ${sky.label.toLowerCase() === 'noon' ? 'around noon' : `in their ${sky.label.toLowerCase()}`}`;
    when.hidden = false;
  } else {
    when.hidden = true;
  }
  const strip = $('[data-arrival-strip]');
  $('[data-strip-from]').textContent = a.from ? `From ${a.from}` : 'A loop for you';
  $('[data-strip-when]').textContent = a.time ? `· made at ${a.time} their time` : '';
  dlg.addEventListener(
    'close',
    () => {
      strip.hidden = false;
      // Drop the arrival details from the address bar: a reload is now just this loop.
      history.replaceState(null, '', `#l=${encodePattern(current())}`);
    },
    { once: true },
  );
  if (!dlg.open) dlg.showModal();
}

function bindArrival() {
  const dlg = $<HTMLDialogElement>('[data-arrival]');
  $('[data-arrival-play]').addEventListener('click', () => {
    dlg.close();
    if (!engine?.playing) void togglePlay();
  });
  $('[data-arrival-close]').addEventListener('click', () => dlg.close());
  $('[data-make-back]').addEventListener('click', () => {
    if (arrivalFrom) replyTo.set(arrivalFrom);
    $('[data-arrival-strip]').hidden = true;
    selectTab('tab-mood');
    const ta = $<HTMLTextAreaElement>('[data-mood-text]');
    ta.placeholder = arrivalFrom ? `A moment for ${arrivalFrom}, in a few words` : 'A moment, in a few words';
    ta.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    ta.focus({ preventScroll: true });
    // Guidance lives beside the form, not in a toast that could sit over Share loop.
    const hint = $('[data-mood-reply]');
    hint.textContent = arrivalFrom
      ? `Making one for ${arrivalFrom}. When it sounds right, tap Share loop to send it back.`
      : 'When it sounds right, tap Share loop to send it back.';
    hint.hidden = false;
  });
  const sheet = $<HTMLDialogElement>('[data-share-sheet]');
  $<HTMLFormElement>('[data-share-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const go = (e.submitter as HTMLButtonElement | null)?.value === 'share';
    sheet.close();
    if (go) void sendLink();
  });
}

/** Links opened while already here: the palette's dice, presets, or a pasted loop. */
function onHashChange() {
  const h = location.hash;
  if (h === '#dice') return roll();
  const presetMatch = /#preset=([\w-]+)/.exec(h);
  if (presetMatch) {
    const preset = presetById(presetMatch[1]!);
    if (preset) setPattern(clonePattern(preset.pattern));
    return;
  }
  const next = patternFromHash(h);
  if (!next || codeIn(h) === encodePattern(current())) return;
  setPattern(next);
  const a = readArrival(h);
  if (a) showArrival(a);
  else toast(`Loaded “${next.name}”. Tap the sun to hear it.`, { icon: 'headphones' });
}

async function exportWav() {
  const btn = $<HTMLButtonElement>('[data-export]');
  btn.disabled = true;
  const dismiss = toast('Rendering four bars…', { icon: 'download', duration: 20000 });
  try {
    const buffer = await renderLoop(current(), 4);
    masterBuffer(buffer);
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

bindArrival();
window.addEventListener('hashchange', onHashChange);

if (start.source === 'shared') {
  showArrival(readArrival(location.hash)!);
} else if (start.source === 'link') {
  toast(`Here's “${pattern.name}”. Tap the sun to hear it.`, { icon: 'headphones', duration: 7000 });
} else if (start.source === 'resume') {
  toast(`Welcome back. “${pattern.name}” is where you left it.`, { icon: 'undo' });
} else if (start.source === 'default') {
  // First visit: words are the gentlest way in.
  selectTab('tab-mood');
}
if (soundPref.get()) {
  // Preference remembered: build the engine on the first gesture anywhere.
  window.addEventListener('pointerdown', () => ensureEngine(), { once: true, capture: true });
}
