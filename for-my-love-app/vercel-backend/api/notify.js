import { kv } from '@vercel/kv';
import webpush from 'web-push';

const NOTIFY_TOKEN  = process.env.NOTIFY_TOKEN;
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;

webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

function hhmmInTZ(tz) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, hour:'2-digit', minute:'2-digit' });
  return f.format(new Date()); // "08:00"
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${NOTIFY_TOKEN}`) return res.status(401).json({ error: 'Unauthorized' });

  const now = hhmmInTZ('Europe/Copenhagen');
  const shouldSend = (req.query.force === '1') || (now === '08:00');
  if (!shouldSend) return res.json({ ok: true, skippedAt: now });

  const title = req.body?.title || 'For My Love';
  const body  = req.body?.body  || '💖 Dagens citat er klar!';
  const url   = req.body?.url   || '/';
  const payload = JSON.stringify({ title, body, url });

  const subs = await kv.hgetall('subs'); // { endpoint: jsonString }
  let sent = 0, removed = 0;

  if (subs) for (const [endpoint, json] of Object.entries(subs)) {
    try {
      await webpush.sendNotification(JSON.parse(json), payload);
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await kv.hdel('subs', endpoint);
        removed++;
      }
    }
  }
  res.json({ ok: true, sent, removed });
}
