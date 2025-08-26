import { kv } from '@vercel/kv';

// Allow your GH Pages origin here (replace with your real URL).
const ALLOW_ORIGIN = '*'; // e.g. "https://<user>.github.io/<repo>"

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sub = req.body;
  if (!sub || !sub.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  await kv.hset('subs', { [sub.endpoint]: JSON.stringify(sub) });
  return res.status(201).json({ ok: true });
}
