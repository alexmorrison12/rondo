#!/usr/bin/env node
/**
 * Generate raster assets from the real design, in headless Chrome:
 *   - product renders from the procedural 3D model (public/renders/*.webp)
 *   - favicons + PWA icons from public/favicon.svg
 *   - Open Graph cards for every page (public/og/*.png), composed with the renders,
 *     the generated clouds and the Archivo font.
 *
 *   node tools/render-assets.mjs [baseUrl]      (dev server must be running)
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'http://localhost:4331/rondo').replace(/\/$/, '');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const tmp = path.join(root, 'review', 'asset-src');
const pub = (...p) => path.join(root, 'public', ...p);

const RENDERS = [
  { name: 'rondo-hero', finish: 'noon', pose: 'hero' },
  { name: 'rondo-ember', finish: 'ember', pose: 'hero' },
  { name: 'rondo-moon', finish: 'moon', pose: 'hero' },
  { name: 'rondo-eclipse', finish: 'eclipse', pose: 'hero', sky: 5.6 },
  { name: 'rondo-top', finish: 'noon', pose: 'top' },
  { name: 'rondo-side', finish: 'moon', pose: 'side' },
  { name: 'rondo-exploded', finish: 'noon', pose: 'exploded' },
  { name: 'rondo-base-founders', finish: 'eclipse', pose: 'base', sky: 5.6, serial: 427 },
];

const SKY = {
  morning: ['oklch(0.64 0.12 244)', 'oklch(0.93 0.03 215)'],
  noon: ['oklch(0.57 0.15 250)', 'oklch(0.86 0.07 228)'],
  afternoon: ['oklch(0.6 0.13 247)', 'oklch(0.9 0.05 210)'],
  golden: ['oklch(0.55 0.1 258)', 'oklch(0.72 0.09 300)', 'oklch(0.86 0.12 72)'],
  dusk: ['oklch(0.3 0.09 280)', 'oklch(0.48 0.11 320)', 'oklch(0.72 0.15 40)'],
  night: ['oklch(0.11 0.03 266)', 'oklch(0.23 0.05 256)'],
  founders: ['oklch(0.12 0.02 266)', 'oklch(0.2 0.04 80)'],
  haze: ['oklch(0.975 0.008 235)', 'oklch(0.93 0.02 230)'],
};

const OG = [
  { slug: 'default', title: 'Play in circles.', sub: 'A palm-sized instrument with four turning rings.', sky: 'morning', render: 'rondo-hero' },
  { slug: 'play', title: 'Play Rondo in your browser.', sub: 'Four rings. Five voices. Nothing to install.', sky: 'noon', render: 'rondo-top' },
  { slug: 'shop', title: 'Choose your Rondo.', sub: 'Noon, Ember or Moon. From $449.', sky: 'afternoon', render: 'rondo-ember' },
  { slug: 'instrument', title: 'Every detail, on purpose.', sub: 'Aluminium, steel and sapphire.', sky: 'afternoon', render: 'rondo-side' },
  { slug: 'loops', title: 'Loops made on Rondo.', sub: 'Tap one. Then make your own.', sky: 'night', render: 'rondo-top' },
  { slug: 'story', title: 'Built for the next ten years.', sub: 'No subscription. Open firmware. Made to be opened.', sky: 'dusk', render: 'rondo-moon' },
  { slug: 'support', title: 'Help, answered straight.', sub: 'Shipping, returns, MIDI and repairs.', sky: 'haze', render: 'rondo-hero' },
  { slug: 'launch-plan', title: 'From first signal to steady orbit.', sub: 'The Rondo launch plan.', sky: 'night', render: 'rondo-eclipse' },
  { slug: 'signal', title: 'Something small is coming into orbit.', sub: '17 · 11 · 2026', sky: 'night', render: null },
  { slug: 'founders', title: 'Claim your number.', sub: '2,000 Founders Editions. Black and brass.', sky: 'founders', render: 'rondo-eclipse' },
  { slug: 'launch', title: 'Ten seconds to your first song.', sub: 'Pre-order Rondo for $449.', sky: 'noon', render: 'rondo-hero' },
  { slug: 'gift', title: 'Give someone a song.', sub: 'A loop now. A Rondo in spring.', sky: 'golden', render: 'rondo-ember' },
  { slug: 'creators', title: 'Your next sound is a circle.', sub: 'The Rondo creator program.', sky: 'noon', render: 'rondo-moon' },
  { slug: 'loop', title: 'Someone made you a loop.', sub: 'Tap to hear it. Then make one back.', sky: 'dusk', render: 'rondo-top' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toWebp = (src, dest, q = 86) =>
  execFileSync('python3', ['-c', `from PIL import Image; Image.open(${JSON.stringify(src)}).save(${JSON.stringify(dest)}, 'WEBP', quality=${q}, method=6)`]);

async function main() {
  await mkdir(tmp, { recursive: true });
  await mkdir(pub('renders'), { recursive: true });
  await mkdir(pub('og'), { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();

  const ogOnly = process.argv.includes('--og-only');

  // 1. Product renders
  for (const r of ogOnly ? [] : RENDERS) {
    const size = 1600;
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    const q = new URLSearchParams({ finish: r.finish, pose: r.pose, size: String(size), ...(r.sky ? { sky: String(r.sky) } : {}), ...(r.serial ? { serial: String(r.serial) } : {}) });
    await page.goto(`${base}/render/?${q}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__ready === true', { timeout: 60000 });
    await sleep(200);
    const png = path.join(tmp, `${r.name}.png`);
    const el = await page.$('#render');
    await el.screenshot({ path: png, omitBackground: true });
    toWebp(png, pub('renders', `${r.name}.webp`));
    console.log('✓ render', r.name);
  }

  // 2. Favicons
  const svg = await readFile(pub('favicon.svg'), 'utf8');
  const svgData = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  for (const [file, size] of ogOnly ? [] : [
    ['favicon-32.png', 32],
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ]) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;background:transparent"><img src="${svgData}" width="${size}" height="${size}" style="display:block"></body></html>`);
    await sleep(100);
    await page.screenshot({ path: pub(file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('✓ icon', file);
  }

  // 3. OG cards
  const fontUrl = pathToFileURL(path.join(root, 'src/assets/fonts/archivo-latin.woff2')).href;
  const cloud = (i) => pathToFileURL(pub('textures', `cloud-${i}.webp`)).href;
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  for (const card of OG) {
    const stops = SKY[card.sky];
    const dark = ['night', 'dusk', 'founders'].includes(card.sky);
    const ink = dark ? 'oklch(0.93 0.025 250)' : 'oklch(0.2 0.03 258)';
    const render = card.render ? pathToFileURL(pub('renders', `${card.render}.webp`)).href : null;
    const clouds = ['morning', 'noon', 'afternoon', 'golden'].includes(card.sky)
      ? `<img class="cloud" src="${cloud(1)}" style="left:420px;top:-70px;width:520px;opacity:.9"><img class="cloud" src="${cloud(4)}" style="right:-120px;bottom:-40px;width:640px;opacity:.85">`
      : '';
    const ring = card.render
      ? `<img class="product${card.render === 'rondo-top' ? ' product--top' : ''}" src="${render}">`
      : `<svg class="ringart" viewBox="-100 -100 200 200"><circle r="80" fill="none" stroke="rgba(208,224,242,.3)" stroke-width="1.6"/>${[0, 3, 6, 8, 11, 13]
          .map((s) => {
            const a = -Math.PI / 2 + (s / 16) * Math.PI * 2;
            return `<circle cx="${(Math.cos(a) * 80).toFixed(1)}" cy="${(Math.sin(a) * 80).toFixed(1)}" r="4" fill="#fff4c8"/><circle cx="${(Math.cos(a) * 80).toFixed(1)}" cy="${(Math.sin(a) * 80).toFixed(1)}" r="11" fill="rgba(255,227,98,.25)"/>`;
          })
          .join('')}<circle r="14" fill="rgba(255,227,98,.5)"/></svg>`;
    const stars = dark
      ? Array.from({ length: 90 }, (_, i) => `<i style="left:${(i * 137.5) % 1200}px;top:${(i * 71.3) % 630}px;opacity:${0.2 + ((i * 7) % 10) / 14}"></i>`).join('')
      : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @font-face { font-family: Archivo; src: url('${fontUrl}') format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }
      *{box-sizing:border-box;margin:0}
      body{width:1200px;height:630px;overflow:hidden;position:relative;font-family:Archivo,sans-serif;color:${ink};
        background:linear-gradient(to bottom, ${stops.join(',')});}
      .stars i{position:absolute;width:2px;height:2px;border-radius:50%;background:#e8f0ff}
      .cloud{position:absolute;filter:brightness(1.12)}
      .product{position:absolute;right:-70px;top:50%;width:640px;transform:translateY(-50%)}
      .product--top{right:44px;width:470px}
      .ringart{position:absolute;right:80px;top:50%;width:440px;transform:translateY(-50%)}
      .copy{position:absolute;left:72px;top:64px;bottom:64px;width:620px;display:flex;flex-direction:column;justify-content:space-between}
      h1{font-size:${card.title.length > 28 ? 64 : 76}px;font-weight:800;font-stretch:120%;letter-spacing:-0.02em;line-height:.98}
      p{font-size:26px;font-weight:450;opacity:.85;margin-top:18px}
      .mark{height:30px;width:153px;align-self:flex-start}
      .url{font-size:18px;font-weight:600;font-stretch:90%;opacity:.7}
    </style></head><body>
      <div class="stars">${stars}</div>${clouds}${ring}
      <div class="copy">
        <svg class="mark" viewBox="0 0 509 100" fill="none" stroke="currentColor" stroke-width="22"><clipPath id="c"><rect x="-2" y="0" width="513" height="100"/></clipPath><g clip-path="url(#c)"><path d="M11 -10 V110"/><path d="M0 11 H45 A27 27 0 0 1 45 65 H11"/><path d="M44 62 L78 110"/><circle cx="147" cy="50" r="39"/><path d="M222 -10 V110 M286 -10 V110 M222 -10 L286 110"/><path d="M322 -10 V110"/><path d="M311 11 H345 A39 39 0 0 1 345 89 H311"/></g><circle cx="459" cy="50" r="39"/><circle cx="459" cy="50" r="10" fill="currentColor" stroke="none"/></svg>
        <div><h1>${card.title}</h1><p>${card.sub}</p></div>
        <span class="url">alexmorrison12.github.io/rondo</span>
      </div></body></html>`;
    const file = path.join(tmp, `og-${card.slug}.html`);
    await writeFile(file, html);
    await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await sleep(150);
    await page.screenshot({ path: pub('og', `${card.slug}.png`) });
    console.log('✓ og', card.slug);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
