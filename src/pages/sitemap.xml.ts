import type { APIRoute } from 'astro';

const PAGES = [
  '/',
  '/play/',
  '/instrument/',
  '/loops/',
  '/story/',
  '/shop/',
  '/support/',
  '/lp/signal/',
  '/lp/founders/',
  '/lp/launch/',
  '/lp/gift/',
  '/lp/creators/',
];

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const origin = site ?? new URL('https://alexmorrison12.github.io');
  const urls = PAGES.map((p) => `<url><loc>${new URL(base + p, origin).toString()}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
