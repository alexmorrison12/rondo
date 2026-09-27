/**
 * OKLCH → sRGB, so canvas and WebGL colours come from the same OKLCH values as the CSS tokens.
 */
export type RGB = [number, number, number];

/** Linear-light sRGB (0–1) from OKLCH. */
export function oklchToLinear(L: number, C: number, h: number): RGB {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const toSrgbChannel = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** Gamma-encoded sRGB (0–1). */
export function oklchToSrgb(L: number, C: number, h: number): RGB {
  return oklchToLinear(L, C, h).map(toSrgbChannel) as RGB;
}

export function rgbCss([r, g, b]: RGB, alpha = 1): string {
  const to = (v: number) => Math.round(clamp01(v) * 255);
  return alpha >= 1 ? `rgb(${to(r)} ${to(g)} ${to(b)})` : `rgb(${to(r)} ${to(g)} ${to(b)} / ${alpha})`;
}

export function oklchCss(L: number, C: number, h: number, alpha = 1): string {
  return rgbCss(oklchToSrgb(L, C, h), alpha);
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** OKLCH triples for the four ring colours (Pulse, Root, Glow, Spark). */
export const RING_OKLCH: [number, number, number][] = [
  [0.72, 0.19, 35],
  [0.88, 0.15, 88],
  [0.82, 0.12, 180],
  [0.8, 0.12, 300],
];

/** Anodised finishes in OKLCH: [base, highlight, shadow]. */
export const FINISH_OKLCH: Record<string, [number, number, number][]> = {
  noon: [
    [0.68, 0.1, 240],
    [0.9, 0.05, 230],
    [0.45, 0.1, 250],
  ],
  ember: [
    [0.64, 0.14, 33],
    [0.86, 0.07, 45],
    [0.42, 0.12, 30],
  ],
  moon: [
    [0.82, 0.006, 250],
    [0.97, 0.004, 250],
    [0.58, 0.01, 250],
  ],
  eclipse: [
    [0.27, 0.01, 260],
    [0.5, 0.012, 260],
    [0.14, 0.01, 260],
  ],
};
