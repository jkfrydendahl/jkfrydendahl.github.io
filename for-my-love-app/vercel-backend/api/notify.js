import { kv } from '@vercel/kv';
import webpush from 'web-push';

const NOTIFY_TOKEN  = process.env.NOTIFY_TOKEN;
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const CRON_KEY      = process.env.CRON_KEY;
const DEFAULT_URL   = process.env.DEFAULT_URL || '/';

webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

// ---- time gate config ----
const TZ = 'Europe/Copenhagen';
const TARGET_HOUR = 13;      // 13 = 1pm local
const TARGET_MINUTE = 20;     // start minute (set to 5 for 13:05, etc.)
const WINDOW_MINUTES = 5;    // send during TARGET_MINUTE .. TARGET_MINUTE+WINDOW_MINUTES-1

function getLocalTimeParts() {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit'
  });
  const parts = fmt.formatToParts(new Date());
  const hour = Number(parts.find(p => p.type === 'hour').value);
  const minute = Number(parts.find(p => p.type === 'minute').value);
  const hm = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  return { hour, minute, hm };
}

function pad2(n) { return String(n).padStart(2, '0'); }
function addMinutes(h, m, delta) {
  const total = (h * 60 + m + delta + 1440) % 1440;
  return [Math.floor(total / 60), total % 60];
}

export default async function handler(req, res) {
  // Auth: allow POST+Bearer (manual) OR GET with ?cron_key=... (Vercel Cron)
  const hasBearer = req.headers.authorization === `Bearer ${NOTIFY_TOKEN}`;
  const hasCronKey = req.method === 'GET' && req.query?.cron_key === CRON_KEY;
  if (!hasBearer && !hasCronKey) return res.status(401).json({ error: 'Unauthorized' });

  const { hour, minute, hm } = getLocalTimeParts();
  const inWindow =
    hour === TARGET_HOUR &&
    minute >= TARGET_MINUTE &&
    minute < TARGET_MINUTE + WINDOW_MINUTES;

  const shouldSend = (req.query.force === '1') || inWindow;

  // Build a friendly window label using the configured hour/minute
  const [endHour, endMinute] = addMinutes(TARGET_HOUR, TARGET_MINUTE, WINDOW_MINUTES - 1);
  const windowStr = `${pad2(TARGET_HOUR)}:${pad2(TARGET_MINUTE)}–${pad2(endHour)}:${pad2(endMinute)}`;

  if (!shouldSend) {
    return res.json({ ok: true, skippedAt: hm, tz: TZ, window: windowStr });
  }

  const payload = JSON.stringify({
    title: req.body?.title || '💖 New Update 💖',
    body:  req.body?.body  || 'Your daily quote is ready!',
    url:   req.body?.url   || DEFAULT_URL
  });

  const subs = await kv.hgetall('subs'); // { endpoint: object | string }
  let sent = 0, removed = 0; const errors = [];

  if (subs) {
    for (const [endpoint, value] of Object.entries(subs)) {
      const sub = (typeof value === 'string') ? JSON.parse(value) : value;
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

  return res.json({ ok: true, sent, removed, errors, ranAt: hm, tz: TZ, window: windowStr });
}
