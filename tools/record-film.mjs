#!/usr/bin/env node
/** Record the 12 s vertical teaser (public/film/rondo-teaser.webm). Dev server must be running. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] ?? 'http://localhost:4331/rondo').replace(/\/$/, '');
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 700 });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${base}/film/`, { waitUntil: 'networkidle0' });
const b64 = await page.evaluate(() => window.__record(), { timeout: 120000 });
await mkdir(path.join(root, 'public/film'), { recursive: true });
const file = path.join(root, 'public/film/rondo-teaser.webm');
await writeFile(file, Buffer.from(b64, 'base64'));
console.log('✓', file, (Buffer.from(b64, 'base64').length / 1e6).toFixed(1), 'MB');
await browser.close();
