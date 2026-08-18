import { buildSessionCookie } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }
  const { name, password } = req.body || {};
  const driverName = (name || '').trim();

  if (!driverName) {
    return res.status(400).json({ error: 'Please enter your name.' });
  }
  if (!process.env.DRIVER_PASSWORD) {
    return res.status(500).json({ error: 'DRIVER_PASSWORD is not set on the server. Add it in Vercel and redeploy.' });
  }
  if (password !== process.env.DRIVER_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  try {
    res.setHeader('Set-Cookie', buildSessionCookie(driverName));
    return res.status(200).json({ ok: true, name: driverName });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Login failed.' });
  }
}
