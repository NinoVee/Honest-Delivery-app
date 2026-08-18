import { buildLogoutCookie } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }
  res.setHeader('Set-Cookie', buildLogoutCookie());
  return res.status(200).json({ ok: true });
}
