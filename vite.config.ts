import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Relative manifest/SW URLs resolve within the repository's Pages directory.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  plugins: [{
    name: 'offline-interface',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle);
      const hash = createHash('sha256');
      const publicAssets = ['manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'third-party-notices.txt'];
      for (const file of publicAssets) hash.update(readFileSync(new URL(`./public/${file}`, import.meta.url)));
      for (const file of files.sort()) {
        const output = bundle[file];
        hash.update(file);
        hash.update(output.type === 'chunk' ? output.code : output.source);
      }
      const version = hash.digest('hex').slice(0, 16);
      const assets = ['./', './index.html', ...publicAssets.map(file => `./${file}`), ...files.map(file => `./${file}`)];
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const SCOPE = self.registration.scope;
const PREFIX = SCOPE + 'govorilka-';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify([...new Set(assets)])};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  // CacheStorage is origin-wide: remove only our old caches for this scope.
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(PREFIX) && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(SCOPE)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // Only same-origin public shell files are precached. Vary: Origin from a
    // preview host must not hide a cached module requested in CORS mode.
    const cached = await cache.match(event.request, { ignoreSearch: true, ignoreVary: true });
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) {
      if (event.request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      throw error;
    }
  }));
});
` });
    },
  }],
});
