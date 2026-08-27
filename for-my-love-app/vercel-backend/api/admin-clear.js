import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    res.setHeader('Allow', 'DELETE, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const notifyToken = process.env.NOTIFY_TOKEN;
  if (!notifyToken || req.headers.authorization !== `Bearer ${notifyToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await kv.del('subs');
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Could not clear subscriptions:', error);
    return res.status(503).json({ error: 'Subscription store unavailable' });
  }
}
