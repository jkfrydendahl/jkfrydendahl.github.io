import { createHash } from 'node:crypto';
import { kv } from '@vercel/kv';

const ALLOW_ORIGIN = 'https://jkfrydendahl.github.io';
const MAX_BODY_BYTES = 8 * 1024;
const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 512;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_REQUESTS = 10;

function getMaxSubscriptions() {
  const configured = Number.parseInt(process.env.MAX_SUBSCRIPTIONS || '', 10);
  return Number.isInteger(configured) && configured > 0 ? configured : 25;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function getClientAddress(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const address = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0];

  return address?.trim() || req.socket?.remoteAddress || 'unknown';
}

function getRateLimitKey(req) {
  const addressHash = createHash('sha256')
    .update(getClientAddress(req))
    .digest('hex')
    .slice(0, 24);

  return `subscribe-rate:${addressHash}`;
}

async function isRateLimited(req) {
  const key = getRateLimitKey(req);
  const requests = await kv.incr(key);
  if (requests === 1) {
    await kv.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  return requests > RATE_LIMIT_REQUESTS;
}

function isValidSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') return false;

  const { endpoint, keys } = subscription;
  if (
    typeof endpoint !== 'string'
    || endpoint.length === 0
    || endpoint.length > MAX_ENDPOINT_LENGTH
  ) {
    return false;
  }

  try {
    if (new URL(endpoint).protocol !== 'https:') return false;
  } catch {
    return false;
  }

  return Boolean(
    keys
    && typeof keys === 'object'
    && typeof keys.p256dh === 'string'
    && keys.p256dh.length > 0
    && keys.p256dh.length <= MAX_KEY_LENGTH
    && typeof keys.auth === 'string'
    && keys.auth.length > 0
    && keys.auth.length <= MAX_KEY_LENGTH
  );
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestOrigin = req.headers.origin;
  if (requestOrigin && requestOrigin !== ALLOW_ORIGIN) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  const declaredLength = Number.parseInt(req.headers['content-length'] || '0', 10);
  if (declaredLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request body too large' });
  }

  let bodySize;
  try {
    bodySize = Buffer.byteLength(JSON.stringify(req.body ?? null), 'utf8');
  } catch {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  if (bodySize > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request body too large' });
  }
  if (!isValidSubscription(req.body)) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  try {
    if (await isRateLimited(req)) {
      return res.status(429).json({ error: 'Too many subscription attempts' });
    }

    const { endpoint } = req.body;
    const existing = await kv.hget('subs', endpoint);
    if (!existing) {
      const count = await kv.hlen('subs');
      if (count >= getMaxSubscriptions()) {
        return res.status(503).json({ error: 'Subscription capacity reached' });
      }
    }

    await kv.hset('subs', { [endpoint]: req.body });
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Could not store push subscription:', error);
    return res.status(503).json({ error: 'Subscription store unavailable' });
  }
}
