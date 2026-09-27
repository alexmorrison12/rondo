/**
 * The Rondo, modelled in code.
 *
 * - Body and rings are lathe-turned profiles, so their UVs run around the circumference and
 *   `anisotropy` produces the radial highlight of turned aluminium for free.
 * - Each ring carries an LED track: an additive shader that renders the live sequencer
 *   (notes, hits, playhead comet) straight from the pattern.
 * - The sun is a sapphire dome (real transmission) over a warm emissive core.
 * - Internals (PCB, battery, speaker) exist only for the exploded view.
 * Units: device radius = 1 (108 mm). Top face points +Y.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Intersection,
  type Raycaster,
} from 'three';
import { FINISH_OKLCH, RING_OKLCH, oklchToLinear } from '../lib/color';
import { RINGS, type Pattern } from '../seq/model';

export type Finish = 'noon' | 'ember' | 'moon' | 'eclipse';

/** Ring bands (outer, inner radius): identical to the 2D face so both read the same. */
export const RING_BANDS: [number, number][] = [
  [0.935, 0.77],
  [0.75, 0.605],
  [0.585, 0.46],
  [0.44, 0.32],
];

const TOP = 0.05; // ring top surface height
const TAU = Math.PI * 2;
const SEG = 160;

const ledVertex = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ledFragment = /* glsl */ `
  #define TAU 6.283185307
  uniform float uSteps;
  uniform float uOffset;
  uniform float uPhase;
  uniform float uPlaying;
  uniform float uInner;
  uniform float uOuter;
  uniform float uTrack;
  uniform float uIntensity;
  uniform float uNotes[16];
  uniform float uFlash[16];
  uniform float uHover;
  uniform vec3 uColor;
  varying vec2 vLocal;

  void main() {
    float r = length(vLocal);
    float mid = (uInner + uOuter) * 0.5;
    float ang = atan(vLocal.x, vLocal.y);
    float turn = fract(ang / TAU + 1.0);
    float pos = turn * uSteps;
    float d = floor(pos + 0.5);
    float slotF = mod(d + uOffset, uSteps);
    int si = int(slotF + 0.5);
    float note = uNotes[si];
    float flash = uFlash[si];

    float arc = (pos - d) / uSteps * TAU * mid;
    float radial = r - mid;
    float dist = length(vec2(arc, radial));

    vec3 col = vec3(0.0);
    // frosted track sheen
    float track = smoothstep(uTrack, uTrack * 0.55, abs(radial));
    col += vec3(0.55, 0.65, 0.8) * track * 0.035;

    // empty socket (tiny, cool)
    col += vec3(0.4, 0.5, 0.7) * smoothstep(0.007, 0.004, dist) * 0.08;

    if (note >= 0.0) {
      float core = smoothstep(0.012, 0.006, dist);
      float halo = exp(-dist * 70.0) * 0.7 + exp(-dist * 24.0) * 0.18;
      float energy = 1.0 + flash * 2.2;
      col += uColor * (core * 1.35 + halo * (0.55 + flash * 1.4)) * energy * uIntensity;
      col += vec3(1.0) * core * flash * 0.8;
    }

    // hover highlight for the slot under the pointer
    col += uColor * smoothstep(0.02, 0.012, dist) * step(abs(slotF - uHover), 0.1) * 0.6;

    // playhead comet travelling along the track
    float behind = mod(uPhase - pos + uSteps * 16.0, uSteps);
    float comet = exp(-behind * 2.2) * uPlaying * track;
    col += mix(uColor, vec3(1.0), 0.2) * comet * 0.45 * uIntensity;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function linColor(o: [number, number, number]): Color {
  const [r, g, b] = oklchToLinear(...o);
  return new Color().setRGB(r, g, b, 'srgb-linear');
}

/** Metal colours per finish (linear), tuned for how metals reflect a bright sky. */
function finishColors(f: Finish): { body: Color; ring: Color; accent: Color } {
  const [base] = FINISH_OKLCH[f]!;
  const b = base!;
  const body = linColor([Math.max(0.2, b[0] - 0.08), b[1] * 0.95, b[2]]);
  const ring = linColor([Math.min(0.95, b[0] - 0.02), b[1] * 0.9, b[2]]);
  const accent = f === 'eclipse' ? linColor([0.78, 0.11, 80]) : linColor([0.9, 0.01, 250]);
  return { body, ring, accent };
}

function bodyProfile(): Vector2[] {
  const p: [number, number][] = [
    [0.0, -0.11],
    [0.88, -0.11],
    [0.935, -0.107],
    [0.968, -0.098],
    [0.99, -0.078],
    [0.999, -0.05],
    [1.0, -0.02],
    [1.0, 0.03],
    [0.998, 0.052],
    [0.991, 0.064],
    [0.978, 0.071],
    [0.962, 0.072],
    [0.955, 0.068],
    [0.951, 0.055],
    [0.95, 0.0],
    [0.3, 0.0],
    [0.3, 0.035],
    [0.0, 0.035],
  ];
  return p.map(([x, y]) => new Vector2(x, y));
}

function ringProfile(outer: number, inner: number): Vector2[] {
  const c = 0.007;
  const p: [number, number][] = [
    [inner, 0.002],
    [inner, TOP - c],
    [inner + c * 0.4, TOP - c * 0.25],
    [inner + c, TOP],
    [outer - c, TOP],
    [outer - c * 0.4, TOP - c * 0.25],
    [outer, TOP - c],
    [outer, 0.002],
    [inner, 0.002],
  ];
  return p.map(([x, y]) => new Vector2(x, y));
}

/** Bezel engraving: ticks, wordmark and a line of text, drawn in polar coordinates. */
function bezelTexture(): CanvasTexture {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const R = S / 2;
  g.translate(R, R);
  g.fillStyle = 'rgba(0,0,0,0)';
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  const r0 = R * 0.965;
  const r1 = R * 0.995;
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * TAU;
    const major = i % 8 === 0;
    if (i > 58 && i < 86) continue; // leave room for the text
    g.lineWidth = major ? 5 : 2.5;
    const inner = major ? r0 : r0 + (r1 - r0) * 0.45;
    g.beginPath();
    g.moveTo(Math.sin(a) * inner, -Math.cos(a) * inner);
    g.lineTo(Math.sin(a) * (r1 - 4), -Math.cos(a) * (r1 - 4));
    g.stroke();
  }
  // Text along the arc
  const text = 'RONDO  ·  MADE TO KEEP TIME';
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.font = '600 26px Archivo, Arial, sans-serif';
  const rt = (r0 + r1) / 2;
  const total = g.measureText(text).width;
  let a = (72 / 96) * TAU - total / rt / 2;
  for (const ch of text) {
    const w = g.measureText(ch).width;
    g.save();
    g.rotate(a + w / rt / 2);
    g.translate(0, -rt);
    g.fillText(ch, -w / 2, 9);
    g.restore();
    a += w / rt + 1.6 / rt;
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Base engraving: wordmark, a line of text and an optional serial / personal engraving. */
function baseTexture(engraving: string, serial?: number): CanvasTexture {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.textAlign = 'center';
  g.font = '800 70px Archivo, Arial, sans-serif';
  g.fillText('RONDO', 0, -150);
  g.font = '500 28px Archivo, Arial, sans-serif';
  g.fillText('Designed in Lisbon · Made to keep time', 0, -95);
  if (serial) {
    g.font = '700 44px Archivo, Arial, sans-serif';
    g.fillText(`No. ${String(serial).padStart(4, '0')} / 2000`, 0, 40);
  }
  if (engraving) {
    g.font = 'italic 500 52px Archivo, Georgia, serif';
    g.fillText(engraving.slice(0, 24), 0, serial ? 130 : 60);
  }
  g.font = '500 22px Archivo, Arial, sans-serif';
  g.fillText('Four T5 screws. Open me when you need to.', 0, 300);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Radial falloff for the sun's inner light. */
function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, '#d9d9d9');
  grad.addColorStop(0.6, '#3a3a3a');
  grad.addColorStop(1, '#050505');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** The main board as a technician would see it: solder mask, an LED footprint under every ring,
 * 45°-routed traces from the processor, vias, mounting holes and silkscreen. */
function pcbTexture(): CanvasTexture {
  const S = 1024;
  const C = S / 2;
  const px = (u: number) => (u / 0.92) * C; // device units → pixels from the centre
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Solder mask, a touch lighter over the copper pours.
  g.fillStyle = '#0a1a14';
  g.fillRect(0, 0, S, S);
  const pour = g.createRadialGradient(C, C, px(0.1), C, C, px(0.92));
  pour.addColorStop(0, 'rgba(40, 84, 62, 0.35)');
  pour.addColorStop(1, 'rgba(40, 84, 62, 0.05)');
  g.fillStyle = pour;
  g.fillRect(0, 0, S, S);

  const copper = 'rgba(206, 166, 88, 0.62)';
  const pad = 'rgba(228, 204, 150, 0.95)';

  // LED footprints: one ring of 96 two-pad parts under each light ring.
  g.fillStyle = pad;
  RING_BANDS.forEach(([outer, inner]) => {
    const r = px((outer + inner) / 2);
    for (let k = 0; k < 96; k++) {
      const a = (k / 96) * Math.PI * 2;
      g.save();
      g.translate(C + Math.cos(a) * r, C + Math.sin(a) * r);
      g.rotate(a);
      g.fillRect(-7, -3.5, 4.5, 7);
      g.fillRect(2.5, -3.5, 4.5, 7);
      g.restore();
    }
  });

  // Traces: bundles leave the processor and fan out to the rings, routed straight then at 45°.
  const route = (x0: number, y0: number, x1: number, y1: number) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    g.beginPath();
    g.moveTo(x0, y0);
    if (Math.abs(dx) > Math.abs(dy)) g.lineTo(x1 - Math.sign(dx) * Math.abs(dy), y0);
    else g.lineTo(x0, y1 - Math.sign(dy) * Math.abs(dx));
    g.lineTo(x1, y1);
    g.stroke();
  };
  const via = (x: number, y: number) => {
    g.fillStyle = pad;
    g.beginPath();
    g.arc(x, y, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#07110d';
    g.beginPath();
    g.arc(x, y, 2, 0, Math.PI * 2);
    g.fill();
  };
  g.strokeStyle = copper;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const soc = { x: C - 36, y: C + 26, h: 76 };
  for (let b = 0; b < 12; b++) {
    const dir = (b / 12) * Math.PI * 2 + rnd() * 0.2;
    const ring = RING_BANDS[b % 4]!;
    const r = px((ring[0] + ring[1]) / 2);
    const n = 4 + Math.floor(rnd() * 4);
    g.lineWidth = b % 3 === 0 ? 4 : 2.5;
    for (let t = 0; t < n; t++) {
      const off = (t - n / 2) * 10;
      const nx = -Math.sin(dir);
      const ny = Math.cos(dir);
      const x0 = soc.x + Math.cos(dir) * 50 + nx * off;
      const y0 = soc.y + Math.sin(dir) * 50 + ny * off;
      const a = dir + (t - n / 2) * 0.035;
      const x1 = C + Math.cos(a) * (r - 14);
      const y1 = C + Math.sin(a) * (r - 14);
      route(x0, y0, x1, y1);
      via(x1, y1);
    }
  }
  // Power rails: two wide arcs between the rings.
  g.lineWidth = 9;
  g.strokeStyle = 'rgba(206, 166, 88, 0.4)';
  [0.76, 0.595].forEach((u) => {
    g.beginPath();
    g.arc(C, C, px(u), 0.3, Math.PI * 1.7);
    g.stroke();
  });

  // Mounting holes for the four T5 screws.
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const x = C + Math.cos(a) * px(0.83);
    const y = C + Math.sin(a) * px(0.83);
    g.fillStyle = pad;
    g.beginPath();
    g.arc(x, y, 17, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#050907';
    g.beginPath();
    g.arc(x, y, 9, 0, Math.PI * 2);
    g.fill();
  }

  // Silkscreen.
  g.fillStyle = 'rgba(232, 240, 234, 0.82)';
  g.strokeStyle = 'rgba(232, 240, 234, 0.7)';
  g.lineWidth = 2;
  g.strokeRect(soc.x - soc.h / 2 - 8, soc.y - soc.h / 2 - 8, soc.h + 16, soc.h + 16);
  g.textAlign = 'center';
  g.font = '700 22px Archivo, system-ui, sans-serif';
  g.fillText('U1', soc.x, soc.y - soc.h / 2 - 16);
  g.font = '700 20px Archivo, system-ui, sans-serif';
  g.fillText('RONDO MB-01  REV C', C, C + px(0.285));
  g.font = '600 15px Archivo, system-ui, sans-serif';
  g.fillText('LISBON 2026 · 384 × LED', C, C + px(0.285) + 22);
  // Canvas → board: canvas x runs along world +Z, canvas up is world +X (the port side).
  g.fillText('J1 USB-C', C, C - px(0.7));
  g.fillText('BT1 +', C + 110, C + 70);
  g.save();
  g.translate(C + Math.cos(Math.PI * 0.25) * px(0.72), C + Math.sin(Math.PI * 0.25) * px(0.72));
  g.rotate(-Math.PI / 4);
  g.font = '600 13px Archivo, system-ui, sans-serif';
  g.fillText('HELLO, FUTURE REPAIRER', 0, 0);
  g.restore();

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The battery's printed wrap: what a repair guide would tell you to check. */
function batteryLabel(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 540;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1d3566';
  g.fillRect(0, 0, 1024, 540);
  g.fillStyle = '#f3efe4';
  g.fillRect(0, 360, 1024, 180);
  g.fillStyle = '#f3efe4';
  g.font = '800 92px Archivo, system-ui, sans-serif';
  g.fillText('RONDO', 60, 150);
  g.font = '600 38px Archivo, system-ui, sans-serif';
  g.fillText('Li-ion polymer · 3.7 V · 2 400 mAh · 8.88 Wh', 60, 230);
  g.fillText('Replaceable: four T5 screws, no glue', 60, 290);
  g.fillStyle = '#1d3566';
  g.font = '700 34px Archivo, system-ui, sans-serif';
  g.fillText('BT-01  ·  MADE TO BE OPENED', 60, 435);
  g.font = '500 26px Archivo, system-ui, sans-serif';
  g.fillText('Do not puncture or heat. Recycle with care.', 60, 485);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export interface LedRing {
  mesh: Mesh<RingGeometry, ShaderMaterial>;
  notes: Float32Array;
  flash: Float32Array;
}

export class RondoDevice {
  readonly group = new Group();
  /** Parts that move in the exploded view, with their exploded Y offset. */
  private explodeParts: { obj: Object3D; y: number }[] = [];
  private internals = new Group();
  private races: Mesh[] = [];
  private raceMat = new MeshStandardMaterial({ color: 0xd5d9df, roughness: 0.22, metalness: 1 });
  readonly rings: Mesh<LatheGeometry, MeshPhysicalMaterial>[] = [];
  readonly leds: LedRing[] = [];
  private bodyMat: MeshPhysicalMaterial;
  private ringMat: MeshPhysicalMaterial;
  private accentMat: MeshPhysicalMaterial;
  private inlayMat: MeshPhysicalMaterial;
  private coreMat: MeshBasicMaterial;
  private baseMat: MeshStandardMaterial;
  private engraveMat!: MeshStandardMaterial;
  private engraving = { text: '', serial: undefined as number | undefined };
  private sunGroup = new Group();
  finish: Finish = 'noon';

  constructor(finish: Finish = 'noon') {
    const cols = finishColors(finish);
    this.bodyMat = new MeshPhysicalMaterial({
      color: cols.body,
      metalness: 1,
      roughness: 0.36,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
    });
    this.ringMat = new MeshPhysicalMaterial({
      color: cols.ring,
      metalness: 1,
      roughness: 0.3,
      anisotropy: 0.4,
      clearcoat: 0.2,
      clearcoatRoughness: 0.25,
    });
    this.accentMat = new MeshPhysicalMaterial({ color: cols.accent, metalness: 1, roughness: 0.2 });
    this.inlayMat = new MeshPhysicalMaterial({
      color: 0x0a1120,
      metalness: 0.1,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });

    // Body
    const body = new Mesh(new LatheGeometry(bodyProfile(), SEG), this.bodyMat);
    this.group.add(body);

    // Bezel engraving overlay
    const bezelGeo = new RingGeometry(0.953, 0.99, SEG, 1);
    this.engraveMat = new MeshStandardMaterial({
      map: bezelTexture(),
      transparent: true,
      metalness: 1,
      roughness: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const bezel = new Mesh(bezelGeo, this.engraveMat);
    bezel.rotation.x = -Math.PI / 2;
    bezel.position.y = 0.0722;
    // Map the planar UVs of the ring to the polar texture drawn at full canvas size
    this.planarToPolarUV(bezelGeo, 0.99);
    this.group.add(bezel);

    // Base engraving
    this.baseMat = new MeshStandardMaterial({
      map: baseTexture(''),
      transparent: true,
      metalness: 1,
      roughness: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const base = new Mesh(new CircleGeometry(0.86, 96), this.baseMat);
    base.rotation.x = Math.PI / 2;
    base.position.y = -0.1105;
    this.group.add(base);

    // Ports on the side wall (+X side): USB-C, headphone, MIDI in, MIDI out
    const portMat = new MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.6, metalness: 0.2 });
    const usb = new Mesh(new BoxGeometry(0.03, 0.028, 0.1), portMat);
    usb.position.set(0.992, -0.04, 0);
    const jackGeo = new CylinderGeometry(0.017, 0.017, 0.03, 24);
    [-0.2, 0.18, 0.28].forEach((z) => {
      const j = new Mesh(jackGeo, portMat);
      j.rotation.z = Math.PI / 2;
      const a = Math.atan2(z, 1);
      j.position.set(Math.cos(a) * 0.992, -0.04, Math.sin(a) * 0.992);
      j.rotation.y = -a;
      this.group.add(j);
    });
    this.group.add(usb);

    // Rings + LED tracks
    RING_BANDS.forEach(([outer, inner], i) => {
      const ringGroup = new Group();
      const ring = new Mesh(new LatheGeometry(ringProfile(outer, inner), SEG), this.ringMat);
      ringGroup.add(ring);
      this.rings.push(ring);

      const mid = (inner + outer) / 2;
      const inlay = new Mesh(new RingGeometry(mid - 0.018, mid + 0.018, SEG, 1), this.inlayMat);
      inlay.rotation.x = -Math.PI / 2;
      inlay.position.y = TOP + 0.001;
      ringGroup.add(inlay);

      const ledGeo = new RingGeometry(inner + 0.012, outer - 0.012, SEG, 2);
      const notes = new Float32Array(16).fill(-1);
      const flash = new Float32Array(16);
      const ledMat = new ShaderMaterial({
        vertexShader: ledVertex,
        fragmentShader: ledFragment,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uSteps: { value: 16 },
          uOffset: { value: 0 },
          uPhase: { value: 0 },
          uPlaying: { value: 0 },
          uInner: { value: inner },
          uOuter: { value: outer },
          uTrack: { value: 0.016 },
          uIntensity: { value: 1 },
          uNotes: { value: notes },
          uFlash: { value: flash },
          uHover: { value: -1 },
          uColor: { value: linColor(RING_OKLCH[i]!) },
        },
      });
      const led = new Mesh(ledGeo, ledMat);
      led.rotation.x = -Math.PI / 2;
      led.position.y = TOP + 0.0022;
      led.renderOrder = 2;
      ringGroup.add(led);
      this.leds.push({ mesh: led, notes, flash });

      // Stainless bearing race under the ring: only seen when the instrument comes apart.
      const race = new Mesh(new TorusGeometry((inner + outer) / 2, 0.009, 12, SEG), this.raceMat);
      race.rotation.x = Math.PI / 2;
      race.position.y = -0.045;
      race.visible = false;
      ringGroup.add(race);
      this.races.push(race);

      this.group.add(ringGroup);
      this.explodeParts.push({ obj: ringGroup, y: 0.76 + (3 - i) * 0.15 });
    });

    // Sun: well, core and sapphire dome
    const well = new Mesh(new CircleGeometry(0.3, 96), new MeshStandardMaterial({ color: 0x06090f, roughness: 0.5, metalness: 0.5 }));
    well.rotation.x = -Math.PI / 2;
    well.position.y = 0.036;
    this.coreMat = new MeshBasicMaterial({ color: new Color(0.12, 0.07, 0.03), map: glowTexture(), toneMapped: false });
    const core = new Mesh(new CircleGeometry(0.2, 64), this.coreMat);
    core.rotation.x = -Math.PI / 2;
    core.position.y = 0.04;
    const accentRing = new Mesh(new RingGeometry(0.262, 0.285, 96), this.accentMat);
    accentRing.rotation.x = -Math.PI / 2;
    accentRing.position.y = 0.041;
    const capR = 0.537;
    const dome = new Mesh(
      new SphereGeometry(capR, 64, 24, 0, TAU, 0, 0.516),
      new MeshPhysicalMaterial({
        color: 0x8fa6c8,
        metalness: 0,
        roughness: 0.05,
        transparent: true,
        opacity: 0.28,
        ior: 1.77,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        specularIntensity: 1,
        depthWrite: false,
      }),
    );
    dome.position.y = 0.04 + 0.075 - capR;
    this.sunGroup.add(well, core, accentRing, dome);
    this.group.add(this.sunGroup);
    this.explodeParts.push({ obj: this.sunGroup, y: 1.52 });

    this.buildInternals();
    this.setFinish(finish);
    // Canvas text needs the web font; redraw engravings once it has loaded.
    document.fonts?.ready.then(() => {
      this.engraveMat.map?.dispose();
      this.engraveMat.map = bezelTexture();
      this.engraveMat.needsUpdate = true;
      this.setEngraving(this.engraving.text, this.engraving.serial);
    });
  }

  /** RingGeometry has planar UVs in [0,1] over its outer radius; stretch to the full canvas. */
  private planarToPolarUV(geo: RingGeometry, outer: number) {
    const pos = geo.attributes.position!;
    const uv = geo.attributes.uv!;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) / outer) * 0.5 + 0.5, (pos.getY(i) / outer) * 0.5 + 0.5);
    }
    uv.needsUpdate = true;
  }

  private buildInternals() {
    // Main board with its parts on top; everything on it travels with it in the exploded view.
    const board = new Group();
    const pcb = new Mesh(
      new CylinderGeometry(0.92, 0.92, 0.014, 96),
      [
        new MeshStandardMaterial({ color: 0x0a1a14, roughness: 0.6 }),
        new MeshStandardMaterial({ map: pcbTexture(), roughness: 0.42, metalness: 0.25 }),
        new MeshStandardMaterial({ color: 0x0a1a14, roughness: 0.6 }),
      ],
    );
    board.add(pcb);
    const chip = new MeshStandardMaterial({ color: 0x16181c, roughness: 0.5, metalness: 0.2 });
    const steel = new MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.28, metalness: 1 });
    const part = (w: number, h: number, d: number, x: number, z: number, mat: MeshStandardMaterial) => {
      const m = new Mesh(new BoxGeometry(w, h, d), mat);
      m.position.set(x, 0.007 + h / 2, z);
      board.add(m);
      return m;
    };
    // Positions match the board texture (canvas x → world +Z, canvas up → world +X, the port side).
    part(0.14, 0.02, 0.14, -0.047, -0.065, chip); // U1, processor
    part(0.1, 0.014, 0.07, 0.16, 0.08, chip); // flash
    part(0.08, 0.014, 0.08, -0.2, 0.19, chip); // audio codec
    part(0.06, 0.012, 0.035, 0.12, -0.16, steel); // crystal
    part(0.09, 0.03, 0.075, 0.845, 0, steel); // J1, USB-C receptacle
    // Passives: small tan and black parts clustered round the chips.
    const passive = new InstancedMesh(new BoxGeometry(0.022, 0.011, 0.012), new MeshStandardMaterial({ roughness: 0.6 }), 72);
    const dummy = new Object3D();
    const tan = new Color(0xb89868);
    const black = new Color(0x1b1d20);
    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 72; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.12 + rnd() * 0.16;
      dummy.position.set(-0.047 + Math.cos(a) * r, 0.0125, -0.065 + Math.sin(a) * r);
      dummy.rotation.set(0, Math.round(rnd() * 2) * (Math.PI / 2), 0);
      dummy.updateMatrix();
      passive.setMatrixAt(i, dummy.matrix);
      passive.setColorAt(i, rnd() > 0.35 ? tan : black);
    }
    board.add(passive);

    // Pouch cell with its printed wrap on top, and the speaker beside it.
    const laminate = new MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.42, metalness: 0.7 });
    const label = new MeshStandardMaterial({ map: batteryLabel(), roughness: 0.55, metalness: 0 });
    const battery = new Mesh(new BoxGeometry(0.95, 0.045, 0.5), [laminate, laminate, label, laminate, laminate, laminate]);
    battery.position.set(-0.05, 0, 0.18);
    const speaker = new Group();
    const can = new Mesh(new CylinderGeometry(0.2, 0.2, 0.07, 64), new MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.5, metalness: 0.6 }));
    const cone = new Mesh(
      new LatheGeometry([new Vector2(0.02, 0.04), new Vector2(0.16, 0.012), new Vector2(0.19, 0.036)], 64),
      new MeshStandardMaterial({ color: 0x2b303a, roughness: 0.8, side: DoubleSide }),
    );
    const trim = new Mesh(new RingGeometry(0.17, 0.2, 64), new MeshStandardMaterial({ color: 0xc8a45a, metalness: 1, roughness: 0.3 }));
    trim.rotation.x = -Math.PI / 2;
    trim.position.y = 0.037;
    speaker.add(can, cone, trim);
    speaker.position.set(0.45, 0, -0.35);

    // Four T5 screws, floating between the base and the cell.
    const screws = new Group();
    const screwMat = new MeshStandardMaterial({ color: 0x3a4048, roughness: 0.32, metalness: 1 });
    const recessMat = new MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.7 });
    const headGeo = new CylinderGeometry(0.034, 0.03, 0.016, 32);
    const shaftGeo = new CylinderGeometry(0.012, 0.012, 0.09, 16);
    const recessGeo = new CylinderGeometry(0.013, 0.013, 0.004, 6);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const screw = new Group();
      const head = new Mesh(headGeo, screwMat);
      const shaft = new Mesh(shaftGeo, screwMat);
      shaft.position.y = -0.053;
      const recess = new Mesh(recessGeo, recessMat);
      recess.position.y = 0.007;
      screw.add(head, shaft, recess);
      screw.position.set(Math.cos(a) * 0.83, 0, Math.sin(a) * 0.83);
      screws.add(screw);
    }

    const pcbHolder = new Group();
    pcbHolder.add(board);
    const batHolder = new Group();
    batHolder.add(battery, speaker);
    this.internals.add(pcbHolder, batHolder, screws);
    this.internals.visible = false;
    this.group.add(this.internals);
    this.explodeParts.push({ obj: screws, y: 0.1 }, { obj: batHolder, y: 0.27 }, { obj: pcbHolder, y: 0.52 });
  }

  setFinish(f: Finish) {
    this.finish = f;
    const cols = finishColors(f);
    this.bodyMat.color.copy(cols.body);
    this.ringMat.color.copy(cols.ring);
    this.accentMat.color.copy(cols.accent);
    const dark = f === 'eclipse';
    this.bodyMat.roughness = dark ? 0.42 : f === 'moon' ? 0.3 : 0.36;
    this.ringMat.roughness = dark ? 0.34 : 0.3;
    // Laser engraving reveals bright metal through coloured anodising; on raw silver it reads darker.
    const mark = f === 'moon' ? linColor([0.5, 0.01, 250]) : linColor([0.93, 0.008, 250]);
    this.engraveMat.color.copy(mark);
    this.baseMat.color.copy(mark);
  }

  setEngraving(text: string, serial?: number) {
    this.engraving = { text, serial };
    this.baseMat.map?.dispose();
    this.baseMat.map = baseTexture(text, serial);
    this.baseMat.needsUpdate = true;
  }

  /** 0 = assembled, 1 = fully exploded. */
  setExplode(t: number) {
    const e = t < 0.001 ? 0 : t;
    this.internals.visible = e > 0.02;
    for (const race of this.races) race.visible = e > 0.02;
    for (const part of this.explodeParts) part.obj.position.y = part.y * e;
  }

  /** Copy the musical state into the LED shaders. */
  syncPattern(p: Pattern) {
    p.rings.forEach((ring, i) => {
      const led = this.leds[i]!;
      const u = led.mesh.material.uniforms;
      u.uSteps!.value = ring.steps;
      u.uOffset!.value = ring.offset;
      for (let s = 0; s < 16; s++) led.notes[s] = s < ring.steps ? ring.notes[s]! : -1;
      u.uIntensity!.value = ring.mute ? 0.25 : 1;
    });
  }

  /** Per-frame: playhead position (in steps), whether playing, and hit flashes. */
  syncPlayback(stepFloat: number, playing: boolean, hits: { ring: number; slot: number; age: number }[], p: Pattern) {
    this.leds.forEach((led, i) => {
      const u = led.mesh.material.uniforms;
      const steps = p.rings[i]!.steps;
      u.uPhase!.value = ((stepFloat % steps) + steps) % steps;
      u.uPlaying!.value += ((playing ? 1 : 0) - u.uPlaying!.value) * 0.1;
      led.flash.fill(0);
    });
    for (const h of hits) {
      const led = this.leds[h.ring];
      if (led) led.flash[h.slot] = Math.max(led.flash[h.slot]!, 1 - h.age / 0.35);
    }
  }

  setLedIntensity(v: number) {
    this.leds.forEach((l) => (l.mesh.material.uniforms.uIntensity!.value = v));
  }

  setSunGlow(v: number) {
    const k = 0.08 + v * 1.1;
    this.coreMat.color.setRGB(1.0 * k, 0.66 * k, 0.28 * k);
  }

  setHover(ring: number, slot: number) {
    this.leds.forEach((l, i) => (l.mesh.material.uniforms.uHover!.value = i === ring ? slot : -1));
  }

  /**
   * Raycast against the rings. Returns ring index + slot (accounting for rotation offset),
   * or 'sun' for the dome.
   */
  pick(raycaster: Raycaster, p: Pattern): { ring: number; slot: number; angle: number } | 'sun' | null {
    const targets: Object3D[] = [...this.rings, this.sunGroup];
    const hits: Intersection[] = raycaster.intersectObjects(targets, true);
    const hit = hits[0];
    if (!hit) return null;
    let o: Object3D | null = hit.object;
    while (o) {
      if (o === this.sunGroup) return 'sun';
      o = o.parent;
    }
    const local = this.group.worldToLocal(hit.point.clone());
    const r = Math.hypot(local.x, local.z);
    const ringIndex = RING_BANDS.findIndex(([outer, inner]) => r <= outer + 0.01 && r >= inner - 0.01);
    if (ringIndex < 0) return null;
    // Local +Y of the LED plane maps to −Z; angle measured clockwise from −Z seen from above.
    const angle = Math.atan2(local.x, -local.z);
    const ring = p.rings[ringIndex]!;
    const turn = ((angle / TAU) % 1 + 1) % 1;
    const d = Math.round(turn * ring.steps) % ring.steps;
    return { ring: ringIndex, slot: (d + ring.offset) % ring.steps, angle };
  }

  /** World-space centre of the device (for screen-space ring turning). */
  centre(out = new Vector3()) {
    return this.group.getWorldPosition(out);
  }

  get ringMeta() {
    return RINGS;
  }
}
