import { kv } from '@vercel/kv';
import webpush from 'web-push';

const DEFAULT_URL = process.env.DEFAULT_URL || '/';
const DEFAULT_CONCURRENCY = 8;
const MAX_CONCURRENCY = 10;

function getConcurrency() {
  const configured = Number.parseInt(process.env.NOTIFY_CONCURRENCY || '', 10);
  if (!Number.isInteger(configured) || configured < 1) {
    return DEFAULT_CONCURRENCY;
  }
  return Math.min(configured, MAX_CONCURRENCY);
}

function parseSubscription(value) {
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
}

async function sendInBatches(entries, payload) {
  const result = { sent: 0, removed: 0, errors: [] };
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < entries.length) {
      const [endpoint, value] = entries[nextIndex];
      nextIndex += 1;

      let subscription;
      try {
        subscription = parseSubscription(value);
      } catch {
        result.errors.push({
          endpoint: `${endpoint.slice(0, 24)}…`,
          code: 0,
          msg: 'Invalid stored subscription'
        });
        continue;
      }

      try {
        await webpush.sendNotification(subscription, payload);
        result.sent += 1;
      } catch (error) {
        const code = error.statusCode || error.code || 0;
        if (code === 404 || code === 410) {
          await kv.hdel('subs', endpoint);
          result.removed += 1;
        } else {
          result.errors.push({
            endpoint: `${endpoint.slice(0, 24)}…`,
            code,
            msg: error.message
          });
        }
      }
    }
  }

  const workerCount = Math.min(getConcurrency(), entries.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const notifyToken = process.env.NOTIFY_TOKEN;
  if (!notifyToken || req.headers.authorization !== `Bearer ${notifyToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const vapidPublic = process.env.VAPID_PUBLIC;
  const vapidPrivate = process.env.VAPID_PRIVATE;
  if (!vapidPublic || !vapidPrivate) {
    return res.status(503).json({ error: 'Push service is not configured' });
  }

  webpush.setVapidDetails(
    process.env.VAPID_CONTACT || 'mailto:you@example.com',
    vapidPublic,
    vapidPrivate
  );

  const dryRun = req.query?.dry === '1';
  const payload = JSON.stringify({
    title: req.body?.title || '💖 New Update 💖',
    body: req.body?.body || 'Your daily quote is ready!',
    url: req.body?.url || DEFAULT_URL
  });

  try {
    const subscriptions = await kv.hgetall('subs');
    const entries = subscriptions ? Object.entries(subscriptions) : [];
    const delivery = dryRun
      ? { sent: 0, removed: 0, errors: [] }
      : await sendInBatches(entries, payload);

    return res.status(200).json({
      ok: true,
      mode: dryRun ? 'dry' : 'send',
      total: entries.length,
      ...delivery
    });
  } catch (error) {
    console.error('Notification delivery failed:', error);
    return res.status(503).json({ error: 'Notification delivery failed' });
  }
}
