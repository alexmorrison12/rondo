/**
 * 12-second vertical teaser: night → dawn → morning, rings lighting up one by one,
 * then the name. Rendered from the real scene and recorded with its real audio.
 */
import fixWebmDuration from 'fix-webm-duration';
import { PerspectiveCamera } from 'three';
import { RondoEngine } from '../audio/engine';
import { audioContext, masterInput, setSound } from '../core/sound';
import { morningOrbit } from '../seq/generate';
import { CloudField } from '../three/clouds';
import { RondoDevice } from '../three/device';
import { skyAt } from '../three/sky';
import { Stage } from '../three/stage';

const W = 1080;
const H = 1920;
const DURATION = 12;
const gl = document.getElementById('gl') as HTMLCanvasElement;
const out = document.getElementById('out') as HTMLCanvasElement;
gl.style.width = `${W}px`;
gl.style.height = `${H}px`;
out.width = W;
out.height = H;
out.style.width = `${W / 3}px`;
out.style.height = `${H / 3}px`;
const ctx2d = out.getContext('2d')!;

const stage = new Stage(gl, { fov: 34, maxPixelRatio: 1 });
// Composite straight after each render, while the WebGL buffer is valid.
stage.after(() => composite());
(stage.camera as PerspectiveCamera).position.set(0, 0, 8);
const device = new RondoDevice('noon');
const pattern = morningOrbit();
device.syncPattern(pattern);
const clouds = new CloudField(`${import.meta.env.BASE_URL}textures/`, 9);
stage.scene.add(clouds.group, device.group);

const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
let t0 = 0;
let engine: RondoEngine | null = null;

stage.add(({ time }) => {
  const t = t0 ? (performance.now() - t0) / 1000 : 0;
  // Sky: night (7) → dawn (0) happens through a jump; we go night → evening → … backwards feels odd,
  // so travel night → dawn by fading via position 7 → 5.2 → 1.1 using two segments.
  const sky = t < 4 ? 7 - ease(t / 4) * 1.8 : 5.2 - ease((t - 4) / 5) * 4.1;
  skyAt(sky, stage.sky);
  const g = device.group;
  const p = ease((t - 1) / 7);
  g.position.set(0, 0.55 - p * 0.35, 0);
  g.scale.setScalar(0.5 + p * 0.32);
  g.rotation.set(1.45 - p * 0.45, 0, 0.12 * p, 'XYZ');
  g.rotateY(time * 0.25);
  // Rings light up one by one
  const hits = engine?.playing ? engine.recentHits(0.35).map((h) => ({ ...h, age: (engine!.ctx.currentTime - h.time) })) : [];
  device.syncPlayback(engine?.stepFloat() ?? 0, Boolean(engine?.playing), hits, pattern);
  device.leds.forEach((l, i) => (l.mesh.material.uniforms.uIntensity!.value = ease((t - 1.2 - (3 - i) * 0.9) / 0.8) * 1.4));
  device.setSunGlow(engine?.playing ? 0.5 + engine.level() * 0.5 : 0.1);
  clouds.update(time, t * 0.02, { x: 0, y: 0 }, stage.sky);
  stage.applySky(time);
});

function composite() {
  const t = t0 ? (performance.now() - t0) / 1000 : 0;
  ctx2d.drawImage(gl, 0, 0, W, H);
  ctx2d.textAlign = 'center';
  const dateA = ease(t / 0.8) * (1 - ease((t - 3.2) / 0.8));
  if (dateA > 0) {
    ctx2d.globalAlpha = dateA;
    ctx2d.fillStyle = '#ffe362';
    ctx2d.font = '700 54px Archivo, sans-serif';
    ctx2d.fillText('17 · 11 · 2026', W / 2, H * 0.18);
  }
  const titleA = ease((t - 8.6) / 0.9);
  if (titleA > 0) {
    ctx2d.globalAlpha = titleA;
    ctx2d.fillStyle = '#0d1624';
    ctx2d.font = `800 ${Math.round(128 - (1 - titleA) * 20)}px Archivo, sans-serif`;
    ctx2d.fillText('Play in', W / 2, H * 0.74);
    ctx2d.fillText('circles.', W / 2, H * 0.74 + 130);
    ctx2d.font = '600 40px Archivo, sans-serif';
    ctx2d.fillText('RONDO · pre-order now', W / 2, H * 0.92);
  }
  ctx2d.globalAlpha = 1;
}

async function record(): Promise<string> {
  await document.fonts.ready;
  await setSound(true);
  engine = new RondoEngine(pattern);
  const dest = audioContext().createMediaStreamDestination();
  masterInput().connect(dest);
  stage.bakeEnvironment(true);
  stage.start();
  await new Promise((r) => setTimeout(r, 400));
  const stream = new MediaStream([...out.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 9_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  t0 = performance.now();
  rec.start(250);
  window.setTimeout(() => void engine!.start(), 1200);
  await new Promise((r) => setTimeout(r, DURATION * 1000));
  rec.stop();
  engine.stop();
  await done;
  // MediaRecorder writes no duration or cues; add them so players can seek.
  const blob = await fixWebmDuration(new Blob(chunks, { type: 'video/webm' }), DURATION * 1000, { logger: false });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

Object.assign(window, { __record: record, __film: { stage, device } });
