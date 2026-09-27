/**
 * Home: a day in the sky, from morning to night, with one object you can play.
 *
 * The WebGL stage sits behind the page. Each <section data-scene data-sky> declares a pose for
 * the instrument and a time of day; scroll position blends between them and a critically-damped
 * follower smooths the motion. The device is fully playable: tap rings, turn them, tap the sun.
 */
import { Raycaster, Vector2, Vector3 } from 'three';
import { RondoEngine } from '../audio/engine';
import { earn } from '../core/achievements';
import { addToCart, rondoItem } from '../core/cart';
import { openBag } from '../core/bag';
import { ensureSound, soundPref, uiTick } from '../core/sound';
import { toast } from '../core/toast';
import { InstrumentFace } from '../instrument/face';
import { SKIES, SKY_ORDER } from '../lib/skies';
import { url } from '@/lib/url';
import { ICONS } from '@/lib/icons';
import { COLORWAYS, PHASES, type ColorwayId } from '@/data/site';
import { currentPhase, phaseStore } from '../core/phase';
import { encodePattern } from '../seq/codec';
import { morningOrbit } from '../seq/generate';
import { clonePattern, lcm, notesFrom, drumsFrom, type EngineId, type Pattern } from '../seq/model';
import { presetById } from '../seq/presets';
import { CloudField } from '../three/clouds';
import { RondoDevice, type Finish } from '../three/device';
import { skyAt } from '../three/sky';
import { Stage, webglAvailable } from '../three/stage';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const base = import.meta.env.BASE_URL;

/* ── Shared musical state ───────────────────────────────────────── */
let pattern: Pattern = morningOrbit();
let engine: RondoEngine | null = null;
const listeners = new Set<() => void>();
const onMusic = (fn: () => void) => listeners.add(fn);
const emitMusic = () => listeners.forEach((l) => l());

function ensureEngine(): RondoEngine {
  if (!engine) {
    engine = new RondoEngine(pattern);
    engine.onState(() => emitMusic());
    engine.onChange((p) => {
      pattern = p;
      emitMusic();
    });
  }
  return engine;
}

async function play() {
  await ensureSound();
  earn('sound');
  await ensureEngine().start();
}

function stop() {
  engine?.stop();
}

const current = () => engine?.pattern ?? pattern;

function setMusic(p: Pattern) {
  pattern = p;
  if (engine) engine.setPattern(p, { keepPosition: false });
  emitMusic();
}

/* ── Hear it button + breathing headline ─────────────────────────── */
const hearBtn = $<HTMLButtonElement>('[data-hear]');
hearBtn?.addEventListener('click', async () => {
  if (engine?.playing) stop();
  else await play();
});
onMusic(() => {
  const playing = Boolean(engine?.playing);
  hearBtn?.setAttribute('aria-pressed', String(playing));
  const label = $('[data-hear-label]');
  const icon = $('[data-hear-icon]');
  if (label) label.textContent = playing ? 'Pause' : 'Hear it';
  if (icon) icon.innerHTML = playing ? ICONS.pause : ICONS.play;
});

/* ── Scenes & poses ─────────────────────────────────────────────── */
interface Pose {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rz: number;
  s: number;
  explode: number;
  spin: number;
  leds: number;
}

const P = (p: Partial<Pose>): Pose => ({ x: 0, y: 0, rx: 1, ry: 0, rz: 0, s: 1, explode: 0, spin: 0.06, leds: 1, ...p });

function poseFor(scene: string, narrow: boolean): Pose {
  if (narrow) {
    switch (scene) {
      case 'hero':
        return P({ y: 0.95, rx: 1.02, rz: 0.12, s: 0.74 });
      case 'manual':
        return P({ y: 0.95, rx: 1.5, s: 0.74, spin: 0 });
      case 'rings':
        return P({ y: -3.4, rx: 1.2, s: 0.5, explode: 0.3 });
      case 'voices':
        return P({ y: 2.4, rx: 0.4, ry: 0.4, s: 0.55 });
      case 'craft':
        return P({ y: 0.02, rx: 0.42, ry: -0.4, s: 0.5, explode: 1, spin: 0.03 });
      case 'promise':
        return P({ y: 2.6, rx: 1.2, s: 0.5, spin: 0.25 });
      case 'loops':
        return P({ y: 3.2, rx: 1.25, s: 0.5, leds: 1.4 });
      case 'offer':
        return P({ y: 0.95, rx: 1.15, s: 0.72, leds: 1.6 });
      default:
        return P({ y: 3.2, rx: 1.3, s: 0.45, leds: 1.2 });
    }
  }
  switch (scene) {
    case 'hero':
      return P({ x: 1.3, y: 0.02, rx: 0.95, ry: -0.2, rz: 0.2, s: 1.28 });
    case 'manual':
      return P({ x: 1.4, y: -0.05, rx: 1.5, s: 1.34, spin: 0 });
    case 'rings':
      // The SVG diagram carries this scene; the object steps out of the way.
      return P({ x: 1.6, y: -3.6, rx: 1.15, ry: -0.3, s: 0.6, explode: 0.35, spin: 0.2 });
    case 'voices':
      return P({ x: -1.75, y: -0.15, rx: 0.32, ry: 0.55, rz: -0.18, s: 1.12, spin: 0.05 });
    case 'craft':
      return P({ x: 1.2, y: -0.45, rx: 0.36, ry: -0.5, rz: 0.06, s: 0.92, explode: 1, spin: 0.035 });
    case 'promise':
      return P({ x: 2.1, y: 0.35, rx: 1.2, s: 0.58, spin: 0.25, leds: 1.2 });
    case 'loops':
      return P({ x: 2.1, y: 3.6, rx: 1.25, s: 0.6, leds: 1.4 });
    case 'offer':
      return P({ x: -1.45, y: -0.05, rx: 1.12, ry: 0.22, rz: -0.14, s: 1.3, leds: 1.6 });
    default:
      return P({ x: -1.45, y: 3.6, rx: 1.3, s: 0.6, leds: 1.2 });
  }
}

interface SceneAnchor {
  el: HTMLElement;
  name: string;
  sky: number;
  start: number;
  end: number;
}

let anchors: SceneAnchor[] = [];
function measure() {
  const vh = window.innerHeight;
  anchors = $$<HTMLElement>('[data-scene]').map((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    const h = el.offsetHeight;
    const tall = h > vh * 1.5;
    // Tall (sticky) scenes hold their pose while pinned; others peak at their centre.
    const start = tall ? top + vh * 0.5 : top + h / 2;
    const end = tall ? top + h - vh * 0.5 : top + h / 2;
    return { el, name: el.dataset.scene!, sky: Number(el.dataset.sky ?? 1), start, end };
  });
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Scroll → (sceneA, sceneB, t) and sky position. */
function sample(): { a: SceneAnchor; b: SceneAnchor; t: number; sky: number } {
  const focus = window.scrollY + window.innerHeight / 2;
  const first = anchors[0]!;
  if (focus <= first.start) return { a: first, b: first, t: 0, sky: first.sky };
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i]!;
    if (focus <= a.end) return { a, b: a, t: 0, sky: a.sky };
    const b = anchors[i + 1];
    if (!b) return { a, b: a, t: 0, sky: a.sky };
    if (focus < b.start) {
      const t = smooth((focus - a.end) / (b.start - a.end));
      return { a, b, t, sky: a.sky + (b.sky - a.sky) * t };
    }
  }
  const last = anchors[anchors.length - 1]!;
  return { a: last, b: last, t: 0, sky: last.sky };
}

/** Local progress (0–1) through a tall scene while it is pinned. */
function progressIn(name: string): number {
  const a = anchors.find((x) => x.name === name);
  if (!a) return 0;
  const focus = window.scrollY + window.innerHeight / 2;
  return Math.min(1, Math.max(0, (focus - a.start) / Math.max(1, a.end - a.start)));
}

/* ── Sky clock & theme ──────────────────────────────────────────── */
const CLOCK_MIN = SKY_ORDER.map((id) => {
  const [h, m] = SKIES[id].clock.split(':').map(Number);
  return h! * 60 + m!;
});
function updateClock(skyPos: number) {
  const i = Math.min(SKY_ORDER.length - 2, Math.floor(skyPos));
  const t = skyPos - i;
  const mins = Math.round(CLOCK_MIN[i]! + (CLOCK_MIN[i + 1]! - CLOCK_MIN[i]!) * t);
  const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  const time = $('[data-sky-time]');
  const label = $('[data-sky-label]');
  if (time) time.textContent = `${hh}:${mm}`;
  if (label) label.textContent = SKIES[SKY_ORDER[Math.round(skyPos)]!].label;
  const sun = $('[data-sky-sun]');
  if (sun) {
    const e = Math.sin((Math.min(skyPos, 5.5) / 5.5) * Math.PI);
    const x = 4 + (Math.min(skyPos, 5.5) / 5.5) * 16;
    sun.setAttribute('cx', x.toFixed(1));
    sun.setAttribute('cy', (17 - e * 10).toFixed(1));
  }
  const dark = skyPos > 4.75;
  document.body.dataset.dark = String(dark);
}

/* ── WebGL stage ────────────────────────────────────────────────── */
function initStage() {
  const canvas = $<HTMLCanvasElement>('[data-stage]');
  if (!canvas || !webglAvailable()) {
    document.documentElement.dataset.webgl = 'false';
    return null;
  }
  const stage = new Stage(canvas);
  const device = new RondoDevice('noon');
  const clouds = new CloudField(`${base}textures/`);
  stage.scene.add(clouds.group, device.group);
  device.syncPattern(current());
  onMusic(() => device.syncPattern(current()));

  const pose = P({});
  const target = P({});
  let spinAngle = 0;
  // First-load moment: the object descends into the morning and its rings light one by one.
  let intro = reduceMotion ? 1 : 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const narrowQuery = matchMedia('(max-width: 860px), (max-aspect-ratio: 1/1)');
  let first = true;

  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );

  stage.add(({ time, delta }) => {
    const { a, b, t, sky } = sample();
    const narrow = narrowQuery.matches;
    const pa = poseFor(a.name, narrow);
    const pb = poseFor(b.name, narrow);
    (Object.keys(target) as (keyof Pose)[]).forEach((k) => (target[k] = pa[k] + (pb[k] - pa[k]) * t));

    if (a.name === 'manual' && b.name === 'manual') followScroll(progressIn('manual'));
    pinned = t === 0 && a.name === b.name && (a.name === 'manual' || a.name === 'craft');

    // Craft: explode follows progress through the pinned scene
    if (a.name === 'craft' && b.name === 'craft') {
      const p = progressIn('craft');
      target.explode = Math.min(1, p * 1.8);
      const on = Math.min(5, Math.floor(p * 6.2));
      $$('[data-callout]').forEach((li, i) => {
        li.dataset.on = String(i <= on);
        li.dataset.current = String(i === on);
      });
    }

    // Critically damped follow (instant with reduced motion or on first frame)
    const k = reduceMotion || first ? 1 : 1 - Math.exp(-delta * 5.5);
    first = false;
    (Object.keys(pose) as (keyof Pose)[]).forEach((key) => (pose[key] += (target[key] - pose[key]) * k));
    pointer.x += (pointer.tx - pointer.x) * (reduceMotion ? 1 : 0.06);
    pointer.y += (pointer.ty - pointer.y) * (reduceMotion ? 1 : 0.06);

    if (!reduceMotion) spinAngle += pose.spin * delta;
    intro = Math.min(1, intro + delta / 1.8);
    const ie = 1 - Math.pow(1 - intro, 3);
    const g = device.group;
    g.position.set(pose.x, pose.y + (reduceMotion ? 0 : Math.sin(time * 0.6) * 0.03) + (1 - ie) * 1.4, 0);
    g.scale.setScalar(pose.s * (0.86 + 0.14 * ie));
    g.rotation.set(pose.rx + pointer.y * 0.08 + tiltVisual * 0.35, pose.ry + pointer.x * 0.12, pose.rz, 'XYZ');
    g.rotateY(spinAngle);
    device.setExplode(pose.explode);
    // LEDs compete with daylight: push them a little harder under a bright sky.
    const led = pose.leds * (1.35 - stage.sky.dark * 0.35);
    if (intro < 1) device.leds.forEach((l, i) => (l.mesh.material.uniforms.uIntensity!.value = led * Math.min(1, Math.max(0, (intro - 0.35 - (3 - i) * 0.1) / 0.18))));
    else device.setLedIntensity(led);

    // Playback → LEDs and sun
    const e = engine;
    const now = e?.ctx.currentTime ?? 0;
    const hits = e?.playing ? e.recentHits(0.35).map((h) => ({ ring: h.ring, slot: h.slot, age: now - h.time })) : [];
    device.syncPlayback(e?.stepFloat() ?? 0, Boolean(e?.playing), hits, current());
    const level = e?.playing ? e.level() : 0;
    // The sun always glows a little, so "tap the sun" has something to point at.
    device.setSunGlow(e?.playing ? 0.45 + level * 0.55 : 0.22 + Math.sin(time * 1.7) * 0.07 + stage.sky.dark * 0.08);
    breathe(level);

    // Sky
    skyAt(sky, stage.sky);
    stage.scroll = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    clouds.update(time, stage.scroll, pointer, stage.sky);
    stage.applySky(time);
    updateClock(sky);
  });

  measure();
  stage.applySky(0);
  stage.bakeEnvironment(true);
  stage.start();
  window.addEventListener('resize', () => measure(), { passive: true });
  new ResizeObserver(() => measure()).observe(document.body);
  return { stage, device };
}

/* ── Breathing type ─────────────────────────────────────────────── */
const breatheEl = $('[data-breathe]');
let breatheLevel = 0;
function breathe(level: number) {
  if (!breatheEl || reduceMotion) return;
  breatheLevel += (level - breatheLevel) * 0.25;
  breatheEl.style.setProperty('--breathe', breatheLevel.toFixed(3));
}

/* ── Direct manipulation of the 3D instrument ───────────────────── */
let tiltVisual = 0;
const manual = { step: 0, done: [false, false, false] };

function initDeviceInteraction(ctx: { stage: Stage; device: RondoDevice }) {
  const { stage, device } = ctx;
  const canvas = stage.canvas;
  canvas.style.touchAction = 'pan-y';
  const ray = new Raycaster();
  const ndc = new Vector2();
  const centre = new Vector3();
  let drag: { ring: number; slot: number; startAngle: number; startOffset: number; moved: boolean; id: number } | null = null;
  let hintShown = false;

  const pick = (e: PointerEvent) => {
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, stage.camera);
    return device.pick(ray, current());
  };
  const screenAngle = (e: PointerEvent) => {
    device.centre(centre).project(stage.camera);
    const cx = (centre.x * 0.5 + 0.5) * window.innerWidth;
    const cy = (-centre.y * 0.5 + 0.5) * window.innerHeight;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  };

  canvas.addEventListener('pointermove', (e) => {
    if (drag && drag.id === e.pointerId) {
      const ring = current().rings[drag.ring]!;
      let delta = screenAngle(e) - drag.startAngle;
      delta = ((delta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      const stepsMoved = Math.round((delta / (Math.PI * 2)) * ring.steps);
      if (Math.abs(delta) > 0.05) drag.moved = true;
      const next = (((drag.startOffset - stepsMoved) % ring.steps) + ring.steps) % ring.steps;
      if (next !== ring.offset) {
        ring.offset = next;
        uiTick(1 + drag.ring * 0.15);
        if (navigator.vibrate) navigator.vibrate(4);
        engine?.update();
        device.syncPattern(current());
        onEdit('rotate');
      }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const hit = pick(e);
    canvas.style.cursor = hit ? 'pointer' : 'default';
    if (hit && hit !== 'sun') device.setHover(hit.ring, hit.slot);
    else device.setHover(-1, -1);
  });

  canvas.addEventListener('pointerdown', (e) => {
    const hit = pick(e);
    if (!hit) return;
    const hint = $('[data-device-hint]');
    if (hint) hint.hidden = true;
    hintShown = true;
    if (e.pointerType === 'touch' && manual.step === 2) void enableOrientationTilt();
    if (!soundPref.get()) void ensureSound().then(() => earn('sound'));
    if (hit === 'sun') {
      if (engine?.playing) stop();
      else void play();
      return;
    }
    ensureEngine();
    canvas.setPointerCapture(e.pointerId);
    drag = { ring: hit.ring, slot: hit.slot, startAngle: screenAngle(e), startOffset: current().rings[hit.ring]!.offset, moved: false, id: e.pointerId };
  });

  const end = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    if (d.moved) return;
    const ring = current().rings[d.ring]!;
    const was = ring.notes[d.slot]!;
    if (was >= 0) ring.notes[d.slot] = -1;
    else {
      const dd = ((d.slot - ring.offset) % ring.steps + ring.steps) % ring.steps;
      ring.notes[d.slot] = ring.engine === 'dust' ? (dd % 4 === 0 ? 0 : 3) : d.ring === 3 ? 6 : 0;
      if (!engine?.playing) engine?.audition(d.ring, ring.notes[d.slot]!);
    }
    engine?.update();
    device.syncPattern(current());
    onEdit(was >= 0 ? 'remove' : 'add');
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', () => (drag = null));

  $$<HTMLButtonElement>('[data-show-move]').forEach((b) =>
    b.addEventListener('click', () => showMove(Number(b.dataset.showMove), device)),
  );

  // Show the hint once the hero has settled
  window.setTimeout(() => {
    const hint = $('[data-device-hint]');
    if (hint && !hintShown && window.scrollY < 100) {
      hint.hidden = false;
      hintShown = true;
      window.setTimeout(() => (hint.hidden = true), 6000);
    }
  }, 2600);

  // Tilt: vertical pointer position opens the filter while the manual's third move is active,
  // or device orientation on phones.
  window.addEventListener(
    'pointermove',
    (e) => {
      if (manual.step !== 2 || manual.done[2]) return;
      const y = 1 - (e.clientY / window.innerHeight) * 2;
      tiltVisual = -y;
      engine?.setTilt(0, y);
      tiltTravel = Math.max(tiltTravel, Math.abs(y - (tiltStart ?? y)));
      if (tiltStart === null) tiltStart = y;
      if (tiltTravel > 0.8) completeMove(2);
    },
    { passive: true },
  );
}

let tiltStart: number | null = null;
let tiltTravel = 0;
/** True while a pinned (sticky) scene fills the screen: the buy bar steps aside. */
let pinned = false;

/** On phones, the phone is the Rondo: tilting it opens the filter (move three). */
let orientationOn = false;
async function enableOrientationTilt() {
  if (orientationOn || !('DeviceOrientationEvent' in window)) return;
  const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> };
  try {
    if (DOE.requestPermission && (await DOE.requestPermission()) !== 'granted') return;
  } catch {
    return;
  }
  orientationOn = true;
  let base: number | null = null;
  window.addEventListener('deviceorientation', (e) => {
    if (manual.step !== 2 || manual.done[2] || e.beta === null) return;
    base ??= e.beta;
    const y = Math.max(-1, Math.min(1, (base - e.beta) / 35));
    tiltVisual = -y;
    engine?.setTilt(0, y);
    tiltTravel = Math.max(tiltTravel, Math.abs(y));
    if (tiltTravel > 0.6) completeMove(2);
  });
}

/* ── The three moves ────────────────────────────────────────────── */
let userNotes = 0;

function onEdit(kind: 'add' | 'remove' | 'rotate') {
  if (kind === 'add') userNotes++;
  if (userNotes > 0) {
    const lead = $('[data-proof-played]');
    const text = $('[data-proof-played-text]');
    if (lead) lead.textContent = 'You just played it.';
    if (text)
      text.textContent = `You placed ${userNotes} note${userNotes === 1 ? '' : 's'} on this page. That was the real sound engine, and the instrument plays it exactly the same.`;
  }
  if (kind === 'add') {
    earn('note');
    completeMove(0);
  }
  if (kind === 'rotate') {
    earn('spin');
    if (manual.done[0] || manual.step >= 1) completeMove(1);
  }
  const keep = $<HTMLAnchorElement>('[data-keep-loop]');
  if (keep) keep.href = `${url('/play/')}#l=${encodePattern(current())}`;
  if (userNotes >= 6 && kind === 'add') earn('loop');
}

/** Which move the scroll position points at; finished moves stay finished either way. */
let scrollStep = 0;

/** The active move: the first unfinished one at or after the scroll position, else any unfinished one. */
function pickStep() {
  const after = manual.done.findIndex((d, i) => !d && i >= scrollStep);
  const any = manual.done.findIndex((d) => !d);
  manual.step = after !== -1 ? after : any === -1 ? 3 : any;
}

function renderMoves() {
  $$('[data-move]').forEach((li, i) => li.setAttribute('data-state', manual.done[i] ? 'done' : i === manual.step ? 'active' : ''));
}

/** Scrolling through the pinned section moves the lesson on, even without touching anything. */
function followScroll(progress: number) {
  const byScroll = Math.min(2, Math.floor(progress * 3));
  if (byScroll === scrollStep) return;
  scrollStep = byScroll;
  pickStep();
  renderMoves();
}

/** "Show me": perform the move on the instrument (also the keyboard path through the lesson). */
function showMove(i: number, device: RondoDevice | null) {
  const p = current();
  if (i === 0) {
    const ring = p.rings[0]!;
    const empty = [...Array(ring.steps).keys()].find((s) => ring.notes[s]! < 0 && s % 2 === 1);
    if (empty !== undefined) {
      ring.notes[empty] = 3;
      engine?.update();
      device?.syncPattern(p);
      device?.setHover(0, empty);
      window.setTimeout(() => device?.setHover(-1, -1), 900);
      if (soundPref.get()) {
        ensureEngine();
        engine?.audition(0, 3);
      }
      onEdit('add');
    }
    completeMove(0);
  } else if (i === 1) {
    const ring = p.rings[3]!;
    let n = 0;
    const tick = () => {
      ring.offset = (ring.offset + ring.steps - 1) % ring.steps;
      engine?.update();
      device?.syncPattern(p);
      uiTick(1.45);
      if (++n < 3) window.setTimeout(tick, 160);
    };
    tick();
    onEdit('rotate');
    completeMove(1);
  } else {
    const t0 = performance.now();
    const sweep = (now: number) => {
      const k = Math.min(1, (now - t0) / 1400);
      const y = Math.sin(k * Math.PI * 2) * (1 - k * 0.3);
      tiltVisual = -y * 0.8;
      engine?.setTilt(0, y);
      if (k < 1) requestAnimationFrame(sweep);
      else {
        tiltVisual = 0;
        engine?.setTilt(0, 1);
        completeMove(2);
      }
    };
    requestAnimationFrame(sweep);
  }
}

function completeMove(i: number) {
  if (manual.done[i]) return;
  manual.done[i] = true;
  const next = manual.done.findIndex((d) => !d);
  pickStep();
  renderMoves();
  const moves = $$('[data-move]');
  if (manual.step === 2 && matchMedia('(pointer: coarse)').matches) {
    const tryEl = moves[2]?.querySelector('[data-try]');
    if (tryEl) tryEl.textContent = 'Tap the Rondo, then tilt your phone →';
  }
  if (i === 2) {
    tiltVisual = 0;
    engine?.setTilt(0, 1);
  }
  if (next === -1) {
    const done = $('[data-manual-done]');
    if (done) done.hidden = false;
    const keep = $<HTMLAnchorElement>('[data-keep-loop]');
    if (keep) keep.href = `${url('/play/')}#l=${encodePattern(current())}`;
  }
}

/* ── Polymeter diagram ──────────────────────────────────────────── */
function initOrbits() {
  const svg = $<SVGSVGElement>('[data-orbits]');
  if (!svg) return;
  const steps = [16, 12, 8, 7];
  const radii = [180, 138, 96, 56];
  const colors = ['var(--ember)', 'var(--sunlit)', 'var(--tide)', 'var(--lilac)'];
  const hitsFor = (n: number, i: number) => {
    const p = presetById('morning-orbit')!.pattern.rings[i]!;
    return Array.from({ length: n }, (_, s) => (s < p.steps ? p.notes[s]! >= 0 : s % 3 === 0));
  };

  const render = () => {
    svg.innerHTML = steps
      .map((n, i) => {
        const r = radii[i]!;
        const hits = hitsFor(n, i);
        const dots = Array.from({ length: n }, (_, s) => {
          const a = (s / n) * Math.PI * 2 - Math.PI / 2;
          const on = hits[s];
          return `<circle cx="${(Math.cos(a) * r).toFixed(1)}" cy="${(Math.sin(a) * r).toFixed(1)}" r="${on ? 6.5 : 2.6}" fill="${on ? colors[i] : 'var(--ink)'}" ${on ? 'stroke="var(--ink)" stroke-width="1.5"' : 'fill-opacity="0.45"'} />`;
        }).join('');
        return `<g data-orbit="${i}"><circle r="${r}" fill="none" stroke="var(--ink)" stroke-opacity="0.22" stroke-width="1.5"/>${dots}<line data-hand="${i}" x1="0" y1="${-r + 14}" x2="0" y2="${-r - 14}" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/></g>`;
      })
      .join('') + '<circle r="26" fill="var(--ink)"/><circle r="9" fill="var(--sun)"/>';
  };
  render();

  // Sweeping hands: all rings share a step clock, so shorter rings lap faster.
  let raf = 0;
  let visible = false;
  const t0 = performance.now();
  const stepMs = 60000 / 92 / 4;
  const tick = (now: number) => {
    raf = 0;
    if (!visible) return;
    const g = (now - t0) / stepMs;
    steps.forEach((n, i) => {
      const hand = svg.querySelector<SVGLineElement>(`[data-hand="${i}"]`);
      if (hand) hand.setAttribute('transform', `rotate(${(((g % n) / n) * 360).toFixed(2)})`);
    });
    if (!reduceMotion) raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => {
    visible = Boolean(e?.isIntersecting);
    if (visible && !raf) raf = requestAnimationFrame(tick);
  }).observe(svg);

  $$<HTMLButtonElement>('[data-spark-steps] [data-n]').forEach((b) =>
    b.addEventListener('click', () => {
      const n = Number(b.dataset.n);
      steps[3] = n;
      $$('[data-spark-steps] [data-n]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      const total = [16, 12, 8, n].reduce((a2, b2) => lcm(a2, b2), 1);
      const lcmEl = $('[data-lcm]');
      const barsEl = $('[data-bars]');
      if (lcmEl) lcmEl.textContent = String(total);
      if (barsEl) barsEl.textContent = String(Math.round((total / 16) * 10) / 10);
      const label = $('[data-spark-label]');
      if (label) label.textContent = `Spark · ${n}`;
      render();
      uiTick(1.2);
      // Keep the playable loop in sync with the diagram
      const p = current();
      p.rings[3]!.steps = n;
      p.rings[3]!.offset = 0;
      engine?.update();
      emitMusic();
    }),
  );
}

/* ── Voices: audition each engine ───────────────────────────────── */
function voiceDemo(id: EngineId): Pattern {
  const p = clonePattern(morningOrbit());
  p.rings.forEach((r) => (r.mute = true));
  const set = (i: number, engineId: EngineId, steps: number, notes: number[]) => {
    const r = p.rings[i]!;
    r.mute = false;
    r.engine = engineId;
    r.steps = steps;
    r.notes = notes;
    r.offset = 0;
    r.volume = 0.85;
  };
  switch (id) {
    case 'dust':
      set(0, 'dust', 16, drumsFrom('k.h.s.hzk.hks.ho'));
      break;
    case 'sub':
      set(1, 'sub', 16, notesFrom('0..0..3.4..4..6.'));
      break;
    case 'tape':
      set(2, 'tape', 16, notesFrom('0.......5.......'));
      break;
    case 'pluck':
      set(3, 'pluck', 8, notesFrom('4.6.7.9.'));
      break;
    case 'glass':
      set(3, 'glass', 7, notesFrom('9.7.b.8'));
      break;
  }
  p.name = `${id} demo`;
  return p;
}

function initVoices() {
  const buttons = $$<HTMLButtonElement>('[data-voice]');
  let active: HTMLButtonElement | null = null;
  let saved: Pattern | null = null;
  let raf = 0;

  const drawScope = () => {
    raf = 0;
    if (!active || !engine?.playing) return;
    const canvas = active.querySelector<HTMLCanvasElement>('canvas');
    if (canvas) {
      const g = canvas.getContext('2d')!;
      const data = new Float32Array(engine.analyser.fftSize);
      engine.analyser.getFloatTimeDomainData(data);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.strokeStyle = 'oklch(0.2 0.03 258)';
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < canvas.width; i++) {
        const v = data[Math.floor((i / canvas.width) * data.length)]!;
        const y = canvas.height / 2 - v * canvas.height * 1.4;
        if (i === 0) g.moveTo(i, y);
        else g.lineTo(i, y);
      }
      g.stroke();
    }
    raf = requestAnimationFrame(drawScope);
  };

  buttons.forEach((b) =>
    b.addEventListener('click', async () => {
      if (active === b) {
        b.setAttribute('aria-pressed', 'false');
        active = null;
        stop();
        if (saved) setMusic(saved);
        saved = null;
        return;
      }
      active?.setAttribute('aria-pressed', 'false');
      active = b;
      b.setAttribute('aria-pressed', 'true');
      if (!saved) saved = current();
      setMusic(voiceDemo(b.dataset.voice as EngineId));
      await play();
      if (!raf) raf = requestAnimationFrame(drawScope);
    }),
  );
  onMusic(() => {
    if (!engine?.playing && active) {
      active.setAttribute('aria-pressed', 'false');
      active = null;
    }
  });
}

/* ── Loop rail ──────────────────────────────────────────────────── */
function initLoops() {
  const cards = $$<HTMLButtonElement>('[data-loop]');
  const faces = new Map<HTMLButtonElement, InstrumentFace>();
  cards.forEach((card) => {
    const preset = presetById(card.dataset.loop!);
    const canvas = card.querySelector<HTMLCanvasElement>('canvas');
    if (!preset || !canvas) return;
    const face = new InstrumentFace(canvas, {
      pattern: clonePattern(preset.pattern),
      finish: preset.finish,
    });
    faces.set(card, face);
    card.addEventListener('click', async () => {
      const wasActive = card.getAttribute('aria-pressed') === 'true';
      cards.forEach((c) => {
        c.setAttribute('aria-pressed', 'false');
        faces.get(c)?.setEngine(null);
      });
      if (wasActive) {
        stop();
        return;
      }
      card.setAttribute('aria-pressed', 'true');
      setMusic(clonePattern(preset.pattern));
      await play();
      face.setEngine(engine);
    });
  });
}

/* ── Offer & buy bar ────────────────────────────────────────────── */
function initOffer(device: RondoDevice | null) {
  let finish: ColorwayId = 'noon';
  const swatches = $$<HTMLButtonElement>('[data-finish]');
  const label = $('[data-add-label]');
  const sync = () => {
    const cw = COLORWAYS.find((c) => c.id === finish)!;
    const name = $('[data-finish-name]');
    if (name) name.textContent = `${cw.name} · ${cw.note}`;
    const phase = currentPhase();
    // Before launch the offer can't be bought: say what it actually does.
    if (label) label.textContent = phase === 'signal' || phase === 'founders' ? PHASES[phase].cta.label : `${phase === 'orbit' ? 'Buy' : 'Pre-order'} ${cw.name} ${cw.word}`;
    const bf = $('[data-buybar-finish]');
    if (bf) bf.textContent = `${cw.name} ${cw.word}`;
    const sw = $('[data-buybar-swatch]');
    if (sw) sw.style.background = cw.swatch;
  };
  swatches.forEach((s) =>
    s.addEventListener('click', () => {
      finish = s.dataset.finish as ColorwayId;
      swatches.forEach((x) => x.setAttribute('aria-checked', String(x === s)));
      device?.setFinish(finish as Finish);
      uiTick(0.9);
      sync();
    }),
  );
  $('[data-add-rondo]')?.addEventListener('click', () => {
    const phase = currentPhase();
    if (phase === 'signal' || phase === 'founders') {
      location.href = url(PHASES[phase].cta.href);
      return;
    }
    const cw = COLORWAYS.find((c) => c.id === finish)!;
    addToCart(rondoItem({ colorway: finish }));
    toast(`Rondo in ${cw.name} ${cw.word} added`, { icon: 'bag' });
    openBag();
  });
  sync();
  phaseStore.subscribe(sync, false);

  // Buy bar: after the hero CTA leaves, until the offer card arrives.
  const bar = $('[data-buybar]');
  const heroCta = $('.hero [data-cta]');
  const offer = $('[data-offer]');
  if (bar && heroCta && offer) {
    let heroGone = false;
    let offerIn = false;
    const apply = () => {
      const visible = heroGone && !offerIn && !pinned;
      bar.dataset.visible = String(visible);
      // Off-screen, it shouldn't be reachable by Tab either.
      bar.inert = !visible;
    };
    window.addEventListener('scroll', () => requestAnimationFrame(apply), { passive: true });
    new IntersectionObserver(([e]) => {
      heroGone = !e!.isIntersecting && e!.boundingClientRect.top < 0;
      apply();
    }).observe(heroCta);
    new IntersectionObserver(([e]) => {
      offerIn = e!.isIntersecting || e!.boundingClientRect.top < 0;
      apply();
    }).observe(offer);
    const faq = $('.faq-section');
    if (faq)
      new IntersectionObserver(([e]) => {
        if (e!.isIntersecting) earn('night');
      }).observe(faq);
  }
}

/* ── Boot ───────────────────────────────────────────────────────── */
function boot() {
  const ctx = initStage();
  if (ctx) initDeviceInteraction(ctx);
  else measure();
  initOrbits();
  initVoices();
  initLoops();
  initOffer(ctx?.device ?? null);
  if (!ctx) {
    window.addEventListener('scroll', () => updateClock(sample().sky), { passive: true });
    updateClock(sample().sky);
  }
  if (import.meta.env.DEV) Object.assign(window, { __home: { ctx, engine: () => engine, current } });
}

// Don't spin up WebGL for a prerendered page until it's actually shown.
if ((document as Document & { prerendering?: boolean }).prerendering) {
  document.addEventListener('prerenderingchange', boot, { once: true });
} else {
  boot();
}

