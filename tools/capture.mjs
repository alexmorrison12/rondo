#!/usr/bin/env node
/**
 * Screenshot the site in real (headless) Chrome for visual QA and design review.
 *
 *   node tools/capture.mjs [baseUrl] [--only=home,play] [--mobile] [--out=review/shots]
 *
 * Long pages are captured viewport-by-viewport at named scroll positions so fixed WebGL
 * backgrounds and scroll-driven states are captured the way a visitor sees them.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:4331/rondo').replace(/\/$/, '');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const outDir = args.find((a) => a.startsWith('--out='))?.slice(6) ?? 'review/shots';
const mobile = args.includes('--mobile');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PAGES = [
  { id: 'home', path: '/', scenes: true },
  { id: 'play', path: '/play/', steps: [0, 0.6] },
  { id: 'instrument', path: '/instrument/', steps: [0, 0.2, 0.4, 0.6, 0.8] },
  { id: 'shop', path: '/shop/', steps: [0, 0.5] },
  { id: 'checkout', path: '/checkout/', steps: [0], prep: 'cart' },
  { id: 'loops', path: '/loops/', steps: [0, 0.5] },
  { id: 'story', path: '/story/', steps: [0, 0.3, 0.6, 0.9] },
  { id: 'support', path: '/support/', steps: [0, 0.5] },
  { id: 'launch-plan', path: '/launch-plan/', steps: [0, 0.2, 0.4, 0.6, 0.8] },
  { id: 'lp-signal', path: '/lp/signal/', steps: [0, 0.6] },
  { id: 'lp-founders', path: '/lp/founders/', steps: [0, 0.5] },
  { id: 'lp-launch', path: '/lp/launch/', steps: [0, 0.3, 0.6, 0.9] },
  { id: 'lp-gift', path: '/lp/gift/', steps: [0, 0.4, 0.8] },
  { id: 'lp-creators', path: '/lp/creators/', steps: [0, 0.4, 0.8] },
  { id: '404', path: '/nope/', steps: [0] },
];

const viewport = mobile
  ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { width: 1440, height: 900, deviceScaleFactor: 1 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${page.url()} :: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // The 404 page reports its own (correct) 404 status; that isn't an error.
    if (page.url().includes('/nope/') && m.text().includes('404')) return;
    errors.push(`${page.url()} :: console: ${m.text()}`);
  });
  const suffix = mobile ? 'm' : 'd';

  for (const p of PAGES) {
    if (only && !only.includes(p.id)) continue;
    if (p.prep === 'cart') {
      await page.goto(`${base}/shop/`, { waitUntil: 'networkidle2' });
      await page.evaluate(() =>
        localStorage.setItem(
          'rondo:cart',
          JSON.stringify({ v: 2, d: [{ key: 'rondo|noon||', sku: 'rondo', name: 'Rondo', variant: 'Noon', price: 449, qty: 1, colorway: 'noon' }, { key: 'dock|||', sku: 'dock', name: 'Walnut dock', variant: 'Solid walnut', price: 39, qty: 1 }] }),
        ),
      );
    }
    await page.goto(`${base}${p.path}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1800);
    if (p.scenes) {
      const positions = await page.evaluate(() =>
        [...document.querySelectorAll('[data-scene]')].map((el) => {
          const top = el.getBoundingClientRect().top + window.scrollY;
          const h = el.offsetHeight;
          const vh = window.innerHeight;
          const tall = h > vh * 1.5;
          return { name: el.dataset.scene, y: tall ? top + (h - vh) * 0.55 : Math.max(0, top + h / 2 - vh / 2) };
        }),
      );
      for (const pos of positions) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), pos.y);
        await sleep(1700);
        const file = path.join(outDir, `${p.id}-${pos.name}-${suffix}.png`);
        await page.screenshot({ path: file });
        console.log('✓', file);
      }
    } else {
      const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      for (const [i, frac] of (p.steps ?? [0]).entries()) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(total * frac));
        await sleep(1000);
        const file = path.join(outDir, `${p.id}-${i}-${suffix}.png`);
        await page.screenshot({ path: file });
        console.log('✓', file);
      }
    }
  }
  await browser.close();
  if (errors.length) {
    console.log('\nPage errors:');
    for (const e of [...new Set(errors)]) console.log(' ✗', e);
  } else console.log('\nNo page errors.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
