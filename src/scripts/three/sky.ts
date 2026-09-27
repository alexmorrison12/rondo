/**
 * The painted sky: a full-screen gradient with a sun (Mie-like glow), a soft horizon band
 * and procedural twinkling stars. Colours come from lib/skies.ts (OKLCH → linear).
 * Rendered first, un-tonemapped, so the sky matches the CSS palette exactly.
 */
import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
import { oklchToLinear } from '../lib/color';
import { SKIES, SKY_ORDER, type SkyDef } from '../lib/skies';

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBottom;
  uniform vec3 uSun;
  uniform vec2 uSunPos;
  uniform float uSunStrength;
  uniform float uStars;
  uniform float uTime;
  uniform float uAspect;
  uniform float uScroll;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 uv = vUv;
    float y = uv.y;
    vec3 col = mix(uBottom, uMid, smoothstep(0.0, 0.5, y));
    col = mix(col, uTop, smoothstep(0.42, 1.0, y));

    // Sun: tight disc, warm halo and a wide atmospheric bloom
    vec2 d = (uv - uSunPos) * vec2(uAspect, 1.0);
    float dist = length(d);
    float halo = exp(-dist * 14.0) * 0.45 + exp(-dist * 3.2) * 0.22;
    float disc = smoothstep(0.03, 0.022, dist);
    col += uSun * (halo + disc * 1.2) * uSunStrength;

    // Horizon haze band
    col = mix(col, uBottom * 1.08, smoothstep(0.22, 0.0, y) * 0.35);

    // Stars (only where the sky is dark enough), drifting slightly with scroll
    if (uStars > 0.001) {
      vec2 grid = (uv + vec2(0.0, uScroll * 0.08)) * vec2(uAspect, 1.0) * 150.0;
      vec2 id = floor(grid);
      vec2 f = fract(grid) - 0.5;
      float h = hash(id);
      vec2 jitter = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
      float size = mix(0.035, 0.09, hash(id + 1.9));
      float star = step(0.972, h) * smoothstep(size, 0.0, length(f - jitter * 0.6));
      float twinkle = 0.55 + 0.45 * sin(uTime * (0.7 + h * 2.5) + h * 60.0);
      col += vec3(0.92, 0.95, 1.0) * star * twinkle * uStars * smoothstep(0.08, 0.45, y) * 1.6;
    }

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    // Dither to kill banding in long gradients
    gl_FragColor.rgb += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
  }
`;

const lin = (o: [number, number, number]) => new Vector3(...oklchToLinear(...o));

export interface SkyBlend {
  top: Vector3;
  mid: Vector3;
  bottom: Vector3;
  sun: Vector3;
  sunElevation: number;
  stars: number;
  clouds: number;
  dark: number;
}

const cache = new Map<string, SkyBlend>();
function skyBlend(def: SkyDef): SkyBlend {
  let v = cache.get(def.id);
  if (!v) {
    v = {
      top: lin(def.top),
      mid: lin(def.mid),
      bottom: lin(def.bottom),
      sun: lin(def.sun),
      sunElevation: def.sunElevation,
      stars: def.stars,
      clouds: def.clouds,
      dark: def.dark,
    };
    cache.set(def.id, v);
  }
  return v;
}

/** Blend between sky stops by a float position along SKY_ORDER (0 = dawn … 7 = night). */
export function skyAt(position: number, out: SkyBlend): SkyBlend {
  const max = SKY_ORDER.length - 1;
  const p = Math.min(max, Math.max(0, position));
  const i = Math.min(max - 1, Math.floor(p));
  const t = p - i;
  const a = skyBlend(SKIES[SKY_ORDER[i]!]);
  const b = skyBlend(SKIES[SKY_ORDER[i + 1]!]);
  out.top.lerpVectors(a.top, b.top, t);
  out.mid.lerpVectors(a.mid, b.mid, t);
  out.bottom.lerpVectors(a.bottom, b.bottom, t);
  out.sun.lerpVectors(a.sun, b.sun, t);
  out.sunElevation = a.sunElevation + (b.sunElevation - a.sunElevation) * t;
  out.stars = a.stars + (b.stars - a.stars) * t;
  out.clouds = a.clouds + (b.clouds - a.clouds) * t;
  out.dark = a.dark + (b.dark - a.dark) * t;
  return out;
}

export function newSkyBlend(): SkyBlend {
  return {
    top: new Vector3(),
    mid: new Vector3(),
    bottom: new Vector3(),
    sun: new Vector3(),
    sunElevation: 0,
    stars: 0,
    clouds: 0,
    dark: 0,
  };
}

export class SkyBackdrop {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      uniforms: {
        uTop: { value: new Vector3() },
        uMid: { value: new Vector3() },
        uBottom: { value: new Vector3() },
        uSun: { value: new Vector3() },
        uSunPos: { value: new Vector2(0.2, 0.8) },
        uSunStrength: { value: 1 },
        uStars: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uScroll: { value: 0 },
      },
    });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  update(sky: SkyBlend, time: number, aspect: number, scroll: number) {
    const u = this.material.uniforms;
    (u.uTop!.value as Vector3).copy(sky.top);
    (u.uMid!.value as Vector3).copy(sky.mid);
    (u.uBottom!.value as Vector3).copy(sky.bottom);
    (u.uSun!.value as Vector3).copy(sky.sun);
    // Sun travels in a gentle arc from lower-left (dawn) over the top to lower-right (dusk)
    const e = sky.sunElevation;
    const sunPos = u.uSunPos!.value as Vector2;
    sunPos.set(0.9 - Math.max(0, e) * 0.14, 0.52 + e * 0.4);
    u.uSunStrength!.value = Math.max(0, Math.min(1, (e + 0.1) * 3));
    u.uStars!.value = sky.stars;
    u.uTime!.value = time;
    u.uAspect!.value = aspect;
    u.uScroll!.value = scroll;
  }
}

/** Sky colour as a THREE.Color (sRGB) for fog / clear colour usage. */
export function skyBottomColor(sky: SkyBlend): Color {
  return new Color().setRGB(sky.bottom.x, sky.bottom.y, sky.bottom.z);
}
