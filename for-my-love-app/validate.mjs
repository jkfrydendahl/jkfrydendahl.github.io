import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildCatalog } from './scripts/build-catalog.mjs';

const context = vm.createContext({ window: {} });
for (const filename of ['content.js', 'soundtracks.js']) {
  vm.runInContext(fs.readFileSync(new URL(filename, import.meta.url), 'utf8'), context, { filename });
}
const { quotes, nicknames, nicknameEmojis, quoteEmojis } = context.window.APP_CONTENT;
const soundtracks = context.window.SOUNDTRACKS;
assert.ok(quotes.length > 0);
assert.ok(nicknames.length > 0);
assert.equal(nicknames.length, nicknameEmojis.length);
assert.ok(quoteEmojis.length <= quotes.length);
const ids = new Set();
for (const track of soundtracks) {
  assert.match(track.id, /^[A-Za-z0-9]{22}$/);
  assert.ok(!ids.has(track.id), `Duplicate Spotify ID: ${track.id}`);
  ids.add(track.id);
  assert.ok(track.title?.trim() && track.artist?.trim() && track.themes?.length);
}
assert.equal(fs.readFileSync(new URL('./vercel-backend/lib/catalog.json', import.meta.url), 'utf8'), buildCatalog(),
  'Regenerate the backend catalog after editing content.js or soundtracks.js');
JSON.parse(fs.readFileSync(new URL('./manifest.webmanifest', import.meta.url), 'utf8'));
const workerContext = vm.createContext({ URL, self: {
  addEventListener() {}, clients: {}, registration: { scope: 'https://jkfrydendahl.github.io/for-my-love-app/' }
} });
vm.runInContext(fs.readFileSync(new URL('./sw.js', import.meta.url), 'utf8'), workerContext);
assert.equal(workerContext.getSafeTarget('./?from=push'), 'https://jkfrydendahl.github.io/for-my-love-app/?from=push');
assert.equal(workerContext.getSafeTarget('https://example.com'), 'https://jkfrydendahl.github.io/for-my-love-app/');
assert.equal(workerContext.getSafeTarget('/outside/'), 'https://jkfrydendahl.github.io/for-my-love-app/');
console.log(`Validated ${quotes.length} quotes, ${nicknames.length} nicknames, and ${soundtracks.length} soundtracks; backend catalog matches.`);
