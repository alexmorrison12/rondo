/**
 * The WebGL stage: renderer, camera, sky, environment and render loop.
 *
 * Performance guardrails:
 *  - renders only while visible (IntersectionObserver + page visibility)
 *  - adaptive resolution: pixel ratio steps down if frames run long, back up when there's headroom
 *  - environment re-bakes are throttled
 *  - handles context loss by pausing and rebuilding on restore
 */
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Timer,
  WebGLRenderer,
} from 'three';
import { SkyEnvironment } from './environment';
import { SkyBackdrop, newSkyBlend, type SkyBlend } from './sky';

export interface FrameInfo {
  time: number;
  delta: number;
}

export function webglAvailable(): boolean {
  // Respect Save-Data: visitors who asked for a lighter web get the still image instead.
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2'));
  } catch {
    return false;
  }
}

const STILLS: Record<string, string> = { noon: 'rondo-hero', ember: 'rondo-ember', moon: 'rondo-moon', eclipse: 'rondo-eclipse' };

/**
 * Without WebGL (or with Save-Data on), paint a still render into the canvas's own box so the
 * layout, and the object, stay where the page expects them.
 */
export function paintStill(canvas: HTMLCanvasElement, finishOrRender: string, label = 'Rondo'): void {
  const name = STILLS[finishOrRender] ?? finishOrRender;
  canvas.style.background = `url("${import.meta.env.BASE_URL}renders/${name}.webp") center / contain no-repeat`;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  canvas.dataset.still = 'true';
}

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly sky: SkyBlend = newSkyBlend();
  readonly backdrop = new SkyBackdrop();
  readonly sun = new DirectionalLight(0xffffff, 2.2);
  readonly hemi = new HemisphereLight(0xffffff, 0x223044, 0.35);
  private env: SkyEnvironment;
  private timer = new Timer();
  private raf = 0;
  private running = false;
  private visible = true;
  private onFrame: ((f: FrameInfo) => void)[] = [];
  private afterFrame: (() => void)[] = [];
  private maxRatio: number;
  private ratio: number;
  private slowFrames = 0;
  private fastFrames = 0;
  private lastEnvBake = 0;
  scroll = 0;

  constructor(readonly canvas: HTMLCanvasElement, opts: { fov?: number; maxPixelRatio?: number } = {}) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.maxRatio = Math.min(window.devicePixelRatio || 1, opts.maxPixelRatio ?? (matchMedia('(pointer: coarse)').matches ? 1.5 : 1.75));
    this.ratio = this.maxRatio;
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new PerspectiveCamera(opts.fov ?? 26, 1, 0.1, 100);
    this.camera.position.set(0, 0, 8);
    this.scene.add(this.backdrop.mesh, this.sun, this.hemi, this.camera);
    this.env = new SkyEnvironment(this.renderer);

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    this.resize();

    new IntersectionObserver(([e]) => {
      this.visible = Boolean(e?.isIntersecting);
      this.syncLoop();
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => this.syncLoop());

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.stop();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.env = new SkyEnvironment(this.renderer);
      this.bakeEnvironment(true);
      this.start();
    });
  }

  add(fn: (f: FrameInfo) => void) {
    this.onFrame.push(fn);
  }

  /** Runs right after each render, while the drawing buffer is still valid (capture, compositing). */
  after(fn: () => void) {
    this.afterFrame.push(fn);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  get aspect() {
    return this.camera.aspect;
  }

  bakeEnvironment(force = false) {
    const now = performance.now();
    if (!force && now - this.lastEnvBake < 180) return;
    this.lastEnvBake = now;
    const tex = this.env.update(this.sky, force);
    if (tex) this.scene.environment = tex;
  }

  /** Apply the current sky blend to lights, backdrop and (throttled) reflections. */
  applySky(time: number) {
    const s = this.sky;
    this.backdrop.update(s, time, this.aspect, this.scroll);
    this.sun.color.setRGB(s.sun.x, s.sun.y, s.sun.z, 'srgb-linear').lerp(this.sun.color.clone().setScalar(1), 0.4);
    const e = s.sunElevation;
    this.sun.intensity = Math.max(0.35, Math.min(2.6, (e + 0.35) * 2.4));
    this.sun.position.set(-4, 2 + e * 5, 5);
    this.hemi.color.setRGB(s.mid.x, s.mid.y, s.mid.z, 'srgb-linear');
    this.hemi.intensity = 0.25 + (1 - s.dark) * 0.35;
    this.bakeEnvironment();
  }

  start() {
    this.running = true;
    // Always paint one frame, even in a background or prerendered tab, so the canvas is never blank.
    if (!this.raf) this.frame(performance.now());
    this.syncLoop();
  }

  stop() {
    this.running = false;
    this.syncLoop();
  }

  private syncLoop() {
    const shouldRun = this.running && this.visible && !document.hidden;
    if (shouldRun && !this.raf) {
      this.timer.reset();
      this.raf = requestAnimationFrame((t) => this.frame(t));
    } else if (!shouldRun && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private frame(t: number) {
    this.raf = 0;
    this.timer.update(t);
    const delta = Math.min(0.05, this.timer.getDelta());
    const time = this.timer.getElapsed();
    const start = performance.now();
    for (const fn of this.onFrame) fn({ time, delta });
    this.renderer.render(this.scene, this.camera);
    for (const fn of this.afterFrame) fn();
    this.adapt(performance.now() - start, delta);
    this.syncLoop();
  }

  /** Adaptive resolution based on CPU frame cost and actual frame interval. */
  private adapt(cost: number, delta: number) {
    const slow = cost > 14 || delta > 1 / 40;
    if (slow) {
      this.slowFrames++;
      this.fastFrames = 0;
    } else {
      this.fastFrames++;
      this.slowFrames = Math.max(0, this.slowFrames - 1);
    }
    if (this.slowFrames > 24 && this.ratio > 0.75) {
      this.ratio = Math.max(0.75, this.ratio - 0.25);
      this.renderer.setPixelRatio(this.ratio);
      this.resize();
      this.slowFrames = 0;
    } else if (this.fastFrames > 240 && this.ratio < this.maxRatio) {
      this.ratio = Math.min(this.maxRatio, this.ratio + 0.25);
      this.renderer.setPixelRatio(this.ratio);
      this.resize();
      this.fastFrames = 0;
    }
  }

  renderOnce() {
    this.renderer.render(this.scene, this.camera);
  }
}
