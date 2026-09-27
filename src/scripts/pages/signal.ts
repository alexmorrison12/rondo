/**
 * Signal teaser: one ring of light that answers the pointer, a live countdown and a
 * referral orbit. Waitlist state is kept locally (prototype); see the launch plan for the
 * production backend.
 */
import { DATES } from '@/data/site';
import { url } from '@/lib/url';
import { earn } from '../core/achievements';
import { audioContext, ensureSound, isSoundReady } from '../core/sound';
import { shareLink } from '../core/share';
import { persisted } from '../core/store';
import { toast } from '../core/toast';
import { hashString } from '../seq/generate';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── The ring ───────────────────────────────────────────────────── */
const canvas = $<HTMLCanvasElement>('[data-ring]');
const g = canvas.getContext('2d')!;
const STEPS = 16;
const lit = [0, 3, 6, 8, 11, 13];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
let angle = -Math.PI / 2;
let target = angle;
let lastStep = -1;
const flashes = new Map<number, number>();
let dpr = 1;

function resize() {
  const r = canvas.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
new ResizeObserver(resize).observe(canvas);
resize();

function chime(step: number) {
  if (!isSoundReady()) return;
  const c = audioContext();
  const t = c.currentTime;
  const midi = 62 + PENTA[lit.indexOf(step) % PENTA.length]!;
  const f = 440 * 2 ** ((midi - 69) / 12);
  [1, 2.756].forEach((ratio, i) => {
    const o = c.createOscillator();
    o.frequency.value = f * ratio;
    const gg = c.createGain();
    gg.gain.setValueAtTime(0.0001, t);
    gg.gain.exponentialRampToValueAtTime(i ? 0.03 : 0.12, t + 0.01);
    gg.gain.exponentialRampToValueAtTime(0.0001, t + (i ? 0.6 : 2.2));
    o.connect(gg).connect(c.destination);
    o.start(t);
    o.stop(t + 2.3);
  });
}

function draw(now: number) {
  const W = canvas.width;
  const R = W / 2;
  g.clearRect(0, 0, W, W);
  g.save();
  g.translate(R, R);
  const rr = R * 0.78;
  // halo
  const halo = g.createRadialGradient(0, 0, rr * 0.7, 0, 0, rr * 1.25);
  halo.addColorStop(0, 'rgb(255 227 98 / 0)');
  halo.addColorStop(0.5, 'rgb(255 227 98 / 0.06)');
  halo.addColorStop(1, 'rgb(255 227 98 / 0)');
  g.fillStyle = halo;
  g.fillRect(-R, -R, W, W);
  // the ring
  g.lineWidth = R * 0.012;
  g.strokeStyle = 'rgb(208 224 242 / 0.28)';
  g.beginPath();
  g.arc(0, 0, rr, 0, Math.PI * 2);
  g.stroke();
  // comet following the pointer
  for (let s = 0; s < 40; s++) {
    const a0 = angle - s * 0.02;
    g.strokeStyle = `rgb(255 227 98 / ${(1 - s / 40) * 0.8})`;
    g.lineWidth = R * 0.016 * (1 - s / 60);
    g.beginPath();
    g.arc(0, 0, rr, a0 - 0.021, a0);
    g.stroke();
  }
  // steps
  for (let i = 0; i < STEPS; i++) {
    const a = -Math.PI / 2 + (i / STEPS) * Math.PI * 2;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    const isLit = lit.includes(i);
    const f = flashes.get(i);
    const e = f ? Math.max(0, 1 - (now - f) / 700) : 0;
    if (isLit) {
      const glow = g.createRadialGradient(x, y, 0, x, y, R * (0.06 + e * 0.08));
      glow.addColorStop(0, `rgb(255 240 180 / ${0.9})`);
      glow.addColorStop(0.3, `rgb(255 227 98 / ${0.5 + e * 0.4})`);
      glow.addColorStop(1, 'rgb(255 227 98 / 0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(x, y, R * (0.06 + e * 0.08), 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = isLit ? 'rgb(255 244 200)' : 'rgb(208 224 242 / 0.35)';
    g.beginPath();
    g.arc(x, y, R * (isLit ? 0.014 + e * 0.01 : 0.007), 0, Math.PI * 2);
    g.fill();
  }
  // sun
  const sun = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.16);
  sun.addColorStop(0, 'rgb(255 244 200 / 0.9)');
  sun.addColorStop(0.35, 'rgb(255 227 98 / 0.35)');
  sun.addColorStop(1, 'rgb(255 227 98 / 0)');
  g.fillStyle = sun;
  g.beginPath();
  g.arc(0, 0, R * 0.16, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function frame(now: number) {
  if (!reduceMotion) target += 0.0025;
  let d = target - angle;
  d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  angle += d * 0.14;
  const turn = (((angle + Math.PI / 2) / (Math.PI * 2)) % 1 + 1) % 1;
  const step = Math.floor(turn * STEPS + 0.5) % STEPS;
  if (step !== lastStep) {
    lastStep = step;
    if (lit.includes(step)) {
      flashes.set(step, now);
      chime(step);
    }
  }
  draw(now);
  raf = 0;
  // Keep animating while visible; with reduced motion, only until the ring settles and flashes fade.
  const settling = Math.abs(d) > 1e-4 || [...flashes.values()].some((t) => now - t < 900);
  if (visible && (!reduceMotion || settling)) raf = requestAnimationFrame(frame);
}

let raf = 0;
let visible = true;
const wake = () => {
  if (!raf && visible) raf = requestAnimationFrame(frame);
};
new IntersectionObserver(([e]) => {
  visible = Boolean(e?.isIntersecting) && !document.hidden;
  wake();
}).observe(canvas);
document.addEventListener('visibilitychange', () => {
  visible = !document.hidden;
  wake();
});
canvas.addEventListener('pointerdown', wake);
wake();

window.addEventListener(
  'pointermove',
  (e) => {
    const r = canvas.getBoundingClientRect();
    target = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    wake();
  },
  { passive: true },
);
canvas.addEventListener('pointerdown', async () => {
  await ensureSound();
  earn('sound');
});

/* ── Countdown ──────────────────────────────────────────────────── */
const launch = new Date(DATES.launch).getTime();
function tick() {
  const ms = Math.max(0, launch - Date.now());
  const s = Math.floor(ms / 1000);
  const parts = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
  (Object.keys(parts) as (keyof typeof parts)[]).forEach((k) => {
    const el = document.querySelector(`[data-cd="${k}"]`);
    if (el) el.textContent = String(parts[k]).padStart(2, '0');
  });
}
tick();
window.setInterval(tick, 1000);

/* ── Waitlist + referral orbit ──────────────────────────────────── */
interface Joined {
  email: string;
  base: number;
  code: string;
  invites: number;
}
const joined = persisted<Joined | null>('signal', null);

function render(j: Joined) {
  $('[data-join]').hidden = true;
  $('[data-rank]').hidden = false;
  // No invented queue positions: show real progress (friends who joined) until the backend provides a rank.
  $('[data-rank-number]').textContent = `${j.invites} friend${j.invites === 1 ? '' : 's'} joined`;
  const link = `${location.origin}${url('/lp/signal/')}?ref=${j.code}`;
  $<HTMLInputElement>('[data-ref-link]').value = link;
  const text =
    j.invites >= 10
      ? 'Ten friends. You\'re in the running for the top ten, whose loops ship on every Rondo.'
      : j.invites >= 3
        ? 'Founders window guaranteed. Keep going: at ten, your loop ships on every Rondo.'
        : `Every friend who joins with your link moves you 100 places closer to the sun. ${3 - j.invites} more for a guaranteed Founders window.`;
  $('[data-rank-text]').textContent = text;
  document.querySelectorAll<HTMLElement>('[data-tier]').forEach((li) => (li.dataset.reached = String(j.invites >= Number(li.dataset.tier))));
  // Planet moves inward as you climb
  const progress = Math.min(1, j.invites / 10);
  const r = 92 - progress * 70;
  const a = -0.6 - progress * 2.4;
  const you = document.querySelector<SVGCircleElement>('[data-you]');
  you?.setAttribute('cx', (Math.cos(a) * r).toFixed(1));
  you?.setAttribute('cy', (Math.sin(a) * r).toFixed(1));
}

$<HTMLFormElement>('[data-join]').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('#join-email');
  const err = $('[data-join-error]');
  const v = input.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
    err.hidden = false;
    err.textContent = v ? 'That email looks incomplete, e.g. you@example.com.' : 'Add your email to join.';
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    return;
  }
  err.hidden = true;
  input.setAttribute('aria-invalid', 'false');
  const h = hashString(v.toLowerCase());
  const j: Joined = { email: v, base: 3800 + (h % 2400), code: (h >>> 0).toString(36).slice(0, 6), invites: 0 };
  joined.set(j);
  render(j);
  toast("You're on the list. Watch the sky on 17 November.", { icon: 'check' });
});

$('[data-share]').addEventListener('click', async () => {
  const j = joined.get();
  if (!j) return;
  const r = await shareLink({
    title: 'Something is coming into orbit',
    text: 'Something small is coming on 17 November. Join with my link:',
    url: `${location.origin}${url('/lp/signal/')}?ref=${j.code}`,
  });
  if (r !== 'cancelled') earn('share');
});

$('[data-simulate]').addEventListener('click', () => {
  joined.set((j) => (j ? { ...j, invites: Math.min(10, j.invites + 1) } : j));
  const j = joined.get();
  if (j) {
    render(j);
    toast(`A friend joined. You moved up 100 places.`, { icon: 'sparkles' });
  }
});

const existing = joined.get();
if (existing) render(existing);
