import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(process.argv[2] || "out");
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
const paths = (await files(root)).filter(file => path.relative(root, file) !== "sw.js").sort();
// Include this generator too, so worker logic changes also retire the old cache.
const hash = createHash("sha256").update(await readFile(new URL(import.meta.url)));
for (const file of paths) {
  hash.update(path.relative(root, file));
  hash.update(await readFile(file));
}
const cacheName = `everyday-love-${hash.digest("hex").slice(0, 16)}`;
// Error documents are excluded because their HTTP status would abort installation.
const assets = ["./", ...paths.filter(file => /\.(js|css|png|svg|webmanifest|woff2?)$/.test(file)).map(file => "./" + path.relative(root, file).split(path.sep).join("/"))];
const worker = `// Generated from the static export; do not edit.
const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify(assets)};
const ROOT = self.registration.scope;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Bypass the HTTP cache so a new worker cannot precache stale HTML or icons.
    await cache.addAll(ASSETS.map(asset => new Request(new URL(asset, ROOT), { cache: 'reload' })));
  })());
});
// Deliberately no skipWaiting: existing windows finish using their current version.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('everyday-love-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(ROOT)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate' && (url.pathname === new URL(ROOT).pathname || url.pathname === new URL('index.html', ROOT).pathname)) {
      return (await cache.match(ROOT)) || fetch(request);
    }
    return (await cache.match(request)) || fetch(request);
  })());
});
`;
await writeFile(path.join(root, "sw.js"), worker);
console.log(`Generated ${cacheName} with ${assets.length} offline assets.`);
