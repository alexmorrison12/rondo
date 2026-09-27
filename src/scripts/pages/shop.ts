/**
 * Shop configurator: every choice is reflected on the live 3D model and in the URL
 * (?edition=founders&finish=eclipse&engrave=…) so campaigns can deep-link a configuration.
 */
import { ADDONS, COLORWAYS, PHASES, PRODUCT, formatPrice, type ColorwayId } from '@/data/site';
import { url } from '@/lib/url';
import { openBag } from '../core/bag';
import { addToCart, addonItem, rewardUnlocked, rondoItem } from '../core/cart';
import { currentPhase, phaseStore } from '../core/phase';
import { uiPop, uiTick } from '../core/sound';
import { toast } from '../core/toast';
import { morningOrbit } from '../seq/generate';
import { RondoDevice, type Finish } from '../three/device';
import { skyAt } from '../three/sky';
import { Stage, webglAvailable } from '../three/stage';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string) => [...document.querySelectorAll<T>(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Config {
  edition: 'standard' | 'founders';
  finish: ColorwayId;
  engraving: string;
  addons: Set<string>;
}

const params = new URLSearchParams(location.search);
const state: Config = {
  edition: params.get('edition') === 'founders' ? 'founders' : 'standard',
  finish: (COLORWAYS.some((c) => c.id === params.get('finish')) ? params.get('finish') : 'noon') as ColorwayId,
  engraving: (params.get('engrave') ?? '').slice(0, 24),
  addons: new Set((params.get('addons') ?? '').split(',').filter((a) => ADDONS.some((x) => x.id === a))),
};
if (state.edition === 'founders') state.finish = 'eclipse';
if (state.edition === 'standard' && state.finish === 'eclipse') state.finish = 'noon';

/* ── 3D viewer ──────────────────────────────────────────────────── */
let device: RondoDevice | null = null;
const view = { rx: 1.05, ry: -0.35, targetRx: 1.05, targetRy: -0.35, auto: true };

function initViewer() {
  const canvas = $<HTMLCanvasElement>('[data-viewer-canvas]');
  if (!canvas || !webglAvailable()) return;
  const stage = new Stage(canvas, { fov: 24 });
  stage.camera.position.set(0, 0, 6.2);
  device = new RondoDevice(state.finish as Finish);
  const pattern = morningOrbit();
  device.syncPattern(pattern);
  stage.scene.add(device.group);
  skyAt(1.35, stage.sky);

  let drag: { x: number; y: number; rx: number; ry: number; id: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, rx: view.targetRx, ry: view.targetRy, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    view.auto = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    view.targetRy = drag.ry + (e.clientX - drag.x) * 0.01;
    view.targetRx = Math.max(-1.6, Math.min(1.6, drag.rx + (e.clientY - drag.y) * 0.008));
  });
  const end = () => (drag = null);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  stage.add(({ time, delta }) => {
    if (view.auto && !reduceMotion) view.targetRy += delta * 0.18;
    const k = reduceMotion ? 1 : 1 - Math.exp(-delta * 6);
    view.rx += (view.targetRx - view.rx) * k;
    view.ry += (view.targetRy - view.ry) * k;
    const g = device!.group;
    g.position.set(0, reduceMotion ? 0 : Math.sin(time * 0.7) * 0.02, 0);
    g.rotation.set(view.rx, 0, 0);
    g.rotateY(view.ry);
    device!.syncPlayback(time * 6, true, [], pattern);
    device!.setSunGlow(0.25);
    stage.applySky(time);
  });
  stage.applySky(0);
  stage.bakeEnvironment(true);
  stage.start();

  $$<HTMLButtonElement>('[data-view]').forEach((b) =>
    b.addEventListener('click', () => {
      $$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      setView(b.dataset.view as 'top' | 'side' | 'base');
    }),
  );
}

function setView(v: 'top' | 'side' | 'base') {
  view.auto = v === 'top';
  const snap = Math.round(view.targetRy / (Math.PI * 2)) * Math.PI * 2;
  if (v === 'top') {
    view.targetRx = 1.05;
    view.targetRy = snap - 0.35;
  } else if (v === 'side') {
    view.targetRx = 0.18;
    view.targetRy = snap - Math.PI / 2 + 0.4;
  } else {
    view.targetRx = -1.45;
    view.targetRy = snap;
  }
}

/* ── Configuration UI ───────────────────────────────────────────── */
function total(): number {
  const base = state.edition === 'founders' ? PRODUCT.foundersPrice : PRODUCT.price;
  let sum = base;
  for (const id of state.addons) {
    if (id === 'dock' && state.edition === 'founders') continue;
    sum += ADDONS.find((a) => a.id === id)?.price ?? 0;
  }
  return sum;
}

function syncUrl() {
  const q = new URLSearchParams();
  if (state.edition === 'founders') q.set('edition', 'founders');
  if (state.finish !== 'noon' && state.edition === 'standard') q.set('finish', state.finish);
  if (state.engraving) q.set('engrave', state.engraving);
  if (state.addons.size) q.set('addons', [...state.addons].join(','));
  const qs = q.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function render() {
  document.body.dataset.edition = state.edition;
  $$('[data-edition]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.edition === state.edition)));
  $$('[data-finish]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.finish === state.finish)));
  const cw = COLORWAYS.find((c) => c.id === state.finish)!;
  const fl = $('[data-finish-label]');
  if (fl) fl.textContent = `${cw.name} · ${cw.note}`;

  const dockBox = $<HTMLInputElement>('[data-addon="dock"]');
  const dockPrice = $('[data-addon-price="dock"]');
  if (dockBox && dockPrice) {
    const included = state.edition === 'founders';
    dockBox.disabled = included;
    dockBox.checked = included || state.addons.has('dock');
    dockPrice.textContent = included ? 'Included' : `+${formatPrice(ADDONS[0]!.price)}`;
  }
  $$<HTMLInputElement>('[data-addon]').forEach((i) => {
    if (i.dataset.addon !== 'dock') i.checked = state.addons.has(i.dataset.addon!);
  });

  const price = state.edition === 'founders' ? PRODUCT.foundersPrice : PRODUCT.price;
  const p = $('[data-price]');
  if (p) p.textContent = formatPrice(price);
  const q = $('[data-quarter]');
  if (q) q.textContent = formatPrice(price / 4, { cents: true });
  const t = $('[data-add-total]');
  if (t) t.textContent = formatPrice(total());

  const count = $('[data-engraving-count]');
  if (count) count.textContent = `${state.engraving.length}/24`;

  const reward = $('[data-reward]');
  if (reward) reward.hidden = !(rewardUnlocked.get() && state.edition === 'standard');

  // Phase: before launch, the shop routes to the waitlist / founders page instead of the bag.
  const phase = currentPhase();
  const add = $<HTMLButtonElement>('[data-add]');
  const link = $<HTMLAnchorElement>('[data-phase-link]');
  const label = $('[data-add-label]');
  if (add && link && label) {
    const prelaunch = phase === 'signal' || phase === 'founders';
    add.hidden = prelaunch;
    link.hidden = !prelaunch;
    if (prelaunch) {
      link.href = url(PHASES[phase].cta.href);
      link.textContent = PHASES[phase].cta.label;
    }
    label.textContent = phase === 'orbit' ? 'Add to bag' : 'Pre-order';
  }

  if (device) {
    device.setFinish(state.finish as Finish);
    device.setEngraving(state.engraving, state.edition === 'founders' ? 427 : undefined);
  }
  syncUrl();
}

function bind() {
  $$<HTMLButtonElement>('[data-edition]').forEach((b) =>
    b.addEventListener('click', () => {
      state.edition = b.dataset.edition as Config['edition'];
      state.finish = state.edition === 'founders' ? 'eclipse' : state.finish === 'eclipse' ? 'noon' : state.finish;
      uiTick(0.9);
      render();
    }),
  );
  $$<HTMLButtonElement>('[data-finish]').forEach((b) =>
    b.addEventListener('click', () => {
      state.finish = b.dataset.finish as ColorwayId;
      uiTick(1.1);
      render();
    }),
  );
  const engr = $<HTMLInputElement>('[data-engraving]');
  if (engr) {
    engr.value = state.engraving;
    let timer = 0;
    engr.addEventListener('input', () => {
      state.engraving = engr.value.slice(0, 24);
      const c = $('[data-engraving-count]');
      if (c) c.textContent = `${state.engraving.length}/24`;
      window.clearTimeout(timer);
      timer = window.setTimeout(render, 160);
    });
    engr.addEventListener('focus', () => {
      setView('base');
      $$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x.getAttribute('data-view') === 'base')));
    });
  }
  $$<HTMLInputElement>('[data-addon]').forEach((i) =>
    i.addEventListener('change', () => {
      const id = i.dataset.addon!;
      if (i.checked) state.addons.add(id);
      else state.addons.delete(id);
      uiPop(i.checked);
      render();
    }),
  );
  $('[data-add]')?.addEventListener('click', () => {
    const founders = state.edition === 'founders';
    addToCart(rondoItem({ colorway: state.finish, founders, engraving: state.engraving }));
    for (const id of state.addons) {
      if (id === 'dock' && founders) continue;
      const item = addonItem(id);
      if (item) addToCart(item);
    }
    uiPop(true);
    const cw = COLORWAYS.find((c) => c.id === state.finish)!;
    toast(`${founders ? 'Founders Edition' : 'Rondo'} in ${cw.name} is in your bag`, { icon: 'bag' });
    openBag();
  });
  phaseStore.subscribe(() => render(), false);
  rewardUnlocked.subscribe(() => render(), false);
}

initViewer();
bind();
render();
