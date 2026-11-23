import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDisplayHandler, DISPLAY_KEY, COMMIT_SCRIPT, RATE_SCRIPT } from '../vercel-backend/lib/display-handler.js';
import { getCutoverSlot, selectDisplay } from '../vercel-backend/lib/selection.js';

const catalog = JSON.parse(readFileSync(new URL('../vercel-backend/lib/catalog.json', import.meta.url), 'utf8'));
const token = 'test-only-change-code-123456789';
const today = new Date('2026-11-23T12:00:00Z');
// Atomic store double deliberately yields on reads so independent handlers see
// the same old revision. eval models Redis compare-and-set semantics.
class Store {
  state = null;
  rates = new Map();
  async get(key) {
    assert.equal(key, DISPLAY_KEY);
    const value = structuredClone(this.state);
    await new Promise((resolve) => setImmediate(resolve));
    return value;
  }
  async eval(script, keys, args) {
    if (script === COMMIT_SCRIPT) {
      assert.equal(keys[0], DISPLAY_KEY);
      if ((this.state?.revision || 0) !== args[0]) return 0;
      this.state = JSON.parse(args[1]);
      return 1;
    }
    assert.equal(script, RATE_SCRIPT);
    const count = (this.rates.get(keys[0]) || 0) + 1;
    this.rates.set(keys[0], count);
    return count;
  }
}
function setup({ now = () => today, ...options } = {}) {
  const store = new Store();
  const handler = createDisplayHandler({ store, catalog, now, writeToken: () => token, ...options });
  return { store, handler };
}
async function request(handler, { method = 'GET', code = token, body, origin, address = '127.0.0.1' } = {}) {
  const response = { headers: {}, code: 200,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; }, end() { return this; }
  };
  await handler({ method, body, headers: { origin, authorization: `Bearer ${code}`, 'x-forwarded-for': address } }, response);
  return response;
}

test('one selection and history update across concurrent first opens on separate instances', async () => {
  const { store, handler } = setup();
  const other = createDisplayHandler({ store, catalog, now: () => today, writeToken: () => token });
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => request(i % 2 ? other : handler)));
  for (const result of results) {
    assert.equal(result.code, 200);
    assert.deepEqual(result.data, results[0].data);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.ok(!('history' in result.data));
  }
  assert.equal(store.state.revision, 1);
  assert.equal(store.state.history.usedIds.length, 1);
  assert.equal(Object.values(store.state.history.quoteUsage).reduce((a, b) => a + b), 1);
});

test('GET is stable, protected replacement is shared, and stale writes do not consume history', async () => {
  const { store, handler } = setup();
  const first = await request(handler);
  assert.deepEqual((await request(handler)).data, first.data);
  const changed = await request(handler, { method: 'POST', body: { revision: first.data.revision } });
  assert.equal(changed.code, 200);
  assert.equal(changed.data.revision, 2);
  assert.notEqual(changed.data.soundtrack.id, first.data.soundtrack.id);
  assert.deepEqual((await request(handler)).data, changed.data);
  const stale = await request(handler, { method: 'POST', body: { revision: 1 } });
  assert.equal(stale.code, 409);
  assert.deepEqual(stale.data.display, changed.data);
  assert.equal(store.state.history.usedIds.length, 2);
});

test('simultaneous replacements commit once, including a retry after a lost response', async () => {
  const { store, handler } = setup();
  await request(handler);
  const results = await Promise.all(Array.from({ length: 8 }, () => request(handler, { method: 'POST', body: { revision: 1 } })));
  assert.equal(results.filter((r) => r.code === 200).length, 1);
  assert.equal(results.filter((r) => r.code === 409).length, 7);
  assert.equal(store.state.revision, 2);
  assert.equal(store.state.history.usedIds.length, 2);
  assert.equal((await request(handler, { method: 'POST', body: { revision: 1 } })).code, 409);
  assert.equal(store.state.revision, 2);
});

test('Copenhagen cutover is 08:00 in winter, summer, and both DST transition days', () => {
  for (const [date, utcHour] of [['2026-01-02', '07'], ['2026-07-02', '06'], ['2026-03-29', '06'], ['2026-10-25', '07']]) {
    const at = new Date(`${date}T${utcHour}:00:00Z`);
    assert.equal(getCutoverSlot(at), date);
    assert.notEqual(getCutoverSlot(new Date(at.getTime() - 1)), date);
  }
  assert.equal(getCutoverSlot(new Date('2027-01-01T06:59:59Z')), '2026-12-31');
});

test('daily rollover is shared and a stale replacement cannot reroll the new day', async () => {
  let date = new Date('2026-11-23T06:59:59Z');
  const { store, handler } = setup({ now: () => date });
  const before = await request(handler);
  assert.equal(before.data.slot, '2026-11-22');
  date = new Date('2026-11-23T07:00:00Z');
  const results = await Promise.all([request(handler), request(handler), request(handler, { method: 'POST', body: { revision: 1 } })]);
  assert.equal(results[0].data.slot, '2026-11-23');
  assert.deepEqual(results[0].data, results[1].data);
  assert.equal(results[2].code, 409);
  assert.equal(store.state.revision, 2);
});

test('shared soundtrack cycle avoids repeats; usage limits and year reset are preserved', () => {
  let state = null;
  const selections = [];
  for (let i = 0; i < catalog.soundtracks.length; i += 1) {
    state = selectDisplay(state, catalog, today);
    selections.push(state.display.soundtrack.id);
    assert.ok(Object.values(state.history.quoteUsage).every((count) => count <= 3));
    assert.ok(Object.values(state.history.nicknameUsage).every((count) => count <= 3));
  }
  assert.equal(new Set(selections).size, catalog.soundtracks.length);
  state = selectDisplay(state, catalog, today);
  assert.equal(state.history.usedIds.length, 1);
  const nextYear = selectDisplay(state, catalog, new Date('2027-01-01T07:00:00Z'));
  assert.equal(Object.values(nextYear.history.quoteUsage).reduce((a, b) => a + b), 1);
  assert.equal(nextYear.history.usedIds.length, 2);
});

test('auth, CORS, validation, disabled configuration, and rate limits fail without changing state', async () => {
  const { store, handler } = setup();
  await request(handler);
  assert.equal((await request(handler, { method: 'POST', code: 'bad', body: { revision: 1 } })).code, 401);
  assert.equal((await request(handler, { method: 'POST', body: {} })).code, 400);
  assert.equal((await request(handler, { method: 'POST', body: { revision: 1, junk: 'x'.repeat(2000) } })).code, 413);
  assert.equal((await request(handler, { method: 'POST', origin: 'https://other.example', body: { revision: 1 } })).code, 403);
  assert.equal((await request(handler, { method: 'DELETE' })).code, 405);
  assert.equal((await request(handler, { method: 'OPTIONS' })).code, 204);
  for (let i = 0; i < 20; i += 1) await request(handler, { method: 'POST', code: 'bad', address: 'other-device' });
  assert.equal((await request(handler, { method: 'POST', address: 'other-device', body: { revision: 1 } })).code, 429);
  assert.equal(store.state.revision, 1);
  const disabled = createDisplayHandler({ store, catalog, now: () => today, writeToken: () => undefined });
  assert.equal((await request(disabled, { method: 'POST', body: { revision: 1 } })).code, 503);
  assert.equal((await request(disabled)).code, 200);
});

test('store outage returns 503 rather than fabricating a local or server selection', async (t) => {
  t.mock.method(console, 'error', () => {});
  const handler = createDisplayHandler({ store: { get: async () => { throw new Error('offline'); } }, catalog });
  const result = await request(handler);
  assert.equal(result.code, 503);
  assert.equal(result.data.error, 'Shared entry is temporarily unavailable');
});
