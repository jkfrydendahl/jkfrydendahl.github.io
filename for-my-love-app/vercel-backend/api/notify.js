import { kv } from '@vercel/kv';
import webpush from 'web-push';

const DEFAULT_URL =
  process.env.DEFAULT_URL ||
  'https://jkfrydendahl.github.io/for-my-love-app/';

const DEFAULT_CONCURRENCY = 8;
const MAX_CONCURRENCY = 10;

const SUMMER_CRON = '0 6 * * *';
const WINTER_CRON = '0 7 * * *';

function getConcurrency() {
  const configured = Number.parseInt(
    process.env.NOTIFY_CONCURRENCY || '',
    10
  );

  if (!Number.isInteger(configured) || configured < 1) {
    return DEFAULT_CONCURRENCY;
  }

  return Math.min(configured, MAX_CONCURRENCY);
}

function parseSubscription(value) {
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
}

function getHeader(req, name) {
  const value = req.headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getCopenhagenTime(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset'
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return {
    hour: Number.parseInt(parts.hour, 10),
    minute: Number.parseInt(parts.minute, 10),
    offset: parts.timeZoneName,
    formatted:
      `${parts.year}-${parts.month}-${parts.day} ` +
      `${parts.hour}:${parts.minute}:${parts.second} ` +
      `${parts.timeZoneName}`
  };
}

function checkCronWindow(req) {
  const schedule = getHeader(req, 'x-vercel-cron-schedule');
  const localTime = getCopenhagenTime();

  let expectedSchedule;

  if (localTime.offset === 'GMT+02:00') {
    expectedSchedule = SUMMER_CRON;
  } else if (localTime.offset === 'GMT+01:00') {
    expectedSchedule = WINTER_CRON;
  } else {
    return {
      send: false,
      reason: `Unexpected Copenhagen offset: ${localTime.offset}`,
      localTime: localTime.formatted
    };
  }

  if (schedule !== expectedSchedule) {
    return {
      send: false,
      reason: 'Inactive seasonal schedule',
      schedule,
      expectedSchedule,
      localTime: localTime.formatted
    };
  }

  const minutesAfterMidnight =
    localTime.hour * 60 + localTime.minute;

  const windowStart = 8 * 60;
  const windowEnd = 10 * 60 + 30;

  if (
    minutesAfterMidnight < windowStart ||
    minutesAfterMidnight > windowEnd
  ) {
    return {
      send: false,
      reason: 'Outside the 08:00–10:30 Copenhagen window',
      schedule,
      localTime: localTime.formatted
    };
  }

  return {
    send: true,
    schedule,
    localTime: localTime.formatted
  };
}

async function sendInBatches(entries, payload) {
  const result = {
    sent: 0,
    removed: 0,
    errors: []
  };

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

  const workerCount = Math.min(
    getConcurrency(),
    entries.length
  );

  await Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );

  return result;
}

export default async function handler(req, res) {
  const authorization = getHeader(req, 'authorization');
  let cronInfo = null;

  if (req.method === 'GET') {
    const cronKey = process.env.CRON_KEY;

    if (
      !cronKey ||
      authorization !== `Bearer ${cronKey}`
    ) {
      return res.status(401).json({
        error: 'Unauthorized cron request'
      });
    }

    cronInfo = checkCronWindow(req);

    if (!cronInfo.send) {
      console.log('Cron notification skipped:', cronInfo);

      return res.status(200).json({
        ok: true,
        mode: 'skipped',
        ...cronInfo
      });
    }
  } else if (req.method === 'POST') {
    const notifyToken = process.env.NOTIFY_TOKEN;

    if (
      !notifyToken ||
      authorization !== `Bearer ${notifyToken}`
    ) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }
  } else {
    res.setHeader('Allow', 'GET, POST');

    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const vapidPublic = process.env.VAPID_PUBLIC;
  const vapidPrivate = process.env.VAPID_PRIVATE;

  if (!vapidPublic || !vapidPrivate) {
    return res.status(503).json({
      error: 'Push service is not configured'
    });
  }

  webpush.setVapidDetails(
    process.env.VAPID_CONTACT || 'mailto:you@example.com',
    vapidPublic,
    vapidPrivate
  );

  const dryRun =
    req.method === 'POST' &&
    req.query?.dry === '1';

  const payload = JSON.stringify({
    title: req.body?.title || '💖 New Update 💖',
    body:
      req.body?.body ||
      'Your daily quote is ready!',
    url: req.body?.url || DEFAULT_URL
  });

  try {
    const subscriptions = await kv.hgetall('subs');
    const entries = subscriptions
      ? Object.entries(subscriptions)
      : [];

    const delivery = dryRun
      ? {
          sent: 0,
          removed: 0,
          errors: []
        }
      : await sendInBatches(entries, payload);

    return res.status(200).json({
      ok: true,
      mode: dryRun ? 'dry' : 'send',
      trigger: req.method === 'GET' ? 'cron' : 'manual',
      cron: cronInfo,
      total: entries.length,
      ...delivery
    });
  } catch (error) {
    console.error(
      'Notification delivery failed:',
      error
    );

    return res.status(503).json({
      error: 'Notification delivery failed'
    });
  }
}
