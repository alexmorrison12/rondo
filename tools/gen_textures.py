#!/usr/bin/env python3
"""
Generate the site's procedural textures (no stock assets needed).

  public/textures/cloud-{0..5}.webp   Soft cumulus sprites: greyscale light in RGB, coverage in alpha.
                                      Lit from above so they can be tinted by the time-of-day sky.

Run: npm run assets:textures
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "public" / "textures"
OUT.mkdir(parents=True, exist_ok=True)


def value_noise(shape, scale, rng):
    """Smooth value noise via bicubic upsampling of a random grid."""
    h, w = shape
    gh, gw = max(2, int(h / scale) + 2), max(2, int(w / scale) + 2)
    grid = rng.random((gh, gw)).astype(np.float32)
    img = Image.fromarray((grid * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(img, dtype=np.float32) / 255.0


def fbm(shape, rng, base=64, octaves=6, gain=0.52):
    total = np.zeros(shape, np.float32)
    amp, norm, scale = 1.0, 0.0, base
    for _ in range(octaves):
        total += value_noise(shape, scale, rng) * amp
        norm += amp
        amp *= gain
        scale = max(2, scale / 2)
    return total / norm


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def cloud(seed, w=768, h=384):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = (xx / w) * 2 - 1, (yy / h) * 2 - 1  # ny: -1 top, +1 bottom
    aspect = w / h

    # Base shape: a cluster of gaussian puffs, domed in the middle, lower at the sides.
    dens = np.zeros((h, w), np.float32)
    for _ in range(rng.integers(8, 13)):
        cx = rng.uniform(-0.6, 0.6)
        r = rng.uniform(0.12, 0.25) * (1.0 - abs(cx) * 0.55)
        # rx/ry in normalised units; ry = r * aspect makes the puff round in pixels.
        rx, ry = r, r * aspect * rng.uniform(0.85, 1.05)
        cy = 0.34 - ry * 0.55 + rng.uniform(-0.04, 0.04)  # puffs rest on a shared base
        d2 = ((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2
        dens += np.exp(-d2 * 1.4)
    dens *= smoothstep(0.5, 0.26, ny)  # flat underside
    dens *= smoothstep(1.0, 0.8, np.abs(nx))  # keep inside the frame

    # Erode the silhouette with noise so edges billow instead of looking cut out.
    n_big = fbm((h, w), rng, base=70, octaves=6)
    n_small = fbm((h, w), rng, base=18, octaves=4)
    dens = dens * (0.75 + 0.5 * n_big) - 0.22 + (n_small - 0.5) * 0.22
    alpha = smoothstep(0.02, 0.55, dens)

    # Self-shadowing: a pixel is darker when there is cloud above it (light from the top).
    shift = int(h * 0.06)
    above = np.roll(dens, shift, axis=0)
    above[:shift] = 0
    shade = 1.0 - np.clip(above * 0.9, 0, 1) * 0.5
    belly = smoothstep(-0.2, 0.3, ny)  # cooler, greyer underside
    light = 0.66 + 0.34 * shade - 0.16 * belly + (n_small - 0.5) * 0.1
    light = np.clip(light, 0.42, 1.0)

    alpha_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    lum_img = Image.fromarray((light * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.0))
    return Image.merge("RGBA", (lum_img, lum_img, lum_img, alpha_img))


def main():
    for i in range(6):
        img = cloud(seed=1000 + i * 17)
        img.save(OUT / f"cloud-{i}.webp", "WEBP", quality=82, method=6)
        print("wrote", OUT / f"cloud-{i}.webp")


if __name__ == "__main__":
    main()
