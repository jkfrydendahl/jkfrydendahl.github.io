import { kv } from '@vercel/kv';

// For testing leave "*" then lock to your exact GH Pages origin.
const ALLOW_ORIGIN = "*"; // e.g. "https://<username>.github.io/<repo>"
//const ALLOW_ORIGIN = 'https://jkfrydendahl.github.io/for-my-love-app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

  // store as object
  await kv.hset('subs', { [sub.endpoint]: sub });
  return res.status(201).json({ ok: true });
}
