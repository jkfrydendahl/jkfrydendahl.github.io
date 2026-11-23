import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function display(revision = 1) {
  return { revision, slot: '2026-11-23', quote: `Quote ${revision}`, nickname: 'Love',
    nicknameEmoji: '💖', quoteEmoji: '✨', soundtrack: null };
}
function client(fetch, { cached, blockedStorage = false } = {}) {
  const elements = new Map();
  const listeners = new Map();
  const intervals = [];
  const values = new Map(cached ? [['sharedDailyDisplay-v1', JSON.stringify(cached)]] : []);
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', value: '', hidden: false, open: false,
      disabled: false, addEventListener() {}, setAttribute() {},
      showModal() { this.open = true; }, close() { this.open = false; }
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    fetch, AbortController, Intl, Date, URL, console, atob,
    setTimeout() { return 1; }, clearTimeout() {},
    setInterval(callback) { intervals.push(callback); },
    localStorage: {
      getItem(key) { if (blockedStorage) throw Error('blocked'); return values.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw Error('blocked'); values.set(key, value); },
      removeItem(key) { if (blockedStorage) throw Error('blocked'); values.delete(key); }
    },
    navigator: { userAgent: '' },
    document: { hidden: false, getElementById: element, addEventListener(type, handler) { listeners.set(type, handler); } },
    addEventListener(type, handler) { listeners.set(type, handler); }
  });
  context.window = context;
  vm.runInContext(source, context);
  return { context, element, values, intervals, listeners };
}
function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

test('slow earlier response never overwrites a newer shared entry', async () => {
  let resolve;
  const app = client(() => new Promise((r) => { resolve = r; }));
  const pending = app.context.syncDisplay();
  app.context.acceptDisplay(display(2));
  resolve(response(display(1)));
  await pending;
  assert.equal(app.element('quote').textContent, 'Quote 2');
});

test('backend response replaces an old cache even if the cached revision was higher', async () => {
  const app = client(async () => response(display(1)), { cached: display(99) });
  await app.context.initializeApp();
  await app.context.syncDisplay();
  assert.equal(app.element('quote').textContent, 'Quote 1');
  assert.equal(app.element('sync-status').textContent, 'Synced');
});

test('offline startup preserves and labels the cached entry, including its old date', async () => {
  const old = { ...display(5), slot: '2020-01-01' };
  const app = client(async () => { throw Error('offline'); }, { cached: old });
  await app.context.initializeApp();
  await app.context.syncDisplay();
  assert.equal(app.element('quote').textContent, 'Quote 5');
  assert.match(app.element('sync-status').textContent, /Saved entry from 2020-01-01/);
  await app.context.changeDisplay('code');
  assert.equal(app.element('quote').textContent, 'Quote 5');
  assert.ok(!app.values.has('displayChangeCode-v1'));
});

test('uncached outage explains the failure without generating a separate entry', async () => {
  const app = client(async () => { throw Error('offline'); });
  await app.context.initializeApp();
  await app.context.syncDisplay();
  assert.match(app.element('quote').textContent, /unavailable/);
  assert.equal(app.values.size, 0);
});

test('incorrect code is forgotten; a successful change stores code and renders server result', async () => {
  const calls = [];
  let valid = false;
  const app = client(async (_url, options) => {
    calls.push(options);
    return options.method === 'POST'
      ? valid ? response(display(2)) : response({ error: 'Incorrect change code' }, 401)
      : response(display(1));
  });
  app.values.set('displayChangeCode-v1', JSON.stringify('old-code'));
  await app.context.changeDisplay('bad-code');
  assert.equal(app.element('change-code-dialog').open, true);
  assert.match(app.element('change-code-error').textContent, /Incorrect/);
  assert.ok(!app.values.has('displayChangeCode-v1'));
  valid = true;
  await app.context.changeDisplay('new-code');
  assert.equal(app.element('quote').textContent, 'Quote 2');
  assert.equal(app.element('change-code-dialog').open, false);
  assert.equal(JSON.parse(app.values.get('displayChangeCode-v1')), 'new-code');
  const post = calls.find((call) => call.method === 'POST');
  assert.deepEqual(JSON.parse(post.body), { revision: 1 });
  assert.equal(post.headers.Authorization, 'Bearer bad-code');
});

test('conflict displays the winning entry; storage denial does not prevent syncing', async () => {
  const app = client(async (_url, options) => options.method === 'POST'
    ? response({ display: display(3) }, 409) : response(display(2)), { blockedStorage: true });
  await app.context.initializeApp();
  await app.context.syncDisplay();
  await app.context.changeDisplay('code');
  assert.equal(app.element('quote').textContent, 'Quote 3');
  assert.match(app.element('sync-status').textContent, /another device/);
  assert.equal(app.element('reset-display').disabled, false);
});

test('polling skips hidden pages; reconnect and focus fetch the newest entry', async () => {
  let revision = 1;
  const app = client(async () => response(display(revision)));
  await app.context.initializeApp();
  await app.context.syncDisplay();
  revision = 2;
  app.context.document.hidden = true;
  app.intervals[0]();
  assert.equal(app.element('quote').textContent, 'Quote 1');
  app.context.document.hidden = false;
  app.listeners.get('online')();
  await app.context.syncDisplay();
  assert.equal(app.element('quote').textContent, 'Quote 2');
  revision = 3;
  app.intervals[0]();
  await app.context.syncDisplay();
  assert.equal(app.element('quote').textContent, 'Quote 3');
  revision = 4;
  app.listeners.get('focus')();
  await app.context.syncDisplay();
  assert.equal(app.element('quote').textContent, 'Quote 4');
});
