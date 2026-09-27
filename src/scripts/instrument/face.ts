/**
 * The Rondo face, top-down, on a 2D canvas. Used by the web instrument, the gallery and
 * the landing pages. Turned-metal rings are conic gradients whose highlights follow the
 * pointer (like tilting a real object under a lamp); LEDs are additive glows.
 *
 * Interaction (when `interactive`):
 *  - tap a slot            → place / remove a note
 *  - drag outward/inward   → raise / lower the note (drum ring: change voice)
 *  - drag around the ring  → turn the ring (shift the groove), with detent ticks
 *  - tap the sun           → play / stop
 *  - keyboard: ←/→ step, ↑/↓ ring, Enter toggle, +/− pitch, [ ] turn, Space play
 */
import type { RondoEngine } from '../audio/engine';
import { uiTick } from '../core/sound';
import { FINISH_OKLCH, RING_OKLCH, mixRgb, oklchToSrgb, rgbCss, type RGB } from '../lib/color';
import { DRUM_VOICES, RINGS, type Pattern } from '../seq/model';

export interface EditEvent {
  type: 'add' | 'remove' | 'pitch' | 'rotate';
  ring: number;
  slot: number;
  value: number;
}

export interface FaceOptions {
  pattern: Pattern;
  engine?: RondoEngine | null;
  finish?: keyof typeof FINISH_OKLCH;
  interactive?: boolean;
  /** Earliest user gesture on the instrument (use it to wake audio). */
  onPointerDown?: () => void;
  /** Called before any edit is applied (for undo history). */
  onBeforeEdit?: () => void;
  onEdit?: (e: EditEvent) => void;
  onToggle?: () => void;
  onAnnounce?: (msg: string) => void;
  /** Keep animating while idle (default true). */
  animate?: boolean;
  /** CSS touch-action for interactive faces: 'none' (default, best for a full-screen instrument) or 'pan-y' to let the page scroll. */
  touchAction?: string;
  /** Draw the play/pause mark in the sun (default: when interactive). */
  playGlyph?: boolean;
}

export const BANDS = [
  { outer: 0.935, inner: 0.77 },
  { outer: 0.75, inner: 0.605 },
  { outer: 0.585, inner: 0.46 },
  { outer: 0.44, inner: 0.32 },
];
const SUN_R = 0.275;
const TAU = Math.PI * 2;

const ringRgb: RGB[] = RING_OKLCH.map(([l, c, h]) => oklchToSrgb(l, c, h));

function glowSprite(rgb: RGB): HTMLCanvasElement {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, rgbCss(mixRgb(rgb, [1, 1, 1], 0.55), 1));
  grad.addColorStop(0.18, rgbCss(rgb, 0.9));
  grad.addColorStop(0.45, rgbCss(rgb, 0.28));
  grad.addColorStop(1, rgbCss(rgb, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

export class InstrumentFace {
  readonly canvas: HTMLCanvasElement;
  pattern: Pattern;
  engine: RondoEngine | null;
  finish: keyof typeof FINISH_OKLCH;
  /** Ring currently focused by keyboard / last touched. */
  cursor = { ring: 0, slot: 0, visible: false };

  private ctx: CanvasRenderingContext2D;
  private opts: FaceOptions;
  private size = 0;
  private dpr = 1;
  private light = -Math.PI * 0.75;
  private lightTarget = this.light;
  private staticLayer: HTMLCanvasElement;
  private staticKey = '';
  private sprites: HTMLCanvasElement[];
  private raf = 0;
  private visible = true;
  private hover: { ring: number; slot: number } | null = null;
  private drag: {
    ring: number;
    slot: number;
    startX: number;
    startY: number;
    startAngle: number;
    startOffset: number;
    startNote: number;
    mode: 'none' | 'pitch' | 'rotate' | 'sun';
    pointerId: number;
    moved: boolean;
  } | null = null;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private flash = new Map<string, number>();
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, opts: FaceOptions) {
    this.canvas = canvas;
    this.opts = opts;
    this.pattern = opts.pattern;
    this.engine = opts.engine ?? null;
    this.finish = opts.finish ?? 'noon';
    this.ctx = canvas.getContext('2d')!;
    this.staticLayer = document.createElement('canvas');
    this.sprites = ringRgb.map(glowSprite);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = Boolean(e?.isIntersecting);
      if (this.visible) this.kick();
    });
    this.io.observe(canvas);
    this.resize();
    if (opts.interactive) this.bindInteraction();
    this.kick();
  }

  setPattern(p: Pattern) {
    this.pattern = p;
    this.kick();
  }

  setEngine(e: RondoEngine | null) {
    this.engine = e;
    this.kick();
  }

  setFinish(f: keyof typeof FINISH_OKLCH) {
    this.finish = f;
    this.staticKey = '';
    this.kick();
  }

  /** Pulse a slot (e.g. when auditioning while stopped). */
  pulse(ring: number, slot: number) {
    this.flash.set(`${ring}:${slot}`, performance.now());
    this.kick();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
  }

  /* ── Geometry ──────────────────────────────────────────── */

  private get pat(): Pattern {
    return this.engine?.pattern ?? this.pattern;
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.max(1, Math.min(rect.width, rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = size;
    this.canvas.width = Math.round(size * this.dpr);
    this.canvas.height = Math.round(size * this.dpr);
    this.staticKey = '';
    // Resizing clears the canvas: repaint now rather than leaving a blank frame.
    if (this.visible && size > 1) this.draw();
    this.kick();
  }

  private slotAngle(ringIndex: number, slot: number): number {
    const ring = this.pat.rings[ringIndex]!;
    const d = (((slot - ring.offset) % ring.steps) + ring.steps) % ring.steps;
    return -Math.PI / 2 + (d / ring.steps) * TAU;
  }

  private nodeRadius(ringIndex: number, note: number): number {
    const band = BANDS[ringIndex]!;
    const mid = (band.outer + band.inner) / 2;
    if (note < 0 || this.pat.rings[ringIndex]!.engine === 'dust') return mid;
    const span = (band.outer - band.inner) * 0.34;
    const max = RINGS[ringIndex]!.maxDegree;
    return mid + (Math.min(note, max) / max - 0.5) * span;
  }

  /** Polar hit test in CSS pixels relative to the canvas. */
  private hit(x: number, y: number): { ring: number; slot: number; angle: number } | 'sun' | null {
    const R = this.size / 2;
    const dx = x - R;
    const dy = y - R;
    const r = Math.hypot(dx, dy) / R;
    if (r <= SUN_R) return 'sun';
    const ringIndex = BANDS.findIndex((b) => r <= b.outer + 0.012 && r >= b.inner - 0.012);
    if (ringIndex < 0) return null;
    const ring = this.pat.rings[ringIndex]!;
    const angle = Math.atan2(dy, dx);
    const turn = (((angle + Math.PI / 2) / TAU) % 1 + 1) % 1;
    const d = Math.round(turn * ring.steps) % ring.steps;
    const slot = (d + ring.offset) % ring.steps;
    return { ring: ringIndex, slot, angle };
  }

  /* ── Rendering ─────────────────────────────────────────── */

  private kick() {
    if (this.raf || this.destroyed) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private frame(now: number) {
    this.raf = 0;
    if (!this.visible || this.destroyed) return;
    this.light += (this.lightTarget - this.light) * 0.12;
    this.draw(now);
    const animating =
      (this.opts.animate ?? true) &&
      (Boolean(this.engine?.playing) ||
        Math.abs(this.lightTarget - this.light) > 0.002 ||
        this.flash.size > 0 ||
        this.drag !== null);
    if (animating) this.kick();
  }

  private renderStatic() {
    const key = `${this.size}|${this.dpr}|${this.finish}|${this.light.toFixed(2)}`;
    if (key === this.staticKey) return;
    this.staticKey = key;
    const c = this.staticLayer;
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    const px = this.canvas.width;
    const R = px / 2;
    const [baseO, hiO, shO] = FINISH_OKLCH[this.finish]!;
    const base = oklchToSrgb(...baseO!);
    const hi = oklchToSrgb(...hiO!);
    const sh = oklchToSrgb(...shO!);
    const L = this.light;

    g.clearRect(0, 0, px, px);
    g.save();
    g.translate(R, R);

    // Soft contact shadow under the disc
    const shadow = g.createRadialGradient(0, R * 0.04, R * 0.8, 0, R * 0.04, R);
    shadow.addColorStop(0, 'rgb(0 0 0 / 0.22)');
    shadow.addColorStop(1, 'rgb(0 0 0 / 0)');
    g.fillStyle = shadow;
    g.beginPath();
    g.arc(0, R * 0.02, R, 0, TAU);
    g.fill();

    // Body: turned metal
    const body = g.createConicGradient(L, 0, 0);
    const bodyStops: [number, RGB][] = [
      [0, mixRgb(hi, base, 0.35)],
      [0.14, base],
      [0.25, mixRgb(sh, base, 0.3)],
      [0.36, base],
      [0.5, mixRgb(hi, base, 0.45)],
      [0.64, base],
      [0.75, mixRgb(sh, base, 0.2)],
      [0.86, base],
      [1, mixRgb(hi, base, 0.35)],
    ];
    bodyStops.forEach(([o, col]) => body.addColorStop(o, rgbCss(col)));
    g.fillStyle = body;
    g.beginPath();
    g.arc(0, 0, R * 0.985, 0, TAU);
    g.fill();

    // Chamfer highlight on the outer edge
    g.lineWidth = R * 0.012;
    const edge = g.createConicGradient(L, 0, 0);
    edge.addColorStop(0, 'rgb(255 255 255 / 0.85)');
    edge.addColorStop(0.25, 'rgb(255 255 255 / 0.05)');
    edge.addColorStop(0.5, 'rgb(255 255 255 / 0.5)');
    edge.addColorStop(0.75, 'rgb(0 0 0 / 0.15)');
    edge.addColorStop(1, 'rgb(255 255 255 / 0.85)');
    g.strokeStyle = edge;
    g.beginPath();
    g.arc(0, 0, R * 0.978, 0, TAU);
    g.stroke();

    // Bezel ticks (48): a watch-bezel scale
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU - Math.PI / 2;
      const major = i % 4 === 0;
      const r1 = R * 0.962;
      const r2 = R * (major ? 0.942 : 0.952);
      g.strokeStyle = `rgb(${Math.round(sh[0] * 255)} ${Math.round(sh[1] * 255)} ${Math.round(sh[2] * 255)} / ${major ? 0.7 : 0.4})`;
      g.lineWidth = R * (major ? 0.006 : 0.004);
      g.beginPath();
      g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      g.stroke();
    }

    // Rings
    BANDS.forEach((band, i) => {
      const ro = R * band.outer;
      const ri = R * band.inner;
      // groove (shadow) just outside each ring
      g.fillStyle = rgbCss(mixRgb(sh, [0, 0, 0], 0.7), 0.95);
      g.beginPath();
      g.arc(0, 0, ro + R * 0.016, 0, TAU);
      g.arc(0, 0, ri - R * 0.016, 0, TAU, true);
      g.fill();

      const ringGrad = g.createConicGradient(L + i * 0.09, 0, 0);
      const t = 0.1 + i * 0.04;
      ringGrad.addColorStop(0, rgbCss(mixRgb(hi, base, 0.1)));
      ringGrad.addColorStop(0.12, rgbCss(mixRgb(base, hi, t)));
      ringGrad.addColorStop(0.25, rgbCss(mixRgb(sh, base, 0.45)));
      ringGrad.addColorStop(0.38, rgbCss(base));
      ringGrad.addColorStop(0.5, rgbCss(mixRgb(hi, base, 0.2)));
      ringGrad.addColorStop(0.62, rgbCss(base));
      ringGrad.addColorStop(0.75, rgbCss(mixRgb(sh, base, 0.35)));
      ringGrad.addColorStop(0.88, rgbCss(mixRgb(base, hi, t)));
      ringGrad.addColorStop(1, rgbCss(mixRgb(hi, base, 0.1)));
      g.fillStyle = ringGrad;
      g.beginPath();
      g.arc(0, 0, ro, 0, TAU);
      g.arc(0, 0, ri, 0, TAU, true);
      g.fill();

      // Fine turning marks
      g.lineWidth = Math.max(0.5, R * 0.0015);
      for (let k = 0; k < 5; k++) {
        const rr = ri + ((ro - ri) * (k + 0.5)) / 5;
        g.strokeStyle = `rgb(255 255 255 / ${0.025 + (k % 2) * 0.02})`;
        g.beginPath();
        g.arc(0, 0, rr, 0, TAU);
        g.stroke();
      }

      // Milky light track
      const mid = (ro + ri) / 2;
      g.lineWidth = R * 0.028;
      g.strokeStyle = rgbCss(mixRgb(sh, [0, 0, 0], 0.4), 0.55);
      g.beginPath();
      g.arc(0, 0, mid, 0, TAU);
      g.stroke();
      g.lineWidth = R * 0.012;
      g.strokeStyle = 'rgb(235 242 255 / 0.12)';
      g.beginPath();
      g.arc(0, 0, mid, 0, TAU);
      g.stroke();

      // Inner edge highlight
      g.lineWidth = R * 0.004;
      const lip = g.createConicGradient(L + Math.PI, 0, 0);
      lip.addColorStop(0, 'rgb(255 255 255 / 0.7)');
      lip.addColorStop(0.5, 'rgb(255 255 255 / 0)');
      lip.addColorStop(1, 'rgb(255 255 255 / 0.7)');
      g.strokeStyle = lip;
      g.beginPath();
      g.arc(0, 0, ro - R * 0.002, 0, TAU);
      g.stroke();
    });

    // Sun well
    g.fillStyle = rgbCss(mixRgb(sh, [0, 0, 0], 0.6));
    g.beginPath();
    g.arc(0, 0, R * (SUN_R + 0.02), 0, TAU);
    g.fill();
    g.restore();
  }

  draw(now = performance.now()) {
    const g = this.ctx;
    const px = this.canvas.width;
    const R = px / 2;
    this.renderStatic();
    g.clearRect(0, 0, px, px);
    g.drawImage(this.staticLayer, 0, 0);

    const p = this.pat;
    const engine = this.engine;
    const pos = engine ? engine.stepFloat() : 0;
    const playing = Boolean(engine?.playing);
    const hits = engine?.playing ? engine.recentHits(0.32) : [];
    const audioNow = engine?.ctx.currentTime ?? 0;

    g.save();
    g.translate(R, R);

    p.rings.forEach((ring, i) => {
      const band = BANDS[i]!;
      const mid = R * ((band.outer + band.inner) / 2);
      const width = R * (band.outer - band.inner);
      const col = ringRgb[i]!;

      // Playhead comet
      if (playing || pos > 0) {
        const phase = ((pos % ring.steps) + ring.steps) % ring.steps;
        const head = -Math.PI / 2 + (phase / ring.steps) * TAU;
        const tail = (TAU / ring.steps) * 1.6;
        const segs = 14;
        g.lineCap = 'round';
        for (let s = 0; s < segs; s++) {
          const a0 = head - (tail * (s + 1)) / segs;
          const a1 = head - (tail * s) / segs;
          g.strokeStyle = rgbCss(mixRgb(col, [1, 1, 1], 0.35), (1 - s / segs) * (playing ? 0.85 : 0.25));
          g.lineWidth = R * 0.02 * (1 - s / segs / 2);
          g.beginPath();
          g.arc(0, 0, mid, a0, a1);
          g.stroke();
        }
      }

      // Slots
      for (let s = 0; s < ring.steps; s++) {
        const note = ring.notes[s]!;
        const a = this.slotAngle(i, s);
        const hovered = this.hover?.ring === i && this.hover.slot === s;
        const isCursor = this.cursor.visible && this.cursor.ring === i && this.cursor.slot === s;
        if (note < 0) {
          const r = mid;
          g.fillStyle = hovered ? rgbCss(col, 0.75) : 'rgb(12 20 34 / 0.38)';
          g.beginPath();
          g.arc(Math.cos(a) * r, Math.sin(a) * r, width * (hovered ? 0.1 : 0.06), 0, TAU);
          g.fill();
          if (hovered) {
            g.strokeStyle = rgbCss(col, 0.7);
            g.lineWidth = R * 0.004;
            g.beginPath();
            g.arc(Math.cos(a) * r, Math.sin(a) * r, width * 0.2, 0, TAU);
            g.stroke();
          }
        } else {
          const r = this.nodeRadius(i, note) * R;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          const hit = hits.find((h) => h.ring === i && h.slot === s);
          const age = hit ? audioNow - hit.time : Infinity;
          const fl = this.flash.get(`${i}:${s}`);
          const flashAge = fl ? (now - fl) / 1000 : Infinity;
          const energy = Math.max(age < 0.32 ? 1 - age / 0.32 : 0, flashAge < 0.4 ? 1 - flashAge / 0.4 : 0);
          const drumScale = ring.engine === 'dust' ? [1.25, 1, 1, 0.7, 0.85, 0.75, 0.65, 1.05, 0.8][note] ?? 1 : 1;
          const base = width * 0.15 * drumScale;
          // glow
          g.globalCompositeOperation = 'lighter';
          const gs = base * (3.2 + energy * 4.5);
          g.globalAlpha = 0.55 + energy * 0.45;
          g.drawImage(this.sprites[i]!, x - gs, y - gs, gs * 2, gs * 2);
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
          // core
          g.fillStyle = rgbCss(mixRgb(col, [1, 1, 1], 0.35 + energy * 0.5));
          g.beginPath();
          g.arc(x, y, base * (1 + energy * 0.35), 0, TAU);
          g.fill();
          if (ring.engine === 'dust' && [1, 2, 4].includes(note)) {
            g.fillStyle = rgbCss(mixRgb(col, [0, 0, 0], 0.55));
            g.beginPath();
            g.arc(x, y, base * 0.45, 0, TAU);
            g.fill();
          }
          if (hovered || this.drag?.ring === i && this.drag.slot === s) {
            g.strokeStyle = 'rgb(255 255 255 / 0.85)';
            g.lineWidth = R * 0.004;
            g.beginPath();
            g.arc(x, y, base * 1.9, 0, TAU);
            g.stroke();
          }
        }
        if (isCursor) {
          const r = note < 0 ? mid : this.nodeRadius(i, note) * R;
          g.strokeStyle = 'rgb(255 227 98 / 1)';
          g.lineWidth = R * 0.006;
          g.setLineDash([R * 0.012, R * 0.01]);
          g.beginPath();
          g.arc(Math.cos(a) * r, Math.sin(a) * r, width * 0.3, 0, TAU);
          g.stroke();
          g.setLineDash([]);
        }
      }
    });

    // Sun: sapphire dome over a warm core that breathes with the music
    const level = engine?.playing ? engine.level() : 0;
    const sunR = R * SUN_R;
    const lx = Math.cos(this.light) * sunR * 0.35;
    const ly = Math.sin(this.light) * sunR * 0.35;
    const dome = g.createRadialGradient(lx, ly, sunR * 0.05, 0, 0, sunR);
    dome.addColorStop(0, 'rgb(236 244 255)');
    dome.addColorStop(0.25, 'rgb(118 146 190)');
    dome.addColorStop(0.7, 'rgb(22 34 60)');
    dome.addColorStop(1, 'rgb(8 12 24)');
    g.fillStyle = dome;
    g.beginPath();
    g.arc(0, 0, sunR, 0, TAU);
    g.fill();
    const core = g.createRadialGradient(0, 0, 0, 0, 0, sunR * 0.9);
    const warm = playing ? 0.55 + level * 0.45 : 0.18;
    core.addColorStop(0, `rgb(255 236 150 / ${warm})`);
    core.addColorStop(0.4, `rgb(255 205 90 / ${warm * 0.5})`);
    core.addColorStop(1, 'rgb(255 205 90 / 0)');
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = core;
    g.beginPath();
    g.arc(0, 0, sunR, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    // specular crescent
    g.strokeStyle = 'rgb(255 255 255 / 0.55)';
    g.lineWidth = sunR * 0.05;
    g.beginPath();
    g.arc(0, 0, sunR * 0.86, this.light - 0.7, this.light + 0.7);
    g.stroke();
    // play / pause glyph
    if (this.opts.playGlyph ?? this.opts.interactive) {
      g.fillStyle = playing ? 'rgb(255 255 255 / 0.55)' : 'rgb(255 255 255 / 0.85)';
      const s = sunR * 0.28;
      g.beginPath();
      if (playing) {
        g.rect(-s * 0.7, -s, s * 0.5, s * 2);
        g.rect(s * 0.2, -s, s * 0.5, s * 2);
      } else {
        g.moveTo(-s * 0.55, -s);
        g.lineTo(s * 0.95, 0);
        g.lineTo(-s * 0.55, s);
        g.closePath();
      }
      g.fill();
    }
    g.restore();

    for (const [k, t] of this.flash) if (now - t > 400) this.flash.delete(k);
  }

  /* ── Interaction ───────────────────────────────────────── */

  private local(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private edit(fn: () => EditEvent | null) {
    this.opts.onBeforeEdit?.();
    const ev = fn();
    if (!ev) return;
    this.engine?.update();
    this.opts.onEdit?.(ev);
    this.kick();
  }

  private defaultNote(ringIndex: number, slot: number): number {
    const ring = this.pat.rings[ringIndex]!;
    if (ring.engine === 'dust') {
      const d = ((slot - ring.offset) % ring.steps + ring.steps) % ring.steps;
      const quarter = ring.steps / 4;
      if (d % quarter === 0) return d % (quarter * 2) === 0 ? 0 : 1;
      return 3;
    }
    for (let k = 1; k < ring.steps; k++) {
      const prev = ring.notes[(slot - k + ring.steps) % ring.steps]!;
      if (prev >= 0) return prev;
    }
    return ringIndex === 3 ? 4 : 0;
  }

  toggleAt(ringIndex: number, slot: number) {
    this.edit(() => {
      const ring = this.pat.rings[ringIndex]!;
      const was = ring.notes[slot]!;
      ring.notes[slot] = was >= 0 ? -1 : this.defaultNote(ringIndex, slot);
      const added = ring.notes[slot]! >= 0;
      if (added) {
        if (!this.engine?.playing) this.engine?.audition(ringIndex, ring.notes[slot]!);
        this.pulse(ringIndex, slot);
      }
      this.announce(ringIndex, slot);
      return { type: added ? 'add' : 'remove', ring: ringIndex, slot, value: ring.notes[slot]! };
    });
  }

  nudgePitch(ringIndex: number, slot: number, delta: number) {
    const ring = this.pat.rings[ringIndex]!;
    if (ring.notes[slot]! < 0) return;
    this.edit(() => {
      const max = ring.engine === 'dust' ? DRUM_VOICES.length - 1 : RINGS[ringIndex]!.maxDegree;
      const next = Math.min(max, Math.max(0, ring.notes[slot]! + delta));
      if (next === ring.notes[slot]) return null;
      ring.notes[slot] = next;
      if (!this.engine?.playing) this.engine?.audition(ringIndex, next);
      this.pulse(ringIndex, slot);
      this.announce(ringIndex, slot);
      return { type: 'pitch', ring: ringIndex, slot, value: next };
    });
  }

  turn(ringIndex: number, delta: number) {
    this.edit(() => {
      const ring = this.pat.rings[ringIndex]!;
      ring.offset = (((ring.offset - delta) % ring.steps) + ring.steps) % ring.steps;
      uiTick(1 + ringIndex * 0.15);
      if (navigator.vibrate) navigator.vibrate(4);
      return { type: 'rotate', ring: ringIndex, slot: -1, value: ring.offset };
    });
  }

  private announce(ringIndex: number, slot: number) {
    const ring = this.pat.rings[ringIndex]!;
    const meta = RINGS[ringIndex]!;
    const n = ring.notes[slot]!;
    const what = n < 0 ? 'empty' : ring.engine === 'dust' ? DRUM_VOICES[n] : `note ${n + 1}`;
    this.opts.onAnnounce?.(`${meta.name} ring, step ${slot + 1} of ${ring.steps}: ${what}`);
  }

  private bindInteraction() {
    const c = this.canvas;
    c.style.touchAction = this.opts.touchAction ?? 'none';

    c.addEventListener('pointermove', (e) => {
      const { x, y } = this.local(e);
      const R = this.size / 2;
      this.lightTarget = Math.atan2(y - R, x - R) + Math.PI;
      if (!this.drag) {
        const h = this.hit(x, y);
        this.hover = h && h !== 'sun' ? { ring: h.ring, slot: h.slot } : null;
        c.style.cursor = h ? 'pointer' : 'default';
        this.kick();
        return;
      }
      const d = this.drag;
      const dx = x - d.startX;
      const dy = y - d.startY;
      if (d.mode === 'none' && Math.hypot(dx, dy) > 7) {
        // Decide: radial (pitch) vs tangential (turn)
        const radial = Math.abs((dx * Math.cos(d.startAngle) + dy * Math.sin(d.startAngle)));
        const tangential = Math.abs(-dx * Math.sin(d.startAngle) + dy * Math.cos(d.startAngle));
        const hasNote = this.pat.rings[d.ring]!.notes[d.slot]! >= 0;
        d.mode = hasNote && radial > tangential ? 'pitch' : 'rotate';
        d.moved = true;
      }
      if (d.mode === 'pitch') {
        const radialDist = (dx * Math.cos(d.startAngle) + dy * Math.sin(d.startAngle)) / (R * 0.035);
        const target = d.startNote + Math.round(radialDist);
        const cur = this.pat.rings[d.ring]!.notes[d.slot]!;
        if (target !== cur) this.nudgePitch(d.ring, d.slot, target - cur);
      } else if (d.mode === 'rotate') {
        const ring = this.pat.rings[d.ring]!;
        const ang = Math.atan2(y - R, x - R);
        let delta = ang - d.startAngle;
        delta = ((delta + Math.PI) % TAU + TAU) % TAU - Math.PI;
        const stepsMoved = Math.round((delta / TAU) * ring.steps);
        const targetOffset = (((d.startOffset - stepsMoved) % ring.steps) + ring.steps) % ring.steps;
        if (targetOffset !== ring.offset) {
          const diff = ((ring.offset - targetOffset) % ring.steps + ring.steps) % ring.steps;
          this.turn(d.ring, diff > ring.steps / 2 ? diff - ring.steps : diff);
        }
      }
    });

    c.addEventListener('pointerleave', () => {
      if (!this.drag) {
        this.hover = null;
        this.lightTarget = -Math.PI * 0.75;
        this.kick();
      }
    });

    c.addEventListener('pointerdown', (e) => {
      const { x, y } = this.local(e);
      const h = this.hit(x, y);
      if (!h) return;
      this.opts.onPointerDown?.();
      c.setPointerCapture(e.pointerId);
      if (h === 'sun') {
        this.drag = { ring: -1, slot: -1, startX: x, startY: y, startAngle: 0, startOffset: 0, startNote: 0, mode: 'sun', pointerId: e.pointerId, moved: false };
        return;
      }
      const ring = this.pat.rings[h.ring]!;
      this.drag = {
        ring: h.ring,
        slot: h.slot,
        startX: x,
        startY: y,
        startAngle: h.angle,
        startOffset: ring.offset,
        startNote: ring.notes[h.slot]!,
        mode: 'none',
        pointerId: e.pointerId,
        moved: false,
      };
      this.cursor = { ring: h.ring, slot: h.slot, visible: false };
      this.kick();
    });

    const end = (e: PointerEvent) => {
      const d = this.drag;
      if (!d || d.pointerId !== e.pointerId) return;
      this.drag = null;
      if (d.mode === 'sun') {
        this.opts.onToggle?.();
      } else if (!d.moved) {
        this.toggleAt(d.ring, d.slot);
      }
      this.kick();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', (e) => {
      if (this.drag?.pointerId === e.pointerId) this.drag = null;
    });

    c.addEventListener('wheel', (e) => {
      if (!this.hover) return;
      const n = this.pat.rings[this.hover.ring]!.notes[this.hover.slot]!;
      if (n < 0) return;
      e.preventDefault();
      this.nudgePitch(this.hover.ring, this.hover.slot, e.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    c.addEventListener('focus', () => {
      // Only show the keyboard cursor for keyboard focus, not after a click.
      this.cursor.visible = c.matches(':focus-visible');
      this.kick();
    });
    c.addEventListener('blur', () => {
      this.cursor.visible = false;
      this.kick();
    });
    c.addEventListener('keydown', (e) => {
      const cur = this.cursor;
      const ring = this.pat.rings[cur.ring]!;
      let handled = true;
      switch (e.key) {
        case 'ArrowRight':
          cur.slot = (cur.slot + 1) % ring.steps;
          this.announce(cur.ring, cur.slot);
          break;
        case 'ArrowLeft':
          cur.slot = (cur.slot - 1 + ring.steps) % ring.steps;
          this.announce(cur.ring, cur.slot);
          break;
        case 'ArrowUp':
          cur.ring = Math.max(0, cur.ring - 1);
          cur.slot = Math.min(cur.slot, this.pat.rings[cur.ring]!.steps - 1);
          this.announce(cur.ring, cur.slot);
          break;
        case 'ArrowDown':
          cur.ring = Math.min(3, cur.ring + 1);
          cur.slot = Math.min(cur.slot, this.pat.rings[cur.ring]!.steps - 1);
          this.announce(cur.ring, cur.slot);
          break;
        case 'Enter':
          this.opts.onPointerDown?.();
          this.toggleAt(cur.ring, cur.slot);
          break;
        case '+':
        case '=':
          this.nudgePitch(cur.ring, cur.slot, 1);
          break;
        case '-':
        case '_':
          this.nudgePitch(cur.ring, cur.slot, -1);
          break;
        case ']':
          this.turn(cur.ring, 1);
          break;
        case '[':
          this.turn(cur.ring, -1);
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        cur.visible = true;
        this.kick();
      }
    });
  }
}
