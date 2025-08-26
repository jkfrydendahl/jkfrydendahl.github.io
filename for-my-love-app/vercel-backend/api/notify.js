import webpush from 'web-push';
import { kv } from '@vercel/kv';

const NOTIFY_TOKEN = process.env.NOTIFY_TOKEN;           // set in Vercel
const VAPID_PUBLIC = process.env.VAPID_PUBLIC;           // set in Vercel
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;         // set in Vercel

webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

function hhmmInTZ(tz) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit'
  });
  return fmt.format(new Date()); // "08:00"
}

export default async function handler(req, res) {
  // Optional: bearer gate
  if (req.headers.authorization !== `Bearer ${NOTIFY_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Gate by local time in Copenhagen to avoid DST issues while cron runs hourly.
  const now = hhmmInTZ('Europe/Copenhagen');
  const shouldSend = (req.query.force === '1') || (now === '08:00');
  if (!shouldSend) return res.json({ ok: true, skippedAt: now });

  const title = req.body?.title || 'For My Love';
  const body  = req.body?.body  || '💖 Dagens citat er klar!';
  const url   = req.body?.url   || '/';

  const payload = JSON.stringify({ title, body, url });

  const subs = await kv.hgetall('subs'); // { endpoint: JSON }
  let sent = 0, removed = 0;

  if (subs) {
    for (const [endpoint, json] of Object.entries(subs)) {
      try {
        const sub = JSON.parse(json);
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (e) {
        // 404/410 => expired
        if (e.statusCode === 404 || e.statusCode === 410) {
          await kv.hdel('subs', endpoint);
          removed++;
        }
      }
    }
  }

  res.json({ ok: true, sent, removed });
}
