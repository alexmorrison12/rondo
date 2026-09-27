/**
 * Reflections that tell the time: a tiny environment scene (sky dome + sun + two soft
 * studio panels) is re-baked with PMREM whenever the sky changes enough. The aluminium
 * therefore reflects dawn, noon or dusk, while the panels keep its form readable.
 */
import {
  BackSide,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Texture,
  type WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import type { SkyBlend } from './sky';

const domeVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const domeFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBottom;
  uniform vec3 uGround;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  uniform float uSunStrength;
  varying vec3 vDir;
  void main() {
    float y = vDir.y;
    vec3 col = y > 0.0
      ? mix(mix(uBottom, uMid, smoothstep(0.0, 0.35, y)), uTop, smoothstep(0.3, 1.0, y))
      : mix(uBottom, uGround, smoothstep(0.0, -0.45, y));
    float s = max(0.0, dot(normalize(vDir), uSunDir));
    col += uSun * (pow(s, 900.0) * 40.0 + pow(s, 12.0) * 0.6) * uSunStrength;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Feathered white card: bright centre, soft falloff (no hard-edged reflections). */
function softTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

export class SkyEnvironment {
  private pmrem: PMREMGenerator;
  private scene = new Scene();
  private dome: Mesh<SphereGeometry, ShaderMaterial>;
  private target: WebGLRenderTarget | null = null;
  private lastKey = '';
  private panels: Mesh<PlaneGeometry, MeshBasicMaterial>[] = [];

  constructor(renderer: WebGLRenderer) {
    this.pmrem = new PMREMGenerator(renderer);
    this.dome = new Mesh(
      new SphereGeometry(10, 48, 24),
      new ShaderMaterial({
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        side: BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new Vector3() },
          uMid: { value: new Vector3() },
          uBottom: { value: new Vector3() },
          uGround: { value: new Vector3() },
          uSun: { value: new Vector3() },
          uSunDir: { value: new Vector3(-0.5, 0.6, 0.6).normalize() },
          uSunStrength: { value: 1 },
        },
      }),
    );
    this.scene.add(this.dome);

    // Softboxes with feathered edges: one large overhead key, one narrow strip from the side.
    const soft = softTexture();
    const key = new Mesh(new PlaneGeometry(9, 5), new MeshBasicMaterial({ color: 0xffffff, map: soft, transparent: true }));
    key.position.set(-2, 7, 4);
    key.lookAt(0, 0, 0);
    const fill = new Mesh(new PlaneGeometry(6, 6), new MeshBasicMaterial({ color: 0xffffff, map: soft, transparent: true }));
    fill.position.set(7, 3, 2);
    fill.lookAt(0, 0, 0);
    this.panels = [key, fill];
    this.scene.add(key, fill);
  }

  /** Re-bake if the sky moved meaningfully since last time. Returns the current env texture. */
  update(sky: SkyBlend, force = false): Texture | null {
    const key = [sky.top, sky.bottom, sky.sun].map((v) => v.toArray().map((n) => n.toFixed(2)).join()).join('|') + sky.sunElevation.toFixed(2);
    if (!force && key === this.lastKey && this.target) return this.target.texture;
    this.lastKey = key;
    const u = this.dome.material.uniforms;
    (u.uTop!.value as Vector3).copy(sky.top);
    (u.uMid!.value as Vector3).copy(sky.mid);
    (u.uBottom!.value as Vector3).copy(sky.bottom);
    (u.uGround!.value as Vector3).copy(sky.bottom).multiplyScalar(0.18);
    (u.uSun!.value as Vector3).copy(sky.sun);
    const e = sky.sunElevation;
    (u.uSunDir!.value as Vector3).set(-0.55, Math.max(-0.2, e), 0.55).normalize();
    u.uSunStrength!.value = Math.max(0, Math.min(1, (e + 0.1) * 3));
    // Panels dim at night so reflections stay believable (but never vanish: the form must read).
    const panelLevel = 0.35 + (1 - sky.dark) * 1.4;
    this.panels[0]!.material.color.setScalar(panelLevel);
    this.panels[1]!.material.color.setScalar(panelLevel * 0.45);

    const next = this.pmrem.fromScene(this.scene, 0.02);
    this.target?.dispose();
    this.target = next;
    return next.texture;
  }

  dispose() {
    this.target?.dispose();
    this.pmrem.dispose();
  }
}
