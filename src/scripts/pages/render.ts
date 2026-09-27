/** Transparent product renders for generated assets (see tools/render-assets.mjs). */
import { ACESFilmicToneMapping, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { morningOrbit } from '../seq/generate';
import { SkyEnvironment } from '../three/environment';
import { RondoDevice, type Finish } from '../three/device';
import { newSkyBlend, skyAt } from '../three/sky';

const q = new URLSearchParams(location.search);
const finish = (q.get('finish') ?? 'noon') as Finish;
const pose = q.get('pose') ?? 'hero';
const size = Number(q.get('size') ?? 1600);
const sky = Number(q.get('sky') ?? 1.6);

const canvas = document.getElementById('render') as HTMLCanvasElement;
canvas.style.width = `${size}px`;
canvas.style.height = `${size}px`;
const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(size, size, false);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new Scene();
const camera = new PerspectiveCamera(22, 1, 0.1, 100);
camera.position.set(0, 0, 7);
const env = new SkyEnvironment(renderer);
const blend = skyAt(sky, newSkyBlend());
scene.environment = env.update(blend, true);
const sun = new DirectionalLight(0xffffff, 2.2);
sun.position.set(-4, 4, 5);
scene.add(sun);

const device = new RondoDevice(finish);
const pattern = morningOrbit();
device.syncPattern(pattern);
device.syncPlayback(0, false, [], pattern);
device.setSunGlow(finish === 'eclipse' ? 0.5 : 0.2);
if (q.get('serial')) device.setEngraving(q.get('engrave') ?? '', Number(q.get('serial')));
scene.add(device.group);

const g = device.group;
switch (pose) {
  case 'top':
    g.rotation.set(Math.PI / 2, 0, 0);
    g.scale.setScalar(1.55);
    break;
  case 'side':
    g.rotation.set(0.22, 0, 0);
    g.rotateY(-0.9);
    g.scale.setScalar(1.45);
    break;
  case 'base':
    g.rotation.set(-1.3, 0, 0);
    g.scale.setScalar(1.45);
    break;
  case 'exploded':
    g.rotation.set(0.4, 0, 0.05);
    g.rotateY(-0.5);
    g.scale.setScalar(1.05);
    g.position.y = -0.45;
    device.setExplode(1);
    break;
  default:
    g.rotation.set(0.95, 0, 0.18, 'XYZ');
    g.rotateY(-0.35);
    g.scale.setScalar(1.45);
}

async function go() {
  await document.fonts.ready;
  // Give canvas textures (engravings) a frame to settle after fonts load.
  await new Promise((r) => setTimeout(r, 300));
  renderer.render(scene, camera);
  (window as unknown as { __ready: boolean }).__ready = true;
}
void go();
