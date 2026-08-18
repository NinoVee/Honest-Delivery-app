import { listClients, upsertClient, deleteClient } from '../../../lib/clients';

function isAuthorized(req) {
  const key = req.headers['x-admin-key'];
  return process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY;
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Missing or invalid x-admin-key header.' });
  }

  if (req.method === 'GET') {
    try {
      const clients = await listClients();
      return res.status(200).json({ clients });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to list clients' });
    }
  }

  if (req.method === 'POST') {
    const { phone, facilityName, accountNumber, authorizedContact } = req.body || {};
    if (!phone || !facilityName) {
      return res.status(400).json({ error: 'phone and facilityName are required' });
    }
    try {
      const client = await upsertClient({ phone, facilityName, accountNumber, authorizedContact });
      return res.status(200).json({ client });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to save client' });
    }
  }

  if (req.method === 'DELETE') {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone is required' });
    try {
      await deleteClient(phone);
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to delete client' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end();
}
