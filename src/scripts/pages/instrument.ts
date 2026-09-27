/** Instrument page: 3D turntable with hotspots that live on the model and follow it. */
import { Vector3 } from 'three';
import { uiTick } from '../core/sound';
import { morningOrbit } from '../seq/generate';
import { RondoDevice } from '../three/device';
import { skyAt } from '../three/sky';
import { Stage, paintStill, webglAvailable } from '../three/stage';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Anchor points in device-local space, and the pose that best shows each part. */
const ANCHORS: Record<string, { local: Vector3; rx: number; ry: number; explode: number }> = {
  sun: { local: new Vector3(0, 0.12, 0), rx: 1.1, ry: 0, explode: 0 },
  rings: { local: new Vector3(-0.66, 0.05, -0.42), rx: 0.95, ry: 0.4, explode: 0.22 },
  track: { local: new Vector3(0.52, 0.06, 0.12), rx: 1.25, ry: -0.2, explode: 0 },
  ports: { local: new Vector3(1.0, -0.04, 0), rx: 0.25, ry: -1.25, explode: 0 },
  base: { local: new Vector3(0, -0.12, 0.35), rx: -1.2, ry: 0.3, explode: 0 },
};

function init() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-turntable]');
  if (!canvas) return;
  if (!webglAvailable()) return paintStill(canvas, 'rondo-side', 'Rondo, seen from the side');
  const stage = new Stage(canvas, { fov: 24 });
  stage.camera.position.set(0, 0, 7.2);
  const device = new RondoDevice('noon');
  const pattern = morningOrbit();
  device.syncPattern(pattern);
  stage.scene.add(device.group);
  skyAt(2.6, stage.sky);

  const view = { rx: 0.95, ry: -0.3, trx: 0.95, try: -0.3, explode: 0, texplode: 0, auto: true };
  const narrow = () => canvas.clientWidth < 760;

  let drag: { x: number; y: number; rx: number; ry: number; id: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, rx: view.trx, ry: view.try, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    view.auto = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    view.try = drag.ry + (e.clientX - drag.x) * 0.01;
    view.trx = Math.max(-1.55, Math.min(1.55, drag.rx + (e.clientY - drag.y) * 0.008));
  });
  const end = () => (drag = null);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-hotspot]')];
  const select = (id: string) => {
    const a = ANCHORS[id];
    if (!a) return;
    view.auto = false;
    const turns = Math.round(view.try / (Math.PI * 2)) * Math.PI * 2;
    view.trx = a.rx;
    view.try = turns + a.ry;
    view.texplode = a.explode;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hotspot === id)));
    document.querySelectorAll<HTMLElement>('[data-detail-for]').forEach((d) => (d.hidden = d.dataset.detailFor !== id));
    uiTick(1.1);
  };
  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.hotspot!)));

  const world = new Vector3();
  const normal = new Vector3();
  const toCam = new Vector3();
  stage.add(({ time, delta }) => {
    if (view.auto && !reduceMotion) view.try += delta * 0.16;
    const k = reduceMotion ? 1 : 1 - Math.exp(-delta * 5);
    view.rx += (view.trx - view.rx) * k;
    view.ry += (view.try - view.ry) * k;
    view.explode += (view.texplode - view.explode) * k;
    const g = device.group;
    const n = narrow();
    g.position.set(n ? 0 : 0.9, n ? -0.35 : -0.15, 0);
    g.scale.setScalar(n ? 0.72 : 1.18);
    g.rotation.set(view.rx, 0, 0);
    g.rotateY(view.ry);
    device.setExplode(view.explode);
    device.syncPlayback(time * 6, true, [], pattern);
    device.setSunGlow(0.3);
    stage.applySky(time);

    // Project hotspots; hide the ones facing away from the camera.
    g.updateMatrixWorld();
    const rect = canvas.getBoundingClientRect();
    for (const b of buttons) {
      const a = ANCHORS[b.dataset.hotspot!]!;
      world.copy(a.local).applyMatrix4(g.matrixWorld);
      normal.copy(a.local).setY(a.local.y * 6).normalize().transformDirection(g.matrixWorld);
      toCam.copy(stage.camera.position).sub(world).normalize();
      const facing = normal.dot(toCam) > -0.15;
      world.project(stage.camera);
      const x = (world.x * 0.5 + 0.5) * rect.width;
      const y = (-world.y * 0.5 + 0.5) * rect.height;
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      b.dataset.hidden = String(!facing);
    }
  });
  stage.applySky(0);
  stage.bakeEnvironment(true);
  stage.start();
}

init();
