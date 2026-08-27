import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const appDirectory = path.dirname(fileURLToPath(import.meta.url));

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

const elements = new Map();
const getElement = (id) => {
  if (!elements.has(id)) {
    elements.set(id, {
      addEventListener() {},
      hidden: false,
      href: '',
      setAttribute() {},
      textContent: ''
    });
  }
  return elements.get(id);
};

const context = {
  alert() {},
  atob,
  clearInterval() {},
  clearTimeout() {},
  console,
  document: {
    addEventListener() {},
    hidden: false,
    getElementById: getElement
  },
  fetch: async () => ({ ok: true }),
  localStorage: new MemoryStorage(),
  navigator: {
    serviceWorker: undefined,
    standalone: false,
    userAgent: ''
  },
  setInterval() {},
  setTimeout() {},
  URL
};
context.window = context;
vm.createContext(context);

for (const filename of ['content.js', 'soundtracks.js', 'app.js']) {
  const source = fs.readFileSync(path.join(appDirectory, filename), 'utf8');
  vm.runInContext(source, context, { filename });
}

const { quotes, nicknames, nicknameEmojis, quoteEmojis } =
  context.window.APP_CONTENT;
const soundtracks = context.window.SOUNDTRACKS;

assert.ok(quotes.length > 0, 'Quotes must not be empty');
assert.ok(nicknames.length > 0, 'Nicknames must not be empty');
assert.equal(
  nicknames.length,
  nicknameEmojis.length,
  'Every nickname must have a corresponding emoji'
);
assert.ok(
  quoteEmojis.length <= quotes.length,
  'Quote emoji entries cannot outnumber quotes'
);

const soundtrackIds = new Set();
for (const track of soundtracks) {
  assert.match(track.id, /^[A-Za-z0-9]{22}$/, `Invalid Spotify ID: ${track.id}`);
  assert.ok(!soundtrackIds.has(track.id), `Duplicate Spotify ID: ${track.id}`);
  soundtrackIds.add(track.id);
  assert.ok(track.title?.trim(), `Track ${track.id} is missing a title`);
  assert.ok(track.artist?.trim(), `Track ${track.id} is missing an artist`);
  assert.ok(track.themes?.length, `Track ${track.id} is missing themes`);
}

for (let iteration = 0; iteration < 650; iteration += 1) {
  const quoteIndex = context.getWeightedIndex(quotes, 'testQuoteUsage');
  const nicknameIndex = context.getWeightedIndex(nicknames, 'testNicknameUsage');
  assert.ok(quoteIndex >= 0 && quoteIndex < quotes.length);
  assert.ok(nicknameIndex >= 0 && nicknameIndex < nicknames.length);
}

context.localStorage.setItem('broken-json', '{ definitely not JSON');
assert.deepEqual(
  context.readStoredJson('broken-json', { recovered: true }),
  { recovered: true }
);
assert.equal(context.localStorage.getItem('broken-json'), null);

const beforeCutover = new Date(2026, 0, 2, 7, 59);
const atCutover = new Date(2026, 0, 2, 8, 0);
assert.equal(context.getCutoverSlot(beforeCutover), '2026-01-01');
assert.equal(context.getCutoverSlot(atCutover), '2026-01-02');

context.localStorage.setItem(
  'dailyDisplayState-8-0-v1',
  '{ invalid daily state'
);
context.ensureDailyDisplay();
const firstDailyState = context.localStorage.getItem(
  'dailyDisplayState-8-0-v1'
);
assert.ok(firstDailyState, 'Malformed daily state should be replaced');
context.ensureDailyDisplay();
assert.equal(
  context.localStorage.getItem('dailyDisplayState-8-0-v1'),
  firstDailyState,
  'Daily state should remain stable within one cutover slot'
);

JSON.parse(
  fs.readFileSync(path.join(appDirectory, 'manifest.webmanifest'), 'utf8')
);

const workerContext = {
  URL,
  self: {
    addEventListener() {},
    clients: {},
    registration: {
      scope: 'https://jkfrydendahl.github.io/for-my-love-app/'
    }
  }
};
vm.createContext(workerContext);
vm.runInContext(
  fs.readFileSync(path.join(appDirectory, 'sw.js'), 'utf8'),
  workerContext,
  { filename: 'sw.js' }
);
assert.equal(
  workerContext.getSafeTarget('./?from=push'),
  'https://jkfrydendahl.github.io/for-my-love-app/?from=push'
);
assert.equal(
  workerContext.getSafeTarget('https://example.com/phishing'),
  'https://jkfrydendahl.github.io/for-my-love-app/'
);
assert.equal(
  workerContext.getSafeTarget('/outside-app/'),
  'https://jkfrydendahl.github.io/for-my-love-app/'
);

console.log(
  `Validated ${quotes.length} quotes, ${nicknames.length} nicknames, and ${soundtracks.length} unique soundtracks.`
);
