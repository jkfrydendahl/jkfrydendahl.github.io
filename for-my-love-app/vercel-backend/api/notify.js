import { kv } from '@vercel/kv';
import webpush from 'web-push';

const NOTIFY_TOKEN  = process.env.NOTIFY_TOKEN;
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;

webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

// ---- time gate config ----
const TZ = 'Europe/Copenhagen';
const TARGET_HOUR = 12;        // 12:00 local time
const WINDOW_MINUTES = 5;      // send if 12:00–12:04 (inclusive)

// return { hour, minute, hmString }
function getLocalTimeParts() {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit'
  });
  const parts = fmt.formatToParts(new Date());
  const hour = Number(parts.find(p => p.type === 'hour').value);
  const minute = Number(parts.find(p => p.type === 'minute').value);
  const hmString = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  return { hour, minute, hmString };
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${NOTIFY_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { hour, minute, hmString } = getLocalTimeParts();
  const inWindow = (hour === TARGET_HOUR && minute >= 0 && minute < WINDOW_MINUTES);
  const shouldSend = (req.query.force === '1') || inWindow;

  if (!shouldSend) {
    return res.json({
      ok: true,
      skippedAt: hmString,
      tz: TZ,
      window: `${String(TARGET_HOUR).padStart(2,'0')}:00–${String(TARGET_HOUR).padStart(2,'0')}:${String(WINDOW_MINUTES-1).padStart(2,'0')}`
    });
  }

  const payload = JSON.stringify({
    body:  req.body?.body  || '💖 Dit daglige citat og kælenavn er klar! 💖',
    url:   req.body?.url   || '/'
  });

  const subs = await kv.hgetall('subs'); // { endpoint: object OR string }
  let sent = 0, removed = 0;
  const errors = [];

  if (subs) {
    for (const [endpoint, value] of Object.entries(subs)) {
      const sub = (typeof value === 'string') ? JSON.parse(value) : value; // tolerate both shapes
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (e) {
        const code = e.statusCode || e.code || 0;
        if (code === 404 || code === 410) {
          await kv.hdel('subs', endpoint);
          removed++;
        } else {
          errors.push({ endpoint: endpoint.slice(0, 64) + '…', code, msg: e.message });
        }
      }
    }
  }

  return res.json({ ok: true, sent, removed, errors, ranAt: hmString, tz: TZ });
}
