import { createHash, timingSafeEqual } from 'node:crypto';
import { getCutoverSlot, publicDisplay, selectDisplay } from './selection.js';

export const DISPLAY_KEY = 'love-display:v1';
// Compare revision and write selection + history in one Redis operation. An old
// reader can never overwrite a newer display, even across serverless instances.
export const COMMIT_SCRIPT = `
local current = redis.call('GET', KEYS[1])
local revision = 0
if current then revision = cjson.decode(current).revision end
if revision ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;
export const RATE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
`;

function authorized(header, token) {
  if (typeof header !== 'string') return false;
  const hash = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(header), hash(`Bearer ${token}`));
}

function readState(value) {
  const state = typeof value === 'string' ? JSON.parse(value) : value;
  if (state !== null && state !== undefined && (
    !Number.isSafeInteger(state.revision) || state.revision < 1 ||
    !state.display || !state.history || !Array.isArray(state.history.usedIds)
  )) throw new Error('Invalid shared display state');
  return state || null;
}

export function createDisplayHandler({ store, catalog, now = () => new Date(),
  random = Math.random, writeToken = () => process.env.DISPLAY_WRITE_TOKEN }) {
  const isCurrent = (state, date) => state &&
    state.catalogVersion === catalog.version && state.display.slot === getCutoverSlot(date);
  const commit = (previous, next) => store.eval(COMMIT_SCRIPT,
    [DISPLAY_KEY], [previous?.revision || 0, JSON.stringify(next)]);

  async function ensureCurrent() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const state = readState(await store.get(DISPLAY_KEY));
      const date = now();
      if (isCurrent(state, date)) return state;
      const next = selectDisplay(state, catalog, date, random);
      if (await commit(state, next)) return next;
    }
    throw new Error('Shared display is busy');
  }

  return async function handler(req, res) {
    const origin = 'https://jkfrydendahl.github.io';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    if (req.headers.origin && req.headers.origin !== origin) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      if (req.method === 'GET') return res.status(200).json(publicDisplay(await ensureCurrent()));
      const token = writeToken();
      if (!token || token.length < 16) {
        return res.status(503).json({ error: 'Changing entries has not been configured yet' });
      }
      const address = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
        .split(',')[0].trim();
      const key = `love-display-rate:${createHash('sha256').update(address).digest('hex').slice(0, 24)}`;
      if (await store.eval(RATE_SCRIPT, [key], [900]) > 20) {
        res.setHeader('Retry-After', '900');
        return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
      }
      if (!authorized(req.headers.authorization, token)) {
        return res.status(401).json({ error: 'Incorrect change code' });
      }
      const size = Buffer.byteLength(JSON.stringify(req.body ?? null));
      if (size > 1024 || Number(req.headers['content-length'] || 0) > 1024) {
        return res.status(413).json({ error: 'Request body too large' });
      }
      if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 1) {
        return res.status(400).json({ error: 'A current display revision is required' });
      }
      const state = await ensureCurrent();
      if (req.body.revision !== state.revision) {
        return res.status(409).json({ error: 'The entry has already changed', display: publicDisplay(state) });
      }
      const next = selectDisplay(state, catalog, now(), random);
      if (!await commit(state, next)) {
        return res.status(409).json({ error: 'The entry has already changed', display: publicDisplay(await ensureCurrent()) });
      }
      return res.status(200).json(publicDisplay(next));
    } catch (error) {
      console.error('Shared display unavailable:', error);
      return res.status(503).json({ error: 'Shared entry is temporarily unavailable' });
    }
  };
}
