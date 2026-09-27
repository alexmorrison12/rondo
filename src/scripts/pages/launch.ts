/** Launch landing page: 3D hero, a playable Rondo, and a focused path to pre-order. */
import { RondoEngine } from '../audio/engine';
import { earn } from '../core/achievements';
import { ensureSound } from '../core/sound';
import { toast } from '../core/toast';
import { InstrumentFace } from '../instrument/face';
import { generatePattern, moodToPattern, morningOrbit } from '../seq/generate';
import { clonePattern, noteCount, type Pattern } from '../seq/model';
import { PRESETS } from '../seq/presets';
import { scaleById } from '../seq/scales';
import { CloudField } from '../three/clouds';
import { RondoDevice } from '../three/device';
import { skyAt } from '../three/sky';
import { Stage, webglAvailable } from '../three/stage';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Hero stage ─────────────────────────────────────────────────── */
function initHero() {
  const canvas = $<HTMLCanvasElement>('[data-lstage]');
  if (!canvas || !webglAvailable()) return;
  const stage = new Stage(canvas);
  const device = new RondoDevice('noon');
  const pattern = morningOrbit();
  device.syncPattern(pattern);
  const clouds = new CloudField(`${import.meta.env.BASE_URL}textures/`, 8);
  stage.scene.add(clouds.group, device.group);
  skyAt(2.1, stage.sky);
  const pointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  let spin = 0;
  stage.add(({ time, delta }) => {
    const narrow = canvas.clientWidth < 860;
    if (!reduceMotion) spin += delta * 0.1;
    const g = device.group;
    g.position.set(narrow ? 0 : 1.62, narrow ? 0.95 : 0.15 + Math.sin(time * 0.6) * 0.03, 0);
    g.scale.setScalar(narrow ? 0.72 : 1.1);
    g.rotation.set(0.98 + pointer.y * 0.06, pointer.x * 0.1 - 0.2, 0.18, 'XYZ');
    g.rotateY(spin);
    device.syncPlayback(time * 6, true, [], pattern);
    device.setLedIntensity(1.3);
    device.setSunGlow(0.2);
    clouds.update(time, 0, pointer, stage.sky);
    stage.applySky(time);
  });
  stage.applySky(0);
  stage.bakeEnvironment(true);
  stage.start();
}

/* ── Playable face ──────────────────────────────────────────────── */
let engine: RondoEngine | null = null;
let pattern: Pattern = morningOrbit();
let edits = 0;
const canvas = $<HTMLCanvasElement>('[data-try-face]')!;

const face = new InstrumentFace(canvas, {
  pattern,
  interactive: true,
  onPointerDown: () => {
    void ensureSound().then(() => earn('sound'));
    ensure();
  },
  onEdit: (e) => {
    edits++;
    if (e.type === 'add') earn('note');
    if (e.type === 'rotate') earn('spin');
    if (noteCount(current()) >= 8 && edits > 2) earn('loop');
    if (edits >= 3) nudge();
  },
  onToggle: () => void toggle(),
});

function current() {
  return engine?.pattern ?? pattern;
}

function ensure(): RondoEngine {
  if (!engine) {
    engine = new RondoEngine(pattern);
    face.setEngine(engine);
  }
  return engine;
}

async function toggle() {
  await ensureSound();
  earn('sound');
  const e = ensure();
  await e.toggle();
  if (e.playing) window.setTimeout(nudge, 12000);
}

async function load(p: Pattern, label: string) {
  pattern = p;
  face.setPattern(p);
  if (engine) engine.setPattern(p);
  await ensureSound();
  const e = ensure();
  if (!e.playing) await e.start();
  toast(label, { icon: 'wand' });
  window.setTimeout(nudge, 8000);
}

function nudge() {
  const n = $('[data-nudge]');
  if (n) n.hidden = false;
}

document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach((b) =>
  b.addEventListener('click', () => {
    const p = moodToPattern(b.textContent ?? '');
    void load(p, `“${p.name}”: ${scaleById(p.scale).name}, ${p.bpm} bpm`);
  }),
);
$('[data-roll]')?.addEventListener('click', () => {
  const p = generatePattern((Math.random() * 2 ** 32) >>> 0);
  void load(p, `Rolled a ${scaleById(p.scale).name.toLowerCase()} loop`);
});

/* ── Reason thumbnails ──────────────────────────────────────────── */
document.querySelectorAll<HTMLCanvasElement>('[data-reason-face]').forEach((c, i) => {
  const preset = PRESETS[(i * 3 + 2) % PRESETS.length]!;
  new InstrumentFace(c, { pattern: clonePattern(preset.pattern), finish: c.dataset.reasonFace as 'noon' | 'ember' | 'moon' });
});

/* ── Mobile sticky bar ──────────────────────────────────────────── */
const bar = $('[data-lbar]');
const heroCta = $('.lhero [data-cta]');
if (bar && heroCta) {
  new IntersectionObserver(([e]) => {
    bar.dataset.visible = String(!e!.isIntersecting && e!.boundingClientRect.top < 0);
  }).observe(heroCta);
}

initHero();
