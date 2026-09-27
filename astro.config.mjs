// @ts-check
import { defineConfig } from 'astro/config';

// Deployed to GitHub Pages as a project site: https://alexmorrison12.github.io/rondo/
// SITE and BASE can be overridden (e.g. for a custom domain) without touching code.
const site = process.env.SITE ?? 'https://alexmorrison12.github.io';
const base = process.env.BASE ?? '/rondo';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  devToolbar: { enabled: false },
  // Respect an assigned port (e.g. from a preview harness); fall back to Astro's default.
  server: { port: Number(process.env.PORT) || 4321 },
  vite: {
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 900,
    },
  },
});
