/**
 * Base-aware internal URLs. The site is served from a sub-path on GitHub Pages
 * (e.g. /rondo/), so every internal link goes through here.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path = '/'): string {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${clean}`;
}

/** Strip the base from a pathname so pages can be matched regardless of deployment. */
export function stripBase(pathname: string): string {
  if (BASE && pathname.startsWith(BASE)) return pathname.slice(BASE.length) || '/';
  return pathname;
}

/** Absolute URL for sharing / OG tags (client side uses location.origin). */
export function absolute(path: string, origin: string): string {
  return new URL(url(path), origin).toString();
}
