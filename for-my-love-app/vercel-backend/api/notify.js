// /api/notify.js
import { kv } from '@vercel/kv';
import webpush from 'web-push';

const NOTIFY_TOKEN  = process.env.NOTIFY_TOKEN;
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const DEFAULT_URL   = process.env.DEFAULT_URL || '/';

webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

export default async function handler(req, res) {
  // Auth: allow POST+Bearer (manual/Actions) OR GET with Vercel Cron header
  const hasBearer = req.headers.authorization === `Bearer ${NOTIFY_TOKEN}`;
  const isCron = req.headers['x-vercel-cron'] === '1' || typeof req.headers['x-vercel-cron'] !== 'undefined';
  if (!hasBearer && !isCron) return res.status(401).json({ error: 'Unauthorized' });

  // Optional dry-run: ?dry=1 just reports how many subs without sending
  const dryRun = req.query?.dry === '1';

  // Build payload (title-only by default; include body if you want)
  const payload = JSON.stringify({
    title: req.body?.title || '💖 New Update 💖',
    body:  req.body?.body  || 'Your daily quote is ready!',
    url:   req.body?.url   || DEFAULT_URL
  });

  const subs = await kv.hgetall('subs'); // { endpoint: object | string }
  let sent = 0, removed = 0; const errors = [];
  const total = subs ? Object.keys(subs).length : 0;

  if (!dryRun && subs) {
    for (const [endpoint, value] of Object.entries(subs)) {
      const sub = (typeof value === 'string') ? JSON.parse(value) : value; // tolerate both shapes
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (e) {
        const code = e.statusCode || e.code || 0;
        if (code === 404 || code === 410) { await kv.hdel('subs', endpoint); removed++; }
        else { errors.push({ endpoint: endpoint.slice(0, 64) + '…', code, msg: e.message }); }
      }
    }
  }

  return res.json({
    ok: true,
    mode: dryRun ? 'dry' : (isCron ? 'cron' : 'manual'),
    total,
    sent,
    removed,
    errors
  });
}
