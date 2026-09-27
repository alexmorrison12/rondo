/**
 * Gift landing page. One loop, one engine, three views of it (the hero sun, the composer and the
 * finder's pick), plus a printable card renderer: the loop drawn as a four-ring score, the giver's
 * words, and a QR code that opens the loop in Rondo Web.
 */
import { encode } from 'uqr';
import { ADDONS, COLORWAYS, DATES, PHASES, PRODUCT, formatPrice, type ColorwayId } from '@/data/site';
import { ICONS } from '@/lib/icons';
import { url } from '@/lib/url';
import { RondoEngine } from '../audio/engine';
import { earn } from '../core/achievements';
import { openBag } from '../core/bag';
import { addToCart, addonItem, rondoItem } from '../core/cart';
import { currentPhase, phaseStore } from '../core/phase';
import { copyText, downloadBlob } from '../core/share';
import { ensureSound, soundPref } from '../core/sound';
import { toast } from '../core/toast';
import { BANDS, InstrumentFace, type EditEvent } from '../instrument/face';
import { RING_OKLCH, mixRgb, oklchCss, oklchToSrgb, rgbCss, type RGB } from '../lib/color';
import { encodePattern } from '../seq/codec';
import { generatePattern, moodToPattern, morningOrbit } from '../seq/generate';
import { RINGS, clonePattern, noteCount, type Pattern } from '../seq/model';
import { KEYS, scaleById } from '../seq/scales';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

/* ── State ──────────────────────────────────────────────────────── */
const state = {
  pattern: morningOrbit(),
  finish: 'ember' as ColorwayId,
  to: '',
  from: '',
  message: '',
  mention: true,
};

let engine: RondoEngine | null = null;
let edits = 0;
const faces: InstrumentFace[] = [];
const announcer = $('[data-announce]');
const announce = (msg: string) => {
  if (announcer) announcer.textContent = msg;
};

/* ── Sound: one engine for every face on the page ───────────────── */
function ensureEngine(): RondoEngine {
  if (engine) return engine;
  engine = new RondoEngine(state.pattern);
  faces.forEach((f) => f.setEngine(engine));
  engine.onState(syncPlayState);
  return engine;
}

/** Touching the instrument is opting in to hearing it (same rule as Rondo Web). */
function wakeAudio() {
  if (!soundPref.get()) void ensureSound().then(() => earn('sound'));
  ensureEngine();
}

async function togglePlay() {
  await ensureSound();
  earn('sound');
  await ensureEngine().toggle();
}

async function play() {
  await ensureSound();
  earn('sound');
  await ensureEngine().start();
}

function syncPlayState(playing: boolean) {
  const hero = $('[data-hero-play]');
  hero?.setAttribute('aria-pressed', String(playing));
  hero?.setAttribute('aria-label', playing ? 'Pause the loop' : 'Play the loop on the card');
  const heroIcon = $('[data-hero-play-icon]');
  if (heroIcon) heroIcon.innerHTML = playing ? ICONS.pause : ICONS.play;
  const btn = $('[data-play]');
  btn?.setAttribute('aria-pressed', String(playing));
  const label = $('[data-play-label]');
  if (label) label.textContent = playing ? 'Stop' : 'Play';
  const icon = $('[data-play-icon]');
  if (icon) icon.innerHTML = playing ? ICONS.stop : ICONS.play;
}

function setPattern(next: Pattern) {
  state.pattern = next;
  faces.forEach((f) => f.setPattern(next));
  engine?.setPattern(next);
  const name = $<HTMLInputElement>('[data-loop-name]');
  if (name) name.value = next.name;
  scheduleCard(0);
}

/* ── Faces ──────────────────────────────────────────────────────── */
function initFaces() {
  const heroCanvas = $<HTMLCanvasElement>('[data-hero-face]');
  if (heroCanvas) faces.push(new InstrumentFace(heroCanvas, { pattern: state.pattern, finish: 'ember' }));

  const finderCanvas = $<HTMLCanvasElement>('[data-finder-face]');
  if (finderCanvas) {
    finderFace = new InstrumentFace(finderCanvas, { pattern: state.pattern, finish: 'noon' });
    faces.push(finderFace);
  }

  const canvas = $<HTMLCanvasElement>('[data-face]');
  if (canvas) {
    composerFace = new InstrumentFace(canvas, {
      pattern: state.pattern,
      finish: state.finish,
      interactive: true,
      onPointerDown: wakeAudio,
      onEdit: handleEdit,
      onToggle: () => void togglePlay(),
      onAnnounce: announce,
    });
    faces.push(composerFace);
    canvas.addEventListener('keydown', (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        void togglePlay();
      }
    });
  }

  $('[data-hero-play]')?.addEventListener('click', () => void togglePlay());
}

let finderFace: InstrumentFace | null = null;
let composerFace: InstrumentFace | null = null;

let userNotes = 0;
function handleEdit(e: EditEvent) {
  edits++;
  if (e.type === 'add') {
    userNotes++;
    earn('note');
  }
  if (e.type === 'rotate') earn('spin');
  if (userNotes >= 6) earn('loop');
  scheduleCard();
}

/* ── Composer controls ──────────────────────────────────────────── */
const ROLL_NAMES = [
  'Slow Comet',
  'Paper Moon',
  'Kitchen Light',
  'Last Tram Home',
  'Soft Landing',
  'Tuesday Gold',
  'Porch Lights',
  'Small Hours',
  'Borrowed Sweater',
  'Lantern Walk',
  'Sea Glass',
  'Window Seat',
];

function initComposer() {
  $('[data-play]')?.addEventListener('click', () => void togglePlay());

  $('[data-dice]')?.addEventListener('click', () => {
    const next = generatePattern((Math.random() * 2 ** 32) >>> 0);
    next.name = ROLL_NAMES[Math.floor(Math.random() * ROLL_NAMES.length)]!;
    setPattern(next);
    toast(`New loop: “${next.name}”, ${scaleById(next.scale).name.toLowerCase()} at ${next.bpm} bpm`, { icon: 'dices' });
    void play();
  });

  $('[data-clear]')?.addEventListener('click', () => {
    const before = clonePattern(state.pattern);
    if (noteCount(before) === 0) return;
    const blank = clonePattern(state.pattern);
    blank.rings.forEach((r) => r.notes.fill(-1));
    setPattern(blank);
    toast('Cleared every ring. Tap the rings to start fresh.', {
      icon: 'undo',
      action: { label: 'Undo', onClick: () => setPattern(before) },
    });
  });

  const nameInput = $<HTMLInputElement>('[data-loop-name]');
  nameInput?.addEventListener('input', () => {
    state.pattern.name = nameInput.value.trim() || 'Untitled loop';
    scheduleCard();
  });
  nameInput?.addEventListener('blur', () => {
    if (!nameInput.value.trim()) nameInput.value = state.pattern.name;
  });

  const compose = (text: string) => {
    const clean = text.trim();
    if (!clean) {
      toast('Write a few words first: a place, a time, a thing you do together.', { icon: 'wand' });
      $<HTMLInputElement>('[data-moment-text]')?.focus();
      return;
    }
    const next = moodToPattern(clean);
    setPattern(next);
    toast(`Composed “${next.name}” · ${scaleById(next.scale).name}, ${next.bpm} bpm`, { icon: 'wand' });
    void play();
  };
  $<HTMLFormElement>('[data-moment]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    compose($<HTMLInputElement>('[data-moment-text]')?.value ?? '');
  });
  $$<HTMLButtonElement>('[data-moment-chip]').forEach((chip) =>
    chip.addEventListener('click', () => {
      const text = chip.textContent ?? '';
      const input = $<HTMLInputElement>('[data-moment-text]');
      if (input) input.value = text;
      compose(text);
    }),
  );

  // Card words
  const to = $<HTMLInputElement>('[data-to]');
  const from = $<HTMLInputElement>('[data-from]');
  const message = $<HTMLTextAreaElement>('[data-message]');
  const mention = $<HTMLInputElement>('[data-mention]');
  const count = $('[data-count]');
  const sync = () => {
    state.to = to?.value.trim() ?? '';
    state.from = from?.value.trim() ?? '';
    state.message = message?.value ?? '';
    state.mention = mention?.checked ?? true;
    if (count) count.textContent = String(state.message.length);
    scheduleCard();
  };
  [to, from, message].forEach((el) => el?.addEventListener('input', sync));
  mention?.addEventListener('change', sync);
  sync();

  $('[data-download]')?.addEventListener('click', () => void downloadCard());
  $('[data-copy]')?.addEventListener('click', () => void copyLoop());
}

/** The same signed link Rondo Web shares: it opens as "Alex made you a loop", with its own preview card. */
function loopLink(): string {
  const now = new Date();
  const q = new URLSearchParams({ l: encodePattern(state.pattern) });
  const from = state.from.replace(/[^\p{L}\p{N} .'’-]/gu, '').trim().slice(0, 24);
  if (from) q.set('f', from);
  q.set('t', `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`);
  return `${location.origin}${url('/l/')}#${q.toString()}`;
}

async function copyLoop() {
  const ok = await copyText(loopLink());
  toast(ok ? `Link to “${state.pattern.name}” copied. It plays in any browser.` : 'Copy failed. Download the card instead.', {
    icon: ok ? 'check' : 'link',
  });
  if (ok) earn('share');
}

function slug(s: string) {
  return (
    s
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 32) || 'you'
  );
}

async function downloadCard() {
  const btn = $<HTMLButtonElement>('[data-download]');
  if (btn) btn.disabled = true;
  try {
    await fontsReady();
    const c = document.createElement('canvas');
    c.width = CARD_W;
    c.height = CARD_H;
    drawCard(c, cardData());
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('toBlob returned null');
    downloadBlob(blob, `rondo-card-for-${slug(state.to || 'you')}.png`);
    toast('Card saved. Print it at 5 × 7 inches, or send it as it is.', { icon: 'download' });
    earn('share');
  } catch (err) {
    console.error(err);
    toast('This browser could not draw the card. Copy the loop link instead.', { icon: 'x' });
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ── The card ───────────────────────────────────────────────────── */
const CARD_W = 1500;
const CARD_H = 2100;
const SKY_H = 1120;
const PAD = 116;

interface CardData {
  to: string;
  from: string;
  message: string;
  mention: boolean;
  pattern: Pattern;
  link: string;
}

function cardData(): CardData {
  return {
    to: state.to,
    from: state.from,
    message: state.message,
    mention: state.mention,
    pattern: state.pattern,
    link: loopLink(),
  };
}

let qrCache: { link: string; qr: ReturnType<typeof encode> } | null = null;
function qrFor(link: string) {
  if (qrCache?.link !== link) qrCache = { link, qr: encode(link, { ecc: 'M', border: 0 }) };
  return qrCache.qr;
}

/** Canvas text needs the variable font (and any extra subsets the names need) loaded first. */
async function fontsReady(): Promise<void> {
  if (!document.fonts) return;
  const sample = `${state.to}${state.from}${state.message}${state.pattern.name}For you Scan`;
  await Promise.all([
    document.fonts.load('800 80px Archivo', sample),
    document.fonts.load('400 40px Archivo', sample),
  ]).catch(() => undefined);
}

const ink = oklchCss(0.2, 0.03, 258);
const inkSoft = oklchCss(0.4, 0.035, 255);
const inkMute = oklchCss(0.5, 0.03, 252);
const starlight: [number, number, number] = [0.93, 0.025, 250];
const ringRgb: RGB[] = RING_OKLCH.map(([l, c, h]) => oklchToSrgb(l, c, h));

type Stop = [t: number, l: number, c: number, h: number];

/** Canvas gradients blend in sRGB; sample the OKLCH path so sunsets don't go grey in the middle. */
function oklchStops(g: CanvasGradient, stops: Stop[], alpha = 1) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, l0, c0, h0] = stops[i]!;
    const [t1, l1, c1, h1] = stops[i + 1]!;
    let dh = h1 - h0;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const n = 12;
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      g.addColorStop(t0 + (t1 - t0) * f, oklchCss(l0 + (l1 - l0) * f, c0 + (c1 - c0) * f, (h0 + dh * f + 360) % 360, alpha));
    }
  }
}

function font(ctx: CanvasRenderingContext2D, weight: number, size: number, stretch: CanvasFontStretch = 'normal') {
  ctx.font = `${weight} ${size}px Archivo, "Archivo Fallback", ui-sans-serif, system-ui, sans-serif`;
  if ('fontStretch' in ctx) ctx.fontStretch = stretch;
}

function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, max: number, min: number, width: number, stretch: CanvasFontStretch) {
  let size = max;
  for (; size > min; size -= 2) {
    font(ctx, weight, size, stretch);
    if (ctx.measureText(text).width <= width) return size;
  }
  font(ctx, weight, min, stretch);
  return min;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.replace(/\r/g, '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= width) {
        line = test;
        continue;
      }
      if (line) lines.push(line);
      if (ctx.measureText(word).width <= width) {
        line = word;
        continue;
      }
      let chunk = '';
      for (const ch of word) {
        if (ctx.measureText(chunk + ch).width > width) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
    lines.push(line);
  }
  while (lines.length > 1 && !lines[lines.length - 1]) lines.pop();
  return lines;
}

/** The loop as a score: the instrument seen from above, one light per note, pitch as distance from the centre. */
function drawScore(ctx: CanvasRenderingContext2D, p: Pattern, cx: number, cy: number, R: number) {
  const TAU = Math.PI * 2;
  const k = R / BANDS[0]!.outer;
  const disc = (r: number) => {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
  };
  ctx.save();
  ctx.translate(cx, cy);

  // Body and bezel, so the rings read as one object.
  const bodyR = R * 1.055;
  ctx.fillStyle = oklchCss(...starlight, 0.06);
  disc(bodyR);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = oklchCss(...starlight, 0.34);
  disc(bodyR);
  ctx.stroke();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU - Math.PI / 2;
    const major = i % 4 === 0;
    const r1 = bodyR - 6;
    const r2 = bodyR - (major ? 22 : 14);
    ctx.lineWidth = major ? 2.5 : 1.5;
    ctx.strokeStyle = oklchCss(...starlight, major ? 0.42 : 0.22);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }

  p.rings.forEach((ring, i) => {
    const band = BANDS[i]!;
    const ro = band.outer * k;
    const ri = band.inner * k;
    const mid = (ro + ri) / 2;
    const col = ringRgb[i]!;
    ctx.fillStyle = oklchCss(...starlight, 0.075);
    ctx.beginPath();
    ctx.arc(0, 0, ro, 0, TAU);
    ctx.arc(0, 0, ri, 0, TAU, true);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = oklchCss(...starlight, 0.2);
    disc(ro);
    ctx.stroke();

    const span = (band.outer - band.inner) * 0.34 * k;
    const max = RINGS[i]!.maxDegree;
    for (let s = 0; s < ring.steps; s++) {
      const d = (((s - ring.offset) % ring.steps) + ring.steps) % ring.steps;
      const a = -Math.PI / 2 + (d / ring.steps) * TAU;
      const note = ring.notes[s]!;
      if (note < 0) {
        ctx.fillStyle = oklchCss(...starlight, 0.3);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * mid, Math.sin(a) * mid, 4, 0, TAU);
        ctx.fill();
        continue;
      }
      const rr = ring.engine === 'dust' ? mid : mid + (Math.min(note, max) / max - 0.5) * span;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      const size = ring.engine === 'dust' ? ([15, 12, 12, 8.5, 10, 9, 8, 13, 9.5][note] ?? 11) : 12.5;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 3.4);
      glow.addColorStop(0, rgbCss(col, 0.55));
      glow.addColorStop(1, rgbCss(col, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, size * 3.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgbCss(mixRgb(col, [1, 1, 1], 0.38));
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      ctx.fill();
    }
  });

  // Start pip at twelve o'clock, on the bezel.
  ctx.fillStyle = oklchCss(0.92, 0.15, 95);
  ctx.beginPath();
  ctx.moveTo(0, -bodyR + 2);
  ctx.lineTo(-10, -bodyR - 16);
  ctx.lineTo(10, -bodyR - 16);
  ctx.closePath();
  ctx.fill();

  // The sun: a dark well with a warm core, as when Rondo is playing.
  const wellR = 0.29 * k;
  ctx.fillStyle = oklchCss(0.18, 0.04, 262, 0.85);
  disc(wellR);
  ctx.fill();
  const coreR = 0.2 * k;
  const halo = ctx.createRadialGradient(0, 0, coreR * 0.35, 0, 0, wellR);
  halo.addColorStop(0, oklchCss(0.92, 0.15, 95, 0.55));
  halo.addColorStop(1, oklchCss(0.92, 0.15, 95, 0));
  ctx.fillStyle = halo;
  disc(wellR);
  ctx.fill();
  const sun = ctx.createRadialGradient(-coreR * 0.3, -coreR * 0.35, coreR * 0.1, 0, 0, coreR);
  sun.addColorStop(0, oklchCss(0.98, 0.07, 98));
  sun.addColorStop(0.6, oklchCss(0.92, 0.15, 95));
  sun.addColorStop(1, oklchCss(0.84, 0.16, 80));
  ctx.fillStyle = sun;
  disc(coreR * 0.62);
  ctx.fill();
  ctx.restore();
}

/** The RONDO wordmark (same geometry as Logo.astro), with the sun in the final O. */
const WORDMARK = {
  strokes: new Path2D(
    'M11 -10 V110 M0 11 H45 A27 27 0 0 1 45 65 H11 M44 62 L78 110 M186 50 A39 39 0 1 1 108 50 A39 39 0 1 1 186 50 M222 -10 V110 M286 -10 V110 M222 -10 L286 110 M322 -10 V110 M311 11 H345 A39 39 0 0 1 345 89 H311 M498 50 A39 39 0 1 1 420 50 A39 39 0 1 1 498 50',
  ),
};
function drawWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, height: number) {
  const s = height / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.rect(-2, 0, 513, 100);
  ctx.clip();
  ctx.lineWidth = 22;
  ctx.strokeStyle = ink;
  ctx.stroke(WORDMARK.strokes);
  ctx.fillStyle = oklchCss(0.87, 0.16, 90);
  ctx.beginPath();
  ctx.arc(459, 50, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawQr(ctx: CanvasRenderingContext2D, link: string, x: number, y: number, size: number) {
  const qr = qrFor(link);
  const n = qr.size;
  const m = size / n;
  ctx.save();
  ctx.fillStyle = ink;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      // Type 2 = finder pattern; drawn below as rings.
      if (!qr.data[r]![c] || qr.types[r]![c] === 2) continue;
      ctx.fillRect(x + c * m, y + r * m, m + 0.35, m + 0.35);
    }
  }
  // Finder patterns as the ring glyph: ring, gap, sun. Keeps the 1:1:3:1:1 ratio scanners look for.
  for (const [er, ec] of [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ] as const) {
    const cx = x + (ec + 3.5) * m;
    const cy = y + (er + 3.5) * m;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5 * m, 0, Math.PI * 2);
    ctx.arc(cx, cy, 2.5 * m, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5 * m, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCard(canvas: HTMLCanvasElement, d: CardData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const k = canvas.width / CARD_W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Sky: evening coming down over a gold horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, SKY_H);
  oklchStops(sky, [
    [0, 0.24, 0.05, 264],
    [0.56, 0.31, 0.07, 276],
    [0.8, 0.44, 0.1, 330],
    [0.92, 0.66, 0.14, 38],
    [1, 0.87, 0.1, 78],
  ]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CARD_W, SKY_H);
  const glow = ctx.createRadialGradient(CARD_W / 2, SKY_H + 120, 0, CARD_W / 2, SKY_H + 120, 820);
  glow.addColorStop(0, oklchCss(0.96, 0.1, 88, 0.85));
  glow.addColorStop(1, oklchCss(0.96, 0.1, 88, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, SKY_H);

  // "For Sam"
  const forLine = `For ${d.to || 'you'}`;
  const forSize = fit(ctx, forLine, 800, 118, 64, CARD_W - PAD * 2, 'expanded');
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${-forSize * 0.02}px`;
  ctx.fillStyle = oklchCss(...starlight);
  ctx.fillText(forLine, PAD, PAD + forSize * 0.78);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  drawScore(ctx, d.pattern, CARD_W / 2, 650, 336);

  // Paper
  ctx.fillStyle = oklchCss(1, 0, 0);
  ctx.fillRect(0, SKY_H, CARD_W, CARD_H - SKY_H);

  const p = d.pattern;
  const metaY = SKY_H + 100;
  const meta = `${KEYS[p.key] ?? ''} ${scaleById(p.scale).name} · ${p.bpm} bpm · rings of ${p.rings.map((r) => r.steps).join(', ')}`;
  font(ctx, 620, 30, 'condensed');
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1.4px';
  ctx.fillStyle = inkMute;
  ctx.fillText(meta, PAD, metaY);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  const title = p.name || 'Untitled loop';
  const titleSize = fit(ctx, title, 780, 84, 48, CARD_W - PAD * 2, 'expanded');
  const titleY = metaY + 26 + titleSize * 0.86;
  ctx.fillStyle = ink;
  ctx.fillText(title, PAD, titleY);

  // Footer geometry first: the message fits into whatever room is left above it.
  const qrSize = 250;
  const qrX = CARD_W - PAD - qrSize;
  const qrY = CARD_H - PAD - qrSize;
  const ruleY = qrY - 44;
  const top = titleY + 58;
  const floor = ruleY - 40;

  const message = d.message.trim() || 'I made this for you.';
  const layout = (size: number, lines: string[]) => {
    const lh = size * 1.36;
    const last = top + size + (lines.length - 1) * lh;
    const sig = d.from ? last + lh * 1.25 : last;
    return { lh, sig, bottom: sig + size * 0.28 };
  };
  let size = 46;
  let lines: string[] = [];
  for (; size >= 32; size -= 2) {
    font(ctx, 420, size);
    lines = wrap(ctx, message, CARD_W - PAD * 2);
    if (layout(size, lines).bottom <= floor) break;
  }
  size = Math.max(size, 32);
  while (lines.length > 1 && layout(size, lines).bottom > floor) {
    lines = lines.slice(0, -1);
    lines[lines.length - 1] = `${lines[lines.length - 1]!.replace(/\s*\S*$/, '')}…`;
  }
  const { lh, sig } = layout(size, lines);
  font(ctx, 420, size);
  ctx.fillStyle = ink;
  lines.forEach((line, i) => ctx.fillText(line, PAD, top + size + i * lh));
  if (d.from) {
    font(ctx, 680, size);
    ctx.fillText(`— ${d.from}`, PAD, sig);
  }

  // Footer: the promise, the wordmark and the code.
  ctx.strokeStyle = oklchCss(0.2, 0.03, 258, 0.14);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, ruleY);
  ctx.lineTo(CARD_W - PAD, ruleY);
  ctx.stroke();
  drawQr(ctx, d.link, qrX, qrY, qrSize);

  font(ctx, 720, 42, 'semi-expanded');
  ctx.fillStyle = ink;
  ctx.fillText('Scan the code to hear it.', PAD, qrY + 50);
  font(ctx, 420, 32);
  ctx.fillStyle = inkSoft;
  const promise = d.mention
    ? ['A Rondo to play it on arrives', `in ${PRODUCT.shipWindow}.`]
    : ['It plays in any browser,', 'no app or account needed.'];
  promise.forEach((line, i) => ctx.fillText(line, PAD, qrY + 104 + i * 44));
  drawWordmark(ctx, PAD, CARD_H - PAD - 34, 34);
}

let cardTimer = 0;
function scheduleCard(delay = 70) {
  window.clearTimeout(cardTimer);
  cardTimer = window.setTimeout(() => void renderCards(), delay);
}

function sizeCanvas(canvas: HTMLCanvasElement) {
  // Layout width, unaffected by the hero card's rotation.
  const w = canvas.clientWidth;
  if (!w) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(w * dpr);
  const height = Math.round((width * CARD_H) / CARD_W);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return true;
}

async function renderCards() {
  await fontsReady();
  const d = cardData();
  for (const canvas of $$<HTMLCanvasElement>('[data-card], [data-hero-card]')) {
    if (sizeCanvas(canvas)) drawCard(canvas, d);
  }
  const preview = $('[data-card]');
  preview?.setAttribute(
    'aria-label',
    `Gift card preview: for ${d.to || 'you'}, “${d.pattern.name}”, ${d.message.trim() ? `with the message “${d.message.trim()}”` : 'with a short default message'}${d.from ? `, from ${d.from}` : ''}, and a code that plays the loop.`,
  );
}

function initCards() {
  const ro = new ResizeObserver(() => scheduleCard(0));
  $$<HTMLCanvasElement>('[data-card], [data-hero-card]').forEach((c) => ro.observe(c));
  scheduleCard(0);
}

/* ── Gift finder ────────────────────────────────────────────────── */
type Who = 'partner' | 'parent' | 'musician' | 'kid' | 'me';
type Vibe = 'sunny' | 'warm' | 'quiet';
type Depth = 'simple' | 'extra' | 'all';
const answers: { who?: Who; vibe?: Vibe; depth?: Depth } = {};
const QUESTION_IDS = ['who', 'vibe', 'depth'] as const;

const FINISH_FOR: Record<Vibe, ColorwayId> = { sunny: 'noon', warm: 'ember', quiet: 'moon' };
const EXTRA_FOR: Record<Who, string> = { partner: 'sleeve', parent: 'dock', musician: 'midi', kid: 'sleeve', me: 'dock' };
const WHY: Record<string, string> = {
  noon: 'Anodised sky blue. It looks like a good day, even on a grey one.',
  ember: 'Sunset coral. Warm, a little bold, and impossible to lose in a bag.',
  moon: 'Raw, bead-blasted silver. Quiet, precise, and at home next to everything they own.',
};
const FOR_LINE: Record<Who, string> = {
  partner: 'For your partner',
  parent: 'For a parent',
  musician: 'For a friend who makes music',
  kid: 'For a curious kid',
  me: 'For you, obviously',
};
const TIP: Record<Who, string> = {
  partner: 'Engrave a date on the base. Nobody else needs to know what it means.',
  parent: 'The walnut dock keeps it charged on a shelf, which is exactly where it gets played.',
  musician: 'The MIDI pair plugs it straight into their setup. Rondo sends and follows clock.',
  kid: 'No screen, no account, no ads and no wrong notes. The sleeve survives a school bag.',
  me: `We won’t tell. The ${PRODUCT.trialNights}-night trial covers you too.`,
};

let quizStep = 0;

function showStep(i: number, focus = true) {
  quizStep = i;
  $$<HTMLElement>('[data-step]').forEach((el) => {
    const on = Number(el.dataset.step) === i;
    el.hidden = !on;
    if (on) {
      el.removeAttribute('data-enter');
      void el.offsetWidth;
      el.setAttribute('data-enter', '');
    }
  });
  $$<HTMLElement>('[data-dot]').forEach((dot) => {
    const n = Number(dot.dataset.dot);
    dot.dataset.state = n < i ? 'done' : n === i ? 'current' : '';
  });
  const count = $('[data-quiz-count]');
  if (count) count.textContent = `Question ${i + 1} of 3`;
  const back = $('[data-quiz-back]');
  if (back) back.hidden = i === 0;
  if (focus) $<HTMLElement>(`[data-step="${i}"] h3`)?.focus({ preventScroll: true });
}

function recommendedExtras(): string[] {
  const who = answers.who ?? 'partner';
  switch (answers.depth) {
    case 'extra':
      return [EXTRA_FOR[who]];
    case 'all':
      return who === 'kid' ? ['dock', 'sleeve'] : ADDONS.map((a) => a.id);
    default:
      return [];
  }
}

function selectedExtras(): string[] {
  return $$<HTMLInputElement>('[data-addon]')
    .filter((i) => i.checked)
    .map((i) => i.dataset.addon!);
}

/** Show a finish on the finder's Rondo (hovering a vibe previews it; answering keeps it). */
function showFinish(id: ColorwayId) {
  finderFace?.setFinish(id);
  const cw = COLORWAYS.find((c) => c.id === id);
  const caption = $('[data-finder-caption]');
  if (cw && caption) caption.textContent = `${cw.name} · ${cw.note}`;
}

let chosenFinish: ColorwayId = 'noon';

function setFinish(id: ColorwayId) {
  state.finish = id;
  chosenFinish = id;
  $$<HTMLElement>('[data-rec] [data-finish]').forEach((s) => {
    s.setAttribute('aria-checked', String(s.dataset.finish === id));
    s.tabIndex = s.dataset.finish === id ? 0 : -1;
  });
  showFinish(id);
  composerFace?.setFinish(id);
  syncRec();
}

function syncRec() {
  const cw = COLORWAYS.find((c) => c.id === state.finish) ?? COLORWAYS[0]!;
  const title = $('[data-rec-title]');
  if (title) title.textContent = `Rondo in ${cw.name}.`;
  const why = $('[data-rec-why]');
  if (why) why.textContent = WHY[cw.id] ?? cw.note;
  const extras = selectedExtras();
  const total = PRODUCT.price + extras.reduce((n, id) => n + (ADDONS.find((a) => a.id === id)?.price ?? 0), 0);
  // Before pre-orders open, the button goes where the phase CTA goes, and says so.
  const phase = currentPhase();
  const label = $('[data-rec-add-label]');
  if (label) {
    label.textContent =
      phase === 'signal' || phase === 'founders' ? PHASES[phase].cta.label : `Add to bag · ${formatPrice(total)}`;
  }
}

function showResult() {
  const who = answers.who ?? 'partner';
  const extras = recommendedExtras();
  $$<HTMLInputElement>('[data-addon]').forEach((i) => (i.checked = extras.includes(i.dataset.addon!)));
  const forLine = $('[data-rec-for]');
  if (forLine) forLine.textContent = FOR_LINE[who];
  const tip = $('[data-rec-tip]');
  if (tip) tip.textContent = TIP[who];
  setFinish(FINISH_FOR[answers.vibe ?? 'warm']);

  const quiz = $('[data-quiz]');
  const rec = $('[data-rec]');
  if (quiz) quiz.hidden = true;
  if (rec) rec.hidden = false;
  const finder = $('[data-finder]');
  if (finder) finder.dataset.state = 'result';
  $<HTMLElement>('[data-rec-title]')?.focus({ preventScroll: true });
  // Reveal the pick: on phones that means the Rondo itself, which only appears now.
  const narrow = matchMedia('(max-width: 860px)').matches;
  const target = narrow ? $('[data-finder-stage]') : finder;
  const top = target?.getBoundingClientRect().top ?? 0;
  if (target && (top < 0 || top > window.innerHeight * 0.55)) {
    target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  announce(`${$('[data-rec-title]')?.textContent ?? ''} ${$('[data-rec-add-label]')?.textContent ?? ''}`);
}

function initFinder() {
  $$<HTMLButtonElement>('[data-q]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const q = btn.dataset.q as (typeof QUESTION_IDS)[number];
      (answers as Record<string, string>)[q] = btn.dataset.a!;
      if (q === 'vibe') {
        chosenFinish = FINISH_FOR[btn.dataset.a as Vibe];
        showFinish(chosenFinish);
      }
      $$(`[data-q="${q}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      const i = QUESTION_IDS.indexOf(q);
      if (i < QUESTION_IDS.length - 1) showStep(i + 1);
      else showResult();
    }),
  );
  $('[data-quiz-back]')?.addEventListener('click', () => showStep(Math.max(0, quizStep - 1)));
  $('[data-quiz-restart]')?.addEventListener('click', () => {
    delete answers.who;
    delete answers.vibe;
    delete answers.depth;
    $$('[data-q]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    const quiz = $('[data-quiz]');
    const rec = $('[data-rec]');
    if (rec) rec.hidden = true;
    if (quiz) quiz.hidden = false;
    const finder = $('[data-finder]');
    if (finder) finder.dataset.state = 'quiz';
    showStep(0);
  });

  // Considering a vibe previews its finish on the Rondo beside the question.
  $$<HTMLButtonElement>('[data-q="vibe"]').forEach((btn) => {
    const finish = FINISH_FOR[btn.dataset.a as Vibe];
    const preview = () => showFinish(finish);
    const restore = () => showFinish(chosenFinish);
    btn.addEventListener('pointerenter', preview);
    btn.addEventListener('focus', preview);
    btn.addEventListener('pointerleave', restore);
    btn.addEventListener('blur', restore);
  });
  const swatches = $$<HTMLButtonElement>('[data-rec] [data-finish]');
  swatches.forEach((s, i) => {
    s.addEventListener('click', () => setFinish(s.dataset.finish as ColorwayId));
    s.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = swatches[(i + d + swatches.length) % swatches.length]!;
      setFinish(next.dataset.finish as ColorwayId);
      next.focus();
    });
  });
  $$<HTMLInputElement>('[data-addon]').forEach((i) => i.addEventListener('change', syncRec));

  $('[data-rec-add]')?.addEventListener('click', () => {
    const phase = currentPhase();
    if (phase === 'signal' || phase === 'founders') {
      location.href = url(PHASES[phase].cta.href);
      return;
    }
    const engraving = $<HTMLInputElement>('[data-engrave]')?.value.trim() || undefined;
    // The card, message and loop travel with the order so checkout can honour the gift promises.
    addToCart(
      rondoItem({
        colorway: state.finish,
        engraving,
        gift: { to: state.to.trim() || 'someone', from: state.from.trim(), message: state.message.trim(), loop: encodePattern(state.pattern) },
      }),
    );
    const extras = selectedExtras();
    extras.forEach((id) => {
      const item = addonItem(id);
      if (item) addToCart(item);
    });
    const cw = COLORWAYS.find((c) => c.id === state.finish)!;
    toast(
      `Rondo in ${cw.name}${extras.length ? ` and ${extras.length} extra${extras.length > 1 ? 's' : ''}` : ''} added to your bag`,
      { icon: 'bag' },
    );
    openBag();
  });
}

/* ── Delivery: be honest once the printed-card post has gone ─────── */
function initDelivery() {
  if (Date.now() <= Date.parse(DATES.giftCutoff)) return;
  const item = $('[data-cutoff]');
  if (item) item.dataset.state = 'past';
  const copy = $('[data-cutoff-copy]');
  if (copy) copy.textContent = 'The printed-card post has gone for this year. The email card still arrives the moment you order.';
}

/* ── Boot ───────────────────────────────────────────────────────── */
initFaces();
initComposer();
initCards();
initFinder();
initDelivery();
phaseStore.subscribe(() => syncRec(), false);
if (soundPref.get()) {
  // Preference remembered: build the engine on the first gesture anywhere.
  window.addEventListener('pointerdown', () => ensureEngine(), { once: true, capture: true });
}
if (import.meta.env.DEV) Object.assign(window, { __gift: { state, engine: () => engine, drawCard, cardData } });
