// /push-backend/api/admin-clear.js (protect by NOTIFY_TOKEN)
import { kv } from '@vercel/kv';
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.NOTIFY_TOKEN}`) return res.status(401).end();
  await kv.del('subs');
  res.json({ ok: true });
}
