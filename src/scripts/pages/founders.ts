/**
 * Founders: choose a serial from a golden-angle spiral of 2,000 numbers. The 3D Eclipse model
 * turns to show your number engraved on its base; claiming adds it to the bag and produces a
 * shareable card.
 */
import { PRODUCT } from '@/data/site';
import { url } from '@/lib/url';
import { earn } from '../core/achievements';
import { addToCart, rondoItem } from '../core/cart';
import { downloadBlob } from '../core/share';
import { uiPop, uiTick } from '../core/sound';
import { persisted } from '../core/store';
import { toast } from '../core/toast';
import { hashString, morningOrbit } from '../seq/generate';
import { RondoDevice } from '../three/device';
import { skyAt } from '../three/sky';
import { Stage, webglAvailable } from '../three/stage';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const TOTAL = PRODUCT.foundersTotal;
const pad = (n: number) => String(n).padStart(4, '0');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Availability (deterministic, plus your own claims) ─────────── */
const POPULAR = [1, 2, 3, 7, 8, 10, 11, 12, 13, 21, 23, 42, 69, 77, 88, 99, 100, 101, 111, 123, 200, 222, 333, 360, 404, 420, 500, 555, 666, 700, 707, 777, 808, 888, 999, 1000, 1024, 1111, 1234, 1337, 1500, 1776, 1984, 1999, 2000];
const mine = persisted<number[]>('founders-claimed', []);
const taken = new Set<number>();
for (let n = 1; n <= TOTAL; n++) if (hashString(`rondo-${n}`) % 100 < 64) taken.add(n);
POPULAR.forEach((n) => taken.add(n));
const isFree = (n: number) => !taken.has(n) && !mine.get().includes(n);
const freeCount = () => {
  let c = 0;
  for (let n = 1; n <= TOTAL; n++) if (isFree(n)) c++;
  return c;
};

let selected: number | null = null;

/* ── Spiral ─────────────────────────────────────────────────────── */
const canvas = $<HTMLCanvasElement>('[data-spiral]');
const g = canvas.getContext('2d')!;
const tip = $('[data-tip]');
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
let points: { n: number; x: number; y: number }[] = [];
let hover: number | null = null;
let dpr = 1;

function layout() {
  const r = canvas.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const R = canvas.width / 2;
  const c = (R * 0.94) / Math.sqrt(TOTAL);
  points = Array.from({ length: TOTAL }, (_, i) => {
    const n = i + 1;
    const a = n * GOLDEN;
    const rr = c * Math.sqrt(n);
    return { n, x: R + Math.cos(a) * rr, y: R + Math.sin(a) * rr };
  });
  draw();
}

function draw() {
  const W = canvas.width;
  g.clearRect(0, 0, W, W);
  const dot = Math.max(1.6, W / 330);
  for (const p of points) {
    const free = isFree(p.n);
    const isMine = mine.get().includes(p.n);
    g.fillStyle = isMine ? 'oklch(0.82 0.11 80)' : free ? 'rgb(255 227 98 / 0.95)' : 'rgb(208 224 242 / 0.16)';
    g.beginPath();
    g.arc(p.x, p.y, free || isMine ? dot : dot * 0.7, 0, Math.PI * 2);
    g.fill();
  }
  const ring = (n: number | null, color: string, size: number) => {
    if (n === null) return;
    const p = points[n - 1];
    if (!p) return;
    g.strokeStyle = color;
    g.lineWidth = dot * 0.9;
    g.beginPath();
    g.arc(p.x, p.y, dot * size, 0, Math.PI * 2);
    g.stroke();
  };
  ring(hover, 'rgb(255 255 255 / 0.8)', 3.2);
  ring(selected, 'oklch(0.82 0.11 80)', 4.2);
}

function nearest(x: number, y: number): number | null {
  let best: number | null = null;
  let bd = Infinity;
  for (const p of points) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = p.n;
    }
  }
  const lim = (canvas.width / 45) ** 2;
  return bd < lim ? best : null;
}

canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  const n = nearest((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
  hover = n;
  if (n !== null) {
    const p = points[n - 1]!;
    tip.hidden = false;
    tip.textContent = isFree(n) ? `No. ${pad(n)}` : `No. ${pad(n)} · taken`;
    tip.style.transform = `translate(${p.x / dpr}px, ${p.y / dpr}px)`;
  } else tip.hidden = true;
  draw();
});
canvas.addEventListener('pointerleave', () => {
  hover = null;
  tip.hidden = true;
  draw();
});
canvas.addEventListener('click', () => {
  if (hover === null) return;
  if (isFree(hover)) choose(hover);
  else suggest(hover);
});
canvas.addEventListener('keydown', (e) => {
  const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
  if (step) {
    e.preventDefault();
    let n = selected ?? 1;
    for (let k = 0; k < TOTAL; k++) {
      n = ((n - 1 + step + TOTAL) % TOTAL) + 1;
      if (isFree(n)) break;
    }
    choose(n);
  }
});
new ResizeObserver(layout).observe(canvas);

/* ── Choosing ───────────────────────────────────────────────────── */
const msg = $('[data-msg]');

function closestFree(n: number): [number | null, number | null] {
  let lo: number | null = null;
  let hi: number | null = null;
  for (let d = 1; d < TOTAL && (lo === null || hi === null); d++) {
    if (lo === null && n - d >= 1 && isFree(n - d)) lo = n - d;
    if (hi === null && n + d <= TOTAL && isFree(n + d)) hi = n + d;
  }
  return [lo, hi];
}

function suggest(n: number) {
  const [lo, hi] = closestFree(n);
  msg.innerHTML = '';
  const t = document.createElement('span');
  t.textContent = `No. ${pad(n)} is taken. Closest free: `;
  msg.append(t);
  [lo, hi].filter((x): x is number => x !== null).forEach((x, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'footer-link';
    b.textContent = pad(x);
    b.addEventListener('click', () => choose(x));
    if (i) msg.append(' or ');
    msg.append(b);
  });
}

function choose(n: number) {
  selected = n;
  msg.textContent = `No. ${pad(n)} is free.`;
  $('[data-plate]').textContent = `No. ${pad(n)}`;
  $('[data-reserve]').hidden = false;
  $('[data-reserve-num]').textContent = `No. ${pad(n)}`;
  uiTick(1.2);
  showNumber(n);
  draw();
}

$<HTMLFormElement>('[data-search]').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = parseInt($<HTMLInputElement>('[data-num]').value, 10);
  if (!v || v < 1 || v > TOTAL) {
    msg.textContent = 'Numbers run from 0001 to 2000.';
    return;
  }
  if (isFree(v)) choose(v);
  else suggest(v);
});

document.querySelectorAll<HTMLButtonElement>('[data-quick]').forEach((b) =>
  b.addEventListener('click', () => {
    const kind = b.dataset.quick;
    let candidates: number[] = [];
    if (kind === 'random') {
      const free = points.map((p) => p.n).filter(isFree);
      candidates = [free[Math.floor(Math.random() * free.length)]!];
    } else if (kind === 'lucky') {
      candidates = [7, 17, 27, 70, 71, 170, 717, 1007, 1070, 1177, 1717, 1770, 1777, 77 * 7, 7 * 11].filter((n) => n <= TOTAL);
    } else {
      const d = new Date();
      const mmdd = (d.getMonth() + 1) * 100 + d.getDate();
      candidates = [mmdd, d.getDate() * 100 + d.getMonth() + 1].filter((n) => n <= TOTAL);
    }
    const hit = candidates.find(isFree);
    if (hit) choose(hit);
    else if (candidates[0]) suggest(candidates[0]);
  }),
);

$('[data-free]').textContent = freeCount().toLocaleString('en-US');

/* ── 3D viewer ──────────────────────────────────────────────────── */
let device: RondoDevice | null = null;
const view = { rx: 1.0, ry: 0, trx: 1.0, try: 0 };
function initViewer() {
  const c = document.querySelector<HTMLCanvasElement>('[data-fviewer-canvas]');
  if (!c || !webglAvailable()) return;
  const stage = new Stage(c, { fov: 22 });
  stage.camera.position.set(0, 0, 6.4);
  device = new RondoDevice('eclipse');
  const pattern = morningOrbit();
  device.syncPattern(pattern);
  stage.scene.add(device.group);
  skyAt(6.6, stage.sky);
  stage.add(({ time, delta }) => {
    if (!reduceMotion) view.try += delta * 0.25;
    const k = reduceMotion ? 1 : 1 - Math.exp(-delta * 4);
    view.rx += (view.trx - view.rx) * k;
    view.ry += (view.try - view.ry) * k;
    device!.group.rotation.set(view.rx, 0, 0);
    device!.group.rotateY(view.ry);
    device!.syncPlayback(time * 5, true, [], pattern);
    device!.setSunGlow(0.35);
    stage.applySky(time);
  });
  stage.applySky(0);
  stage.bakeEnvironment(true);
  stage.start();
}

let flipBack = 0;
function showNumber(n: number) {
  if (!device) return;
  device.setEngraving('', n);
  view.trx = -1.25;
  window.clearTimeout(flipBack);
  flipBack = window.setTimeout(() => (view.trx = 1.0), 4200);
}

/* ── Claim ──────────────────────────────────────────────────────── */
function drawCard(n: number): HTMLCanvasElement {
  const c = $<HTMLCanvasElement>('[data-card]');
  const x = c.getContext('2d')!;
  const S = c.width;
  x.fillStyle = '#040b1a';
  x.fillRect(0, 0, S, S);
  const grad = x.createRadialGradient(S * 0.5, S * 0.42, 10, S * 0.5, S * 0.42, S * 0.6);
  grad.addColorStop(0, 'rgba(214,168,74,0.35)');
  grad.addColorStop(1, 'rgba(214,168,74,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, S, S);
  x.save();
  x.translate(S / 2, S * 0.4);
  [300, 240, 180, 120].forEach((r, i) => {
    x.strokeStyle = `rgba(208,224,242,${0.18 + i * 0.06})`;
    x.lineWidth = 26;
    x.beginPath();
    x.arc(0, 0, r, 0, Math.PI * 2);
    x.stroke();
  });
  x.fillStyle = '#d6a84a';
  x.beginPath();
  x.arc(0, 0, 62, 0, Math.PI * 2);
  x.fill();
  x.restore();
  x.fillStyle = '#e9f0f8';
  x.textAlign = 'center';
  x.font = '800 150px Archivo, Arial, sans-serif';
  x.fillText(`No. ${pad(n)}`, S / 2, S * 0.83);
  x.font = '600 34px Archivo, Arial, sans-serif';
  x.fillStyle = '#9eb4ca';
  x.fillText('RONDO FOUNDERS EDITION · 1 OF 2,000', S / 2, S * 0.9);
  return c;
}

$('[data-claim]').addEventListener('click', () => {
  if (selected === null || !isFree(selected)) return;
  const n = selected;
  addToCart(rondoItem({ colorway: 'eclipse', founders: true, founderNumber: n }));
  mine.set((m) => [...m, n]);
  uiPop(true);
  drawCard(n);
  $('[data-claimed-title]').textContent = `No. ${pad(n)} is yours.`;
  $<HTMLAnchorElement>('[data-checkout]').href = url('/checkout/');
  $<HTMLDialogElement>('[data-claimed]').showModal();
  $('[data-free]').textContent = freeCount().toLocaleString('en-US');
  draw();
});
$('[data-download]').addEventListener('click', () => {
  if (selected === null) return;
  const c = $<HTMLCanvasElement>('[data-card]');
  c.toBlob((b) => {
    if (b) {
      downloadBlob(b, `rondo-founders-${pad(selected!)}.png`);
      earn('share');
      toast('Card saved. Post it and tag #playincircles.', { icon: 'check' });
    }
  }, 'image/png');
});
$('[data-close]').addEventListener('click', () => $<HTMLDialogElement>('[data-claimed]').close());

initViewer();
layout();
