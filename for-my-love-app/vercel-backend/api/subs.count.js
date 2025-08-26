import { kv } from '@vercel/kv';
export default async function handler(req, res) {
  const count = await kv.hlen('subs'); // number of fields in the hash
  res.status(200).json({ count });
}
